import { faqs } from './resources/faqs';
import { processSteps } from './resources/processSteps';
import { heroSlides } from './resources/heroSlides';
import { serviceCategories } from './resources/serviceCategories';
import { services } from './resources/services';
import { rateCard } from './resources/rateCard';
import { projects } from './resources/projects';
import { offers } from './resources/offers';
import { pricingPlans } from './resources/pricingPlans';
import { testimonials } from './resources/testimonials';
import { galleryImages } from './resources/galleryImages';
import { features } from './resources/features';
import { listItems } from './resources/listItems';
import { contentBlocks } from './resources/contentBlocks';
import { posts } from './resources/posts';
import { postCategories } from './resources/postCategories';
import { pages } from './resources/pages';

/**
 * Every CMS resource the back office manages through the generic pages
 * (`pages/admin/ResourceListPage`, `ResourceEditPage`). One file per resource under
 * `resources/`; register it here and give it a nav item in `adminNav.js`.
 *
 * Only those lazy pages import this file, so the entries — their columns, fields and
 * schemas — never reach the marketing bundle.
 *
 * @typedef {object} ResourceEntry
 * @property {string} resource        URL segment in `/admin/content/:resource`, the API segment and the Cms tag id
 * @property {string} path            API collection path, always `/admin/<resource>`
 * @property {string} [basePath]      the screen's own address when it is not content (`/admin/rate-card`); it
 *                                    then needs a fixed route in `AppRoutes` and is unknown under `/admin/content`
 * @property {string} [notice]        a standing note above the list, e.g. what else reads this data
 * @property {Partial<ActiveCopy>} [activeCopy] words for `isActive` when it does not mean "on the website"
 * @property {string} model           Prisma model name for `/admin/translations` (`faq`, `processStep`)
 * @property {string} label           one record, e.g. 'FAQ'
 * @property {string} labelPlural     the list, e.g. 'FAQs'
 * @property {string} [description]   under the list page's title
 * @property {string} capability      needed to see the screens at all
 * @property {string} [writeCapability] needed to create, edit, reorder, toggle and delete (default `cms:write`)
 * @property {string} [historyCapability] needed for the edit page's History tab (`GET <path>/:id/history`);
 *                                    default `capability` — the API guards a CMS record's trail with `cms:read`
 * @property {object[]} columns       DataTable columns; the page appends the Active switch
 * @property {object[]} [filters]     DataTable filters
 * @property {object[]} fields        ResourceForm fields
 * @property {import('zod').ZodTypeAny | ((ctx: SchemaContext) => import('zod').ZodTypeAny)} schema
 *                                    from `form/schemas/cms.schema.js`; a function when a rule needs what the
 *                                    site currently has (a CMS link may point at a live page). Read it through `schemaOf`
 * @property {string} [defaultSort]   the list's first order (`-publishedAt`), when it is not the manual one
 * @property {string} [reorderWithin] Reorder is offered only while this filter is set — the order column is
 *                                    per group (list items)
 * @property {string} [reorderHint]   says so beside the disabled Reorder button
 * @property {(record: object) => import('react').ReactNode} [intro] read-only facts above an existing record's form
 * @property {{ value: string, label: string, component: import('react').ComponentType<{ record: object, canWrite: boolean }> }[]} [tabs]
 *                                    panels beside the form on an existing record (a project's Gallery)
 * @property {(record: object) => RowAction[]} [rowActions] extra list actions that call a `cmsApi` mutation
 * @property {object} [defaultValues] a new record, in API shape
 * @property {boolean} [sortable]     offers Reorder (`PATCH /reorder`); false when the site orders by another column
 * @property {string[]} [translatable] field names with a Nepali tab
 * @property {(record: object) => string|null} [publicHref] where the record shows on the site, or null
 * @property {(record: object) => string} titleOf  names a record in headings, toasts and for screen readers
 * @property {string} [searchPlaceholder]
 * @property {string} [emptyTitle]
 * @property {string} [emptyDescription]
 *
 * Field specs may also say `lockedOnEdit: true`: editable on a new record, read-only once saved
 * (a content block's key, which the site looks blocks up by).
 *
 * @typedef {{ pageSlugs: string[] }} SchemaContext
 *
 * @typedef {object} RowAction
 * @property {string} label
 * @property {import('react').ElementType} [icon]
 * @property {string} [capability]   hidden without it (the list's write capability is not implied)
 * @property {string} endpoint       a `cmsApi` mutation, e.g. 'approveTestimonial'
 * @property {object} arg            its argument
 * @property {string} done           the success toast
 *
 * @typedef {object} ActiveCopy
 * @property {string} column       the switch column's header
 * @property {string} switchLabel  the switch's accessible name, before the record's title
 * @property {string} turnOn       row action
 * @property {string} turnOff      row action
 * @property {string} turnedOn     toast, after the label
 * @property {string} turnedOff    toast, after the label
 * @property {string} deleteOne    first sentence of the delete confirmation, one record
 * @property {string} deleteMany   the same, several records
 */

/** @type {ActiveCopy} */
const WEBSITE_COPY = {
  column: 'On site',
  switchLabel: 'Show on the website:',
  turnOn: 'Show on website',
  turnOff: 'Hide from website',
  turnedOn: 'is on the website',
  turnedOff: 'is hidden from the website',
  deleteOne: 'It leaves the website at once.',
  deleteMany: 'They leave the website at once.',
};

/** @type {Record<string, ResourceEntry>} */
export const RESOURCES = Object.fromEntries(
  [
    serviceCategories, services, heroSlides, projects, offers, pricingPlans, testimonials, faqs, galleryImages,
    features, listItems, contentBlocks, processSteps, posts, postCategories, pages, rateCard,
  ].map((entry) => [entry.resource, entry]),
);

/** Who may read a record's History tab. */
export const historyCapabilityOf = (entry) => entry.historyCapability ?? entry.capability;

/**
 * @param {string|undefined} resource
 * @returns {ResourceEntry|undefined}
 */
export function getResourceEntry(resource) {
  return resource && Object.hasOwn(RESOURCES, resource) ? RESOURCES[resource] : undefined;
}

/**
 * The entry's form schema.
 *
 * @param {ResourceEntry} entry
 * @param {Partial<SchemaContext>} [ctx]
 */
export const schemaOf = (entry, ctx = {}) => (typeof entry.schema === 'function'
  ? entry.schema({ pageSlugs: [], ...ctx })
  : entry.schema);

/** Where an entry's screens live: its list, `…/new` and `…/:id`. */
export const screenPathOf = (entry) => entry.basePath ?? `/admin/content/${entry.resource}`;

/** @returns {ActiveCopy} */
export const activeCopyOf = (entry) => ({ ...WEBSITE_COPY, ...entry.activeCopy });
