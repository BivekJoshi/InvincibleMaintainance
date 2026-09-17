import { DIFF_KIND_STYLES, diffEntries } from '@/helpers/auditDiff';
import { formatDiffValue } from '@/helpers/history';
import { cn } from '@/helpers/utils';

/**
 * An audit row's before/after, field by field — nested fields by their path — with each
 * line marked added, removed or changed on the theme's semantic surfaces (and in words, for
 * screen readers). `changes` is an event's extra detail, listed on its own.
 *
 * @param {{ before?: object|null, after?: object|null, changes?: object|null, className?: string }} props
 */
export function AuditDiff({ before, after, changes, className }) {
  const entries = diffEntries(before, after);
  const extra = diffEntries(null, changes).map((e) => ({ path: e.path, value: e.after }));

  if (!entries.length && !extra.length) {
    return <p className={cn('text-sm text-muted-foreground', className)}>No field values were recorded for this step.</p>;
  }
  return (
    <div className={cn('space-y-3', className)}>
      {entries.length ? (
        <div className="overflow-x-auto rounded-md border bg-background">
          <table className="w-full text-xs">
            <caption className="sr-only">What changed</caption>
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th scope="col" className="w-6 px-2 py-1.5"><span className="sr-only">Change</span></th>
                <th scope="col" className="px-2 py-1.5 font-medium">Field</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Before</th>
                <th scope="col" className="px-2 py-1.5 font-medium">After</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const style = DIFF_KIND_STYLES[e.kind];
                return (
                  <tr key={e.path} className={cn('border-t align-top', style.className)} data-kind={e.kind}>
                    <td className="px-2 py-1 text-center font-mono" aria-hidden>{style.sign}</td>
                    <th scope="row" className="px-2 py-1 text-left font-mono font-medium">
                      {e.path}
                      <span className="sr-only"> — {style.label}</span>
                    </th>
                    <td className={cn('break-all px-2 py-1', e.kind === 'changed' && 'line-through decoration-1 opacity-80')}>
                      {formatDiffValue(e.before)}
                    </td>
                    <td className="break-all px-2 py-1">{formatDiffValue(e.after)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {extra.length ? (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Details</p>
          <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-xs">
            {extra.map((e) => (
              <div key={e.path} className="contents">
                <dt className="font-mono text-muted-foreground">{e.path}</dt>
                <dd className="break-all">{formatDiffValue(e.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
