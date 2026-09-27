import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { EditableGrid } from '@/components/common/EditableGrid/EditableGrid';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { RECIPE_COMPONENT_LABELS, SURVEY_ITEM_KINDS } from '@/config/constants';
import { boqRowDetailsSchema, measurementSheetFormSchema } from '@/form/schemas/quotation.schema';
import { formatDateTime, formatNpr, titleCase } from '@/helpers/format';
import { formatQty } from '@/helpers/measurements';
import { ResourceForm } from '../ResourceForm';

/**
 * The BOQ row drawers (Phase L3) — the measurement sheet, the frozen recipe and the row's details — opened from
 * a row's actions in the `lineItems` field. Each is its own small form in a sheet. A submit inside one must not
 * reach the builder's form around it: React bubbles events through a portal, so `Isolated` stops them.
 */
function Isolated({ children }) {
  const stop = (e) => e.stopPropagation();
  return <div onSubmit={stop} onKeyDown={stop} onPaste={stop}>{children}</div>;
}

const rowName = (number, row) => [number, row?.description].filter(Boolean).join(' · ') || 'this row';

/**
 * The measurement sheet of one row: a `measurements` field in a sheet. "Use these measurements" puts the rows
 * on the line (the server works out its quantity); an empty sheet goes back to a typed quantity.
 */
export function MeasurementDrawer({ row, number, readOnly, onApply, onClose }) {
  return (
    <Isolated>
      <ResourceForm
        mode="sheet"
        open
        onOpenChange={(open) => { if (!open) onClose(); }}
        title={`Measurement sheet — ${rowName(number, row)}`}
        description={readOnly
          ? 'How the quantity was measured.'
          : 'One row per wall, floor or opening. The line’s quantity comes from these rows once you save the quotation.'}
        schema={measurementSheetFormSchema}
        fields={[{ name: 'measurements', type: 'measurements', label: 'Measurements', unit: row?.unit || undefined }]}
        defaultValues={{ measurements: row?.measurements ?? [] }}
        readOnly={readOnly}
        guard={false}
        submitLabel="Use these measurements"
        onSubmit={async (body) => {
          onApply(body.measurements);
          onClose();
        }}
      />
    </Isolated>
  );
}

const DETAIL_FIELDS = {
  ITEM: [
    { name: 'description', type: 'text', label: 'Description', required: true, maxLength: 500 },
    { name: 'spec', type: 'textarea', label: 'Specification', rows: 5, description: 'Printed under the row on the customer’s copy — materials, brand, method.' },
    {
      name: 'kind', type: 'select', label: 'Kind', span: 'half', noneLabel: 'Not set',
      options: SURVEY_ITEM_KINDS.map((k) => ({ value: k, label: titleCase(k) })),
    },
    { name: 'isOptional', type: 'switch', label: 'Optional — shown to the customer, not in the total', span: 'half' },
    { name: 'isProvisional', type: 'switch', label: 'Provisional — a figure settled by measurement later', span: 'half' },
  ],
  SECTION: [
    { name: 'description', type: 'text', label: 'Section title', required: true, maxLength: 500 },
    { name: 'spec', type: 'textarea', label: 'Note under the title', rows: 3 },
  ],
  NOTE: [
    { name: 'description', type: 'textarea', label: 'Note', required: true, rows: 4 },
  ],
};

/** A row's words and flags: its specification, kind, optional and provisional. */
export function DetailsDrawer({ row, number, readOnly, onApply, onClose }) {
  const type = row?.rowType ?? 'ITEM';
  return (
    <Isolated>
      <ResourceForm
        mode="sheet"
        open
        onOpenChange={(open) => { if (!open) onClose(); }}
        title={`${type === 'SECTION' ? 'Section' : type === 'NOTE' ? 'Note' : 'Row'} — ${rowName(number, row)}`}
        schema={boqRowDetailsSchema}
        fields={DETAIL_FIELDS[type]}
        defaultValues={{
          description: row?.description ?? '', spec: row?.spec ?? '', kind: row?.kind ?? undefined,
          isOptional: Boolean(row?.isOptional), isProvisional: Boolean(row?.isProvisional),
        }}
        readOnly={readOnly}
        guard={false}
        submitLabel="Apply"
        onSubmit={async (body) => {
          onApply(type === 'ITEM' ? body : { description: body.description, spec: body.spec ?? '' });
          onClose();
        }}
      />
    </Isolated>
  );
}

