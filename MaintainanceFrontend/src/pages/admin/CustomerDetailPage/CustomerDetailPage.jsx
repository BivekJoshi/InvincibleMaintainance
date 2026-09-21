import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft, Mail, MessageCircle, Phone, Plus, Trash2 } from 'lucide-react';
import { useDeleteCustomerMutation, useGetCustomerQuery, useUpdateCustomerMutation } from '@/api/customersApi';
import { RecordHeader } from '@/components/common/RecordHeader';
import { CustomerAvatar } from '@/components/customers/CustomerAvatar';
import { ErrorState } from '@/components/common/ErrorState';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { RecordHistory } from '@/components/common/RecordHistory';
import { StateBadge } from '@/components/common/StateBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { customerSchema } from '@/form/schemas/customer.schema';
import { customerFields } from '@/config/admin/crmForms';
import { CUSTOMER_RECORD_TABS } from '@/config/admin/customerTabs';
import { PREFERRED_LOCALE_OPTIONS } from '@/config/constants';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { relativeTime, titleCase } from '@/helpers/format';
import { JobFormSheet } from '@/components/jobs/JobFormSheet';
import { whatsappHref } from '@/helpers/contact';
import { cn } from '@/helpers/utils';
import { CustomerSitesTab } from './sections/CustomerSitesTab';
import { CustomerTimelineTab } from './sections/CustomerTimelineTab';
import { CustomerRecordsTab } from './sections/CustomerRecordsTab';
import { CustomerStatementTab } from './sections/CustomerStatementTab';

/**
 * A customer: profile, sites, what happened with them, their records in every other
 * module, the account (finance only), and the audit History.
 */
