import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import JobMeasurePage from '@/pages/tech/JobMeasurePage/JobMeasurePage';
import TechJobPage from '@/pages/tech/TechJobPage/TechJobPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';
import { resetFieldDbForTests } from '@/helpers/fieldDb';
import { fieldSyncSettled } from '@/hooks/useOfflineQueue';
import uiReducer from '@/redux/slices/uiSlice';
import { measureBody, measureProblem, rowsFromLine, sameAsSaved } from './jobMeasure';

vi.mock('@/hooks/useIdlePreload', () => ({ useIdlePreload: () => {} }));

/**
 * Phase L8 — the final measurement on a phone at 360 px: the job's lines and where each stands, one card per row
 * (feet-inches, a deduction, the preview), the rows saved as numbers with the office's quantity shown back, a closed
 * measurement read only, a refusal in words, no signal, and Nepali. **No money**: the lines come without a rate, the
 * screen shows none, and the request carries none.
 */

let online;
beforeEach(() => {
  resetFieldDbForTests();
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  window.innerWidth = 360;
  window.dispatchEvent(new Event('resize'));
});
afterEach(async () => {
  cleanup();
  await new Promise((r) => { setTimeout(r, 30); });
  await fieldSyncSettled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** As `/tech/jobs/:id` answers it: the lines without a rate (the API's `fieldSafe`), the quotation's contract type. */
const JOB = {
  id: 'j9', number: 'JOB-2083-0090', title: 'Terrace waterproofing', type: 'RENOVATION', status: 'IN_PROGRESS', priority: 'NORMAL',
  customer: { id: 'c1', name: 'राबिन महर्जन', phone: '9841234567' }, site: { address: 'Jhamsikhel' },
  quotation: { id: 'q9', number: 'QT-2083-0031', status: 'CONVERTED', contractType: 'ITEM_RATE' },
  measurementClosedAt: null,
  tasks: [], photos: [], materials: [], timeLogs: [], media: {},
  lines: [
    {
      id: 'l1', number: 'A.1', section: 'Waterproofing', source: 'QUOTATION', description: 'Crystalline slurry, two coats', unit: 'sq.ft',
      quotedQty: 240, isProvisional: false, progressPct: 100, measurements: [{ area: 'Terrace', description: 'Slab', l: 21, b: 12 }], measuredQty: 252,
    },
    {
      id: 'l2', number: 'A.2', section: 'Waterproofing', source: 'QUOTATION', description: 'Parapet wall', unit: 'sq.ft',
      quotedQty: 80, isProvisional: true, progressPct: 100, measurements: null, measuredQty: null,
    },
    {
      id: 'l3', number: 'B.1', section: 'Variation VO-2083-0001', source: 'VARIATION', description: 'Exterior weather coat (omitted)', unit: 'sq.ft',
      quotedQty: -100, isProvisional: false, progressPct: 0, measurements: null, measuredQty: null,
    },
  ],
};

const MONEY_TEXT = /Rs\.?\s|रु\.|rate|amount|price|cost/i;
const MONEY_KEY = /^(rate|amount|total|subtotal|cost|price|value|earned|vat|discount)/i;
const keysOf = (value) => (Array.isArray(value) ? value.flatMap(keysOf)
  : value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)]) : []);

/** The field API; a measure the server took is on the job it answers next (the refetch after the save). */
function api({ job = JOB, put } = {}) {
  let current = job;
  return mockApi(async ({ method, path, body }) => {
    if (method === 'GET' && path === `/tech/jobs/${job.id}`) return json({ data: current });
    if (method === 'PUT' && path.startsWith(`/tech/jobs/${job.id}/lines/`)) {
      const lineId = path.split('/').at(-2);
      const answer = await put(body, lineId);
      if (answer.ok) {
        const line = (await answer.clone().json()).data;
        current = { ...current, lines: current.lines.map((l) => (l.id === lineId ? { ...l, ...line } : l)) };
      }
      return answer;
    }
    if (method === 'GET' && path === '/tech/materials') return json({ data: [] });
    if (method === 'GET' && path.startsWith(`/tech/jobs/${job.id}/diary/`)) return json({ data: { day: path.split('/').pop(), entry: null, lines: [], trades: [], materials: [] } });
    return undefined;
  });
}

