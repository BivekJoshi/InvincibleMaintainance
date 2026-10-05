/**
 * The customer's documents in English and Nepali (Phase J1, J1.5) — every word on the pages a customer opens from an
 * SMS link, with no account: the quotation (`/quotation/:token`, with its Accept · Ask for changes · Decline answer and
 * the advance it raises), the invoice (`/invoice/:token`), the warranty certificate and its claim (`/warranty/:token`)
 * and the booked site visit (`/visit/:token`). It replaces L4–L5's `quotationDocumentCopy.js`, `quotationPageCopy.js`
 * and `visitPageCopy.js`.
 *
 * - `document` — what a quotation and an invoice share: the letterhead, the rows of the bill, the totals, the contract,
 *   the payment schedule, the measurements annex, a final bill's deductions.
 * - `quotation` / `invoice` / `warranty` — each document's own words, with the statuses, kinds, triggers and payment
 *   methods a customer reads (not the office's `*_LABELS` in `config/constants.js`; `documents.test.js` holds every
 *   value of those lists to words here).
 * - `quotationPage` / `invoicePage` / `visit` — the page around a document: the answers, the outcomes, the advance.
 * - `errors` — the API codes these pages word their own way (`useApiErrorText(DOCUMENTS)`; `common.js` has the rest).
 *
 * The office's own text — stage labels, exclusions, terms, row descriptions, a deduction's "Less: advance INV-…" — is
 * shown as written. Figures stay in Latin digits in both languages (a customer reads them back over the phone); the
 * money and the dates come from `helpers/format.js` in the page's language. `{year}` and `{day}` are passed as strings.
 * The admin panel shows these components too (the office's invoice page, the builder's Customer view, the print) —
 * in English there, unless a document is pinned to the customer's language.
 */
