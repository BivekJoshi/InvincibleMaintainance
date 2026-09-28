import { useDispatch } from 'react-redux';
import { useMeasureJobLineMutation } from '@/api/jobsApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { jobLineMeasureSchema } from '@/form/schemas/job.schema';
import { isMeasured } from '@/helpers/closeout';
import { formatQty } from '@/helpers/measurements';
import { toastSuccess } from '@/redux/slices/uiSlice';

/** "A.1 · Crystalline slurry, two coats" */
const lineName = (line) => [line?.number, line?.description].filter(Boolean).join(' · ') || 'this line';

/**
 * The office's final measurement of one job line (Phase L8) — a sheet with the kit's `measurements` field (the one
 * measurement book: area, description, nos, L, B, H in feet-inches, deduct; each row's value and the total a preview)
 * that sends `PUT /admin/jobs/:id/lines/:lineId/measure`. The line keeps the quantity the **server** works out from the
 * rows (`measuredQty`), which the toast repeats. Quantities only — no rate is shown or sent. A refusal (422
 * MEASUREMENT_CLOSED, LINE_NOT_MEASURED, NEGATIVE_LINE) is the server's words above the form.
 *
 * @param {{ job: { id: string }, line: object|null, onClose: () => void }} props
 */
export function MeasureLineSheet({ job, line, onClose }) {
  const dispatch = useDispatch();
  const [measure] = useMeasureJobLineMutation();
  if (!line) return null;
  const unit = line.unit ?? '';
  const quoted = `Quoted ${formatQty(line.quotedQty)} ${unit}`.trim();
  const measured = isMeasured(line) ? `measured ${formatQty(line.measuredQty)} ${unit} (the server’s)`.trim() : 'not measured yet';

  return (
    <ResourceForm
      mode="sheet"
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={`Measure ${lineName(line)}`}
      description={`${quoted}; ${measured}. One row per wall, floor or opening — the line keeps the quantity the server works out from them.`}
      schema={jobLineMeasureSchema}
      fields={[{ name: 'measurements', type: 'measurements', label: 'Measurements', unit: unit || undefined, keptBy: 'job line' }]}
      defaultValues={{ measurements: line.measurements ?? [] }}
      guard={false}
      submitLabel="Save measurements"
      onSubmit={async ({ measurements }) => {
        const saved = await measure({ id: job.id, lineId: line.id, measurements }).unwrap();
        dispatch(toastSuccess(`${line.number ?? 'Line'} measured`, `${formatQty(saved.measuredQty)} ${saved.unit ?? unit} — the server’s quantity.`.trim()));
        onClose();
      }}
    />
  );
}
