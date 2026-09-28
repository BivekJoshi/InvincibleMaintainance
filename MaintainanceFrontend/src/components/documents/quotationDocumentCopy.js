/**
 * The words on a quotation as the customer reads it — its letterhead, header, bill of quantities, totals, the
 * contract around it (Phase L4: contract type, duration, exclusions, the payment schedule, the amount in words,
 * the measurements annex) and its terms — in English and Nepali. The public quotation page picks by the site's
 * language; the builder's Customer view and the print show either. The page's own words (the answer buttons)
 * stay in its `quotationPageCopy.js`.
 *
 * Numbers stay in Latin digits in both languages, as every amount does: a customer reads a figure back to the
 * office over the phone. Stage labels, exclusions and terms are the office's own text and are shown as written.
 */
export const QUOTATION_DOCUMENT_COPY = {
  en: {
    kind: 'Quotation',
    /** A variation order (Phase L7): a change to a running job. */
    variation: {
      kind: 'Variation order',
      ofJob: (number) => `Change to your job ${number}`,
    },
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
    letterhead: {
      panVat: 'PAN / VAT No.',
      phone: 'Phone',
      email: 'Email',
    },
    dates: {
      date: 'Date',
      validUntil: 'Valid until',
      bs: (date) => `${date} B.S.`,
    },
    totals: {
      subtotal: 'Subtotal', discount: 'Discount', vat: (rate) => `VAT ${rate}%`, total: 'Total',
      optional: 'Optional items (not included)',
    },
    words: { title: 'Amount in words' },
    terms: 'Terms',
    rows: {
      number: 'No.', description: 'Description', qty: 'Qty', rate: 'Rate', amount: 'Amount',
      optional: 'Optional — not included in the total',
      provisional: 'Provisional — settled by measurement',
      sectionTotal: (number) => `Total of ${number}`,
      swipe: 'Swipe the table sideways to see the rates and amounts.',
    },
    summary: {
      title: 'Summary by section',
      section: 'Section',
      amount: 'Amount',
      other: 'Other items',
      note: 'Section totals only. Ask us if you would like the item-by-item list.',
    },
    contract: {
      title: 'How the final bill is worked out',
      LUMP_SUM: {
        name: 'Lump sum',
        body: 'A fixed price for the work quoted. Anything extra or less is agreed as a variation before it is done.',
      },
      ITEM_RATE: {
        name: 'Item rate',
        body: 'You pay for the work actually done: we measure it when finished and bill the measured quantity at these rates.',
      },
    },
    duration: {
      title: 'Estimated duration',
      days: (n) => `About ${n} ${n === 1 ? 'day' : 'days'}`,
    },
    exclusions: { title: 'Not included in this price' },
    schedule: {
      title: 'Payment schedule',
      stage: 'Stage',
      share: 'Share',
      when: 'When',
      amount: 'Amount',
      vat: (amount) => `incl. VAT ${amount}`,
      total: 'Total',
      triggers: {
        ON_ACCEPT: 'On acceptance (advance)',
        MILESTONE: 'As the work progresses',
        ON_COMPLETION: 'On completion',
      },
    },
    measurements: {
      title: 'Measurements',
      intro: 'How each measured quantity was worked out (lengths in the row’s unit).',
      show: (n) => `Show the measurements (${n} ${n === 1 ? 'item' : 'items'})`,
      hide: 'Hide the measurements',
      area: 'Where', nos: 'Nos', l: 'L', b: 'B', h: 'H', value: 'Qty',
      deduct: 'deduct',
      billed: (qty, unit) => `In the bill: ${qty}${unit ? ` ${unit}` : ''}`,
    },
  },
  ne: {
    kind: 'दरभाउपत्र',
    variation: {
      kind: 'परिवर्तन आदेश',
      ofJob: (number) => `तपाईंको काम ${number} मा परिवर्तन`,
    },
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
    letterhead: {
      panVat: 'प्यान / भ्याट नं.',
      phone: 'फोन',
      email: 'इमेल',
    },
    dates: {
      date: 'मिति',
      validUntil: 'मान्य अवधि',
      bs: (date) => `वि.सं. ${date}`,
    },
    totals: {
      subtotal: 'उप-जम्मा', discount: 'छुट', vat: (rate) => `मूल्य अभिवृद्धि कर ${rate}%`, total: 'जम्मा',
      optional: 'ऐच्छिक कामहरू (जम्मामा समावेश छैन)',
    },
    words: { title: 'अक्षरमा रकम' },
    terms: 'सर्तहरू',
    rows: {
      number: 'क्र.सं.', description: 'विवरण', qty: 'परिमाण', rate: 'दर', amount: 'रकम',
      optional: 'ऐच्छिक — जम्मामा समावेश छैन',
      provisional: 'अस्थायी — नापपछि यकिन हुने',
      sectionTotal: (number) => `${number} को जम्मा`,
      swipe: 'दर र रकम हेर्न तालिकालाई छेउतिर सार्नुहोस्।',
    },
    summary: {
      title: 'खण्डअनुसार सारांश',
      section: 'खण्ड',
      amount: 'रकम',
      other: 'अन्य कामहरू',
      note: 'खण्डको जम्मा मात्र देखाइएको छ। कामअनुसारको विस्तृत सूची चाहिएमा हामीलाई भन्नुहोस्।',
    },
    contract: {
      title: 'अन्तिम बिल कसरी निकालिन्छ',
      LUMP_SUM: {
        name: 'एकमुष्ट',
        body: 'उल्लेखित कामका लागि तोकिएको मूल्य। थप वा घटी काम गर्नुअघि परिवर्तन (भेरिएसन) का रूपमा सहमति गरिन्छ।',
      },
      ITEM_RATE: {
        name: 'दररेटअनुसार',
        body: 'तपाईंले वास्तवमा भएको कामको मात्र भुक्तानी गर्नुहुन्छ: काम सकिएपछि नापिन्छ र नापिएको परिमाणलाई यिनै दरमा बिल गरिन्छ।',
      },
    },
    duration: {
      title: 'अनुमानित अवधि',
      days: (n) => `करिब ${n} दिन`,
    },
    exclusions: { title: 'यो मूल्यमा समावेश नभएका कुरा' },
    schedule: {
      title: 'भुक्तानी तालिका',
      stage: 'चरण',
      share: 'हिस्सा',
      when: 'कहिले',
      amount: 'रकम',
      vat: (amount) => `मू.अ.कर ${amount} सहित`,
      total: 'जम्मा',
      triggers: {
        ON_ACCEPT: 'स्वीकृत गर्दा (अग्रिम)',
        MILESTONE: 'काम अघि बढ्दै जाँदा',
        ON_COMPLETION: 'काम सकिएपछि',
      },
    },
    measurements: {
      title: 'नापजाँच विवरण',
      intro: 'नापिएका परिमाण कसरी निकालिए (लम्बाइ सोही पङ्क्तिको एकाइमा)।',
      show: (n) => `नापजाँच हेर्नुहोस् (${n} काम)`,
      hide: 'नापजाँच लुकाउनुहोस्',
      area: 'स्थान', nos: 'संख्या', l: 'लम्बाइ', b: 'चौडाइ', h: 'उचाइ', value: 'परिमाण',
      deduct: 'घटाउ',
      billed: (qty, unit) => `बिलमा: ${qty}${unit ? ` ${unit}` : ''}`,
    },
  },
};

/** The copy for a language, English when there is none. */
export const documentCopy = (locale) => QUOTATION_DOCUMENT_COPY[locale] ?? QUOTATION_DOCUMENT_COPY.en;
