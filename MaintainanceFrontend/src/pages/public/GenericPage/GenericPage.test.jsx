import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import GenericPage from '@/pages/public/GenericPage/GenericPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import { json, mockApi, notFound } from '@/test/mockApi';

const ABOUT = {
  id: 'pg1', slug: 'about', title: 'About Ghar Jatan', metaTitle: 'About us — certified engineers',
  body: 'We diagnose first.\n\nहामी पहिले कारण पत्ता लगाउँछौं।',
};

let calls;
beforeEach(() => {
  calls = mockApi(({ path }) => (path === '/public/pages/about' ? json({ data: { page: ABOUT } }) : notFound('Page')));
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.title = '';
});

const renderAt = (slug) => renderWithProviders(<GenericPage />, { path: '/:slug', initialPath: `/${slug}` });

describe('GenericPage', () => {
  it('renders a live page, its paragraphs and its title for search engines', async () => {
    renderAt('about');
    expect(await screen.findByRole('heading', { level: 1, name: 'About Ghar Jatan' })).toBeInTheDocument();
    expect(screen.getByText('We diagnose first.')).toBeInTheDocument();
    expect(screen.getByText('हामी पहिले कारण पत्ता लगाउँछौं।')).toBeInTheDocument();
    expect(document.title).toBe('About us — certified engineers · Ghar Jatan');
    expect(calls[0]).toMatchObject({ path: '/public/pages/about', query: { locale: 'en' } });
  });

  it('shows the not-found page when the API has no such page', async () => {
    renderAt('careers');
    expect(await screen.findByRole('heading', { name: 'We could not find that page' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Try again/ })).not.toBeInTheDocument();
  });
});