export const DOCUMENTS = {
  en: {
    document: {
      retry: 'Try again',
      letterhead: {
        panVat: 'PAN / VAT No.',
        phone: 'Phone',
        email: 'Email',
      },
      dates: {
        date: 'Date',
        adBs: '{ad} ({bs} B.S.)',
      },
      rows: {
        number: 'No.',
        description: 'Description',
        qty: 'Qty',
        rate: 'Rate',
        amount: 'Amount',
        optional: 'Optional — not included in the total',
        provisional: 'Provisional — settled by measurement',
        sectionTotal: 'Total of {number}',
        swipe: 'Swipe the table sideways to see the rates and amounts.',
      },
      totals: {
        subtotal: 'Subtotal',
        discount: 'Discount',
        vat: 'VAT {rate}%',
        total: 'Total',
        optional: 'Optional items (not included)',
      },
      words: { title: 'Amount in words' },
      terms: 'Terms',
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
        days: { one: 'About {count} day', other: 'About {count} days' },
      },
      exclusions: { title: 'Not included in this price' },
      schedule: {
        title: 'Payment schedule',
        stage: 'Stage',
        share: 'Share',
        amount: 'Amount',
        vat: 'incl. VAT {amount}',
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
        show: { one: 'Show the measurements ({count} item)', other: 'Show the measurements ({count} items)' },
        hide: 'Hide the measurements',
        area: 'Where',
        nos: 'Nos',
        l: 'L',
        b: 'B',
        h: 'H',
        value: 'Qty',
        deduct: 'deduct',
        billed: 'In the bill: {qty}',
        billedUnit: 'In the bill: {qty} {unit}',
      },
      /** A final bill's earlier stage bills, taken off it (Phase L8) — the invoice's "Deducted" block. */
      deductions: {
        title: 'Deducted — billed before',
        body: 'The advance and running bills already sent for this work, taken off this bill.',
        bill: 'Bill',
        amount: 'Amount',
      },
    },

    quotation: {
      kind: 'Quotation',
      /** A variation order (Phase L7): a change to a running job. */
      variation: {
        kind: 'Variation order',
        ofJob: 'Change to your job {job}',
      },
      forCustomer: 'For {name}',
      forCustomerAt: 'For {name} · {address}',
      version: 'Version {version}',
      validUntil: 'Valid until {date}',
      /** The statuses a customer's link can show (`GET /public/quotations/:token`). */
      status: {
        SENT: 'Awaiting your answer',
        APPROVED: 'Accepted',
        CONVERTED: 'Accepted',
        CHANGES_REQUESTED: 'Changes requested',
        REJECTED: 'Declined',
        EXPIRED: 'Expired',
        SUPERSEDED: 'Replaced',
      },
    },

    quotationPage: {
      requestedChanges: {
        title: 'You asked us to change',
        body: 'This version includes those changes.',
      },
      prompt: {
        title: 'Is this quotation right for you?',
        body: 'Tap one answer. You do not need an account.',
      },
      buttons: { accept: 'Accept', changes: 'Ask for changes', decline: 'Decline' },
      accept: {
        title: 'Accept this quotation?',
        body: 'You are accepting the work in this quotation for {total}.',
        confirm: 'Yes, accept',
        cancel: 'Go back',
      },
      changes: {
        title: 'What would you like changed?',
        body: 'Tell us in your own words — English or Nepali. We will send you an updated quotation.',
        label: 'Your message',
        placeholder: 'e.g. Please add the balcony wall and start after Dashain',
        confirm: 'Send my request',
        cancel: 'Go back',
        tooShort: 'Tell us a little more (at least 5 characters)',
        tooLong: 'Please keep it under 1000 characters',
      },
      decline: {
        title: 'Decline this quotation?',
        body: 'You can tell us why, if you like. We will not start any work.',
        reasons: 'The main reason (optional)',
        label: 'Anything else? (optional)',
        placeholder: 'e.g. It is over my budget for now',
        confirm: 'Decline',
        cancel: 'Go back',
        tooLong: 'Please keep it under 1000 characters',
      },
      /** The chips offered when declining — `DECLINE_CATEGORIES`, sent as the decision's `category`. */
      declineReasons: {
        PRICE: 'Too expensive',
        COMPETITOR: 'Chose another company',
        POSTPONED: 'Not now / later',
        BUDGET: 'No budget',
        OWN_LABOUR: 'Doing it ourselves',
        OTHER: 'Other reason',
      },
      outcome: {
        accepted: {
          title: 'Thank you — quotation accepted',
          body: 'Our team will call you to schedule the work.',
          bodyAdvance: 'Our team will call you to schedule the work once the advance is paid.',
          job: 'Your job number is {number}.',
        },
        changes: {
          title: 'Thank you — we have your request',
          body: 'We will send you an updated quotation.',
          yours: 'Your message',
        },
        declined: {
          title: 'Quotation declined',
          body: 'We have let our team know. Call us if you would like a different offer.',
        },
        expired: {
          title: 'This quotation has expired',
          body: 'The rates it was built from may have moved. Call us and we will send a fresh one.',
          call: 'Call {phone}',
        },
        replaced: {
          title: 'There is a newer version of this quotation',
          body: 'We updated it after your last message. Please look at the latest one.',
          open: 'Open the latest version',
        },
        replacedPending: {
          title: 'This quotation has been replaced',
          body: 'We are preparing a new version and will send you its link.',
        },
        closed: {
          title: 'This quotation is not open for an answer',
          body: 'Please call us if you have a question about it.',
        },
      },
      /** The advance an accepted quotation raised (Phase L6) — "Pay the advance of Rs X by <date>". */
      advance: {
        due: 'Pay the advance of {amount} by {date}',
        dueNoDate: 'Pay the advance of {amount}',
        body: 'We start scheduling the work once the advance is paid. Invoice {number} shows the ways to pay.',
        pay: 'Pay the advance',
        paid: 'Advance received — thank you',
        paidBody: 'We have recorded the payment on invoice {number}. Our team will call you to schedule the work.',
      },
      error: 'We could not record your answer. Please try again.',
      /** A variation order (Phase L7): a change to a job already under way — no new job, no advance. */
      variation: {
        notice: {
          title: 'Change to your job {job}',
          body: 'This adds work to — or takes work off — the job we agreed. Accepting it adds it to that job: there is no new job and no new advance.',
        },
        prompt: {
          title: 'Do you accept this change to your job?',
          body: 'Tap one answer. You do not need an account.',
        },
        accept: 'Accept this change',
        acceptTitle: 'Accept this change?',
        acceptBody: 'This change to job {job} comes to {total}.',
        acceptConfirm: 'Yes, accept the change',
        accepted: {
          title: 'Thank you — the change is accepted',
          body: 'We have added it to your job {job}. Our team will carry on with the work.',
        },
      },
    },

    invoice: {
      kind: 'Invoice',
      forCustomer: 'For {name}',
      forCustomerPan: 'For {name} · PAN/VAT {pan}',
      issued: 'Issued {date}',
      due: 'Due {date}',
      quotation: 'Quotation {number}',
      void: 'This invoice is void — nothing is owed on it',
      totals: {
        vat: 'VAT ({rate}%)',
        vatNotApplied: 'VAT (not applied)',
        paid: 'Paid',
        due: 'Amount due',
        settled: 'Settled',
      },
      /** `INVOICE_STATUSES` — the badge a customer sees (the office's page shows the same words). */
      status: {
        DRAFT: 'Draft',
        SENT: 'Sent',
        PARTIAL: 'Part paid',
        PAID: 'Paid',
        OVERDUE: 'Overdue',
        VOID: 'Void',
      },
      /** `INVOICE_KINDS` (Phase L6) — the heading of the stage line under the dates. */
      kinds: {
        STANDARD: 'Standard',
        ADVANCE: 'Advance',
        RUNNING: 'Running bill',
        FINAL: 'Final bill',
      },
      /** The payment stage it bills: "Advance — on acceptance (50%)", "Advance — Mobilisation (40%)". */
      stage: {
        heading: 'Payment stage',
        when: {
          ON_ACCEPT: 'on acceptance',
          MILESTONE: 'at a milestone',
          ON_COMPLETION: 'on completion',
        },
        label: '{heading} — {label}',
        labelShare: '{heading} — {label} ({share}%)',
        share: '{heading} ({share}%)',
      },
      payments: {
        title: 'Payments received',
        voided: 'Voided',
        why: 'Why: {reason}',
        /** `PAYMENT_METHODS`. */
        methods: {
          CASH: 'Cash',
          BANK: 'Bank transfer',
          ESEWA: 'eSewa',
          KHALTI: 'Khalti',
          FONEPAY: 'Fonepay',
          CHEQUE: 'Cheque',
        },
      },
    },

    invoicePage: {
      questions: 'Questions about this invoice? Call us and quote {number}.',
      print: 'Print',
    },

    warranty: {
      title: 'Warranty certificate',
      validUntil: 'Valid until {date}',
      ended: 'This warranty ended on {date}',
      voided: 'This warranty is no longer valid',
      customer: 'Customer',
      job: 'Job',
      work: 'Work carried out',
      completed: 'Completed',
      coversUntil: 'Covers until',
      scope: 'Scope',
      /** `WARRANTY_STATUSES` — the seal's words. */
      status: {
        ACTIVE: 'Active',
        CLAIMED: 'Claim open',
        EXPIRED: 'Expired',
        VOID: 'Void',
      },
      claim: {
        title: 'Something wrong with this work?',
        body: 'Tell us what happened. A valid claim is attended free of charge, at high priority.',
        label: 'What is the problem?',
        placeholder: 'Describe what you are seeing, and where.',
        submit: 'Raise a warranty claim',
        open: {
          title: 'Your claim is with our team',
          body: 'We will call you to arrange a visit. There is no charge for warranty work.',
        },
        expired: {
          title: 'This warranty has expired',
          body: 'We can still help — call us on {phone} and we will quote the repair.',
          bodyNoPhone: 'We can still help — call us and we will quote the repair.',
        },
        voided: { title: 'This warranty is no longer valid' },
      },
    },

    /** The booked site visit (Phase L5). No money anywhere (D1). */
    visit: {
      title: 'Your site visit',
      lead: 'We are coming to inspect your site. Please check the time and the address, then tell us if it suits you.',
      reference: 'Reference {number}',
      loading: 'Loading your visit',
      /** The one-tap switch offered when the customer's own language is not the page's — written in that other language. */
      otherLanguage: 'नेपालीमा पढ्नुहोस्',

      details: 'Visit details',
      when: 'When',
      nepalTime: 'Nepal time',
      where: 'Where',
      landmark: 'Landmark',
      who: 'Who is coming',
      surveyor: 'Our surveyor',
      callPerson: 'Call {name}',
      noSurveyor: 'We will tell you who is coming before the visit.',
      callOffice: 'Call the office · {phone}',

      weekdays: {
        sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday',
      },
      months: {
        jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June',
        jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'December',
      },
      day: '{weekday}, {day} {month} {year}',
      time: {
        range: '{from}–{to}',
        from: 'From {from}',
      },

      prompt: {
        title: 'Does this time suit you?',
        body: 'Tap one answer. You do not need an account.',
      },
      buttons: { confirm: 'Confirm', reschedule: 'Need another time', keep: 'Keep my answer' },
      reschedule: {
        title: 'Need another time?',
        body: 'Tell us what suits you, if you like. We will call you to agree a new time.',
        label: 'When suits you? (optional)',
        placeholder: 'e.g. After 3 pm, or any time on Saturday',
        count: '{count} / {max}',
        tooLong: 'Please keep it under {max} characters',
        send: 'Ask for another time',
        cancel: 'Go back',
      },
      outcome: {
        confirmed: {
          title: 'Thank you — your visit is confirmed',
          body: 'We will see you on {day}, {time}.',
        },
        reschedule: {
          title: 'We will call you to find another time',
          body: 'Our office has your request and will call you soon.',
          yours: 'Your note',
        },
        change: 'Change my answer',
        cancelled: {
          title: 'This visit was cancelled',
          body: 'Call us if you would like to book another one.',
        },
        underway: {
          title: 'The visit is under way',
          body: 'Our surveyor is on the way or already with you.',
        },
        done: {
          title: 'This visit has taken place',
          body: 'Thank you. We will be in touch about what we found.',
        },
        closed: {
          title: 'This visit can no longer be changed here',
          body: 'Please call us if you have a question about it.',
        },
      },
      invalid: {
        title: 'This link is not valid',
        body: 'It may be mistyped or out of date. Call us and we will help.',
      },
      loadError: {
        title: 'We could not open your visit',
        body: 'Please check your connection and try again.',
        retry: 'Try again',
      },
      call: 'Call {phone}',
      error: 'We could not record your answer. Please try again.',
    },

    /** The API refusals these pages word their own way (docs/API.md); `common.js` words the rest. */
    errors: {
      // POST /public/quotations/:token/decide
      QUOTATION_EXPIRED: 'This quotation has expired. Please contact us for a fresh quote.',
      QUOTATION_ANSWERED: 'We already have your response to this quotation. Please call us if you would like to change it.',
      QUOTATION_REPLACED: 'This quotation has been replaced by a newer version. Please open the latest link we sent you.',
      QUOTATION_NOT_OPEN: 'This quotation is not open for a response.',
      // POST /public/visits/:token/respond
      VISIT_CLOSED: 'Your answer did not reach us in time — this visit can no longer be changed here.',
    },
  },

  ne: {
    document: {
      retry: 'फेरि प्रयास गर्नुहोस्',
      letterhead: {
        panVat: 'प्यान / भ्याट नं.',
        phone: 'फोन',
        email: 'इमेल',
      },
      dates: {
        date: 'मिति',
        adBs: '{ad} ({bs} वि.सं.)',
      },
      rows: {
        number: 'क्र.सं.',
        description: 'विवरण',
        qty: 'परिमाण',
        rate: 'दर',
        amount: 'रकम',
        optional: 'ऐच्छिक — जम्मामा समावेश छैन',
        provisional: 'अस्थायी — नापपछि यकिन हुने',
        sectionTotal: '{number} को जम्मा',
        swipe: 'दर र रकम हेर्न तालिकालाई छेउतिर सार्नुहोस्।',
      },
      totals: {
        subtotal: 'उप-जम्मा',
        discount: 'छुट',
        vat: 'मूल्य अभिवृद्धि कर {rate}%',
        total: 'जम्मा',
        optional: 'ऐच्छिक कामहरू (जम्मामा समावेश छैन)',
      },
      words: { title: 'अक्षरमा रकम' },
      terms: 'सर्तहरू',
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
        days: { one: 'करिब {count} दिन', other: 'करिब {count} दिन' },
      },
      exclusions: { title: 'यो मूल्यमा समावेश नभएका कुरा' },
      schedule: {
        title: 'भुक्तानी तालिका',
        stage: 'चरण',
        share: 'हिस्सा',
        amount: 'रकम',
        vat: 'मू.अ.कर {amount} सहित',
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
        show: { one: 'नापजाँच हेर्नुहोस् ({count} काम)', other: 'नापजाँच हेर्नुहोस् ({count} काम)' },
        hide: 'नापजाँच लुकाउनुहोस्',
        area: 'स्थान',
        nos: 'संख्या',
        l: 'लम्बाइ',
        b: 'चौडाइ',
        h: 'उचाइ',
        value: 'परिमाण',
        deduct: 'घटाउ',
        billed: 'बिलमा: {qty}',
        billedUnit: 'बिलमा: {qty} {unit}',
      },
      deductions: {
        title: 'घटाइएको — पहिले बिल गरिएको',
        body: 'यस कामका लागि पहिले नै पठाइएका अग्रिम र चालु बिलहरू, यो बिलबाट घटाइएको।',
        bill: 'बिल',
        amount: 'रकम',
      },
    },

    quotation: {
      kind: 'दरभाउपत्र',
      variation: {
        kind: 'परिवर्तन आदेश',
        ofJob: 'तपाईंको काम {job} मा परिवर्तन',
      },
      forCustomer: '{name} का लागि',
      forCustomerAt: '{name} · {address} का लागि',
      version: 'संस्करण {version}',
      validUntil: '{date} सम्म मान्य',
      status: {
        SENT: 'तपाईंको जवाफको प्रतीक्षामा',
        APPROVED: 'स्वीकृत',
        CONVERTED: 'स्वीकृत',
        CHANGES_REQUESTED: 'परिवर्तन अनुरोध गरिएको',
        REJECTED: 'अस्वीकृत',
        EXPIRED: 'म्याद सकिएको',
        SUPERSEDED: 'नयाँ संस्करण आएको',
      },
    },

    quotationPage: {
      requestedChanges: {
        title: 'तपाईंले परिवर्तन गर्न भन्नुभएको',
        body: 'यो संस्करणमा ती परिवर्तनहरू समावेश छन्।',
      },
      prompt: {
        title: 'यो दरभाउपत्र तपाईंलाई ठीक छ?',
        body: 'एउटा जवाफ थिच्नुहोस्। खाता चाहिँदैन।',
      },
      buttons: { accept: 'स्वीकार गर्नुहोस्', changes: 'परिवर्तन माग्नुहोस्', decline: 'अस्वीकार गर्नुहोस्' },
      accept: {
        title: 'यो दरभाउपत्र स्वीकार गर्ने?',
        body: 'तपाईं यो दरभाउपत्रको काम {total} मा स्वीकार गर्दै हुनुहुन्छ।',
        confirm: 'हो, स्वीकार गर्छु',
        cancel: 'पछाडि जानुहोस्',
      },
      changes: {
        title: 'के परिवर्तन गर्न चाहनुहुन्छ?',
        body: 'आफ्नै शब्दमा लेख्नुहोस् — नेपाली वा अंग्रेजीमा। हामी तपाईंलाई नयाँ दरभाउपत्र पठाउनेछौं।',
        label: 'तपाईंको सन्देश',
        placeholder: 'जस्तै: बार्दलीको भित्ता पनि थप्नुहोस् र दशैंपछि सुरु गर्नुहोस्',
        confirm: 'अनुरोध पठाउनुहोस्',
        cancel: 'पछाडि जानुहोस्',
        tooShort: 'अलि बढी लेख्नुहोस् (कम्तीमा 5 अक्षर)',
        tooLong: 'कृपया 1000 अक्षरभित्र लेख्नुहोस्',
      },
      decline: {
        title: 'यो दरभाउपत्र अस्वीकार गर्ने?',
        body: 'चाहनुहुन्छ भने कारण बताउनुहोस्। हामी कुनै काम सुरु गर्दैनौं।',
        reasons: 'मुख्य कारण (ऐच्छिक)',
        label: 'अरू केही? (ऐच्छिक)',
        placeholder: 'जस्तै: अहिलेलाई बजेटभन्दा बढी भयो',
        confirm: 'अस्वीकार गर्नुहोस्',
        cancel: 'पछाडि जानुहोस्',
        tooLong: 'कृपया 1000 अक्षरभित्र लेख्नुहोस्',
      },
      declineReasons: {
        PRICE: 'धेरै महँगो',
        COMPETITOR: 'अर्को कम्पनी रोजें',
        POSTPONED: 'अहिले होइन, पछि',
        BUDGET: 'बजेट छैन',
        OWN_LABOUR: 'आफैं गर्दैछौं',
        OTHER: 'अन्य कारण',
      },
      outcome: {
        accepted: {
          title: 'धन्यवाद — दरभाउपत्र स्वीकार भयो',
          body: 'काम मिलाउन हाम्रो टोलीले तपाईंलाई फोन गर्नेछ।',
          bodyAdvance: 'अग्रिम भुक्तानी भएपछि काम मिलाउन हाम्रो टोलीले तपाईंलाई फोन गर्नेछ।',
          job: 'तपाईंको कामको नम्बर {number} हो।',
        },
        changes: {
          title: 'धन्यवाद — तपाईंको अनुरोध प्राप्त भयो',
          body: 'हामी तपाईंलाई नयाँ दरभाउपत्र पठाउनेछौं।',
          yours: 'तपाईंको सन्देश',
        },
        declined: {
          title: 'दरभाउपत्र अस्वीकार गरियो',
          body: 'हामीले टोलीलाई जानकारी दियौं। फरक प्रस्ताव चाहिएमा हामीलाई फोन गर्नुहोस्।',
        },
        expired: {
          title: 'यो दरभाउपत्रको म्याद सकियो',
          body: 'यो बनाउँदाका दरहरू फेरिएका हुन सक्छन्। फोन गर्नुहोस्, हामी नयाँ पठाउनेछौं।',
          call: '{phone} मा फोन गर्नुहोस्',
        },
        replaced: {
          title: 'यो दरभाउपत्रको नयाँ संस्करण आएको छ',
          body: 'तपाईंको पछिल्लो सन्देशपछि हामीले यसलाई सुधार्यौं। कृपया नयाँ संस्करण हेर्नुहोस्।',
          open: 'नयाँ संस्करण खोल्नुहोस्',
        },
        replacedPending: {
          title: 'यो दरभाउपत्र बदलिएको छ',
          body: 'हामी नयाँ संस्करण तयार गर्दैछौं र त्यसको लिङ्क पठाउनेछौं।',
        },
        closed: {
          title: 'यो दरभाउपत्रमा अहिले जवाफ दिन मिल्दैन',
          body: 'यसबारे केही सोध्नु छ भने हामीलाई फोन गर्नुहोस्।',
        },
      },
      advance: {
        due: '{date} भित्र {amount} अग्रिम भुक्तानी गर्नुहोस्',
        dueNoDate: '{amount} अग्रिम भुक्तानी गर्नुहोस्',
        body: 'अग्रिम भुक्तानी भएपछि हामी काम मिलाउन सुरु गर्छौं। भुक्तानी गर्ने तरिका बिल {number} मा छ।',
        pay: 'अग्रिम भुक्तानी गर्नुहोस्',
        paid: 'अग्रिम भुक्तानी प्राप्त भयो — धन्यवाद',
        paidBody: 'बिल {number} मा भुक्तानी दर्ता भयो। काम मिलाउन हाम्रो टोलीले तपाईंलाई फोन गर्नेछ।',
      },
      error: 'तपाईंको जवाफ रेकर्ड गर्न सकिएन। कृपया फेरि प्रयास गर्नुहोस्।',
      variation: {
        notice: {
          title: 'तपाईंको काम {job} मा परिवर्तन',
          body: 'यसले सहमति भएको काममा थप्छ — वा घटाउँछ। स्वीकार गरेपछि यो त्यही काममा थपिन्छ: नयाँ काम र नयाँ अग्रिम भुक्तानी चाहिँदैन।',
        },
        prompt: {
          title: 'तपाईंको काममा यो परिवर्तन ठीक छ?',
          body: 'एउटा जवाफ थिच्नुहोस्। खाता चाहिँदैन।',
        },
        accept: 'यो परिवर्तन स्वीकार्नुहोस्',
        acceptTitle: 'यो परिवर्तन स्वीकार्ने?',
        acceptBody: 'काम {job} मा यो परिवर्तनको रकम {total} हो।',
        acceptConfirm: 'हो, परिवर्तन स्वीकार्छु',
        accepted: {
          title: 'धन्यवाद — परिवर्तन स्वीकार भयो',
          body: 'हामीले यसलाई तपाईंको काम {job} मा थप्यौं। हाम्रो टोलीले काम जारी राख्नेछ।',
        },
      },
    },

    invoice: {
      kind: 'बिल',
      forCustomer: '{name} का लागि',
      forCustomerPan: '{name} का लागि · प्यान/भ्याट नं. {pan}',
      issued: 'जारी मिति {date}',
      due: 'भुक्तानी गर्नुपर्ने मिति {date}',
      quotation: 'दरभाउपत्र {number}',
      void: 'यो बिल रद्द गरिएको छ — यसमा केही तिर्नु पर्दैन',
      totals: {
        vat: 'मूल्य अभिवृद्धि कर ({rate}%)',
        vatNotApplied: 'मूल्य अभिवृद्धि कर (लागू छैन)',
        paid: 'भुक्तानी भएको',
        due: 'तिर्न बाँकी रकम',
        settled: 'चुक्ता भयो',
      },
      status: {
        DRAFT: 'मस्यौदा',
        SENT: 'पठाइएको',
        PARTIAL: 'आंशिक भुक्तानी',
        PAID: 'भुक्तानी भयो',
        OVERDUE: 'म्याद नाघेको',
        VOID: 'रद्द',
      },
      kinds: {
        STANDARD: 'साधारण',
        ADVANCE: 'अग्रिम',
        RUNNING: 'चालु बिल',
        FINAL: 'अन्तिम बिल',
      },
      stage: {
        heading: 'भुक्तानी चरण',
        when: {
          ON_ACCEPT: 'स्वीकृत गर्दा',
          MILESTONE: 'कामको चरण पूरा भएपछि',
          ON_COMPLETION: 'काम सकिएपछि',
        },
        label: '{heading} — {label}',
        labelShare: '{heading} — {label} ({share}%)',
        share: '{heading} ({share}%)',
      },
      payments: {
        title: 'प्राप्त भुक्तानी',
        voided: 'रद्द गरिएको',
        why: 'कारण: {reason}',
        methods: {
          CASH: 'नगद',
          BANK: 'बैंक ट्रान्सफर',
          ESEWA: 'eSewa',
          KHALTI: 'Khalti',
          FONEPAY: 'Fonepay',
          CHEQUE: 'चेक',
        },
      },
    },

    invoicePage: {
      questions: 'यो बिलबारे केही सोध्नु छ? हामीलाई फोन गर्नुहोस् र बिल नं. {number} बताउनुहोस्।',
      print: 'प्रिन्ट गर्नुहोस्',
    },

    warranty: {
      title: 'वारेन्टी प्रमाणपत्र',
      validUntil: '{date} सम्म मान्य',
      ended: 'यो वारेन्टी {date} मा सकियो',
      voided: 'यो वारेन्टी अब मान्य छैन',
      customer: 'ग्राहक',
      job: 'काम नं.',
      work: 'गरिएको काम',
      completed: 'काम सकिएको मिति',
      coversUntil: 'वारेन्टी रहने मिति',
      scope: 'वारेन्टीमा समेटिएका कुरा',
      status: {
        ACTIVE: 'मान्य',
        CLAIMED: 'दाबी दर्ता भएको',
        EXPIRED: 'म्याद सकिएको',
        VOID: 'रद्द',
      },
      claim: {
        title: 'यो काममा केही समस्या छ?',
        body: 'के भयो हामीलाई बताउनुहोस्। मान्य दाबीमा हामी निःशुल्क र छिटो आउनेछौं।',
        label: 'समस्या के हो?',
        placeholder: 'के देख्नुभयो र कहाँ, लेख्नुहोस्।',
        submit: 'वारेन्टी दाबी गर्नुहोस्',
        open: {
          title: 'तपाईंको दाबी हाम्रो टोलीसँग छ',
          body: 'भ्रमण मिलाउन हामी तपाईंलाई फोन गर्नेछौं। वारेन्टीको कामको कुनै शुल्क लाग्दैन।',
        },
        expired: {
          title: 'यो वारेन्टीको म्याद सकियो',
          body: 'तैपनि हामी सहयोग गर्न सक्छौं — {phone} मा फोन गर्नुहोस्, हामी मर्मतको दरभाउ दिनेछौं।',
          bodyNoPhone: 'तैपनि हामी सहयोग गर्न सक्छौं — हामीलाई फोन गर्नुहोस्, हामी मर्मतको दरभाउ दिनेछौं।',
        },
        voided: { title: 'यो वारेन्टी अब मान्य छैन' },
      },
    },

    visit: {
      title: 'तपाईंको साइट भ्रमण',
      lead: 'हामी तपाईंको साइट निरीक्षण गर्न आउँदैछौं। कृपया समय र ठेगाना हेर्नुहोस्, अनि तपाईंलाई मिल्छ कि मिल्दैन भन्नुहोस्।',
      reference: 'सन्दर्भ नं. {number}',
      loading: 'तपाईंको भ्रमण खुल्दैछ',
      otherLanguage: 'Read in English',

      details: 'भ्रमणको विवरण',
      when: 'कहिले',
      nepalTime: 'नेपाल समय',
      where: 'कहाँ',
      landmark: 'चिनारी',
      who: 'को आउँदै हुनुहुन्छ',
      surveyor: 'हाम्रो सर्वेक्षक',
      callPerson: '{name}लाई फोन गर्नुहोस्',
      noSurveyor: 'भ्रमणअघि को आउँदै हुनुहुन्छ भनेर हामी तपाईंलाई जानकारी दिनेछौं।',
      callOffice: 'कार्यालयमा फोन गर्नुहोस् · {phone}',

      weekdays: {
        sun: 'आइतबार', mon: 'सोमबार', tue: 'मंगलबार', wed: 'बुधबार', thu: 'बिहीबार', fri: 'शुक्रबार', sat: 'शनिबार',
      },
      months: {
        jan: 'जनवरी', feb: 'फेब्रुअरी', mar: 'मार्च', apr: 'अप्रिल', may: 'मे', jun: 'जुन',
        jul: 'जुलाई', aug: 'अगस्ट', sep: 'सेप्टेम्बर', oct: 'अक्टोबर', nov: 'नोभेम्बर', dec: 'डिसेम्बर',
      },
      day: '{weekday}, {day} {month} {year}',
      time: {
        range: '{from}–{to}',
        from: '{from} बजेदेखि',
      },

      prompt: {
        title: 'यो समय तपाईंलाई मिल्छ?',
        body: 'एउटा जवाफ थिच्नुहोस्। खाता चाहिँदैन।',
      },
      buttons: { confirm: 'पक्का गर्नुहोस्', reschedule: 'अर्को समय चाहियो', keep: 'जवाफ नबदल्नुहोस्' },
      reschedule: {
        title: 'अर्को समय चाहियो?',
        body: 'चाहनुहुन्छ भने कुन समय मिल्छ भन्नुहोस्। नयाँ समय मिलाउन हामी तपाईंलाई फोन गर्नेछौं।',
        label: 'कुन समय मिल्छ? (ऐच्छिक)',
        placeholder: 'जस्तै: दिउँसो 3 बजेपछि, वा शनिबार जुनसुकै बेला',
        count: '{count} / {max}',
        tooLong: 'कृपया {max} अक्षरभित्र लेख्नुहोस्',
        send: 'अर्को समय माग्नुहोस्',
        cancel: 'पछाडि जानुहोस्',
      },
      outcome: {
        confirmed: {
          title: 'धन्यवाद — तपाईंको भ्रमण पक्का भयो',
          body: 'हामी तपाईंलाई {day}, {time} मा भेट्नेछौं।',
        },
        reschedule: {
          title: 'अर्को समय मिलाउन हामी तपाईंलाई फोन गर्नेछौं',
          body: 'हाम्रो कार्यालयले तपाईंको अनुरोध पाएको छ र छिट्टै फोन गर्नेछ।',
          yours: 'तपाईंको सन्देश',
        },
        change: 'जवाफ बदल्नुहोस्',
        cancelled: {
          title: 'यो भ्रमण रद्द गरियो',
          body: 'अर्को भ्रमण बुक गर्न चाहनुहुन्छ भने हामीलाई फोन गर्नुहोस्।',
        },
        underway: {
          title: 'भ्रमण सुरु भइसकेको छ',
          body: 'हाम्रो सर्वेक्षक बाटोमा हुनुहुन्छ वा तपाईंकहाँ आइपुग्नुभएको छ।',
        },
        done: {
          title: 'यो भ्रमण सम्पन्न भयो',
          body: 'धन्यवाद। हामीले भेटेका कुराबारे तपाईंलाई जानकारी दिनेछौं।',
        },
        closed: {
          title: 'यो भ्रमण अब यहाँबाट बदल्न मिल्दैन',
          body: 'यसबारे केही सोध्नु छ भने हामीलाई फोन गर्नुहोस्।',
        },
      },
      invalid: {
        title: 'यो लिङ्क मान्य छैन',
        body: 'लिङ्क गलत वा पुरानो हुन सक्छ। हामीलाई फोन गर्नुहोस्, हामी सहयोग गर्नेछौं।',
      },
      loadError: {
        title: 'तपाईंको भ्रमण खोल्न सकिएन',
        body: 'कृपया इन्टरनेट जाँच गरेर फेरि प्रयास गर्नुहोस्।',
        retry: 'फेरि प्रयास गर्नुहोस्',
      },
      call: '{phone} मा फोन गर्नुहोस्',
      error: 'तपाईंको जवाफ रेकर्ड गर्न सकिएन। कृपया फेरि प्रयास गर्नुहोस्।',
    },

    errors: {
      QUOTATION_EXPIRED: 'यो दरभाउपत्रको म्याद सकियो। नयाँ दरभाउपत्रका लागि हामीलाई सम्पर्क गर्नुहोस्।',
      QUOTATION_ANSWERED: 'यो दरभाउपत्रमा तपाईंको जवाफ हामीले पाइसकेका छौं। बदल्न चाहनुहुन्छ भने हामीलाई फोन गर्नुहोस्।',
      QUOTATION_REPLACED: 'यो दरभाउपत्रको नयाँ संस्करण आएको छ। हामीले पठाएको पछिल्लो लिङ्क खोल्नुहोस्।',
      QUOTATION_NOT_OPEN: 'यो दरभाउपत्रमा अहिले जवाफ दिन मिल्दैन।',
      VISIT_CLOSED: 'तपाईंको जवाफ समयमै आइपुगेन — यो भ्रमण अब यहाँबाट बदल्न मिल्दैन।',
    },
  },
};
