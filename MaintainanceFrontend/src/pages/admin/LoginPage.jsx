import { useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useLoginMutation } from '@/features/auth/authApi';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const [login, { isLoading, error }] = useLoginMutation();
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    const to = location.state?.from?.pathname ?? (role === 'TECHNICIAN' ? '/tech' : '/admin');
    navigate(to, { replace: true });
  }, [isAuthenticated, role, navigate, location.state]);

  const onSubmit = (values) => { login(values); };

  // The API returns one message for every failure, so this never leaks
  // whether the address exists.
  const serverError = error?.data?.error?.message;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-xl bg-primary font-extrabold text-primary-foreground">
              H
            </div>
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Ghar Jatan back office</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email" required>Email</Label>
                <Input
                  id="email" type="email" autoComplete="username" autoFocus
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
                {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" required>Password</Label>
                <Input
                  id="password" type="password" autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
                {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
              </div>

              {serverError ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {serverError}
                </motion.p>
              ) : null}

              <Button type="submit" className="w-full" loading={isLoading}>Sign in</Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground hover:underline">← Back to website</Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
