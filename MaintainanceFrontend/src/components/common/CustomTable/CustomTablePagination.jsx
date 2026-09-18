import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

/**
 * Record count, rows per page, previous / next.
 *
 * @param {object} props
 * @param {number} props.page
 * @param {number} props.pages
 * @param {number} props.total
 * @param {number} props.limit
 * @param {number[]} [props.pageSizes] empty or missing hides the selector
 * @param {(page: number) => void} props.onPageChange
 * @param {(limit: number) => void} props.onLimitChange
 */
export function CustomTablePagination({ page, pages, total, limit, pageSizes, onPageChange, onLimitChange }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Page {page} of {pages} · {total.toLocaleString()} record{total === 1 ? '' : 's'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {pageSizes?.length ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground" aria-hidden>Rows per page</span>
            <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
              <SelectTrigger className="h-8 w-[76px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizes.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {pages > 1 ? (
          <>
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft aria-hidden /> Previous
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
              Next <ChevronRight aria-hidden />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
