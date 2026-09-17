/**
 * Every word the customer's quotation page shows, in one object, so Phase J1 can put a
 * Nepali version beside it without touching the components. Functions take the values
 * they print (a formatted total, a date, a version).
 */
export const QUOTATION_PAGE_COPY = {
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
  totals: { subtotal: 'Subtotal', discount: 'Discount', vat: (rate) => `VAT ${rate}%`, total: 'Total' },
  terms: 'Terms',
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
  },
  decline: {
    title: 'Decline this quotation?',
    body: 'You can tell us why, if you like. We will not start any work.',
    label: 'Reason (optional)',
    placeholder: 'e.g. It is over my budget for now',
    confirm: 'Decline',
    cancel: 'Go back',
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
};
