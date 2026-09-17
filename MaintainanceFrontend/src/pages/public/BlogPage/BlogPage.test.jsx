import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BlogPage from '@/pages/public/BlogPage/BlogPage';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { renderWithProviders } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';

const CATEGORIES = [
  { id: 'c1', name: 'Damp & waterproofing', slug: 'damp-and-waterproofing' },
  { id: 'c2', name: 'Home care', slug: 'home-care' },
];
const POSTS = [
  { id: 'p1', slug: 'rising-damp', title: 'Rising damp or a leaking terrace?', excerpt: 'Where the stain starts tells you.', publishedAt: '2026-09-04T03:15:00Z', category: CATEGORIES[0] },
  { id: 'p2', slug: 'monsoon-checks', title: 'मनसुन अघिको पाँच जाँच', excerpt: null, publishedAt: '2026-08-17T03:15:00Z', category: CATEGORIES[1] },
];

let calls;
let blog;
beforeEach(() => {
  blog = true;
  calls = mockApi(({ path, query }) => {
    if (path === '/public/posts') {
      const items = query.category ? POSTS.filter((p) => p.category.slug === query.category) : POSTS;
      return json({ data: { items, categories: CATEGORIES, media: {} } });
    }
    if (path === '/public/bootstrap') return json({ data: { settings: {}, nav: { categories: [], blog, pages: [] } } });
    return undefined;
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('BlogPage', () => {
  it('lists published posts newest first and filters by category in the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderWithProviders(<BlogPage />, { path: '/blog' });
    const links = await screen.findAllByRole('link', { name: /Rising damp|मनसुन/ });
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/blog/rising-damp', '/blog/monsoon-checks']);
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Home care' }));
    await waitFor(() => expect(router.state.location.search).toBe('?category=home-care'));
    await waitFor(() => expect(screen.queryByText('Rising damp or a leaking terrace?')).not.toBeInTheDocument());
    expect(screen.getByText('मनसुन अघिको पाँच जाँच')).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/public/posts').at(-1).query).toMatchObject({ category: 'home-care', locale: 'en' });
    expect(screen.getByRole('button', { name: 'Home care' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('the Blog link', () => {
  it('appears in the site nav only while the blog has a published post', async () => {
    const { unmount } = renderWithProviders(<SiteFooter />);
    expect(await screen.findByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog');
    unmount();

    blog = false;
    renderWithProviders(<SiteFooter />);
    await waitFor(() => expect(calls.filter((c) => c.path === '/public/bootstrap').length).toBeGreaterThan(1));
    expect(screen.getByRole('link', { name: 'Pricing' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Blog' })).not.toBeInTheDocument();
  });
});
