import { cn } from '@/helpers/utils';

/**
 * The day's date in the other calendar (`helpers/agenda#cornerCell`), set off so it reads at a glance: a Nepali date
 * in Nepali script on a gold wash, an English one on a blue wash, a size up from the small print around it.
 *
 * @param {{ corner: { day: string, month: string|null, title: string, lang: 'ne'|'en' }|null, className?: string }} props
 */
export function AgendaOtherDate({ corner, className }) {
  if (!corner) return null;
  const nepali = corner.lang === 'ne';
  return (
    <span
      lang={corner.lang}
      title={corner.title}
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 font-semibold leading-5 text-foreground',
        nepali ? 'bg-gold/15 text-[13px] ring-1 ring-inset ring-gold/25' : 'bg-info/10 text-xs tabular-nums ring-1 ring-inset ring-info/20',
        className,
      )}
    >
      {corner.month ? `${corner.day} ${corner.month}` : corner.day}
    </span>
  );
}
