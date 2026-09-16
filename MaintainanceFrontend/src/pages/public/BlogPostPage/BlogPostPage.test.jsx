import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import BlogPostPage from '@/pages/public/BlogPostPage/BlogPostPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import { json, mockApi, notFound } from '@/test/mockApi';

const POST = {
  id: 'po1', slug: 'five-checks-before-the-monsoon', title: 'Five checks to make before the monsoon',
  excerpt: 'An hour on the roof in May saves a ceiling in July.',
  body: 'Clear every terrace outlet.\n\nLook along the parapet for hairline cracks.',
  publishedAt: '2026-08-17T03:15:00.000Z', coverId: null,
  category: { id: 'c1', name: 'Home care', slug: 'home-care' },
};

beforeEach(() => {
  mockApi(({ path }) => {
    if (path === `/public/posts/${POST.slug}`) return json({ data: { post: POST, media: {} } });
    if (path === '/public/posts/empty-seo') return json({ data: { post: { ...POST, slug: 'empty-seo', metaTitle: '', metaDescription: '' }, media: {} } });
    if (path === '/public/bootstrap') return json({ data: { settings: { 'contact.companyName': 'Ghar Jatan' }, nav: {} } });
    return notFound('Post');
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove());
});

const renderAt = (slug) => renderWithProviders(<BlogPostPage />, { path: '/blog/:slug', initialPath: `/blog/${slug}` });

describe('BlogPostPage', () => {
  it('renders the article with its date, category and standfirst, and publishes it as an Article', async () => {
    renderAt(POST.slug);
    expect(await screen.findByRole('heading', { level: 1, name: POST.title })).toBeInTheDocument();
    expect(screen.getByText('17 August 2026')).toHaveAttribute('datetime', POST.publishedAt);
    expect(screen.getByRole('link', { name: 'Home care' })).toHaveAttribute('href', '/blog?category=home-care');
    expect(screen.getByText(POST.excerpt)).toBeInTheDocument();
    expect(screen.getByText('Look along the parapet for hairline cracks.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All articles/ })).toHaveAttribute('href', '/blog');

    await waitFor(() => {
      const ld = [...document.head.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));
      expect(ld).toContainEqual(expect.objectContaining({ '@type': 'Article', headline: POST.title, datePublished: POST.publishedAt }));
    });
  });

  it('falls back to the post title when the SEO title was left empty (saved as "")', async () => {
    renderAt('empty-seo');
    expect(await screen.findByRole('heading', { level: 1, name: POST.title })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe(`${POST.title} · Ghar Jatan`));
  });

  it('treats a draft or unknown post as not found', async () => {
    renderAt('a-draft');
    expect(await screen.findByRole('heading', { name: 'We could not find that page' })).toBeInTheDocument();
  });
});
