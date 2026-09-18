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
    if (/^(imageId|coverId|photoId|mediaId|ogImageId|signatureId|logoId)$/.test(k) && typeof v === 'string') acc.push(v);
    else if (v && typeof v === 'object') collectMediaIds(v, acc);
  }
  return acc;
}

/** Attaches a resolved `media` map so the client needs no second round-trip. */
async function withMedia(payload) {
  const media = await resolveMediaMap(collectMediaIds(payload));
  return { ...payload, media };
}

/** A post is public once it is switched on and its publish time has passed. */
const publishedPost = () => ({ ...ACTIVE, publishedAt: { lte: new Date() } });

/** Settings + navigation, everything the shell needs on first paint. */
export async function bootstrap(locale = 'en') {
  const [settings, categories, sections, postCount, pages] = await Promise.all([
    allSettings(),
    prisma.serviceCategory.findMany({
      where: ACTIVE,
      orderBy: BY_SORT,
      // imageId so the storefront's category rail can show the trade itself; it
      // resolves through `withMedia` below like every other picture.
      select: { id: true, name: true, slug: true, icon: true, imageId: true },
    }),
    listHomeSections(),
    prisma.post.count({ where: publishedPost() }),
    prisma.page.findMany({ where: ACTIVE, orderBy: BY_SORT, select: { id: true, slug: true, title: true } }),
  ]);
  return withMedia({
    settings,
    locale,
    // The logo is a media id in settings; named here so `withMedia` resolves it to its URLs.
    brand: { logoId: settings['branding.logoId'] || null },
    nav: {
      categories: await withLocale('serviceCategory', categories, locale),
      // The site links to the blog only once there is something in it.
      blog: postCount > 0,
      // Generic pages the site serves at /:slug — also what a CMS link is checked against.
      pages: (await withLocale('page', pages, locale)).map(({ slug, title }) => ({ slug, title })),
    },
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
    // The object-shaped sections overlay their own translations; the loop below only reaches arrays.
    kitchen: async () => ({
      cards: await withLocale('feature', await prisma.feature.findMany({ where: { ...ACTIVE, group: 'kitchen' }, orderBy: BY_SORT }), locale),
      steps: await withLocale('listItem', await prisma.listItem.findMany({ where: { ...ACTIVE, group: 'kitchen_steps' }, orderBy: { position: 'asc' } }), locale),
    }),
    renovation: () => prisma.listItem.findMany({ where: { ...ACTIVE, group: 'renovation_reasons' }, orderBy: { position: 'asc' } }),
    seepage: async () => ({
      block: await localizedOne('contentBlock', await prisma.contentBlock.findFirst({ where: { ...ACTIVE, key: 'seepage_explainer' } }), locale),
      checkpoints: await withLocale('listItem', await prisma.listItem.findMany({ where: { ...ACTIVE, group: 'seepage_checkpoints' }, orderBy: { position: 'asc' } }), locale),
    }),
    interior: async () => localizedOne('contentBlock', await prisma.contentBlock.findFirst({ where: { ...ACTIVE, key: 'interior_design' } }), locale),
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

/** `withLocale` for one row, which may be missing. */
async function localizedOne(model, row, locale) {
  if (!row) return row;
  const [localized] = await withLocale(model, [row], locale);
  return localized;
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
  const RELATED_SELECT = {
    orderBy: BY_SORT,
    take: 3,
    include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } },
  };
  // Work done on THIS service is stronger proof than anything merely in the same
  // category, so it wins; the category is only the fallback.
  const [onService, faqs] = await Promise.all([
    prisma.project.findMany({ where: { ...ACTIVE, serviceId: service.id }, ...RELATED_SELECT }),
    prisma.faq.findMany({ where: { ...ACTIVE, OR: [{ group: slug }, { group: 'general' }] }, orderBy: BY_SORT }),
  ]);
  const related = onService.length
    ? onService
    : await prisma.project.findMany({
        where: { ...ACTIVE, categoryId: service.categoryId, serviceId: null },
        ...RELATED_SELECT,
      });
  return withMedia({ service: localized, related, faqs: await withLocale('faq', faqs, locale) });
}

export async function listProjects(query = {}, locale = 'en') {
  const rows = await prisma.project.findMany({
    where: {
      ...ACTIVE,
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.service ? { service: { slug: query.service } } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: BY_SORT,
    include: {
      category: { select: { name: true, slug: true } },
      service: { select: { name: true, slug: true } },
      images: { take: 1, orderBy: { sortOrder: 'asc' } },
    },
  });
  return withMedia({ items: await withLocale('project', rows, locale) });
}

export async function getProject(slug, locale = 'en') {
  const project = await prisma.project.findFirst({
    where: { ...ACTIVE, slug },
    include: {
      category: true,
      service: { select: { id: true, name: true, slug: true, priceUnit: true } },
      images: { orderBy: { sortOrder: 'asc' } },
    },
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

export const listFaqs = async (group, locale = 'en') =>
  withLocale('faq', await prisma.faq.findMany({ where: { ...ACTIVE, ...(group ? { group } : {}) }, orderBy: BY_SORT }), locale);

/**
 * Published posts, newest first, with the categories that have any — the blog's filter.
 * A draft (no `publishedAt`) and a post scheduled for later are not listed.
 */
export async function listPosts(query = {}, locale = 'en') {
  const [rows, categories] = await Promise.all([
    prisma.post.findMany({
      where: { ...publishedPost(), ...(query.category ? { category: { slug: String(query.category) } } : {}) },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true, title: true, slug: true, excerpt: true, coverId: true, publishedAt: true,
        category: { select: { id: true, name: true, slug: true } },
      },
      take: Math.min(Number(query.limit) || 24, 100),
    }),
    prisma.postCategory.findMany({
      where: { ...ACTIVE, posts: { some: publishedPost() } },
      orderBy: BY_SORT,
      select: { id: true, name: true, slug: true },
    }),
  ]);
  return withMedia({ items: await withLocale('post', rows, locale), categories });
}

export async function getPost(slug, locale = 'en') {
  const post = await prisma.post.findFirst({
    where: { ...publishedPost(), slug },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  if (!post) throw notFound('Post');
  return withMedia({ post: await localizedOne('post', post, locale) });
}

export async function getPage(slug, locale = 'en') {
  const page = await prisma.page.findFirst({ where: { ...ACTIVE, slug } });
  if (!page) throw notFound('Page');
  return { page: await localizedOne('page', page, locale) };
}

/**
 * sitemap.xml generated from published content.
 *
 * Only paths the SPA actually routes belong here — a sitemap entry with no route
 * is a soft 404, which costs exactly the crawl budget the sitemap exists to earn.
 * Keep this list in step with MaintainanceFrontend/src/routes/AppRoutes.jsx; /offers
 * and /gallery were listed here for months with no page behind them. /blog is listed
 * only while it has a published post, as the site's nav does.
 *
 * There is no /ne URL prefix either: the site switches locale with a toggle, so
 * an hreflang alternate under /ne pointed every crawler at a 404.
 */
export async function sitemap(origin) {
  const [services, projects, posts, pages] = await Promise.all([
    prisma.service.findMany({ where: ACTIVE, select: { slug: true, updatedAt: true } }),
    prisma.project.findMany({ where: ACTIVE, select: { slug: true, updatedAt: true } }),
    prisma.post.findMany({ where: publishedPost(), select: { slug: true, updatedAt: true } }),
    prisma.page.findMany({ where: ACTIVE, select: { slug: true, updatedAt: true } }),
  ]);

  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/services', priority: '0.9', changefreq: 'weekly' },
    { loc: '/projects', priority: '0.8', changefreq: 'weekly' },
    { loc: '/pricing', priority: '0.8', changefreq: 'weekly' },
    { loc: '/book', priority: '0.8', changefreq: 'monthly' },
    { loc: '/contact', priority: '0.7', changefreq: 'monthly' },
    ...services.map((s) => ({ loc: `/services/${s.slug}`, lastmod: s.updatedAt, priority: '0.9', changefreq: 'monthly' })),
    ...projects.map((p) => ({ loc: `/projects/${p.slug}`, lastmod: p.updatedAt, priority: '0.7', changefreq: 'monthly' })),
    ...(posts.length ? [{ loc: '/blog', priority: '0.6', changefreq: 'weekly' }] : []),
    ...posts.map((p) => ({ loc: `/blog/${p.slug}`, lastmod: p.updatedAt, priority: '0.6', changefreq: 'monthly' })),
    ...pages.map((p) => ({ loc: `/${p.slug}`, lastmod: p.updatedAt, priority: '0.5', changefreq: 'monthly' })),
  ];

  const body = urls.map((u) => (
    `  <url>\n    <loc>${origin}${u.loc}</loc>\n` +
    (u.lastmod ? `    <lastmod>${new Date(u.lastmod).toISOString()}</lastmod>\n` : '') +
    `    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  )).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
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
