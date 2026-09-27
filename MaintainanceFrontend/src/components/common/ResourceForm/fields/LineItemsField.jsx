import { useCallback, useMemo, useState } from 'react';
import { useController } from 'react-hook-form';
import { FileText, Library, ListTree, Ruler } from 'lucide-react';
import { EditableGrid } from '@/components/common/EditableGrid/EditableGrid';
import { pastedBoqRows } from '@/components/common/EditableGrid/gridPaste';
import { RateLibrarySearch } from '@/components/rateLibrary/RateLibrarySearch';
import { UNITS } from '@/config/constants';
import {
  blankBoqRow, boqNumbers, duplicateBoqRow, isBlankBoqRow, newRowKey,
} from '@/helpers/boq';
import { formatNpr, formatRupees } from '@/helpers/format';
import { formatQty, isBlankMeasurement, measurementTotal } from '@/helpers/measurements';
import { cn } from '@/helpers/utils';
import { FormField } from '../FormField';
import { useFormMode } from '../formMode';
import { cellMessages } from './cellMessages';
import { DetailsDrawer, MeasurementDrawer, RecipeDrawer } from './LineItemsDrawers';

const isItem = (row) => (row?.rowType ?? 'ITEM') === 'ITEM';
const hasSheet = (row) => (row?.measurements ?? []).some((m) => !isBlankMeasurement(m));
const KIND_OF = { SECTION: 'section', NOTE: 'note' };
const rowKind = (row) => KIND_OF[row?.rowType] ?? 'item';
const getRowKey = (row) => row._key;
const rowHeight = (row) => (row.spec ? 52 : 36);
const makeRow = (kind) => blankBoqRow(kind === 'section' ? 'SECTION' : kind === 'note' ? 'NOTE' : 'ITEM');
const pasteRows = (text) => pastedBoqRows(text).map((r) => ({ ...blankBoqRow(r.rowType), ...r, _key: newRowKey() }));
const moneyCell = (v) => (typeof v === 'number' ? formatRupees(v) : v ?? '');
const qtyCell = (v) => (typeof v === 'number' ? formatQty(v) : v ?? '');

function Badge({ children, tone = 'muted' }) {
  return (
    <span className={cn(
      'shrink-0 rounded px-1 py-px text-[10px] font-semibold not-italic uppercase tracking-wide',
      tone === 'warning' ? 'surface-warning' : 'bg-muted text-muted-foreground',
    )}
    >
      {children}
    </span>
  );
}

