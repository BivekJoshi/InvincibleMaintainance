/**
 * Every word the field app's shell, today list, job sheet and history show, in English and Nepali
 * (Phase H2), so J1 has nothing left to extract there — it moves these into its catalogues. The survey
 * form's own fields are still inline; only its Photos card reads from here.
 *
 * Functions take the values they print. Digits stay Latin; J1 decides on Devanagari digits for display.
 * The Nepali wants J1's review for plain, field-friendly wording.
 */

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const en = {
  roles: { TECHNICIAN: 'Technician', SURVEYOR: 'Site surveyor', ADMIN: 'Admin', DISPATCHER: 'Dispatcher', other: 'Field' },
  tabs: { today: 'Today', history: 'History', surveys: 'Surveys' },
  signOut: 'Sign out',

  status: {
    DRAFT: 'Not scheduled', SCHEDULED: 'Scheduled', ASSIGNED: 'Assigned', EN_ROUTE: 'On the way',
    IN_PROGRESS: 'In progress', ON_HOLD: 'On hold', COMPLETED: 'Completed', VERIFIED: 'Verified', CANCELLED: 'Cancelled',
  },

  sync: {
    offline: 'Offline',
    syncing: 'Syncing…',
    syncNow: 'Sync now',
    allSent: 'All sent',
    waiting: (n) => `${n} waiting`,
    what: (changes, photos) => [
      changes ? plural(changes, 'change', 'changes') : null,
      photos ? plural(photos, 'photo', 'photos') : null,
    ].filter(Boolean).join(' and '),
    offlineBanner: (what) => (what
      ? `No signal. ${what} saved on this phone — they go to the office when you are back online.`
      : 'No signal. Keep working — what you do is saved on this phone.'),
    waitingBanner: (what) => `${what} waiting to reach the office.`,
    refusedTitle: 'Not sent — the office refused it',
    dismiss: 'Dismiss',
    kinds: {
      status: (label) => `Status “${label}”`,
      task: 'A checklist tick',
      material: 'A material',
      time_start: 'Timer start',
      time_stop: 'Timer stop',
      complete: 'Completing the job',
      survey_draft: 'A survey save',
      survey_submit: 'A survey submission',
      photo: 'A photo',
      signature: 'The signature — the job was not completed',
    },
    onJob: (number) => `on ${number}`,
  },

  actions: {
    EN_ROUTE: 'On my way',
    IN_PROGRESS: 'Start work',
    resume: 'Resume work',
  },
  savedOffline: 'Saved on this phone',
  savedOfflineBody: 'It will be sent as soon as you have signal.',
  couldNotSave: 'Could not save on this phone',

  today: {
    title: 'Today',
    loading: 'Loading your jobs…',
    count: (n) => `${plural(n, 'job', 'jobs')} assigned to you`,
    emptyTitle: 'Nothing scheduled for you today',
    emptyBody: 'New jobs appear here as soon as dispatch assigns them. You will also get an SMS.',
    call: 'Call',
    navigate: 'Navigate',
    open: 'Open job',
    continue: 'Continue job',
    checklist: (done, total) => `${done} of ${total} checklist items done`,
  },

  job: {
    back: 'Back',
    access: 'Access',
    readOnly: 'This job is closed. You can look, not change.',
    historyView: 'From your history — read only.',
    holdReason: (reason) => `On hold: ${reason}`,
    pending: 'waiting to send',
    survey: {
      body: 'This visit is a survey. Record the readings and what the job needs, then submit it.',
      open: 'Open the survey',
      failed: 'Could not open the survey',
    },
    checklist: {
      title: 'Checklist',
      done: (done, total) => `${done}/${total} done`,
      skipped: 'Skipped',
      tick: (title) => `Done: ${title}`,
    },
    timer: {
      title: 'Time',
      start: 'Start timer',
      stop: 'Stop timer',
      since: (time) => `Working since ${time}`,
      logged: (duration) => `Logged on this job: ${duration}`,
    },
    hold: {
      button: 'Hold',
      title: 'Put this job on hold',
      reason: 'Why is the work stopping?',
      placeholder: 'e.g. Waiting for materials',
      required: 'Say why the job is stopping',
      confirm: 'Put on hold',
      cancel: 'Cancel',
    },
    finish: {
      title: 'Finish up',
      note: 'What you did',
      notePlaceholder: 'What you did, and anything the customer should know.',
      rating: 'Customer rating (optional)',
      star: (n) => `${n} of 5`,
      clearRating: 'No rating',
      signature: 'Customer’s signature',
      noSignature: 'The customer is not here to sign',
      complete: 'Complete job',
      openTasks: (n) => `${plural(n, 'checklist item is', 'checklist items are')} still open — tick ${n === 1 ? 'it' : 'them'} before completing.`,
      startFirst: 'Start work before you complete the job.',
      signFirst: 'Ask the customer to sign in the box.',
      completing: 'Completing — the signature is waiting to upload.',
      completedTitle: 'Job completed',
      completedOffline: 'Completed on this phone — it reaches the office when you have signal.',
      completed: 'Completed',
      note_: 'Note',
      rated: (n) => `Rated ${n} of 5`,
      failed: 'Could not save the signature',
    },
  },

  signature: {
    label: 'Sign here with a finger',
    clear: 'Clear',
    undo: 'Undo',
    tooShort: 'Too small to be a signature — ask the customer to sign across the box.',
    signed: 'Signed',
  },

  photos: {
    title: 'Photos',
    kinds: { BEFORE: 'Before', DURING: 'During', AFTER: 'After', ISSUE: 'Problem found', SIGNATURE: 'Signature' },
    kindLabel: 'What is this photo of?',
    caption: 'Caption (optional)',
    captionPlaceholder: 'e.g. Crack above the window',
    take: 'Take a photo',
    preparing: 'Preparing the photo…',
    waiting: 'Waiting to upload',
    uploading: 'Uploading…',
    sent: 'Sent',
    none: 'No photos yet.',
    queued: (n) => (n === 1 ? 'Photo saved — it uploads when there is signal.' : `${n} photos saved — they upload when there is signal.`),
    failed: 'Could not keep that photo',
    surveyHint: 'Photos of what you found. They go to the office with the survey.',
  },

  materials: {
    title: 'Materials used',
    log: 'Log material',
    sheetTitle: 'Log a material',
    sheetBody: 'Pick what you used, then how much.',
    search: 'Search by name or code',
    noMatch: 'No material matches that.',
    notLoaded: 'The material list is not on this phone yet — open this once with signal.',
    more: (n) => `${n} more — search to narrow it down`,
    quantity: 'Quantity',
    less: 'Less',
    more_: 'More',
    submit: (qty, unit) => `Log ${qty} ${unit}`,
    pickAnother: 'Pick another',
    invalid: 'Enter a quantity above 0',
    logged: (qty, unit, name) => `Logged ${qty} ${unit} ${name}`,
    none: 'Nothing logged yet.',
  },

  history: {
    title: 'History',
    subtitle: 'Your jobs, by the day they were scheduled.',
    from: 'From',
    to: 'To',
    presets: { 7: '7 days', 30: '30 days', 90: '90 days' },
    count: (n) => plural(n, 'job', 'jobs'),
    emptyTitle: 'No jobs in these dates',
    emptyBody: 'Try a longer range.',
    badRange: 'The first date is after the second.',
  },
};

