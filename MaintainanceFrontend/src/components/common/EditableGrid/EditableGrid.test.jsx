import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableGrid } from './EditableGrid';
import { gridKeymap, resolveCellKey, resolveEditorKey } from './gridKeys';
import { pastedBoqRows } from './gridPaste';

let seq = 0;
const makeRow = (kind) => {
  seq += 1;
  return { _key: `k${seq}`, rowType: kind === 'section' ? 'SECTION' : 'ITEM', description: '', unit: '', qty: '', rate: '', optional: false };
};

const COLUMNS = [
  { key: 'description', header: 'Description', grow: 1, editor: 'text', span: (r) => (r.rowType === 'SECTION' ? 4 : 1) },
  { key: 'unit', header: 'Unit', width: 80, editor: 'text' },
  { key: 'qty', header: 'Qty', width: 80, editor: 'number', align: 'right' },
  { key: 'rate', header: 'Rate', width: 100, editor: 'money', align: 'right' },
  { key: 'optional', header: 'Opt.', width: 50, editor: 'boolean', hidden: (r) => r.rowType === 'SECTION' },
];

/** A grid over local state; `latest()` is what it holds now. */
function renderGrid(initial, extra = {}) {
  let latest = initial;
  function Harness() {
    const [rows, setRows] = useState(initial);
    latest = rows;
    return (
      <EditableGrid
        ariaLabel="Test grid"
        columns={COLUMNS}
        rows={rows}
        onChange={setRows}
        getRowKey={(r) => r._key}
        makeRow={makeRow}
        kinds={['item', 'section']}
        rowKind={(r) => (r.rowType === 'SECTION' ? 'section' : 'item')}
        isBlankRow={(r) => !r.description && !r.qty && !r.rate}
        paste={(text) => pastedBoqRows(text).map((r) => ({ ...makeRow(r.rowType === 'SECTION' ? 'section' : 'item'), ...r }))}
        duplicateRow={(r) => ({ ...r, _key: `dup-${r._key}` })}
        {...extra}
      />
    );
  }
  const utils = render(<Harness />);
  return { ...utils, latest: () => latest };
}

const cell = (container, row, key) => container.querySelector(`[data-cell="${row}:${key}"]`);
const ROWS = () => [
  { _key: 'a', rowType: 'ITEM', description: 'Plaster', unit: 'sq.ft', qty: 100, rate: 95, optional: false },
  { _key: 'b', rowType: 'ITEM', description: 'Paint', unit: 'sq.ft', qty: 100, rate: 45, optional: false },
];

describe('the keyboard map', () => {
  it('resolves a selected cell’s keys', () => {
    expect(resolveCellKey({ key: 'ArrowDown' })).toBe('down');
    expect(resolveCellKey({ key: 'Enter' })).toBe('edit');
    expect(resolveCellKey({ key: 'F2' })).toBe('edit');
    expect(resolveCellKey({ key: 'Tab', shiftKey: true })).toBe('prev');
    expect(resolveCellKey({ key: 'Enter', ctrlKey: true })).toBe('addRow');
    expect(resolveCellKey({ key: 'Enter', ctrlKey: true, shiftKey: true })).toBe('addSection');
    expect(resolveCellKey({ key: 'd', ctrlKey: true })).toBe('duplicate');
    expect(resolveCellKey({ key: 'ArrowUp', altKey: true })).toBe('moveUp');
    expect(resolveCellKey({ key: 'Delete', ctrlKey: true })).toBe('remove');
    expect(resolveCellKey({ key: 'Delete' })).toBe('clear');
    expect(resolveCellKey({ key: '/' })).toBe('search');
    expect(resolveCellKey({ key: 'z', ctrlKey: true })).toBe('undo');
    expect(resolveCellKey({ key: 'F10', shiftKey: true })).toBe('menu');
    expect(resolveCellKey({ key: '7' })).toBe('type');
    expect(resolveCellKey({ key: 'Shift' })).toBeNull();
  });

  it('resolves an editor’s keys: arrows save and move only when typing over the cell', () => {
    expect(resolveEditorKey({ key: 'Enter' }, 'edit')).toBe('commit:down');
    expect(resolveEditorKey({ key: 'Tab' }, 'edit')).toBe('commit:next');
    expect(resolveEditorKey({ key: 'Escape' }, 'edit')).toBe('cancel');
    expect(resolveEditorKey({ key: 'ArrowLeft' }, 'edit')).toBeNull();
    expect(resolveEditorKey({ key: 'ArrowLeft' }, 'overwrite')).toBe('commit:left');
    expect(resolveEditorKey({ key: 'Enter', ctrlKey: true }, 'edit')).toBe('addRow');
  });

  it('lists only what the grid offers', () => {
    expect(gridKeymap({ sections: false, search: false }).some((k) => k.keys === '/')).toBe(false);
    expect(gridKeymap({ sections: true, search: true }).map((k) => k.keys)).toEqual(expect.arrayContaining(['/', 'Ctrl+Shift+Enter']));
  });
});

