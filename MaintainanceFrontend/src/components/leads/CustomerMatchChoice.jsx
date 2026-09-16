import { useEffect, useId, useState } from 'react';
import { AlertTriangle, Link2 } from 'lucide-react';
import { useGetLeadCustomerMatchesQuery } from '@/api/leadsApi';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PREFERRED_LOCALE_OPTIONS } from '@/config/constants';
import { choiceBody, emailDiffers, initialChoice, localeDiffers } from '@/helpers/customerMatch';
import { formatDate } from '@/helpers/format';

const languageName = (code) => PREFERRED_LOCALE_OPTIONS.find((o) => o.value === code)?.label ?? code;

function describe(customer) {
  const jobs = `${customer.jobCount} job${customer.jobCount === 1 ? '' : 's'}`;
  const visit = customer.lastVisitAt ? `last visit ${formatDate(customer.lastVisitAt)}` : 'no visit yet';
  return `${customer.name} · ${jobs} · ${visit}`;
}

/**
 * "Existing customer with this phone" — and the decision convert needs before it runs.
 * Renders nothing to decide when the lead is already linked or nobody has its phone.
 *
 * `onChange({ ready, body })` reports whether the choice is complete and what it adds to
 * the convert request (see `helpers/customerMatch.js`).
 *
 * @param {{ lead: object, onChange: (state: { ready: boolean, body: object, loading: boolean }) => void }} props
 */
export function CustomerMatchChoice({ lead, onChange }) {
  const uid = useId();
  const skip = Boolean(lead.customerId);
  const { data: matches, isLoading, isError } = useGetLeadCustomerMatchesQuery(lead.id, { skip });
  const [choice, setChoice] = useState(() => (skip || matches ? initialChoice(lead, matches ?? []) : { mode: null }));

  // Once the candidates arrive, start from "not decided" (or "nothing to decide").
  const matchKey = matches?.map((m) => m.id).join(',');
  useEffect(() => {
    if (!skip && matches) setChoice(initialChoice(lead, matches));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the candidates change
  }, [skip, matchKey]);

  const loading = !skip && isLoading;
  useEffect(() => {
    // A failed lookup still converts: the API answers 409 with the candidates if it must.
    const state = loading ? { ready: false, body: {} } : choiceBody(isError ? { mode: 'auto' } : choice, lead, matches ?? []);
    onChange({ ...state, loading });
  }, [choice, lead, matches, loading, isError, onChange]);

  if (skip) {
    return (
      <p className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
        <Link2 className="h-4 w-4 text-primary" aria-hidden />
        Linked to customer {lead.customer?.name ?? ''}. The visit or quotation is added to them.
      </p>
    );
  }
  if (loading) return <Skeleton className="h-16" aria-label="Checking for an existing customer" />;
  if (!matches?.length) return null;

  const picked = matches.find((c) => c.id === choice.customerId);
  const value = choice.mode === 'new' ? 'new' : choice.customerId ?? '';

  return (
    <fieldset className="space-y-3 rounded-lg border surface-warning p-3">
      <legend className="sr-only">Is this the same person?</legend>
      <p className="flex items-start gap-2 text-sm font-medium">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {matches.length === 1
          ? 'Existing customer with this phone. Is this the same person?'
          : `${matches.length} existing customers have this phone. Is this one of them?`}
      </p>
      <RadioGroup
        value={value}
        onValueChange={(v) => setChoice((c) => (v === 'new'
          ? { ...c, mode: 'new', customerId: null }
          : { ...c, mode: 'same', customerId: v }))}
        aria-label="Which customer is this?"
      >
        {matches.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <RadioGroupItem id={`${uid}-${c.id}`} value={c.id} className="mt-0.5" />
            <Label htmlFor={`${uid}-${c.id}`} className="font-normal leading-snug">
              <span className="font-medium">Same person:</span> {describe(c)}
              <span className="block text-xs text-muted-foreground">
                {[c.email, c.primaryAddress, languageName(c.preferredLocale)].filter(Boolean).join(' · ')}
              </span>
            </Label>
          </div>
        ))}
        <div className="flex items-start gap-2">
          <RadioGroupItem id={`${uid}-new`} value="new" className="mt-0.5" />
          <Label htmlFor={`${uid}-new`} className="font-normal leading-snug">
            <span className="font-medium">Different person</span> — a new customer with this phone
            {lead.email ? ` and ${lead.email}` : ''}
          </Label>
        </div>
      </RadioGroup>

      {choice.mode === 'same' && picked && emailDiffers(lead, picked) ? (
        <div className="flex items-start gap-2 border-t pt-3">
          <Checkbox
            id={`${uid}-email`}
            checked={Boolean(choice.confirmEmail)}
            onCheckedChange={(v) => setChoice((c) => ({ ...c, confirmEmail: v === true }))}
          />
          <Label htmlFor={`${uid}-email`} className="font-normal leading-snug">
            Also save {lead.email} on this customer
            <span className="block text-xs text-muted-foreground">
              {picked.email ? `Replaces ${picked.email}. ` : ''}Tick only if the customer confirmed it — their future account is found by it.
            </span>
          </Label>
        </div>
      ) : null}

      {choice.mode === 'same' && picked && localeDiffers(lead, picked) ? (
        <div className="flex items-start gap-2">
          <Checkbox
            id={`${uid}-locale`}
            checked={Boolean(choice.useLeadLocale)}
            onCheckedChange={(v) => setChoice((c) => ({ ...c, useLeadLocale: v === true }))}
          />
          <Label htmlFor={`${uid}-locale`} className="font-normal leading-snug">
            Write to them in {languageName(lead.preferredLocale)} from now on
            <span className="block text-xs text-muted-foreground">
              The customer’s language is {languageName(picked.preferredLocale)}; this enquiry came in {languageName(lead.preferredLocale)}.
            </span>
          </Label>
        </div>
      ) : null}
    </fieldset>
  );
}
