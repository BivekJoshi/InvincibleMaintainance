import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { useResetPasswordMutation } from '@/api/authApi';
import { useZodForm } from '@/form/useZodForm';
import { PASSWORD_MIN, resetPasswordSchema } from '@/form/schemas/auth.schema';
import { SITE } from '@/config/i18n/site';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useApiErrorText, useT } from '@/hooks/useT';
import { LocaleSwitch } from '@/components/common/LocaleSwitch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageTransition } from '@/three/motion/motionKit';

function Shell({ children }) {
  const t = useT(SITE);
  const { name } = useSiteSettings();
  return (
    <PageTransition className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 shrink-0 text-primary" aria-hidden /> {t('reset.backOffice', { company: name })}
        </p>
        {children}
      </div>
      <LocaleSwitch />
    </PageTransition>
  );
}

/**
 * `/reset-password?token=…` — where a reset link and a new account's invite land. The
 * person chooses a password twice; the API checks the link once, so a used or expired link
 * says so and points at the administrator (this screen never sends links itself).
 *
 * Phase J1: a technician's invite opens here, so the page speaks Nepali too — its own switch under the card — and
 * its zod messages are keys (`auth.schema.js`). The API refuses a used or expired link as a bad request today, worded
 * as `RESET_LINK_INVALID`; anything else is worded from its code.
 */
export default function ResetPasswordPage() {
  const t = useT(SITE);
  const errorText = useApiErrorText(SITE);
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [reset, { isLoading }] = useResetPasswordMutation();
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState(null);
  const { register, handleSubmit, formState: { errors } } = useZodForm(resetPasswordSchema, {
    defaultValues: { password: '', confirm: '' },
    mode: 'onTouched',
  });

  if (token.length < 20) {
    return (
      <Shell>
        <h1 className="text-lg font-bold">{t('reset.noLink')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('reset.noLinkBody')}</p>
        <Button asChild variant="outline" className="mt-6 w-full"><Link to="/login">{t('reset.backToSignIn')}</Link></Button>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden /> {t('reset.done')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('reset.doneBody')}</p>
        <Button asChild className="mt-6 w-full"><Link to="/login">{t('reset.signIn')}</Link></Button>
      </Shell>
    );
  }

  const submit = handleSubmit(async ({ password }) => {
    setFailure(null);
    try {
      await reset({ token, password }).unwrap();
      setDone(true);
    } catch (err) {
      const code = err?.data?.error?.code;
      setFailure(code === 'BAD_REQUEST' ? t('errors.RESET_LINK_INVALID') : errorText(err));
    }
  });

  return (
    <Shell>
      <h1 className="text-lg font-bold">{t('reset.title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('reset.rule', { min: PASSWORD_MIN })}</p>
      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        {failure ? (
          <div role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{failure} {t('reset.askAdmin')}</span>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="new-password">{t('reset.password')}</Label>
          <Input
            id="new-password" type="password" autoComplete="new-password"
            aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'new-password-error' : undefined}
            {...register('password')}
          />
          {errors.password ? <p id="new-password-error" className="text-xs text-destructive">{errors.password.message}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">{t('reset.confirm')}</Label>
          <Input
            id="confirm-password" type="password" autoComplete="new-password"
            aria-invalid={Boolean(errors.confirm)} aria-describedby={errors.confirm ? 'confirm-password-error' : undefined}
            {...register('confirm')}
          />
          {errors.confirm ? <p id="confirm-password-error" className="text-xs text-destructive">{errors.confirm.message}</p> : null}
        </div>
        <Button type="submit" className="w-full" loading={isLoading}>{t('reset.submit')}</Button>
      </form>
    </Shell>
  );
}