const ne = {
  roles: { TECHNICIAN: 'प्राविधिक', SURVEYOR: 'साइट सर्भेयर', ADMIN: 'एडमिन', DISPATCHER: 'डिस्प्याचर', other: 'फिल्ड' },
  tabs: { today: 'आज', history: 'इतिहास', surveys: 'सर्भे' },
  signOut: 'साइन आउट',

  status: {
    DRAFT: 'समय तोकिएको छैन', SCHEDULED: 'समय तोकिएको', ASSIGNED: 'जिम्मा दिइएको', EN_ROUTE: 'बाटोमा',
    IN_PROGRESS: 'काम हुँदै', ON_HOLD: 'रोकिएको', COMPLETED: 'सम्पन्न', VERIFIED: 'प्रमाणित', CANCELLED: 'रद्द',
  },

  sync: {
    offline: 'सिग्नल छैन',
    syncing: 'पठाउँदै…',
    syncNow: 'अहिले पठाउनुहोस्',
    allSent: 'सबै पठाइयो',
    waiting: (n) => `${n} पठाउन बाँकी`,
    what: (changes, photos) => [
      changes ? `${changes} परिवर्तन` : null,
      photos ? `${photos} फोटो` : null,
    ].filter(Boolean).join(' र '),
    offlineBanner: (what) => (what
      ? `सिग्नल छैन। ${what} यो फोनमा सुरक्षित छ — सिग्नल आएपछि अफिसमा पुग्छ।`
      : 'सिग्नल छैन। काम जारी राख्नुहोस् — तपाईंले गरेको यो फोनमा सुरक्षित रहन्छ।'),
    waitingBanner: (what) => `${what} अफिसमा पुग्न बाँकी छ।`,
    refusedTitle: 'पठाइएन — अफिसले स्वीकार गरेन',
    dismiss: 'हटाउनुहोस्',
    kinds: {
      status: (label) => `स्थिति “${label}”`,
      task: 'चेकलिस्टको टिक',
      material: 'सामग्री',
      time_start: 'टाइमर सुरु',
      time_stop: 'टाइमर बन्द',
      complete: 'काम सम्पन्न',
      survey_draft: 'सर्भे सेभ',
      survey_submit: 'सर्भे पेस',
      photo: 'फोटो',
      signature: 'हस्ताक्षर — काम सम्पन्न भएन',
    },
    onJob: (number) => `${number} मा`,
  },

  actions: {
    EN_ROUTE: 'बाटोमा छु',
    IN_PROGRESS: 'काम सुरु गर्नुहोस्',
    resume: 'काम फेरि सुरु गर्नुहोस्',
  },
  savedOffline: 'यो फोनमा सुरक्षित भयो',
  savedOfflineBody: 'सिग्नल आउनेबित्तिकै पठाइन्छ।',
  couldNotSave: 'यो फोनमा सुरक्षित गर्न सकिएन',

  today: {
    title: 'आज',
    loading: 'तपाईंका कामहरू लोड हुँदै…',
    count: (n) => `तपाईंलाई ${n} वटा काम दिइएको छ`,
    emptyTitle: 'आज तपाईंको लागि कुनै काम छैन',
    emptyBody: 'डिस्प्याचले काम दिनेबित्तिकै यहाँ देखिन्छ। तपाईंलाई SMS पनि आउँछ।',
    call: 'फोन गर्नुहोस्',
    navigate: 'बाटो हेर्नुहोस्',
    open: 'काम खोल्नुहोस्',
    continue: 'काम जारी राख्नुहोस्',
    checklist: (done, total) => `${total} मध्ये ${done} चेकलिस्ट सकियो`,
  },

  job: {
    back: 'पछाडि',
    access: 'पहुँच',
    readOnly: 'यो काम बन्द भइसक्यो। हेर्न मिल्छ, बदल्न मिल्दैन।',
    historyView: 'तपाईंको इतिहासबाट — हेर्न मात्र।',
    holdReason: (reason) => `रोकिएको: ${reason}`,
    pending: 'पठाउन बाँकी',
    survey: {
      body: 'यो भ्रमण सर्भे हो। रिडिङ र कामलाई के चाहिन्छ लेख्नुहोस्, अनि पेस गर्नुहोस्।',
      open: 'सर्भे खोल्नुहोस्',
      failed: 'सर्भे खोल्न सकिएन',
    },
    checklist: {
      title: 'चेकलिस्ट',
      done: (done, total) => `${done}/${total} सकियो`,
      skipped: 'छोडिएको',
      tick: (title) => `सकियो: ${title}`,
    },
    timer: {
      title: 'समय',
      start: 'टाइमर सुरु गर्नुहोस्',
      stop: 'टाइमर बन्द गर्नुहोस्',
      since: (time) => `${time} देखि काम हुँदै`,
      logged: (duration) => `यो काममा लागेको समय: ${duration}`,
    },
    hold: {
      button: 'रोक्नुहोस्',
      title: 'यो काम रोक्नुहोस्',
      reason: 'काम किन रोकिँदै छ?',
      placeholder: 'जस्तै: सामग्री पर्खँदै',
      required: 'काम किन रोकिँदै छ लेख्नुहोस्',
      confirm: 'काम रोक्नुहोस्',
      cancel: 'रद्द गर्नुहोस्',
    },
    finish: {
      title: 'काम सक्नुहोस्',
      note: 'तपाईंले के गर्नुभयो',
      notePlaceholder: 'के काम गर्नुभयो, र ग्राहकले थाहा पाउनुपर्ने कुरा।',
      rating: 'ग्राहकको मूल्याङ्कन (ऐच्छिक)',
      star: (n) => `5 मा ${n}`,
      clearRating: 'मूल्याङ्कन छैन',
      signature: 'ग्राहकको हस्ताक्षर',
      noSignature: 'ग्राहक हस्ताक्षर गर्न यहाँ हुनुहुन्न',
      complete: 'काम सम्पन्न गर्नुहोस्',
      openTasks: (n) => `${n} वटा चेकलिस्ट बाँकी छ — सम्पन्न गर्नुअघि टिक लगाउनुहोस्।`,
      startFirst: 'काम सम्पन्न गर्नुअघि काम सुरु गर्नुहोस्।',
      signFirst: 'ग्राहकलाई बाकसभित्र हस्ताक्षर गर्न भन्नुहोस्।',
      completing: 'सम्पन्न हुँदै — हस्ताक्षर अपलोड हुन बाँकी छ।',
      completedTitle: 'काम सम्पन्न भयो',
      completedOffline: 'यो फोनमा सम्पन्न भयो — सिग्नल आएपछि अफिसमा पुग्छ।',
      completed: 'सम्पन्न',
      note_: 'टिप्पणी',
      rated: (n) => `5 मा ${n} मूल्याङ्कन`,
      failed: 'हस्ताक्षर सुरक्षित गर्न सकिएन',
    },
  },

  signature: {
    label: 'यहाँ औँलाले हस्ताक्षर गर्नुहोस्',
    clear: 'मेटाउनुहोस्',
    undo: 'अघिल्लो मेटाउनुहोस्',
    tooShort: 'हस्ताक्षर धेरै सानो भयो — ग्राहकलाई बाकसभरि हस्ताक्षर गर्न भन्नुहोस्।',
    signed: 'हस्ताक्षर भयो',
  },

  photos: {
    title: 'फोटो',
    kinds: { BEFORE: 'काम अघि', DURING: 'काम गर्दा', AFTER: 'काम पछि', ISSUE: 'समस्या', SIGNATURE: 'हस्ताक्षर' },
    kindLabel: 'यो केको फोटो हो?',
    caption: 'विवरण (ऐच्छिक)',
    captionPlaceholder: 'जस्तै: झ्यालमाथिको चिरा',
    take: 'फोटो खिच्नुहोस्',
    preparing: 'फोटो तयार हुँदै…',
    waiting: 'अपलोड हुन बाँकी',
    uploading: 'अपलोड हुँदै…',
    sent: 'पठाइयो',
    none: 'अहिलेसम्म फोटो छैन।',
    queued: (n) => `${n} फोटो सुरक्षित भयो — सिग्नल आएपछि अपलोड हुन्छ।`,
    failed: 'त्यो फोटो राख्न सकिएन',
    surveyHint: 'तपाईंले भेटेको कुराको फोटो। सर्भेसँगै अफिसमा जान्छ।',
  },

  materials: {
    title: 'प्रयोग भएको सामग्री',
    log: 'सामग्री थप्नुहोस्',
    sheetTitle: 'सामग्री थप्नुहोस्',
    sheetBody: 'के प्रयोग गर्नुभयो छान्नुहोस्, अनि कति।',
    search: 'नाम वा कोडले खोज्नुहोस्',
    noMatch: 'मिल्ने सामग्री छैन।',
    notLoaded: 'सामग्रीको सूची यो फोनमा छैन — सिग्नल हुँदा एक पटक खोल्नुहोस्।',
    more: (n) => `अरू ${n} — खोजेर छान्नुहोस्`,
    quantity: 'परिमाण',
    less: 'घटाउनुहोस्',
    more_: 'बढाउनुहोस्',
    submit: (qty, unit) => `${qty} ${unit} थप्नुहोस्`,
    pickAnother: 'अर्को छान्नुहोस्',
    invalid: '0 भन्दा बढी परिमाण लेख्नुहोस्',
    logged: (qty, unit, name) => `${name} ${qty} ${unit} थपियो`,
    none: 'अहिलेसम्म केही थपिएको छैन।',
  },

  history: {
    title: 'इतिहास',
    subtitle: 'तपाईंका कामहरू, तोकिएको मितिअनुसार।',
    from: 'देखि',
    to: 'सम्म',
    presets: { 7: '7 दिन', 30: '30 दिन', 90: '90 दिन' },
    count: (n) => `${n} वटा काम`,
    emptyTitle: 'यी मितिमा कुनै काम छैन',
    emptyBody: 'लामो अवधि छानेर हेर्नुहोस्।',
    badRange: 'पहिलो मिति दोस्रो मितिभन्दा पछि छ।',
  },
};

export const FIELD_COPY = { en, ne };

/** The field app's words in `locale`, English when it has none. */
export const fieldCopy = (locale) => FIELD_COPY[locale] ?? FIELD_COPY.en;
