import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SitePhotoUpload } from '@/components/public/SitePhotoUpload';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';

/** One labelled field with its error, so four of them cannot drift apart. */
function Field({ id, label, error, required, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} required={required}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * Step four: who and where.
 *
 * The submit button is not in here — it lives in the wizard's navigation bar
 * beside "Back", and reaches this form through `form="booking-details"`. Two
 * buttons that both continue, in two places, is the thing that made people
 * click the wrong one.
 */
export function StepDetails({ form, onSubmit, serverError, onPhotos }) {
  const t = useT(SITE);
  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <form id="booking-details" onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4" noValidate>
      <div>
        <h2 className="text-xl font-bold tracking-tight">{t('booking.details.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('booking.details.description')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="book-name" label={t('lead.name')} required error={errors.name?.message}>
          <Input id="book-name" aria-invalid={Boolean(errors.name)} {...register('name')} />
        </Field>
        <Field id="book-phone" label={t('lead.phone')} required error={errors.phone?.message}>
          <Input
            id="book-phone" type="tel" inputMode="tel" placeholder="9808338255"
            aria-invalid={Boolean(errors.phone)} {...register('phone')}
          />
        </Field>
      </div>

      <Field id="book-email" label={`${t('lead.email')} ${t('common.optional')}`} error={errors.email?.message}>
        <Input
          id="book-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
          aria-invalid={Boolean(errors.email)} {...register('email')}
        />
      </Field>

      <Field id="book-address" label={t('lead.address')} required error={errors.address?.message}>
        <Input
          id="book-address" placeholder={t('booking.details.addressPlaceholder')}
          aria-invalid={Boolean(errors.address)} {...register('address')}
        />
      </Field>

      <Field id="book-message" label={t('booking.details.message')} error={errors.message?.message}>
        <Textarea id="book-message" rows={3} placeholder={t('lead.messagePlaceholder')} {...register('message')} />
      </Field>

      <SitePhotoUpload onChange={onPhotos} />

      {serverError ? (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {serverError}
        </p>
      ) : null}
    </form>
  );
}
