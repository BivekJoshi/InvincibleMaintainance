import { z } from 'zod';
import {
  bullets, isActive, optionalRupees, optionalText, seoFields, sortOrder, unit, locale,
} from './common.js';
import { FEATURE_GROUPS, HOME_SECTION_KEYS, LIST_GROUPS } from '../enums.js';

const title = z.string().trim().min(2).max(250);
const optionalImage = z.string().optional();

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
  slug: z.string().trim().max(140).optional(),
  icon: z.string().trim().max(60).optional(),
  imageId: optionalImage,
  sortOrder,
  isActive,
});

const BOILERPLATE = /^professional .+ with expert tools and results\.?$/i;

export const serviceSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: title,
  slug: z.string().trim().max(140).optional(),
  excerpt: z
    .string()
    .trim()
    .min(20, 'Write at least 20 characters — this is the card text customers read')
    .max(400)
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
  slug: z.string().trim().max(140).optional(),
  clientName: z.string().trim().max(160).optional(),
  location: z.string().trim().max(200).optional(),
  categoryId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  status: z.enum(['ongoing', 'completed']).default('completed'),
  summary: optionalText,
  body: optionalText,
  // Case-study shape: the problem the customer had, what we did, how it ended.
  problem: optionalText,
  solution: optionalText,
  outcome: optionalText,
  durationDays: z.coerce.number().int().min(0).max(3650).optional(),
  // A BAND in rupees, never the customer's exact contract value.
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

/** POST /admin/jobs/:id/publish-case-study — everything is optional but the title. */
export const caseStudySchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  slug: z.string().trim().max(140).optional(),
  problem: optionalText,
  solution: optionalText,
  outcome: optionalText,
  costBandMin: optionalRupees,
  costBandMax: optionalRupees,
  /** Off by default: a case study names our work, not our customer. */
  includeClientName: z.coerce.boolean().default(false),
  imageIds: z.array(z.string()).max(24).optional(),
  isActive: z.coerce.boolean().default(false),
});

export const projectImageSchema = z.object({
  mediaId: z.string().min(1),
  caption: z.string().trim().max(300).optional(),
  sortOrder,
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
  stepNo: z.coerce.number().int().min(1).max(50),
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
  question: z.string().trim().min(5).max(500),
  answer: z.string().trim().min(5).max(5000),
  group: z.string().trim().max(60).optional(),
  sortOrder,
  isActive,
});

export const pageSchema = z.object({
  slug: z.string().trim().max(140).optional(),
  title,
  body: optionalText,
  ...seoFields,
  sortOrder,
  isActive,
});

export const postCategorySchema = z.object({
  name: title,
  slug: z.string().trim().max(140).optional(),
  sortOrder,
  isActive,
});

export const postSchema = z.object({
  categoryId: z.string().optional().nullable(),
  title,
  slug: z.string().trim().max(140).optional(),
  excerpt: z.string().trim().max(600).optional(),
  body: z.string().trim().min(20),
  coverId: optionalImage,
  publishedAt: z.coerce.date().optional(),
  ...seoFields,
  sortOrder,
  isActive,
});

export const homeSectionUpdateSchema = z.object({
  items: z.array(z.object({
    key: z.enum(HOME_SECTION_KEYS),
    sortOrder: z.coerce.number().int().min(0),
    isVisible: z.coerce.boolean(),
    settings: z.record(z.any()).optional(),
  })).min(1),
});

export const settingsUpdateSchema = z.object({
  values: z.record(z.string(), z.any()),
});

export const mediaUpdateSchema = z.object({
  alt: z.string().trim().max(300).optional(),
  caption: z.string().trim().max(500).optional(),
  folderId: z.string().nullable().optional(),
});

export const translationUpsertSchema = z.object({
  model: z.string().min(1).max(60),
  recordId: z.string().min(1),
  values: z.record(z.string(), z.record(locale, z.string().max(20000))),
});
