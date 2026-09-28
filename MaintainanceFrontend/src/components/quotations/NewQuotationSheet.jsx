import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConvertLeadMutation } from '@/api/leadsApi';
import { useCopyQuotationMutation, useCreateQuotationMutation } from '@/api/quotationsApi';
import { useGetCustomerSitesQuery } from '@/api/customersApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { CustomerMatchChoice } from '@/components/leads/CustomerMatchChoice';
import { newQuotationSchema } from '@/form/schemas/quotation.schema';
import { formatSignedNpr } from '@/helpers/format';
import { QUOTATION_STATUS_LABELS } from '@/config/constants';

const SOURCES = {
  blank: { label: 'A blank BOQ', submit: 'Create draft quotation' },
  survey: { label: 'A submitted site survey', submit: 'Open the survey to build it' },
  copy: { label: 'A copy of another quotation', submit: 'Copy into a new draft' },
};

const customerLabel = (r) => `${r.name}${r.phone ? ` · ${r.phone}` : ''}`;
const surveyLabel = (r) => `${r.number} · ${r.customer?.name ?? 'Customer'} · ${r.service?.name ?? 'General'}`;
const quotationLabel = (r) => `${r.number}${r.version > 1 ? ` v${r.version}` : ''} · ${r.customer?.name ?? ''} · ${formatSignedNpr(r.total)} · ${QUOTATION_STATUS_LABELS[r.status] ?? r.status}`;

/**
 * **New quotation** (Phase L3) — the one way a quotation starts, from the quotations list, a lead or a customer:
 *
 * - **Blank** — an empty BOQ for the customer (and site), opened in the builder. For a lead that is not a customer
 *   yet this is L1's convert: "same person / different person", the site, and a draft (`createQuotation`).
 * - **From a survey** — a submitted or in-review survey of that customer; the survey's review page builds it (its
 *   priced lines become rows, optional ones optional).
 * - **Copy** — another quotation's rows (their recipes as frozen), terms, discount and VAT, as a new DRAFT for this
 *   customer (`POST /admin/quotations/:id/copy`).
 *
 * `onCreated(result)` is told what was made (a convert's result, or `{ quotation }`) before the sheet closes —
 * without it, the sheet opens the new draft. Choosing a survey opens that survey instead.
 *
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void, lead?: object, customerId?: string,
 *   siteId?: string, onCreated?: (result: object) => void }} props
 */
