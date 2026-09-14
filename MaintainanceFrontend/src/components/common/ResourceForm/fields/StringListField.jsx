import { useController } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormField } from '../FormField';

/**
 * `{ type: 'stringList', addLabel?, maxItems? }` — an ordered JSON array of strings:
 * a service's bullets, a plan's inclusions. Enter adds a line below; an emptied line
 * disappears when it loses focus, and blank lines are dropped on save.
 */
export function StringListField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const items = Array.isArray(input.value) ? input.value : [];
  const full = field.maxItems != null && items.length >= field.maxItems;

  const update = (next) => input.onChange(next);
  const focusItem = (index) => requestAnimationFrame(() => document.getElementById(`${id}-${index}`)?.focus());
  const move = (from, to) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    update(next);
  };

  return (
    <FormField id={id} field={field} error={fieldState.error} as="fieldset">
      {(control) => (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                id={`${id}-${i}`}
                ref={i === 0 ? input.ref : undefined}
                value={item}
                disabled={field.disabled}
                aria-label={`${field.label ?? 'Item'} ${i + 1}`}
                aria-invalid={control['aria-invalid']}
                placeholder={field.placeholder}
                onChange={(e) => update(items.map((v, j) => (j === i ? e.target.value : v)))}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || full) return;
                  e.preventDefault();
                  update([...items.slice(0, i + 1), '', ...items.slice(i + 1)]);
                  focusItem(i + 1);
                }}
                onBlur={() => {
                  if (!String(item).trim()) update(items.filter((_, j) => j !== i));
                  input.onBlur();
                }}
              />
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move item ${i + 1} up`}>
                <ArrowUp aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={i === items.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move item ${i + 1} down`}>
                <ArrowDown aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => update(items.filter((_, j) => j !== i))} aria-label={`Remove item ${i + 1}`}>
                <X aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button" variant="outline" size="sm" disabled={field.disabled || full}
            onClick={() => { update([...items, '']); focusItem(items.length); }}
          >
            <Plus aria-hidden /> {field.addLabel ?? 'Add item'}
          </Button>
        </div>
      )}
    </FormField>
  );
}
