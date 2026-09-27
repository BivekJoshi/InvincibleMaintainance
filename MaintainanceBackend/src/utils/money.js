/**
 * All money in this system is an integer number of paisa (NPR x 100).
 * Nothing multiplies or divides money outside this module.
 */

export const toPaisa = (rupees) => Math.round(Number(rupees || 0) * 100);
export const toRupees = (paisa) => Number(paisa || 0) / 100;

/** Round half-up to the nearest paisa. */
const r = (n) => Math.round(n + Number.EPSILON);

/** qty may be fractional (e.g. 12.5 sq.ft); rate is paisa per unit. */
export function lineAmount(qty, ratePaisa) {
  return r(Number(qty || 0) * Number(ratePaisa || 0));
}

/**
 * Compute document totals once, at document level, so VAT never accumulates
 * per-line rounding error.
 * @param {{qty:number, rate:number}[]} items
 * @param {{discount?:number, vatApplied?:boolean, vatRate?:number}} opts
 */
export function documentTotals(items, { discount = 0, vatApplied = true, vatRate = 13 } = {}) {
  const lines = items.map((i) => ({ ...i, amount: lineAmount(i.qty, i.rate) }));
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const safeDiscount = Math.min(Math.max(0, r(discount)), subtotal);
  const taxable = subtotal - safeDiscount;
  const vatAmount = vatApplied ? r((taxable * vatRate) / 100) : 0;
  return { lines, subtotal, discount: safeDiscount, vatApplied, vatRate, vatAmount, total: taxable + vatAmount };
}

export function formatNpr(paisa, { withSymbol = true } = {}) {
  const value = toRupees(paisa);
  const s = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return withSymbol ? `Rs. ${s}` : s;
}

/** Sums a list of paisa amounts safely. */
export const sum = (nums) => nums.reduce((a, b) => a + Number(b || 0), 0);

/** Rounds half away from zero — for signed amounts (a variation's omission line), where `r` would lean up. */
export const rs = (n) => (Math.sign(n) * Math.round(Math.abs(n) + Number.EPSILON)) || 0;

/** `amount × part / whole`, rounded (signed); 0 when there is no whole. */
export const proRata = (amount, part, whole) => (whole ? rs((amount * part) / whole) : 0);

/**
 * Splits an integer total by weights (basis points, quantities…) with the largest-remainder method: the
 * parts are integers and always add up to `total`; a tie goes to the earlier part.
 * @param {number} total  paisa
 * @param {number[]} weights  non-negative, not all zero
 */
