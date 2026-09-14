import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft, Save, Send, Copy, Loader2, ClipboardCheck } from 'lucide-react';
import {
  useGetQuotationQuery,
  useUpdateQuotationMutation,
  useSendQuotationMutation,
  useReviseQuotationMutation,
  useGetRateCardQuery,
} from '@/api/quotationsApi';
import { QuotationLineEditor, blankLine } from '@/components/quotations/QuotationLineEditor';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatNpr, paisaToRupees } from '@/helpers/format';

/**
 * Only a draft is edited in place. Once sent, the customer is deciding on those
 * figures, so the API refuses any edit (422) and a change means a revision.
 */
const isEditable = (status) => status === 'DRAFT';

export default function QuotationBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  // ACCOUNTANT and DISPATCHER can reach this page on quotations:read alone.
  const { can } = useAuth();
  const canWrite = can('quotations:write');

  const { data: quotation, isLoading, error, refetch } = useGetQuotationQuery(id);
  const { data: rateCard } = useGetRateCardQuery({ limit: 100 });
  const [update, { isLoading: saving }] = useUpdateQuotationMutation();
  const [send, { isLoading: sending }] = useSendQuotationMutation();
  const [revise, { isLoading: revising }] = useReviseQuotationMutation();

  const [lines, setLines] = useState([blankLine()]);
  const [form, setForm] = useState({ discount: 0, vatApplied: true, validUntil: '', terms: '', internalNote: '' });

  useEffect(() => {
    if (!quotation) return;
    setLines(quotation.items?.length
      ? quotation.items.map((i) => ({
          description: i.description,
          unit: i.unit ?? 'lump',
          qty: i.qty,
          rate: paisaToRupees(i.rate),
          rateCardItemId: i.rateCardItemId,
        }))
      : [blankLine()]);
    setForm({
      discount: paisaToRupees(quotation.discount),
      vatApplied: quotation.vatApplied,
      validUntil: quotation.validUntil ? quotation.validUntil.slice(0, 10) : '',
      terms: quotation.terms ?? '',
      internalNote: quotation.internalNote ?? '',
    });
  }, [quotation]);

  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;

  const frozen = !isEditable(quotation.status) || !canWrite;

  const save = async () => {
    try {
      await update({
        id,
        items: lines
          .filter((l) => l.description.trim() && Number(l.qty) > 0)
          .map((l, i) => ({ ...l, qty: Number(l.qty), rate: Number(l.rate || 0), sortOrder: i })),
        discount: Number(form.discount || 0),
        vatApplied: form.vatApplied,
        validUntil: form.validUntil || undefined,
        terms: form.terms || undefined,
        internalNote: form.internalNote || undefined,
      }).unwrap();
      dispatch(toastSuccess('Quotation saved'));
    } catch (err) {
      dispatch(toastError(err?.data?.error?.message ?? 'Could not save the quotation'));
    }
  };

  const sendToCustomer = async () => {
    try {
      const result = await send(id).unwrap();
      dispatch(toastSuccess(`Sent to ${quotation.customer?.name}`, `SMS and email with a link to approve. ${formatNpr(result.total)}`));
    } catch (err) {
      dispatch(toastError(err?.data?.error?.message ?? 'Could not send the quotation'));
    }
  };

  const makeRevision = async () => {
    try {
      const copy = await revise(id).unwrap();
      dispatch(toastSuccess(`Revision ${copy.number} created`));
      navigate(`/admin/quotations/${copy.id}`);
    } catch (err) {
      dispatch(toastError(err?.data?.error?.message ?? 'Could not create a revision'));
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title={quotation.number}
        description={`${quotation.customer?.name} · ${quotation.site?.address ?? quotation.customer?.phone}`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/quotations')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {frozen && canWrite ? (
              <Button variant="outline" size="sm" onClick={makeRevision} disabled={revising}>
                {revising ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Create revision
              </Button>
            ) : !canWrite ? null : (
              <>
                <Button variant="outline" size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                </Button>
                {quotation.status === 'DRAFT' ? (
                  <Button size="sm" onClick={sendToCustomer} disabled={sending}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
                  </Button>
                ) : null}
              </>
            )}
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={quotation.status} />
          {quotation.version > 1 ? <span className="text-xs text-muted-foreground">Version {quotation.version}</span> : null}
          {quotation.survey && can('surveys:read') ? (
            <Link to={`/admin/surveys/${quotation.survey.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden /> Built from {quotation.survey.number}
            </Link>
          ) : null}
          {quotation.sentAt ? <span className="text-xs text-muted-foreground">Sent {formatDate(quotation.sentAt)}</span> : null}
        </div>
        {!canWrite ? (
          <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            You can read this quotation but not change it.
          </p>
        ) : frozen ? (
          <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            A {quotation.status.toLowerCase()} quotation is never edited in place — the customer was sent these
            figures. Create a revision to change it and keep the history.
          </p>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Line items</CardTitle></CardHeader>
          <CardContent>
            <QuotationLineEditor
              lines={lines}
              onChange={setLines}
              rateCard={rateCard?.items ?? []}
              disabled={frozen}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Totals</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {/* These are the server's figures from the last save — the browser
                  never computes VAT, so there is only one implementation of it. */}
              <Row label="Subtotal" value={formatNpr(quotation.subtotal)} />
              <Row label="Discount" value={`− ${formatNpr(quotation.discount)}`} />
              <Row label={`VAT ${quotation.vatApplied ? `(${quotation.vatRate}%)` : '(not applied)'}`} value={formatNpr(quotation.vatAmount)} />
              <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatNpr(quotation.total)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Saved figures. Save to recalculate after editing lines.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Terms</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="discount">Discount (Rs)</Label>
                <Input
                  id="discount" type="number" min="0" step="0.01" inputMode="decimal"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  disabled={frozen}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="vat">Apply 13% VAT</Label>
                <Switch
                  id="vat" checked={form.vatApplied}
                  onCheckedChange={(v) => setForm({ ...form, vatApplied: v })}
                  disabled={frozen}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="validUntil">Valid until</Label>
                <Input
                  id="validUntil" type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  disabled={frozen}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="terms">Terms shown to the customer</Label>
                <Textarea
                  id="terms" rows={5}
                  value={form.terms}
                  onChange={(e) => setForm({ ...form, terms: e.target.value })}
                  disabled={frozen}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="internalNote">Internal note</Label>
                <Textarea
                  id="internalNote" rows={3}
                  value={form.internalNote}
                  onChange={(e) => setForm({ ...form, internalNote: e.target.value })}
                  disabled={frozen}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
