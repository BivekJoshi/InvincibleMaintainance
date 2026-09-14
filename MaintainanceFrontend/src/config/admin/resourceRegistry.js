import { faqs } from './resources/faqs';
import { processSteps } from './resources/processSteps';

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
 * @property {string} model           Prisma model name for `/admin/translations` (`faq`, `processStep`)
 * @property {string} label           one record, e.g. 'FAQ'
 * @property {string} labelPlural     the list, e.g. 'FAQs'
 * @property {string} [description]   under the list page's title
 * @property {string} capability      needed to see the screens at all
 * @property {string} [writeCapability] needed to create, edit, reorder, toggle and delete (default `cms:write`)
 * @property {object[]} columns       DataTable columns; the page appends the Active switch
 * @property {object[]} [filters]     DataTable filters
 * @property {object[]} fields        ResourceForm fields
 * @property {import('zod').ZodTypeAny} schema  from `form/schemas/cms.schema.js`
 * @property {object} [defaultValues] a new record, in API shape
 * @property {boolean} [sortable]     offers Reorder (`PATCH /reorder`); false when the site orders by another column
 * @property {string[]} [translatable] field names with a Nepali tab
 * @property {(record: object) => string|null} [publicHref] where the record shows on the site, or null
 * @property {(record: object) => string} titleOf  names a record in headings, toasts and for screen readers
 * @property {string} [searchPlaceholder]
 * @property {string} [emptyTitle]
 * @property {string} [emptyDescription]
 */

/** @type {Record<string, ResourceEntry>} */
export const RESOURCES = Object.fromEntries([faqs, processSteps].map((entry) => [entry.resource, entry]));

/**
 * @param {string|undefined} resource
 * @returns {ResourceEntry|undefined}
 */
export function getResourceEntry(resource) {
  return resource && Object.hasOwn(RESOURCES, resource) ? RESOURCES[resource] : undefined;
}
