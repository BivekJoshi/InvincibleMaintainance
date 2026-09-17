import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { useResetPasswordMutation } from '@/api/authApi';
import { useZodForm } from '@/form/useZodForm';
import { resetPasswordSchema } from '@/form/schemas/auth.schema';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageTransition } from '@/three/motion/motionKit';

function Shell({ children }) {
  const { name } = useSiteSettings();
  return (
    <PageTransition className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-primary" aria-hidden /> {name} · Back office
        </p>
        {children}
      </div>
    </PageTransition>
  );
}

/**
 * `/reset-password?token=…` — where a reset link and a new account's invite land. The
 * person chooses a password twice; the API checks the link once, so a used or expired link
 * says so and points at the administrator (this screen never sends links itself).
 */
export default function ResetPasswordPage() {
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
        <h1 className="text-lg font-bold">Open the link from your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page sets a password from the link we emailed you. If you do not have one, ask an administrator to send it.
        </p>
        <Button asChild variant="outline" className="mt-6 w-full"><Link to="/login">Back to sign-in</Link></Button>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> Password set
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in with it now. Any device that was signed in before has to sign in again.</p>
        <Button asChild className="mt-6 w-full"><Link to="/login">Sign in</Link></Button>
      </Shell>
    );
  }

  const submit = handleSubmit(async ({ password }) => {
    setFailure(null);
    try {
      await reset({ token, password }).unwrap();
      setDone(true);
    } catch (err) {
      setFailure(err?.data?.error?.message ?? 'Something went wrong. Try again.');
    }
  });

  return (
    <Shell>
      <h1 className="text-lg font-bold">Choose your password</h1>
      <p className="mt-1 text-sm text-muted-foreground">At least 8 characters, mixing lower-case letters with capitals or numbers.</p>
      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        {failure ? (
          <div role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{failure} Ask an administrator to send a new link.</span>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password" type="password" autoComplete="new-password"
            aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'new-password-error' : undefined}
            {...register('password')}
          />
          {errors.password ? <p id="new-password-error" className="text-xs text-destructive">{errors.password.message}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Type it again</Label>
          <Input
            id="confirm-password" type="password" autoComplete="new-password"
            aria-invalid={Boolean(errors.confirm)} aria-describedby={errors.confirm ? 'confirm-password-error' : undefined}
            {...register('confirm')}
          />
          {errors.confirm ? <p id="confirm-password-error" className="text-xs text-destructive">{errors.confirm.message}</p> : null}
        </div>
        <Button type="submit" className="w-full" loading={isLoading}>Set password</Button>
      </form>
    </Shell>
  );
}
