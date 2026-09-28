import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import ResourceListPage from '@/pages/admin/ResourceListPage';
import ResourceEditPage from '@/pages/admin/ResourceEditPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

const toastTitles = (store) => store.getState().ui.toasts.map((t) => t.title);

/** A saved template, exactly as the API returns it. */
const DAMP = {
  id: 'it1', name: 'Damp and seepage — site checklist', serviceId: 'svc-damp', service: { id: 'svc-damp', name: 'Seepage treatment' },
  isActive: true, sortOrder: 0, updatedAt: '2026-09-20T04:00:00.000Z', deletedAt: null,
  questions: [
    { key: 'moisture', label: 'Moisture reading', labelNe: 'ओसको मात्रा', type: 'NUMBER', unit: '%', metric: 'moisture', flag: { above: 20 }, required: true, photoRequired: true },
    { key: 'salt_deposits', label: 'Salt deposits on the wall', type: 'YES_NO', flag: { equals: 'yes' }, required: true, photoRequired: false },
    { key: 'water_source', label: 'Source of water', type: 'CHOICE', options: ['Rain', 'Pipe leak', 'Ground'], flag: { values: ['Pipe leak'] }, required: false, photoRequired: false },
    { key: 'notes', label: 'Anything else', type: 'TEXT', required: false, photoRequired: false },
  ],
};
const GENERAL = {
  id: 'it2', name: 'General walk-round', serviceId: null, service: null, isActive: true, sortOrder: 1, updatedAt: '2026-09-18T04:00:00.000Z',
  questions: [{ key: 'access', label: 'Access is clear', type: 'YES_NO', required: true, photoRequired: true }],
};

/** The routes AppRoutes gives the entry's own address (its basePath). */
function Screens() {
  return (
    <Routes>
      <Route path="/admin/inspection-templates" element={<ResourceListPage resource="inspection-templates" />} />
      <Route path="/admin/inspection-templates/new" element={<ResourceEditPage resource="inspection-templates" />} />
      <Route path="/admin/inspection-templates/:id" element={<ResourceEditPage resource="inspection-templates" />} />
    </Routes>
  );
}

function renderAs(role, initialPath, handler = () => undefined) {
  const calls = mockApi(async (call) => {
    const custom = await handler(call);
    if (custom) return custom;
    const { method, path } = call;
    if (method === 'GET' && path === '/admin/inspection-templates') return page([DAMP, GENERAL]);
    if (method === 'GET' && path === '/admin/inspection-templates/it1') return json({ data: DAMP });
    if (method === 'GET' && path.endsWith('/history')) return page([]);
    if (method === 'GET' && path === '/admin/services/svc-damp') return json({ data: { id: 'svc-damp', name: 'Seepage treatment' } });
    return undefined;
  });
  const view = renderWithProviders(<Screens />, { path: '*', initialPath, preloadedState: signedInAs(role) });
  return { calls, ...view };
}

const questionCell = (row, key) => screen.getByRole('grid', { name: 'Questions' }).querySelector(`[data-cell="${row}:${key}"]`);
const posted = (calls) => calls.find((c) => c.method === 'POST' && c.path === '/admin/inspection-templates');

describe('inspection templates — the list (Phase L5)', () => {
  it('lists each checklist with its service (or General), its questions and what they require', async () => {
    renderAs('SALES', '/admin/inspection-templates');
    expect(await screen.findByText('Damp and seepage — site checklist')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Inspection templates' })).toBeInTheDocument();
    const damp = screen.getByText('Damp and seepage — site checklist').closest('tr');
    expect(within(damp).getByText('Seepage treatment')).toBeInTheDocument();
    expect(within(damp).getByText('4')).toBeInTheDocument();
    expect(within(damp).getByText(/2 required/)).toHaveTextContent('2 required · 1 photo');
    const general = screen.getByText('General walk-round').closest('tr');
    expect(within(general).getByText('General — any service')).toBeInTheDocument();
    expect(within(general).getByText(/1 required/)).toHaveTextContent('1 required · 1 photo');
    // SALES holds surveys:write.
    expect(screen.getByRole('link', { name: /New Inspection template/ })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Damp and seepage/ })).toBeEnabled();
  });

  it('is read-only for dispatch, who reads surveys but does not write them', async () => {
    renderAs('DISPATCHER', '/admin/inspection-templates');
    expect(await screen.findByText('General walk-round')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /New Inspection template/ })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /General walk-round/ })).toBeDisabled();
  });
});

