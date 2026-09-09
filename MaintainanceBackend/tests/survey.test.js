import { describe, it, expect } from 'vitest';
import { documentTotals, lineAmount, toPaisa, toRupees } from '../src/utils/money.js';
import { surveySaveSchema, surveyReviewSchema, surveyQuotationSchema } from '../src/shared/schemas/survey.js';

/**
 * The survey -> quotation bridge is the one place paisa crosses back into the
 * rupee wire format, so its round trip gets a fixture of its own. Passing paisa
 * straight into a quotation line would multiply every quotation by 100 — with
 * VAT computed on it and an SMS sent to the customer.
 */
describe('survey pricing crosses to a quotation without drift', () => {
  it('round-trips paisa through the rupee wire format exactly', () => {
    for (const paisa of [1, 99, 100, 1234567, 220 * 100, 99_99_99_999]) {
      expect(toPaisa(toRupees(paisa))).toBe(paisa);
    }
  });

  it('lands a priced survey on the same subtotal after the quotation rebuilds it', () => {
    // What priceSurvey() produces: paisa rates against measured quantities.
    const priced = [
      { qty: 320, ratePaisa: 22000 },   // 320 sq.ft seepage treatment @ Rs 220
      { qty: 320, ratePaisa: 9500 },    // 320 sq.ft plaster @ Rs 95
      { qty: 12.5, ratePaisa: 16500 },  // 12.5 rft crack epoxy @ Rs 165
    ];
    const surveySubtotal = priced.reduce((t, l) => t + lineAmount(l.qty, l.ratePaisa), 0);

    // What buildQuotationFromSurvey hands to createQuotation, and what
    // buildTotals does with it on the way back in.
    const wire = priced.map((l) => ({ qty: l.qty, rate: toRupees(l.ratePaisa) }));
    const totals = documentTotals(wire.map((i) => ({ ...i, rate: toPaisa(i.rate) })), { vatApplied: false });

    expect(totals.subtotal).toBe(surveySubtotal);
    // 320 x 220 + 320 x 95 + 12.5 x 165 = Rs 102,862.50
    expect(totals.subtotal).toBe(10_286_250);
  });

  it('rounds the quantity for wastage, never the money per line', () => {
    // 0.1 * 1.15 is 0.11499999999999999 in float — rounded at the quantity, once.
    const effective = (qty, pct) => Math.round(qty * (1 + pct / 100) * 1000) / 1000;
    expect(effective(0.1, 15)).toBe(0.115);
    expect(effective(320, 10)).toBe(352);
    // VAT still lands at document level, not per line.
    const t = documentTotals([{ qty: effective(320, 10), rate: 22000 }], { vatRate: 13 });
    expect(t.subtotal).toBe(7_744_000);
    expect(t.vatAmount).toBe(1_006_720);
  });
});

describe('a survey payload cannot carry money', () => {
  const line = { description: 'Crystalline waterproofing', unit: 'sq.ft', qty: 320 };

  it('accepts quantities', () => {
    const r = surveySaveSchema.safeParse({ items: [{ ...line, wastagePct: 10 }] });
    expect(r.success).toBe(true);
    expect(r.data.items[0].qty).toBe(320);
  });

  it('rejects a rate or an amount outright rather than ignoring it', () => {
    expect(surveySaveSchema.safeParse({ items: [{ ...line, rate: 220 }] }).success).toBe(false);
    expect(surveySaveSchema.safeParse({ items: [{ ...line, amount: 70400 }] }).success).toBe(false);
    expect(surveySaveSchema.safeParse({ items: [{ ...line, sellRate: 220 }] }).success).toBe(false);
  });

  it('needs a measurement or an observation on every reading', () => {
    expect(surveySaveSchema.safeParse({ readings: [{ label: 'West wall', metric: 'moisture', value: 18.4 }] }).success).toBe(true);
    expect(surveySaveSchema.safeParse({ readings: [{ label: 'DPC', textValue: 'none visible' }] }).success).toBe(true);
    expect(surveySaveSchema.safeParse({ readings: [{ label: 'West wall' }] }).success).toBe(false);
  });

  it('keeps Devanagari findings intact', () => {
    const r = surveySaveSchema.safeParse({
      diagnosis: 'छतबाट पानी चुहिएको छ',
      items: [{ ...line, description: 'छत वाटरप्रुफिङ' }],
    });
    expect(r.success).toBe(true);
    expect(r.data.diagnosis).toBe('छतबाट पानी चुहिएको छ');
    expect(r.data.items[0].description).toBe('छत वाटरप्रुफिङ');
  });
});

describe('review and quotation input', () => {
  it('makes a reviewer say why a survey is going back', () => {
    expect(surveyReviewSchema.safeParse({ status: 'RETURNED' }).success).toBe(false);
    expect(surveyReviewSchema.safeParse({ status: 'RETURNED', note: 'Missing the west wall reading' }).success).toBe(true);
    expect(surveyReviewSchema.safeParse({ status: 'IN_REVIEW' }).success).toBe(true);
    expect(surveyReviewSchema.safeParse({ status: 'QUOTED' }).success).toBe(false);
  });

  it('takes quotation rates in rupees, the way every other quotation endpoint does', () => {
    const r = surveyQuotationSchema.safeParse({
      items: [{ description: 'Seepage treatment', unit: 'sq.ft', qty: 320, rate: 220 }],
      discount: 500,
    });
    expect(r.success).toBe(true);
    expect(r.data.items[0].rate).toBe(220);
    expect(r.data.includeOptional).toBe(false);
  });
});
