import { Info } from 'lucide-react';
import { useGetQuotationTakeoffQuery } from '@/api/quotationsApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { StateBadge } from '@/components/common/StateBadge';
import { useAuth } from '@/hooks/useAuth';
import { formatNpr } from '@/helpers/format';
import { formatQty } from '@/helpers/measurements';

const NO_PARAMS = { page: 1, limit: 500 };
const noop = () => {};
const metaOf = (rows) => ({ page: 1, pages: 1, total: rows.length, limit: rows.length || 1 });
const costColumn = { key: 'costAmount', header: 'Cost', className: 'text-right', cell: (r) => <span className="tabular-nums">{r.costAmount == null ? '—' : formatNpr(r.costAmount)}</span> };

/** A notice that the take-off reads the saved quotation, while the form has unsaved edits. */
export function SavedOnlyNotice({ dirty }) {
  if (!dirty) return null;
  return (
    <p className="flex items-center gap-2 rounded-md surface-info px-3 py-2 text-sm">
      <Info className="h-4 w-4 shrink-0" aria-hidden /> This is the saved quotation. Save your edits to include them.
    </p>
  );
}

/**
 * The Take-off tab: what the saved rows need, from each row's frozen recipe × its quantity (the server's
 * `GET …/takeoff`, optional rows left out) — materials in **buying units** (packs of the material's pack size)
 * with stock on hand and the shortfall, and equipment and other items. Cost is a column only for `costs:read`.
 * Rows without a recipe add nothing, and are named.
 */
export function TakeoffTab({ quotationId, dirty }) {
  const { can } = useAuth();
  const showCost = can('costs:read');
  const { data, isLoading, isFetching, error, refetch } = useGetQuotationTakeoffQuery(quotationId);
  const materials = data?.materials ?? [];
  const other = data?.other ?? [];
  const without = data?.rowsWithoutRecipe ?? [];

  const materialColumns = [
    {
      key: 'name', header: 'Material',
      cell: (r) => <span className="min-w-0"><span className="font-mono text-xs font-semibold">{r.code}</span> {r.name}</span>,
    },
    { key: 'qty', header: 'Needed', cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatQty(r.qty)} {r.unit}</span> },
    {
      key: 'packs', header: 'Buy',
      cell: (r) => (r.packs == null
        ? <span className="text-muted-foreground">{formatQty(r.qty)} {r.unit}</span>
        : <span className="whitespace-nowrap tabular-nums">{r.packs} × {r.packLabel ?? `${formatQty(r.packSize)} ${r.unit}`}</span>),
    },
    { key: 'onHand', header: 'In stock', cell: (r) => <span className="whitespace-nowrap tabular-nums">{r.onHand == null ? '—' : `${formatQty(r.onHand)} ${r.unit}`}</span> },
    {
      key: 'shortfall', header: 'Short',
      cell: (r) => (r.shortfall > 0
        ? <StateBadge tone="warning">{formatQty(r.shortfall)} {r.unit}</StateBadge>
        : <span className="text-xs text-muted-foreground">In stock</span>),
    },
    ...(showCost ? [costColumn] : []),
  ];
  const otherColumns = [
    { key: 'description', header: 'Equipment and other' },
    { key: 'qty', header: 'Quantity', cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatQty(r.qty)} {r.unit ?? ''}</span> },
    ...(showCost ? [costColumn] : []),
  ];
  const common = {
    params: NO_PARAMS, onParamsChange: noop, searchable: false, pageSizes: [], isLoading, isFetching, error, refetch,
  };

  return (
    <div className="space-y-4">
      <SavedOnlyNotice dirty={dirty} />
      <section aria-labelledby="takeoff-materials" className="space-y-2">
        <h2 id="takeoff-materials" className="text-sm font-semibold">Materials</h2>
        <CustomTable
          {...common}
          columns={materialColumns}
          data={materials}
          meta={metaOf(materials)}
          getRowId={(r) => r.materialId}
          rowLabel={(r) => r.name}
          emptyTitle="No materials"
          emptyDescription="None of the priced rows has a material in its recipe."
        />
      </section>
      {other.length ? (
        <section aria-labelledby="takeoff-other" className="space-y-2">
          <h2 id="takeoff-other" className="text-sm font-semibold">Equipment and other</h2>
          <CustomTable {...common} columns={otherColumns} data={other} meta={metaOf(other)} getRowId={(r) => `${r.description}:${r.unit}`} rowLabel={(r) => r.description} />
        </section>
      ) : null}
      {without.length ? (
        <section aria-labelledby="takeoff-without" className="rounded-md border p-3 text-sm">
          <h2 id="takeoff-without" className="font-semibold">Rows without a recipe</h2>
          <p className="text-xs text-muted-foreground">Typed rows, and library items without a recipe, add nothing above.</p>
          <ul className="mt-2 space-y-0.5">
            {without.map((r) => (
              <li key={r.id}><span className="font-mono text-xs font-semibold">{r.number}</span> {r.description}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
