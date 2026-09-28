import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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

const TAKEN = '2026-09-19T05:30:00.000Z';
const media = (id) => ({ id, url: `/uploads/${id}.jpg`, thumb: `/uploads/${id}-400.webp`, variants: { 400: `/uploads/${id}-400.webp` } });
/** A submitted damp survey as GET /admin/surveys/:id returns it since Phase L5. */
const DAMP_SURVEY = {
  ...SURVEY,
  lead: {
    id: 'l1', name: 'सीता गुरुङ', status: 'INSPECTION_SCHEDULED',
    message: 'बर्खामा उत्तरको भित्ता चिसो हुन्छ — the north wall goes damp after rain.',
    photos: [
      { id: 'lp1', mediaId: 'mc1', caption: 'Bedroom wall from inside', url: '/uploads/mc1.jpg', thumb: '/uploads/mc1-400.webp' },
      { id: 'lp2', mediaId: 'mc2', caption: null, url: '/uploads/mc2.jpg', thumb: '/uploads/mc2-400.webp' },
    ],
  },
  site: {
    id: 's1', label: 'Home', address: 'Baluwatar-4', area: 'Kathmandu', lat: 27.7291, lng: 85.3308,
    landmark: 'Behind the Bhatbhateni store', contactName: 'राम बहादुर (caretaker)', contactPhone: '9851000001',
  },
  template: {
    id: 'it1', name: 'Damp and seepage — site checklist',
    questions: [
      { key: 'moisture', label: 'Moisture reading', labelNe: 'ओसको मात्रा', type: 'NUMBER', unit: '%', flag: { above: 20 }, required: true, photoRequired: true },
      { key: 'salt_deposits', label: 'Salt deposits on the wall', type: 'YES_NO', flag: { equals: 'yes' }, required: true, photoRequired: false },
    ],
  },
  readings: [
    { id: 'rd1', label: 'Salt deposits', metric: 'observation', value: null, textValue: 'no', questionKey: 'salt_deposits', flagged: false, mediaId: null, takenAt: TAKEN },
    { id: 'rd2', label: 'Moisture', metric: 'moisture', value: 34, unit: '%', textValue: null, questionKey: 'moisture', flagged: true, mediaId: 'mp1', location: 'North wall, 30 cm up', takenAt: TAKEN },
    { id: 'rd3', label: 'Ceiling stain', metric: 'observation', value: null, textValue: 'Brown ring near the fan', questionKey: null, flagged: false, mediaId: null, takenAt: TAKEN },
  ],
  items: [
    {
      id: 'i1', kind: 'SERVICE', description: 'Crystalline treatment', unit: 'sq.ft', qty: 240.5,
      measurements: [
        { area: 'Bedroom', description: 'North wall', nos: 1, l: 12.5, h: 10 },
        { area: 'Living room', description: 'East wall', nos: 1, l: 14, h: 10 },
        { area: 'Living room', description: 'Door', nos: 1, l: 3.5, h: 7, deduct: true },
      ],
    },
    { id: 'i2', kind: 'MATERIAL', description: 'Wall putty', unit: 'kg', qty: 40, measurements: null },
  ],
  job: {
    id: 'j1', number: 'JB-2083-0012',
    photos: [
      { id: 'p1', mediaId: 'mp1', kind: 'ISSUE', caption: 'Meter at 34%', area: 'Bedroom' },
      { id: 'p2', mediaId: 'mp2', kind: 'SKETCH', caption: 'Floor plan with sizes', area: null },
      { id: 'p3', mediaId: 'mp3', kind: 'ISSUE', caption: 'Door frame rot', area: 'Living room' },
      { id: 'p4', mediaId: 'mp4', kind: 'BEFORE', caption: null, area: 'bedroom ' },
    ],
  },
  media: Object.fromEntries(['mp1', 'mp2', 'mp3', 'mp4', 'mc1', 'mc2'].map((id) => [id, media(id)])),
};

