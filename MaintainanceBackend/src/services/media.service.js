import { prisma } from '../lib/prisma.js';
import { notFound, badRequest, forbidden } from '../utils/AppError.js';
import { can } from '../shared/permissions.js';
import { sniffMime } from '../middleware/upload.js';
import { processImage, storeRaw, deleteObject, publicUrl } from './storage.service.js';
import { parseListQuery, meta, searchOr } from '../utils/pagination.js';

/** Adds resolved URLs so the client never has to know the storage layout. */
export function decorateMedia(m) {
  if (!m) return null;
  return { ...m, url: publicUrl(m.path), thumb: m.variants?.['400'] ?? publicUrl(m.path) };
}

export async function uploadFiles(files, { folderId, uploadedBy, alt }) {
  if (!files?.length) throw badRequest('No files were uploaded');
  const rows = [];
  for (const file of files) {
    const sniffed = sniffMime(file.buffer);
    if (!sniffed) throw badRequest(`Could not verify the contents of ${file.originalname}`);
    if (sniffed !== file.mimetype && !(sniffed === 'image/avif' && file.mimetype.startsWith('image/'))) {
      throw badRequest(`${file.originalname} does not match its declared type (${file.mimetype})`);
    }
    const data = sniffed.startsWith('image/')
      ? await processImage(file.buffer, file.originalname)
      : await storeRaw(file.buffer, file.originalname, sniffed);
    rows.push(await prisma.media.create({
      data: { ...data, folderId: folderId ?? null, uploadedBy: uploadedBy ?? null, alt: alt ?? null },
    }));
  }
  return rows.map(decorateMedia);
}

export async function listMedia(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query);
  const where = {
    deletedAt: null,
    ...(query.folderId ? { folderId: query.folderId } : {}),
    ...(q ? { OR: searchOr(q, ['alt', 'caption', 'path']) } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.media.findMany({ where, orderBy, skip, take }),
    prisma.media.count({ where }),
  ]);
  return { items: items.map(decorateMedia), meta: meta({ page, limit, total }) };
}

export async function getMedia(id) {
  const m = await prisma.media.findFirst({ where: { id, deletedAt: null } });
  if (!m) throw notFound('Media');
  return decorateMedia(m);
}

export async function updateMedia(id, data) {
  await getMedia(id);
  return decorateMedia(await prisma.media.update({ where: { id }, data }));
}

/** Soft delete; `hard` removes the file and the row for good and needs cms:purge (ADMIN). */
export async function deleteMedia(id, { hard = false, role } = {}) {
  if (hard && !can(role, 'cms:purge')) throw forbidden('Permanent delete needs the cms:purge permission');
  const m = await prisma.media.findUnique({ where: { id } });
  if (!m) throw notFound('Media');
  if (hard) {
    await deleteObject(m.path);
    for (const url of Object.values(m.variants ?? {})) {
      await deleteObject(String(url).replace(/^\/uploads\//, ''));
    }
    await prisma.media.delete({ where: { id } });
    return;
  }
  await prisma.media.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function listFolders() {
  return prisma.mediaFolder.findMany({ orderBy: { name: 'asc' } });
}

export async function createFolder(name, parentId) {
  return prisma.mediaFolder.create({ data: { name, parentId: parentId ?? null } });
}

export async function deleteFolder(id) {
  const count = await prisma.media.count({ where: { folderId: id, deletedAt: null } });
  if (count) throw badRequest(`Move or delete the ${count} file(s) in this folder first`);
  await prisma.mediaFolder.delete({ where: { id } });
}

/**
 * Resolves a set of media ids to decorated objects in one query — used by the
 * public renderer so N sections do not become N queries.
 */
export async function resolveMediaMap(ids) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return {};
  const rows = await prisma.media.findMany({ where: { id: { in: clean } } });
  return Object.fromEntries(rows.map((m) => [m.id, decorateMedia(m)]));
}
