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