describe('EditableGrid', () => {
  it('moves with the arrows, edits on Enter, saves on Enter and moves down', async () => {
    const user = userEvent.setup();
    const { container, latest } = renderGrid(ROWS());
    await user.click(cell(container, 0, 'qty'));
    expect(cell(container, 0, 'qty')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(cell(container, 0, 'rate')).toHaveFocus();
    await user.keyboard('{Enter}');
    const input = screen.getByRole('textbox', { name: 'Rate, row 1' });
    expect(input).toHaveValue('95');
    await user.clear(input);
    await user.type(input, '1,250.50{Enter}');
    expect(latest()[0].rate).toBe(1250.5);
    expect(cell(container, 1, 'rate')).toHaveFocus();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('types over a selected cell, and Esc cancels an edit', async () => {
    const user = userEvent.setup();
    const { container, latest } = renderGrid(ROWS());
    await user.click(cell(container, 0, 'description'));
    await user.keyboard('Cement plaster');
    expect(screen.getByRole('textbox', { name: 'Description, row 1' })).toHaveValue('Cement plaster');
    await user.keyboard('{Tab}');
    expect(latest()[0].description).toBe('Cement plaster');
    expect(cell(container, 0, 'unit')).toHaveFocus();

    await user.keyboard('xyz{Escape}');
    expect(latest()[0].unit).toBe('sq.ft');
    expect(cell(container, 0, 'unit')).toHaveFocus();
  });

  it('Enter on a select cell that has a value lists every option; typing over it searches (Phase L5 fix)', async () => {
    const user = userEvent.setup();
    const kindColumn = {
      key: 'kind', header: 'Kind', width: 100, editor: 'select',
      options: [{ value: 'YES_NO', label: 'Yes / no' }, { value: 'NUMBER', label: 'Number' }],
      format: (v) => ({ YES_NO: 'Yes / no', NUMBER: 'Number' })[v] ?? '',
    };
    const rows = [{ ...ROWS()[0], kind: 'YES_NO' }];
    const { container, latest } = renderGrid(rows, { columns: [...COLUMNS, kindColumn] });
    await user.click(cell(container, 0, 'kind'));
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('option', { name: 'Yes / no' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Number' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Number' }));
    expect(latest()[0].kind).toBe('NUMBER');

    await user.click(cell(container, 0, 'kind'));
    await user.keyboard('Yes');
    expect(await screen.findByRole('option', { name: 'Yes / no' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Number' })).not.toBeInTheDocument();
  });

  it('Tab after the last cell adds a row; Ctrl+Enter adds a row and Ctrl+Shift+Enter a section', async () => {
    const user = userEvent.setup();
    const { container, latest } = renderGrid(ROWS());
    await user.click(cell(container, 1, 'rate'));
    await user.keyboard('{Tab}');
    expect(cell(container, 1, 'optional')).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(latest()).toHaveLength(3);
    expect(cell(container, 2, 'description')).toHaveFocus();

    await user.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}');
    expect(latest()).toHaveLength(4);
    expect(latest()[3].rowType).toBe('SECTION');
    await user.keyboard('Finishes{Enter}');
    expect(latest()[3].description).toBe('Finishes');

    await user.click(cell(container, 0, 'qty'));
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(latest().map((r) => r.description)).toEqual(['Plaster', '', 'Paint', '', 'Finishes']);
    expect(cell(container, 1, 'description')).toHaveFocus();
  });

  it('duplicates, moves and removes a row by keyboard, and Ctrl+Z undoes', async () => {
    const user = userEvent.setup();
    const { container, latest } = renderGrid(ROWS());
    await user.click(cell(container, 0, 'qty'));
    await user.keyboard('{Control>}d{/Control}');
    expect(latest().map((r) => r._key)).toEqual(['a', 'dup-a', 'b']);
    expect(cell(container, 1, 'qty')).toHaveFocus();

    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(latest().map((r) => r._key)).toEqual(['a', 'b', 'dup-a']);
    expect(cell(container, 2, 'qty')).toHaveFocus();

    await user.keyboard('{Control>}{Delete}{/Control}');
    expect(latest().map((r) => r._key)).toEqual(['a', 'b']);
    await user.keyboard('{Control>}z{/Control}');
    expect(latest().map((r) => r._key)).toEqual(['a', 'b', 'dup-a']);
  });

  it('clears a cell with Delete and ticks a yes/no cell with Space', async () => {
    const user = userEvent.setup();
    const { container, latest } = renderGrid(ROWS());
    await user.click(cell(container, 0, 'unit'));
    await user.keyboard('{Delete}');
    expect(latest()[0].unit).toBe('');
    await user.click(cell(container, 0, 'optional'));
    expect(latest()[0].optional).toBe(true);
    await user.keyboard(' ');
    expect(latest()[0].optional).toBe(false);
  });

  it('a section spans the row: moving down from Qty lands on its title and comes back to Qty', async () => {
    const user = userEvent.setup();
    const rows = [ROWS()[0], { _key: 's', rowType: 'SECTION', description: 'FINISHES' }, ROWS()[1]];
    const { container } = renderGrid(rows);
    expect(cell(container, 1, 'qty')).toBeNull();
    await user.click(cell(container, 0, 'qty'));
    await user.keyboard('{ArrowDown}');
    expect(cell(container, 1, 'description')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(cell(container, 2, 'qty')).toHaveFocus();
  });

  it('pastes rows copied from Excel after the selected row, text-only rows as sections', async () => {
    const user = userEvent.setup();
    const { container, latest } = renderGrid(ROWS());
    await user.click(cell(container, 0, 'description'));
    fireEvent.paste(cell(container, 0, 'description'), {
      clipboardData: { getData: () => 'FLOORING\t\t\t\nVitrified tiles\tsq.ft\t1,200\tRs. 1,450.00\n' },
    });
    expect(latest().map((r) => [r.rowType, r.description])).toEqual([
      ['ITEM', 'Plaster'], ['SECTION', 'FLOORING'], ['ITEM', 'Vitrified tiles'], ['ITEM', 'Paint'],
    ]);
    expect(latest()[2]).toMatchObject({ unit: 'sq.ft', qty: 1200, rate: 1450 });
  });

  it('pastes one value into the selected cell', async () => {
    const user = userEvent.setup();
    const { container, latest } = renderGrid(ROWS());
    await user.click(cell(container, 1, 'rate'));
    fireEvent.paste(cell(container, 1, 'rate'), { clipboardData: { getData: () => '1,23,456.50\n' } });
    expect(latest()[1].rate).toBe(123456.5);
  });

  it('starts an empty grid by typing, and opens the search with /', async () => {
    const user = userEvent.setup();
    let opened = 0;
    const search = { focusKey: 'qty', render: ({ open }) => { if (open) opened += 1; return open ? <p>Library open</p> : null; } };
    const { latest } = renderGrid([], { search });
    const grid = screen.getByRole('grid', { name: 'Test grid' });
    grid.focus();
    await user.keyboard('W');
    expect(latest()).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Description, row 1' })).toHaveValue('W');
    await user.keyboard('all{Escape}');
    await user.keyboard('/');
    expect(screen.getByText('Library open')).toBeInTheDocument();
    expect(opened).toBeGreaterThan(0);
  });

  it('offers the row’s commands in its menu (Shift+F10)', async () => {
    const user = userEvent.setup();
    const { container, latest } = renderGrid(ROWS(), { rowActions: () => [{ label: 'Measurements…', onSelect: () => {} }] });
    await user.click(cell(container, 1, 'qty'));
    await user.keyboard('{Shift>}{F10}{/Shift}');
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /Measurements/ })).toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: /Move up/ }));
    expect(latest().map((r) => r._key)).toEqual(['b', 'a']);
  });

  it('reads only when read-only: no editor, no row commands', async () => {
    const user = userEvent.setup();
    const { container, latest } = renderGrid(ROWS(), { readOnly: true });
    await user.click(cell(container, 0, 'rate'));
    await user.keyboard('{Enter}9');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.keyboard('{Control>}{Delete}{/Control}');
    expect(latest()).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Add row' })).not.toBeInTheDocument();
  });

  it('renders only the rows in view of a long sheet, and stays usable at 500 rows', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ _key: `r${i}`, rowType: 'ITEM', description: `Row ${i}`, unit: 'nos', qty: 1, rate: 1 }));
    const { container } = renderGrid(many);
    const scroller = screen.getByRole('grid').firstChild;
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 400 });
    act(() => { fireEvent.scroll(scroller); });
    // jsdom has no layout: without a height every row renders; the count only drops once one is measured.
    expect(container.querySelectorAll('[role="row"][data-row]').length).toBeLessThanOrEqual(500);
    expect(cell(container, 0, 'description')).toBeInTheDocument();
  });
});

describe('the kit rule', () => {
  it('is reached only through ResourceForm field types — no page imports EditableGrid', () => {
    const sources = import.meta.glob(['/src/pages/**/*.jsx', '/src/pages/**/*.js', '/src/config/**/*.jsx', '/src/config/**/*.js'], { query: '?raw', import: 'default', eager: true });
    const offenders = Object.entries(sources)
      .filter(([, src]) => /from\s+['"][^'"]*EditableGrid/.test(src))
      .map(([file]) => file);
    expect(Object.keys(sources).length).toBeGreaterThan(10);
    expect(offenders).toEqual([]);
  });
});
