import { useController, useWatch } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RecordCombobox } from '@/components/common/RecordCombobox';
import { useAuth } from '@/hooks/useAuth';
import { RECIPE_COMPONENT_LABELS } from '@/config/constants';
import { RECIPE_SECTIONS, blankRecipeRow, isPriced, sortRecipeRows } from '@/helpers/recipe';
import { cn } from '@/helpers/utils';
import { FormField } from '../FormField';

const codeName = (r) => (r ? `${r.code} · ${r.name}` : '');
const materialOption = (r) => `${codeName(r)} (${r.unit})`;
/** What a line keeps of the record it names, for its label and unit — never a price. */
const materialOf = (r) => (r ? { id: r.id, code: r.code, name: r.name, unit: r.unit, packSize: r.packSize ?? null, packLabel: r.packLabel ?? null } : null);
const tradeOf = (r) => (r ? { id: r.id, code: r.code, name: r.name } : null);

/** "bag = 50 kg": how a material is bought, when its pack is known. */
const packHint = (m) => (m?.packSize && m?.packLabel ? `${m.packLabel} = ${Number(m.packSize)} ${m.unit}` : null);

function CellError({ message }) {
  return message ? <p className="text-xs font-medium text-destructive">{message}</p> : null;
}

/** A number input with its unit after it (`kg`, `man-days`, `%`). */
function QtyInput({ value, onChange, onBlur, label, suffix, disabled, error, className, inputRef }) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Input
        ref={inputRef}
        type="number" min="0" step="any" inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        className="h-9 w-24 text-right tabular-nums"
      />
      {suffix ? <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span> : null}
    </div>
  );
}

/**
 * `{ type: 'recipe', materials: { path }, trades: { path }, costCapability?, per?: { qty, unit } }` — a
 * rate-library item's recipe (Phase L2): what `recipeQty` units of the work need, in three sections —
 * **Materials** (a material, its quantity in the material's own unit, wastage %), **Labour** (a trade and
 * man-days) and **Equipment & other** (what it is, a quantity and a cost per unit in rupees).
 *
 * The value is one array of lines (the API's `components`), kept grouped by section; a line left empty is
 * dropped on save. A line shows its material or trade from the record it carries, so a reader who may not
 * list materials still sees names. The cost inputs render only for `costCapability` (`costs:read`) — the
 * API strips them for everyone else. Nothing here prices a line: the rate form's Cost vs rate card asks
 * the server (`POST /admin/rate-card/derive`).
 */
