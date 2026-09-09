import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/AppError.js';
import { allSettings } from './settings.service.js';
import { resolveMediaMap } from './media.service.js';
import { withLocale, listHomeSections } from './cms.service.js';
import { BOOKING_SLOTS } from '../shared/enums.js';

const ACTIVE = { isActive: true, deletedAt: null };
const BY_SORT = [{ sortOrder: 'asc' }, { createdAt: 'desc' }];

/** Collects every media id referenced by a payload so they resolve in one query. */
function collectMediaIds(obj, acc = []) {
  if (!obj) return acc;
  if (Array.isArray(obj)) { obj.forEach((o) => collectMediaIds(o, acc)); return acc; }
  if (typeof obj !== 'object') return acc;
  for (const [k, v] of Object.entries(obj)) {
    if (/^(imageId|coverId|photoId|mediaId|ogImageId|signatureId)$/.test(k) && typeof v === 'string') acc.push(v);
    else if (v && typeof v === 'object') collectMediaIds(v, acc);
  }
  return acc;
}

/** Attaches a resolved `media` map so the client needs no second round-trip. */
async function withMedia(payload) {
  const media = await resolveMediaMap(collectMediaIds(payload));
  return { ...payload, media };
}

/** Settings + navigation, everything the shell needs on first paint. */
export async function bootstrap(locale = 'en') {
  const [settings, categories, sections] = await Promise.all([
    allSettings(),
    prisma.serviceCategory.findMany({ where: ACTIVE, orderBy: BY_SORT, select: { id: true, name: true, slug: true, icon: true } }),
    listHomeSections(),
  ]);
  return withMedia({
    settings,
    locale,
    nav: { categories: await withLocale('serviceCategory', categories, locale) },
    sections: sections.filter((s) => s.isVisible).map((s) => ({ key: s.key, sortOrder: s.sortOrder, settings: s.settings })),
    booking: {
      slots: BOOKING_SLOTS,
      closedWeekdays: settings['booking.closedWeekdays'] ?? [6],
      maxDaysAhead: settings['booking.maxDaysAhead'] ?? 30,
    },
  });
}

/**
 * Assembles the whole home page from the ordered, visible sections. Marketing
 * controls what appears and in what order; this function just walks the list.
 */
export async function home(locale = 'en') {
  const sections = (await listHomeSections()).filter((s) => s.isVisible).sort((a, b) => a.sortOrder - b.sortOrder);

  const loaders = {
    hero: () => prisma.heroSlide.findMany({ where: ACTIVE, orderBy: BY_SORT }),
    services: (s) => prisma.service.findMany({
      where: { ...ACTIVE, type: 'standard' }, orderBy: BY_SORT, take: s.settings?.limit ?? 9,
      include: { category: { select: { name: true, slug: true } } },
    }),
    other_civil: () => prisma.service.findMany({ where: { ...ACTIVE, type: 'other_civil' }, orderBy: BY_SORT }),
    projects: (s) => prisma.project.findMany({
      where: ACTIVE, orderBy: BY_SORT, take: s.settings?.limit ?? 3,
      include: { images: { orderBy: { sortOrder: 'asc' }, take: 6 } },
    }),
    offers: () => prisma.offer.findMany({
      where: {
        ...ACTIVE,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
        ],
      },
      orderBy: BY_SORT,
    }),
    gallery: (s) => prisma.galleryImage.findMany({ where: ACTIVE, orderBy: BY_SORT, take: s.settings?.limit ?? 12 }),
    why_choose: () => prisma.feature.findMany({ where: { ...ACTIVE, group: 'why_choose' }, orderBy: BY_SORT }),
    construction: () => prisma.feature.findMany({ where: { ...ACTIVE, group: 'construction' }, orderBy: BY_SORT }),
    pre_engineered: () => prisma.feature.findMany({ where: { ...ACTIVE, group: 'pre_engineered' }, orderBy: BY_SORT }),
    kitchen: async () => ({
      cards: await prisma.feature.findMany({ where: { ...ACTIVE, group: 'kitchen' }, orderBy: BY_SORT }),
      steps: await prisma.listItem.findMany({ where: { ...ACTIVE, group: 'kitchen_steps' }, orderBy: { position: 'asc' } }),
    }),
    renovation: () => prisma.listItem.findMany({ where: { ...ACTIVE, group: 'renovation_reasons' }, orderBy: { position: 'asc' } }),
    seepage: async () => ({
      block: await prisma.contentBlock.findFirst({ where: { ...ACTIVE, key: 'seepage_explainer' } }),
      checkpoints: await prisma.listItem.findMany({ where: { ...ACTIVE, group: 'seepage_checkpoints' }, orderBy: { position: 'asc' } }),
    }),
    interior: () => prisma.contentBlock.findFirst({ where: { ...ACTIVE, key: 'interior_design' } }),
    pricing: () => prisma.pricingPlan.findMany({ where: ACTIVE, orderBy: BY_SORT }),
    process: () => prisma.processStep.findMany({ where: ACTIVE, orderBy: [{ stepNo: 'asc' }] }),
    testimonials: (s) => prisma.testimonial.findMany({
      where: { ...ACTIVE, isApproved: true, ...(locale === 'ne' ? {} : {}) },
      orderBy: BY_SORT, take: s.settings?.limit ?? 6,
    }),
    stats: async () => {
      const settings = await allSettings();
      return settings['stats.items'] ?? [];
    },
    quick_inquiry: async () => (await allSettings())['badges.items'] ?? [],
    cta_form: async () => ({
      services: await prisma.service.findMany({ where: ACTIVE, orderBy: BY_SORT, select: { id: true, name: true } }),
    }),
  };

  const LOCALE_MODEL = {
    hero: 'heroSlide', services: 'service', other_civil: 'service', projects: 'project',
    offers: 'offer', why_choose: 'feature', construction: 'feature', pre_engineered: 'feature',
    renovation: 'listItem', pricing: 'pricingPlan', process: 'processStep', testimonials: 'testimonial',
  };

  const out = [];
  for (const section of sections) {
    const load = loaders[section.key];
    if (!load) continue;
    let data = await load(section);
    const model = LOCALE_MODEL[section.key];
    if (model && Array.isArray(data)) data = await withLocale(model, data, locale);
    out.push({ key: section.key, settings: section.settings ?? null, data });
  }

  return withMedia({ sections: out, settings: await allSettings() });
}

