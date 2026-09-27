import { useState } from 'react';
import { useGetQuotationTakeoffQuery } from '@/api/quotationsApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { formatNpr } from '@/helpers/format';
import { formatQty } from '@/helpers/measurements';
import { crewDuration } from '@/helpers/boq';
import { SavedOnlyNotice } from './TakeoffTab';

const NO_PARAMS = { page: 1, limit: 500 };
const noop = () => {};

/**
 * The Labour tab: the man-days each trade's recipes add up to (the server's take-off, optional rows left out),
 * and a crew size per trade that turns them into a duration — days ÷ crew. That division is quantity maths
 * only; the labour's cost is a column for `costs:read` alone.
 */
export function LabourTab({ quotationId, dirty }) {
  const { can } = useAuth();
  const showCost = can('costs:read');
  const { data, isLoading, isFetching, error, refetch } = useGetQuotationTakeoffQuery(quotationId);
  const labour = data?.labour ?? [];
  const [crews, setCrews] = useState({});
  const crewOf = (r) => crews[r.tradeId] ?? '1';
  const totalDays = Math.round(labour.reduce((t, r) => t + Number(r.days || 0), 0) * 1000) / 1000;

  const columns = [
    { key: 'name', header: 'Trade', cell: (r) => <span><span className="font-mono text-xs font-semibold">{r.code}</span> {r.name}</span> },
    { key: 'days', header: 'Man-days', cell: (r) => <span className="tabular-nums" data-testid={`days-${r.tradeId}`}>{formatQty(r.days)}</span> },
    {
      key: 'crew', header: 'Crew size',
      cell: (r) => (
        <Input
          type="number" min="1" step="1" inputMode="numeric"
          value={crewOf(r)}
          onChange={(e) => setCrews((c) => ({ ...c, [r.tradeId]: e.target.value }))}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Crew size for ${r.name}`}
          className="h-8 w-20 text-right tabular-nums"
        />
      ),
    },
    {
      key: 'duration', header: 'Duration',
      cell: (r) => {
        const d = crewDuration(r.days, crewOf(r));
        return <span className="tabular-nums" data-testid={`duration-${r.tradeId}`}>{d == null ? '—' : `${formatQty(d)} ${d === 1 ? 'day' : 'days'}`}</span>;
      },
    },
    ...(showCost ? [{ key: 'costAmount', header: 'Cost', cell: (r) => <span className="tabular-nums">{r.costAmount == null ? '—' : formatNpr(r.costAmount)}</span> }] : []),
  ];

  return (
    <div className="space-y-3">
      <SavedOnlyNotice dirty={dirty} />
      <CustomTable
        columns={columns}
        data={labour}
        meta={{ page: 1, pages: 1, total: labour.length, limit: labour.length || 1 }}
        params={NO_PARAMS}
        onParamsChange={noop}
        searchable={false}
        pageSizes={[]}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        getRowId={(r) => r.tradeId}
        rowLabel={(r) => r.name}
        emptyTitle="No labour in the recipes"
        emptyDescription="Rows priced from the rate library bring their trades' man-days here."
      />
      {labour.length ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground">{formatQty(totalDays)}</span> man-days in all. Set each trade’s crew to see how long its part takes.
        </p>
      ) : null}
    </div>
  );
}
