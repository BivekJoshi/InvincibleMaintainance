import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link } from 'react-router-dom';
import { useWatch } from 'react-hook-form';
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

describe('ResourceForm options added in L2', () => {
  // A field's spec may follow the values (`adapt`), clear a column (`nullable`), or be a panel with no value (`preview`).
  const schema = z.object({
    mode: z.enum(['TYPED', 'WORKED_OUT']),
    rate: z.coerce.number().min(0).optional(),
    packSize: z.coerce.number().positive().nullable().optional(),
    packLabel: z.string().max(20).nullable().optional(),
  });
  function Echo({ id }) {
    const [mode, rate] = useWatch({ name: ['mode', 'rate'] });
    return <p id={`${id}-title`}>Preview: {mode} at {rate ?? '—'}</p>;
  }
  const fields = [
    { name: 'mode', type: 'select', label: 'Mode', options: [{ value: 'TYPED', label: 'Typed' }, { value: 'WORKED_OUT', label: 'Worked out' }] },
    {
      name: 'rate', type: 'money', label: 'Rate',
      adapt: (v) => (v.mode === 'WORKED_OUT' ? { disabled: true, description: 'Worked out on save.' } : { required: true }),
    },
    { name: 'packSize', type: 'number', label: 'Pack size', nullable: true, adapt: (v) => (v.mode === 'WORKED_OUT' ? { hidden: true } : null) },
    { name: 'packLabel', type: 'text', label: 'Pack', nullable: true },
    { name: 'preview', type: 'preview', label: 'Preview', component: Echo },
  ];

  it('follows the values, sends null for a cleared nullable field, and never sends a preview', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    renderWithProviders(
      <ResourceForm schema={schema} fields={fields} defaultValues={{ mode: 'TYPED', rate: 38000, packSize: 50, packLabel: 'bag' }} onSubmit={onSubmit} />,
    );
    expect(screen.getByText('Preview: TYPED at 380')).toBeInTheDocument();
    expect(screen.getByLabelText(/Rate/)).toBeEnabled();

    await user.clear(screen.getByLabelText('Pack size'));
    await user.clear(screen.getByLabelText('Pack'));
    expect(screen.getByLabelText('Pack size')).toHaveValue(null);

    await user.click(screen.getByRole('combobox', { name: 'Mode' }));
    await user.click(await screen.findByRole('option', { name: 'Worked out' }));
    expect(screen.getByLabelText(/Rate/)).toBeDisabled();
    expect(screen.getByText('Worked out on save.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pack size')).not.toBeInTheDocument();
    expect(screen.getByText('Preview: WORKED_OUT at 380')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // A hidden field keeps its value — here the cleared pack size, sent as null.
    expect(onSubmit.mock.calls[0][0]).toEqual({ mode: 'WORKED_OUT', rate: 380, packSize: null, packLabel: null });
  });
});

describe('ResourceForm — the EditableGrid field types (Phase L3)', () => {
  const cellOf = (gridName, row, key) => screen.getByRole('grid', { name: gridName }).querySelector(`[data-cell="${row}:${key}"]`);

  it('a `measurements` field reads feet-inches, previews each row and the total, and sends numbers', async () => {
    const user = userEvent.setup();
    const { measurementSheetFormSchema } = await import('@/form/schemas/quotation.schema');
    const onSubmit = vi.fn().mockResolvedValue({});
    renderWithProviders(
      <ResourceForm
        schema={measurementSheetFormSchema}
        fields={[{ name: 'measurements', type: 'measurements', label: 'Measurement sheet', unit: 'sq.ft' }]}
        defaultValues={{ measurements: [{ area: 'बैठक कोठा', description: 'East wall', nos: 1, l: 12, h: 10 }] }}
        onSubmit={onSubmit}
      />,
    );
    expect(cellOf('Measurement sheet', 0, 'value')).toHaveTextContent('120');
    await user.click(screen.getByRole('button', { name: 'Add measurement' }));
    await user.keyboard('बैठक कोठा{Tab}Door{Tab}1{Tab}3\'6"{Tab}{Tab}7\'{Tab} ');
    expect(cellOf('Measurement sheet', 1, 'l')).toHaveTextContent('3.5');
    expect(cellOf('Measurement sheet', 1, 'value')).toHaveTextContent('-24.5');
    expect(screen.getByTestId('measurement-total')).toHaveTextContent('95.5');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].measurements).toEqual([
      { area: 'बैठक कोठा', description: 'East wall', nos: 1, l: 12, h: 10 },
      { area: 'बैठक कोठा', description: 'Door', nos: 1, l: 3.5, h: 7, deduct: true },
    ]);
  });

  it('a `measurements` field refuses a length it cannot read', async () => {
    const user = userEvent.setup();
    const { measurementSheetFormSchema } = await import('@/form/schemas/quotation.schema');
    const onSubmit = vi.fn();
    renderWithProviders(
      <ResourceForm
        schema={measurementSheetFormSchema}
        fields={[{ name: 'measurements', type: 'measurements', label: 'Measurement sheet' }]}
        defaultValues={{ measurements: [] }}
        onSubmit={onSubmit}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Add measurement' }));
    await user.keyboard('Hall{Tab}{Tab}{Tab}twelve feet{Enter}');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: /Row 1 · L: Use a number, or feet and inches/ })).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('a generic `grid` field edits rows of small objects and drops a blank one', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    const columns = [
      { key: 'name', header: 'Name', grow: 1, editor: 'text' },
      { key: 'qty', header: 'Qty', width: 80, editor: 'number', align: 'right' },
    ];
    renderWithProviders(
      <ResourceForm
        schema={z.object({ parts: z.array(z.object({ name: z.string(), qty: z.any() }).passthrough()) })}
        fields={[{ name: 'parts', type: 'grid', label: 'Parts', columns }]}
        defaultValues={{ parts: [{ name: 'Hinge', qty: 4 }] }}
        onSubmit={onSubmit}
      />,
    );
    await user.click(cellOf('Parts', 0, 'qty'));
    await user.keyboard('6{Tab}');
    expect(cellOf('Parts', 1, 'name')).toHaveFocus();
    await user.keyboard('{Control>}{Enter}{/Control}');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].parts).toEqual([{ name: 'Hinge', qty: 6 }]);
  });
});

