import { z } from 'zod';
import { rupees } from './fields';
import { UNITS } from '@/config/constants';

/**
 * Mirrors MaintainanceBackend/src/shared/schemas/cms.js, one schema per CMS resource.
 * When an API rule changes there, change it here in the same commit — the form must
 * refuse what the API will refuse.
 *
 * Values are the form's: money in rupees (the API converts to paisa), dates as the
 * UTC ISO strings the date fields hold.
 */

// ── building blocks, mirroring shared/schemas/common.js

const optionalText = z.string().trim().max(20000).optional().or(z.literal('')).transform((v) => v || undefined);
const optionalRupees = rupees.max(1_000_000_000).optional();
const sortOrder = z.coerce.number().int().min(0).max(100000).default(0);
const isActive = z.coerce.boolean().default(true);
const bullets = z.array(z.string().trim().min(1).max(500)).max(50).optional();
const locale = z.enum(['en', 'ne']);
const unit = z.enum(UNITS);
const seoFields = {
  metaTitle: z.string().trim().max(180).optional(),
  metaDescription: z.string().trim().max(400).optional(),
  ogImageId: z.string().optional(),
};

const title = z.string().trim().min(2).max(250);
const optionalImage = z.string().optional();
const slug = z.string().trim().max(140).optional();

// Mirrors shared/enums.js.
export const FEATURE_GROUPS = ['why_choose', 'construction', 'pre_engineered', 'kitchen'];
export const LIST_GROUPS = ['renovation_reasons', 'kitchen_steps', 'seepage_checkpoints'];

export const heroSlideSchema = z.object({
  title,
  subtitle: optionalText,
  ctaLabel: z.string().trim().max(60).optional(),
  ctaUrl: z.string().trim().max(500).optional(),
  imageId: optionalImage,
  sortOrder,
  isActive,
});

export const serviceCategorySchema = z.object({
  name: title,
  slug,
  icon: z.string().trim().max(60).optional(),
  imageId: optionalImage,
  sortOrder,
  isActive,
});

/** The templated card copy the old site shipped on every service ("Professional … with expert tools and results."). */
const BOILERPLATE = /^professional .+ with expert tools and results\.?$/i;

export const serviceSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: title,
  slug,
  excerpt: z
    .string()
    .trim()
    .min(40, 'Write at least 40 characters — this is the card text customers read')
    .max(200, 'Keep it to 200 characters — the service card shows about two lines')
    .refine((v) => !BOILERPLATE.test(v), 'Replace the placeholder copy with a real description of this service'),
  body: optionalText,
  icon: z.string().trim().max(60).optional(),
  imageId: optionalImage,
  type: z.enum(['standard', 'other_civil']).default('standard'),
  priceFrom: optionalRupees,
  priceTo: optionalRupees,
  priceUnit: unit.optional(),
  warrantyDays: z.coerce.number().int().min(0).max(3650).optional(),
  isFeatured: z.coerce.boolean().default(false),
  sortOrder,
  isActive,
  ...seoFields,
}).refine(
  (v) => v.priceFrom == null || v.priceTo == null || v.priceTo >= v.priceFrom,
  { message: 'Maximum price must be greater than or equal to the minimum', path: ['priceTo'] },
);

export const projectSchema = z.object({
  title,
  slug,
  clientName: z.string().trim().max(160).optional(),
  location: z.string().trim().max(200).optional(),
  categoryId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  status: z.enum(['ongoing', 'completed']).default('completed'),
  summary: optionalText,
  body: optionalText,
  problem: optionalText,
  solution: optionalText,
  outcome: optionalText,
  durationDays: z.coerce.number().int().min(0).max(3650).optional(),
  costBandMin: optionalRupees,
  costBandMax: optionalRupees,
  coverId: optionalImage,
  completedAt: z.coerce.date().optional(),
  publishedAt: z.coerce.date().optional(),
  isFeatured: z.coerce.boolean().default(false),
  sortOrder,
  isActive,
  ...seoFields,
});

