import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import ResourceListPage from '@/pages/admin/ResourceListPage';
import ResourceEditPage from '@/pages/admin/ResourceEditPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi, page } from '@/test/mockApi';

/**
 * The D2 registry screens, through the generic pages as AppRoutes mounts them: the
 * testimonial queue, list-item reordering, a locked block key, an offer in Nepali, a
 * project's job and gallery, and CMS links to a live page.
 */

const day = 86_400_000;
const TESTIMONIAL = { id: 't1', quote: 'धेरै राम्रो सेवा, समयमै काम सकियो।', author: 'राजु महर्जन', location: 'कीर्तिपुर', rating: 5, locale: 'ne', isApproved: false, isActive: true, jobId: null, photoId: null };
const OFFERS = [
  { id: 'o1', title: 'मनसुन अघि छत वाटरप्रुफिङ', isActive: true, startsAt: null, endsAt: new Date(Date.now() + 3 * day).toISOString(), priceMin: 12000, priceMax: 32000 },
  { id: 'o2', title: 'Scheduled offer', isActive: true, startsAt: new Date(Date.now() + 5 * day).toISOString(), endsAt: null },
  { id: 'o3', title: 'Ended offer', isActive: true, startsAt: null, endsAt: new Date(Date.now() - 5 * day).toISOString() },
];
const PROJECT = {
  id: 'p1', title: 'Terrace Waterproofing — Bhaisepati', slug: 'terrace-bhaisepati', status: 'completed', isActive: true,
  job: { id: 'j1', number: 'JOB-2083-0007' }, jobId: 'j1', costBandMin: 12000000, costBandMax: 18000000,
  images: [
    { id: 'i1', mediaId: 'm1', caption: 'Before', sortOrder: 0 },
    { id: 'i2', mediaId: 'm2', caption: 'After', sortOrder: 1 },
  ],
};
const BLOCK = { id: 'b1', key: 'interior_design', heading: 'Interiors planned on paper', isActive: true, cta: { label: 'Book', url: '/book' }, bullets: [] };
const SLIDE = { id: 's1', title: 'Certified engineers', ctaLabel: 'About us', ctaUrl: '/book', isActive: true };

let calls;
let pages;

beforeEach(() => {
  pages = [{ slug: 'about', title: 'About us' }];
  calls = mockApi(({ method, path, body }) => {
    if (path === '/public/bootstrap') return json({ data: { settings: {}, nav: { categories: [], blog: false, pages } } });
    if (method === 'POST') return json({ data: { id: 'new1', ...body } }, 201);
    if (method === 'PATCH' && path.endsWith('/reorder')) return new Response(null, { status: 204 });
    if (method === 'DELETE') return new Response(null, { status: 204 });
    if (method === 'PATCH' && path === '/admin/testimonials/t1/approve') return json({ data: { ...TESTIMONIAL, isApproved: body.isApproved } });
    if (method === 'PUT') return json({ data: { ...body, id: path.split('/').pop() } });
    if (path === '/admin/testimonials') return page([TESTIMONIAL]);
    if (path === '/admin/list-items') return page([{ id: 'l1', group: 'kitchen_steps', position: 1, text: 'Measure the kitchen', isActive: true }]);
    if (path === '/admin/offers') return page(OFFERS);
    if (path === '/admin/projects/p1') return json({ data: PROJECT });
    if (path === '/admin/content-blocks/b1') return json({ data: BLOCK });
    if (path === '/admin/hero-slides/s1') return json({ data: SLIDE });
    if (path.startsWith('/admin/media/')) return json({ data: { id: path.split('/').pop(), alt: 'Terrace', variants: {} } });
    if (path === '/admin/translations') return json({ data: {} });
    return undefined;
  });
});

afterEach(() => vi.unstubAllGlobals());

function Screens() {
  return (
    <Routes>
      <Route path="/admin/content/:resource" element={<ResourceListPage />} />
      <Route path="/admin/content/:resource/new" element={<ResourceEditPage />} />
      <Route path="/admin/content/:resource/:id" element={<ResourceEditPage />} />
      <Route path="*" element={<p>Somewhere else</p>} />
    </Routes>
  );
}

