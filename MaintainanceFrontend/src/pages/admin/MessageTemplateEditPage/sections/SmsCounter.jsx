import { smsSegments } from '@/helpers/sms';
import { cn } from '@/helpers/utils';

/**
 * Characters and SMS parts for a text, and why it is Unicode when it is: one Devanagari
 * letter or curly quote makes the whole message 70 characters a part instead of 160.
 *
 * @param {{ text: string, label?: string, className?: string }} props
 */
export function SmsCounter({ text, label = 'This SMS', className }) {
  const s = smsSegments(text);
  const many = s.segments > 1;
  // A vowel sign shown on its own is unreadable, so Devanagari is named rather than listed.
  const devanagari = s.nonGsm.some((c) => /[\u0900-\u097F]/.test(c));
  const others = s.nonGsm.filter((c) => !/[\u0900-\u097F]/.test(c) && c.trim());
  const why = [devanagari ? 'Devanagari' : null, others.length ? others.join(' ') : null].filter(Boolean).join(', ');
  return (
    <div className={cn('rounded-md border p-2 text-xs', many ? 'surface-warning' : 'bg-muted/30', className)} aria-live="polite">
      <p>
        <span className="font-medium">{label}:</span>{' '}
        {s.length} characters · <strong>{s.segments || 0} {s.segments === 1 ? 'part' : 'parts'}</strong>
        {' · '}{s.remaining} left in this part
      </p>
      <p className="text-muted-foreground">
        {s.encoding === 'GSM-7'
          ? `Plain text: ${s.perSegment} characters a part.`
          : `Unicode (because of ${why || 'special characters'}): ${s.perSegment} characters a part.`}
      </p>
    </div>
  );
}
