import { useCallback, useMemo, useState } from 'react';
import { useConvertLeadMutation } from '@/api/leadsApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { CustomerMatchChoice } from '@/components/leads/CustomerMatchChoice';
import { convertSiteSchema } from '@/form/schemas/lead.schema';
import { convertSiteFields } from '@/config/admin/crmForms';

/** What each purpose says. The quotation one always drafts a quotation, so it has no switch for it. */
const COPY = {
  convert: {
    title: 'Convert without a visit',
    description: 'Makes the customer and their site. Book a visit later from the lead or the customer.',
    submitLabel: 'Convert',
  },
  quotation: {
    title: 'New quotation',
    description: 'Starts a draft quotation for this lead’s customer and site. The lead moves to Quoted when the quotation is sent.',
    submitLabel: 'Create draft quotation',
  },
};

/**
 * "Convert without visit": the lead becomes a customer with a site, and optionally a
 * draft quotation — for work priced on the phone, or a repeat customer.
 *
 * `purpose="quotation"` is the new-quotation sheet (Phase L1): the same convert, always with the draft
 * quotation — the outcome "Interested — quote without a visit" and a board drop on Quoted open it.
 *
 * @param {{ lead: object, open: boolean, onOpenChange: (open: boolean) => void, onConverted: (result: object) => void,
 *   purpose?: 'convert'|'quotation' }} props
 */
export function ConvertLeadSheet({ lead, open, onOpenChange, onConverted, purpose = 'convert' }) {
  const [convert] = useConvertLeadMutation();
  const [choice, setChoice] = useState({ ready: false, body: {}, loading: true });
  const onChoice = useCallback((state) => setChoice(state), []);
  const forQuotation = purpose === 'quotation';
  const copy = COPY[forQuotation ? 'quotation' : 'convert'];
  const fields = useMemo(
    () => (forQuotation ? convertSiteFields.filter((f) => f.name !== 'createQuotation') : convertSiteFields),
    [forQuotation],
  );

  const submit = async ({ label, address, area, createQuotation }) => {
    if (!choice.ready) {
      throw Object.assign(new Error('choice'), {
        data: { error: { message: 'Say whether this is the same person as the existing customer first.' } },
      });
    }
    const result = await convert({
      id: lead.id,
      ...choice.body,
      site: { label, address, ...(area ? { area } : {}) },
      createQuotation: forQuotation || createQuotation,
    }).unwrap();
    // Done before closed: a caller waiting on the sheet (the board's drop) tells completion from Cancel.
    onConverted(result);
    onOpenChange(false);
  };

  return (
    <ResourceForm
      mode="sheet"
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
      intro={open ? <CustomerMatchChoice lead={lead} onChange={onChoice} /> : null}
      schema={convertSiteSchema}
      fields={fields}
      defaultValues={{
        label: lead.customerId ? 'Other site' : 'Primary site',
        address: lead.address ?? '',
        area: lead.area ?? '',
        createQuotation: forQuotation || Boolean(lead.serviceId),
      }}
      submitLabel={copy.submitLabel}
      onSubmit={submit}
      guard={false}
    />
  );
}
