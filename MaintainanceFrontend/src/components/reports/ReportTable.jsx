import { useState } from 'react';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';

/**
 * A report's rows as a table (Phase I): the kit's `CustomTable` over an answer that is already whole — one page, no
 * search, no paging, the columns' layout remembered under `storageKey`. Reports always have a table, chart or not;
 * the CSV is the API's (`ReportToolbar`), so there is no page export here.
 *
 * @param {{ columns: object[], rows?: object[], getRowId?: (row: object, i: number) => string, storageKey?: string,
 *   isLoading?: boolean, isFetching?: boolean, error?: unknown, refetch?: () => void, onRowClick?: (row: object) => void,
 *   rowLabel?: (row: object, i: number) => string, emptyTitle?: string, emptyDescription?: string, maxHeight?: string }} props
 */
export function ReportTable({
  columns, rows = [], getRowId, storageKey, isLoading, isFetching, error, refetch, onRowClick, rowLabel,
  emptyTitle = 'Nothing in this range', emptyDescription = 'Widen the dates to look further back.', maxHeight,
}) {
  const [params, setParams] = useState({});
  const data = getRowId ? rows.map((r, i) => ({ ...r, id: getRowId(r, i) })) : rows;
  return (
    <CustomTable
      storageKey={storageKey}
      columns={columns}
      data={data}
      meta={{ page: 1, pages: 1, total: data.length, limit: data.length || 1 }}
      pageSizes={[]}
      params={params}
      onParamsChange={setParams}
      searchable={false}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      refetch={refetch}
      onRowClick={onRowClick}
      rowLabel={rowLabel}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      maxHeight={maxHeight}
    />
  );
}
