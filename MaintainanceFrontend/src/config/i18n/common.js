/**
 * Words every translated audience shares (Phase J1): the language switch, and what an API error code means to a
 * customer or a technician. A screen's own catalogue may word a code its own way (`errors.<CODE>` there wins — see
 * `helpers/i18n.js#apiErrorText`); a code in neither falls back to the server's English message.
 *
 * The codes are the API's (docs/API.md): stable, upper-case, never shown. `{max}` and `{maxMb}` come from the error's
 * `details`.
 */
export const COMMON = {
  en: {
    language: {
      label: 'Language',
      en: 'English',
      ne: 'Nepali',
    },
    errors: {
      generic: 'Something went wrong. Please try again, or call us.',
      offline: 'No internet connection. Check it and try again.',
      INTERNAL_ERROR: 'Something went wrong on our side. Please try again, or call us.',
      RATE_LIMITED: 'Too many tries. Please wait a few minutes, or call us.',
      NOT_FOUND: 'We could not find this. The link may be old or incomplete.',
      // POST /public/leads
      SUBMISSION_REJECTED: 'We could not accept this request. Please call us.',
      SUBMITTED_TOO_FAST: 'That was sent a little too quickly. Please wait a moment and send it again.',
      BOT_CHECK_FAILED: 'We could not check that this was sent by a person. Reload the page and try again.',
      BOOKING_DAY_CLOSED: 'We are closed that day. Please choose another date.',
      // POST /public/lead-photos, and any upload
      PHOTOS_REQUIRED: 'Choose at least one photo.',
      TOO_MANY_PHOTOS: 'Up to {max} photos, please.',
      PHOTOS_ONLY: 'Photos only, please.',
      PHOTO_TOO_LARGE: 'Each photo must be {maxMb} MB or smaller.',
      FILE_TOO_LARGE: 'That file is too large — up to {maxMb} MB.',
      TOO_MANY_FILES: 'Too many files at once.',
      UNSUPPORTED_FILE_TYPE: 'That kind of file cannot be uploaded.',
      // POST /public/warranties/:token/claim
      WARRANTY_VOID: 'This warranty is no longer valid. Please call us.',
      WARRANTY_EXPIRED: 'This warranty has ended. We can still help — please call us.',
      CLAIM_OPEN: 'You already have an open claim for this job. We will be in touch shortly.',
    },
    // The spinner a lazy page shows while it loads (`routes/PageOutlet.jsx`), in every shell.
    loading: 'Loading',
    // The colour-theme controls (`components/theme/`): the site header and drawer, the sign-in, the back office.
    theme: {
      label: 'Colour theme',
      toLight: 'Switch to light theme',
      toDark: 'Switch to dark theme',
      cycle: 'Colour theme: {mode}. Change',
      following: 'Following your device · {mode}',
      light: { label: 'Light', hint: 'Always the paper palette' },
      dark: { label: 'Dark', hint: 'Always the ink palette' },
      system: { label: 'System', hint: 'Follows your device setting' },
    },
    // What a crashed screen says (`components/common/ErrorBoundary/ErrorFallback.jsx`); the developer details stay English.
    errorPage: {
      title: 'Something went wrong',
      body: 'This part of the page stopped working. You can try again, reload, or go back to the start.',
      chunkTitle: 'A newer version of this app is available',
      chunkBody: 'Part of this page could not be loaded, usually because the app was updated while it was open. Reloading fixes it.',
      tryAgain: 'Try again',
      reload: 'Reload page',
      home: 'Go home',
    },
  },
  ne: {
    language: {
      label: 'भाषा',
      en: 'अङ्ग्रेजी',
      ne: 'नेपाली',
    },
    errors: {
      generic: 'केही गडबड भयो। फेरि प्रयास गर्नुहोस्, वा हामीलाई फोन गर्नुहोस्।',
      offline: 'इन्टरनेट छैन। जडान जाँचेर फेरि प्रयास गर्नुहोस्।',
      INTERNAL_ERROR: 'हाम्रो तर्फबाट केही गडबड भयो। फेरि प्रयास गर्नुहोस्, वा हामीलाई फोन गर्नुहोस्।',
      RATE_LIMITED: 'धेरै पटक प्रयास भयो। केही मिनेट पर्खनुहोस्, वा हामीलाई फोन गर्नुहोस्।',
      NOT_FOUND: 'यो भेटिएन। लिङ्क पुरानो वा अधुरो हुन सक्छ।',
      SUBMISSION_REJECTED: 'यो अनुरोध लिन सकिएन। कृपया हामीलाई फोन गर्नुहोस्।',
      SUBMITTED_TOO_FAST: 'अलि छिटो पठाइयो। एकछिन पर्खेर फेरि पठाउनुहोस्।',
      BOT_CHECK_FAILED: 'यो मानिसले नै पठाएको हो भनी जाँच्न सकिएन। पेज फेरि खोलेर प्रयास गर्नुहोस्।',
      BOOKING_DAY_CLOSED: 'त्यो दिन हामी बन्द हुन्छौं। अर्को दिन छान्नुहोस्।',
      PHOTOS_REQUIRED: 'कम्तीमा एउटा फोटो छान्नुहोस्।',
      TOO_MANY_PHOTOS: 'बढीमा {max} वटा फोटो मात्र।',
      PHOTOS_ONLY: 'फोटो मात्र पठाउनुहोस्।',
      PHOTO_TOO_LARGE: 'हरेक फोटो {maxMb} MB वा सोभन्दा सानो हुनुपर्छ।',
      FILE_TOO_LARGE: 'फाइल धेरै ठूलो भयो — बढीमा {maxMb} MB।',
      TOO_MANY_FILES: 'एकैपटक धेरै फाइल भए।',
      UNSUPPORTED_FILE_TYPE: 'यस्तो फाइल अपलोड गर्न मिल्दैन।',
      WARRANTY_VOID: 'यो वारेन्टी अब मान्य छैन। कृपया हामीलाई फोन गर्नुहोस्।',
      WARRANTY_EXPIRED: 'यो वारेन्टीको अवधि सकियो। तैपनि हामी सहयोग गर्न सक्छौं — कृपया फोन गर्नुहोस्।',
      CLAIM_OPEN: 'यो कामको लागि तपाईंको दाबी पहिले नै दर्ता छ। हामी छिट्टै सम्पर्क गर्नेछौं।',
    },
    loading: 'लोड हुँदैछ',
    theme: {
      label: 'रङ',
      toLight: 'उज्यालो रङमा बदल्नुहोस्',
      toDark: 'गाढा रङमा बदल्नुहोस्',
      cycle: 'रङ: {mode}। बदल्नुहोस्',
      following: 'तपाईंको उपकरणअनुसार · {mode}',
      light: { label: 'उज्यालो', hint: 'सधैं उज्यालो पृष्ठभूमि' },
      dark: { label: 'गाढा', hint: 'सधैं गाढा पृष्ठभूमि' },
      system: { label: 'उपकरणअनुसार', hint: 'तपाईंको उपकरणको सेटिङअनुसार' },
    },
    errorPage: {
      title: 'केही गडबड भयो',
      body: 'पेजको यो भागले काम गर्न छोड्यो। फेरि प्रयास गर्न, पेज फेरि लोड गर्न, वा सुरुमा फर्कन सक्नुहुन्छ।',
      chunkTitle: 'यो एपको नयाँ संस्करण आएको छ',
      chunkBody: 'पेजको केही भाग लोड हुन सकेन, प्रायः एप खुलेकै बेला अपडेट भएकाले। पेज फेरि लोड गर्दा ठीक हुन्छ।',
      tryAgain: 'फेरि प्रयास गर्नुहोस्',
      reload: 'पेज फेरि लोड गर्नुहोस्',
      home: 'सुरुमा जानुहोस्',
    },
  },
};
