import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useCreateJobMutation, useGetDispatchTechniciansQuery } from '@/api/jobsApi';
import { useGetCustomerSitesQuery } from '@/api/customersApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { jobCreateSchema } from '@/form/schemas/job.schema';
import { useAuth } from '@/hooks/useAuth';
import { CUSTOMER_RELATION, TEMPLATE_RELATION, technicianOption } from '@/config/admin/jobViews';
import { JOB_TYPES, JOB_TYPE_LABELS, PRIORITIES } from '@/config/constants';
import { titleCase } from '@/helpers/format';
import { toastSuccess } from '@/redux/slices/uiSlice';

const TYPE_OPTIONS = JOB_TYPES.map((t) => ({ value: t, label: JOB_TYPE_LABELS[t] }));
const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: titleCase(p) }));

/**
 * A new job. The site and the quotation follow the chosen customer; technicians are optional
 * (a job with people starts ASSIGNED, with only a time SCHEDULED, else unscheduled). A quotation
 * must be the customer's and accepted — most accepted quotations already became a job when the
 * customer said yes, so the list is usually empty.
 *
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void, onCreated?: (job: object) => void, defaults?: object }} props
 */
export function JobFormSheet({ open, onOpenChange, onCreated, defaults }) {
  const dispatch = useDispatch();
  const { can } = useAuth();
  const [create] = useCreateJobMutation();
  const [values, setValues] = useState(null);
  const customerId = values?.customerId ?? defaults?.customerId ?? null;
  const { data: sites } = useGetCustomerSitesQuery(customerId, { skip: !open || !customerId });
  const { data: people } = useGetDispatchTechniciansQuery({ limit: 100 }, { skip: !open });
  const options = useMemo(() => (people?.items ?? []).map(technicianOption), [people]);
  const chosen = values?.technicianIds ?? [];

  const fields = [
    { name: 'customerId', type: 'relation', label: 'Customer', required: true, relation: CUSTOMER_RELATION },
    {
      name: 'siteId', type: 'select', label: 'Site', noneLabel: customerId ? 'No particular site' : 'Choose the customer first',
      options: (sites ?? []).map((s) => ({ value: s.id, label: `${s.label}${s.isPrimary ? ' (primary)' : ''} · ${s.address}` })),
      disabled: !customerId,
    },
    ...(can('quotations:read') ? [{
      name: 'quotationId', type: 'relation', label: 'From an accepted quotation',
      relation: { path: '/admin/quotations', labelKey: (q) => `${q.number} · ${q.customer?.name ?? ''}`, params: { status: 'APPROVED', ...(customerId ? { customerId } : {}) } },
      description: 'Optional. It becomes “accepted · job created”.',
    }] : []),
    { name: 'type', type: 'select', label: 'Type', required: true, span: 'half', options: TYPE_OPTIONS },
    { name: 'priority', type: 'select', label: 'Priority', required: true, span: 'half', options: PRIORITY_OPTIONS },
    { name: 'title', type: 'text', label: 'Title', required: true, maxLength: 250, placeholder: 'Terrace waterproofing — Jhamsikhel' },
    { name: 'description', type: 'textarea', label: 'What needs doing', rows: 3 },
    { name: 'templateId', type: 'relation', label: 'Checklist template', relation: TEMPLATE_RELATION, description: 'Its steps are copied onto the job.' },
    { name: 'scheduledStart', type: 'datetime', label: 'Starts', span: 'half', defaultTime: '10:00', description: 'Optional — or schedule it on the board.' },
    { name: 'scheduledEnd', type: 'datetime', label: 'Ends', span: 'half', defaultTime: '12:00' },
    { name: 'technicianIds', type: 'checklist', label: 'Technicians', options, emptyText: 'No technicians yet.' },
    ...(chosen.length > 1 ? [{
      name: 'leadTechnicianId', type: 'select', label: 'Lead technician', noneLabel: 'The first one ticked',
      options: chosen.map((id) => ({ value: id, label: options.find((o) => o.value === id)?.label ?? id })),
    }] : []),
    { name: 'isBillable', type: 'switch', label: 'Billable', description: 'Off for a free inspection or warranty work.' },
  ];

  const submit = async (body) => {
    const job = await create({
      ...body,
      siteId: body.siteId || null,
      technicianIds: body.technicianIds?.length ? body.technicianIds : undefined,
    }).unwrap();
    dispatch(toastSuccess(`Job ${job.number} created`, job.status === 'DRAFT' ? 'It is waiting to be scheduled.' : undefined));
    setValues(null);
    onOpenChange(false);
    onCreated?.(job);
  };

  return (
    <ResourceForm
      mode="sheet"
      open={open}
      onOpenChange={onOpenChange}
      title="New job"
      description="Work to be done for a customer."
      schema={jobCreateSchema}
      fields={fields}
      defaultValues={{ type: 'REPAIR', priority: 'NORMAL', isBillable: true, technicianIds: [], ...defaults }}
      onValuesChange={setValues}
      submitLabel="Create job"
      onSubmit={submit}
      guard={false}
    />
  );
}