export function allocate(total, weights) {
  const whole = weights.reduce((a, w) => a + w, 0);
  if (!(whole > 0)) throw new Error('allocate needs at least one positive weight');
  const parts = weights.map((w) => Math.floor((total * w) / whole));
  const byRemainder = weights
    .map((w, i) => ({ i, rem: (total * w) % whole }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  let left = total - parts.reduce((a, p) => a + p, 0);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts;
}

/**
 * What one unit of a rate-library item costs, from its recipe (L-D1). Each component's batch cost is
 * `qty × price × (100 + wastage%) / 100`, rounded once; the buckets are that ÷ `recipeQty`, rounded; the
 * direct cost is their sum, so the breakdown always adds up; overhead is a % of direct.
 *
 * A component whose price is unknown (`null` — a material with no purchase rate) is left out and the
 * result says `complete: false`: an unknown cost is never priced at zero.
 *
 * @param {{ kind: 'MATERIAL'|'LABOUR'|'EQUIPMENT'|'OTHER', qty: number, wastagePct?: number, price: number|null }[]} components
 *   price: paisa per unit of the component (a material's purchase rate, a trade's day wage, an equipment cost)
 * @param {{ recipeQty?: number, overheadPct?: number }} opts  the recipe is for `recipeQty` units of work
 * @returns {{ material: number, labour: number, equipment: number, other: number, direct: number,
 *   overhead: number, unitCost: number, complete: boolean, lines: { lineCost: number|null }[] }}
 */
export function recipeCost(components, { recipeQty = 1, overheadPct = 0 } = {}) {
  const per = Number(recipeQty) > 0 ? Number(recipeQty) : 1;
  const batch = { MATERIAL: 0, LABOUR: 0, EQUIPMENT: 0, OTHER: 0 };
  const lines = components.map((c) => {
    if (c.price == null) return { lineCost: null };
    const lineCost = r((Number(c.qty || 0) * Number(c.price) * (100 + Number(c.wastagePct || 0))) / 100);
    batch[c.kind] += lineCost;
    return { lineCost };
  });
  const material = r(batch.MATERIAL / per);
  const labour = r(batch.LABOUR / per);
  const equipment = r(batch.EQUIPMENT / per);
  const other = r(batch.OTHER / per);
  const direct = material + labour + equipment + other;
  const overhead = r((direct * Number(overheadPct || 0)) / 100);
  return {
    material, labour, equipment, other, direct, overhead, unitCost: direct + overhead,
    complete: components.length > 0 && lines.every((l) => l.lineCost !== null),
    lines,
  };
}

/**
 * The selling rate for a unit cost: profit on top, then rounded UP to `roundTo` paisa (100 = the next
 * rupee), so rounding never eats the margin. `null` in, `null` out.
 */
export function sellRate(unitCost, { profitPct = 0, roundTo = 0 } = {}) {
  if (unitCost == null) return null;
  const derived = r((unitCost * (100 + Number(profitPct || 0))) / 100);
  return roundTo > 0 ? Math.ceil(derived / roundTo) * roundTo : derived;
}

/** Margin on the selling price: `{ amount, pct }` (pct to 2 dp, null on a zero price); null when the cost is unknown. */
export function margin(sell, cost) {
  if (cost == null) return null;
  const amount = sell - cost;
  return { amount, pct: sell ? Number(((amount / sell) * 100).toFixed(2)) : null };
}

/**
 * A BOQ's totals (Phase L3): `documentTotals` over the ITEM rows that are not optional — SECTION and NOTE
 * rows carry no money, and an optional row is priced but never totalled. Adds each row's own amount
 * (`rowAmounts`, null for SECTION/NOTE), the subtotal of each section (rows before the first section
 * form an untitled one), and the optional rows' total.
 * @param {{ rowType?: 'ITEM'|'SECTION'|'NOTE', title?: string, qty?: number, rate?: number, isOptional?: boolean }[]} rows
 * @param {{ discount?: number, vatApplied?: boolean, vatRate?: number }} opts
 */
export function boqTotals(rows, opts = {}) {
  const isItem = (row) => (row.rowType ?? 'ITEM') === 'ITEM';
  const totals = documentTotals(rows.filter((row) => isItem(row) && !row.isOptional), opts);
  const rowAmounts = rows.map((row) => (isItem(row) ? lineAmount(row.qty, row.rate) : null));
  const sections = [];
  let current = null;
  let optionalTotal = 0;
  rows.forEach((row, i) => {
    if (row.rowType === 'SECTION') {
      // A stored SECTION row keeps its title in `description`.
      current = { index: i, title: row.title ?? row.description ?? null, subtotal: 0 };
      sections.push(current);
    } else if (isItem(row)) {
      if (row.isOptional) { optionalTotal += rowAmounts[i]; return; }
      if (!current) { current = { index: null, title: null, subtotal: 0 }; sections.push(current); }
      current.subtotal += rowAmounts[i];
    }
  });
  return { ...totals, rowAmounts, sections, optionalTotal };
}

/**
 * A quotation's payment schedule (L-D3): each stage's share of the taxable amount and of the VAT, both
 * split by its basis points with `allocate` — so the stages add up to the quotation's total exactly, and
 * no stage's VAT goes negative.
 * @param {{ subtotal: number, discount: number, vatAmount: number }} totals  a `documentTotals` result
 * @param {{ basisPoints: number }[]} stages
 */
export function paymentSchedule(totals, stages) {
  const weights = stages.map((st) => st.basisPoints);
  const taxable = allocate(totals.subtotal - totals.discount, weights);
  const vat = allocate(totals.vatAmount, weights);
  return stages.map((st, i) => ({ ...st, taxable: taxable[i], vat: vat[i], total: taxable[i] + vat[i] }));
}

/**
 * The final bill (Phase L8): the contract's totals less what was already billed (advance and running
 * bills), in taxable amount and in VAT, so everything invoiced reconciles to the contract to the paisa.
 * A negative `due` is the caller's to refuse (credit notes are deferred).
 * @param {{ qty: number, rate: number }[]} lines  the contract's lines (paisa)
 * @param {{ taxable: number, vat: number }[]} earlierBills
 * @param {{ discount?: number, vatApplied?: boolean, vatRate?: number }} opts
 */
export function finalBillTotals(lines, earlierBills, opts = {}) {
  const contract = documentTotals(lines, opts);
  const billed = { taxable: sum(earlierBills.map((b) => b.taxable)), vat: sum(earlierBills.map((b) => b.vat)) };
  billed.total = billed.taxable + billed.vat;
  const due = { taxable: contract.subtotal - contract.discount - billed.taxable, vat: contract.vatAmount - billed.vat };
  due.total = due.taxable + due.vat;
  return { contract, billed, due };
}

/** A discount of `pct`% of the subtotal (Phase L3's "%" helper): rounded once, between 0 and the subtotal. */
export function discountForPct(subtotal, pct) {
  return Math.min(Math.max(0, r((subtotal * Number(pct || 0)) / 100)), subtotal);
}

/**
 * The discount that brings a document to `targetTotal` (VAT included) — "Rs 4,50,000 flat". The taxable
 * amount is solved for, then nudged by a paisa so `documentTotals` lands on the target exactly or, when
 * VAT rounding makes that impossible, on the nearest total below it. A target above the undiscounted
 * total gives no discount.
 */
export function discountForTarget(subtotal, targetTotal, { vatApplied = true, vatRate = 13 } = {}) {
  const totalFor = (taxable) => taxable + (vatApplied ? r((taxable * vatRate) / 100) : 0);
  const guess = vatApplied ? Math.round((targetTotal * 100) / (100 + vatRate)) : targetTotal;
  let taxable = Math.min(subtotal, Math.max(0, guess + 1));
  while (taxable > 0 && totalFor(taxable) > targetTotal) taxable -= 1;
  return subtotal - taxable;
}

const EN_ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const EN_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
/** Nepali has its own word for each number to 99 — they are not built from tens and ones. */
const NE_TO_99 = ['शून्य', 'एक', 'दुई', 'तीन', 'चार', 'पाँच', 'छ', 'सात', 'आठ', 'नौ', 'दस',
  'एघार', 'बाह्र', 'तेह्र', 'चौध', 'पन्ध्र', 'सोह्र', 'सत्र', 'अठार', 'उन्नाइस', 'बीस',
  'एक्काइस', 'बाइस', 'तेइस', 'चौबिस', 'पच्चिस', 'छब्बिस', 'सत्ताइस', 'अट्ठाइस', 'उनन्तीस', 'तीस',
  'एकतीस', 'बत्तीस', 'तेत्तीस', 'चौँतीस', 'पैँतीस', 'छत्तीस', 'सैँतीस', 'अठतीस', 'उनन्चालीस', 'चालीस',
  'एकचालीस', 'बयालीस', 'त्रिचालीस', 'चवालीस', 'पैँतालीस', 'छयालीस', 'सतचालीस', 'अठचालीस', 'उनन्चास', 'पचास',
  'एकाउन्न', 'बाउन्न', 'त्रिपन्न', 'चवन्न', 'पचपन्न', 'छपन्न', 'सन्ताउन्न', 'अन्ठाउन्न', 'उनन्साठी', 'साठी',
  'एकसट्ठी', 'बयसट्ठी', 'त्रिसट्ठी', 'चौसट्ठी', 'पैँसट्ठी', 'छयसट्ठी', 'सतसट्ठी', 'अठसट्ठी', 'उनन्सत्तरी', 'सत्तरी',
  'एकहत्तर', 'बहत्तर', 'त्रिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छयहत्तर', 'सतहत्तर', 'अठहत्तर', 'उनासी', 'असी',
  'एकासी', 'बयासी', 'त्रियासी', 'चौरासी', 'पचासी', 'छयासी', 'सतासी', 'अठासी', 'उनान्नब्बे', 'नब्बे',
  'एकानब्बे', 'बयानब्बे', 'त्रियानब्बे', 'चौरानब्बे', 'पन्चानब्बे', 'छयानब्बे', 'सन्तानब्बे', 'अन्ठानब्बे', 'उनान्सय'];

const WORDS = {
  en: {
    below100: (n) => (n < 20 ? EN_ONES[n] : `${EN_TENS[Math.floor(n / 10)]}${n % 10 ? `-${EN_ONES[n % 10]}` : ''}`),
    units: { crore: 'Crore', lakh: 'Lakh', thousand: 'Thousand', hundred: 'Hundred' },
    say: (words, paisa) => `Rupees ${words}${paisa ? ` and ${paisa} Paisa` : ''} Only`,
  },
  ne: {
    below100: (n) => NE_TO_99[n],
    units: { crore: 'करोड', lakh: 'लाख', thousand: 'हजार', hundred: 'सय' },
    say: (words, paisa) => `रुपैयाँ ${words}${paisa ? ` र ${paisa} पैसा` : ''} मात्र`,
  },
};

/** A whole number in words, in crore / lakh / thousand / hundred (a crore count above 99 recurses). */
function inWords(n, lang) {
  const { below100, units } = WORDS[lang];
  if (n === 0) return below100(0);
  const parts = [];
  const push = (count, unit) => { if (count) parts.push(`${count >= 100 ? inWords(count, lang) : below100(count)} ${unit}`); };
  push(Math.floor(n / 10_000_000), units.crore);
  push(Math.floor((n % 10_000_000) / 100_000), units.lakh);
  push(Math.floor((n % 100_000) / 1000), units.thousand);
  push(Math.floor((n % 1000) / 100), units.hundred);
  if (n % 100) parts.push(below100(n % 100));
  return parts.join(' ');
}

/**
 * An amount (paisa) in words, as a Nepali quotation or invoice states its total (Phase L4):
 * "Rupees Twenty-Eight Lakh … and Seventy Paisa Only" / "रुपैयाँ अट्ठाइस लाख … र सत्तरी पैसा मात्र".
 * @param {number} paisa  a non-negative integer
 * @param {'en'|'ne'} [locale]
 */
export function amountInWords(paisa, locale = 'en') {
  const lang = WORDS[locale] ? locale : 'en';
  const rupees = Math.floor(paisa / 100);
  const rest = paisa % 100;
  return WORDS[lang].say(inWords(rupees, lang), rest ? inWords(rest, lang) : null);
}