const renderMeasure = (path, { locale = 'en' } = {}) => renderWithProviders(
  <Routes>
    <Route path="/tech/jobs/:id/measure" element={<JobMeasurePage />} />
    <Route path="/tech/jobs/:id" element={<TechJobPage />} />
  </Routes>,
  {
    path: '*',
    initialPath: path,
    preloadedState: { ...signedInAs('TECHNICIAN'), ui: { ...uiReducer(undefined, { type: '@@init' }), locale } },
  },
);

describe('the final measurement on a phone (Phase L8.2)', () => {
  it('the job sheet links it; the lines say where each stands — measured, to measure, an omission — with no money', async () => {
    const user = userEvent.setup();
    api();
    renderMeasure('/tech/jobs/j9');
    await user.click(await screen.findByRole('link', { name: /Final measurement/ }));
    const list = await screen.findByTestId('measure-lines');
    expect(screen.getByRole('heading', { name: 'Final measurement' })).toBeInTheDocument();
    expect(within(screen.getByTestId('measure-line-l1')).getByText('Measured: 252 sq.ft')).toBeInTheDocument();
    expect(within(screen.getByTestId('measure-line-l2')).getByText('To measure')).toBeInTheDocument();
    const omission = screen.getByTestId('measure-line-l3');
    expect(within(omission).getByText('Omitted — keeps its quoted quantity')).toBeInTheDocument();
    expect(within(omission).queryByRole('link')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('measure-line-l1')).getByRole('link')).toHaveAttribute('href', '/tech/jobs/j9/measure?line=l1');
    expect(list.textContent).not.toMatch(MONEY_TEXT);
  });

  it('measures a line room by room — one card per row, feet-inches, a door deducted — and saves the rows as numbers', async () => {
    const user = userEvent.setup();
    const puts = [];
    api({
      put: (body, lineId) => {
        puts.push({ body, lineId });
        return json({ data: { ...JOB.lines[1], measurements: body.measurements, measuredQty: 190.5 } });
      },
    });
    const { store } = renderMeasure('/tech/jobs/j9/measure?line=l2');
    expect(await screen.findByRole('heading', { name: 'A.2 · Parapet wall' })).toBeInTheDocument();
    expect(screen.getByText('No rows yet — add a room to start.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Room or area'), 'छत');
    await user.click(screen.getByRole('button', { name: 'Add a room' }));
    let cards = screen.getAllByTestId('measurement-card');
    expect(cards).toHaveLength(1);
    await user.type(within(cards[0]).getByLabelText('What'), 'North parapet');
    await user.type(within(cards[0]).getByLabelText('Length'), '60\'');
    await user.type(within(cards[0]).getByLabelText('Height'), '3\'6"');
    expect(within(cards[0]).getByText('= 3.5 ft')).toBeInTheDocument();
    expect(within(cards[0]).getByTestId('row-value')).toHaveTextContent('= 210 sq.ft');

    await user.click(screen.getByRole('button', { name: 'Add a row in छत' }));
    cards = screen.getAllByTestId('measurement-card');
    expect(cards).toHaveLength(2);
    await user.type(within(cards[1]).getByLabelText('What'), 'Drain opening');
    await user.type(within(cards[1]).getByLabelText('Length'), '6\'6"');
    await user.type(within(cards[1]).getByLabelText('Height'), '3');
    await user.click(within(cards[1]).getByRole('switch'));
    expect(within(cards[1]).getByTestId('row-value')).toHaveTextContent('= −19.5 sq.ft');
    expect(screen.getByTestId('room-total')).toHaveTextContent('Room: 190.5 sq.ft');
    expect(screen.getByTestId('line-total')).toHaveTextContent('This line: 190.5 sq.ft');
    expect(screen.getByTestId('measure-unsaved')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save measurements' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0].lineId).toBe('l2');
    expect(puts[0].body).toEqual({
      measurements: [
        { area: 'छत', description: 'North parapet', l: 60, h: 3.5 },
        { area: 'छत', description: 'Drain opening', l: 6.5, h: 3, deduct: true },
      ],
    });
    expect(keysOf(puts[0].body).filter((k) => MONEY_KEY.test(k))).toEqual([]);
    expect(await screen.findByTestId('office-qty')).toHaveTextContent('Saved — office quantity: 190.5 sq.ft');
    expect(store.getState().ui.toasts.map((t) => t.title)).toContain('Measurements saved');
    expect(document.body.textContent).not.toMatch(/Rs\.?\s|रु\./);
  });

  it('a row that does not read, or nothing to save, is said before anything is sent', async () => {
    const user = userEvent.setup();
    const put = vi.fn();
    api({ put });
    renderMeasure('/tech/jobs/j9/measure?line=l2');
    await user.click(await screen.findByRole('button', { name: 'Save measurements' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Add at least one row that reads.');
    await user.click(screen.getByRole('button', { name: 'Add a room' }));
    await user.type(within(screen.getByTestId('measurement-card')).getByLabelText('Length'), 'twelve');
    expect(screen.getByText('Could not read this — type 12\'6" or 12.5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save measurements' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This row is not saved until every size reads.');
    expect(put).not.toHaveBeenCalled();
  });

  it('with no signal it says so and sends nothing', async () => {
    const user = userEvent.setup();
    const put = vi.fn();
    api({ put });
    renderMeasure('/tech/jobs/j9/measure?line=l1');
    expect(await screen.findAllByTestId('measurement-card')).toHaveLength(1);
    online = false;
    await user.clear(within(screen.getByTestId('measurement-card')).getByLabelText('Length'));
    await user.type(within(screen.getByTestId('measurement-card')).getByLabelText('Length'), '22');
    await user.click(screen.getByRole('button', { name: 'Save measurements' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No signal. Measurements save only with signal');
    expect(put).not.toHaveBeenCalled();
  });

  it('the office’s refusal is said in words — MEASUREMENT_CLOSED — and a closed measurement is read only', async () => {
    const user = userEvent.setup();
    let closed = false;
    mockApi(({ method, path }) => {
      if (method === 'GET' && path === '/tech/jobs/j9') return json({ data: closed ? { ...JOB, measurementClosedAt: '2026-09-27T09:00:00.000Z' } : JOB });
      if (method === 'PUT') {
        closed = true;
        return json({ error: { code: 'MEASUREMENT_CLOSED', message: 'The measurement is closed. Reopen it to change a quantity.' } }, 422);
      }
      return undefined;
    });
    renderMeasure('/tech/jobs/j9/measure?line=l1');
    await screen.findAllByTestId('measurement-card');
    await user.click(screen.getByRole('button', { name: 'Save measurements' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The office has closed the measurement. Ask them to reopen it to change a quantity.');
    // The job is read again: now closed, the sheet is read only.
    expect(await screen.findByTestId('measure-closed')).toHaveTextContent('The measurement is closed — the office bills from it.');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save measurements' })).not.toBeInTheDocument());
    expect(within(screen.getByTestId('measurement-card')).getByLabelText('Length')).toBeDisabled();
  });

  it('reads in Nepali', async () => {
    api();
    renderMeasure('/tech/jobs/j9/measure?line=l1', { locale: 'ne' });
    expect(await screen.findByRole('heading', { name: 'अन्तिम नापजाँच' })).toBeInTheDocument();
    const card = screen.getByTestId('measurement-card');
    expect(within(card).getByLabelText('लम्बाइ')).toHaveValue('21');
    expect(within(card).getByTestId('row-value')).toHaveTextContent('= 252 sq.ft');
    expect(screen.getByTestId('office-qty')).toHaveTextContent('सुरक्षित — अफिसको परिमाण: 252 sq.ft');
    expect(screen.getByRole('button', { name: 'नाप सुरक्षित गर्नुहोस्' })).toBeInTheDocument();
  });
});

describe('jobMeasure — the screen without a DOM', () => {
  it('turns the server’s rows into cards and back, knows when they are saved, and never carries money', () => {
    const rows = rowsFromLine(JOB.lines[0]);
    expect(rows[0]).toMatchObject({ area: 'Terrace', description: 'Slab', l: 21, b: 12, nos: '', h: '', deduct: false });
    expect(sameAsSaved(rows, JOB.lines[0])).toBe(true);
    expect(sameAsSaved([{ ...rows[0], l: '22' }], JOB.lines[0])).toBe(false);
    expect(measureBody([{ ...rows[0], l: '21\'6"' }, { _key: 'x', area: '', description: '', nos: '', l: '', b: '', h: '' }]))
      .toEqual({ measurements: [{ area: 'Terrace', description: 'Slab', l: 21.5, b: 12 }] });
    expect(measureProblem([])).toBe('needRow');
    expect(measureProblem([{ l: 'abc' }])).toBe('notSaved');
    expect(measureProblem(Array.from({ length: 201 }, () => ({ nos: 1 })))).toBe('tooMany');
    expect(measureProblem(rows)).toBeNull();
  });
});
