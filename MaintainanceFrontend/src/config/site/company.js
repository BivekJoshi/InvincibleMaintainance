/**
 * What the storefront shows before the CMS answers.
 *
 * `settings` come from `/public/bootstrap`, which is a network round trip; the
 * header renders before it lands and would otherwise flash an empty phone
 * number and a nameless logo. These are the values seeded in the database —
 * change them there, and change them here in the same commit.
 */
export const COMPANY_FALLBACKS = {
  name: 'Ghar Jatan',
  tagline: 'Certified engineers. Transparent pricing. Two-hour response.',
  phone: '01-5407720',
  mobile: '9808338255',
  email: '',
  address: '',
  city: 'Lalitpur',
};

/** Settings keys, spelled once. A typo here fails loudly instead of silently. */
export const SETTINGS_KEYS = {
  name: 'contact.companyName',
  tagline: 'branding.tagline',
  phone: 'contact.phonePrimary',
  mobile: 'contact.phoneSecondary',
  email: 'contact.email',
  address: 'contact.address',
  city: 'contact.city',
  mapEmbed: 'contact.mapEmbed',
  whatsapp: 'contact.whatsapp',
  viber: 'contact.viber',
  badges: 'badges.items',
  seoTitle: 'seo.defaultTitle',
  seoDescription: 'seo.defaultDescription',
};

/** The social profiles the footer links to, in this order, when their setting holds an address. */
export const SOCIAL_KEYS = [
  { key: 'social.facebook', label: 'Facebook' },
  { key: 'social.instagram', label: 'Instagram' },
  { key: 'social.tiktok', label: 'TikTok' },
  { key: 'social.youtube', label: 'YouTube' },
];
