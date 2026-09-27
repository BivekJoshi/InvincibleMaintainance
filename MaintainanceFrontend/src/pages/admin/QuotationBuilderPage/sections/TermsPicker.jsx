import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFormContext } from 'react-hook-form';
import { BookText, ListPlus, Replace } from 'lucide-react';
import { useListResourceQuery } from '@/api/cmsApi';
import { Button } from '@/components/ui/button';
import { StateBadge } from '@/components/common/StateBadge';
import { useFormMode } from '@/components/common/ResourceForm/formMode';
import { useConfirm } from '@/hooks/useConfirm';

const TERMS_QUERY = { resource: 'quotation-terms', params: { limit: 100, sort: 'sortOrder', onlyActive: 'true' } };

/**
 * The terms picker on the builder's Payment & terms tab (a `preview` field — it holds no value; Phase L4): the terms
 * library's entries in use, each with **Use these terms** (replaces the quotation's terms — asked first when they
 * differ) and **Add below**. The English text is inserted; for a customer whose language is Nepali, an entry that
 * has a Nepali text also offers it. The text is copied in — later changes to the library never touch a quotation.
 *
 * @param {{ field: { customerLocale?: 'en'|'ne' } }} props
 */
export function TermsPicker({ field }) {
  const { getValues, setValue } = useFormContext();
  const { readOnly } = useFormMode();
  const { data, isLoading, error } = useListResourceQuery(TERMS_QUERY);
  const [confirm, confirmDialog] = useConfirm();
  const [done, setDone] = useState(null);
  const entries = data?.items ?? [];
  const nepaliCustomer = field.customerLocale === 'ne';

  const insert = async (entry, { nepali = false, append = false } = {}) => {
    const text = String((nepali ? entry.bodyNe : entry.body) ?? '').trim();
    const current = String(getValues('terms') ?? '').trim();
    if (!append && current && current !== text) {
      const ok = await confirm({
        title: 'Replace the terms on this quotation?',
        description: `The text in “Terms shown to the customer” becomes “${entry.title}”${nepali ? ' (नेपाली)' : ''}. You can still edit it before saving.`,
        confirmLabel: 'Replace',
      });
      if (!ok) return;
    }
    const next = append && current ? `${current}\n\n${text}` : text;
    setValue('terms', next, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    setDone(`${append ? 'Added' : 'Inserted'} “${entry.title}”${nepali ? ' in Nepali' : ''}. Save to keep it.`);
  };

  return (
    <div className="space-y-2 rounded-lg border p-3" data-testid="terms-picker">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-medium"><BookText className="h-4 w-4" aria-hidden /> From the terms library</p>
        <Link to="/admin/quotation-terms" className="text-xs font-medium text-primary hover:underline">Open the library</Link>
      </div>
      {isLoading ? <p className="text-xs text-muted-foreground">Loading the library…</p> : null}
      {error ? <p className="text-xs text-destructive">The terms library could not be loaded.</p> : null}
      {!isLoading && !error && !entries.length ? (
        <p className="text-xs text-muted-foreground">The library is empty. A manager adds terms under Catalog › Terms library.</p>
      ) : null}
      {entries.length ? (
        <ul className="max-h-72 space-y-2 overflow-y-auto" aria-label="Terms library">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-md bg-muted/50 p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-medium">{entry.title}</p>
                {entry.isDefault ? <StateBadge tone="info">Default</StateBadge> : null}
              </div>
              <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{entry.body}</p>
              {readOnly ? null : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={() => insert(entry)} aria-label={`Use these terms: ${entry.title}`}>
                    <Replace aria-hidden /> Use these terms
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => insert(entry, { append: true })} aria-label={`Add below: ${entry.title}`}>
                    <ListPlus aria-hidden /> Add below
                  </Button>
                  {nepaliCustomer && entry.bodyNe ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => insert(entry, { nepali: true })} aria-label={`Use the Nepali text: ${entry.title}`}>
                      <span lang="ne">नेपाली</span> Use the Nepali text
                    </Button>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {nepaliCustomer ? <p className="text-xs text-muted-foreground">This customer reads Nepali — entries with a Nepali text offer it.</p> : null}
      {done ? <p role="status" className="text-xs text-success">{done}</p> : null}
      {confirmDialog}
    </div>
  );
}
