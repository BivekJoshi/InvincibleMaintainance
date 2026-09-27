import { QUOTATION_DOCUMENT_COPY } from '@/components/documents/quotationDocumentCopy';

/**
 * Every word the customer's quotation page shows, in English and Nepali (Phase L4), so the page follows the
 * site's language and J1 has nothing left to extract. The document's own words (letterhead, rows, totals,
 * schedule, contract, annex) live with it in `components/documents/quotationDocumentCopy.js` and are spread in.
 * Functions take the values they print (a formatted total, a job number, a phone).
 *
 * `declineReasons` are the chips offered when declining — `DECLINE_CATEGORIES`, a friendly subset of the lost-lead
 * categories — sent as the decision's `category`.
 */
export const QUOTATION_PAGE_COPY = {
  en: {
    ...QUOTATION_DOCUMENT_COPY.en,
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
      body: (total) => `You are accepting the work in this quotation for ${total}.`,
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
        job: (number) => `Your job number is ${number}.`,
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
        call: (phone) => `Call ${phone}`,
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
    error: 'We could not record your answer. Please try again.',
  },
  ne: {
    ...QUOTATION_DOCUMENT_COPY.ne,
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
      body: (total) => `तपाईं यो दरभाउपत्रको काम ${total} मा स्वीकार गर्दै हुनुहुन्छ।`,
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
      tooShort: 'अलि बढी लेख्नुहोस् (कम्तीमा ५ अक्षर)',
      tooLong: 'कृपया १००० अक्षरभित्र लेख्नुहोस्',
    },
    decline: {
      title: 'यो दरभाउपत्र अस्वीकार गर्ने?',
      body: 'चाहनुहुन्छ भने कारण बताउनुहोस्। हामी कुनै काम सुरु गर्दैनौं।',
      reasons: 'मुख्य कारण (ऐच्छिक)',
      label: 'अरू केही? (ऐच्छिक)',
      placeholder: 'जस्तै: अहिलेलाई बजेटभन्दा बढी भयो',
      confirm: 'अस्वीकार गर्नुहोस्',
      cancel: 'पछाडि जानुहोस्',
      tooLong: 'कृपया १००० अक्षरभित्र लेख्नुहोस्',
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
        job: (number) => `तपाईंको कामको नम्बर ${number} हो।`,
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
        call: (phone) => `${phone} मा फोन गर्नुहोस्`,
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
    error: 'तपाईंको जवाफ रेकर्ड गर्न सकिएन। कृपया फेरि प्रयास गर्नुहोस्।',
  },
};

/** The page's words for a language, English when there is none. */
export const pageCopy = (locale) => QUOTATION_PAGE_COPY[locale] ?? QUOTATION_PAGE_COPY.en;
