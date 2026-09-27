/**
 * The words on a quotation as the customer reads it — its header, its bill of quantities and its totals — in
 * English and Nepali. The public quotation page picks by the site's language; the builder's Customer view shows
 * either. The page's own words (the answer buttons) stay in its `quotationPageCopy.js`.
 */
export const QUOTATION_DOCUMENT_COPY = {
  en: {
    kind: 'Quotation',
    forCustomer: (name, address) => `For ${name}${address ? ` · ${address}` : ''}`,
    version: (v) => `Version ${v}`,
    validUntil: (date) => `Valid until ${date}`,
    statusLabels: {
      SENT: 'Awaiting your answer',
      APPROVED: 'Accepted',
      CONVERTED: 'Accepted',
      CHANGES_REQUESTED: 'Changes requested',
      REJECTED: 'Declined',
      EXPIRED: 'Expired',
      SUPERSEDED: 'Replaced',
    },
    totals: {
      subtotal: 'Subtotal', discount: 'Discount', vat: (rate) => `VAT ${rate}%`, total: 'Total',
      optional: 'Optional items (not included)',
    },
    terms: 'Terms',
    rows: {
      number: 'No.', description: 'Description', qty: 'Qty', rate: 'Rate', amount: 'Amount',
      optional: 'Optional — not included in the total',
      provisional: 'Provisional — settled by measurement',
      sectionTotal: (number) => `Total of ${number}`,
    },
  },
  ne: {
    kind: 'दरभाउपत्र',
    forCustomer: (name, address) => `${name}${address ? ` · ${address}` : ''} का लागि`,
    version: (v) => `संस्करण ${v}`,
    validUntil: (date) => `${date} सम्म मान्य`,
    statusLabels: {
      SENT: 'तपाईंको जवाफको प्रतीक्षामा',
      APPROVED: 'स्वीकृत',
      CONVERTED: 'स्वीकृत',
      CHANGES_REQUESTED: 'परिवर्तन अनुरोध गरिएको',
      REJECTED: 'अस्वीकृत',
      EXPIRED: 'म्याद सकिएको',
      SUPERSEDED: 'नयाँ संस्करण आएको',
    },
    totals: {
      subtotal: 'उप-जम्मा', discount: 'छुट', vat: (rate) => `मूल्य अभिवृद्धि कर ${rate}%`, total: 'जम्मा',
      optional: 'ऐच्छिक कामहरू (जम्मामा समावेश छैन)',
    },
    terms: 'सर्तहरू',
    rows: {
      number: 'क्र.सं.', description: 'विवरण', qty: 'परिमाण', rate: 'दर', amount: 'रकम',
      optional: 'ऐच्छिक — जम्मामा समावेश छैन',
      provisional: 'अस्थायी — नापपछि यकिन हुने',
      sectionTotal: (number) => `${number} को जम्मा`,
    },
  },
};

/** The copy for a language, English when there is none. */
export const documentCopy = (locale) => QUOTATION_DOCUMENT_COPY[locale] ?? QUOTATION_DOCUMENT_COPY.en;
