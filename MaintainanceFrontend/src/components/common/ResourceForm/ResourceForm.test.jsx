import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { applyServerErrors } from '@/components/common/ResourceForm/serverErrors';
import { renderWithProviders } from '@/test/renderWithProviders';

const schema = z.object({
  title: z.string().min(3, 'Too short'),
  slug: z.string().optional(),
  answer: z.string().min(1, 'Required'),
  price: z.coerce.number().min(0).optional(),
});

const fields = [
  { name: 'title', type: 'text', label: 'Title', required: true },
  { name: 'slug', type: 'slug', label: 'Slug', source: 'title' },
  { name: 'answer', type: 'textarea', label: 'Answer' },
  { name: 'price', type: 'money', label: 'Price' },
];

const record = { id: 'faq_1', title: 'Is it real?', slug: 'is-it-real', answer: 'Yes', price: 150000 };

const elsewhere = { path: '/elsewhere', element: <p>Elsewhere</p> };

describe('ResourceForm', () => {
  it('shows a paisa record in rupees and submits rupees', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    renderWithProviders(<ResourceForm schema={schema} fields={fields} defaultValues={record} onSubmit={onSubmit} />);

    const price = screen.getByLabelText('Price');
    expect(price).toHaveValue('1,500.00');
    await user.clear(price);
    await user.type(price, '1,23,45,678.90');
    await user.tab();
    expect(price).toHaveValue('1,23,45,678.90');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: 'Is it real?', slug: 'is-it-real', answer: 'Yes', price: 12345678.9 });
  });

  it('maps a 400 details payload onto its fields, and shows what it cannot place above the form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue({
      status: 400,
      data: {
        error: {
          code: 'BAD_REQUEST',
          message: 'Validation failed',
          details: [
            { path: 'answer', message: 'Answer must be at least 20 characters' },
            { path: 'categoryId', message: 'Unknown category' },
          ],
        },
      },
    });
    renderWithProviders(<ResourceForm schema={schema} fields={fields} defaultValues={record} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const answer = screen.getByLabelText('Answer');
    expect(await screen.findByText('Answer must be at least 20 characters')).toBeInTheDocument();
    expect(answer).toHaveAttribute('aria-invalid', 'true');
    expect(answer).toHaveAccessibleDescription('Answer must be at least 20 characters');
    expect(answer).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('categoryId: Unknown category');
  });

  it('places a 409 duplicate on the field it names', () => {
    const setError = vi.fn();
    const alert = applyServerErrors(
      { status: 409, data: { error: { code: 'DUPLICATE', message: 'A record with this slug already exists', details: ['slug'] } } },
      setError,
      ['title', 'slug'],
    );
    expect(setError).toHaveBeenCalledWith('slug', { type: 'server', message: 'This is already in use.' });
    expect(alert).toMatchObject({ details: [], firstField: 'slug' });
  });

  it('asks before leaving with unsaved changes, and stays when told to', async () => {
    const user = userEvent.setup();
    const { router } = renderWithProviders(
      <>
        <Link to="/elsewhere">Go elsewhere</Link>
        <ResourceForm schema={schema} fields={fields} defaultValues={record} onSubmit={vi.fn()} />
      </>,
      { path: '/edit', routes: [elsewhere] },
    );

    await user.type(screen.getByLabelText(/^Title/), ' Really?');
    await user.click(screen.getByRole('link', { name: 'Go elsewhere' }));

    expect(await screen.findByRole('alertdialog', { name: 'Leave without saving?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/edit');
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Is it real? Really?');

    await user.click(screen.getByRole('link', { name: 'Go elsewhere' }));
    await user.click(await screen.findByRole('button', { name: 'Leave without saving' }));
    expect(await screen.findByText('Elsewhere')).toBeInTheDocument();
  });

  it('does not hold a clean form, or the redirect after a successful save', async () => {
    const user = userEvent.setup();
    let router;
    const onSubmit = vi.fn(() => router.navigate('/elsewhere'));
    ({ router } = renderWithProviders(
      <ResourceForm schema={schema} fields={fields} defaultValues={record} onSubmit={onSubmit} />,
      { path: '/edit', routes: [elsewhere] },
    ));

    await user.type(screen.getByLabelText(/^Title/), ' Updated');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Elsewhere')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('is clean after a save, even when the schema transforms a value (an empty optional text, an upper-cased code)', async () => {
    const user = userEvent.setup();
    const transforming = z.object({
      code: z.string().transform((v) => v.toUpperCase()),
      note: z.string().optional().or(z.literal('')).transform((v) => v || undefined),
    });
    const specs = [
      { name: 'code', type: 'text', label: 'Code' },
      { name: 'note', type: 'textarea', label: 'Note' },
    ];
    const onSubmit = vi.fn().mockResolvedValue({});
    renderWithProviders(
      <>
        <ResourceForm schema={transforming} fields={specs} defaultValues={{ code: 'WP' }} onSubmit={onSubmit} />
        <Link to="/elsewhere">Go elsewhere</Link>
      </>,
      { path: '/edit', routes: [elsewhere] },
    );

    await user.type(screen.getByLabelText('Code'), '-x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ code: 'WP-X' });

    await user.click(screen.getByRole('link', { name: 'Go elsewhere' }));
    expect(await screen.findByText('Elsewhere')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('fills the slug from a Devanagari title on a new record, until the slug is edited', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResourceForm schema={schema} fields={fields} onSubmit={vi.fn()} />);

    const slug = screen.getByLabelText('Slug');
    await user.type(screen.getByLabelText(/^Title/), 'पानी चुहावट मर्मत');
    expect(slug).toHaveValue('पानी-चुहावट-मर्मत');

    await user.clear(slug);
    await user.type(slug, 'leak-repair');
    await user.type(screen.getByLabelText(/^Title/), ' सेवा');
    expect(slug).toHaveValue('leak-repair');
  });

  it('never moves a saved slug on its own', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResourceForm schema={schema} fields={fields} defaultValues={record} onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/^Title/), ' Updated');
    expect(screen.getByLabelText('Slug')).toHaveValue('is-it-real');
  });
});
