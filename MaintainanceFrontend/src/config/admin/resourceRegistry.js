import { faqs } from './resources/faqs';
import { processSteps } from './resources/processSteps';
import { heroSlides } from './resources/heroSlides';
import { serviceCategories } from './resources/serviceCategories';
import { services } from './resources/services';
import { rateCard } from './resources/rateCard';
import { trades } from './resources/trades';
import { quotationTerms } from './resources/quotationTerms';
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
import { technicians } from './resources/technicians';
import { jobTemplates } from './resources/jobTemplates';
import { materials } from './resources/materials';
import { materialCategories } from './resources/materialCategories';
import { suppliers } from './resources/suppliers';
import { inspectionTemplates } from './resources/inspectionTemplates';
import { expenses } from './resources/expenses';
import { purchaseLists } from './resources/purchaseLists';

/**
 * Every registry resource — the CMS, the rate library and its trades (Phase L2), the terms library (Phase L4), the inspection
 * templates (Phase L5) and, since Phase H1, the operations lists (technicians, job templates, materials, material categories,
 * suppliers) — the back office manages
 * through the generic pages
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
 * @property {object[]} columns       CustomTable columns; the page appends the Active switch. A column's own
 *                                    `capability` shows it only to a user holding it (the rate library's Cost)
 * @property {object[]} [filters]     CustomTable filters
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
 * @property {BulkAction[]} [bulkActions] extra actions on the selected rows (the rate library's "Update to derived rate")
 * @property {object} [defaultValues] a new record, in API shape
 * @property {boolean} [sortable]     offers Reorder (`PATCH /reorder`); false when the site orders by another column
 * @property {string[]} [translatable] field names with a Nepali tab
 * @property {(record: object) => string|null} [publicHref] where the record shows on the site, or null
 * @property {(record: object) => string} titleOf  names a record in headings, toasts and for screen readers
 * @property {string} [searchPlaceholder]
 * @property {string} [emptyTitle]
 * @property {string} [emptyDescription]
 *
 * @property {string} [activeField] the boolean the list's switch and Hide/Show act on (default `isActive`); the
 *                                    API's `PATCH /:id/toggle` flips the same column (technicians: `isAvailable`)
 * @property {boolean} [toggle]      false: no on/off switch and no Hide/Show — the model has no such column and the
 *                                    API mounts no toggle (expenses, Phase I)
 * @property {(meta: object, ctx: { inTrash: boolean }) => import('react').ReactNode} [footer]  under the list: the
 *                                    server's figures for it (the expenses' `meta.totals.total`)
 * @property {() => [(record: object) => RecordAction[], import('react').ReactNode]} [useRecordActions]  a hook: the
 *                                    moves a record's state allows (a purchase list's Mark ordered · Receive · Cancel,
 *                                    Phase L7) and the dialogs they open. The list offers them in a row's menu, the edit
 *                                    page as buttons in its header (a disabled one says why)
 * @property {(record: object) => string|null} [readOnlyReason]  why a saved record's form is read only in its state
 *                                    (a purchase list past DRAFT) — the page says so; null when it can be edited
 * @property {(record: object) => boolean} [deletable]  whether Delete is offered for a record (only a draft purchase
 *                                    list); default every record
 *
 * Field specs may also say `lockedOnEdit: true`: editable on a new record, read-only once saved
 * (a content block's key, which the site looks blocks up by), and `capability`: shown only to a user
 * holding it (a technician's labour rate, which the API hides from everyone else).
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
 * @typedef {object} RecordAction
 * @property {string} key
 * @property {string} label
 * @property {import('react').ElementType} [icon]
 * @property {boolean} [primary]     the move the record waits for — a solid button on its page
 * @property {boolean} [destructive]
 * @property {string} [disabledReason]  shown instead of running
 * @property {() => void} onSelect
 *
 * @typedef {object} BulkAction
 * @property {string} label
 * @property {import('react').ElementType} [icon]
 * @property {string} [capability]   hidden without it
 * @property {(rows: object[], helpers: { dispatch: Function, confirm: (options: object) => Promise<boolean> }) =>
 *   Promise<{ title: string, description?: string, variant?: string } | null>} run
 *   does the work — it may ask first with `confirm` — and resolves the toast to show, or null when the
 *   person said no; a rejection is shown as the API's error
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
    features, listItems, contentBlocks, processSteps, posts, postCategories, pages, rateCard, trades, quotationTerms,
    technicians, jobTemplates, materials, materialCategories, suppliers, inspectionTemplates, expenses, purchaseLists,
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

/** The column the list's on/off switch reads. */
export const activeFieldOf = (entry) => entry.activeField ?? 'isActive';
