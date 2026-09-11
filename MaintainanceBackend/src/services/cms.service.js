import { makeCrud } from './crud.service.js';
import { prisma } from '../lib/prisma.js';
import { HOME_SECTION_KEYS } from '../shared/enums.js';
import { invalidatePublic } from './cache.service.js';
import { badRequest } from '../utils/AppError.js';

export const heroSlides = makeCrud({
  model: 'heroSlide', label: 'Hero slide', searchFields: ['title', 'subtitle'],
});

export const serviceCategories = makeCrud({
  model: 'serviceCategory', label: 'Service category', searchFields: ['name', 'slug'], slugFrom: 'name',
});

export const services = makeCrud({
  model: 'service',
  label: 'Service',
  searchFields: ['name', 'slug', 'excerpt'],
  slugFrom: 'name',
  moneyFields: ['priceFrom', 'priceTo'],
  include: { category: { select: { id: true, name: true, slug: true } } },
  filter: (q) => ({
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.type ? { type: q.type } : {}),
    ...(q.featured ? { isFeatured: true } : {}),
  }),
});

export const projects = makeCrud({
  model: 'project',
  label: 'Project',
  searchFields: ['title', 'slug', 'clientName', 'location', 'problem'],
  slugFrom: 'title',
  moneyFields: ['costBandMin', 'costBandMax'],
  include: {
    category: { select: { id: true, name: true, slug: true } },
    service: { select: { id: true, name: true, slug: true } },
    images: { orderBy: { sortOrder: 'asc' } },
  },
  filter: (q) => ({
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.serviceId ? { serviceId: q.serviceId } : {}),
    ...(q.status ? { status: q.status } : {}),
  }),
});

export const offers = makeCrud({ model: 'offer', label: 'Offer', searchFields: ['title', 'description'], moneyFields: ['priceMin', 'priceMax'] });
export const pricingPlans = makeCrud({ model: 'pricingPlan', label: 'Pricing plan', searchFields: ['title', 'description'], moneyFields: ['priceMin', 'priceMax'] });
export const features = makeCrud({ model: 'feature', label: 'Feature', searchFields: ['title', 'description'], filter: (q) => (q.group ? { group: q.group } : {}) });
// A numbered list: the order IS the number a visitor reads, so it lives in `position`.
export const listItems = makeCrud({ model: 'listItem', label: 'List item', searchFields: ['text'], orderField: 'position', filter: (q) => (q.group ? { group: q.group } : {}) });
export const contentBlocks = makeCrud({ model: 'contentBlock', label: 'Content block', searchFields: ['key', 'heading', 'body'] });
export const processSteps = makeCrud({ model: 'processStep', label: 'Process step', searchFields: ['title', 'description'], defaultSort: 'stepNo' });
export const galleryImages = makeCrud({ model: 'galleryImage', label: 'Gallery image', searchFields: ['caption'], filter: (q) => (q.projectId ? { projectId: q.projectId } : {}) });
export const faqs = makeCrud({ model: 'faq', label: 'FAQ', searchFields: ['question', 'answer'], filter: (q) => (q.group ? { group: q.group } : {}) });
export const pages = makeCrud({ model: 'page', label: 'Page', searchFields: ['title', 'slug'], slugFrom: 'title' });
export const postCategories = makeCrud({ model: 'postCategory', label: 'Post category', searchFields: ['name'], slugFrom: 'name' });
export const posts = makeCrud({
  model: 'post', label: 'Post', searchFields: ['title', 'excerpt', 'body'], slugFrom: 'title',
  include: { category: { select: { id: true, name: true, slug: true } } },
  filter: (q) => (q.categoryId ? { categoryId: q.categoryId } : {}),
});

export const testimonials = makeCrud({
  model: 'testimonial', label: 'Testimonial', searchFields: ['quote', 'author', 'location'],
  filter: (q) => (q.approved === 'true' ? { isApproved: true } : q.approved === 'false' ? { isApproved: false } : {}),
});

export async function approveTestimonial(id, isApproved) {
  const row = await testimonials.get(id);
  const updated = await prisma.testimonial.update({ where: { id: row.id }, data: { isApproved } });
  await invalidatePublic();
  return updated;
}

// ── project images

