import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { PackageMinus, Undo2 } from 'lucide-react';
import { useIssueJobMaterialMutation, useReverseJobMaterialMutation } from '@/api/jobsApi';
import { DataTable } from '@/components/common/DataTable/DataTable';
import { FormDialog } from '@/components/common/FormDialog';
import { StateBadge } from '@/components/common/StateBadge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/hooks/useConfirm';
import { jobMaterialSchema } from '@/form/schemas/job.schema';
import { MATERIAL_RELATION } from '@/config/admin/jobViews';
import { formatDateTime, formatNpr } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

const CLOSED = ['COMPLETED', 'VERIFIED', 'CANCELLED'];

const ISSUE_FIELDS = [
  { name: 'materialId', type: 'relation', label: 'Material', required: true, relation: MATERIAL_RELATION },
  { name: 'qty', type: 'number', label: 'Quantity', required: true, span: 'half', min: 0.001, step: 0.5, description: 'In the material’s unit. Stock falls by this much.' },
  { name: 'rate', type: 'money', label: 'Bill at (per unit)', span: 'half', placeholder: 'Its sell rate', description: 'Leave empty for the material’s sell rate.' },
  { name: 'isBillable', type: 'switch', label: 'Bill the customer for it', description: 'Off for material the company absorbs — it still costs the job.' },
];

/** `qty` with the unit, without float noise: 22, 1.5, 0.333. */
const qtyLabel = (qty, unit) => `${Number(qty.toFixed(3))} ${unit}`;

/**
 * Material issued to the job. Issuing takes it out of stock in the same step; reversing puts it
 * back (a RETURN movement). Both change the job's costing. Stock reaches a job only from here.
 */
export function JobMaterialsTab({ job, canWrite }) {
  const dispatch = useDispatch();
  const [params, setParams] = useState({});
  const [issuing, setIssuing] = useState(false);
  const [issue] = useIssueJobMaterialMutation();
  const [reverse] = useReverseJobMaterialMutation();
  const [confirm, confirmDialog] = useConfirm();
  const rows = job.materials ?? [];
  const editable = canWrite && !CLOSED.includes(job.status);

  const undo = async (row) => {
    const ok = await confirm({
      title: `Put ${qtyLabel(row.qty, row.material.unit)} of ${row.material.name} back in stock?`,
      description: 'The line leaves the job and a return is recorded against stock.',
      confirmLabel: 'Reverse',
      destructive: true,
    });
    if (!ok) return;
    try {
      await reverse({ id: job.id, jobMaterialId: row.id }).unwrap();
      dispatch(toastSuccess('Returned to stock'));
    } catch (err) {
      dispatch(toastError('Could not reverse the issue', err?.data?.error?.message));
    }
  };

  const columns = [
    {
      key: 'material', header: 'Material',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.material.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{r.material.code}</p>
        </div>
      ),
    },
    { key: 'qty', header: 'Quantity', className: 'text-right', cell: (r) => <span className="whitespace-nowrap tabular-nums">{qtyLabel(r.qty, r.material.unit)}</span> },
    { key: 'rate', header: 'Billed at', className: 'text-right', cell: (r) => <span className="tabular-nums">{formatNpr(r.rate)}</span> },
    { key: 'amount', header: 'Amount', className: 'text-right', cell: (r) => <span className="tabular-nums">{formatNpr(Math.round(r.qty * r.rate))}</span> },
    {
      key: 'isBillable', header: '',
      cell: (r) => (r.isBillable ? null : <StateBadge tone="muted">Not billed</StateBadge>),
    },
    { key: 'createdAt', header: 'Issued', cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span> },
  ];

  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        data={rows}
        meta={{ page: 1, pages: 1, total: rows.length, limit: rows.length || 1 }}
        params={params}
        onParamsChange={setParams}
        searchable={false}
        pageSizes={[]}
        rowActions={editable ? (r) => [{ label: 'Reverse — back to stock', icon: Undo2, destructive: true, onSelect: () => undo(r) }] : undefined}
        rowLabel={(r) => r.material.name}
        toolbar={editable ? <Button size="sm" onClick={() => setIssuing(true)}><PackageMinus /> Issue from stock</Button> : null}
        emptyTitle="No material issued"
        emptyDescription={editable ? 'Issue what the team takes to site — stock falls as you do.' : undefined}
      />
      <FormDialog
        open={issuing}
        onOpenChange={setIssuing}
        title={`Issue material to ${job.number}`}
        schema={jobMaterialSchema}
        fields={ISSUE_FIELDS}
        defaultValues={{ materialId: null, isBillable: true }}
        submitLabel="Issue"
        onSubmit={async (body) => {
          const line = await issue({ id: job.id, ...body }).unwrap();
          dispatch(toastSuccess(`${qtyLabel(line.qty, line.material.unit)} of ${line.material.name} issued`, 'Stock and costing are updated.'));
        }}
      />
      {confirmDialog}
    </div>
  );
}