/** The BOQ's columns. Kept static: what varies per row comes through the row and its server figures (`meta`). */
function boqColumns(openSheet) {
  return [
    {
      key: 'description', header: 'Description', grow: 3, minWidth: 240, editor: 'text', maxLength: 500, wrap: true,
      span: (row) => (row.rowType === 'SECTION' ? 5 : row.rowType === 'NOTE' ? 6 : 1),
      placeholder: (row) => (row.rowType === 'SECTION' ? 'Section title' : row.rowType === 'NOTE' ? 'A note for the customer' : 'What the customer is paying for'),
      label: (row, i) => `${row.rowType === 'SECTION' ? 'Section title' : row.rowType === 'NOTE' ? 'Note' : 'Description'}, row ${i + 1}`,
      format: (value, row) => (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="flex min-w-0 items-center gap-1.5">
            {row.rateCardItemId ? <Library className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="From the rate library" /> : null}
            <span className={cn('truncate', row.rowType === 'SECTION' && 'uppercase tracking-wide')}>{value}</span>
            {row.isOptional ? <Badge tone="warning">Optional</Badge> : null}
            {row.isProvisional ? <Badge>Provisional</Badge> : null}
          </span>
          {row.spec ? <span className="truncate text-xs font-normal text-muted-foreground">{row.spec}</span> : null}
        </span>
      ),
    },
    { key: 'unit', header: 'Unit', width: 84, editor: 'text', suggestions: UNITS, maxLength: 20, label: (_r, i) => `Unit, row ${i + 1}` },
    {
      key: 'qty', header: 'Qty', width: 104, editor: 'number', align: 'right', label: (_r, i) => `Quantity, row ${i + 1}`,
      editable: (row) => !hasSheet(row),
      onActivate: (row) => { if (hasSheet(row)) openSheet(row); },
      format: (value, row, { meta }) => (hasSheet(row) ? (
        <span className="inline-flex items-center gap-1" title="Measured — Enter opens the sheet">
          <Ruler className="h-3.5 w-3.5 text-primary" aria-label="Measured" />
          <span data-amount className={meta?.netQty == null ? 'italic text-muted-foreground' : undefined}>
            {formatQty(meta?.netQty ?? measurementTotal(row.measurements))}
          </span>
        </span>
      ) : qtyCell(value)),
    },
    { key: 'wastagePct', header: 'Waste %', width: 76, editor: 'number', align: 'right', label: (_r, i) => `Wastage %, row ${i + 1}`, format: qtyCell },
    { key: 'rate', header: 'Rate (Rs)', width: 118, editor: 'money', align: 'right', label: (_r, i) => `Rate, row ${i + 1}`, format: moneyCell },
    {
      key: 'amount', header: 'Amount', width: 132, align: 'right', get: () => null,
      format: (_v, row, { meta }) => {
        if (row.rowType === 'SECTION') return meta?.subtotal != null ? <span data-amount>{formatNpr(meta.subtotal)}</span> : '';
        if (row.rowType === 'NOTE') return '';
        if (meta?.amount == null) return <span className="text-muted-foreground">—</span>;
        return (
          <span data-amount className={row.isOptional ? 'text-muted-foreground' : undefined} title={row.isOptional ? 'Optional — not in the total' : undefined}>
            {row.isOptional ? `(${formatNpr(meta.amount)})` : formatNpr(meta.amount)}
          </span>
        );
      },
    },
    {
      key: 'isOptional', header: 'Optional', width: 72, editor: 'boolean', align: 'center', hidden: (row) => !isItem(row),
      label: (_r, i) => `Optional, row ${i + 1}`,
    },
  ];
}

/**
 * `{ type: 'lineItems', figures?, stale?, costCapability?, search?, maxItems?, gridLabel? }` — a quotation's bill of
 * quantities (Phase L3), on the kit's EditableGrid: ITEM, SECTION and NOTE rows, rates in **rupees**, a quantity
 * typed or measured, wastage %, optional. The value is the builder's rows (`helpers/boq.js#toBoqRows`); the schema
 * turns them into the request's.
 *
 * The client adds up nothing. Numbers (A, A.1) follow the rows as the API numbers them; every **amount**,
 * section subtotal and measured quantity is the server's — `figures`, a Map of row key → the saved rows' or the
 * live preview's figures, which the builder passes in (`stale` dims them while a new preview is on its way).
 *
 * Rows: `/` searches the rate library (`RateLibrarySearch`), a paste from Excel adds rows, and each row's
 * actions open its **measurement sheet** (Ctrl+M), its frozen **recipe** (cost only for `costCapability`) and
 * its **details** (specification, kind, optional, provisional).
 */
