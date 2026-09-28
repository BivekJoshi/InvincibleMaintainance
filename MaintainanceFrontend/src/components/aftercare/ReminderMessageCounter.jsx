import { useWatch } from 'react-hook-form';
import { SmsCounter } from '@/components/common/SmsCounter';

/**
 * Under a service reminder's message (a `preview` field): the SMS parts it costs — Phase G's counter, where one
 * Devanagari letter makes the whole message Unicode (70 characters a part, 67 once split) — or, for an email,
 * just its length against the 1000 allowed.
 */
export function ReminderMessageCounter() {
  const [message, channel] = useWatch({ name: ['message', 'channel'] });
  if (channel === 'email') {
    return <p className="text-xs text-muted-foreground" aria-live="polite">{String(message ?? '').length} of 1000 characters.</p>;
  }
  return <SmsCounter text={message ?? ''} label="This reminder" />;
}