export const offerSchema = z.object({
  title,
  description: optionalText,
  bullets,
  badge: z.string().trim().max(60).optional(),
  priceMin: optionalRupees,
  priceMax: optionalRupees,
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaUrl: z.string().trim().max(500).optional(),
  imageId: optionalImage,
  sortOrder,
  isActive,
}).refine((v) => !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt, {
  message: 'End date must be after the start date', path: ['endsAt'],
});

export const pricingPlanSchema = z.object({
  title,
  badge: z.string().trim().max(60).optional(),
  description: optionalText,
  priceMin: optionalRupees,
  priceMax: optionalRupees,
  unit: z.string().trim().max(20).optional(),
  inclusions: bullets,
  sortOrder,
  isActive,
});

export const featureSchema = z.object({
  group: z.string().trim().min(2).max(60).refine((v) => FEATURE_GROUPS.includes(v) || v.length > 2),
  icon: z.string().trim().max(60).optional(),
  imageId: optionalImage,
  title,
  description: optionalText,
  sortOrder,
  isActive,
});

export const listItemSchema = z.object({
  group: z.string().trim().min(2).max(60).refine((v) => LIST_GROUPS.includes(v) || v.length > 2),
  position: z.coerce.number().int().min(1).max(999),
  text: z.string().trim().min(2).max(1000),
  isActive,
});

export const contentBlockSchema = z.object({
  key: z.string().trim().min(2).max(80),
  heading: z.string().trim().max(250).optional(),
  subheading: z.string().trim().max(400).optional(),
  body: optionalText,
  bullets,
  imageId: optionalImage,
  cta: z.object({ label: z.string().max(60), url: z.string().max(500) }).optional(),
  sortOrder,
  isActive,
});

export const processStepSchema = z.object({
  stepNo: z.coerce.number({ invalid_type_error: 'Enter the step number' }).int().min(1).max(50),
  title,
  description: optionalText,
  icon: z.string().trim().max(60).optional(),
  sortOrder,
  isActive,
});

export const testimonialSchema = z.object({
  quote: z.string().trim().min(10).max(2000),
  author: z.string().trim().min(2).max(120),
  location: z.string().trim().max(160).optional(),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  photoId: optionalImage,
  locale: locale.default('en'),
  jobId: z.string().optional(),
  isApproved: z.coerce.boolean().default(false),
  sortOrder,
  isActive,
});

export const galleryImageSchema = z.object({
  mediaId: z.string().min(1),
  caption: z.string().trim().max(300).optional(),
  projectId: z.string().optional().nullable(),
  sortOrder,
  isActive,
});

export const faqSchema = z.object({
  question: z.string().trim().min(5, 'Write at least 5 characters').max(500),
  answer: z.string().trim().min(5, 'Write at least 5 characters').max(5000),
  group: z.string().trim().max(60).optional(),
  sortOrder,
  isActive,
});

export const pageSchema = z.object({
  slug,
  title,
  body: optionalText,
  ...seoFields,
  sortOrder,
  isActive,
});

export const postCategorySchema = z.object({
  name: title,
  slug,
  sortOrder,
  isActive,
});

export const postSchema = z.object({
  categoryId: z.string().optional().nullable(),
  title,
  slug,
  excerpt: z.string().trim().max(600).optional(),
  body: z.string().trim().min(20),
  coverId: optionalImage,
  publishedAt: z.coerce.date().optional(),
  ...seoFields,
  sortOrder,
  isActive,
});

/** Mirrors `mediaUpdateSchema`: alt text can change but never be emptied. */
export const mediaUpdateSchema = z.object({
  alt: z.string().trim().min(1, 'Describe the picture — alt text cannot be empty').max(300),
  caption: z.string().trim().max(500).optional(),
  folderId: z.string().nullable().optional(),
});

/** Mirrors `mediaFolderSchema`. */
export const mediaFolderSchema = z.object({
  name: z.string().trim().min(1, 'Folder name is required').max(80),
  parentId: z.string().min(1).nullable().optional(),
});
