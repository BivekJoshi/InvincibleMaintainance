import { ErrorState } from '@/components/common/ErrorState';
import { FIELD } from '@/config/i18n/field';
import { useApiErrorText, useT } from '@/hooks/useT';

/**
 * `ErrorState` in the technician's language (Phase J1): the refusal's code in `FIELD` / `COMMON` words (no signal →
 * "No internet connection…"), else the server's message; "Try again" translated. `message` overrides the words — a
 * screen that knows better ("This day is not on the phone yet").
 *
 * @param {{ error?: unknown, onRetry?: () => void, message?: string, className?: string }} props
 */
export function FieldErrorState({ error, onRetry, message, className }) {
  const t = useT(FIELD);
  const errorText = useApiErrorText(FIELD);
  return (
    <ErrorState
      error={error}
      onRetry={onRetry}
      className={className}
      message={message ?? errorText(error)}
      retryLabel={t('retry')}
    />
  );
}
