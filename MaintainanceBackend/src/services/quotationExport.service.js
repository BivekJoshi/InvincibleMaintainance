import ExcelJS from 'exceljs';
import { AUDIT_EVENTS } from '../shared/enums.js';
import { seesCosts } from '../utils/moneyWall.js';
import { toRupees } from '../utils/money.js';
import { recordEvent } from './audit.service.js';
import { getQuotation } from './quotation.service.js';

/**
 * A quotation as an Excel workbook (Phase L4) that recalculates like the estimator's own sheet:
 *
 *   BOQ               the rows with live formulas — amount = ROUND(qty × rate, 2), section subtotals and
 *                     the total over the rows that count (column "In total": optional rows say No),
 *                     discount, VAT, total. A measured row's quantity links to its measurement sheet.
 *   Measurements      nos × L × B × H per row, deductions negative, a total per BOQ row.
 *   Payment schedule  each stage's amount (the server's split, which sums to the total exactly).
 *   Cost              costs:read only — unit cost and cost per row, and the margin.
 *
 * Every formula cell also stores the server's figure as its cached result, so the file opens showing the
 * right numbers anywhere, and recalculating gives the same ones (tests/api/23-quotation-document).
 * The customer's copy — anyone without costs:read — never has a Cost sheet.
 */

const rs = (paisa) => toRupees(paisa ?? 0);
const MONEY = '#,##,##0.00';
const bold = { bold: true };

const CONTRACT_WORDS = {
  LUMP_SUM: 'Lump sum — the price quoted; anything extra or less is agreed as a variation first.',
  ITEM_RATE: 'Item rate — the finished work is measured and billed at these rates.',
};

function header(ws, q, title) {
  ws.addRow([q.letterhead.companyName]).font = { bold: true, size: 14 };
  if (q.letterhead.address) ws.addRow([[q.letterhead.address, q.letterhead.city].filter(Boolean).join(', ')]);
  if (q.letterhead.panVatNo) ws.addRow([`PAN/VAT ${q.letterhead.panVatNo}`]);
  ws.addRow([]);
  ws.addRow([`${title} — ${q.number} v${q.version}`]).font = bold;
  ws.addRow([`Customer: ${q.customer.name}`]);
  ws.addRow([`Date: ${q.createdAt.toISOString().slice(0, 10)} (BS ${q.dates.createdAtBs ?? '—'})`]);
  ws.addRow([]);
}

/** Measurements sheet; returns, per BOQ row id, the cell holding that row's measured total. */
function measurementSheet(ws, q) {
  header(ws, q, 'Measurements');
  ws.addRow(['No', 'Area', 'Description', 'Nos', 'L', 'B', 'H', 'Deduct', 'Quantity']).font = bold;
  const totals = new Map();
  for (const row of q.items.filter((r) => r.rowType === 'ITEM' && r.measurements?.length)) {
    const first = ws.rowCount + 1;
    for (const m of row.measurements) {
      const r = ws.addRow([row.number, m.area ?? '', m.description ?? '', m.nos ?? null, m.l ?? null, m.b ?? null, m.h ?? null, m.deduct ? 'Yes' : '']);
      const n = r.number;
      const dims = [m.nos, m.l, m.b, m.h].filter((v) => v != null);
      const value = (m.deduct ? -1 : 1) * (dims.length ? dims.reduce((a, v) => a * Number(v), 1) : 0);
      // PRODUCT of blank cells is 0 in Excel and LibreOffice, so a row with no numbers counts nothing.
      r.getCell(9).value = { formula: `IF(H${n}="Yes",-1,1)*IF(COUNT(D${n}:G${n})=0,0,PRODUCT(D${n}:G${n}))`, result: value };
    }
    const t = ws.addRow(['', '', `Total for ${row.number}`]);
    t.font = bold;
    t.getCell(9).value = { formula: `ROUND(SUM(I${first}:I${t.number - 1}),3)`, result: row.netQty };
    totals.set(row.id, `Measurements!I${t.number}`);
  }
  ws.columns.forEach((c) => { c.width = 12; });
  ws.getColumn(3).width = 32;
  return totals;
}