describe('inspection templates — the questions editor (Phase L5)', () => {
  it('writes a number with a unit and a flag above, a yes/no flagged on yes, a choice with options and a flagged one — and sends the API’s shape', async () => {
    const user = userEvent.setup();
    const { calls, store, router } = renderAs('SALES', '/admin/inspection-templates/new', ({ method, path, body }) => (
      method === 'POST' && path === '/admin/inspection-templates' ? json({ data: { ...body, id: 'it9' } }, 201) : undefined));
    await user.type(await screen.findByLabelText(/^Name/), 'Damp and seepage — site checklist');

    // A number: the words (the key follows them), Nepali, a key of our own, the type, unit, metric, flag above, both ticks.
    await user.click(questionCell(0, 'label'));
    await user.keyboard('Moisture reading{Tab}');
    expect(questionCell(0, 'key')).toHaveTextContent('moisture_reading');
    await user.keyboard('ओसको मात्रा{Tab}moisture{Tab}{Enter}');
    await user.click(await screen.findByRole('option', { name: 'Number' }));
    await user.keyboard('%{Tab}moisture{Tab}20{Tab}{Tab} {Tab} {Tab}');

    // Tab past the last cell added a yes/no: flagged on "yes", required, needs a photo.
    await user.keyboard('Salt deposits{Tab}{Tab}{Tab}{Tab}{Enter}');
    await user.click(await screen.findByRole('option', { name: 'Yes' }));
    await user.keyboard(' {Tab} {Tab}');

    // A choice: its options as comma-separated words, and the one that flags.
    await user.keyboard('Source of water{Tab}{Tab}{Tab}{Enter}');
    await user.click(await screen.findByRole('option', { name: 'Choice' }));
    await user.keyboard('{Tab}Rain, Pipe leak, Ground{Tab}Pipe leak{Enter}');

    expect(questionCell(0, 'labelNe')).toHaveTextContent('ओसको मात्रा');
    expect(questionCell(0, 'flagAbove')).toHaveTextContent('20');
    expect(questionCell(1, 'flagOn')).toHaveTextContent('Yes');
    expect(questionCell(2, 'options')).toHaveTextContent('Rain, Pipe leak, Ground');
    // A cell the type does not use is read-only.
    expect(questionCell(1, 'unit')).toHaveAttribute('aria-readonly', 'true');
    expect(screen.getByTestId('question-summary')).toHaveTextContent('3 questions · 2 required · 2 need a photo · 3 can raise a flag');

    await user.click(screen.getByRole('button', { name: 'Create Inspection template' }));
    await waitFor(() => expect(posted(calls)).toBeTruthy());
    expect(posted(calls).body).toEqual({
      name: 'Damp and seepage — site checklist',
      serviceId: null,
      isActive: true,
      questions: [
        { key: 'moisture', label: 'Moisture reading', labelNe: 'ओसको मात्रा', type: 'NUMBER', unit: '%', metric: 'moisture', flag: { above: 20 }, required: true, photoRequired: true },
        { key: 'salt_deposits', label: 'Salt deposits', type: 'YES_NO', flag: { equals: 'yes' }, required: true, photoRequired: true },
        { key: 'source_of_water', label: 'Source of water', type: 'CHOICE', options: ['Rain', 'Pipe leak', 'Ground'], flag: { values: ['Pipe leak'] }, required: false, photoRequired: false },
      ],
    });
    await waitFor(() => expect(toastTitles(store)).toContain('Inspection template created'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/inspection-templates/it9'));
    // A whole checklist typed key by key: longer than the default 5 s when the full suite runs in parallel.
  }, 30_000);

  it('refuses a key used twice and a key that is not a-z, 0-9 and _ — and sends nothing', async () => {
    const user = userEvent.setup();
    const { calls } = renderAs('MANAGER', '/admin/inspection-templates/new');
    await user.type(await screen.findByLabelText(/^Name/), 'Seepage');
    await user.click(questionCell(0, 'label'));
    await user.keyboard('Moisture{Enter}');
    await user.click(screen.getByRole('button', { name: 'Add question' }));
    await user.keyboard('Moisture{Enter}');
    await user.click(screen.getByRole('button', { name: 'Add question' }));
    await user.keyboard('Damp band height{Tab}{Tab}Band Height{Enter}');

    await user.click(screen.getByRole('button', { name: 'Create Inspection template' }));
    expect(await screen.findByRole('button', { name: 'Row 2 · Key: The key "moisture" is used twice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Row 3 · Key: Use a-z, 0-9 and underscore (up to 40)' })).toBeInTheDocument();
    expect(questionCell(1, 'key')).toHaveAttribute('aria-invalid', 'true');
    expect(posted(calls)).toBeUndefined();
  }, 20_000);

  it('loads a saved checklist as it is and saves it back in the same shape, with the one change made', async () => {
    const user = userEvent.setup();
    const { calls } = renderAs('MANAGER', '/admin/inspection-templates/it1', ({ method, path, body }) => (
      method === 'PUT' && path === '/admin/inspection-templates/it1' ? json({ data: { ...DAMP, ...body } }) : undefined));
    expect(await screen.findByDisplayValue('Damp and seepage — site checklist')).toBeInTheDocument();
    expect(questionCell(0, 'type')).toHaveTextContent('Number');
    expect(questionCell(2, 'flagOn')).toHaveTextContent('Pipe leak');
    expect(questionCell(3, 'flagOn')).toHaveAttribute('aria-readonly', 'true');

    await user.click(questionCell(0, 'flagAbove'));
    await user.keyboard('25{Enter}');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const put = await waitFor(() => {
      const call = calls.find((c) => c.method === 'PUT');
      expect(call).toBeTruthy();
      return call;
    });
    expect(put.body.questions).toEqual([{ ...DAMP.questions[0], flag: { above: 25 } }, ...DAMP.questions.slice(1)]);
    expect(put.body).toMatchObject({ name: DAMP.name, serviceId: 'svc-damp', isActive: true });
  }, 20_000);

  it('shows dispatch the checklist read-only: no Save, no new rows, a read-only grid', async () => {
    renderAs('DISPATCHER', '/admin/inspection-templates/it1');
    expect(await screen.findByDisplayValue('Damp and seepage — site checklist')).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'Questions' })).toHaveAttribute('aria-readonly', 'true');
    expect(screen.queryByRole('button', { name: 'Add question' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(questionCell(0, 'labelNe')).toHaveTextContent('ओसको मात्रा');
  });
});
