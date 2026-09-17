import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { History, Package, Pencil, Plus } from 'lucide-react';
import { useGetStockQuery, useRecordStockMovementMutation } from '@/api/stockApi';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable/DataTable';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { StateBadge } from '@/components/common/StateBadge';
import { StockMovementsSheet } from '@/components/stock/StockMovementsSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { useListParams } from '@/hooks/useListParams';
import { stockMovementSchema } from '@/form/schemas/ops.schema';
import { MATERIAL_RELATION } from '@/config/admin/jobViews';
import { MANUAL_STOCK_MOVEMENTS, STOCK_MOVEMENT_LABELS } from '@/config/constants';
import { formatNpr } from '@/helpers/format';
import { toastSuccess } from '@/redux/slices/uiSlice';

const qty = (n) => Number(Number(n).toFixed(3));

const MOVEMENT_HELP = {
  PURCHASE: 'Stock bought in. Adds to the balance.',
  RETURN: 'Unused material brought back. Adds to the balance.',
  ADJUSTMENT: 'A count that differs from the books: enter the difference, negative when stock is missing.',
  WASTAGE: 'Damaged or spoilt. Takes it off the balance.',
};

const columns = [
  {
    key: 'name', header: 'Material', sortable: true,
    cell: (r) => (
      <div className="min-w-0 max-w-md">
        <p className="truncate font-medium">{r.name}</p>
        <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span className="font-mono">{r.code}</span>
          {r.category ? <Badge variant="outline" className="text-[10px]">{r.category.name}</Badge> : null}
        </p>
      </div>
    ),
  },
  {
    key: 'balance', header: 'In stock', sortable: true, className: 'text-right',
    cell: (r) => (
      <div className="flex flex-col items-end gap-0.5">
        <span className={r.balance < 0 ? 'tabular-nums text-destructive' : 'tabular-nums font-medium'}>{qty(r.balance)} {r.unit}</span>
        {r.isLow ? <StateBadge tone="warning">Low — reorder</StateBadge> : null}
      </div>
    ),
  },
  { key: 'reorderLevel', header: 'Reorder at', className: 'text-right', cell: (r) => (r.reorderLevel ? `${qty(r.reorderLevel)} ${r.unit}` : '—') },
  { key: 'stockValue', header: 'Value at cost', className: 'text-right', cell: (r) => <span className="tabular-nums">{formatNpr(r.stockValue)}</span> },
];

const filters = [
  { key: 'lowOnly', label: 'Level', type: 'enum', allLabel: 'Every material', className: 'w-[170px]', options: [{ value: 'true', label: 'Low stock only' }] },
  { key: 'categoryId', label: 'Category', type: 'relation', relation: { path: '/admin/material-categories', labelKey: 'name' } },
];

/**
 * Stock on hand, worked out from movements. The low-stock filter is the reorder list; a row opens
 * that material's movements. "Record movement" takes purchases, returns, adjustments and wastage —
 * issuing to a job happens on the job, which writes the job's line and the movement together.
 * `?open=<materialId>` opens a material's movements (the low-stock notification links here).
 */
export default function StockPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { can } = useAuth();
  const canWrite = can('materials:write');
  const [params, setParams] = useListParams({ limit: 20, sort: 'name' });
  const { open, ...query } = params;
  const { data, isLoading, isFetching, error, refetch } = useGetStockQuery(query);
  const [record] = useRecordStockMovementMutation();
  const [recording, setRecording] = useState(null); // { materialId? }
  const [movementType, setMovementType] = useState('PURCHASE');

  const openRow = data?.items?.find((r) => r.id === open) ?? null;
  const setOpen = (row) => setParams({ ...params, open: row?.id });
  const onValuesChange = useCallback((v) => setMovementType(v.type ?? 'PURCHASE'), []);

  const fields = [
    { name: 'materialId', type: 'relation', label: 'Material', required: true, relation: MATERIAL_RELATION },
    {
      name: 'type', type: 'select', label: 'Movement', required: true, span: 'half',
      options: MANUAL_STOCK_MOVEMENTS.map((t) => ({ value: t, label: STOCK_MOVEMENT_LABELS[t] })),
      description: MOVEMENT_HELP[movementType],
    },
    {
      name: 'qty', type: 'number', label: movementType === 'ADJUSTMENT' ? 'Difference' : 'Quantity', required: true, span: 'half', step: 0.5,
      ...(movementType === 'ADJUSTMENT' ? {} : { min: 0.001 }),
      description: 'In the material’s own unit.',
    },
    ...(movementType === 'PURCHASE' || movementType === 'RETURN' ? [{
      name: 'rate', type: 'money', label: 'Rate per unit', span: 'half', description: 'What it cost, for the record.',
    }] : []),
    { name: 'reference', type: 'text', label: movementType === 'PURCHASE' ? 'Bill number' : 'Reference', span: 'half', maxLength: 120 },
    { name: 'note', type: 'textarea', label: 'Note', rows: 2 },
  ];

  const rowActions = (row) => [
    { label: 'Movements', icon: History, onSelect: () => setOpen(row) },
    ...(canWrite ? [
      { label: 'Record movement…', icon: Plus, onSelect: () => setRecording({ materialId: row.id }) },
      { label: 'Edit material', icon: Pencil, onSelect: () => navigate(`/admin/materials/${row.id}`) },
    ] : []),
  ];

  const low = data?.meta?.lowCount ?? 0;

  return (
    <PageTransition>
      <PageHeader
        title="Stock"
        description="What is on the shelf, worked out from every movement."
        actions={(
          <>
            <Button asChild variant="outline" size="sm"><Link to="/admin/materials"><Package /> Materials</Link></Button>
            {canWrite ? <Button size="sm" onClick={() => setRecording({})}><Plus /> Record movement</Button> : null}
          </>
        )}
      >
        {low ? (
          <button
            type="button"
            onClick={() => setParams({ ...params, lowOnly: 'true', page: 1 })}
            className="mt-2 inline-flex rounded-md border surface-warning px-2 py-1 text-xs font-medium"
          >
            {low} material{low === 1 ? ' is' : 's are'} at or below the reorder level — show them
          </button>
        ) : null}
      </PageHeader>

      <DataTable
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={setOpen}
        rowLabel={(r) => `${r.code} ${r.name}`}
        rowActions={rowActions}
        filters={filters}
        searchPlaceholder="Search code or name…"
        emptyTitle={params.lowOnly ? 'Nothing is low' : 'No materials'}
        emptyDescription={params.lowOnly ? 'Every material is above its reorder level.' : 'Add materials first, then record a purchase.'}
      />

      <StockMovementsSheet materialId={open ?? null} material={openRow} onOpenChange={(o) => { if (!o) setOpen(null); }} />

      {canWrite ? (
        <ResourceForm
          mode="sheet"
          open={Boolean(recording)}
          onOpenChange={(o) => { if (!o) { setRecording(null); setMovementType('PURCHASE'); } }}
          title="Record a stock movement"
          description="Issuing material to a job is done from the job itself."
          schema={stockMovementSchema}
          fields={fields}
          defaultValues={{ materialId: recording?.materialId ?? null, type: 'PURCHASE' }}
          onValuesChange={onValuesChange}
          guard={false}
          submitLabel="Record"
          onSubmit={async (body) => {
            const movement = await record(body).unwrap();
            dispatch(toastSuccess(`${STOCK_MOVEMENT_LABELS[movement.type]} recorded`, `${movement.qty > 0 ? '+' : ''}${qty(movement.qty)} in stock.`));
            setRecording(null);
            setMovementType('PURCHASE');
          }}
        />
      ) : null}
    </PageTransition>
  );
}
