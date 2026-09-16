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

  it('drops a null value the form does not edit, so an invisible column cannot block a save', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    const withJob = schema.extend({ jobId: z.string().optional() });
    renderWithProviders(<ResourceForm schema={withJob} fields={fields} defaultValues={{ ...record, jobId: null }} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('jobId');
  });
});

describe('ResourceForm field types added in D2', () => {
  const kitSchema = z.object({
    closed: z.array(z.number()).refine((d) => d.length < 7, 'Leave a day open'),
    // An objectList schema drops blank rows before checking them, as `config/admin/settingsForm.js` does.
    badges: z.preprocess(
      (rows) => rows.filter((r) => r.icon || r.label),
      z.array(z.object({ icon: z.string().min(1, 'Pick an icon'), label: z.string().min(1, 'Write the text') })),
    ),
    cta: z.object({ label: z.string(), url: z.string() }),
    code: z.string().optional(),
  });
  const kitFields = [
    {
      type: 'group', variant: 'card', label: 'Booking', description: 'What the calendar offers.',
      fields: [{ name: 'closed', type: 'weekdays', label: 'Closed days' }],
    },
    {
      name: 'badges', type: 'objectList', label: 'Badges', itemLabel: 'Badge',
      itemFields: [{ name: 'icon', label: 'Icon' }, { name: 'label', label: 'Text' }],
    },
    { name: 'cta', type: 'keyValue', label: 'Button', keys: ['label', 'url'], keyLabels: { label: 'Button text', url: 'Button link' } },
    { name: 'code', type: 'text', label: 'Code', disabled: true },
  ];
  const kitRecord = {
    closed: [6], badges: [{ icon: 'gift', label: 'नि:शुल्क परामर्श' }], cta: { label: 'Book', url: '/book' }, code: 'X',
  };

  it('edits weekdays, rows of objects and fixed keys, and submits them in shape', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    renderWithProviders(<ResourceForm schema={kitSchema} fields={kitFields} defaultValues={kitRecord} onSubmit={onSubmit} />);

    expect(screen.getByRole('region', { name: 'Booking' })).toHaveTextContent('What the calendar offers.');
    expect(screen.getByRole('checkbox', { name: 'Saturday' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Monday' }));
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));

    expect(screen.getByLabelText('Text 1')).toHaveValue('नि:शुल्क परामर्श');
    await user.click(screen.getByRole('button', { name: 'Add badge' }));
    await user.type(screen.getByLabelText('Icon 2'), 'clock');
    await user.type(screen.getByLabelText('Text 2'), '२ घण्टामा जवाफ');
    await user.click(screen.getByRole('button', { name: 'Move badge 2 up' }));
    // A row left completely empty is dropped.
    await user.click(screen.getByRole('button', { name: 'Add badge' }));

    expect(screen.queryByRole('button', { name: /Add row/ })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Button link'));
    await user.type(screen.getByLabelText('Button link'), '/about');
    expect(screen.getByLabelText('Code')).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      closed: [0, 1, 6],
      badges: [{ icon: 'clock', label: '२ घण्टामा जवाफ' }, { icon: 'gift', label: 'नि:शुल्क परामर्श' }],
      cta: { label: 'Book', url: '/about' },
    });
  });

  it('shows a row cell’s error beside that cell and a list error under the field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(
      <ResourceForm schema={kitSchema} fields={kitFields} defaultValues={{ ...kitRecord, closed: [0, 1, 2, 3, 4, 5] }} onSubmit={onSubmit} />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Saturday' }));
    await user.clear(screen.getByLabelText('Text 1'));
    await user.type(screen.getByLabelText('Icon 1'), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Leave a day open')).toBeInTheDocument();
    expect(screen.getByText('Write the text')).toBeInTheDocument();
    expect(screen.getByLabelText('Text 1')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