describe('the survey review page — the site-visit kit (Phase L5)', () => {
  const renderReview = (role = 'DISPATCHER') => {
    const calls = mockApi(({ method, path }) => (method === 'GET' && path === '/admin/surveys/sv1' ? json({ data: DAMP_SURVEY }) : undefined));
    renderWithProviders(<SurveyReviewPage />, { path: '/admin/surveys/:id', initialPath: '/admin/surveys/sv1', preloadedState: signedInAs(role) });
    return calls;
  };

  it('shows what the customer wrote and the photos they sent', async () => {
    renderReview();
    expect(await screen.findByText('What the customer wrote')).toBeInTheDocument();
    expect(screen.getByText(/बर्खामा उत्तरको भित्ता चिसो हुन्छ/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Photos from the customer' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Bedroom wall from inside' })).toHaveAttribute('src', '/uploads/mc1-400.webp');
    expect(screen.getByRole('img', { name: 'Photo 2 sent by सीता गुरुङ' })).toBeInTheDocument();
  });

  it('lists a flagged reading first, marked in words, under its checklist question, with its photo', async () => {
    renderReview();
    const table = await screen.findByRole('table', { name: 'Readings' });
    const [, first, second, third] = within(table).getAllByRole('row');
    expect(first).toHaveAttribute('data-flagged', 'true');
    expect(first).toHaveClass('surface-warning');
    expect(within(first).getByText('Moisture reading')).toBeInTheDocument();
    expect(within(first).getByText('ओसको मात्रा')).toHaveAttribute('lang', 'ne');
    expect(within(first).getByText(/Flagged — above 20 %/)).toBeInTheDocument();
    expect(first).toHaveTextContent('34 %');
    expect(within(first).getByRole('img', { name: 'Photo for Moisture reading' })).toHaveAttribute('src', '/uploads/mp1-400.webp');
    expect(within(second).getByText('Salt deposits on the wall')).toBeInTheDocument();
    expect(within(second).getByText('No')).toBeInTheDocument();
    expect(second).not.toHaveAttribute('data-flagged');
    expect(within(third).getByText('Ceiling stain')).toBeInTheDocument();
    expect(screen.getByText('1 flagged')).toBeInTheDocument();
    expect(screen.getByText('Checklist: Damp and seepage — site checklist')).toBeInTheDocument();
  });

  it('shows each measured line’s sheet — a door as a deduction — with the server’s quantity', async () => {
    const calls = renderReview();
    const sheet = await screen.findByRole('table', { name: 'Measurement sheet for Crystalline treatment' });
    const [, bedroom, , door] = within(sheet).getAllByRole('row');
    expect(bedroom).toHaveTextContent('Bedroom');
    expect(bedroom).toHaveTextContent('12.5');
    expect(within(bedroom).getAllByRole('cell').at(-1)).toHaveTextContent('125');
    expect(within(door).getByText('− deduction')).toBeInTheDocument();
    expect(within(door).getAllByRole('cell').at(-1)).toHaveTextContent('−24.5');
    expect(screen.getByTestId('measured-qty-i1')).toHaveTextContent('240.5 sq.ft');
    expect(screen.queryByRole('table', { name: /Wall putty/ })).not.toBeInTheDocument();
    // The reader who cannot price still sees the scope, the measured line marked — and nothing asks for a price.
    expect(screen.getByText('(measured)')).toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/pricing'))).toBe(false);
  });

  it('groups the site photos by area, “No area” last, with each kind — a sketch too', async () => {
    renderReview();
    await screen.findByText('Site photos');
    const groups = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')).filter((name) => !name.startsWith('Measurements'));
    expect(groups).toEqual(['Bedroom', 'Living room', 'No area']);
    const bedroom = screen.getByRole('region', { name: 'Bedroom' });
    expect(within(bedroom).getAllByRole('img')).toHaveLength(2);
    expect(within(bedroom).getByText('Issue found')).toBeInTheDocument();
    expect(within(bedroom).getByRole('img', { name: 'Before photo — Bedroom' })).toBeInTheDocument();
    const none = screen.getByRole('region', { name: 'No area' });
    expect(within(none).getByText('Sketch')).toBeInTheDocument();
    expect(within(none).getByText(/Floor plan with sizes/)).toBeInTheDocument();
  });

  it('opens the site pin in Maps and calls the site contact', async () => {
    renderReview();
    const pin = await screen.findByRole('link', { name: /Open the pin in Maps/ });
    expect(pin).toHaveAttribute('href', 'https://www.google.com/maps?q=27.7291,85.3308');
    expect(pin).toHaveAttribute('target', '_blank');
    expect(pin).toHaveAttribute('rel', 'noreferrer');
    expect(screen.getByText('Behind the Bhatbhateni store')).toBeInTheDocument();
    expect(screen.getByText('राम बहादुर (caretaker)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '9851000001' })).toHaveAttribute('href', 'tel:9851000001');
  });
});

describe('the survey review page → a BOQ with measured rows (Phase L5)', () => {
  it('carries a measured line’s rows into the quotation, so the BOQ row derives the survey’s quantity', async () => {
    const user = userEvent.setup();
    const rows = [
      { area: 'बैठक कोठा', description: 'North wall', nos: 1, l: 12.5, b: null, h: 10, deduct: false },
      { area: 'बैठक कोठा', description: 'Door', nos: 1, l: 3, b: null, h: 7, deduct: true },
    ];
    const pricing = {
      surveyId: 'sv1', subtotal: 2290000, missing: [],
      lines: [{
        surveyItemId: 'l1', kind: 'SERVICE', description: 'Wall putty two coats', unit: 'sq.ft', qty: 104, rawQty: 104, wastagePct: 0,
        isOptional: false, note: null, rateCardItemId: 'rc9', materialId: null, ratePaisa: 2200, amountPaisa: 228800, measurements: rows,
      }],
    };
    const calls = mockApi(({ method, path, body }) => {
      if (method === 'GET' && path === '/admin/surveys/sv1') return json({ data: { ...SURVEY, items: [{ id: 'l1', description: 'Wall putty two coats', unit: 'sq.ft', qty: 104, measurements: rows }] } });
      if (method === 'GET' && path === '/admin/surveys/sv1/pricing') return json({ data: pricing });
      if (method === 'POST' && path === '/admin/quotations/preview') {
        return json({ data: { items: body.items.map((row, index) => ({ index, rowType: 'ITEM', amount: 228800 })), totals: { subtotal: 228800, optionalTotal: 0, discount: 0, vatApplied: true, vatRate: 13, vatAmount: 0, total: 0, sections: [] } } });
      }
      if (method === 'POST' && path === '/admin/surveys/sv1/quotation') return json({ data: { quotation: { id: 'q6', number: 'QT-2083-0006' } } }, 201);
      return undefined;
    });
    renderWithProviders(<SurveyReviewPage />, {
      path: '/admin/surveys/:id', initialPath: '/admin/surveys/sv1', preloadedState: signedInAs('SALES'),
      routes: [{ path: '/admin/quotations/:id', element: <p>Builder</p> }],
    });

    const build = await screen.findByRole('button', { name: /Build quotation/ });
    await waitFor(() => expect(build).toBeEnabled());
    await user.click(build);
    await waitFor(() => expect(calls.find((c) => c.path === '/admin/surveys/sv1/quotation')?.body.items).toEqual([
      {
        rowType: 'ITEM', kind: 'SERVICE', rateCardItemId: 'rc9', description: 'Wall putty two coats', unit: 'sq.ft', qty: 104,
        measurements: rows, wastagePct: 0, isOptional: false, rate: 22,
      },
    ]));
  });
});
