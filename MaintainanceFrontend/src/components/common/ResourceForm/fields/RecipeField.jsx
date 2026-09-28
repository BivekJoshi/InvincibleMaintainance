import { useCallback, useMemo, useRef } from 'react';
import { useController, useWatch } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { EditableGrid } from '@/components/common/EditableGrid/EditableGrid';
import { RecordCombobox } from '@/components/common/RecordCombobox';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { RECIPE_COMPONENT_KINDS, RECIPE_COMPONENT_LABELS } from '@/config/constants';
import { RECIPE_SECTIONS, blankRecipeRow, isPriced, sortRecipeRows } from '@/helpers/recipe';
import { formatRupees } from '@/helpers/format';
import { formatQty } from '@/helpers/measurements';
import { FormField } from '../FormField';
import { useFormMode } from '../formMode';
import { cellMessages } from './cellMessages';

const codeName = (r) => (r ? `${r.code} · ${r.name}` : '');
const materialOption = (r) => `${codeName(r)} (${r.unit})`;
/** What a line keeps of the record it names, for its label and unit — never a price. */
const materialOf = (r) => (r ? { id: r.id, code: r.code, name: r.name, unit: r.unit, packSize: r.packSize ?? null, packLabel: r.packLabel ?? null } : null);
const tradeOf = (r) => (r ? { id: r.id, code: r.code, name: r.name } : null);
/** "bag = 50 kg": how a material is bought, when its pack is known. */
const packHint = (m) => (m?.packSize && m?.packLabel ? `${m.packLabel} = ${Number(m.packSize)} ${m.unit}` : null);
const numberCell = (v) => (typeof v === 'number' ? formatQty(v) : v ?? '');
const KIND_OPTIONS = RECIPE_COMPONENT_KINDS.map((k) => ({ value: k, label: RECIPE_COMPONENT_LABELS[k] }));
const SECTION_OF = Object.fromEntries(RECIPE_SECTIONS.flatMap((s) => s.kinds.map((k) => [k, s.key])));
const NOUN = { materials: 'material', labour: 'labour', other: 'equipment or other' };
const rowHeight = (row) => (row.kind === 'MATERIAL' && packHint(row.material) ? 52 : 36);

/**
 * `{ type: 'recipe', materials: { path }, trades: { path }, costCapability?, per?: { qty, unit } }` — a
 * rate-library item's recipe (Phase L2, on the EditableGrid since L3): what `recipeQty` units of the work need —
 * **materials** (a material, its quantity in the material's own unit, wastage %), **labour** (a trade and
 * man-days) and **equipment & other** (what it is, a quantity and a cost per unit in rupees).
 *
 * The value is one array of lines (the API's `components`), kept grouped by section; a line left empty is
 * dropped on save. A line shows its material or trade from the record it carries, so a reader who may not
 * list materials still sees names. The cost column renders only for `costCapability` (`costs:read`) — the API
 * strips it for everyone else. Nothing here prices a line: the rate form's Cost vs rate card asks the server.
 */
