import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VisitPublicPage from './VisitPublicPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import { json, mockApi, notFound } from '@/test/mockApi';
import uiReducer from '@/redux/slices/uiSlice';
import { resetI18nWarnings } from '@/helpers/i18n';

/** What GET /public/visits/:token answers (Phase L5) — no money in it. Friday 2 Oct 2026, 10:00–12:00 in Kathmandu. */
const VISIT = {
  number: 'JOB-2083-0004',
  status: 'ASSIGNED',
  window: { start: '2026-10-02T04:15:00.000Z', end: '2026-10-02T06:15:00.000Z' },
  site: { label: 'Home', address: 'Baneshwor-10, Kathmandu', area: 'Baneshwor', landmark: 'एभरेस्ट बैंकको अगाडि' },
  surveyor: { name: 'Sita Shrestha', phone: '9801234567' },
  customer: { name: 'Anjali Karki', preferredLocale: 'en' },
  answer: null,
  answerNote: null,
  answeredAt: null,
  canAnswer: true,
  company: { name: 'Gharjatan Home Services', phone: '01-5407720' },
};

/** The visit as the API answers after a respond: the answer, its note (a reschedule's only) and when. */
const answered = (visit, answer, note = null) => ({ ...visit, answer, answerNote: note, answeredAt: '2026-09-30T09:00:00.000Z' });

/**
 * Opens /visit/tok-1 on a 360 px phone. `respond` answers the POST; `visit` may be a function of the calls so far
 * (a refetch after VISIT_CLOSED sees the visit as it is now).
 */
const open = ({ visit = VISIT, respond, locale = 'en', bootstrap } = {}) => {
  const calls = mockApi((call) => {
    if (call.method === 'GET' && call.path === '/public/visits/tok-1') {
      const v = typeof visit === 'function' ? visit(calls) : visit;
      return v ? json({ data: v }) : notFound('Visit');
    }
    if (call.method === 'POST' && call.path === '/public/visits/tok-1/respond') return respond?.(call);
    if (call.path === '/public/bootstrap' && bootstrap) return json({ data: bootstrap });
    return undefined;
  });
  const view = renderWithProviders(<VisitPublicPage />, {
    path: '/visit/:token',
    initialPath: '/visit/tok-1',
    preloadedState: { ui: { ...uiReducer(undefined, { type: '@@init' }), locale } },
  });
  return { calls, ...view };
};

const posts = (calls) => calls.filter((c) => c.method === 'POST');

/** Nothing is laid out wider than a phone, and no figure of money is anywhere on the page (D1). */
const expectPhoneSafe = () => {
  expect(document.body.innerHTML).not.toMatch(/\b(?:min-)?w-\[\d{3,}px\]/);
  expect(document.body.textContent).not.toMatch(/Rs\.?\s?\d|\b(rate|cost|total|margin)\b/i);
};

let width;
beforeEach(() => {
  // A phone: the page lays out for 360 px.
  width = window.innerWidth;
  window.innerWidth = 360;
  window.dispatchEvent(new Event('resize'));
});
afterEach(() => {
  window.innerWidth = width;
  vi.unstubAllGlobals();
});