export function LineItemsField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const { readOnly: formReadOnly } = useFormMode();
  const readOnly = Boolean(field.disabled || formReadOnly);
  const rows = useMemo(() => (Array.isArray(input.value) ? input.value : []), [input.value]);
  const numbers = useMemo(() => boqNumbers(rows), [rows]);
  const [drawer, setDrawer] = useState(null); // { kind: 'measure'|'recipe'|'details', key }
  const { figures } = field;

  const update = (next) => {
    input.onChange(next);
    input.onBlur();
  };
  const patchRow = (key, patch) => update(rows.map((r) => (r._key === key ? { ...r, ...patch } : r)));

  const columns = useMemo(() => boqColumns((row) => setDrawer({ kind: 'measure', key: row._key })), []);
  const error = fieldState.error;
  const listError = error?.message ?? error?.root?.message;
  const rowErrors = useCallback((i) => cellMessages(error?.[i], { measurements: 'qty' }), [error]);
  // While a newer preview is on its way a measured row shows its own sheet's total, not the last answer's.
  const { stale } = field;
  const rowMeta = useCallback((row) => {
    const fig = figures?.get(row._key);
    return stale && hasSheet(row) ? { ...fig, netQty: undefined } : fig;
  }, [figures, stale]);

  const rowActions = useCallback((row) => {
    const open = (kind) => () => setDrawer({ kind, key: row._key });
    if (!isItem(row)) return [{ label: 'Details…', icon: FileText, readOnly: true, onSelect: open('details') }];
    const recipe = figures?.get(row._key)?.recipe ?? row.recipe;
    return [
      { label: 'Measurement sheet…', icon: Ruler, shortcut: 'Ctrl+M', readOnly: true, onSelect: open('measure') },
      { label: 'Recipe…', icon: ListTree, readOnly: true, disabled: !recipe && !row.rateCardItemId, onSelect: open('recipe') },
      { label: 'Details…', icon: FileText, readOnly: true, onSelect: open('details') },
    ];
  }, [figures]);

  const shortcuts = useMemo(() => [{
    keys: 'Ctrl+M',
    does: 'Open the row’s measurement sheet',
    readOnly: true,
    match: (e) => (e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M'),
    run: (i) => {
      const row = input.value?.[i];
      if (row && isItem(row)) setDrawer({ kind: 'measure', key: row._key });
    },
  }], [input.value]);

  const search = useMemo(() => (field.search === false ? undefined : {
    label: 'From the library',
    focusKey: 'qty',
    render: (p) => <RateLibrarySearch {...p} />,
  }), [field.search]);

  const openRow = drawer ? rows.find((r) => r._key === drawer.key) : null;
  const openIndex = openRow ? rows.indexOf(openRow) : -1;
  const close = () => setDrawer(null);

  return (
    <FormField id={id} field={field} error={listError ? { message: listError } : undefined} as="fieldset">
      {() => (
        <>
          <EditableGrid
            ariaLabel={field.gridLabel ?? field.label ?? 'Bill of quantities'}
            columns={columns}
            rows={rows}
            onChange={update}
            getRowKey={getRowKey}
            numbers={numbers}
            rowKind={rowKind}
            makeRow={makeRow}
            kinds={['item', 'section', 'note']}
            duplicateRow={duplicateBoqRow}
            isBlankRow={isBlankBoqRow}
            paste={pasteRows}
            search={search}
            rowActions={rowActions}
            shortcuts={shortcuts}
            rowMeta={rowMeta}
            rowErrors={rowErrors}
            rowHeight={rowHeight}
            readOnly={readOnly}
            maxRows={field.maxItems ?? 500}
            focusRef={input.ref}
            maxHeight="36rem"
            className={field.stale ? '[&_[data-amount]]:opacity-50' : undefined}
            emptyText="No rows yet. Type to start, press / for the rate library, Ctrl+Shift+Enter for a section, or paste rows from Excel."
            addLabels={{ item: 'Add row', section: 'Add section', note: 'Add note' }}
            footer={(
              <p className="text-xs text-muted-foreground">
                Amounts are the server’s{field.stale ? ' — updating…' : '.'} An optional row shows its amount in brackets and is not in the total.
              </p>
            )}
          />
          {drawer?.kind === 'measure' && openRow ? (
            <MeasurementDrawer
              row={openRow}
              number={numbers[openIndex]}
              readOnly={readOnly}
              onClose={close}
              onApply={(measurements) => patchRow(openRow._key, measurements.length
                ? { measurements, qty: '' }
                : { measurements: null, qty: figures?.get(openRow._key)?.netQty ?? (hasSheet(openRow) ? measurementTotal(openRow.measurements) : openRow.qty) })}
            />
          ) : null}
          {drawer?.kind === 'details' && openRow ? (
            <DetailsDrawer row={openRow} number={numbers[openIndex]} readOnly={readOnly} onClose={close} onApply={(patch) => patchRow(openRow._key, patch)} />
          ) : null}
          {drawer?.kind === 'recipe' && openRow ? (
            <RecipeDrawer
              row={openRow}
              number={numbers[openIndex]}
              recipe={figures?.get(openRow._key)?.recipe ?? openRow.recipe ?? null}
              billedQty={figures?.get(openRow._key)?.qty}
              costCapability={field.costCapability}
              onClose={close}
            />
          ) : null}
        </>
      )}
    </FormField>
  );
}
