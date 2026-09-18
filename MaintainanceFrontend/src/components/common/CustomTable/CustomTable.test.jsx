import { useState } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';

const rows = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
];
const columns = [{ key: 'name', header: 'Name', sortable: true }];
const onePage = { page: 1, limit: 20, total: 3, pages: 1 };
const rowLabel = (row) => row.name;

/** Names in the order the body shows them. */
const shownOrder = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent);

describe('CustomTable', () => {
  it('selects rows and select-all-on-page, and hands the selection to a bulk action', async () => {
    const user = userEvent.setup();
    const onArchive = vi.fn();
    renderWithProviders(
      <CustomTable
        columns={columns} data={rows} meta={onePage} params={{}} onParamsChange={vi.fn()} rowLabel={rowLabel}
        bulkActions={[{ label: 'Archive', onSelect: onArchive }]}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: 'Select Bravo' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(onArchive).toHaveBeenLastCalledWith([rows[1]], expect.any(Function));

    await user.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }));
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(onArchive).toHaveBeenLastCalledWith(rows, expect.any(Function));

    const clearSelection = onArchive.mock.lastCall[1];
    act(() => clearSelection());
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
  });

  it('changes the page size through `limit` and goes back to page 1', async () => {
    const user = userEvent.setup();
    const onParamsChange = vi.fn();
    renderWithProviders(
      <CustomTable
        columns={columns} data={rows} meta={{ page: 2, limit: 20, total: 45, pages: 3 }}
        params={{ page: 2, limit: 20, status: 'NEW' }} onParamsChange={onParamsChange}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Rows per page' }));
    await user.click(await screen.findByRole('option', { name: '50' }));
    expect(onParamsChange).toHaveBeenCalledWith({ page: 1, limit: 50, status: 'NEW' });
  });

  it('reorders with Move down at once, and sends the new order offset by earlier pages', async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn().mockResolvedValue(undefined);
    const onParamsChange = vi.fn();
    renderWithProviders(
      <CustomTable
        columns={columns} data={rows} meta={{ page: 2, limit: 10, total: 13, pages: 2 }}
        params={{ page: 2, limit: 10, sort: '-name' }} onParamsChange={onParamsChange}
        reorderable onReorder={onReorder} rowLabel={rowLabel}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Reorder' }));
    // A manual order means nothing while sorted by a column.
    expect(onParamsChange).toHaveBeenCalledWith({ page: 2, limit: 10, sort: undefined });

    await user.click(screen.getByRole('button', { name: 'Move Alpha down' }));
    expect(shownOrder()).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(onReorder).toHaveBeenCalledWith([
      { id: 'b', sortOrder: 10 },
      { id: 'a', sortOrder: 11 },
      { id: 'c', sortOrder: 12 },
    ]);
    expect(screen.getByRole('button', { name: 'Move Bravo up' })).toBeDisabled();
  });

  it('puts the order back when saving it fails', async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn().mockRejectedValue(new Error('offline'));
    renderWithProviders(
      <CustomTable
        columns={columns} data={rows} meta={onePage} params={{}} onParamsChange={vi.fn()}
        reorderable onReorder={onReorder} rowLabel={rowLabel}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Reorder' }));
    await user.click(screen.getByRole('button', { name: 'Move Charlie up' }));
    await waitFor(() => expect(shownOrder()).toEqual(['Alpha', 'Bravo', 'Charlie']));
    expect(onReorder).toHaveBeenCalledTimes(1);
  });

  it('re-syncs the search box when q changes outside it (Back, a reset)', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [params, setParams] = useState({ q: 'pipes' });
      return (
        <>
          <button type="button" onClick={() => setParams({})}>Reset</button>
          <CustomTable columns={columns} data={rows} meta={onePage} params={params} onParamsChange={setParams} />
        </>
      );
    }
    renderWithProviders(<Harness />);

    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('pipes');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('');
  });

  it('in the trash, offers Restore to everyone and Delete forever only with cms:purge', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const table = (
      <CustomTable
        columns={columns} data={rows} meta={onePage} params={{ deleted: 'true' }} onParamsChange={vi.fn()}
        rowLabel={rowLabel} trash={{ onRestore, onPurge: vi.fn() }}
      />
    );

    const editor = renderWithProviders(table, { preloadedState: signedInAs('EDITOR') });
    await user.click(screen.getByRole('button', { name: 'Actions for Alpha' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: 'Delete forever' })).not.toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: 'Restore' }));
    expect(onRestore).toHaveBeenCalledWith(rows[0]);
    editor.unmount();

    renderWithProviders(table, { preloadedState: signedInAs('ADMIN') });
    await user.click(screen.getByRole('button', { name: 'Actions for Alpha' }));
    expect(await screen.findByRole('menuitem', { name: 'Delete forever' })).toBeInTheDocument();
  });

  it('toggles the trash through ?deleted=true', async () => {
    const user = userEvent.setup();
    const onParamsChange = vi.fn();
    renderWithProviders(
      <CustomTable columns={columns} data={rows} meta={onePage} params={{ page: 1 }} onParamsChange={onParamsChange} trash={{ onRestore: vi.fn() }} />,
    );
    await user.click(screen.getByRole('button', { name: 'Trash' }));
    expect(onParamsChange).toHaveBeenCalledWith({ page: 1, deleted: 'true' });
  });

  it('expands a row into its details, one row at a time, and closes it again', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CustomTable
        columns={columns} data={rows} meta={onePage} params={{}} onParamsChange={vi.fn()} rowLabel={rowLabel}
        expandable={{ render: (row) => <p>Details of {row.name}</p> }}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'Show details of Bravo' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByText('Details of Bravo')).toBeInTheDocument();
    expect(screen.queryByText('Details of Alpha')).not.toBeInTheDocument();
    const open = screen.getByRole('button', { name: 'Hide details of Bravo' });
    expect(open).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(open.getAttribute('aria-controls'))).toHaveTextContent('Details of Bravo');
    await user.click(open);
    expect(screen.queryByText('Details of Bravo')).not.toBeInTheDocument();
  });

  it('applies a text filter on Enter, not on every key', async () => {
    const user = userEvent.setup();
    const onParamsChange = vi.fn();
    renderWithProviders(
      <CustomTable
        columns={columns} data={rows} meta={onePage} params={{ page: 3 }} onParamsChange={onParamsChange}
        filters={[{ key: 'requestId', label: 'Request id', type: 'text' }]}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'Request id' }), '  req-123 ');
    expect(onParamsChange).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onParamsChange).toHaveBeenLastCalledWith({ page: 1, requestId: 'req-123' });
  });

  it('lists enum options under their group headings', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CustomTable
        columns={columns} data={rows} meta={onePage} params={{}} onParamsChange={vi.fn()}
        filters={[{
          key: 'event', label: 'Event', type: 'enum',
          options: [{ value: 'lead.*', label: 'Every lead event', group: 'Leads' }, { value: 'auth.login', label: 'Signed in', group: 'Sign-in' }],
        }]}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: 'Event' }));
    const groups = await screen.findAllByRole('group');
    expect(groups.map((g) => g.textContent)).toEqual(['LeadsEvery lead event', 'Sign-inSigned in']);
  });

  it('sorts through ?sort: ascending, then descending, then off', async () => {
    const user = userEvent.setup();
    const seen = [];
    function Harness() {
      const [params, setParams] = useState({ page: 1 });
      return (
        <CustomTable
          columns={columns} data={rows} meta={onePage} params={params}
          onParamsChange={(next) => { seen.push(next.sort); setParams(next); }}
        />
      );
    }
    renderWithProviders(<Harness />);
    const header = () => screen.getByRole('columnheader', { name: 'Name' });

    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(header()).toHaveAttribute('aria-sort', 'ascending');
    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(header()).toHaveAttribute('aria-sort', 'descending');
    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(header()).not.toHaveAttribute('aria-sort');
    expect(seen).toEqual(['name', '-name', undefined]);
  });

  it('hides a column from the Columns menu and remembers it under storageKey', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    const wide = [
      { key: 'name', header: 'Name', hideable: false },
      { key: 'city', header: 'City' },
      { key: 'phone', header: 'Phone' },
      { key: 'email', header: 'Email', hidden: true },
      { key: 'notes', header: 'Notes' },
    ];
    const data = [{ id: 'a', name: 'Alpha', city: 'Pokhara', phone: '9800000000', email: 'a@x.np', notes: 'नमस्ते' }];
    const table = <CustomTable columns={wide} data={data} meta={onePage} params={{}} onParamsChange={vi.fn()} storageKey="test" />;
    const first = renderWithProviders(table);

    expect(screen.queryByRole('columnheader', { name: 'Email' })).not.toBeInTheDocument();
    expect(screen.getByText('नमस्ते')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Columns' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).queryByRole('menuitemcheckbox', { name: 'Name' })).not.toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'City' }));
    expect(screen.queryByRole('columnheader', { name: 'City' })).not.toBeInTheDocument();
    expect(screen.queryByText('Pokhara')).not.toBeInTheDocument();
    first.unmount();

    renderWithProviders(table);
    expect(screen.queryByRole('columnheader', { name: 'City' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Phone' })).toBeInTheDocument();
  });

  it('opens a row on click, but not when its checkbox is ticked', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    renderWithProviders(
      <CustomTable
        columns={columns} data={rows} meta={onePage} params={{}} onParamsChange={vi.fn()} rowLabel={rowLabel}
        onRowClick={onRowClick} bulkActions={[{ label: 'Archive', onSelect: vi.fn() }]}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    expect(onRowClick).not.toHaveBeenCalled();
    await user.click(screen.getByText('Bravo'));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  describe('Material React Table–style layout', () => {
    const wide = [
      { key: 'name', header: 'Name', hideable: false },
      { key: 'city', header: 'City' },
      { key: 'phone', header: 'Phone' },
      { key: 'total', header: 'Total', cell: (r) => `Rs. ${(r.total / 100).toFixed(2)}`, exportValue: (r) => r.total / 100 },
      { key: 'notes', header: 'Notes' },
    ];
    const people = [
      { id: 'a', name: 'Alpha', city: 'Pokhara', phone: '9800000000', total: 123450, notes: 'नमस्ते, "hi"' },
      { id: 'b', name: 'Bravo', city: 'Butwal', phone: '9811111111', total: 5, notes: '=SUM(A1)' },
    ];
    const headerNames = () => screen.getAllByRole('columnheader').map((th) => th.getAttribute('aria-label') ?? th.textContent);
    const renderWide = (props = {}) => renderWithProviders(
      <CustomTable
        columns={wide} data={people} meta={{ page: 2, limit: 10, total: 12, pages: 2 }} params={{}}
        onParamsChange={vi.fn()} rowLabel={(r) => r.name} {...props}
      />,
    );
    const columnMenu = async (user, name) => {
      await user.click(screen.getByRole('button', { name: `${name} column actions` }));
      return screen.findByRole('menu');
    };

    beforeEach(() => localStorage.clear());

    it('pins a column to the left, sticky, and unpins it', async () => {
      const user = userEvent.setup();
      renderWide();
      await user.click(within(await columnMenu(user, 'Phone')).getByRole('menuitem', { name: 'Pin to left' }));
      expect(headerNames()).toEqual(['Phone', 'Name', 'City', 'Total', 'Notes']);
      const phone = screen.getByRole('columnheader', { name: 'Phone' });
      expect(phone).toHaveClass('sticky');
      expect(phone.style.left).toBe('0px');

      await user.click(within(await columnMenu(user, 'Phone')).getByRole('menuitem', { name: 'Unpin' }));
      expect(headerNames()).toEqual(['Name', 'City', 'Phone', 'Total', 'Notes']);
      expect(screen.getByRole('columnheader', { name: 'Phone' })).not.toHaveClass('sticky');
    });

    it('moves a column, hides one from its menu, and remembers the layout until Reset layout', async () => {
      const user = userEvent.setup();
      const first = renderWide({ storageKey: 'people' });
      await user.click(within(await columnMenu(user, 'Name')).getByRole('menuitem', { name: 'Move right' }));
      expect(headerNames()).toEqual(['City', 'Name', 'Phone', 'Total', 'Notes']);
      const menu = await columnMenu(user, 'City');
      expect(within(menu).getByRole('menuitem', { name: 'Move left' })).toHaveAttribute('aria-disabled', 'true');
      await user.click(within(menu).getByRole('menuitem', { name: 'Hide column' }));
      expect(headerNames()).toEqual(['Name', 'Phone', 'Total', 'Notes']);
      first.unmount();

      renderWide({ storageKey: 'people' });
      expect(headerNames()).toEqual(['Name', 'Phone', 'Total', 'Notes']);
      await user.click(screen.getByRole('button', { name: 'Columns' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Reset layout' }));
      expect(headerNames()).toEqual(['Name', 'City', 'Phone', 'Total', 'Notes']);
    });

    it('sorts from the column menu through ?sort', async () => {
      const user = userEvent.setup();
      const onParamsChange = vi.fn();
      renderWithProviders(
        <CustomTable
          columns={[{ ...wide[0], sortable: true }, ...wide.slice(1)]} data={people} meta={onePage}
          params={{ page: 1 }} onParamsChange={onParamsChange}
        />,
      );
      await user.click(within(await columnMenu(user, 'Name')).getByRole('menuitem', { name: 'Sort descending' }));
      expect(onParamsChange).toHaveBeenLastCalledWith({ page: 1, sort: '-name' });
    });

    it('resizes a column from the keyboard', async () => {
      const user = userEvent.setup();
      renderWide();
      const handle = screen.getByRole('separator', { name: 'Resize City' });
      handle.focus();
      await user.keyboard('{ArrowRight}');
      // jsdom has no layout, so the rendered width falls back to TanStack's 150; one step is 16px.
      expect(screen.getByRole('columnheader', { name: 'City' }).style.width).toBe('166px');
      expect(handle).toHaveAttribute('aria-valuenow', '166');
    });

    it('switches density and full screen; Escape leaves full screen', async () => {
      const user = userEvent.setup();
      renderWide();
      await user.click(screen.getByRole('button', { name: /Row density: Normal/ }));
      expect(screen.getByText('Pokhara').closest('td')).toHaveClass('py-5');
      await user.click(screen.getByRole('button', { name: /Row density: Comfortable/ }));
      expect(screen.getByText('Pokhara').closest('td')).toHaveClass('py-1.5');

      await user.click(screen.getByRole('button', { name: 'Full screen' }));
      expect(screen.getByRole('dialog', { name: 'Table, full screen' })).toHaveClass('fixed');
      expect(screen.getByRole('columnheader', { name: 'City' })).toHaveClass('sticky', 'top-0');
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Table, full screen' })).not.toBeInTheDocument();
    });

    it('numbers rows across pages', () => {
      renderWide({ enableRowNumbers: true });
      expect(screen.getByText('11')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('keeps short in-page tables plain', () => {
      renderWide({ searchable: false });
      expect(screen.queryByRole('button', { name: 'Columns' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /column actions/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });

    it('exports what the cells show as formula-safe UTF-8 CSV, or just the selection', async () => {
      const user = userEvent.setup();
      const blobs = [];
      Object.assign(URL, { createObjectURL: vi.fn((blob) => { blobs.push(blob); return 'blob:csv'; }), revokeObjectURL: vi.fn() });
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      renderWide({ exportable: true, exportName: 'people', bulkActions: [{ label: 'Archive', onSelect: vi.fn() }] });

      await user.click(screen.getByRole('button', { name: 'Export' }));
      // The byte-order mark Excel needs for Nepali (Blob#text() strips it, so read the bytes).
      expect([...new Uint8Array(await blobs[0].arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect((await blobs[0].text()).split('\r\n')).toEqual([
        'Name,City,Phone,Total,Notes',
        'Alpha,Pokhara,9800000000,1234.5,"नमस्ते, ""hi"""',
        "Bravo,Butwal,9811111111,0.05,'=SUM(A1)",
      ]);
      expect(click.mock.contexts[0].download).toMatch(/^people-\d{4}-\d{2}-\d{2}\.csv$/);

      await user.click(screen.getByRole('checkbox', { name: 'Select Bravo' }));
      await user.click(screen.getByRole('button', { name: 'Export' }));
      await user.click(await screen.findByRole('menuitem', { name: '1 selected (CSV)' }));
      expect((await blobs[1].text()).split('\r\n')).toHaveLength(2);
      click.mockRestore();
    });
  });
});