describe('the customer visit page (Phase L5)', () => {
  it('shows when, where and who at 360 px, with two big answers', async () => {
    open();
    expect(await screen.findByRole('heading', { level: 1, name: 'Your site visit' })).toBeInTheDocument();
    expect(screen.getByText('Gharjatan Home Services')).toBeInTheDocument();
    expect(screen.getByText('Reference JOB-2083-0004')).toBeInTheDocument();

    const when = screen.getByTestId('visit-when');
    expect(when).toHaveTextContent('Friday, 2 October 2026');
    expect(when).toHaveTextContent('10:00–12:00');
    expect(when).toHaveTextContent('Nepal time');

    const where = screen.getByTestId('visit-where');
    expect(where).toHaveTextContent('Baneshwor-10, Kathmandu');
    expect(where).toHaveTextContent('Landmark: एभरेस्ट बैंकको अगाडि');

    const who = screen.getByTestId('visit-who');
    expect(who).toHaveTextContent('Sita Shrestha');
    expect(within(who).getByRole('link', { name: 'Call Sita Shrestha' })).toHaveAttribute('href', 'tel:9801234567');

    for (const name of ['Confirm', 'Need another time']) {
      const button = screen.getByRole('button', { name });
      // Thumb-sized (≥ 48 px) and full width on a phone.
      expect(button).toHaveClass('min-h-14', 'w-full');
    }
    // No login, no code, no name.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expectPhoneSafe();
  });

  it('confirms with one tap and says when they will be seen, then lets them change it', async () => {
    const user = userEvent.setup();
    const { calls } = open({ respond: () => json({ data: answered(VISIT, 'CONFIRMED') }) });
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(posts(calls)[0]?.body).toEqual({ answer: 'confirm' }));
    expect(await screen.findByText('Thank you — your visit is confirmed')).toBeInTheDocument();
    expect(screen.getByText('We will see you on Friday, 2 October 2026, 10:00–12:00.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();

    // The latest answer wins: Change my answer brings the two answers back, and Keep my answer puts them away.
    await user.click(screen.getByRole('button', { name: 'Change my answer' }));
    expect(screen.getByRole('button', { name: 'Need another time' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep my answer' }));
    expect(screen.getByText('Thank you — your visit is confirmed')).toBeInTheDocument();
    expect(posts(calls)).toHaveLength(1);
  });

  it('asks for another time with a note, counts it, and can go back to confirming', async () => {
    const user = userEvent.setup();
    const note = 'After 3 pm, or Saturday';
    const { calls } = open({
      respond: ({ body }) => json({ data: body.answer === 'confirm' ? answered(VISIT, 'CONFIRMED') : answered(VISIT, 'RESCHEDULE_REQUESTED', body.note) }),
    });
    await user.click(await screen.findByRole('button', { name: 'Need another time' }));
    const form = screen.getByRole('form', { name: 'Need another time?' });
    const box = within(form).getByRole('textbox', { name: 'When suits you? (optional)' });
    expect(box).toHaveFocus();
    expect(box).toHaveAttribute('maxLength', '500');
    expect(within(form).getByText('0 / 500')).toBeInTheDocument();
    await user.type(box, note);
    expect(within(form).getByText(`${note.length} / 500`)).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Ask for another time' }));

    await waitFor(() => expect(posts(calls)[0]?.body).toEqual({ answer: 'reschedule', note }));
    expect(await screen.findByText('We will call you to find another time')).toBeInTheDocument();
    expect(screen.getByTestId('visit-note-echo')).toHaveTextContent(note);

    await user.click(screen.getByRole('button', { name: 'Change my answer' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(posts(calls)[1]?.body).toEqual({ answer: 'confirm' }));
    expect(await screen.findByText('Thank you — your visit is confirmed')).toBeInTheDocument();
  });

  it('asks for another time without a note', async () => {
    const user = userEvent.setup();
    const { calls } = open({ respond: () => json({ data: answered(VISIT, 'RESCHEDULE_REQUESTED') }) });
    await user.click(await screen.findByRole('button', { name: 'Need another time' }));
    await user.click(screen.getByRole('button', { name: 'Ask for another time' }));
    await waitFor(() => expect(posts(calls)[0]?.body).toEqual({ answer: 'reschedule' }));
    expect(await screen.findByText('We will call you to find another time')).toBeInTheDocument();
    expect(screen.queryByTestId('visit-note-echo')).not.toBeInTheDocument();
  });

  it('shows an earlier request for another time with its note, and starts a change from that note', async () => {
    const user = userEvent.setup();
    open({ visit: answered(VISIT, 'RESCHEDULE_REQUESTED', 'Any evening after 5') });
    expect(await screen.findByText('We will call you to find another time')).toBeInTheDocument();
    expect(screen.getByTestId('visit-note-echo')).toHaveTextContent('Any evening after 5');
    await user.click(screen.getByRole('button', { name: 'Change my answer' }));
    await user.click(screen.getByRole('button', { name: 'Need another time' }));
    expect(screen.getByRole('textbox', { name: 'When suits you? (optional)' })).toHaveValue('Any evening after 5');
  });

  it('shows an earlier answer as recorded', async () => {
    open({ visit: answered(VISIT, 'CONFIRMED') });
    expect(await screen.findByText('Thank you — your visit is confirmed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change my answer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  });

  it('offers no answer once the visit is closed, only a call to the office', async () => {
    open({ visit: { ...answered(VISIT, 'CONFIRMED'), canAnswer: false } });
    expect(await screen.findByText('This visit can no longer be changed here')).toBeInTheDocument();
    for (const name of ['Confirm', 'Need another time', 'Change my answer']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Call 01-5407720' })).toHaveAttribute('href', 'tel:015407720');
    // The details still say when and where.
    expect(screen.getByTestId('visit-when')).toHaveTextContent('10:00–12:00');
  });

  it('says a cancelled visit was cancelled, without its old time', async () => {
    open({ visit: { ...VISIT, status: 'CANCELLED', canAnswer: false } });
    expect(await screen.findByText('This visit was cancelled')).toBeInTheDocument();
    expect(screen.queryByTestId('visit-when')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  });

  it('shows the closed state when the answer arrives too late (VISIT_CLOSED)', async () => {
    const user = userEvent.setup();
    const { calls } = open({
      visit: (sofar) => (posts(sofar).length ? { ...VISIT, canAnswer: false } : VISIT),
      respond: () => json({ error: { code: 'VISIT_CLOSED', message: 'This visit can no longer be answered' } }, 422),
    });
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('This visit can no longer be changed here')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/did not reach us in time/);
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    // …and it looked again.
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET' && c.path === '/public/visits/tok-1')).toHaveLength(2));
  });

  it('keeps the answers when sending fails, and says so', async () => {
    const user = userEvent.setup();
    open({ respond: () => json({ error: { code: 'INTERNAL', message: 'boom' } }, 500) });
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not record your answer. Please try again.');
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
  });

  it('says who will come later when no surveyor is named yet, and offers the office', async () => {
    open({ visit: { ...VISIT, surveyor: null } });
    const who = await screen.findByTestId('visit-who');
    expect(who).toHaveTextContent('We will tell you who is coming before the visit.');
    expect(within(who).getByRole('link', { name: 'Call the office · 01-5407720' })).toHaveAttribute('href', 'tel:015407720');
  });

  it('says a link it does not know is not valid, with the company’s phone', async () => {
    open({ visit: null, bootstrap: { settings: { 'contact.phonePrimary': '01-5550000' } } });
    expect(await screen.findByRole('heading', { name: 'This link is not valid' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Call 01-5550000' })).toHaveAttribute('href', 'tel:015550000');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('offers the customer’s own language in one tap', async () => {
    const user = userEvent.setup();
    const { store } = open({ visit: { ...VISIT, customer: { name: 'Anjali Karki', preferredLocale: 'ne' } } });
    await user.click(await screen.findByRole('button', { name: 'नेपालीमा पढ्नुहोस्' }));
    expect(store.getState().ui.locale).toBe('ne');
    expect(await screen.findByRole('heading', { level: 1, name: 'तपाईंको साइट भ्रमण' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'नेपालीमा पढ्नुहोस्' })).not.toBeInTheDocument();
  });
});

describe('the customer visit page in Nepali (Phase L5)', () => {
  const NE = { ...VISIT, customer: { name: 'अञ्जली कार्की', preferredLocale: 'ne' }, surveyor: { name: 'सीता श्रेष्ठ', phone: '9801234567' } };

  it('reads in Nepali at 360 px: the window with Latin digits, the place, the surveyor, the answers', async () => {
    open({ visit: NE, locale: 'ne' });
    expect(await screen.findByRole('heading', { level: 1, name: 'तपाईंको साइट भ्रमण' })).toBeInTheDocument();
    const when = screen.getByTestId('visit-when');
    expect(when).toHaveTextContent('शुक्रबार, 2 अक्टोबर 2026');
    expect(when).toHaveTextContent('10:00–12:00');
    expect(when).toHaveTextContent('नेपाल समय');
    expect(screen.getByTestId('visit-where')).toHaveTextContent('चिनारी: एभरेस्ट बैंकको अगाडि');
    expect(screen.getByRole('link', { name: 'सीता श्रेष्ठलाई फोन गर्नुहोस्' })).toHaveAttribute('href', 'tel:9801234567');
    expect(screen.getByRole('heading', { name: 'यो समय तपाईंलाई मिल्छ?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'पक्का गर्नुहोस्' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'अर्को समय चाहियो' })).toBeInTheDocument();
    // Already in their language: no switch offered.
    expect(screen.queryByRole('button', { name: 'Read in English' })).not.toBeInTheDocument();
    expectPhoneSafe();
  });

  it('confirms in Nepali', async () => {
    const user = userEvent.setup();
    const { calls } = open({ visit: NE, locale: 'ne', respond: () => json({ data: answered(NE, 'CONFIRMED') }) });
    await user.click(await screen.findByRole('button', { name: 'पक्का गर्नुहोस्' }));
    await waitFor(() => expect(posts(calls)[0]?.body).toEqual({ answer: 'confirm' }));
    expect(await screen.findByText('धन्यवाद — तपाईंको भ्रमण पक्का भयो')).toBeInTheDocument();
    expect(screen.getByText('हामी तपाईंलाई शुक्रबार, 2 अक्टोबर 2026, 10:00–12:00 मा भेट्नेछौं।')).toBeInTheDocument();
  });

  it('asks for another time with a Nepali note and echoes it', async () => {
    const user = userEvent.setup();
    const note = 'शनिबार दिउँसो 3 बजेपछि आउनुहोस्।';
    const { calls } = open({ visit: NE, locale: 'ne', respond: ({ body }) => json({ data: answered(NE, 'RESCHEDULE_REQUESTED', body.note) }) });
    await user.click(await screen.findByRole('button', { name: 'अर्को समय चाहियो' }));
    const form = screen.getByRole('form', { name: 'अर्को समय चाहियो?' });
    await user.type(within(form).getByRole('textbox', { name: 'कुन समय मिल्छ? (ऐच्छिक)' }), note);
    await user.click(within(form).getByRole('button', { name: 'अर्को समय माग्नुहोस्' }));

    await waitFor(() => expect(posts(calls)[0]?.body).toEqual({ answer: 'reschedule', note }));
    expect(await screen.findByText('अर्को समय मिलाउन हामी तपाईंलाई फोन गर्नेछौं')).toBeInTheDocument();
    expect(screen.getByTestId('visit-note-echo')).toHaveTextContent(note);
    expect(screen.getByRole('button', { name: 'जवाफ बदल्नुहोस्' })).toBeInTheDocument();
  });

  it('shows the closed state in Nepali with no answers', async () => {
    open({ visit: { ...NE, canAnswer: false }, locale: 'ne' });
    expect(await screen.findByText('यो भ्रमण अब यहाँबाट बदल्न मिल्दैन')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'पक्का गर्नुहोस्' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '01-5407720 मा फोन गर्नुहोस्' })).toHaveAttribute('href', 'tel:015407720');
  });

  it('says an unknown link is not valid, in Nepali', async () => {
    open({ visit: null, locale: 'ne' });
    expect(await screen.findByRole('heading', { name: 'यो लिङ्क मान्य छैन' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /मा फोन गर्नुहोस्$/ })).toHaveAttribute('href', expect.stringMatching(/^tel:/));
  });
});

describe('the customer visit page — every word in Nepali (Phase J1)', () => {
  const NE = { ...VISIT, customer: { name: 'अञ्जली कार्की', preferredLocale: 'ne' }, surveyor: null };
  let warn;
  beforeEach(() => {
    resetI18nWarnings();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  /** No text was missing: `t()` warns `[i18n] …` for a key with no Nepali (or no words at all). */
  const expectNoMissingWords = () => {
    expect(warn.mock.calls.filter(([first]) => String(first).startsWith('[i18n]'))).toEqual([]);
  };

  it('reads in Nepali with no text missing: the heading, the details, the office to call, the reschedule form', async () => {
    const user = userEvent.setup();
    open({ visit: NE, locale: 'ne' });
    expect(await screen.findByText('सन्दर्भ नं. JOB-2083-0004')).toBeInTheDocument();
    expect(screen.getByText(/हामी तपाईंको साइट निरीक्षण गर्न आउँदैछौं/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'भ्रमणको विवरण' })).toBeInTheDocument();
    const who = screen.getByTestId('visit-who');
    expect(who).toHaveTextContent('भ्रमणअघि को आउँदै हुनुहुन्छ भनेर हामी तपाईंलाई जानकारी दिनेछौं।');
    expect(within(who).getByRole('link', { name: 'कार्यालयमा फोन गर्नुहोस् · 01-5407720' })).toHaveAttribute('href', 'tel:015407720');
    await user.click(screen.getByRole('button', { name: 'अर्को समय चाहियो' }));
    const form = screen.getByRole('form', { name: 'अर्को समय चाहियो?' });
    expect(within(form).getByText('0 / 500')).toBeInTheDocument();
    expect(within(form).getByRole('textbox')).toHaveAttribute('placeholder', 'जस्तै: दिउँसो 3 बजेपछि, वा शनिबार जुनसुकै बेला');
    await user.click(within(form).getByRole('button', { name: 'पछाडि जानुहोस्' }));
    expectPhoneSafe();
    expectNoMissingWords();
  });

  it.each([
    ['cancelled', { status: 'CANCELLED' }, 'यो भ्रमण रद्द गरियो'],
    ['underway', { status: 'EN_ROUTE' }, 'भ्रमण सुरु भइसकेको छ'],
    ['done', { status: 'COMPLETED' }, 'यो भ्रमण सम्पन्न भयो'],
    ['closed', { status: 'ASSIGNED' }, 'यो भ्रमण अब यहाँबाट बदल्न मिल्दैन'],
  ])('says a %s visit in Nepali', async (_kind, change, title) => {
    open({ visit: { ...NE, ...change, canAnswer: false }, locale: 'ne' });
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '01-5407720 मा फोन गर्नुहोस्' })).toBeInTheDocument();
    expectNoMissingWords();
  });

  it('tells an answer that arrived too late (VISIT_CLOSED) in Nepali', async () => {
    const user = userEvent.setup();
    open({
      visit: (sofar) => (posts(sofar).length ? { ...NE, canAnswer: false } : NE),
      respond: () => json({ error: { code: 'VISIT_CLOSED', message: 'This visit can no longer be changed here. Please call us.' } }, 422),
      locale: 'ne',
    });
    await user.click(await screen.findByRole('button', { name: 'पक्का गर्नुहोस्' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('तपाईंको जवाफ समयमै आइपुगेन — यो भ्रमण अब यहाँबाट बदल्न मिल्दैन।');
    expect(screen.getByText('यो भ्रमण अब यहाँबाट बदल्न मिल्दैन')).toBeInTheDocument();
    expectNoMissingWords();
  });

  it('tells too many tries (RATE_LIMITED) in Nepali, from the shared words, and its own failure otherwise', async () => {
    const user = userEvent.setup();
    let status = 429;
    open({
      visit: NE,
      respond: () => (status === 429
        ? json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, 429)
        : json({ error: { code: 'INTERNAL_ERRORS', message: 'boom' } }, 500)),
      locale: 'ne',
    });
    await user.click(await screen.findByRole('button', { name: 'पक्का गर्नुहोस्' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('धेरै पटक प्रयास भयो।');
    status = 500;
    await user.click(screen.getByRole('button', { name: 'पक्का गर्नुहोस्' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('तपाईंको जवाफ रेकर्ड गर्न सकिएन। कृपया फेरि प्रयास गर्नुहोस्।'));
    expect(document.body.textContent).not.toMatch(/boom|Too many requests/);
    expectNoMissingWords();
  });

  it('says it could not open the visit, in Nepali, with Try again', async () => {
    mockApi((call) => (call.path === '/public/visits/tok-1' ? json({ error: { code: 'INTERNAL_ERROR', message: 'boom' } }, 500) : undefined));
    renderWithProviders(<VisitPublicPage />, {
      path: '/visit/:token', initialPath: '/visit/tok-1',
      preloadedState: { ui: { ...uiReducer(undefined, { type: '@@init' }), locale: 'ne', toasts: [] } },
    });
    expect(await screen.findByRole('heading', { name: 'तपाईंको भ्रमण खोल्न सकिएन' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'फेरि प्रयास गर्नुहोस्' })).toBeInTheDocument();
    expectNoMissingWords();
  });

  it('offers English, written in English, to an English-speaking customer on the Nepali page', async () => {
    const user = userEvent.setup();
    const { store } = open({ visit: { ...NE, customer: { name: 'Anjali Karki', preferredLocale: 'en' } }, locale: 'ne' });
    await user.click(await screen.findByRole('button', { name: 'Read in English' }));
    expect(store.getState().ui.locale).toBe('en');
    expect(await screen.findByRole('heading', { level: 1, name: 'Your site visit' })).toBeInTheDocument();
    expectNoMissingWords();
  });
});
