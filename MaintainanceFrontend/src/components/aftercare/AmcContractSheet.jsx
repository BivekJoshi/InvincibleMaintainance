import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useCreateAmcContractMutation } from '@/api/aftercareApi';
import { useGetCustomerSitesQuery } from '@/api/customersApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { AmcSchedulePreview } from '@/components/aftercare/AmcSchedulePreview';
import { useServiceNames } from '@/hooks/useServiceNames';
import { amcContractSchema } from '@/form/schemas/aftercare.schema';
import { CUSTOMER_RELATION } from '@/config/admin/jobViews';
import { amcPlanFields } from '@/config/admin/aftercareForms';
import { matchServices } from '@/helpers/aftercare';
import { toastSuccess } from '@/redux/slices/uiSlice';

/**
 * A new AMC contract — or a renewal, prefilled from the old one (`helpers/aftercare#renewalDefaults`). The site
 * follows the customer; covered services come from the catalogue. Below the dates, the **visit schedule** the
 * server will lay down (`AmcSchedulePreview`, from `POST /admin/amc-contracts/preview`), shown before saving.
 *
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void, defaults?: object, title?: string,
 *   description?: string, onCreated?: (contract: object) => void }} props
 */
export function AmcContractSheet({ open, onOpenChange, defaults, title = 'New AMC contract', description, onCreated }) {
  const dispatch = useDispatch();
  const [create] = useCreateAmcContractMutation();
  const [values, setValues] = useState(null);
  const customerId = values?.customerId ?? defaults?.customerId ?? null;
  const { data: sites } = useGetCustomerSitesQuery(customerId, { skip: !open || !customerId });
  const services = useServiceNames(open);

  const plan = amcPlanFields({ customerId, sites: sites ?? [], services });
  const fields = [
    { name: 'customerId', type: 'relation', label: 'Customer', required: true, relation: CUSTOMER_RELATION },
    ...plan.slice(0, 3),
    { name: 'startDate', type: 'date', label: 'Starts', required: true, span: 'half' },
    { name: 'endDate', type: 'date', label: 'Ends', required: true, span: 'half', description: 'Five years at most.' },
    {
      name: 'visitsPerYear', type: 'number', label: 'Visits a year', required: true, span: 'half', min: 1, max: 52, step: 1,
      description: 'Spread evenly over the contract.',
    },
    { name: 'schedule', type: 'preview', label: 'Visit schedule', component: AmcSchedulePreview },
    ...plan.slice(3),
  ];

  const submit = async (body) => {
    const contract = await create(body).unwrap();
    dispatch(toastSuccess(
      `${contract.number} created`,
      `${contract.visits?.length ?? 0} visit${contract.visits?.length === 1 ? '' : 's'} laid down.`,
    ));
    setValues(null);
    onOpenChange(false);
    onCreated?.(contract);
  };

  return (
    <ResourceForm
      mode="sheet"
      open={open}
      onOpenChange={(o) => { if (!o) setValues(null); onOpenChange(o); }}
      title={title}
      description={description ?? 'A maintenance plan with visits spread over its term.'}
      schema={amcContractSchema}
      fields={fields}
      defaultValues={{
        customerId: null, siteId: '', planName: '', visitsPerYear: 4, billingCycle: 'annual', notes: '',
        ...defaults,
        coveredServices: matchServices(defaults?.coveredServices ?? [], services),
      }}
      onValuesChange={setValues}
      submitLabel="Create contract"
      onSubmit={submit}
      guard={false}
    />
  );
}
