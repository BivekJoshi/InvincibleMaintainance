/**
 * An invoice's editable part as ResourceForm fields (Phase I) — shared by the manual invoice and a DRAFT's edit form,
 * so both edit the same things the same way: the lines (the kit's `lineItems` field, invoice variant — rupees, the
 * server's amounts), the discount, the VAT choice, the due date, a note and the terms.
 */
export const INVOICE_LINE_FIELDS = [
  { name: 'items', type: 'lineItems', variant: 'invoice', label: 'Lines', gridLabel: 'Invoice lines', maxItems: 200 },
  { name: 'discount', type: 'money', label: 'Discount', span: 'half', description: 'Taken off before VAT.' },
  { name: 'vatApplied', type: 'switch', label: 'Charge VAT', span: 'half', description: 'At the VAT rate in the settings.' },
  { name: 'dueDate', type: 'date', label: 'Due on', span: 'half', description: 'The payment term from the settings, when left empty.' },
  { name: 'note', type: 'textarea', label: 'Note (office only)', rows: 2, maxLength: 20000 },
  { name: 'terms', type: 'textarea', label: 'Terms (printed on the invoice)', rows: 3, maxLength: 20000 },
];

/**
 * What a stage or closing bill's draft may still change (Phase L6): an invoice whose `kind` is not STANDARD has its
 * lines, discount and VAT fixed by the quotation and its stage bills — `PUT` takes only these three.
 */
export const INVOICE_HEADER_FIELDS = INVOICE_LINE_FIELDS.filter((f) => ['dueDate', 'note', 'terms'].includes(f.name));
