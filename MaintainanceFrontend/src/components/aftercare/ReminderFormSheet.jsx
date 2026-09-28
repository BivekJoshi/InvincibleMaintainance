import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useCreateServiceReminderMutation, useUpdateServiceReminderMutation } from '@/api/aftercareApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { ReminderMessageCounter } from '@/components/aftercare/ReminderMessageCounter';
import { useAuth } from '@/hooks/useAuth';
import { serviceReminderSchema } from '@/form/schemas/aftercare.schema';
import { CUSTOMER_RELATION } from '@/config/admin/jobViews';
import { SERVICE_LOOKUP } from '@/config/admin/aftercareViews';
import { REMINDER_CHANNEL_LABELS } from '@/config/constants';
import { formatDateTime } from '@/helpers/format';
import { toastSuccess } from '@/redux/slices/uiSlice';

const CHANNEL_OPTIONS = Object.entries(REMINDER_CHANNEL_LABELS).map(([value, label]) => ({ value, label }));

/**
 * A service reminder, new or (while pending) edited: who, when it goes out (Kathmandu time), by SMS or email, the
 * job or service it is about, and the message with its SMS parts counted as it is typed. The customer is fixed
 * once saved. A reminder that already went out is history — the list does not offer this sheet for it, and the
 * API answers 422 if it is tried.
 *
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void, reminder?: object|null, defaults?: object }} props
 */
export function ReminderFormSheet({ open, onOpenChange, reminder, defaults }) {
  const dispatch = useDispatch();
  const { can } = useAuth();
  const [create] = useCreateServiceReminderMutation();
  const [update] = useUpdateServiceReminderMutation();
  const [values, setValues] = useState(null);
  const editing = Boolean(reminder?.id);
  const customerId = values?.customerId ?? reminder?.customer?.id ?? reminder?.customerId ?? defaults?.customerId ?? null;

  const fields = [
    {
      name: 'customerId', type: 'relation', label: 'Customer', required: true, relation: CUSTOMER_RELATION, disabled: editing,
      ...(editing ? { description: 'A reminder stays with its customer — add a new one for someone else.' } : {}),
    },
    { name: 'dueAt', type: 'datetime', label: 'Send at', required: true, span: 'half', defaultTime: '10:00', description: 'Kathmandu time.' },
    { name: 'channel', type: 'select', label: 'By', required: true, span: 'half', options: CHANNEL_OPTIONS },
    ...(can('jobs:read') ? [{
      name: 'jobId', type: 'relation', label: 'About job (optional)', span: 'half',
      relation: { path: '/admin/jobs', labelKey: (j) => `${j.number} · ${j.title}`, params: customerId ? { customerId } : {} },
      disabled: !customerId,
    }] : []),
    ...(can('services:read') ? [{
      name: 'serviceId', type: 'relation', label: 'About service (optional)', span: 'half',
      relation: { path: SERVICE_LOOKUP.path, labelKey: 'name', params: SERVICE_LOOKUP.params },
    }] : []),
    {
      name: 'message', type: 'textarea', label: 'Message', required: true, rows: 5, maxLength: 1000,
      description: 'Sent as written. Nepali text is welcome — it costs more SMS parts.',
    },
    { name: 'counter', type: 'preview', label: 'SMS parts', component: ReminderMessageCounter },
  ];

  const submit = async (body) => {
    if (editing) {
      await update({ id: reminder.id, ...body }).unwrap();
      dispatch(toastSuccess('Reminder saved', `Goes out ${formatDateTime(body.dueAt)}.`));
    } else {
      await create(body).unwrap();
      dispatch(toastSuccess('Reminder added', `Goes out ${formatDateTime(body.dueAt)}.`));
    }
    setValues(null);
    onOpenChange(false);
  };

  return (
    <ResourceForm
      mode="sheet"
      open={open}
      onOpenChange={(o) => { if (!o) setValues(null); onOpenChange(o); }}
      title={editing ? 'Edit reminder' : 'New service reminder'}
      description="A message the customer gets on the day — a check-up before the monsoon, a filter change."
      schema={serviceReminderSchema}
      fields={fields}
      defaultValues={editing
        ? { ...reminder, customerId: reminder.customer?.id ?? reminder.customerId }
        : { customerId: null, jobId: null, serviceId: null, channel: 'sms', message: '', ...defaults }}
      onValuesChange={setValues}
      submitLabel={editing ? 'Save reminder' : 'Add reminder'}
      onSubmit={submit}
      guard={false}
    />
  );
}