function boqSheet(ws, q, measuredCells) {
  header(ws, q, 'Quotation');
  ws.addRow(['No', 'Description', 'Unit', 'Qty', 'Rate (Rs)', 'Amount (Rs)', 'In total']).font = bold;
  const counted = [];
  let sectionStart = null;
  let section = null;
  const closeSection = () => {
    if (!section) return;
    const end = ws.rowCount;
    const r = ws.addRow(['', `Subtotal ${section.number}`]);
    r.font = bold;
    r.getCell(6).value = { formula: `SUMIFS(F${sectionStart}:F${end},G${sectionStart}:G${end},"Yes")`, result: rs(section.subtotal) };
    r.getCell(6).numFmt = MONEY;
    section = null;
  };
  const sections = new Map(q.boq.sections.filter((sec) => sec.index != null).map((sec) => [sec.index, sec]));

  q.items.forEach((row, i) => {
    if (row.rowType === 'SECTION') {
      closeSection();
      section = sections.get(i) ?? { number: row.number, subtotal: 0 };
      ws.addRow([row.number, row.description]).font = bold;
      sectionStart = ws.rowCount + 1;
      return;
    }
    if (row.rowType === 'NOTE') {
      ws.addRow(['', row.description]).font = { italic: true };
      return;
    }
    const r = ws.addRow([row.number, row.isOptional ? `${row.description} (optional)` : row.description, row.unit ?? '']);
    const n = r.number;
    const measured = measuredCells.get(row.id);
    r.getCell(4).value = measured
      ? { formula: `ROUND(${measured}*(1+${row.wastagePct}/100),3)`, result: row.qty }
      : row.qty;
    r.getCell(5).value = rs(row.rate);
    r.getCell(5).numFmt = MONEY;
    r.getCell(6).value = { formula: `ROUND(D${n}*E${n},2)`, result: rs(row.amount) };
    r.getCell(6).numFmt = MONEY;
    r.getCell(7).value = row.isOptional ? 'No' : 'Yes';
    if (!row.isOptional) counted.push(n);
    if (row.spec) ws.addRow(['', row.spec]).font = { italic: true, size: 9 };
  });
  closeSection();

  ws.addRow([]);
  const first = 1;
  const last = ws.rowCount;
  const line = (label, value, formula) => {
    const r = ws.addRow(['', label]);
    r.font = bold;
    r.getCell(6).value = formula ? { formula, result: value } : value;
    r.getCell(6).numFmt = MONEY;
    return r.number;
  };
  // Every item row, whatever its section, over the "In total" column — optional rows say No.
  const sub = line('Subtotal', rs(q.subtotal), `SUMIFS(F${first}:F${last},G${first}:G${last},"Yes",A${first}:A${last},"<>")`);
  const disc = line('Discount', rs(q.discount));
  const taxable = line('Taxable amount', rs(q.subtotal - q.discount), `F${sub}-F${disc}`);
  const vat = line(`VAT ${q.vatApplied ? q.vatRate : 0}%`, rs(q.vatAmount), q.vatApplied ? `ROUND(F${taxable}*${q.vatRate}/100,2)` : '0');
  line('Total', rs(q.total), `F${taxable}+F${vat}`);
  ws.addRow(['', q.totalInWords.en]).font = { italic: true };
  ws.addRow([]);
  ws.addRow(['', `Contract: ${CONTRACT_WORDS[q.contractType] ?? q.contractType}`]);
  if (q.estimatedDays) ws.addRow(['', `Duration: about ${q.estimatedDays} days`]);
  if (q.exclusions) ws.addRow(['', `Not included: ${q.exclusions}`]);
  if (q.terms) ws.addRow(['', `Terms: ${q.terms}`]);

  ws.getColumn(1).width = 7;
  ws.getColumn(2).width = 48;
  ws.getColumn(3).width = 9;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 15;
  ws.getColumn(7).width = 9;
  return { counted };
}

