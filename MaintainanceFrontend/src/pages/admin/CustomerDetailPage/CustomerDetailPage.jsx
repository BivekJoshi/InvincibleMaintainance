import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft, Mail, Phone, Trash2 } from 'lucide-react';
import { useDeleteCustomerMutation, useGetCustomerQuery, useUpdateCustomerMutation } from '@/api/customersApi';
import { PageHeader } from '@/components/common/PageHeader';
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
import { titleCase } from '@/helpers/format';
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

  return (
    <PageTransition>
      <PageHeader
        title={customer.name}
        description={`${titleCase(customer.type)} · writes in ${language}`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/customers')}><ArrowLeft /> Customers</Button>
            {canWrite ? (
              <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete customer"><Trash2 className="text-destructive" /></Button>
            ) : null}
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 hover:text-primary"><Phone className="h-4 w-4" aria-hidden /> {customer.phone}</a>
          {customer.email ? <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 hover:text-primary"><Mail className="h-4 w-4" aria-hidden /> {customer.email}</a> : null}
          {(customer.tags ?? []).map((t) => <StateBadge key={t}>{t}</StateBadge>)}
        </div>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Enquiries', counts.leads], ['Quotations', counts.quotations], ['Jobs', counts.jobs], ['Invoices', counts.invoices]].map(([label, n]) => (
          <Card key={label}><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{n ?? 0}</p>
          </CardContent></Card>
        ))}
      </div>

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
      {confirmDialog}
    </PageTransition>
  );
}
