import { useEffect, useMemo, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { usePreviewQuotationQuery } from '@/api/quotationsApi';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { previewRequest, serverFiguresByKey } from '@/helpers/boq';

/** The saved quotation's figures, as the builder shows them when nothing is being edited. */
function savedFigures(q) {
  const items = q?.items ?? [];
  return {
    figures: serverFiguresByKey(items, items.map((i) => i.id), q?.boq?.sections),
    totals: {
      subtotal: q?.subtotal, discount: q?.discount, vatApplied: q?.vatApplied, vatRate: q?.vatRate,
      vatAmount: q?.vatAmount, total: q?.total, optionalTotal: q?.boq?.optionalTotal ?? 0, sections: q?.boq?.sections ?? [],
    },
    cost: q?.boq?.cost ?? null,
    stages: q?.paymentStages ?? [],
  };
}

/**
 * What the builder shows for amounts, totals and margin — always the server's (Phase L3).
 *
 * With nothing edited, the saved quotation's. While the form has edits, the live preview: the rows as typed go
 * to `POST /admin/quotations/preview` (debounced; rows that cannot be priced yet are left out and counted in
 * `skipped`), and each row's figures are matched back to it by its key. Until the first answer the saved figures
 * stay up, marked `stale`; a newer edit keeps the last answer up, also `stale`, until its own arrives.
 *
 * @param {{ quotation: object, values: object|null, dirty: boolean, enabled: boolean }} opts
 * The payment schedule's amounts come the same way (Phase L4): the saved stages', or the preview's for the schedule
 * on screen — a schedule is sent with the preview only when it is whole (100 %), and `stages` is null until then.
 *
 * @returns {{ figures: Map<string, object>, totals: object, cost: object|null, stages: object[]|null, stale: boolean,
 *   live: boolean, skipped: number, error: object|null }}
 */
export function useBoqFigures({ quotation, values, dirty, enabled }) {
  const saved = useMemo(() => savedFigures(quotation), [quotation]);
  const active = Boolean(enabled && dirty && values);
  const settled = useDebouncedValue(active ? values : null, 400);
  const request = useMemo(
    () => (active && settled ? previewRequest(settled, { quotationId: quotation?.id }) : null),
    [active, settled, quotation?.id],
  );
  const bodyKey = request ? JSON.stringify(request.body) : null;
  const { currentData, error, isFetching } = usePreviewQuotationQuery(request ? request.body : skipToken);
  const [answer, setAnswer] = useState(null);

  useEffect(() => {
    if (currentData && request) {
      setAnswer({ bodyKey, keys: request.keys, skipped: request.skipped, stagesSent: request.stagesSent, data: currentData });
    }
  }, [currentData, bodyKey]); // eslint-disable-line react-hooks/exhaustive-deps -- `request` is `bodyKey`'s

  // A save (or a reload) makes the saved figures current again.
  useEffect(() => {
    if (!dirty) setAnswer(null);
  }, [dirty, quotation]);

  const live = useMemo(() => (answer ? {
    figures: serverFiguresByKey(answer.data.items, answer.keys, answer.data.totals?.sections),
    totals: answer.data.totals,
    cost: answer.data.cost ?? null,
    // Only a whole schedule is sent; while the one on screen is not, no stage has an amount.
    stages: answer.stagesSent ? answer.data.paymentStages ?? [] : null,
  } : null), [answer]);

  if (!active) return { ...saved, stale: false, live: false, skipped: 0, error: null };
  const waiting = settled !== values || isFetching || !answer || answer.bodyKey !== bodyKey;
  return {
    ...(live ?? saved),
    stale: waiting,
    live: Boolean(live),
    skipped: answer?.skipped ?? request?.skipped ?? 0,
    error: error && !isFetching ? error : null,
  };
}
