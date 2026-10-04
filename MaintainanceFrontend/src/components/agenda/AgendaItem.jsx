import { Link } from 'react-router-dom';
import { AlertTriangle, Timer } from 'lucide-react';
import { KIND_ICONS } from '@/components/agenda/agendaIcons';
import { AGENDA_KINDS, bsDate, itemAction, itemDay, itemTime, kindStyle, lateLabel } from '@/helpers/agenda';
import { formatDate, formatDateTime, formatTime, initials } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** The item's date, AD or BS: "04 Oct 2026, 14:30" / "१८ असोज २०८३, 14:30"; a due date without its time. */
function when(item, calendar) {
  const bs = calendar === 'bs' ? bsDate(itemDay(item)) : null;
  if (!bs) return item.allDay ? `due ${formatDate(item.at)}` : formatDateTime(item.at);
  return item.allDay ? `due ${bs}` : `${bs}, ${formatTime(item.at)}`;
}

/** "Reply deadline · Sita Rai · 04 Oct 2026, 14:30 · 3 h late" — what a chip says to a screen reader and in its tooltip. */
const describe = (item, now, calendar) => [
  AGENDA_KINDS[item.kind]?.label,
  item.title,
  when(item, calendar),
  lateLabel(item, now),
].filter(Boolean).join(' · ');

/**
 * One item on a month cell: the kind's dot, the time and who. A late one is ringed in the breach red. It is a
 * link to the record; a click on it never also selects the day under it.
 */
export function AgendaChip({ item, now, calendar = 'ad' }) {
  const overdue = item.state === 'overdue';
  return (
    <Link
      to={item.href}
      onClick={(e) => e.stopPropagation()}
      style={kindStyle(item.kind)}
      title={describe(item, now, calendar)}
      aria-label={describe(item, now, calendar)}
      className={cn(
        'flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-4 transition-colors motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        overdue
          ? 'bg-sla-breach/10 ring-1 ring-inset ring-sla-breach/35 hover:bg-sla-breach/15'
          : 'bg-[hsl(var(--tone)/0.13)] hover:bg-[hsl(var(--tone)/0.24)]',
      )}
    >
      {overdue
        ? <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-sla-breach" aria-hidden />
        : <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--tone))]" />}
      {item.allDay ? null : <span className="shrink-0 tabular-nums text-muted-foreground">{formatTime(item.at)}</span>}
      <span className="truncate font-medium">{item.title}</span>
    </Link>
  );
}

/**
 * One item in full — the week's columns, the list and the side panel: the kind and its time, who, what to do,
 * and who has it. `dense` drops the second line of detail for a narrow column.
 */
export function AgendaCard({ item, now, calendar = 'ad', dense = false }) {
  const Icon = KIND_ICONS[item.kind] ?? Timer;
  const kind = AGENDA_KINDS[item.kind];
  const overdue = item.state === 'overdue';
  const late = lateLabel(item, now);
  return (
    <article
      style={kindStyle(item.kind)}
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-card py-2 pl-3.5 pr-2.5 shadow-[var(--elevation-1)] transition-[box-shadow,border-color] duration-200',
        'hover:border-[hsl(var(--tone)/0.5)] hover:shadow-[var(--elevation-2)] motion-reduce:transition-none',
        overdue && 'border-sla-breach/40 bg-sla-breach/[0.04]',
      )}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', overdue ? 'bg-sla-breach' : 'bg-[hsl(var(--tone))]')} />
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-[hsl(var(--tone)/0.16)]">
          <Icon className="h-2.5 w-2.5 text-[hsl(var(--tone))]" aria-hidden />
        </span>
        <span className="min-w-0 truncate font-semibold uppercase tracking-wide">{dense ? kind?.short : kind?.label}</span>
        <span aria-hidden>·</span>
        <span className="shrink-0 tabular-nums">{itemTime(item)}</span>
        {late ? (
          <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 font-semibold text-sla-breach">
            <AlertTriangle className="h-3 w-3" aria-hidden />{late}
          </span>
        ) : null}
      </div>
      <Link
        to={item.href}
        title={describe(item, now, calendar)}
        className="mt-0.5 block truncate text-sm font-semibold after:absolute after:inset-0 hover:text-primary focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring"
      >
        {item.title}
      </Link>
      <p className={cn('text-xs text-muted-foreground', dense ? 'line-clamp-2' : 'line-clamp-1')}>{itemAction(item)}</p>
      {dense ? null : (
        <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
          {item.detail ? <span className="truncate">{item.detail}</span> : null}
          {item.number && item.detail !== item.number ? <span className="shrink-0 tabular-nums">{item.number}</span> : null}
          {item.ownable ? (
            item.ownerName ? (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1" title={`Owner: ${item.ownerName}`}>
                <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full bg-primary/10 text-[8px] font-bold text-primary">
                  {initials(item.ownerName)}
                </span>
                {item.ownerName}
              </span>
            ) : <span className="ml-auto shrink-0 font-medium text-warning">Nobody owns this</span>
          ) : null}
        </div>
      )}
    </article>
  );
}