export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [search, setSearch] = useSearchParams();
  const { can, role } = useAuth();
  const canWrite = can('customers:write');
  const { data: customer, isLoading, error, refetch } = useGetCustomerQuery(id);
  const [updateCustomer] = useUpdateCustomerMutation();
  const [deleteCustomer] = useDeleteCustomerMutation();
  const [confirm, confirmDialog] = useConfirm();
  const [newJob, setNewJob] = useState(false);

  const recordTabs = CUSTOMER_RECORD_TABS.filter((t) => t.allowed({ can, role }));
  const tabs = [
    'profile', 'sites', 'timeline', ...recordTabs.map((t) => t.key),
    ...(can('reports:finance') ? ['statement'] : []), ...(can('customers:history') ? ['history'] : []),
  ];
  const tab = tabs.includes(search.get('tab')) ? search.get('tab') : 'profile';
  const setTab = (next) => setSearch(next === 'profile' ? {} : { tab: next }, { replace: true });

  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete ${customer.name}?`,
      description: 'A customer with open jobs cannot be deleted. Their records stay in the audit log.',
      confirmLabel: 'Delete customer',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteCustomer(customer.id).unwrap();
      dispatch(toastSuccess('Customer deleted'));
      navigate('/admin/customers', { replace: true });
    } catch (err) {
      dispatch(toastError('Could not delete the customer', err?.data?.error?.message));
    }
  };

  const language = PREFERRED_LOCALE_OPTIONS.find((o) => o.value === customer.preferredLocale)?.label;
  const counts = customer._count ?? {};
  const whatsapp = whatsappHref(customer.phone);
  // Each count opens the tab that lists it, when this user has that tab.
  const tiles = [
    ['Enquiries', counts.leads, 'timeline'], ['Quotations', counts.quotations, 'quotations'],
    ['Jobs', counts.jobs, 'jobs'], ['Invoices', counts.invoices, 'invoices'],
  ];

  return (
    <PageTransition>
      <RecordHeader
        avatar={<CustomerAvatar customer={customer} size="lg" />}
        eyebrow={(
          <>
            <span>{titleCase(customer.type)}</span>
            <span aria-hidden>·</span>
            <span>Writes in {language}</span>
            <span aria-hidden>·</span>
            <span className="normal-case tracking-normal text-muted-foreground" title={customer.createdAt}>Customer since {relativeTime(customer.createdAt)}</span>
          </>
        )}
        title={customer.name}
        meta={(
          <>
            <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 font-medium tabular-nums hover:text-primary"><Phone className="h-4 w-4 text-muted-foreground" aria-hidden /> {customer.phone}</a>
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-success hover:underline">
                <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
              </a>
            ) : null}
            {customer.email ? <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 hover:text-primary"><Mail className="h-4 w-4 text-muted-foreground" aria-hidden /> {customer.email}</a> : null}
            {(customer.tags ?? []).map((t) => <StateBadge key={t}>{t}</StateBadge>)}
          </>
        )}
        actions={(
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/customers')}><ArrowLeft /> Customers</Button>
            {can('jobs:write') ? <Button size="sm" onClick={() => setNewJob(true)}><Plus /> New job</Button> : null}
            {canWrite ? (
              <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete customer"><Trash2 className="text-destructive" /></Button>
            ) : null}
          </>
        )}
      >
        {/* What the company has done with them; each count opens the tab that lists it. */}
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
          {tiles.map(([label, n, target]) => {
            const body = (
              <>
                <span className="block text-2xl font-semibold tabular-nums">{n ?? 0}</span>
                <span className="block text-xs text-muted-foreground">{label}</span>
              </>
            );
            const active = tab === target;
            return tabs.includes(target) ? (
              <button
                key={label} type="button" onClick={() => setTab(target)} aria-label={`${label}: ${n ?? 0} — open the tab`}
                className={cn(
                  'relative px-5 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  active && 'bg-primary/[0.05] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary',
                )}
              >
                {body}
              </button>
            ) : <div key={label} className="px-5 py-3">{body}</div>;
          })}
        </div>
      </RecordHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-1 mb-4 overflow-x-auto px-1">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="sites">Sites ({customer.sites?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            {recordTabs.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
            {can('reports:finance') ? <TabsTrigger value="statement">Statement</TabsTrigger> : null}
            {can('customers:history') ? <TabsTrigger value="history">History</TabsTrigger> : null}
          </TabsList>
        </div>

        <TabsContent value="profile">
          <Card><CardContent className="pt-6">
            <ResourceForm
              schema={customerSchema}
              fields={customerFields}
              defaultValues={customer}
              readOnly={!canWrite}
              submitLabel="Save customer"
              onSubmit={async (body) => {
                await updateCustomer({ id: customer.id, ...body }).unwrap();
                dispatch(toastSuccess('Customer saved'));
              }}
            />
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="sites">
          {tab === 'sites' ? <CustomerSitesTab customer={customer} canWrite={canWrite} /> : null}
        </TabsContent>
        <TabsContent value="timeline">
          {tab === 'timeline' ? <CustomerTimelineTab customerId={customer.id} /> : null}
        </TabsContent>
        {recordTabs.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            {tab === t.key ? <CustomerRecordsTab customerId={customer.id} tab={t} /> : null}
          </TabsContent>
        ))}
        {can('reports:finance') ? (
          <TabsContent value="statement">
            {tab === 'statement' ? <CustomerStatementTab customerId={customer.id} /> : null}
          </TabsContent>
        ) : null}
        {can('customers:history') ? (
          <TabsContent value="history">
            {tab === 'history' ? <RecordHistory endpoint={`/admin/customers/${customer.id}/history`} /> : null}
          </TabsContent>
        ) : null}
      </Tabs>
      {can('jobs:write') ? (
        <JobFormSheet
          open={newJob}
          onOpenChange={setNewJob}
          defaults={{ customerId: customer.id, siteId: customer.sites?.find((s) => s.isPrimary)?.id }}
          onCreated={(job) => navigate(`/admin/jobs/${job.id}`)}
        />
      ) : null}
      {confirmDialog}
    </PageTransition>
  );
}
