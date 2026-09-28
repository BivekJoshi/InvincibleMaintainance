/**
 * Every word the customer's /visit/:token page shows, in English and Nepali (Phase L5), so the page follows the
 * site's language. Functions take the values they print (a phone, a name, a day and a time); figures stay in
 * Latin digits in both languages. `visitPageState.test.js` holds the two languages to the same keys.
 *
 * `otherLanguage` is the one-tap switch offered when the customer's own language (`customer.preferredLocale`) is
 * not the one the page is in — so it is written in that other language.
 */
export const VISIT_PAGE_COPY = {
  en: {
    title: 'Your site visit',
    lead: 'We are coming to inspect your site. Please check the time and the address, then tell us if it suits you.',
    reference: (number) => `Reference ${number}`,
    loading: 'Loading your visit',
    otherLanguage: { locale: 'ne', label: 'नेपालीमा पढ्नुहोस्' },

    details: 'Visit details',
    when: 'When',
    nepalTime: 'Nepal time',
    where: 'Where',
    landmark: 'Landmark',
    who: 'Who is coming',
    surveyor: 'Our surveyor',
    callPerson: (name) => `Call ${name}`,
    noSurveyor: 'We will tell you who is coming before the visit.',
    callOffice: (phone) => `Call the office · ${phone}`,

    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
    day: ({ weekday, day, month, year }) => `${weekday}, ${day} ${month} ${year}`,
    time: {
      range: (from, to) => `${from}–${to}`,
      from: (from) => `From ${from}`,
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
      count: (n, max) => `${n} / ${max}`,
      tooLong: (max) => `Please keep it under ${max} characters`,
      send: 'Ask for another time',
      cancel: 'Go back',
    },
    outcome: {
      confirmed: {
        title: 'Thank you — your visit is confirmed',
        body: (day, time) => `We will see you on ${day}, ${time}.`,
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
    call: (phone) => `Call ${phone}`,
    error: 'We could not record your answer. Please try again.',
    tooLate: 'Your answer did not reach us in time — this visit can no longer be changed here.',
  },
  ne: {
    title: 'तपाईंको साइट भ्रमण',
    lead: 'हामी तपाईंको साइट निरीक्षण गर्न आउँदैछौं। कृपया समय र ठेगाना हेर्नुहोस्, अनि तपाईंलाई मिल्छ कि मिल्दैन भन्नुहोस्।',
    reference: (number) => `सन्दर्भ नं. ${number}`,
    loading: 'तपाईंको भ्रमण खुल्दैछ',
    otherLanguage: { locale: 'en', label: 'Read in English' },

    details: 'भ्रमणको विवरण',
    when: 'कहिले',
    nepalTime: 'नेपाल समय',
    where: 'कहाँ',
    landmark: 'चिनारी',
    who: 'को आउँदै हुनुहुन्छ',
    surveyor: 'हाम्रो सर्वेक्षक',
    callPerson: (name) => `${name}लाई फोन गर्नुहोस्`,
    noSurveyor: 'भ्रमणअघि को आउँदै हुनुहुन्छ भनेर हामी तपाईंलाई जानकारी दिनेछौं।',
    callOffice: (phone) => `कार्यालयमा फोन गर्नुहोस् · ${phone}`,

    weekdays: ['आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार'],
    months: [
      'जनवरी', 'फेब्रुअरी', 'मार्च', 'अप्रिल', 'मे', 'जुन',
      'जुलाई', 'अगस्ट', 'सेप्टेम्बर', 'अक्टोबर', 'नोभेम्बर', 'डिसेम्बर',
    ],
    day: ({ weekday, day, month, year }) => `${weekday}, ${day} ${month} ${year}`,
    time: {
      range: (from, to) => `${from}–${to}`,
      from: (from) => `${from} बजेदेखि`,
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
      count: (n, max) => `${n} / ${max}`,
      tooLong: (max) => `कृपया ${max} अक्षरभित्र लेख्नुहोस्`,
      send: 'अर्को समय माग्नुहोस्',
      cancel: 'पछाडि जानुहोस्',
    },
    outcome: {
      confirmed: {
        title: 'धन्यवाद — तपाईंको भ्रमण पक्का भयो',
        body: (day, time) => `हामी तपाईंलाई ${day}, ${time} मा भेट्नेछौं।`,
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
    call: (phone) => `${phone} मा फोन गर्नुहोस्`,
    error: 'तपाईंको जवाफ रेकर्ड गर्न सकिएन। कृपया फेरि प्रयास गर्नुहोस्।',
    tooLate: 'तपाईंको जवाफ समयमै आइपुगेन — यो भ्रमण अब यहाँबाट बदल्न मिल्दैन।',
  },
};

/** The page's words for a language, English when there is none. */
export const visitCopy = (locale) => VISIT_PAGE_COPY[locale] ?? VISIT_PAGE_COPY.en;
