import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import SiteDiaryPage from '@/pages/tech/SiteDiaryPage/SiteDiaryPage';
import TechJobPage from '@/pages/tech/TechJobPage/TechJobPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';
import { resetFieldDbForTests } from '@/helpers/fieldDb';
import { enqueue, pending } from '@/helpers/offlineQueue';
import { pendingUploads } from '@/helpers/uploadQueue';
import { resetSentPhotosForTests } from '@/helpers/sentPhotos';
import { addDaysTo, ktmDay } from '@/helpers/dispatchBoard';
import { fieldSyncSettled, loadFieldQueue, syncFieldQueue } from '@/hooks/useOfflineQueue';
import uiReducer from '@/redux/slices/uiSlice';

vi.mock('@/hooks/useIdlePreload', () => ({ useIdlePreload: () => {} }));
// jsdom cannot decode a picture: the photo goes as it was chosen.
vi.mock('@/helpers/compressImage', () => ({ compressImage: async (file) => file }));

let online;
beforeEach(() => {
  resetFieldDbForTests();
  resetSentPhotosForTests();
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

const today = ktmDay();
const yesterday = addDaysTo(today, -1);

const JOB = {
  id: 'j1', number: 'JOB-2083-0090', title: 'Terrace waterproofing', type: 'RENOVATION', status: 'IN_PROGRESS', priority: 'NORMAL',
  customer: { id: 'c1', name: 'राबिन महर्जन', phone: '9841234567' }, site: { address: 'Jhamsikhel' },
  tasks: [], photos: [], materials: [], timeLogs: [], media: {},
};

/** The day as the field API answers it: lines with no rate, the trades, the materials. */
const DAY = {
  day: today,
  entry: null,
  lines: [
    { id: 'l1', number: 'A.1', section: 'Waterproofing', source: 'QUOTATION', description: 'Crystalline slurry, two coats', unit: 'sq.ft', quotedQty: 240, progressPct: 10 },
    { id: 'l2', number: 'A.2', section: 'Waterproofing', source: 'QUOTATION', description: 'Drain chamber', unit: 'nos', quotedQty: 2, progressPct: 0 },
    { id: 'l3', number: 'B.1', section: 'Painting', source: 'VARIATION', description: 'Parapet touch-up', unit: 'rft', quotedQty: 40, progressPct: 0 },
  ],
  trades: [{ id: 'tr1', code: 'MASON', name: 'Mason' }, { id: 'tr2', code: 'HELPER', name: 'Helper' }],
  materials: [{ id: 'm1', code: 'WP-CRYST', name: 'Crystalline slurry', unit: 'kg' }],
};

const MONEY = /rate|amount|cost|price|total|paisa|margin|Rs\.?\s/i;

function api({ job = JOB, day = DAY, days, sync } = {}) {
  return mockApi(({ method, path, body }) => {
    if (method === 'GET' && path === `/tech/jobs/${job.id}`) return json({ data: job });
    if (method === 'GET' && path === `/tech/jobs/${job.id}/diary`) return json({ data: { today, days: days ?? [] } });
    if (method === 'GET' && path.startsWith(`/tech/jobs/${job.id}/diary/`)) return json({ data: { ...day, day: path.split('/').pop() } });
    if (method === 'GET' && path === '/tech/materials') return json({ data: DAY.materials });
    if (method === 'POST' && path === '/tech/sync') {
      return sync ? sync(body) : json({ data: { results: body.mutations.map((m) => ({ idempotencyKey: m.idempotencyKey, status: 'applied' })) } });
    }
    if (method === 'POST' && path === `/tech/jobs/${job.id}/photos`) {
      return json({ data: { photos: [{ id: 'p9', mediaId: 'm-new', kind: 'DURING' }], media: [{ id: 'm-new', thumb: '/uploads/m-new-400.webp' }] } }, 201);
    }
    return undefined;
  });
}

const renderDiary = (path, { locale = 'en', role = 'TECHNICIAN' } = {}) => renderWithProviders(
  <Routes>
    <Route path="/tech/jobs/:id/diary" element={<SiteDiaryPage />} />
    <Route path="/tech/jobs/:id/diary/:day" element={<SiteDiaryPage />} />
    <Route path="/tech/jobs/:id" element={<p>Job sheet</p>} />
  </Routes>,
  {
    path: '*',
    initialPath: path,
    preloadedState: { ...signedInAs(role), ui: { ...uiReducer(undefined, { type: '@@init' }), locale } },
  },
);

const saves = async () => (await pending()).filter((m) => m.kind === 'diary_save');

describe('SiteDiaryPage — one day at 360 px', () => {
  it('files a day offline: weather, crew per trade, progress in 5 % steps, a delivery with its challan, lost time and why — one diary_save, no money', async () => {
    online = false;
    const user = userEvent.setup();
    const calls = api();
    const { store } = renderDiary(`/tech/jobs/j1/diary/${today}`);

    expect(await screen.findByRole('heading', { name: /Site diary/ })).toBeInTheDocument();
    // The lines by section, starting where the job stands; a variation's line too.
    expect(screen.getByRole('region', { name: 'Waterproofing' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Painting' })).toBeInTheDocument();
    expect(screen.getByTestId('progress-pct-l1')).toHaveTextContent('10%');
    expect(screen.getByText('of 240 sq.ft')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Rain/ }));
    await user.click(screen.getByRole('button', { name: 'One more: Mason' }));
    await user.click(screen.getByRole('button', { name: 'One more: Mason' }));
    await user.click(screen.getByRole('button', { name: 'One more: Mason' }));
    await user.click(screen.getByRole('button', { name: 'One more: Helper' }));
    expect(screen.getByTestId('headcount-total')).toHaveTextContent('4 people today');
    for (let i = 0; i < 3; i += 1) await user.click(screen.getByRole('button', { name: '5% more: A.1 Crystalline slurry, two coats' }));
    expect(screen.getByTestId('progress-pct-l1')).toHaveTextContent('25%');
    await user.click(screen.getByRole('button', { name: 'Mark done: A.2 Drain chamber' }));
    expect(screen.getByTestId('progress-pct-l2')).toHaveTextContent('100%');

    // Something not on the list: what came, how much, the challan.
    await user.click(screen.getByRole('button', { name: /Something not on the list/ }));
    const delivery = screen.getByRole('group', { name: 'Delivery 1' });
    await user.type(within(delivery).getByLabelText('What came'), 'बालुवा (sand)');
    await user.type(within(delivery).getByLabelText('Quantity'), '1.5');
    await user.type(within(delivery).getByLabelText('Unit'), 'trip');
    await user.type(within(delivery).getByLabelText('Challan no.'), '4512');

    // Two hours lost — and the day is not saved until it says why.
    await user.click(screen.getByRole('button', { name: 'Half an hour more' }));
    await user.click(screen.getByRole('button', { name: 'Half an hour more' }));
    await user.click(screen.getByRole('button', { name: 'Half an hour more' }));
    await user.click(screen.getByRole('button', { name: 'Half an hour more' }));
    expect(screen.getByTestId('lost-hours')).toHaveTextContent('2 h');
    await user.click(screen.getByRole('button', { name: /Save the day/ }));
    expect(await screen.findByTestId('lost-reason-error')).toHaveTextContent('Say why the time was lost');
    expect(await saves()).toHaveLength(0);

    const reasons = screen.getByRole('radiogroup', { name: 'Why?' });
    await user.click(within(reasons).getByRole('radio', { name: 'Rain' }));
    await user.type(screen.getByLabelText('Problems on site'), 'छानाबाट पानी चुहियो');
    await user.click(screen.getByRole('button', { name: /Save the day/ }));

    await waitFor(async () => expect(await saves()).toHaveLength(1));
    const [save] = await saves();
    expect(save).toMatchObject({ kind: 'diary_save', jobId: 'j1' });
    expect(save.payload).toEqual({
      day: today,
      weather: 'RAIN',
      headcount: [{ tradeId: 'tr1', count: 3 }, { tradeId: 'tr2', count: 1 }],
      progress: [{ jobLineId: 'l1', progressPct: 25 }, { jobLineId: 'l2', progressPct: 100 }],
      received: [{ description: 'बालुवा (sand)', qty: 1.5, unit: 'trip', challanNo: '4512' }],
      issues: 'छानाबाट पानी चुहियो',
      lostHours: 2,
      lostReason: 'RAIN',
      photoMediaIds: [],
    });
    // No money anywhere: not in what is sent, not on the screen.
    expect(JSON.stringify(save.payload)).not.toMatch(MONEY);
    expect(document.body.textContent).not.toMatch(/Rs\.|रु/);
    expect(store.getState().ui.toasts.map((t) => t.title)).toContain('Saved on this phone');
    expect(await screen.findByTestId('diary-waiting')).toHaveTextContent('Saved on this phone');
    expect(calls.some((c) => c.path === '/tech/sync')).toBe(false);
  }, 20_000);

  it('a newer save of the same day replaces the one waiting; another day’s save stays', async () => {
    online = false;
    const user = userEvent.setup();
    api();
    await enqueue({ kind: 'diary_save', jobId: 'j1', payload: { day: yesterday, headcount: [], progress: [], received: [], lostHours: 0, photoMediaIds: [] } });
    renderDiary(`/tech/jobs/j1/diary/${today}`);

    await user.click(await screen.findByRole('button', { name: 'One more: Mason' }));
    await user.click(screen.getByRole('button', { name: /Save the day/ }));
    await waitFor(async () => expect((await saves()).filter((s) => s.payload.day === today)).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'One more: Mason' }));
    await user.click(screen.getByRole('button', { name: 'One more: Helper' }));
    await user.click(screen.getByRole('button', { name: /Save the day/ }));

    await waitFor(async () => {
      const todays = (await saves()).filter((s) => s.payload.day === today);
      expect(todays).toHaveLength(1);
      expect(todays[0].payload.headcount).toEqual([{ tradeId: 'tr1', count: 2 }, { tradeId: 'tr2', count: 1 }]);
    });
    expect((await saves()).map((s) => s.payload.day).sort()).toEqual([yesterday, today].sort());
  }, 15_000);

  it('starts from the save still waiting on the phone, as typed', async () => {
    online = false;
    api();
    await enqueue({
      kind: 'diary_save', jobId: 'j1', payload: { day: today },
      meta: { form: { weather: 'COLD', headcount: { tr2: 5 }, progress: { l3: 40 }, received: [], issues: '', lostHours: 0, lostReason: null, photos: [], note: 'चिसो' } },
    });
    renderDiary(`/tech/jobs/j1/diary/${today}`);
    expect(await screen.findByRole('radio', { name: /Cold/ })).toHaveAttribute('data-state', 'on');
    expect(screen.getByLabelText('How many: Helper')).toHaveValue(5);
    expect(screen.getByTestId('progress-pct-l3')).toHaveTextContent('40%');
    expect(screen.getByLabelText('Note for the office')).toHaveValue('चिसो');
  });

  it('holds a photo until it is uploaded, then sends the day with its media id — never the upload id', async () => {
    online = false;
    const user = userEvent.setup();
    const calls = api();
    const { store } = renderDiary(`/tech/jobs/j1/diary/${today}`);

    const photo = new File([new Uint8Array(16)], 'site.jpg', { type: 'image/jpeg' });
    fireEvent.change(await screen.findByLabelText('Take a photo'), { target: { files: [photo] } });
    expect(await screen.findByText('Waiting to upload')).toBeInTheDocument();
    const [upload] = await pendingUploads();
    expect(upload).toMatchObject({ target: 'job', targetId: 'j1', kind: 'DURING', caption: `Site diary ${today}` });

    await user.click(screen.getByRole('button', { name: /Save the day/ }));
    await waitFor(async () => expect(await saves()).toHaveLength(1));
    const [save] = await saves();
    expect(save.payload.photoMediaIds).toEqual([]);
    expect(save.meta.photoUploadIds).toEqual([upload.id]);

    // Back online: the day waits for its picture, then goes with the picture's media id.
    online = true;
    await syncFieldQueue(store.dispatch);
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts.map((c) => c.path)).toEqual(['/tech/jobs/j1/photos', '/tech/sync']);
    const [wire] = posts[1].body.mutations;
    expect(wire).toMatchObject({ kind: 'diary_save', jobId: 'j1', payload: expect.objectContaining({ day: today, photoMediaIds: ['m-new'] }) });
    expect(JSON.stringify(wire)).not.toMatch(/photoUploadIds|meta/);
    expect(await pending()).toEqual([]);
    expect(await screen.findByText('Sent')).toBeInTheDocument();
  }, 15_000);

  it('is read only for a job whose diary is closed', async () => {
    api({ job: { ...JOB, status: 'VERIFIED' } });
    renderDiary(`/tech/jobs/j1/diary/${today}`);
    expect(await screen.findByText('This job is closed — the diary can be read, not changed.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save the day/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'One more: Mason' })).toBeDisabled();
  });

  it('speaks Nepali', async () => {
    api();
    renderDiary(`/tech/jobs/j1/diary/${today}`, { locale: 'ne' });
    expect(await screen.findByRole('heading', { name: /साइट डायरी/ })).toBeInTheDocument();
    expect(screen.getByText('साइटमा को-को थिए')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /भारी पानी/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /दिन सुरक्षित गर्नुहोस्/ })).toBeInTheDocument();
  });
});

