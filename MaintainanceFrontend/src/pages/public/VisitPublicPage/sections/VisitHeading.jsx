import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DOCUMENTS } from '@/config/i18n/documents';
import { useT } from '@/hooks/useT';

/**
 * The top of the visit page: who it is from, what it is, and — while an answer is still wanted — what to do.
 * When the customer's own language is not the page's, a one-tap switch to it (written in that language).
 *
 * @param {{ company: string, number?: string, showLead: boolean,
 *   switchTo?: { locale: string, label: string }|null, onSwitch: (locale: string) => void }} props
 */
export function VisitHeading({ company, number, showLead, switchTo, onSwitch }) {
  const t = useT(DOCUMENTS);
  return (
    <header>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words text-sm font-semibold text-primary">{company}</p>
        {switchTo ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 px-3"
            lang={switchTo.locale}
            onClick={() => onSwitch(switchTo.locale)}
          >
            <Languages aria-hidden /> {switchTo.label}
          </Button>
        ) : null}
      </div>
      <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{t('visit.title')}</h1>
      {showLead ? <p className="mt-2 text-base text-muted-foreground">{t('visit.lead')}</p> : null}
      {number ? <p className="mt-2 text-xs tabular-nums text-muted-foreground">{t('visit.reference', { number })}</p> : null}
    </header>
  );
}
