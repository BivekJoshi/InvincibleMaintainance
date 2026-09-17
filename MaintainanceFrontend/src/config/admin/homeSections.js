/**
 * What each home page section is, for the composer. Keys mirror `HOME_SECTION_KEYS` in
 * the API's shared/enums.js and the `SECTIONS` map in `pages/public/HomePage`.
 *
 * - `manage` points at the screen where the section's content is edited (a built one), or
 *   `source` says where it comes from when that screen does not exist yet.
 * - `limit` means the site reads `settings.limit` for this section: how many items it shows.
 *
 * @typedef {{ label: string, shows: string, manage?: string, source?: string, limit?: { default: number, max: number } }} HomeSectionInfo
 */

/** @type {Record<string, HomeSectionInfo>} */
export const HOME_SECTIONS = {
  hero: { label: 'Hero', shows: 'Search, category tiles and the first hero slide’s headline.', manage: '/admin/content/hero-slides' },
  quick_inquiry: { label: 'Promise strip', shows: 'The row of trust badges under the hero.', source: 'Site settings → badges' },
  services: { label: 'Popular services', shows: 'Standard service cards with prices, in catalogue order.', manage: '/admin/content/services', limit: { default: 9, max: 50 } },
  projects: { label: 'Recent work', shows: 'The latest published case studies.', source: 'Projects (Phase D2)', limit: { default: 3, max: 50 } },
  offers: { label: 'Offers', shows: 'Offers whose date window includes today.', source: 'Offers (Phase D2)' },
  gallery: { label: 'Gallery', shows: 'A grid of gallery photos.', source: 'Gallery (Phase D2)', limit: { default: 12, max: 50 } },
  why_choose: { label: 'Why choose us', shows: 'Feature cards in the “why choose” group.', source: 'Features (Phase D2)' },
  construction: { label: 'Why build with us', shows: 'Feature cards in the “construction” group.', source: 'Features (Phase D2)' },
  pre_engineered: { label: 'Pre-engineered buildings', shows: 'Feature cards in the “pre-engineered” group.', source: 'Features (Phase D2)' },
  kitchen: { label: 'Kitchen', shows: 'Kitchen feature cards and the kitchen steps list.', source: 'Features and list items (Phase D2)' },
  stats: { label: 'Counters', shows: 'The dark band of animated numbers.', source: 'Site settings → stats' },
  seepage: { label: 'Seepage explainer', shows: 'The seepage content block and its checkpoints.', source: 'Content blocks (Phase D2)' },
  interior: { label: 'Interior design', shows: 'The interior design content block.', source: 'Content blocks (Phase D2)' },
  renovation: { label: 'Renovation reasons', shows: 'The numbered renovation reasons list.', source: 'List items (Phase D2)' },
  pricing: { label: 'Packages', shows: 'Pricing plan cards.', source: 'Pricing plans (Phase D2)' },
  other_civil: { label: 'Other civil work', shows: 'Chips for services of the “other civil work” type.', manage: '/admin/content/services?type=other_civil' },
  process: { label: 'How it works', shows: 'The process steps, in step order.', manage: '/admin/content/process-steps' },
  testimonials: { label: 'Reviews', shows: 'Approved testimonials.', source: 'Testimonials (Phase D2)', limit: { default: 6, max: 50 } },
  cta_form: { label: 'Free consultation', shows: 'The closing band with the enquiry form.' },
};

/** A key the composer has no copy for still renders, named by its key. */
export const homeSectionInfo = (key) => HOME_SECTIONS[key] ?? { label: key, shows: '' };

/** The composer's draft as `PUT /admin/home-sections` takes it: every section, numbered in list order. */
export const toSectionItems = (sections) => sections.map((s, i) => ({
  key: s.key,
  sortOrder: i,
  isVisible: Boolean(s.isVisible),
  ...(s.settings && Object.keys(s.settings).length ? { settings: s.settings } : {}),
}));