export async function listServices(query = {}, locale = 'en') {
  const rows = await prisma.service.findMany({
    where: {
      ...ACTIVE,
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.featured ? { isFeatured: true } : {}),
      ...(query.type ? { type: query.type } : {}),
    },
    orderBy: BY_SORT,
    include: { category: { select: { name: true, slug: true } } },
  });
  return withMedia({ items: await withLocale('service', rows, locale) });
}

export async function getService(slug, locale = 'en') {
  const service = await prisma.service.findFirst({ where: { ...ACTIVE, slug }, include: { category: true } });
  if (!service) throw notFound('Service');
  const [localized] = await withLocale('service', [service], locale);
  const [related, faqs] = await Promise.all([
    prisma.project.findMany({ where: { ...ACTIVE, categoryId: service.categoryId }, orderBy: BY_SORT, take: 3, include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } } }),
    prisma.faq.findMany({ where: { ...ACTIVE, OR: [{ group: slug }, { group: 'general' }] }, orderBy: BY_SORT }),
  ]);
  return withMedia({ service: localized, related, faqs });
}

export async function listProjects(query = {}, locale = 'en') {
  const rows = await prisma.project.findMany({
    where: {
      ...ACTIVE,
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: BY_SORT,
    include: { category: { select: { name: true, slug: true } }, images: { take: 1, orderBy: { sortOrder: 'asc' } } },
  });
  return withMedia({ items: await withLocale('project', rows, locale) });
}

export async function getProject(slug, locale = 'en') {
  const project = await prisma.project.findFirst({
    where: { ...ACTIVE, slug },
    include: { category: true, images: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!project) throw notFound('Project');
  const [localized] = await withLocale('project', [project], locale);
  return withMedia({ project: localized });
}

export async function listOffers(locale = 'en') {
  const rows = await prisma.offer.findMany({
    where: {
      ...ACTIVE,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
      ],
    },
    orderBy: BY_SORT,
  });
  return withMedia({ items: await withLocale('offer', rows, locale) });
}

export async function pricing(locale = 'en') {
  const [plans, rateCard, services] = await Promise.all([
    prisma.pricingPlan.findMany({ where: ACTIVE, orderBy: BY_SORT }),
    prisma.rateCardItem.findMany({ where: ACTIVE, orderBy: BY_SORT }),
    prisma.service.findMany({
      where: { ...ACTIVE, priceFrom: { not: null } },
      orderBy: BY_SORT,
      select: { id: true, name: true, slug: true, priceFrom: true, priceTo: true, priceUnit: true },
    }),
  ]);
  return withMedia({
    plans: await withLocale('pricingPlan', plans, locale),
    rateCard,
    services,
  });
}

export const listGallery = async () =>
  withMedia({ items: await prisma.galleryImage.findMany({ where: ACTIVE, orderBy: BY_SORT }) });

export const listTestimonials = async (locale = 'en') =>
  withMedia({
    items: await prisma.testimonial.findMany({ where: { ...ACTIVE, isApproved: true }, orderBy: BY_SORT }),
    locale,
  });

export const listFaqs = (group) =>
  prisma.faq.findMany({ where: { ...ACTIVE, ...(group ? { group } : {}) }, orderBy: BY_SORT });

export async function listPosts(query = {}) {
  const rows = await prisma.post.findMany({
    where: { ...ACTIVE, publishedAt: { lte: new Date() }, ...(query.category ? { category: { slug: query.category } } : {}) },
    orderBy: { publishedAt: 'desc' },
    include: { category: { select: { name: true, slug: true } } },
    take: Number(query.limit) || 24,
  });
  return withMedia({ items: rows });
}

export async function getPost(slug) {
  const post = await prisma.post.findFirst({
    where: { ...ACTIVE, slug, publishedAt: { lte: new Date() } },
    include: { category: true },
  });
  if (!post) throw notFound('Post');
  return withMedia({ post });
}

export async function getPage(slug) {
  const page = await prisma.page.findFirst({ where: { ...ACTIVE, slug } });
  if (!page) throw notFound('Page');
  return { page };
}

/** sitemap.xml generated from published content. */
export async function sitemap(origin) {
  const [services, projects, posts, pages] = await Promise.all([
    prisma.service.findMany({ where: ACTIVE, select: { slug: true, updatedAt: true } }),
    prisma.project.findMany({ where: ACTIVE, select: { slug: true, updatedAt: true } }),
    prisma.post.findMany({ where: { ...ACTIVE, publishedAt: { lte: new Date() } }, select: { slug: true, updatedAt: true } }),
    prisma.page.findMany({ where: ACTIVE, select: { slug: true, updatedAt: true } }),
  ]);

  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/services', priority: '0.9', changefreq: 'weekly' },
    { loc: '/projects', priority: '0.8', changefreq: 'weekly' },
    { loc: '/offers', priority: '0.8', changefreq: 'daily' },
    { loc: '/pricing', priority: '0.8', changefreq: 'weekly' },
    { loc: '/gallery', priority: '0.6', changefreq: 'monthly' },
    { loc: '/blog', priority: '0.7', changefreq: 'weekly' },
    { loc: '/contact', priority: '0.7', changefreq: 'monthly' },
    ...services.map((s) => ({ loc: `/services/${s.slug}`, lastmod: s.updatedAt, priority: '0.9', changefreq: 'monthly' })),
    ...projects.map((p) => ({ loc: `/projects/${p.slug}`, lastmod: p.updatedAt, priority: '0.7', changefreq: 'monthly' })),
    ...posts.map((p) => ({ loc: `/blog/${p.slug}`, lastmod: p.updatedAt, priority: '0.6', changefreq: 'monthly' })),
    ...pages.map((p) => ({ loc: `/${p.slug}`, lastmod: p.updatedAt, priority: '0.5', changefreq: 'monthly' })),
  ];

  const body = urls.map((u) => {
    const alt = `    <xhtml:link rel="alternate" hreflang="ne" href="${origin}/ne${u.loc}"/>\n` +
                `    <xhtml:link rel="alternate" hreflang="en" href="${origin}${u.loc}"/>`;
    return `  <url>\n    <loc>${origin}${u.loc}</loc>\n` +
      (u.lastmod ? `    <lastmod>${new Date(u.lastmod).toISOString()}</lastmod>\n` : '') +
      `    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n${alt}\n  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>`;
}

/** schema.org JSON-LD for the business — the SEO win the original site misses. */
export async function jsonLd(origin) {
  const s = await allSettings();
  const [services, reviews] = await Promise.all([
    prisma.service.findMany({ where: ACTIVE, orderBy: BY_SORT, select: { name: true, slug: true, excerpt: true } }),
    prisma.testimonial.findMany({ where: { ...ACTIVE, isApproved: true }, orderBy: BY_SORT, take: 20 }),
  ]);
  const ratings = reviews.map((r) => r.rating).filter(Boolean);

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: s['contact.companyName'] ?? 'Maintenance System',
    telephone: [s['contact.phonePrimary'], s['contact.phoneSecondary']].filter(Boolean),
    email: s['contact.email'],
    url: origin,
    address: {
      '@type': 'PostalAddress',
      streetAddress: s['contact.address'],
      addressLocality: s['contact.city'] ?? 'Lalitpur',
      addressCountry: 'NP',
    },
    ...(ratings.length
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1),
            reviewCount: ratings.length,
          },
        }
      : {}),
    review: reviews.slice(0, 10).map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author },
      reviewRating: { '@type': 'Rating', ratingValue: r.rating },
      reviewBody: r.quote,
    })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Services',
      itemListElement: services.map((sv) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: sv.name, description: sv.excerpt, url: `${origin}/services/${sv.slug}` },
      })),
    },
  };
}
