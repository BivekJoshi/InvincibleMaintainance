import { useDispatch } from 'react-redux';
import { Download } from 'lucide-react';
import { useLazyDownloadReportCsvQuery } from '@/api/financeApi';
import { Button } from '@/components/ui/button';
import { pushToast, toastError } from '@/redux/slices/uiSlice';
import { saveBlob } from '@/helpers/download';
import { csvFileName } from '@/helpers/finance';

/**
 * **CSV** for a report (Phase I): the API's own export — `?format=csv` with the page's current filters (the date
 * range, a grouping) — never the rows on screen. Fetched through RTK Query so it carries the Bearer token; saved with
 * the byte-order mark `res.text()` dropped, so Excel reads Devanagari; named as the API names it. Capped at 10,000
 * rows by the server, which says so (`X-Export-Truncated`) — and so does the toast.
 *
 * @param {{ path: string, params?: object, name: string, label?: string, disabled?: boolean }} props
 */
export function ReportCsvButton({ path, params = {}, name, label = 'CSV', disabled = false }) {
  const dispatch = useDispatch();
  const [download, { isFetching }] = useLazyDownloadReportCsvQuery();

  const onClick = async () => {
    try {
      const file = await download({ path, params }).unwrap();
      const fileName = csvFileName(file?.disposition, name, params);
      saveBlob(new Blob(['\uFEFF', file?.csv ?? ''], { type: 'text/csv;charset=utf-8' }), fileName);
      dispatch(pushToast(file?.truncated
        ? { variant: 'default', title: `${fileName} saved — the first 10,000 rows`, description: 'Narrow the dates to export the rest.' }
        : { variant: 'success', title: `${fileName} saved` }));
    } catch (err) {
      dispatch(toastError('Could not export the report', err?.data?.error?.message));
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} loading={isFetching} disabled={disabled} aria-label={`Download ${name} as CSV`}>
      <Download aria-hidden /> {label}
    </Button>
  );
}
