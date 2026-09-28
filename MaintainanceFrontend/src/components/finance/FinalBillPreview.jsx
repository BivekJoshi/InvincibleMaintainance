import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { StateBadge } from '@/components/common/StateBadge';
import { CONTRACT_TYPE_LABELS, INVOICE_KIND_LABELS } from '@/config/constants';
import { FINAL_BILL_BLOCKING } from '@/helpers/closeout';
import { formatNpr, formatSignedNpr } from '@/helpers/format';
import { formatQty } from '@/helpers/measurements';

const onePage = (rows) => ({ page: 1, pages: 1, total: rows.length, limit: rows.length || 1 });
const noop = () => {};
const money = (paisa) => (paisa === null || paisa === undefined ? '—' : <span className="whitespace-nowrap tabular-nums">{formatSignedNpr(paisa)}</span>);

const LINE_COLUMNS = [
  {
    key: 'description', header: 'Line',
    cell: (r) => (
      <span className="block max-w-sm">
        {r.description}
        {r.source === 'VARIATION' ? <StateBadge tone="info" className="ml-2 align-middle text-[10px]">Variation</StateBadge> : null}
      </span>
    ),
  },
  { key: 'qty', header: 'Qty', className: 'text-right', cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatQty(r.qty)}{r.unit ? ` ${r.unit}` : ''}</span> },
  { key: 'rate', header: 'Rate', className: 'text-right', cell: (r) => money(r.rate) },
  { key: 'amount', header: 'Amount', className: 'text-right', cell: (r) => <strong className="font-semibold">{money(r.amount)}</strong> },
];

const DEDUCTION_COLUMNS = [
  {
    key: 'number', header: 'Bill',
    cell: (r) => (
      <span className="whitespace-nowrap">
        <span className="font-mono text-xs">{r.number}</span>
        {r.kind ? <span className="ml-2 text-xs text-muted-foreground">{INVOICE_KIND_LABELS[r.kind] ?? r.kind}</span> : null}
      </span>
    ),
  },
  { key: 'taxable', header: 'Taxable', className: 'text-right', cell: (r) => money(r.taxable) },
  { key: 'vat', header: 'VAT', className: 'text-right', cell: (r) => money(r.vat) },
  { key: 'total', header: 'Total', className: 'text-right', cell: (r) => money(r.total) },
];

/** A discount is taken off: "− Rs. …" as the documents write it, the server's figure unchanged. */
const lessMoney = (paisa) => (paisa > 0 ? <span className="whitespace-nowrap tabular-nums">− {formatNpr(paisa)}</span> : money(paisa));

const TOTAL_COLUMNS = [
  { key: 'label', header: '', cell: (r) => <span className={r.emphasis ? 'font-semibold' : 'text-muted-foreground'}>{r.label}</span> },
  { key: 'contract', header: 'Contract', className: 'text-right', cell: (r) => (r.less ? lessMoney(r.contract) : money(r.contract)) },
  { key: 'billed', header: 'Billed before', className: 'text-right', cell: (r) => money(r.billed) },
  {
    key: 'due', header: 'This bill', className: 'text-right',
    cell: (r) => (r.due === null || r.due === undefined ? '—' : <strong className="font-semibold" data-testid={`final-due-${r.key}`}>{money(r.due)}</strong>),
  },
];

/**
 * The FINAL bill of a BOQ job **before it is raised** (Phase L8) — `GET /admin/jobs/:id/final-bill`, exactly what
 * `POST /admin/invoices/from-job/:jobId` will write: the contract type and the measurement's state, each line at the
 * quantity it bills (a LUMP_SUM job's quoted rows, provisional ones measured; an ITEM_RATE job's measured rows) with its
 * rate and amount, the earlier ADVANCE and RUNNING bills it deducts, and the totals — contract, billed before, this bill
 * (taxable, VAT, total). **Every figure is the server's**; nothing here is added up. What stops it (`blocking`) is said
 * first, a MEASUREMENT_INCOMPLETE one with its lines and the way to the job's BOQ & progress tab.
 *
 * @param {{ preview: object, jobId: string }} props  `preview`: the answer with `boq: true`
 */
