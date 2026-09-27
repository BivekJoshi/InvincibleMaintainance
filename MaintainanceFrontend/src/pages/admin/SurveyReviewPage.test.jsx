import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SurveyReviewPage from '@/pages/admin/SurveyReviewPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

const SURVEY = {
  id: 'sv1', number: 'SV-2083-0004', status: 'SUBMITTED', submittedAt: '2026-09-20T04:00:00.000Z', createdAt: '2026-09-19T04:00:00.000Z',
  customer: { id: 'c1', name: 'सीता गुरुङ', phone: '9841500005' }, service: { name: 'Seepage treatment' },
  diagnosis: 'Rising damp on the north wall.', readings: [], media: [], items: [],
};
const PRICING = {
  surveyId: 'sv1', subtotal: 0, missing: [{ surveyItemId: 'l3', description: 'Skirting touch-up', reason: 'Priced by hand' }],
  lines: [
    { surveyItemId: 'l1', kind: 'SERVICE', description: 'Crystalline treatment', unit: 'sq.ft', qty: 240, rawQty: 240, wastagePct: 0, isOptional: false, note: 'North and east walls', rateCardItemId: 'rc1', materialId: null, ratePaisa: 22000, amountPaisa: 5280000 },
    { surveyItemId: 'l2', kind: 'MATERIAL', description: 'Wall putty', unit: 'kg', qty: 42, rawQty: 40, wastagePct: 5, isOptional: true, note: null, rateCardItemId: null, materialId: 'm7', ratePaisa: 5800, amountPaisa: 243600 },
    { surveyItemId: 'l3', kind: 'OTHER', description: 'Skirting touch-up', unit: 'rft', qty: 30, rawQty: 30, wastagePct: 0, isOptional: false, note: null, rateCardItemId: null, materialId: null, ratePaisa: null, amountPaisa: null },
  ],
};

describe('the survey review page → a BOQ (Phase L3)', () => {
  it('sends every line with its kind, material, wastage and note — an optional one as an optional row — and shows the server’s amounts', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path, body }) => {
      if (method === 'GET' && path === '/admin/surveys/sv1') return json({ data: SURVEY });
      if (method === 'GET' && path === '/admin/surveys/sv1/pricing') return json({ data: PRICING });
      if (method === 'POST' && path === '/admin/quotations/preview') {
        return json({ data: {
          items: body.items.map((row, index) => ({ index, rowType: 'ITEM', amount: [5280000, 243600, 450000][index] ?? 0 })),
          totals: { subtotal: 5280000 + (body.items.length > 2 ? 450000 : 0), optionalTotal: 243600, discount: 0, vatApplied: true, vatRate: 13, vatAmount: 0, total: 0, sections: [] },
        } });
      }
      if (method === 'POST' && path === '/admin/surveys/sv1/quotation') return json({ data: { quotation: { id: 'q5', number: 'QT-2083-0005' } } }, 201);
      return undefined;
    });
    const { router } = renderWithProviders(<SurveyReviewPage />, {
      path: '/admin/surveys/:id', initialPath: '/admin/surveys/sv1', preloadedState: signedInAs('SALES'),
      routes: [{ path: '/admin/quotations/:id', element: <p>Builder</p> }],
    });

    // The optional line is shown, counted out of the total, not dropped.
    const putty = await screen.findByRole('checkbox', { name: 'Count Wall putty in the total' });
    expect(putty).not.toBeChecked();
    expect(screen.getByText('optional — shown, not in the total')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Build quotation/ })).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Rate for Skirting touch-up' }), '1,500');
    await waitFor(() => expect(screen.getByTestId('survey-subtotal')).toHaveTextContent('57,300.00'), { timeout: 3000 });
    expect(screen.getByText('(Rs. 2,436.00)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Build quotation/ }));
    await waitFor(() => expect(calls.find((c) => c.path === '/admin/surveys/sv1/quotation')?.body).toEqual({
      items: [
        { rowType: 'ITEM', kind: 'SERVICE', rateCardItemId: 'rc1', description: 'Crystalline treatment', unit: 'sq.ft', qty: 240, wastagePct: 0, isOptional: false, spec: 'North and east walls', rate: 220 },
        { rowType: 'ITEM', kind: 'MATERIAL', materialId: 'm7', description: 'Wall putty', unit: 'kg', qty: 40, wastagePct: 5, isOptional: true, rate: 58 },
        { rowType: 'ITEM', kind: 'OTHER', description: 'Skirting touch-up', unit: 'rft', qty: 30, wastagePct: 0, isOptional: false, rate: 1500 },
      ],
    }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/quotations/q5'));
  });
});
