import { useController } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/helpers/utils';
import { FormField } from '../FormField';

/**
 * `{ type: 'objectList', itemFields: [{ name, label, type?: 'text'|'select', options?, placeholder?, className? }],
 *    addLabel?, maxItems?, itemLabel? }` — an ordered JSON array of small objects, one row each:
 * the hero's trust badges (`{ icon, label }`), the counters (`{ value, label }`). Rows move
 * up and down and are removed; a row left completely empty is dropped on save. Validation runs
 * before that, so the schema should drop blank rows itself (`z.preprocess`, as the settings
 * form does) — otherwise a row added and left empty blocks the save.
 *
 * A select option may be `{ value, label }` with a JSX label, as the icon picker's are.
 */
export function ObjectListField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const rows = Array.isArray(input.value) ? input.value : [];
  const full = field.maxItems != null && rows.length >= field.maxItems;
  const itemLabel = field.itemLabel ?? 'Row';
  const blank = () => Object.fromEntries(field.itemFields.map((f) => [f.name, '']));

  const update = (next) => { input.onChange(next); input.onBlur(); };
  const setCell = (i, name, value) => input.onChange(rows.map((r, j) => (j === i ? { ...r, [name]: value } : r)));
  const move = (from, to) => {
    const next = [...rows];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    update(next);
  };
  const errorOf = (i, name) => fieldState.error?.[i]?.[name]?.message;

  return (
    <FormField id={id} field={field} error={fieldState.error?.message ? fieldState.error : undefined} as="fieldset">
      {() => (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-wrap items-start gap-1.5 sm:flex-nowrap">
              {field.itemFields.map((f, k) => {
                const label = `${f.label} ${i + 1}`;
                const error = errorOf(i, f.name);
                return (
                  <div key={f.name} className={cn('min-w-0 flex-1 space-y-1', f.className)}>
                    {f.type === 'select' ? (
                      <Select value={row?.[f.name] ? String(row[f.name]) : undefined} onValueChange={(v) => setCell(i, f.name, v)} disabled={field.disabled}>
                        <SelectTrigger ref={i === 0 && k === 0 ? input.ref : undefined} aria-label={label} aria-invalid={error ? true : undefined}>
                          <SelectValue placeholder={f.placeholder ?? f.label} />
                        </SelectTrigger>
                        <SelectContent>
                          {f.options.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        ref={i === 0 && k === 0 ? input.ref : undefined}
                        value={row?.[f.name] ?? ''}
                        disabled={field.disabled}
                        placeholder={f.placeholder ?? f.label}
                        aria-label={label}
                        aria-invalid={error ? true : undefined}
                        maxLength={f.maxLength}
                        onChange={(e) => setCell(i, f.name, e.target.value)}
                        onBlur={input.onBlur}
                      />
                    )}
                    {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
                  </div>
                );
              })}
              <div className="flex shrink-0 items-center">
                <Button type="button" variant="ghost" size="icon" className="h-9 w-8" disabled={field.disabled || i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${itemLabel.toLowerCase()} ${i + 1} up`}>
                  <ArrowUp aria-hidden />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-8" disabled={field.disabled || i === rows.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${itemLabel.toLowerCase()} ${i + 1} down`}>
                  <ArrowDown aria-hidden />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-8" disabled={field.disabled} onClick={() => update(rows.filter((_, j) => j !== i))} aria-label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`}>
                  <X aria-hidden />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" disabled={field.disabled || full} onClick={() => update([...rows, blank()])}>
            <Plus aria-hidden /> {field.addLabel ?? `Add ${itemLabel.toLowerCase()}`}
          </Button>
        </div>
      )}
    </FormField>
  );
}
