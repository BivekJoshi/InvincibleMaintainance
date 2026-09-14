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
});