export function NewQuotationSheet({ open, onOpenChange, lead, customerId: fixedCustomer, siteId: fixedSite, onCreated }) {
  const navigate = useNavigate();
  const [convert] = useConvertLeadMutation();
  const [createQuotation] = useCreateQuotationMutation();
  const [copyQuotation] = useCopyQuotationMutation();
  const [choice, setChoice] = useState({ ready: false, body: {}, loading: true });
  const onChoice = useCallback((state) => setChoice(state), []);

  const leadCustomer = lead?.customerId ?? lead?.customer?.id ?? null;
  const needsConvert = Boolean(lead) && !leadCustomer;
  const presetCustomer = fixedCustomer ?? leadCustomer;
  const needsCustomer = !presetCustomer && !lead;
  const [values, setValues] = useState({ source: 'blank' });
  // react-hook-form hands the same values object to every watcher: copy it, so a new pick re-renders.
  const onValuesChange = useCallback((v) => setValues({ ...v }), []);
  const source = values.source ?? 'blank';
  const customerId = presetCustomer ?? values.customerId ?? null;
  const { data: sites } = useGetCustomerSitesQuery(customerId, { skip: !open || !customerId || needsConvert });

  const schema = useMemo(() => newQuotationSchema({ needsConvert, needsCustomer }), [needsConvert, needsCustomer]);
  // Every field the sheet can show, blank — and '' rather than null, which a form drops for a field it is not
  // showing: the starting values must not change as the pick shows more fields (see ResourceForm).
  const defaultValues = useMemo(() => ({
    source: 'blank',
    customerId: '',
    siteId: fixedSite ?? '',
    surveyId: '',
    fromQuotationId: '',
    label: needsConvert ? 'Primary site' : '',
    address: needsConvert ? lead?.address ?? '' : '',
    area: needsConvert ? lead?.area ?? '' : '',
  }), [fixedSite, needsConvert, lead]);

  const fields = useMemo(() => {
    const list = [{
      name: 'source', type: 'select', label: 'Start from', required: true,
      options: Object.entries(SOURCES)
        .filter(([key]) => !(key === 'survey' && needsConvert))
        .map(([value, s]) => ({ value, label: s.label })),
    }];
    if (needsCustomer) {
      list.push({
        name: 'customerId', type: 'relation', label: 'Customer', required: source === 'blank',
        description: source === 'copy' ? 'Leave it empty to copy for the same customer.' : undefined,
        relation: { path: '/admin/customers', labelKey: customerLabel },
      });
    }
    if (source === 'survey') {
      list.push({
        name: 'surveyId', type: 'relation', label: 'Survey', required: true,
        description: 'Submitted or in review, not quoted yet. Its review page prices the lines and builds the quotation.',
        relation: { path: '/admin/surveys', labelKey: surveyLabel, params: { status: 'SUBMITTED,IN_REVIEW', ...(customerId ? { customerId } : {}) } },
      });
    }
    if (source === 'copy') {
      list.push({
        name: 'fromQuotationId', type: 'relation', label: 'Quotation to copy', required: true,
        description: 'Its rows (recipes as they were frozen), terms, discount and VAT — a new draft, version 1.',
        relation: { path: '/admin/quotations', labelKey: quotationLabel },
      });
    }
    if (needsConvert && source !== 'survey') {
      list.push(
        { name: 'label', type: 'text', label: 'Site name', required: true, span: 'half' },
        { name: 'area', type: 'text', label: 'Area', span: 'half' },
        { name: 'address', type: 'text', label: 'Address', required: true },
      );
    } else if (customerId && source !== 'survey' && (sites?.length ?? 0) > 0) {
      list.push({
        name: 'siteId', type: 'select', label: 'Site', noneLabel: 'No site',
        options: sites.map((s) => ({ value: s.id, label: `${s.label} · ${s.address}${s.isPrimary ? ' (primary)' : ''}` })),
      });
    }
    return list;
  }, [needsConvert, needsCustomer, source, customerId, sites]);

  const convertFirst = async ({ label, address, area }, createDraft) => {
    if (!choice.ready) {
      throw Object.assign(new Error('choice'), {
        data: { error: { message: 'Say whether this is the same person as the existing customer first.' } },
      });
    }
    return convert({
      id: lead.id, ...choice.body, site: { label, address, ...(area ? { area } : {}) }, createQuotation: createDraft,
    }).unwrap();
  };

  const done = (result) => {
    // Done before closed: a caller waiting on the sheet (the board's drop) tells completion from Cancel.
    if (onCreated) onCreated(result);
    onOpenChange(false);
    if (!onCreated && result?.quotation?.id) navigate(`/admin/quotations/${result.quotation.id}`);
  };

  const submit = async (body) => {
    if (body.source === 'survey') {
      onOpenChange(false);
      navigate(`/admin/surveys/${body.surveyId}`);
      return;
    }
    const site = body.siteId || fixedSite || undefined;
    if (body.source === 'blank') {
      if (needsConvert) {
        done(await convertFirst(body, true));
        return;
      }
      const quotation = await createQuotation({
        customerId: body.customerId || presetCustomer, ...(site ? { siteId: site } : {}), ...(lead ? { leadId: lead.id } : {}), items: [],
      }).unwrap();
      done({ quotation });
      return;
    }
    // A copy: for a lead not yet a customer, the convert makes the customer and site first.
    const converted = needsConvert ? await convertFirst(body, false) : null;
    const target = converted?.customer?.id || body.customerId || presetCustomer;
    const quotation = await copyQuotation({
      id: body.fromQuotationId,
      ...(target ? { customerId: target } : {}),
      ...(converted?.site?.id ? { siteId: converted.site.id } : site ? { siteId: site } : {}),
      ...(lead ? { leadId: lead.id } : {}),
    }).unwrap();
    done(converted ? { ...converted, quotation } : { quotation });
  };

  return (
    <ResourceForm
      mode="sheet"
      open={open}
      onOpenChange={onOpenChange}
      title="New quotation"
      description={needsConvert
        ? 'Starts a draft for this lead’s customer and site. The lead moves to Quoted when the quotation is sent.'
        : 'A blank BOQ, one built from a site survey, or a copy of another quotation.'}
      intro={open && needsConvert && source !== 'survey' ? <CustomerMatchChoice lead={lead} onChange={onChoice} /> : null}
      schema={schema}
      fields={fields}
      defaultValues={defaultValues}
      onValuesChange={onValuesChange}
      submitLabel={SOURCES[source]?.submit ?? 'Create'}
      onSubmit={submit}
      guard={false}
    />
  );
}