describe('ResourceForm — the payment schedule and checkbox field types (Phase L4)', () => {
  const cellOf = (row, key) => screen.getByRole('grid', { name: 'Payment stages' }).querySelector(`[data-cell="${row}:${key}"]`);
  const STAGES = [
    { id: 'st1', label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT', taxable: 3645000, vat: 473850, total: 4118850 },
    { id: 'st2', label: 'Running bill', basisPoints: 4000, trigger: 'MILESTONE', taxable: 2916000, vat: 379080, total: 3295080 },
    { id: 'st3', label: 'On completion', basisPoints: 1000, trigger: 'ON_COMPLETION', taxable: 729000, vat: 94770, total: 823770 },
  ];

  it('loads stages as shares with the server’s amounts, must make 100 %, offers the presets and sends basis points', async () => {
    const user = userEvent.setup();
    const { paymentScheduleSchema } = await import('@/form/schemas/quotation.schema');
    const onSubmit = vi.fn().mockResolvedValue({});
    renderWithProviders(
      <ResourceForm
        schema={z.object({ paymentStages: paymentScheduleSchema })}
        fields={[{ name: 'paymentStages', type: 'paymentSchedule', label: 'Payment stages', figures: STAGES }]}
        defaultValues={{ paymentStages: STAGES }}
        onSubmit={onSubmit}
      />,
    );
    expect(cellOf(0, 'pct')).toHaveTextContent('50%');
    expect(cellOf(0, 'trigger')).toHaveTextContent('On acceptance (advance)');
    // The amount is the server's figure for the stage — the field multiplies nothing.
    expect(cellOf(0, 'amount')).toHaveTextContent('Rs. 41,188.50');
    expect(cellOf(2, 'amount')).toHaveTextContent('Rs. 8,237.70');
    expect(screen.getByRole('button', { name: '50 · 40 · 10' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('schedule-total')).toHaveTextContent('Adds up to 100%.');

    // 50 + 30 + 10: refused here, as the API would.
    await user.click(cellOf(1, 'pct'));
    await user.keyboard('30{Enter}');
    expect(screen.getByTestId('schedule-total')).toHaveTextContent('Adds up to 90% — 10% short. The stages must make 100%.');
    expect(screen.getByRole('button', { name: '50 · 40 · 10' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The stages add up to 90% — they must make 100%')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    // A preset replaces the rows.
    await user.click(screen.getByRole('button', { name: '40 · 30 · 20 · 10' }));
    expect(screen.getByRole('grid', { name: 'Payment stages' }).querySelectorAll('[data-row]')).toHaveLength(4);
    expect(cellOf(3, 'trigger')).toHaveTextContent('On completion');
    expect(screen.getByTestId('schedule-total')).toHaveTextContent('Adds up to 100%.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].paymentStages).toEqual([
      { label: 'Advance', basisPoints: 4000, trigger: 'ON_ACCEPT' },
      { label: 'Running bill 1', basisPoints: 3000, trigger: 'MILESTONE' },
      { label: 'Running bill 2', basisPoints: 2000, trigger: 'MILESTONE' },
      { label: 'On completion', basisPoints: 1000, trigger: 'ON_COMPLETION' },
    ]);
  });

  it('“100 on completion” is one stage, and a new stage is typed in Nepali', async () => {
    const user = userEvent.setup();
    const { paymentScheduleSchema } = await import('@/form/schemas/quotation.schema');
    const onSubmit = vi.fn().mockResolvedValue({});
    renderWithProviders(
      <ResourceForm
        schema={z.object({ paymentStages: paymentScheduleSchema })}
        fields={[{ name: 'paymentStages', type: 'paymentSchedule', label: 'Payment stages' }]}
        defaultValues={{ paymentStages: [] }}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText('No stages yet. Pick a preset, or add a stage.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '100 on completion' }));
    expect(cellOf(0, 'pct')).toHaveTextContent('100%');
    // Nothing to show yet: no amount is made up.
    expect(cellOf(0, 'amount')).toHaveTextContent('—');
    await user.click(cellOf(0, 'pct'));
    await user.keyboard('60{Enter}');
    await user.click(screen.getByRole('button', { name: 'Add stage' }));
    await user.keyboard('अग्रिम{Tab}40{Enter}');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].paymentStages).toEqual([
      { label: 'On completion', basisPoints: 6000, trigger: 'ON_COMPLETION' },
      { label: 'अग्रिम', basisPoints: 4000, trigger: 'MILESTONE' },
    ]);
  });

  it('a `checkbox` field is a statement ticked on purpose', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    renderWithProviders(
      <ResourceForm
        schema={z.object({ agreed: z.boolean().refine((v) => v, 'Tick it to go on') })}
        fields={[{ name: 'agreed', type: 'checkbox', label: 'I have read it', description: 'Recorded with the change.' }]}
        defaultValues={{}}
        onSubmit={onSubmit}
      />,
    );
    const box = screen.getByRole('checkbox', { name: 'I have read it' });
    expect(box).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Tick it to go on')).toBeInTheDocument();
    await user.click(box);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit.mock.calls[0][0]).toEqual({ agreed: true }));
  });
});
