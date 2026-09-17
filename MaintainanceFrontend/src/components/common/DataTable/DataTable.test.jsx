import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '@/components/common/DataTable/DataTable';
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

describe('DataTable', () => {
  it('selects rows and select-all-on-page, and hands the selection to a bulk action', async () => {
    const user = userEvent.setup();
    const onArchive = vi.fn();
    renderWithProviders(
      <DataTable
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
      <DataTable
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
      <DataTable
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
      <DataTable
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
          <DataTable columns={columns} data={rows} meta={onePage} params={params} onParamsChange={setParams} />
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
      <DataTable
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
      <DataTable columns={columns} data={rows} meta={onePage} params={{ page: 1 }} onParamsChange={onParamsChange} trash={{ onRestore: vi.fn() }} />,
    );
    await user.click(screen.getByRole('button', { name: 'Trash' }));
    expect(onParamsChange).toHaveBeenCalledWith({ page: 1, deleted: 'true' });
  });

  it('expands a row into its details, one row at a time, and closes it again', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DataTable
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
      <DataTable
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
      <DataTable
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
});