const renderAt = (path, role = 'EDITOR') => renderWithProviders(<Screens />, { path: '*', preloadedState: signedInAs(role), initialPath: path });
const sent = (method, path) => calls.filter((c) => c.method === method && c.path === path);

describe('testimonials', () => {
  it('opens on the approval queue and approves from the row menu', async () => {
    const user = userEvent.setup();
    const { store } = renderAt('/admin/content/testimonials');

    expect(await screen.findByText('“धेरै राम्रो सेवा, समयमै काम सकियो।”')).toHaveAttribute('lang', 'ne');
    expect(sent('GET', '/admin/testimonials')[0].query).toMatchObject({ approved: 'false' });
    expect(screen.getByRole('combobox', { name: 'Approval' })).toHaveTextContent('Waiting for approval');
    // The default filter is not an applied filter.
    expect(screen.queryByRole('button', { name: /Clear filters/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Actions for राजु महर्जन/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Approve' }));
    await waitFor(() => expect(sent('PATCH', '/admin/testimonials/t1/approve')).toHaveLength(1));
    expect(sent('PATCH', '/admin/testimonials/t1/approve')[0].body).toEqual({ isApproved: true });
    // Approval refetches the queue.
    await waitFor(() => expect(sent('GET', '/admin/testimonials').length).toBeGreaterThan(1));
    expect(store.getState().ui.toasts.map((t) => t.title)).toContain('Testimonial approved');
  });

  it('lists everything with ?approved=all', async () => {
    renderAt('/admin/content/testimonials?approved=all');
    await screen.findByText(/धेरै राम्रो सेवा/);
    expect(sent('GET', '/admin/testimonials')[0].query).toMatchObject({ approved: 'all' });
    expect(screen.getByRole('button', { name: /Clear filters/ })).toBeInTheDocument();
  });
});

describe('list items', () => {
  it('offers Reorder only once a list is picked', async () => {
    const { router } = renderAt('/admin/content/list-items');
    await screen.findByText('Measure the kitchen');
    expect(screen.getByRole('button', { name: 'Reorder' })).toBeDisabled();
    expect(screen.getByText('Pick a list to reorder it.')).toBeInTheDocument();

    await router.navigate('/admin/content/list-items?group=kitchen_steps');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reorder' })).toBeEnabled());
    expect(screen.queryByText('Pick a list to reorder it.')).not.toBeInTheDocument();
  });
});

describe('content blocks', () => {
  it('fixes the key once the block exists', async () => {
    const { router } = renderAt('/admin/content/content-blocks/b1');
    expect(await screen.findByDisplayValue('Interiors planned on paper')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Where it shows/ })).toBeDisabled();
    expect(screen.getByLabelText('Text', { selector: 'input' })).toHaveValue('Book');

    await router.navigate('/admin/content/content-blocks/new');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Where it shows/ })).toBeEnabled());
    expect(screen.getByRole('heading', { name: 'New Content block' })).toBeInTheDocument();
  });

  it('refuses half a button and an unknown link', async () => {
    const user = userEvent.setup();
    renderAt('/admin/content/content-blocks/b1');
    const link = await screen.findByLabelText('Link');
    await user.clear(link);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Where does the button go?')).toBeInTheDocument();
    await user.type(link, '/nowhere');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/Use a page of this site/)).toBeInTheDocument();
    expect(sent('PUT', '/admin/content-blocks/b1')).toHaveLength(0);

    await user.clear(link);
    await user.type(link, '/about');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(sent('PUT', '/admin/content-blocks/b1')).toHaveLength(1));
    expect(sent('PUT', '/admin/content-blocks/b1')[0].body).toMatchObject({ key: 'interior_design', cta: { label: 'Book', url: '/about' } });
  });
});

