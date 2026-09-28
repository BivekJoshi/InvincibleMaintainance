import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { questionDomId } from '@/pages/tech/SurveyFormPage/surveyForm';

/**
 * What stops the survey being submitted — found on the phone before sending, or answered by the office as
 * 422 `SURVEY_INCOMPLETE` — one line per missing answer or photo, each with "Show me", which scrolls to the
 * question and puts the focus on it.
 *
 * @param {{ items: { questionKey: string, label: string, missing: 'answer'|'photo' }[], office?: boolean,
 *   labelOf?: (key: string, fallback: string) => string, words: object }} props  `words` is `fieldCopy().survey`
 */
export function IncompletePanel({ items, office = false, labelOf = (_key, label) => label, words }) {
  if (!items.length) return null;
  const t = words.incomplete;

  const show = (key) => {
    const el = document.getElementById(questionDomId(key));
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    el?.focus?.();
  };

  return (
    <section
      role="alert"
      aria-labelledby="survey-incomplete-title"
      className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <h2 id="survey-incomplete-title" className="flex items-center gap-2 font-semibold">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden /> {t.title}
      </h2>
      <p className="mt-1">{office ? t.office : t.body}</p>
      <ul className="mt-2 space-y-1.5" data-testid="survey-incomplete">
        {items.map((item) => (
          <li key={`${item.questionKey}:${item.missing}`} className="flex items-center justify-between gap-2">
            <span className="min-w-0">
              {item.missing === 'photo' ? t.photo(labelOf(item.questionKey, item.label)) : t.answer(labelOf(item.questionKey, item.label))}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 shrink-0 border-destructive/40 bg-background text-destructive"
              onClick={() => show(item.questionKey)}
              aria-label={`${t.go}: ${labelOf(item.questionKey, item.label)}`}
            >
              {t.go}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
