import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SurveysPage from '@/pages/admin/SurveysPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();
const SURVEY = {
  id: 'sv1', number: 'SV-2083-0001', status: 'SUBMITTED', submittedAt: hoursAgo(72), createdAt: hoursAgo(80),
  customer: { id: 'c1', name: 'Sita Rai', phone: '9808338255' }, service: { name: 'Waterproofing' },
  _count: { items: 3, readings: 2 },
};
const FRESH = { ...SURVEY, id: 'sv2', number: 'SV-2083-0002', status: 'IN_REVIEW', submittedAt: hoursAgo(2) };

const listCalls = (calls) => calls.filter((c) => c.path === '/admin/surveys' && c.query.limit !== '1');

describe('the survey queues', () => {
  it('opens on To price, oldest first, flags a long wait, and switches queues', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ path, query }) => {
      if (path !== '/admin/surveys') return undefined;
      if (query.limit === '1') return json({ data: [], meta: { page: 1, limit: 1, total: query.status === 'RETURNED' ? 0 : 2, pages: 1 } });
      return page(query.status === 'SUBMITTED,IN_REVIEW' ? [SURVEY, FRESH] : []);
    });
    const { router } = renderWithProviders(<SurveysPage />, { path: '/admin/surveys', preloadedState: signedInAs('SALES') });

    expect(await screen.findByText('SV-2083-0001')).toBeInTheDocument();
    expect(listCalls(calls)[0].query).toMatchObject({ status: 'SUBMITTED,IN_REVIEW', sort: 'submittedAt' });
    expect(listCalls(calls)[0].query).not.toHaveProperty('stage');
    expect(within(screen.getByRole('tab', { name: /To price/ })).getByText('2')).toBeInTheDocument();
    // Three days waiting is flagged; two hours is not.
    expect(screen.getByText('3 days ago').closest('[title]')).toHaveClass('surface-warning');
    expect(screen.getByText('2 hours ago')).not.toHaveClass('surface-warning');

    await user.click(screen.getByRole('tab', { name: /Sent back/ }));
    await waitFor(() => expect(listCalls(calls).at(-1).query).toMatchObject({ status: 'RETURNED' }));
    expect(listCalls(calls).at(-1).query).not.toHaveProperty('sort');
    expect(await screen.findByText('Nothing is sent back')).toBeInTheDocument();
    expect(router.state.location.search).toContain('stage=returned');

    await user.click(screen.getByRole('tab', { name: 'All' }));
    await waitFor(() => expect(listCalls(calls).at(-1).query).not.toHaveProperty('status'));
  });

  it('opens on All for dispatch, who does not price surveys', async () => {
    const calls = mockApi(({ path }) => (path === '/admin/surveys' ? page([SURVEY]) : undefined));
    renderWithProviders(<SurveysPage />, { path: '/admin/surveys', preloadedState: signedInAs('DISPATCHER') });
    await screen.findByText('SV-2083-0001');
    expect(listCalls(calls)[0].query).not.toHaveProperty('status');
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  });
});
