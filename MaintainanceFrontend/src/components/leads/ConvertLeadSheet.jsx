import { useCallback, useState } from 'react';
import { useConvertLeadMutation } from '@/api/leadsApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { CustomerMatchChoice } from '@/components/leads/CustomerMatchChoice';
import { convertSiteSchema, siteContactBody } from '@/form/schemas/lead.schema';
import { convertSiteFields } from '@/config/admin/crmForms';

/**
 * "Convert without visit": the lead becomes a customer with a site, and optionally a
 * draft quotation — for work priced on the phone, or a repeat customer. The site may carry who
 * opens the door (the caretaker while the owner is abroad) and a landmark — sent only when filled,
 * as the convert's top-level `siteContactName` / `siteContactPhone` / `landmark` (Phase L5).
 *
 * (Phase L1's "new-quotation" use of this sheet became `components/quotations/NewQuotationSheet` in Phase L3.)
 *
 * @param {{ lead: object, open: boolean, onOpenChange: (open: boolean) => void, onConverted: (result: object) => void }} props
 */
export function ConvertLeadSheet({ lead, open, onOpenChange, onConverted }) {
  const [convert] = useConvertLeadMutation();
  const [choice, setChoice] = useState({ ready: false, body: {}, loading: true });
  const onChoice = useCallback((state) => setChoice(state), []);

  const submit = async ({ label, address, area, createQuotation, ...contact }) => {
    if (!choice.ready) {
      throw Object.assign(new Error('choice'), {
        data: { error: { message: 'Say whether this is the same person as the existing customer first.' } },
      });
    }
    const result = await convert({
      id: lead.id,
      ...choice.body,
      site: { label, address, ...(area ? { area } : {}) },
      createQuotation,
      ...siteContactBody(contact),
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
      title="Convert without a visit"
      description="Makes the customer and their site. Book a visit later from the lead or the customer."
      intro={open ? <CustomerMatchChoice lead={lead} onChange={onChoice} /> : null}
      schema={convertSiteSchema}
      fields={convertSiteFields}
      defaultValues={{
        label: lead.customerId ? 'Other site' : 'Primary site',
        address: lead.address ?? '',
        area: lead.area ?? '',
        createQuotation: Boolean(lead.serviceId),
        siteContactName: '',
        siteContactPhone: '',
        landmark: '',
      }}
      submitLabel="Convert"
      onSubmit={submit}
      guard={false}
    />
  );
}
