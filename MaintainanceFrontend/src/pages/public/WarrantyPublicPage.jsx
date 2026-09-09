import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, ShieldX, CheckCircle2 } from 'lucide-react';
import { useGetWarrantyByTokenQuery, useClaimWarrantyMutation } from '@/api/publicApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { PageTransition, motion } from '@/three/motion/motionKit';
import { formatDate } from '@/helpers/format';

/**
 * The warranty certificate, and the button that makes the one-month promise real:
 * a claim here creates a free rework job on the operations board.
 */
export default function WarrantyPublicPage() {
  const { token } = useParams();
  const { data, isLoading, error, refetch } = useGetWarrantyByTokenQuery(token);
  const [claim, { isLoading: claiming, error: claimError }] = useClaimWarrantyMutation();
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading) return <div className="container max-w-2xl py-14"><Skeleton className="h-80 w-full rounded-xl" /></div>;

  const onClaim = async (e) => {
    e.preventDefault();
    const result = await claim({ token, description }).unwrap().catch(() => null);
    if (result) { setSubmitted(true); setDescription(''); }
  };

  const openClaim = data.claims?.find((c) => ['open', 'accepted'].includes(c.status));

  return (
    <PageTransition className="container max-w-2xl py-14">
      <Card>
        <CardContent className="p-6 sm:p-8">
          <header className="text-center">
            <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${data.isValid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
              {data.isValid ? <ShieldCheck className="h-7 w-7" /> : <ShieldX className="h-7 w-7" />}
            </div>
            <h1 className="mt-4 text-2xl font-bold">Warranty certificate</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.isValid
                ? `Valid until ${formatDate(data.endsAt)}`
                : `This warranty ended on ${formatDate(data.endsAt)}`}
            </p>
          </header>

          <dl className="mt-8 grid gap-4 border-y py-6 sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Customer</dt><dd className="mt-0.5 font-medium">{data.customer.name}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Job</dt><dd className="mt-0.5 font-medium tabular-nums">{data.job.number}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-muted-foreground">Work carried out</dt><dd className="mt-0.5 font-medium">{data.job.title}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Completed</dt><dd className="mt-0.5">{formatDate(data.job.actualEnd)}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Covers until</dt><dd className="mt-0.5">{formatDate(data.endsAt)}</dd></div>
            {data.scope ? (
              <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-muted-foreground">Scope</dt><dd className="mt-0.5 text-sm text-muted-foreground">{data.scope}</dd></div>
            ) : null}
          </dl>

          <section className="mt-6">
            {submitted || openClaim ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                role="status"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Your claim is with our team</p>
                  <p className="mt-0.5 text-sm opacity-80">
                    We will call you to arrange a visit. There is no charge for warranty work.
                  </p>
                </div>
              </motion.div>
            ) : data.isValid ? (
              <form onSubmit={onClaim}>
                <h2 className="font-semibold">Something wrong with this work?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tell us what happened. A valid claim is attended free of charge, at high priority.
                </p>
                <div className="mt-4 space-y-1.5">
                  <Label htmlFor="claim" required>What is the problem?</Label>
                  <Textarea
                    id="claim" rows={4} required minLength={10}
                    value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what you are seeing, and where."
                  />
                </div>
                {claimError ? (
                  <p role="alert" className="mt-3 text-sm text-destructive">
                    {claimError?.data?.error?.message ?? 'Could not submit your claim.'}
                  </p>
                ) : null}
                <Button type="submit" className="mt-4 w-full" loading={claiming} disabled={description.trim().length < 10}>
                  Raise a warranty claim
                </Button>
              </form>
            ) : (
              <p className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
                This warranty has expired, but we can still help. Please call us on 01-5407720.
              </p>
            )}
          </section>
        </CardContent>
      </Card>
    </PageTransition>
  );
}