export function RecipeField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const { can } = useAuth();
  const { readOnly: formReadOnly } = useFormMode();
  const showCost = !field.costCapability || can(field.costCapability);
  const rows = Array.isArray(input.value) ? input.value : [];
  const readOnly = Boolean(field.disabled || formReadOnly);
  const [perQty, perUnit] = useWatch({ name: [field.per?.qty ?? '__none', field.per?.unit ?? '__none'] });
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const gridApi = useRef(null);
  const { materials, trades } = field;

  /** "Material 1", "Labour 2": a line's name by its place in its section. */
  const lineName = useCallback((row) => {
    const section = SECTION_OF[row?.kind] ?? 'other';
    const n = rowsRef.current.filter((r) => SECTION_OF[r?.kind] === section).indexOf(row) + 1;
    const noun = NOUN[section];
    return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${n || 1}`;
  }, []);

  const columns = useMemo(() => [
    {
      key: 'item', header: 'What', grow: 1, minWidth: 240, wrap: true,
      editor: (row) => (row?.kind === 'MATERIAL' || row?.kind === 'LABOUR' ? 'custom' : 'text'),
      get: (row) => (row.kind === 'MATERIAL' ? row.materialId : row.kind === 'LABOUR' ? row.tradeId : row.description),
      set: (row, value) => (row.kind === 'MATERIAL' || row.kind === 'LABOUR' ? { ...row, ...value } : { ...row, description: value }),
      toText: (_v, row) => row.description ?? '',
      maxLength: 200,
      placeholder: (row) => (row.kind === 'MATERIAL' ? 'Choose a material' : row.kind === 'LABOUR' ? 'Choose a trade' : 'Scaffolding, mixer hire, transport…'),
      label: (row) => (row.kind === 'MATERIAL' || row.kind === 'LABOUR' ? lineName(row) : `What ${lineName(row).toLowerCase()} is`),
      format: (_v, row) => {
        if (row.kind === 'MATERIAL') {
          return (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate">{row.material ? materialOption(row.material) : ''}</span>
              {packHint(row.material) ? <span className="truncate text-xs text-muted-foreground">Bought as {packHint(row.material)}</span> : null}
            </span>
          );
        }
        if (row.kind === 'LABOUR') return <span className="truncate">{row.trade ? codeName(row.trade) : ''}</span>;
        return <span className="truncate">{row.description}</span>;
      },
      renderEditor: ({ row, commit, cancel, label, draft }) => {
        const material = row.kind === 'MATERIAL';
        return (
          <RecordCombobox
            {...(material ? materials : trades)}
            labelKey={material ? materialOption : codeName}
            value={(material ? row.materialId : row.tradeId) ?? null}
            selectedLabel={material ? (row.material ? materialOption(row.material) : undefined) : (row.trade ? codeName(row.trade) : undefined)}
            onChange={(value, record) => commit(material
              ? { materialId: value ?? null, material: value ? materialOf(record) ?? row.material : null }
              : { tradeId: value ?? null, trade: value ? tradeOf(record) ?? row.trade : null })}
            onOpenChange={(open) => { if (!open) cancel(); }}
            defaultOpen
            returnFocus={false}
            defaultSearch={draft ?? ''}
            placeholder={material ? 'Choose a material…' : 'Choose a trade…'}
            searchPlaceholder={material ? 'Search code or name…' : 'Search trades…'}
            clearable={false}
            aria-label={label}
            className="h-full w-full"
          />
        );
      },
    },
    {
      key: 'kind', header: 'Kind', width: 112, editor: 'select', options: KIND_OPTIONS,
      format: (v) => RECIPE_COMPONENT_LABELS[v] ?? v,
      set: (row, kind) => (kind === row.kind ? row : { ...blankRecipeRow(kind), qty: row.qty }),
      label: (row) => `Kind of ${lineName(row).toLowerCase()}`,
    },
    {
      key: 'qty', header: 'Quantity', width: 100, editor: 'number', align: 'right', format: numberCell,
      label: (row) => (row.kind === 'LABOUR' ? `Man-days for ${lineName(row).toLowerCase()}` : `Quantity of ${lineName(row).toLowerCase()}`),
    },
    {
      key: 'unit', header: 'Unit', width: 96,
      get: (row) => (row.kind === 'MATERIAL' ? (row.material?.unit ?? 'units') : row.kind === 'LABOUR' ? 'man-days' : row.kind === 'EQUIPMENT' ? 'units' : 'lump'),
    },
    {
      key: 'wastagePct', header: 'Wastage %', width: 92, editor: 'number', align: 'right',
      editable: (row) => row.kind === 'MATERIAL',
      format: (v, row) => (row.kind === 'MATERIAL' ? numberCell(v) : ''),
      label: (row) => `Wastage % for ${lineName(row).toLowerCase()}`,
    },
    ...(showCost ? [{
      key: 'cost', header: 'Cost / unit (Rs)', width: 132, editor: 'money', align: 'right',
      editable: (row) => isPriced(row.kind),
      format: (v, row) => (isPriced(row.kind) ? (typeof v === 'number' ? formatRupees(v) : v ?? '') : ''),
      label: (row) => `Cost per unit of ${lineName(row).toLowerCase()} (Rs)`,
    }] : []),
  ], [materials, trades, showCost, lineName]);

  const error = fieldState.error;
  const listError = error?.message ?? error?.root?.message;
  const rowErrors = useCallback((i) => cellMessages(error?.[i], { materialId: 'item', tradeId: 'item', description: 'item' }), [error]);
  const full = rows.length >= (field.maxItems ?? 40);

  const update = (next) => {
    input.onChange(next);
    input.onBlur();
  };
  /** A new line of a kind, placed at the end of its section, and selected. */
  const addLine = (kind) => {
    const row = blankRecipeRow(kind);
    const next = sortRecipeRows([...rows, row]);
    update(next);
    gridApi.current?.focusCell(next.indexOf(row), 'item');
  };
  // Ctrl+Enter adds a line of the kind it follows, so the sections stay together.
  const makeRow = useCallback((_kind, after) => blankRecipeRow(after?.kind ?? 'MATERIAL'), []);

  return (
    <FormField id={id} field={field} error={listError ? { message: listError } : undefined} as="fieldset">
      {() => (
        <div className="space-y-2">
          {field.per && Number(perQty) > 0 && perUnit ? (
            <p className="text-sm text-muted-foreground">
              Quantities below make <span className="font-medium text-foreground tabular-nums">{Number(perQty)} {perUnit}</span> of the work.
            </p>
          ) : null}
          <EditableGrid
            ariaLabel={field.label ?? 'Recipe'}
            columns={columns}
            rows={rows}
            onChange={update}
            makeRow={makeRow}
            kinds={['item']}
            addLabels={{ item: null }}
            readOnly={readOnly}
            maxRows={field.maxItems ?? 40}
            rowErrors={rowErrors}
            rowHeight={rowHeight}
            focusRef={input.ref}
            apiRef={gridApi}
            maxHeight="26rem"
            emptyText="No lines yet — add the materials, labour and other costs one unit of this work needs."
            toolbarExtra={readOnly ? null : (
              <>
                {RECIPE_SECTIONS.map((s) => (
                  <Button key={s.key} type="button" variant="outline" size="sm" disabled={full} onClick={() => addLine(s.kinds[0])}>
                    <Plus aria-hidden /> {s.addLabel}
                  </Button>
                ))}
              </>
            )}
          />
        </div>
      )}
    </FormField>
  );
}
