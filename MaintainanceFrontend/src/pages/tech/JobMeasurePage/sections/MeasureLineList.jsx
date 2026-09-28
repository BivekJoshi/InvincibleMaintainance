import { Link } from 'react-router-dom';
import { ChevronRight, Ruler } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StateBadge } from '@/components/common/StateBadge';
import { isMeasured, isOmission, mustMeasure } from '@/helpers/closeout';
import { formatQty } from '@/helpers/measurements';
import { linesBySection } from '../jobMeasure';

/**
 * The job's lines by section, each one big row (≥ 56 px): its number and words, the quoted quantity, and where it
 * stands — measured (the server's quantity), to measure (the contract measures it), or an omission, which keeps its
 * quoted quantity and cannot be opened. Quantities only.
 *
 * @param {{ job: object, t: object }} props
 */
export function MeasureLineList({ job, t }) {
  const contractType = job.quotation?.contractType ?? null;
  const sections = linesBySection(job.lines ?? []);
  if (!sections.length) return <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{t.noLines}</p>;

  return (
    <div className="space-y-4" data-testid="measure-lines">
      <p className="text-sm text-muted-foreground">{t.pick}</p>
      {sections.map((section, i) => (
        <section key={`${section.title}-${i}`} aria-label={section.title || t.lines} className="space-y-2">
          {section.title ? <h2 className="text-sm font-semibold">{section.title}</h2> : null}
          <ul className="space-y-2">
            {section.lines.map((line) => {
              const name = [line.number, line.description].filter(Boolean).join(' · ');
              const omission = isOmission(line);
              const status = omission
                ? <StateBadge tone="muted" className="whitespace-normal">{t.omission}</StateBadge>
                : isMeasured(line)
                  ? <StateBadge tone="success" className="whitespace-normal">{t.measured(formatQty(line.measuredQty), line.unit ?? '')}</StateBadge>
                  : mustMeasure(line, contractType)
                    ? <StateBadge tone="warning" className="whitespace-normal">{t.toMeasure}</StateBadge>
                    : <StateBadge tone="muted" className="whitespace-normal">{t.notMeasured}</StateBadge>;
              const body = (
                <CardContent className="flex min-h-14 items-center gap-3 p-3">
                  <Ruler className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{name}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">{t.quoted(formatQty(Math.abs(line.quotedQty)), line.unit ?? '')}</p>
                    <div className="mt-1">{status}</div>
                  </div>
                  {!omission ? <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden /> : null}
                </CardContent>
              );
              return (
                <li key={line.id} data-testid={`measure-line-${line.id}`}>
                  {omission ? (
                    <Card aria-disabled="true" className="opacity-70">{body}</Card>
                  ) : (
                    <Card className="transition-colors hover:border-primary">
                      <Link to={`?line=${line.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {body}
                      </Link>
                    </Card>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
