import { CheckCircle2 } from 'lucide-react';
import { DocumentNotice } from '@/components/documents/DocumentNotice';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DOCUMENTS } from '@/config/i18n/documents';
import { useT } from '@/hooks/useT';

/** Below this, a description is not enough for a technician to act on. */
const MIN_DESCRIPTION = 10;

/**
 * The button that makes the one-month promise real: a claim here creates a free
 * rework job on the operations board, at high priority.
 *
 * Three states, in the order a customer meets them: a claim already open (or
 * just filed), cover still live, or cover over — expired or voided — and that case still
 * gives them a number to call rather than a dead end.
 *
 * In the page's language (`DOCUMENTS.warranty.claim`); `error` is the refusal already in words
 * (`useApiErrorText(DOCUMENTS)` — WARRANTY_EXPIRED, CLAIM_OPEN… are `common.js`'s).
 *
 * @param {{ isValid: boolean, voided?: boolean, hasOpenClaim: boolean, description: string,
 *   onDescription: (text: string) => void, onSubmit: (event: import('react').FormEvent) => void, claiming: boolean,
 *   error?: string|null, phone?: string }} props
 */
export function WarrantyClaimForm({
  isValid, voided = false, hasOpenClaim, description, onDescription, onSubmit, claiming, error, phone,
}) {
  const t = useT(DOCUMENTS);

  if (hasOpenClaim) {
    return (
      <DocumentNotice tone="success" icon={CheckCircle2} title={t('warranty.claim.open.title')}>
        {t('warranty.claim.open.body')}
      </DocumentNotice>
    );
  }

  if (!isValid) {
    return (
      <DocumentNotice
        tone="muted"
        title={voided ? t('warranty.claim.voided.title') : t('warranty.claim.expired.title')}
        animate={false}
      >
        {phone ? t('warranty.claim.expired.body', { phone }) : t('warranty.claim.expired.bodyNoPhone')}
      </DocumentNotice>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <h2 className="font-semibold">{t('warranty.claim.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('warranty.claim.body')}</p>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="claim" required>{t('warranty.claim.label')}</Label>
        <Textarea
          id="claim" rows={4} required minLength={MIN_DESCRIPTION} lang="ne"
          value={description} onChange={(e) => onDescription(e.target.value)}
          placeholder={t('warranty.claim.placeholder')}
        />
      </div>

      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}

      <Button
        type="submit"
        className="mt-4 w-full"
        loading={claiming}
        disabled={description.trim().length < MIN_DESCRIPTION}
      >
        {t('warranty.claim.submit')}
      </Button>
    </form>
  );
}
