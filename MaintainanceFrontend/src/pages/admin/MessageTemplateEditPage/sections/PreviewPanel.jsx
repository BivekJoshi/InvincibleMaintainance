import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AlertTriangle, Copy } from 'lucide-react';
import { usePreviewTemplateQuery } from '@/api/messagesApi';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { nestVars, placeholdersIn, sampleVarsFor } from '@/config/admin/messageKeys';
import { toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';
import { SmsCounter } from './SmsCounter';

/**
 * What the message will look like, rendered by the API from the text being typed (not the
 * saved one) with example values — every placeholder gets an input, prefilled where an
 * example is known. Lists the placeholders as chips (a press copies `{{name}}`), warns about
 * any left empty, and for an SMS counts the parts of the rendered text.
 *
 * @param {{ templateId?: string, channel: 'sms'|'email', locale: 'en'|'ne',
 *   values: { subject?: string, body?: string }, englishPlaceholders?: string[] }} props
 *   `englishPlaceholders` — on a Nepali version, the English one's, so a translator sees any it lacks
 */
export function PreviewPanel({ templateId, channel, locale, values, englishPlaceholders = [] }) {
  const dispatch = useDispatch();
  const [typed, setTyped] = useState({});
  const request = JSON.stringify({ subject: channel === 'email' ? values.subject ?? '' : undefined, body: values.body ?? '', typed });
  const debounced = useDebouncedValue(request, 300);
  const { subject, body, typed: typedNow } = JSON.parse(debounced);

  // An input per placeholder as soon as it is typed; the API's answer says which are still empty.
  const placeholders = useMemo(() => placeholdersIn(values.subject, values.body), [values.subject, values.body]);
  const vars = useMemo(() => ({ ...sampleVarsFor(placeholders), ...typed }), [placeholders, typed]);
  const sent = useMemo(() => ({ ...sampleVarsFor(placeholdersIn(subject, body)), ...typedNow }), [subject, body, typedNow]);
  const { data: result, error } = usePreviewTemplateQuery(
    { id: templateId, subject, body, vars: nestVars(sent) },
    { skip: !body },
  );
  const missingFromEnglish = englishPlaceholders.filter((p) => !placeholders.includes(p));

  const copy = async (key) => {
    try {
      await navigator.clipboard.writeText(`{{${key}}}`);
      dispatch(toastSuccess(`Copied {{${key}}}`, 'Paste it into the message.'));
    } catch { /* the chip still shows the name */ }
  };

  const chip = (key, muted) => (
    <button
      key={key} type="button" onClick={() => copy(key)}
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xs hover:border-primary hover:text-primary',
        muted && 'border-dashed text-muted-foreground',
      )}
      aria-label={`Copy the placeholder ${key}`}
    >
      {`{{${key}}}`} <Copy className="h-3 w-3" aria-hidden />
    </button>
  );

  if (!body) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Write the message to see it here.</p>;
  }
  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Placeholders</p>
        <div className="flex flex-wrap gap-1">
          {placeholders.length ? placeholders.map((p) => chip(p)) : <span className="text-xs text-muted-foreground">None — every customer gets the same words.</span>}
        </div>
        {missingFromEnglish.length ? (
          <div className="mt-2 text-xs">
            <p className="text-muted-foreground">The English version also uses:</p>
            <div className="mt-1 flex flex-wrap gap-1">{missingFromEnglish.map((p) => chip(p, true))}</div>
          </div>
        ) : null}
      </div>

      {placeholders.length ? (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">Example values</legend>
          {placeholders.map((key) => (
            <div key={key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-2">
              <Label htmlFor={`var-${key}`} className="truncate font-mono text-xs">{key}</Label>
              <Input
                id={`var-${key}`}
                className="h-8"
                value={vars[key] ?? ''}
                onChange={(e) => setTyped((t) => ({ ...t, [key]: e.target.value }))}
              />
            </div>
          ))}
        </fieldset>
      ) : null}

      <div aria-live="polite">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Preview</p>
        {!result ? <Skeleton className="h-24" /> : (
          <div className={cn('rounded-lg border bg-background p-3 text-sm', channel === 'sms' && 'max-w-sm rounded-2xl bg-muted/40')} lang={locale === 'ne' ? 'ne' : undefined}>
            {channel === 'email' ? <p className="mb-2 border-b pb-2 font-medium">{result.subject || <span className="text-muted-foreground">(no subject — the company name is used)</span>}</p> : null}
            <p className="whitespace-pre-wrap break-words">{result.body}</p>
          </div>
        )}
        {result?.missing?.length ? (
          <p className="mt-2 flex gap-1.5 text-xs text-warning" role="status">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Empty in this preview: {result.missing.map((m) => `{{${m}}}`).join(', ')}. A value the system does not send prints as nothing.
          </p>
        ) : null}
      </div>

      {channel === 'sms' && result ? <SmsCounter text={result.body} label="With these values" /> : null}
    </div>
  );
}