function scheduleSheet(wb, q) {
  const ws = wb.addWorksheet('Payment schedule');
  header(ws, q, 'Payment schedule');
  ws.addRow(['Stage', 'Share', 'When', 'Amount (Rs)']).font = bold;
  const first = ws.rowCount + 1;
  for (const st of q.paymentStages) {
    const r = ws.addRow([st.label, `${st.basisPoints / 100}%`, st.trigger.replace(/_/g, ' ').toLowerCase(), rs(st.total)]);
    r.getCell(4).numFmt = MONEY;
  }
  if (q.paymentStages.length) {
    const r = ws.addRow(['Total', '', '']);
    r.font = bold;
    r.getCell(4).value = { formula: `SUM(D${first}:D${ws.rowCount})`, result: rs(q.total) };
    r.getCell(4).numFmt = MONEY;
  }
  ws.getColumn(1).width = 24;
  ws.getColumn(4).width = 15;
}

function costSheet(wb, q) {
  const ws = wb.addWorksheet('Cost');
  header(ws, q, 'Cost and margin (internal)');
  ws.addRow(['No', 'Description', 'Qty', 'Unit cost (Rs)', 'Cost (Rs)', 'Amount (Rs)', 'Margin (Rs)']).font = bold;
  const first = ws.rowCount + 1;
  for (const row of q.items.filter((r) => r.rowType === 'ITEM' && !r.isOptional)) {
    const r = ws.addRow([row.number, row.description, row.qty, row.unitCost == null ? null : rs(row.unitCost)]);
    const n = r.number;
    r.getCell(5).value = row.unitCost == null ? 'unknown' : { formula: `ROUND(C${n}*D${n},2)`, result: rs(row.costAmount) };
    r.getCell(6).value = rs(row.amount);
    r.getCell(7).value = row.unitCost == null ? null : { formula: `F${n}-E${n}`, result: rs(row.amount - row.costAmount) };
    [4, 5, 6, 7].forEach((c) => { r.getCell(c).numFmt = MONEY; });
  }
  const last = ws.rowCount;
  const t = ws.addRow(['', 'Total cost']);
  t.font = bold;
  t.getCell(5).value = { formula: `SUM(E${first}:E${last})`, result: rs(q.costTotal) };
  t.getCell(5).numFmt = MONEY;
  ws.addRow(['', q.costComplete ? `Margin on the taxable amount: ${q.margin?.pct ?? '—'}%` : 'Some costs are unknown — the margin is not known.']);
  ws.getColumn(2).width = 44;
  [4, 5, 6, 7].forEach((c) => { ws.getColumn(c).width = 15; });
}

/**
 * GET /admin/quotations/:id/export.xlsx — the workbook for the caller, recorded as `export.xlsx`.
 * @returns {Promise<{ filename: string, buffer: Buffer }>}
 */
export async function exportQuotationXlsx(id, ctx) {
  const q = await getQuotation(id);
  const withCost = seesCosts(ctx);
  const wb = new ExcelJS.Workbook();
  wb.creator = q.letterhead.companyName;
  wb.created = new Date();
  // BOQ is the first tab; it is filled after the measurements, whose cells its quantities point at.
  const boq = wb.addWorksheet('BOQ');
  const measurements = wb.addWorksheet('Measurements');
  boqSheet(boq, q, measurementSheet(measurements, q));
  scheduleSheet(wb, q);
  if (withCost) costSheet(wb, q);

  await recordEvent(AUDIT_EVENTS.EXPORT_XLSX, { model: 'Quotation', recordId: id, meta: { number: q.number, version: q.version, costSheet: withCost } });
  return { filename: `${q.number}-v${q.version}.xlsx`, buffer: Buffer.from(await wb.xlsx.writeBuffer()) };
}
