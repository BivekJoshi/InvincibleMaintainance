import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import TechJobPage from '@/pages/tech/TechJobPage/TechJobPage';
import TechHistoryPage from '@/pages/tech/TechHistoryPage';
import { TechLayout } from '@/components/layout/TechLayout';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';
import { resetFieldDbForTests } from '@/helpers/fieldDb';
import { enqueue, pending } from '@/helpers/offlineQueue';
import { addUpload } from '@/helpers/uploadQueue';
import { resetSentPhotosForTests } from '@/helpers/sentPhotos';
import { addDaysTo, ktmDay } from '@/helpers/dispatchBoard';
import { fieldSyncSettled, syncFieldQueue } from '@/hooks/useOfflineQueue';

vi.mock('@/hooks/useIdlePreload', () => ({ useIdlePreload: () => {} }));

const originalGetContext = HTMLCanvasElement.prototype.getContext;
let online;

beforeEach(() => {
  resetFieldDbForTests();
  resetSentPhotosForTests();
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  // jsdom has no canvas; the signature pad simply draws nothing.
  HTMLCanvasElement.prototype.getContext = () => null;
});

afterEach(async () => {
  await fieldSyncSettled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

const toastTitles = (store) => store.getState().ui.toasts.map((t) => t.title);
const today = ktmDay();
const at = (day, hhmm) => new Date(`${day}T${hhmm}:00+05:45`).toISOString();

const JOB = {
  id: 'j1', number: 'JOB-2083-0042', title: 'Terrace waterproofing', type: 'REPAIR', status: 'IN_PROGRESS', priority: 'HIGH',
  scheduledStart: at(today, '10:00'), actualStart: at(today, '10:05'),
  customer: { id: 'c1', name: 'सीता राई', phone: '9841234567' },
  site: { id: 's1', address: 'झम्सिखेल, ललितपुर', accessNotes: 'Gate code 4' },
  tasks: [
    { id: 't1', title: 'Photograph before', isDone: true, isSkipped: false },
    { id: 't2', title: 'Apply membrane', isDone: false, isSkipped: false },
    { id: 't3', title: 'Flood test', isDone: false, isSkipped: false },
  ],
  photos: [], materials: [], timeLogs: [], survey: null, events: [],
};

const MATERIALS = [
  { id: 'mat1', code: 'WP-CRYST', name: 'Crystalline slurry', unit: 'kg' },
  { id: 'mat2', code: 'CEM-OPC', name: 'Cement (OPC)', unit: 'bag' },
];

const applied = (body) => json({ data: { results: body.mutations.map((m) => ({ idempotencyKey: m.idempotencyKey, status: 'applied' })) } });

function api(job = JOB) {
  return mockApi(({ method, path, body }) => {
    if (method === 'GET' && path === '/tech/jobs/j1') return json({ data: job });
    if (method === 'GET' && path === '/tech/materials') return json({ data: MATERIALS });
    if (method === 'POST' && path === '/tech/sync') return applied(body);
    return undefined;
  });
}

const renderJob = () => renderWithProviders(<TechJobPage />, {
  path: '/tech/jobs/:id', initialPath: '/tech/jobs/j1', preloadedState: signedInAs('TECHNICIAN'),
});

describe('TechJobPage — completion', () => {
  it('keeps Complete job disabled while checklist items are open, and says how many', async () => {
    online = false; // everything below is queued on the phone
    const user = userEvent.setup();
    api();
    renderJob();

    expect(await screen.findByRole('heading', { name: 'Terrace waterproofing' })).toBeInTheDocument();
    const complete = screen.getByRole('button', { name: /Complete job/ });
    expect(complete).toBeDisabled();
    expect(screen.getByText('2 checklist items are still open — tick them before completing.')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Done: Apply membrane' }));
    expect(await screen.findByText('1 checklist item is still open — tick it before completing.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Done: Apply membrane' })).toBeChecked();
    expect(complete).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'Done: Flood test' }));
    // No items open: now it waits for the customer's signature.
    expect(await screen.findByText('Ask the customer to sign in the box.')).toBeInTheDocument();
    expect(complete).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'The customer is not here to sign' }));
    expect(complete).toBeEnabled();
    await user.type(screen.getByLabelText('What you did'), 'Membrane laid');
    await user.click(screen.getByRole('button', { name: '5 of 5' }));
    await user.click(complete);

    await waitFor(async () => expect((await pending()).map((m) => m.kind)).toEqual(['task', 'task', 'complete']));
    const [, , done] = await pending();
    expect(done).toMatchObject({ jobId: 'j1', payload: { note: 'Membrane laid', customerRating: 5 } });
    // Completed on the phone: the sheet turns read only at once.
    expect(await screen.findByText('This job is closed. You can look, not change.')).toBeInTheDocument();
  });

  it('refuses to complete before work has started', async () => {
    api({ ...JOB, status: 'EN_ROUTE', tasks: [] });
    renderJob();
    expect(await screen.findByText('Start work before you complete the job.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Complete job/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Start work/ })).toBeInTheDocument();
  });
});

