import { RESOURCES, screenPathOf } from '@/config/admin/resourceRegistry';

/**
 * Where an audit row's record can be opened in the back office, or null when it has no
 * screen (yet — jobs and invoices get theirs in Phases H and I).
 *
 * A child row (a lead's note, a project's picture, a record's Nepali copy) links to its
 * parent, found in the row's own snapshot.
 */

const byModel = {
  Lead: (id) => `/admin/leads/${id}`,
  Customer: (id) => `/admin/customers/${id}`,
  Quotation: (id) => `/admin/quotations/${id}`,
  SiteSurvey: (id) => `/admin/surveys/${id}`,
  User: (id) => `/admin/platform/users?open=${id}`,
  Setting: () => '/admin/platform/settings',
  HomeSection: () => '/admin/content/home',
  Media: () => '/admin/content/media',
  MediaFolder: () => '/admin/content/media',
};

/** A child model → the field naming its parent, and the parent's model. */
const PARENTS = {
  LeadNote: ['leadId', 'Lead'],
  CustomerSite: ['customerId', 'Customer'],
  QuotationItem: ['quotationId', 'Quotation'],
  ProjectImage: ['projectId', 'Project'],
};

/** `faq` → the registry screen; the Prisma client name is what Translation rows carry. */
let cmsScreens;
function cmsScreen(clientName) {
  cmsScreens ??= new Map(Object.values(RESOURCES).map((entry) => [entry.model, screenPathOf(entry)]));
  return cmsScreens.get(clientName) ?? null;
}

const clientNameOf = (model) => model.charAt(0).toLowerCase() + model.slice(1);

/**
 * @param {{ model: string, recordId?: string|null, before?: object|null, after?: object|null }} row
 * @returns {string|null}
 */
export function recordHref({ model, recordId, before, after }) {
  const snapshot = { ...before, ...after };
  if (PARENTS[model]) {
    const [field, parent] = PARENTS[model];
    const parentId = snapshot[field];
    return parentId ? recordHref({ model: parent, recordId: parentId }) : null;
  }
  if (model === 'Translation') {
    const screen = snapshot.model && cmsScreen(snapshot.model);
    return screen && snapshot.recordId ? `${screen}/${snapshot.recordId}` : null;
  }
  if (model === 'MessageTemplate') {
    return snapshot.key ? `/admin/platform/message-templates/${encodeURIComponent(snapshot.key)}` : '/admin/platform/message-templates';
  }
  if (byModel[model]) return recordId || !byModel[model].length ? byModel[model](recordId) : null;
  const screen = cmsScreen(clientNameOf(model));
  return screen && recordId ? `${screen}/${recordId}` : null;
}