export async function addProjectImage(projectId, data) {
  await projects.get(projectId);
  const row = await prisma.projectImage.create({ data: { ...data, projectId } });
  await invalidatePublic();
  return row;
}

export async function removeProjectImage(projectId, imageId) {
  const row = await prisma.projectImage.findFirst({ where: { id: imageId, projectId } });
  if (!row) throw badRequest('That image does not belong to this project');
  await prisma.projectImage.delete({ where: { id: imageId } });
  await invalidatePublic();
}

export async function reorderProjectImages(projectId, items) {
  await prisma.$transaction(
    items.map((i) => prisma.projectImage.updateMany({
      where: { id: i.id, projectId }, data: { sortOrder: i.sortOrder },
    })),
  );
  await invalidatePublic();
}

// ── home page composer

const DEFAULT_SECTION_TITLES = {
  hero: 'Hero slider', quick_inquiry: 'Quick inquiry strip', services: 'Services grid',
  projects: 'Projects', offers: 'Special offers', gallery: 'Photo gallery',
  why_choose: 'Why choose us', stats: 'Counters', seepage: 'Seepage & cracks',
  interior: 'Interior design', construction: 'Why construction', renovation: 'Renovation reasons',
  pre_engineered: 'Pre-engineered buildings', kitchen: 'Kitchen modernization',
  pricing: 'Popular work & pricing', other_civil: 'Other civil work',
  process: 'Working process', testimonials: 'Testimonials', cta_form: 'Free consultation form',
};

export async function listHomeSections() {
  const rows = await prisma.homeSection.findMany({ orderBy: { sortOrder: 'asc' } });
  if (rows.length) return rows;
  // First run: materialise the canonical section list.
  await prisma.homeSection.createMany({
    data: HOME_SECTION_KEYS.map((key, i) => ({
      key, title: DEFAULT_SECTION_TITLES[key] ?? key, sortOrder: i, isVisible: true,
    })),
    skipDuplicates: true,
  });
  return prisma.homeSection.findMany({ orderBy: { sortOrder: 'asc' } });
}

export async function updateHomeSections(items) {
  await prisma.$transaction(
    items.map((i) => prisma.homeSection.upsert({
      where: { key: i.key },
      create: {
        key: i.key, title: DEFAULT_SECTION_TITLES[i.key] ?? i.key,
        sortOrder: i.sortOrder, isVisible: i.isVisible, settings: i.settings ?? undefined,
      },
      update: { sortOrder: i.sortOrder, isVisible: i.isVisible, settings: i.settings ?? undefined },
    })),
  );
  await invalidatePublic();
  return listHomeSections();
}

// ── translations

export async function getTranslations(model, recordId) {
  const rows = await prisma.translation.findMany({ where: { model, recordId } });
  return rows.reduce((acc, r) => {
    (acc[r.field] ??= {})[r.locale] = r.value;
    return acc;
  }, {});
}

export async function upsertTranslations({ model, recordId, values }) {
  const ops = [];
  for (const [field, byLocale] of Object.entries(values)) {
    for (const [locale, value] of Object.entries(byLocale)) {
      ops.push(
        value
          ? prisma.translation.upsert({
              where: { model_recordId_field_locale: { model, recordId, field, locale } },
              create: { model, recordId, field, locale, value },
              update: { value },
            })
          : prisma.translation.deleteMany({ where: { model, recordId, field, locale } }),
      );
    }
  }
  if (ops.length) await prisma.$transaction(ops);
  await invalidatePublic();
  return getTranslations(model, recordId);
}

/**
 * Overlays `ne` translations onto a list of rows when locale=ne is requested,
 * in a single query for the whole batch.
 */
export async function withLocale(model, rows, locale) {
  if (locale !== 'ne' || !rows?.length) return rows;
  const ids = rows.map((r) => r.id);
  const trs = await prisma.translation.findMany({ where: { model, recordId: { in: ids }, locale } });
  if (!trs.length) return rows;
  const byRecord = trs.reduce((acc, t) => {
    (acc[t.recordId] ??= {})[t.field] = t.value;
    return acc;
  }, {});
  return rows.map((r) => (byRecord[r.id] ? { ...r, ...byRecord[r.id] } : r));
}
