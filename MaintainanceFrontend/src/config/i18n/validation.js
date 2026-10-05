/**
 * Form validation messages in English and Nepali (Phase J1, J1.4) — resolved by `form/zodMessages.js` inside
 * `useZodForm`, in the language of the screen the form is on (English under `/admin`).
 *
 * `messages.*` are the words a schema asks for by name — `.min(2, vKey('name'))` in `form/schemas/fields.js`.
 * `issues.*` word the zod issues a schema gave no words of its own (a length, a number's range, an empty field);
 * `{count}`, `{min}` and `{max}` are the schema's limits.
 */
export const VALIDATION = {
  en: {
    messages: {
      name: 'Please enter your name',
      phone: 'Enter a valid Nepali number, e.g. 9808338255 or 01-5407720',
      email: 'Enter a valid email address',
      emailRequired: 'Email is required',
      password: 'Password is required',
      address: 'Where should the engineer come?',
      negative: 'Cannot be negative',
      // A new password (the reset-password page — a technician may set it in Nepali).
      passwordMix: 'Mix lower-case letters with capitals or numbers',
      passwordAgain: 'Type the password again',
      passwordsDiffer: 'The two passwords are different',
    },
    issues: {
      required: 'Required',
      invalid: 'Check this',
      number: 'Enter a number',
      choose: 'Choose one',
      minChars: { one: 'At least {count} character', other: 'At least {count} characters' },
      maxChars: { one: 'At most {count} character', other: 'At most {count} characters' },
      minNumber: 'Must be {min} or more',
      maxNumber: 'Must be {max} or less',
      minItems: { one: 'Add at least {count}', other: 'Add at least {count}' },
      maxItems: { one: 'At most {count}', other: 'At most {count}' },
    },
  },
  ne: {
    messages: {
      name: 'आफ्नो नाम लेख्नुहोस्',
      phone: 'सही नेपाली नम्बर लेख्नुहोस्, जस्तै 9808338255 वा 01-5407720',
      email: 'सही इमेल ठेगाना लेख्नुहोस्',
      emailRequired: 'इमेल लेख्नुहोस्',
      password: 'पासवर्ड लेख्नुहोस्',
      address: 'इन्जिनियर कहाँ आउने? ठेगाना लेख्नुहोस्',
      negative: 'शून्यभन्दा कम हुन सक्दैन',
      passwordMix: 'साना अक्षरसँगै ठूला अक्षर वा अङ्क पनि राख्नुहोस्',
      passwordAgain: 'पासवर्ड फेरि टाइप गर्नुहोस्',
      passwordsDiffer: 'दुवै पासवर्ड मिलेनन्',
    },
    issues: {
      required: 'यो भर्नुहोस्',
      invalid: 'यो जाँच्नुहोस्',
      number: 'अङ्कमा लेख्नुहोस्',
      choose: 'एउटा छान्नुहोस्',
      minChars: { one: 'कम्तीमा {count} अक्षर लेख्नुहोस्', other: 'कम्तीमा {count} अक्षर लेख्नुहोस्' },
      maxChars: { one: 'बढीमा {count} अक्षर', other: 'बढीमा {count} अक्षर' },
      minNumber: '{min} वा सोभन्दा बढी हुनुपर्छ',
      maxNumber: '{max} वा सोभन्दा कम हुनुपर्छ',
      minItems: { one: 'कम्तीमा {count} वटा थप्नुहोस्', other: 'कम्तीमा {count} वटा थप्नुहोस्' },
      maxItems: { one: 'बढीमा {count} वटा', other: 'बढीमा {count} वटा' },
    },
  },
};
