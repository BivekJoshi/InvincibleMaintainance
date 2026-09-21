import { prisma } from '../lib/prisma.js';
import { badRequest } from '../utils/AppError.js';
import { uploadFiles, decorateMedia } from './media.service.js';

/** Where an anonymous upload lands, so a customer's photo never mixes with the website's library. */
export const CUSTOMER_UPLOADS_FOLDER = 'Customer uploads';

/** How many photos one enquiry may carry. The form says the same number. */
export const MAX_LEAD_PHOTOS = 5;

/** The largest photo a phone camera should need. The form refuses a bigger one before it uploads. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** The folder anonymous uploads go to, made the first time someone uses it. */
export async function customerUploadsFolder() {
  const existing = await prisma.mediaFolder.findFirst({ where: { name: CUSTOMER_UPLOADS_FOLDER, parentId: null } });
  return existing ?? prisma.mediaFolder.create({ data: { name: CUSTOMER_UPLOADS_FOLDER } });
}

/**
 * Photos a visitor attached to the enquiry they are filling in. They are stored before the
 * lead exists — the form has no lead yet — and stay unattached until `attachLeadPhotos`
 * links them, so nothing here trusts the caller beyond the file itself.
 *
 * @param {Express.Multer.File[]} files
 * @param {string} [ip]  kept on the media row's `alt` for the office to trace an abusive upload
 */
export async function uploadCustomerPhotos(files, { ip } = {}) {
  if (!files?.length) throw badRequest('Choose at least one photo');
  if (files.length > MAX_LEAD_PHOTOS) throw badRequest(`Up to ${MAX_LEAD_PHOTOS} photos, please`);
  if (files.some((f) => !f.mimetype?.startsWith('image/'))) throw badRequest('Photos only, please');
  if (files.some((f) => f.size > MAX_PHOTO_BYTES)) throw badRequest('Each photo must be 10 MB or smaller');
  const folder = await customerUploadsFolder();
  const media = await uploadFiles(files, { folderId: folder.id, alt: `Sent by a customer${ip ? ` from ${ip}` : ''}` });
  return media.map((m) => ({ id: m.id, url: m.url, thumb: m.thumb, width: m.width, height: m.height }));
}

/**
 * Links uploaded photos to the lead they were sent with. Ignores anything that is not an
 * unattached customer upload, so a stray or reused id cannot pull the website's media — or
 * another lead's photos — onto this record.
 *
 * @param {string} leadId
 * @param {string[]} mediaIds
 */
export async function attachLeadPhotos(leadId, mediaIds) {
  const ids = [...new Set(mediaIds ?? [])].slice(0, MAX_LEAD_PHOTOS);
  if (!ids.length) return 0;
  const folder = await customerUploadsFolder();
  const usable = await prisma.media.findMany({
    where: { id: { in: ids }, deletedAt: null, folderId: folder.id, leadPhoto: null },
    select: { id: true },
  });
  if (!usable.length) return 0;
  const order = new Map(ids.map((id, i) => [id, i]));
  await prisma.leadPhoto.createMany({
    data: usable.map((m) => ({ leadId, mediaId: m.id, sortOrder: order.get(m.id) ?? 0 })),
    skipDuplicates: true,
  });
  return usable.length;
}

/** A lead's photos for the office, newest enquiry order, with their URLs resolved. */
export function decorateLeadPhotos(photos = []) {
  return photos.map(({ media, ...p }) => {
    const m = decorateMedia(media);
    return { id: p.id, mediaId: p.mediaId, caption: p.caption, url: m?.url, thumb: m?.thumb, width: m?.width, height: m?.height };
  });
}
