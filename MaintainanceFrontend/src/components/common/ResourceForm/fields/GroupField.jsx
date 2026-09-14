import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/helpers/utils';
import { flattenFields } from '../formValues';

/**
 * `{ type: 'group', label, description?, defaultOpen?, fields: [...] }` — a collapsible
 * section, e.g. SEO. It opens by itself when a field inside it has an error, so a
 * failed save never hides the reason in a closed section. Collapsed fields keep
 * their values.
 */
export function GroupField({ field, children }) {
  const { formState: { errors } } = useFormContext();
  const [open, setOpen] = useState(field.defaultOpen ?? false);
  const hasError = flattenFields(field.fields).some((f) => errors[f.name]);
  const isOpen = open || hasError;

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted/40">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{field.label}</span>
            {field.description ? <span className="block text-xs text-muted-foreground">{field.description}</span> : null}
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none', isOpen && 'rotate-180')} aria-hidden />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-4 py-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