describe('TechJobPage — materials', () => {
  it('logs a material from the sheet as a queued `material` mutation — quantity and unit, never a rate', async () => {
    online = false;
    const user = userEvent.setup();
    const calls = api();
    const { store } = renderJob();

    await user.click(await screen.findByRole('button', { name: /Log material/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Log a material' });
    await user.type(within(sheet).getByRole('searchbox', { name: 'Search by name or code' }), 'cryst');
    expect(within(sheet).queryByText('Cement (OPC)')).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: /Crystalline slurry/ }));

    const qty = within(sheet).getByLabelText('Quantity (kg)');
    await user.clear(qty);
    await user.type(qty, '0');
    await user.click(within(sheet).getByRole('button', { name: 'Log 0 kg' }));
    expect(within(sheet).getByText('Enter a quantity above 0')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'More' }));
    await user.click(within(sheet).getByRole('button', { name: 'More' }));
    await user.click(within(sheet).getByRole('button', { name: 'More' }));
    await user.click(within(sheet).getByRole('button', { name: 'Log 3 kg' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [queued] = await pending();
    expect(queued).toMatchObject({ kind: 'material', jobId: 'j1', payload: { materialId: 'mat1', qty: 3 } });
    expect(queued.payload).not.toHaveProperty('rate');
    expect(toastTitles(store)).toContain('Logged 3 kg Crystalline slurry');
    // Shown at once, marked as still on the phone.
    const lines = screen.getByRole('list', { name: 'Materials used' });
    expect(within(lines).getByText('Crystalline slurry')).toBeInTheDocument();
    expect(within(lines).getByText('3 kg')).toBeInTheDocument();
    expect(within(lines).getByLabelText('waiting to send')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/tech/sync')).toBe(false);

    // Signal again: the same mutation is what reaches /tech/sync.
    online = true;
    await act(() => syncFieldQueue(store.dispatch));
    const sync = calls.find((c) => c.path === '/tech/sync');
    expect(sync.body.mutations).toEqual([{
      idempotencyKey: queued.idempotencyKey, at: queued.at, kind: 'material', jobId: 'j1', payload: { materialId: 'mat1', qty: 3 },
    }]);
    expect(JSON.stringify(sync.body)).not.toMatch(/rate|price|cost/i);
  });
});

describe('TechJobPage — status and timer go through the queue', () => {
  it('queues "On my way", shows it at once, and sends it straight away when there is signal', async () => {
    const user = userEvent.setup();
    const calls = api({ ...JOB, status: 'ASSIGNED' });
    renderJob();

    await user.click(await screen.findByRole('button', { name: /On my way/ }));
    await waitFor(() => expect(calls.some((c) => c.path === '/tech/sync')).toBe(true));
    const sync = calls.find((c) => c.path === '/tech/sync');
    expect(sync.body.mutations).toEqual([expect.objectContaining({ kind: 'status', jobId: 'j1', payload: { status: 'EN_ROUTE' } })]);
  });

  it('asks why before putting a job on hold', async () => {
    online = false;
    const user = userEvent.setup();
    api();
    renderJob();

    await user.click(await screen.findByRole('button', { name: /Hold/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Put this job on hold' });
    await user.click(within(sheet).getByRole('button', { name: 'Put on hold' }));
    expect(within(sheet).getByText('Say why the job is stopping')).toBeInTheDocument();
    await user.type(within(sheet).getByLabelText('Why is the work stopping?'), 'Waiting for membrane');
    await user.click(within(sheet).getByRole('button', { name: 'Put on hold' }));

    await waitFor(async () => expect(await pending()).toEqual([
      expect.objectContaining({ kind: 'status', payload: { status: 'ON_HOLD', note: 'Waiting for membrane' } }),
    ]));
    expect(await screen.findByText('On hold: Waiting for membrane')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume work/ })).toBeInTheDocument();
  });

  it('starts and stops the timer offline, in order', async () => {
    online = false;
    const user = userEvent.setup();
    api();
    renderJob();

    await user.click(await screen.findByRole('button', { name: /Start timer/ }));
    await user.click(await screen.findByRole('button', { name: /Stop timer/ }));
    await waitFor(async () => expect((await pending()).map((m) => m.kind)).toEqual(['time_start', 'time_stop']));
    expect(await screen.findByRole('button', { name: /Start timer/ })).toBeInTheDocument();
  });
});

describe('TechJobPage — read only', () => {
  it('opens a job from History without a single control', async () => {
    api({ ...JOB, status: 'COMPLETED', completionNote: 'Flood test dry', customerRating: 4, actualEnd: at(today, '15:00'), materials: [{ id: 'jm1', qty: 22, material: MATERIALS[0] }] });
    renderWithProviders(<TechJobPage readOnly />, {
      path: '/tech/history/:id', initialPath: '/tech/history/j1', preloadedState: signedInAs('TECHNICIAN'),
    });

    expect(await screen.findByText('From your history — read only.')).toBeInTheDocument();
    expect(screen.getByText('Flood test dry')).toBeInTheDocument();
    expect(screen.getByText('Rated 4 of 5')).toBeInTheDocument();
    expect(screen.getByText('22 kg')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete job|Log material|Start timer|Take a photo/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Take a photo')).not.toBeInTheDocument();
    screen.getAllByRole('checkbox').forEach((box) => expect(box).toBeDisabled());
  });
});

describe('TechHistoryPage', () => {
  const jobsOn = (dayOffset, id) => ({
    id, number: `JOB-${id}`, title: `Job ${id}`, status: 'COMPLETED', customer: { name: 'राम शर्मा' },
    scheduledStart: at(addDaysTo(today, dayOffset), '11:00'),
  });

  it('asks for the last 30 Kathmandu days (a day wider each side) and lists the jobs in them, newest first', async () => {
    const user = userEvent.setup();
    const jobs = [jobsOn(-40, 'old'), jobsOn(-5, 'five'), jobsOn(0, 'today')];
    const calls = mockApi(({ path }) => (path === '/tech/jobs' ? json({ data: jobs }) : undefined));
    renderWithProviders(<TechHistoryPage />, { path: '/tech/history', preloadedState: signedInAs('TECHNICIAN') });

    await screen.findByText('Job today');
    expect(calls[0].query).toEqual({ from: addDaysTo(today, -30), to: addDaysTo(today, 1) });
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/tech/history/today', '/tech/history/five']);
    expect(screen.queryByText('Job old')).not.toBeInTheDocument();
    expect(screen.getByText('2 jobs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '7 days' }));
    await waitFor(() => expect(calls.at(-1).query).toEqual({ from: addDaysTo(today, -7), to: addDaysTo(today, 1) }));

    fireEvent.change(screen.getByLabelText('From'), { target: { value: addDaysTo(today, -60) } });
    await waitFor(() => expect(calls.at(-1).query).toEqual({ from: addDaysTo(today, -61), to: addDaysTo(today, 1) }));
    expect(await screen.findByText('Job old')).toBeInTheDocument();
  });

  it('says so when the first date is after the second, and asks nothing', async () => {
    const calls = mockApi(() => json({ data: [] }));
    renderWithProviders(<TechHistoryPage />, {
      path: '/tech/history', initialPath: `/tech/history?from=${today}&to=${addDaysTo(today, -3)}`, preloadedState: signedInAs('TECHNICIAN'),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('The first date is after the second.');
    expect(calls).toEqual([]);
  });
});

describe('TechLayout — what is still on the phone', () => {
  const renderShell = () => renderWithProviders(
    <Routes><Route element={<TechLayout />}><Route path="/tech" element={<p>Today’s jobs</p>} /></Route></Routes>,
    { path: '*', initialPath: '/tech', preloadedState: signedInAs('TECHNICIAN') },
  );

  it('counts changes and photos while offline, then drains them when the signal is back', async () => {
    online = false;
    await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'EN_ROUTE' } });
    await enqueue({ kind: 'task', jobId: 'j1', taskId: 't1', payload: { isDone: true } });
    await addUpload({ target: 'job', targetId: 'j1', kind: 'BEFORE', file: new File([new Uint8Array(8)], 'a.jpg', { type: 'image/jpeg' }) });
    const calls = mockApi(({ path, body }) => {
      if (path === '/tech/sync') return applied(body);
      if (path === '/tech/jobs/j1/photos') return json({ data: { photos: [], media: [{ id: 'm1', thumb: '/uploads/m1.webp' }] } }, 201);
      return undefined;
    });
    renderShell();

    expect(await screen.findByText('No signal. 2 changes and 1 photo saved on this phone — they go to the office when you are back online.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Offline — 3 waiting' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/tech/history');

    online = true;
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await act(() => fieldSyncSettled());

    expect(await screen.findByRole('button', { name: 'All sent' })).toBeInTheDocument();
    expect(calls.map((c) => c.path)).toEqual(expect.arrayContaining(['/tech/sync', '/tech/jobs/j1/photos']));
    expect(screen.queryByText(/No signal/)).not.toBeInTheDocument();
  });

  it('shows a refused change as a note until it is dismissed', async () => {
    await enqueue({ kind: 'status', jobId: 'j1', payload: { status: 'IN_PROGRESS' } });
    mockApi(({ path, body }) => (path === '/tech/sync'
      ? json({ data: { results: body.mutations.map((m) => ({ idempotencyKey: m.idempotencyKey, status: 'failed', code: 'INVALID_TRANSITION', error: 'The job was cancelled' })) } })
      : undefined));
    const user = userEvent.setup();
    renderShell();

    const note = await screen.findByRole('alert');
    expect(note).toHaveTextContent('Not sent — the office refused it');
    expect(note).toHaveTextContent('Status “In progress” — The job was cancelled');
    await user.click(within(note).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