const q3 = (n) => Math.round(n * 1000) / 1000;
const UNIT_OF = { LABOUR: 'man-days' };

/**
 * The recipe frozen on a row (L-D1) — read-only. Quantities for everyone: per the recipe's quantity and for
 * this row's billed quantity (quantity maths only). Cost, overhead, profit and the unit cost only with
 * `costCapability` — the API strips them for anyone else anyway.
 */
export function RecipeDrawer({ row, number, recipe, billedQty, costCapability, onClose }) {
  const { can } = useAuth();
  const showCost = Boolean(costCapability) && can(costCapability);
  const perQty = Number(recipe?.recipeQty) > 0 ? Number(recipe.recipeQty) : 1;
  const scale = Number(billedQty) > 0 ? Number(billedQty) / perQty : null;

  const columns = useMemo(() => [
    { key: 'kind', header: 'Kind', width: 96, format: (v) => RECIPE_COMPONENT_LABELS[v] ?? titleCase(v ?? '') },
    { key: 'description', header: 'What', grow: 1, minWidth: 180 },
    { key: 'qty', header: `Per ${formatQty(perQty)} ${row?.unit ?? ''}`.trim(), width: 110, align: 'right', format: (v) => formatQty(v) },
    { key: 'unit', header: 'Unit', width: 88, get: (c) => c.unit ?? UNIT_OF[c.kind] ?? '' },
    { key: 'wastagePct', header: 'Wastage %', width: 84, align: 'right', format: (v) => (v ? formatQty(v) : '') },
    {
      key: 'forRow', header: 'For this row', width: 110, align: 'right',
      get: (c) => (scale == null ? null : q3(Number(c.qty) * scale * (1 + Number(c.wastagePct || 0) / 100))),
      format: (v) => (v == null ? '—' : formatQty(v)),
    },
    ...(showCost ? [{ key: 'cost', header: 'Cost / unit', width: 110, align: 'right', format: (v) => (v == null ? '—' : formatNpr(v)) }] : []),
  ], [perQty, row?.unit, scale, showCost]);

  return (
    <Isolated>
      <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>Recipe — {rowName(number, row)}</SheetTitle>
            <SheetDescription>
              {recipe
                ? `${recipe.code ? `${recipe.code} · ` : ''}${recipe.name ?? ''} — frozen ${recipe.takenAt ? formatDateTime(recipe.takenAt) : 'when the row was first saved'}. A change in the library reaches it only through “Reprice from the library”.`
                : 'This row has no recipe.'}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {recipe?.components?.length ? (
              <>
                <EditableGrid
                  ariaLabel="Recipe"
                  readOnly
                  columns={columns}
                  rows={recipe.components}
                  maxHeight="22rem"
                />
                <p className="text-xs text-muted-foreground">
                  Quantities are for {formatQty(perQty)} {row?.unit ?? 'units'} of the work
                  {scale == null ? '. Save the row to see what its quantity needs.' : `; this row bills ${formatQty(billedQty)} ${row?.unit ?? ''}.`}
                  {' '}The Take-off tab adds them up across the quotation.
                </p>
                {showCost ? (
                  <dl className="grid gap-x-6 gap-y-1 rounded-md border p-3 text-sm sm:grid-cols-3">
                    <div><dt className="text-xs text-muted-foreground">Overhead</dt><dd className="tabular-nums">{recipe.overheadPct ?? '—'}%</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Profit</dt><dd className="tabular-nums">{recipe.profitPct ?? '—'}%</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Unit cost</dt><dd className="tabular-nums">{recipe.unitCost == null ? '—' : formatNpr(recipe.unitCost)}</dd></div>
                  </dl>
                ) : null}
                {showCost && recipe.complete === false ? (
                  <p className="flex gap-2 rounded-md surface-warning p-2 text-xs">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    A line of this recipe had no price when it was frozen, so the row’s cost is not complete.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {row?.rateCardItemId
                  ? 'Its library item has no recipe, so the take-off has nothing for it.'
                  : 'It was typed, not priced from the rate library, so it has no recipe and adds nothing to the take-off.'}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Isolated>
  );
}
