import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Undo2, Eye, Loader2, Lock } from 'lucide-react';
import {
  useGetSurveyQuery,
  useGetSurveyPricingQuery,
  useReviewSurveyMutation,
  useBuildQuotationFromSurveyMutation,
} from '@/api/surveysApi';
import { SurveyFindings } from '@/components/surveys/SurveyFindings';
import { SurveyPricingTable, toQuotationItems } from '@/components/surveys/SurveyPricingTable';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageTransition } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { useDispatch } from 'react-redux';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { formatDate, formatNpr } from '@/helpers/format';

const QUOTABLE = ['SUBMITTED', 'IN_REVIEW'];

export default function SurveyReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const dispatch = useDispatch();
  const canPrice = can('quotations:read');
  const canQuote = can('quotations:write');
  // DISPATCHER holds surveys:read but not surveys:write — showing them actions
  // that will 403 is worse than not showing them.
  const canReview = can('surveys:write');

  const { data: survey, isLoading, error, refetch } = useGetSurveyQuery(id);
  // Pricing is guarded by quotations:read, so a dispatcher reads the survey while
  // this stays unfetched rather than 403-ing the whole page.
  const { data: pricing, isLoading: pricingLoading } = useGetSurveyPricingQuery(id, { skip: !canPrice });

  const [draft, setDraft] = useState({});
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnNote, setReturnNote] = useState('');

  const [review, { isLoading: reviewing }] = useReviewSurveyMutation();
  const [buildQuotation, { isLoading: building }] = useBuildQuotationFromSurveyMutation();

  const items = useMemo(
    () => (pricing ? toQuotationItems(pricing.lines, draft) : []),
    [pricing, draft],
  );
  const ready = items.length > 0 && items.every((i) => Number.isFinite(i.rate));

  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;

  const quotable = QUOTABLE.includes(survey.status);

  const sendBack = async () => {
    try {
      await review({ id, status: 'RETURNED', note: returnNote }).unwrap();
      dispatch(toastSuccess('Sent back to the surveyor'));
      setReturnOpen(false);
      setReturnNote('');
    } catch (err) {
      dispatch(toastError(err?.data?.error?.message ?? 'Could not send it back'));
    }
  };

  const startReview = async () => {
    try {
      await review({ id, status: 'IN_REVIEW' }).unwrap();
    } catch (err) {
      dispatch(toastError(err?.data?.error?.message ?? 'Could not start the review'));
    }
  };

  const build = async () => {
    try {
      const result = await buildQuotation({ id, items }).unwrap();
      dispatch(toastSuccess(`Quotation ${result.quotation.number} created`));
      navigate(`/admin/quotations/${result.quotation.id}`);
    } catch (err) {
      dispatch(toastError(err?.data?.error?.message ?? 'Could not build the quotation'));
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title={survey.number}
        description={`${survey.customer?.name} · ${survey.service?.name ?? 'General'} · surveyed ${formatDate(survey.submittedAt ?? survey.createdAt)}`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/surveys')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {canReview && quotable ? (
              <Button variant="outline" size="sm" onClick={() => setReturnOpen(true)} disabled={reviewing}>
                <Undo2 className="h-4 w-4" /> Send back
              </Button>
            ) : null}
            {canReview && quotable && survey.status === 'SUBMITTED' ? (
              <Button variant="outline" size="sm" onClick={startReview} disabled={reviewing}>
                <Eye className="h-4 w-4" /> Start review
              </Button>
            ) : null}
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={survey.status} />
          {survey.job ? (
            <span className="font-mono text-xs text-muted-foreground">{survey.job.number}</span>
          ) : null}
          {survey.surveyor?.user ? (
            <span className="text-xs text-muted-foreground">Surveyed by {survey.surveyor.user.name}</span>
          ) : null}
          {survey.quotation ? (
            <Link to={`/admin/quotations/${survey.quotation.id}`} className="text-xs font-medium text-primary hover:underline">
              {survey.quotation.number} · {formatNpr(survey.quotation.total)}
            </Link>
          ) : null}
        </div>
        {survey.returnedReason ? (
          <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            Sent back: {survey.returnedReason}
          </p>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <SurveyFindings survey={survey} />

        <Card className="self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {canPrice ? 'Scope and pricing' : 'Scope'}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {!canPrice ? (
              <div className="space-y-3 px-6">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" aria-hidden />
                  You can see what was measured, but not what it costs.
                </p>
                <ul className="divide-y rounded-md border text-sm">
                  {survey.items?.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="min-w-0 truncate">{item.description}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{item.qty} {item.unit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : pricingLoading ? (
              <div className="px-6"><CardSkeleton /></div>
            ) : pricing ? (
              <div className="px-2">
                <SurveyPricingTable
                  lines={pricing.lines}
                  missing={pricing.missing}
                  draft={draft}
                  onChange={setDraft}
                />
              </div>
            ) : null}
          </CardContent>

          {canQuote && quotable && pricing ? (
            <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
              <Button onClick={build} disabled={!ready || building}>
                {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Build quotation
              </Button>
            </div>
          ) : null}
        </Card>
      </div>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this survey back</DialogTitle>
            <DialogDescription>
              {survey.surveyor?.user?.name ?? 'The surveyor'} gets this note by SMS, so say exactly what is missing.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            rows={4}
            placeholder="e.g. No reading for the west wall, and the damp band height is missing."
            aria-label="What the surveyor needs to add"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button onClick={sendBack} disabled={!returnNote.trim() || reviewing}>
              {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