describe('offers', () => {
  it('shows each offer’s window', async () => {
    renderAt('/admin/content/offers');
    const live = (await screen.findByText('मनसुन अघि छत वाटरप्रुफिङ')).closest('tr');
    expect(within(live).getByText('Live')).toBeInTheDocument();
    expect(within(live).getByText(/^Ends on /)).toBeInTheDocument();
    expect(within(screen.getByText('Scheduled offer').closest('tr')).getByText('Scheduled')).toBeInTheDocument();
    expect(within(screen.getByText('Ended offer').closest('tr')).getByText('Ended')).toBeInTheDocument();
  });

  it('creates an offer written in Nepali, with its price in rupees', async () => {
    const user = userEvent.setup();
    renderAt('/admin/content/offers/new');
    const title = 'दशैं अफर — भान्सा मर्मतमा १५% छुट';
    await user.type(await screen.findByLabelText(/^Title/), title);
    await user.type(screen.getByLabelText('Price from'), '1,200.50');
    await user.type(screen.getByLabelText('Price to'), '800');
    await user.click(screen.getByRole('button', { name: 'Create Offer' }));
    expect(await screen.findByText('The “to” price must be at least the “from” price')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Price to'));
    await user.type(screen.getByLabelText('Price to'), '3,500');
    await user.click(screen.getByRole('button', { name: 'Create Offer' }));
    await waitFor(() => expect(sent('POST', '/admin/offers')).toHaveLength(1));
    expect(sent('POST', '/admin/offers')[0].body).toMatchObject({
      title, priceMin: 1200.5, priceMax: 3500, ctaUrl: '/book', isActive: true,
    });
  });
});

describe('projects', () => {
  it('shows the job it came from and manages the gallery on its own tab', async () => {
    const user = userEvent.setup();
    renderAt('/admin/content/projects/p1');
    expect(await screen.findByText('JOB-2083-0007')).toBeInTheDocument();
    expect(screen.getByLabelText('Cost from')).toHaveValue('1,20,000.00');

    await user.click(screen.getByRole('tab', { name: 'Gallery' }));
    const gallery = await screen.findByRole('list', { name: 'Gallery pictures' });
    expect(within(gallery).getAllByRole('listitem')).toHaveLength(2);
    expect(within(gallery).getByText('Before')).toBeInTheDocument();

    await user.click(within(gallery).getByRole('button', { name: 'Move picture 1 later' }));
    await waitFor(() => expect(sent('PATCH', '/admin/projects/p1/images/reorder')).toHaveLength(1));
    expect(sent('PATCH', '/admin/projects/p1/images/reorder')[0].body).toEqual({
      items: [{ id: 'i2', sortOrder: 0 }, { id: 'i1', sortOrder: 1 }],
    });

    await user.click(within(gallery).getAllByRole('button', { name: /^Remove picture/ })[0]);
    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path.startsWith('/admin/projects/p1/images/'))).toBe(true));
  });

  it('keeps the Gallery tab closed until a new project is saved', async () => {
    renderAt('/admin/content/projects/new');
    expect(await screen.findByRole('tab', { name: 'Gallery' })).toBeDisabled();
  });
});

describe('links to pages', () => {
  it('accepts a live page as a hero slide link and refuses one that does not exist', async () => {
    const user = userEvent.setup();
    renderAt('/admin/content/hero-slides/s1');
    const link = await screen.findByLabelText('Button link');
    await user.clear(link);
    await user.type(link, '/careers');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/Use a page of this site/)).toBeInTheDocument();

    await user.clear(link);
    await user.type(link, '/about');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(sent('PUT', '/admin/hero-slides/s1')).toHaveLength(1));
    expect(sent('PUT', '/admin/hero-slides/s1')[0].body.ctaUrl).toBe('/about');
  });

  it('refuses a page address the site already uses', async () => {
    const user = userEvent.setup();
    renderAt('/admin/content/pages/new');
    await user.type(await screen.findByLabelText(/^Title/), 'Contact');
    await user.click(screen.getByRole('button', { name: 'Create Page' }));
    expect(await screen.findByText('/contact is already a page of the site — choose another address')).toBeInTheDocument();
    expect(sent('POST', '/admin/pages')).toHaveLength(0);
  });
});