export function RecipeField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const { can } = useAuth();
  const showCost = !field.costCapability || can(field.costCapability);
  const rows = Array.isArray(input.value) ? input.value : [];
  const disabled = field.disabled;
  const [perQty, perUnit] = useWatch({ name: [field.per?.qty ?? '__none', field.per?.unit ?? '__none'] });

  const update = (next) => { input.onChange(sortRecipeRows(next)); input.onBlur(); };
  const setRow = (i, patch) => input.onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i) => update(rows.filter((_, j) => j !== i));
  const errorOf = (i, name) => fieldState.error?.[i]?.[name]?.message;
  const listError = fieldState.error?.message ?? fieldState.error?.root?.message;
  const full = rows.length >= (field.maxItems ?? 40);
  let firstInput = true;
  /** The first control takes the field's ref, so a failed save can focus it. */
  const refFor = () => {
    if (!firstInput) return undefined;
    firstInput = false;
    return input.ref;
  };

  return (
    <FormField id={id} field={field} error={listError ? { message: listError } : undefined} as="fieldset">
      {() => (
        <div className="space-y-5">
          {field.per && Number(perQty) > 0 && perUnit ? (
            <p className="text-sm text-muted-foreground">
              Quantities below make <span className="font-medium text-foreground tabular-nums">{Number(perQty)} {perUnit}</span> of the work.
            </p>
          ) : null}
          {RECIPE_SECTIONS.map((section) => {
            const lines = rows.map((row, i) => ({ row, i })).filter(({ row }) => section.kinds.includes(row?.kind));
            return (
              <div key={section.key} className="space-y-2">
                <h4 className="text-sm font-semibold">{section.title}</h4>
                {lines.length ? null : <p className="text-sm text-muted-foreground">{section.empty}</p>}
                {lines.map(({ row, i }, n) => {
                  const label = section.key === 'materials' ? `Material ${n + 1}` : section.key === 'labour' ? `Labour ${n + 1}` : `Equipment or other ${n + 1}`;
                  return (
                    <div key={i} className="space-y-1 rounded-md border p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {row.kind === 'MATERIAL' ? (
                          <>
                            <RecordCombobox
                              {...field.materials}
                              labelKey={materialOption}
                              value={row.materialId ?? null}
                              selectedLabel={row.material ? materialOption(row.material) : undefined}
                              onChange={(value, record) => setRow(i, { materialId: value ?? null, material: value ? materialOf(record) ?? row.material : null })}
                              placeholder="Choose a material…"
                              searchPlaceholder="Search code or name…"
                              clearable={false}
                              disabled={disabled}
                              aria-label={label}
                              aria-invalid={errorOf(i, 'materialId') ? true : undefined}
                              className="min-w-[220px] flex-1"
                            />
                            <QtyInput
                              inputRef={refFor()}
                              value={row.qty} onChange={(v) => setRow(i, { qty: v })} onBlur={input.onBlur}
                              label={`Quantity of ${label.toLowerCase()}`} suffix={row.material?.unit ?? 'units'}
                              disabled={disabled} error={errorOf(i, 'qty')}
                            />
                            <QtyInput
                              value={row.wastagePct} onChange={(v) => setRow(i, { wastagePct: v })} onBlur={input.onBlur}
                              label={`Wastage % for ${label.toLowerCase()}`} suffix="% wastage"
                              disabled={disabled} error={errorOf(i, 'wastagePct')}
                            />
                          </>
                        ) : row.kind === 'LABOUR' ? (
                          <>
                            <RecordCombobox
                              {...field.trades}
                              labelKey={codeName}
                              value={row.tradeId ?? null}
                              selectedLabel={row.trade ? codeName(row.trade) : undefined}
                              onChange={(value, record) => setRow(i, { tradeId: value ?? null, trade: value ? tradeOf(record) ?? row.trade : null })}
                              placeholder="Choose a trade…"
                              searchPlaceholder="Search trades…"
                              clearable={false}
                              disabled={disabled}
                              aria-label={label}
                              aria-invalid={errorOf(i, 'tradeId') ? true : undefined}
                              className="min-w-[220px] flex-1"
                            />
                            <QtyInput
                              inputRef={refFor()}
                              value={row.qty} onChange={(v) => setRow(i, { qty: v })} onBlur={input.onBlur}
                              label={`Man-days for ${label.toLowerCase()}`} suffix="man-days"
                              disabled={disabled} error={errorOf(i, 'qty')}
                            />
                          </>
                        ) : (
                          <>
                            <Select value={row.kind} onValueChange={(kind) => setRow(i, { kind })} disabled={disabled}>
                              <SelectTrigger className="h-9 w-36" aria-label={`Kind of ${label.toLowerCase()}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {section.kinds.map((k) => <SelectItem key={k} value={k}>{RECIPE_COMPONENT_LABELS[k]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input
                              ref={refFor()}
                              value={row.description ?? ''}
                              onChange={(e) => setRow(i, { description: e.target.value })}
                              onBlur={input.onBlur}
                              placeholder="Scaffolding, mixer hire, transport…"
                              maxLength={200}
                              disabled={disabled}
                              aria-label={`What ${label.toLowerCase()} is`}
                              aria-invalid={errorOf(i, 'description') ? true : undefined}
                              className="h-9 min-w-[180px] flex-1"
                            />
                            <QtyInput
                              value={row.qty} onChange={(v) => setRow(i, { qty: v })} onBlur={input.onBlur}
                              label={`Quantity of ${label.toLowerCase()}`} suffix={row.kind === 'EQUIPMENT' ? 'units' : 'lump'}
                              disabled={disabled} error={errorOf(i, 'qty')}
                            />
                            {showCost && isPriced(row.kind) ? (
                              <div className="relative">
                                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" aria-hidden>Rs.</span>
                                <Input
                                  inputMode="decimal"
                                  value={row.cost ?? ''}
                                  onChange={(e) => setRow(i, { cost: e.target.value })}
                                  onBlur={input.onBlur}
                                  disabled={disabled}
                                  placeholder="per unit"
                                  aria-label={`Cost per unit of ${label.toLowerCase()} (Rs)`}
                                  aria-invalid={errorOf(i, 'cost') ? true : undefined}
                                  className="h-9 w-32 pl-9 text-right tabular-nums"
                                />
                              </div>
                            ) : null}
                          </>
                        )}
                        <Button
                          type="button" variant="ghost" size="icon" className="h-9 w-8 shrink-0"
                          disabled={disabled} onClick={() => remove(i)} aria-label={`Remove ${label.toLowerCase()}`}
                        >
                          <X aria-hidden />
                        </Button>
                      </div>
                      {row.kind === 'MATERIAL' && packHint(row.material) ? (
                        <p className="text-xs text-muted-foreground">Bought as {packHint(row.material)}</p>
                      ) : null}
                      <CellError message={errorOf(i, 'materialId') ?? errorOf(i, 'tradeId') ?? errorOf(i, 'description')} />
                      <CellError message={errorOf(i, 'qty') ?? errorOf(i, 'wastagePct') ?? errorOf(i, 'cost')} />
                    </div>
                  );
                })}
                <Button
                  type="button" variant="outline" size="sm" disabled={disabled || full}
                  onClick={() => update([...rows, blankRecipeRow(section.kinds[0])])}
                >
                  <Plus aria-hidden /> {section.addLabel}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </FormField>
  );
}
