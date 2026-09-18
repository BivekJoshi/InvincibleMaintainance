import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import {
  useCreateSiteMutation, useDeleteSiteMutation, useGetCustomerSitesQuery, useUpdateSiteMutation,
} from '@/api/customersApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { StateBadge } from '@/components/common/StateBadge';
import { MapPinInput } from '@/components/customers/MapPinInput';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/hooks/useConfirm';
import { customerSiteSchema, siteDefaults } from '@/form/schemas/customer.schema';
import { siteFields } from '@/config/admin/crmForms';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

const columns = [
  {
    key: 'label', header: 'Site',
    cell: (r) => (
      <span className="inline-flex items-center gap-2 font-medium">
        {r.label}
        {r.isPrimary ? <StateBadge tone="info">Primary</StateBadge> : null}
      </span>
    ),
  },
  { key: 'address', header: 'Address', cell: (r) => [r.address, r.area].filter(Boolean).join(' · ') },
  {
    key: 'pin', header: 'Map',
    cell: (r) => (r.lat != null && r.lng != null ? (
      <a
        href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}
      >
        <MapPin className="h-3.5 w-3.5" aria-hidden /> {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
      </a>
    ) : <span className="text-xs text-muted-foreground">No pin</span>),
  },
  { key: 'accessNotes', header: 'Access', className: 'max-w-[220px] truncate', cell: (r) => r.accessNotes ?? '—' },
];

/**
 * A customer's sites. Exactly one is primary: the first site is, marking another moves
 * the flag, and the primary cannot be unmarked — only replaced.
 */
export function CustomerSitesTab({ customer, canWrite }) {
  const dispatch = useDispatch();
  const { data, isLoading, isFetching, error, refetch } = useGetCustomerSitesQuery(customer.id);
  const [createSite] = useCreateSiteMutation();
  const [updateSite] = useUpdateSiteMutation();
  const [deleteSite] = useDeleteSiteMutation();
  const [confirm, confirmDialog] = useConfirm();
  const [editing, setEditing] = useState(null); // a site, or {} for a new one
  const [params, setParams] = useState({});
  const sites = data ?? [];

  const save = async (body) => {
    if (editing?.id) {
      // The primary stays primary; the switch is shown locked on it.
      const { isPrimary, ...rest } = body;
      await updateSite({ customerId: customer.id, id: editing.id, ...rest, ...(isPrimary ? { isPrimary } : {}) }).unwrap();
      dispatch(toastSuccess('Site saved'));
    } else {
      await createSite({ customerId: customer.id, ...body }).unwrap();
      dispatch(toastSuccess('Site added'));
    }
    setEditing(null);
  };

  const makePrimary = async (site) => {
    try {
      await updateSite({ customerId: customer.id, id: site.id, isPrimary: true }).unwrap();
      dispatch(toastSuccess(`${site.label} is now the primary site`));
    } catch (err) {
      dispatch(toastError('Could not change the primary site', err?.data?.error?.message));
    }
  };

  const remove = async (site) => {
    const ok = await confirm({
      title: `Remove ${site.label}?`,
      description: site.isPrimary && sites.length > 1
        ? 'It is the primary site; the oldest other site becomes primary.'
        : 'A site with jobs cannot be removed.',
      confirmLabel: 'Remove site',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteSite({ customerId: customer.id, id: site.id }).unwrap();
      dispatch(toastSuccess('Site removed'));
    } catch (err) {
      dispatch(toastError('Could not remove the site', err?.data?.error?.message));
    }
  };

  const rowActions = canWrite ? (row) => [
    { label: 'Edit', icon: Pencil, onSelect: () => setEditing(row) },
    ...(row.isPrimary ? [] : [{ label: 'Make primary', icon: Star, onSelect: () => makePrimary(row) }]),
    { label: 'Remove', icon: Trash2, destructive: true, separator: true, onSelect: () => remove(row) },
  ] : undefined;

  const primaryFields = editing?.isPrimary
    ? siteFields.map((f) => (f.name === 'isPrimary' ? { ...f, disabled: true, description: 'Mark another site primary to move it.' } : f))
    : siteFields;

  return (
    <div className="space-y-3">
      <CustomTable
        columns={columns}
        data={sites}
        meta={{ page: 1, pages: 1, total: sites.length, limit: sites.length || 1 }}
        params={params}
        onParamsChange={setParams}
        searchable={false}
        pageSizes={[]}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        rowActions={rowActions}
        onRowClick={canWrite ? (row) => setEditing(row) : undefined}
        rowLabel={(r) => r.label}
        toolbar={canWrite ? <Button size="sm" onClick={() => setEditing({})}><Plus /> Add site</Button> : null}
        emptyTitle="No sites yet"
        emptyDescription="Add the address where the work happens."
      />
      {canWrite ? (
        <ResourceForm
          mode="sheet"
          open={Boolean(editing)}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          title={editing?.id ? `Edit ${editing.label}` : 'Add site'}
          intro={<MapPinInput />}
          schema={customerSiteSchema}
          fields={primaryFields}
          defaultValues={editing?.id ? editing : { ...siteDefaults, isPrimary: sites.length === 0 }}
          submitLabel={editing?.id ? 'Save site' : 'Add site'}
          onSubmit={save}
          guard={false}
        />
      ) : null}
      {confirmDialog}
    </div>
  );
}