describe('SiteDiaryPage — the days', () => {
  it('lists the days filed with the ones waiting on the phone, and opens today', async () => {
    online = false;
    const user = userEvent.setup();
    api({ days: [{ day: yesterday, weather: 'RAIN', headcountTotal: 6, lostHours: 3, updatedAt: '2026-09-27T12:00:00Z' }] });
    await enqueue({ kind: 'diary_save', jobId: 'j1', payload: { day: today } });
    const { store } = renderDiary('/tech/jobs/j1/diary');
    // The field shell (TechLayout) loads the queue into the store; here the test does.
    await loadFieldQueue(store.dispatch);

    expect(await screen.findByTestId('diary-today')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Days filed' });
    expect(within(list).getAllByRole('link')).toHaveLength(2);
    expect(within(list).getByTestId(`diary-day-${yesterday}`)).toHaveTextContent('Rain · 6 people · 3 h lost');
    expect(within(list).getByTestId(`diary-day-${today}`)).toHaveTextContent('Saved on this phone');
    expect(screen.getByRole('link', { name: /Open today/ })).toHaveAttribute('href', `/tech/jobs/j1/diary/${today}`);

    // Another day: not in the future.
    await user.type(screen.getByLabelText('Another day'), addDaysTo(today, 1));
    expect(screen.getByRole('button', { name: /Open this day/ })).toBeDisabled();
    expect(screen.getByText('Pick a day in the last 60 days, not in the future.')).toBeInTheDocument();
  });
});

describe('the job sheet’s way in', () => {
  it('links the site diary from the job, and loads today’s page while there is signal so it opens with none', async () => {
    const calls = api();
    renderWithProviders(<Routes><Route path="/tech/jobs/:id" element={<TechJobPage />} /></Routes>, {
      path: '*', initialPath: '/tech/jobs/j1', preloadedState: signedInAs('TECHNICIAN'),
    });
    expect(await screen.findByRole('link', { name: /Site diary/ })).toHaveAttribute('href', '/tech/jobs/j1/diary');
    await waitFor(() => expect(calls.some((c) => c.method === 'GET' && c.path === `/tech/jobs/j1/diary/${today}`)).toBe(true));
  });

  it('offers no diary on an inspection — that visit is a survey', async () => {
    api({ job: { ...JOB, type: 'INSPECTION', status: 'SCHEDULED' } });
    renderWithProviders(<Routes><Route path="/tech/jobs/:id" element={<TechJobPage />} /></Routes>, {
      path: '*', initialPath: '/tech/jobs/j1', preloadedState: signedInAs('SURVEYOR'),
    });
    expect(await screen.findByRole('button', { name: /Open the survey/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Site diary/ })).not.toBeInTheDocument();
  });
});