export function FinalBillPreview({ preview, jobId }) {
  const lines = preview.lines ?? [];
  const deductions = preview.deductions ?? [];
  const blocking = preview.blocking ?? [];
  const t = preview.totals ?? {};
  const totals = [
    { key: 'subtotal', label: 'Subtotal', contract: t.contract?.subtotal, billed: null, due: null },
    { key: 'discount', label: 'Discount', contract: t.contract?.discount ?? 0, billed: null, due: null, less: true },
    { key: 'taxable', label: 'Taxable', contract: t.contract?.taxable, billed: t.billed?.taxable, due: t.due?.taxable },
    { key: 'vat', label: 'VAT', contract: t.contract?.vatAmount, billed: t.billed?.vat, due: t.due?.vat },
    { key: 'total', label: 'Total', contract: t.contract?.total, billed: t.billed?.total, due: t.due?.total, emphasis: true },
  ];

  return (
    <section className="space-y-4" aria-label="Final bill preview" data-testid="final-bill-preview">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StateBadge tone="info">{CONTRACT_TYPE_LABELS[preview.contractType] ?? preview.contractType}</StateBadge>
        {preview.measurementRequired ? (
          preview.measurementClosed
            ? <StateBadge tone="success">Measurement closed</StateBadge>
            : <StateBadge tone="warning">Measurement open</StateBadge>
        ) : <StateBadge tone="muted">No measurement needed</StateBadge>}
        <span className="text-xs text-muted-foreground">
          {preview.contractType === 'ITEM_RATE'
            ? 'Measured quantities at the quoted rates; each discount scaled to what was measured.'
            : 'The quoted quantities (a provisional line as measured), less the quotation’s and each variation’s discount.'}
        </span>
      </div>

      {blocking.length ? (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 p-3 text-sm" data-testid="final-bill-blocking">
          <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" aria-hidden /> It cannot be raised yet</p>
          <ul className="space-y-2">
            {blocking.map((b) => (
              <li key={b.code} data-code={b.code}>
                <p>{b.message || FINAL_BILL_BLOCKING[b.code] || b.code}</p>
                {b.code === 'MEASUREMENT_INCOMPLETE' ? (
                  <>
                    {b.details?.length ? (
                      <ul className="ml-4 list-disc text-xs text-muted-foreground">
                        {b.details.map((d) => <li key={d.lineId}>{[d.number, d.description].filter(Boolean).join(' · ')}</li>)}
                      </ul>
                    ) : null}
                    <Link to={`/admin/jobs/${jobId}?tab=progress`} className="text-xs font-medium underline underline-offset-2">Measure on the job’s BOQ &amp; progress tab</Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">What it bills</h3>
        <CustomTable
          columns={LINE_COLUMNS}
          data={lines}
          meta={onePage(lines)}
          params={{}}
          onParamsChange={noop}
          searchable={false}
          pageSizes={[]}
          rowLabel={(r) => r.description}
          getRowId={(r) => r.lineId}
          emptyTitle="No lines"
        />
      </div>

      {deductions.length ? (
        <div className="space-y-2" data-testid="final-bill-deductions">
          <h3 className="text-sm font-semibold">Deducted — billed before</h3>
          <CustomTable
            columns={DEDUCTION_COLUMNS}
            data={deductions}
            meta={onePage(deductions)}
            params={{}}
            onParamsChange={noop}
            searchable={false}
            pageSizes={[]}
            rowLabel={(r) => r.number}
            getRowId={(r) => r.invoiceId}
          />
        </div>
      ) : null}

      <div className="space-y-2" data-testid="final-bill-totals">
        <h3 className="text-sm font-semibold">Totals</h3>
        <CustomTable
          columns={TOTAL_COLUMNS}
          data={totals}
          meta={onePage(totals)}
          params={{}}
          onParamsChange={noop}
          searchable={false}
          pageSizes={[]}
          rowLabel={(r) => r.label}
          getRowId={(r) => r.key}
        />
      </div>
    </section>
  );
}
