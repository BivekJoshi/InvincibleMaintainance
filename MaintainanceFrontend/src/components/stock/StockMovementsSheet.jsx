import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetStockMovementsQuery } from '@/api/stockApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { STOCK_MOVEMENT_LABELS, STOCK_MOVEMENT_TYPES } from '@/config/constants';
import { formatDateTime, formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** A signed quantity with its unit, without float noise: +50 kg, −22 kg. */
const signed = (qty, unit) => `${qty > 0 ? '+' : '−'}${Number(Math.abs(qty).toFixed(3))} ${unit}`;

/**
 * One material's stock history — every purchase, issue, return, adjustment and wastage, newest
 * first, paged by the API, with who recorded it and the job it went to.
 *
 * `material` is the stock row when the page has it; a link to a material on another page passes
 * only `materialId`, and the sheet names it from its movements.
 *
 * @param {{ materialId: string|null, material?: object|null, onOpenChange: (open: boolean) => void }} props
 */
export function StockMovementsSheet({ materialId, material, onOpenChange }) {
  const [params, setParams] = useState({ page: 1, limit: 20 });
  useEffect(() => setParams({ page: 1, limit: 20 }), [materialId]);
  const query = { materialId, ...params };
  const { data, isLoading, isFetching, error, refetch } = useGetStockMovementsQuery(query, { skip: !materialId });
  const named = material ?? data?.items?.[0]?.material ?? null;

  const columns = [
    {
      key: 'type', header: 'Movement',
      cell: (m) => (
        <div className="min-w-0">
          <p className="font-medium">{STOCK_MOVEMENT_LABELS[m.type] ?? m.type}</p>
          <p className="text-xs text-muted-foreground">
            {m.job ? <Link to={`/admin/jobs/${m.jobId}`} className="text-primary hover:underline">{m.job.number}</Link> : m.reference ?? ''}
          </p>
          {m.note ? <p className="whitespace-pre-wrap text-xs text-muted-foreground">{m.note}</p> : null}
        </div>
      ),
    },
    {
      key: 'qty', header: 'Quantity', className: 'text-right',
      cell: (m) => <span className={cn('whitespace-nowrap tabular-nums', m.qty < 0 ? 'text-destructive' : 'text-success')}>{signed(m.qty, m.material.unit)}</span>,
    },
    { key: 'rate', header: 'Rate', className: 'text-right', cell: (m) => (m.rate != null ? <span className="tabular-nums">{formatNpr(m.rate)}</span> : '—') },
    {
      key: 'createdAt', header: 'When',
      cell: (m) => (
        <span className="whitespace-nowrap text-xs">
          {formatDateTime(m.createdAt)}
          <span className="block text-muted-foreground">{m.actor?.name ?? 'System'}</span>
        </span>
      ),
    },
  ];

  const filters = [
    { key: 'type', label: 'Movement', type: 'enum', allLabel: 'Every movement', options: STOCK_MOVEMENT_TYPES.map((t) => ({ value: t, label: STOCK_MOVEMENT_LABELS[t] })) },
  ];

  return (
    <Sheet open={Boolean(materialId)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle>{named ? `${named.code} · ${named.name}` : 'Movements'}</SheetTitle>
          <SheetDescription>
            {material ? `${Number(material.balance.toFixed(3))} ${material.unit} in stock now.` : 'Every purchase, issue, return and adjustment.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {materialId ? (
            <CustomTable
              columns={columns}
              data={data?.items}
              meta={data?.meta}
              isLoading={isLoading}
              isFetching={isFetching}
              error={error}
              refetch={refetch}
              params={params}
              onParamsChange={setParams}
              searchable={false}
              filters={filters}
              pageSizes={[20, 50]}
              rowLabel={(m) => `${STOCK_MOVEMENT_LABELS[m.type]} ${formatDateTime(m.createdAt)}`}
              emptyTitle="No movements yet"
              emptyDescription="Record a purchase to put it in stock."
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
