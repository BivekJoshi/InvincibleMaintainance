import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WarrantyPublicPage from './WarrantyPublicPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import { json, mockApi, notFound } from '@/test/mockApi';
import uiReducer from '@/redux/slices/uiSlice';
import { resetI18nWarnings } from '@/helpers/i18n';
import { WARRANTY_STATUSES } from '@/config/constants';

/**
 * The warranty certificate and its claim form (`/warranty/:token`, Phase I), in both languages (Phase J1): every word
 * in Nepali, the dates with वि.सं., a claim raised, and a claim the API refuses — WARRANTY_EXPIRED, CLAIM_OPEN —
 * told in the page's language.
 */

/** What GET /public/warranties/:token answers: cover until 26 Oct 2026, the job finished on 26 Sept. */
const WARRANTY = {
  status: 'ACTIVE', isValid: true, scope: 'छत वाटरप्रुफिङ — membrane and joints',
  startsAt: '2026-09-26T04:00:00.000Z', endsAt: '2026-10-26T04:00:00.000Z',
  customer: { name: 'सीता गुरुङ', phone: '9841500005' },
  job: { number: 'JOB-2083-0090', title: 'Terrace waterproofing', actualEnd: '2026-09-26T04:00:00.000Z' },
  claims: [],
};

const open = ({ warranty = WARRANTY, claim, locale = 'en' } = {}) => {
  const calls = mockApi((call) => {
    if (call.method === 'GET' && call.path === '/public/warranties/tok-1') return warranty ? json({ data: warranty }) : notFound('Warranty');
    if (call.method === 'POST' && call.path === '/public/warranties/tok-1/claim') return claim?.(call);
    if (call.path === '/public/bootstrap') return json({ data: { settings: { 'contact.phonePrimary': '01-5407720' } } });
    return undefined;
  });
  const view = renderWithProviders(<WarrantyPublicPage />, {
    path: '/warranty/:token', initialPath: '/warranty/tok-1',
    preloadedState: { ui: { ...uiReducer(undefined, { type: '@@init' }), locale, toasts: [] } },
  });
  return { calls, ...view };
};

const DESCRIPTION = 'पानी फेरि चुहियो — the terrace leaks again.';

let warn;
beforeEach(() => {
  resetI18nWarnings();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  vi.unstubAllGlobals();
});

/** No text was missing: `t()` warns `[i18n] …` for a key with no Nepali (or no words at all). */
const expectNoMissingWords = () => {
  expect(warn.mock.calls.filter(([first]) => String(first).startsWith('[i18n]'))).toEqual([]);
};

describe('the warranty certificate (Phase J1)', () => {
  it('reads in English and raises a claim', async () => {
    const user = userEvent.setup();
    const { calls } = open({ claim: () => json({ data: { id: 'cl1', status: 'open' } }, 201) });
    expect(await screen.findByRole('heading', { name: 'Warranty certificate' })).toBeInTheDocument();
    expect(screen.getByTestId('warranty-standing')).toHaveTextContent('Valid until 26 Oct 2026');
    expect(screen.getByTestId('warranty-covers-until')).toHaveTextContent('26 Oct 2026 (2083-07-10 BS)');
    expect(screen.getByRole('img', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByText('Work carried out')).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'Raise a warranty claim' });
    expect(submit).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: /What is the problem\?/ }), DESCRIPTION);
    await user.click(submit);
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ description: DESCRIPTION }));
    expect(await screen.findByText('Your claim is with our team')).toBeInTheDocument();
    expectNoMissingWords();
  });

  it('reads in Nepali with no text missing, the dates with वि.सं., and raises a claim', async () => {
    const user = userEvent.setup();
    open({ locale: 'ne', claim: () => json({ data: { id: 'cl1', status: 'open' } }, 201) });
    expect(await screen.findByRole('heading', { name: 'वारेन्टी प्रमाणपत्र' })).toBeInTheDocument();
    expect(screen.getByTestId('warranty-standing')).toHaveTextContent('2026 अक्टोबर 26 सम्म मान्य');
    expect(screen.getByTestId('warranty-covers-until')).toHaveTextContent('2026 अक्टोबर 26 (2083-07-10 वि.सं.)');
    expect(screen.getByRole('img', { name: 'मान्य' })).toBeInTheDocument();
    for (const label of ['ग्राहक', 'काम नं.', 'गरिएको काम', 'काम सकिएको मिति', 'वारेन्टी रहने मिति', 'वारेन्टीमा समेटिएका कुरा']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { name: 'यो काममा केही समस्या छ?' })).toBeInTheDocument();
    const box = screen.getByRole('textbox', { name: /समस्या के हो\?/ });
    expect(box).toHaveAttribute('placeholder', 'के देख्नुभयो र कहाँ, लेख्नुहोस्।');
    await user.type(box, DESCRIPTION);
    await user.click(screen.getByRole('button', { name: 'वारेन्टी दाबी गर्नुहोस्' }));
    expect(await screen.findByText('तपाईंको दाबी हाम्रो टोलीसँग छ')).toBeInTheDocument();
    expect(screen.getByText('भ्रमण मिलाउन हामी तपाईंलाई फोन गर्नेछौं। वारेन्टीको कामको कुनै शुल्क लाग्दैन।')).toBeInTheDocument();
    expectNoMissingWords();
  });

  it.each([
    ['WARRANTY_EXPIRED', 'यो वारेन्टीको अवधि सकियो। तैपनि हामी सहयोग गर्न सक्छौं — कृपया फोन गर्नुहोस्।'],
    ['CLAIM_OPEN', 'यो कामको लागि तपाईंको दाबी पहिले नै दर्ता छ। हामी छिट्टै सम्पर्क गर्नेछौं।'],
    ['WARRANTY_VOID', 'यो वारेन्टी अब मान्य छैन। कृपया हामीलाई फोन गर्नुहोस्।'],
  ])('tells a claim refused with %s in Nepali — never the server’s English', async (code, words) => {
    const user = userEvent.setup();
    open({ locale: 'ne', claim: () => json({ error: { code, message: 'An English message from the API' } }, 422) });
    await user.type(await screen.findByRole('textbox', { name: /समस्या के हो\?/ }), DESCRIPTION);
    await user.click(screen.getByRole('button', { name: 'वारेन्टी दाबी गर्नुहोस्' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(words);
    expect(document.body.textContent).not.toMatch(/An English message/);
    expectNoMissingWords();
  });

  it('tells a refused claim in English too', async () => {
    const user = userEvent.setup();
    open({ claim: () => json({ error: { code: 'WARRANTY_EXPIRED', message: 'This warranty expired on 2026-10-26.' } }, 422) });
    await user.type(await screen.findByRole('textbox', { name: /What is the problem\?/ }), DESCRIPTION);
    await user.click(screen.getByRole('button', { name: 'Raise a warranty claim' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This warranty has ended. We can still help — please call us.');
  });

  it('says an ended warranty has expired and gives the number to call, in Nepali', async () => {
    open({ locale: 'ne', warranty: { ...WARRANTY, status: 'EXPIRED', isValid: false, endsAt: '2026-08-26T04:00:00.000Z' } });
    expect(await screen.findByTestId('warranty-standing')).toHaveTextContent('यो वारेन्टी 2026 अगस्ट 26 मा सकियो');
    expect(screen.getByText('यो वारेन्टीको म्याद सकियो')).toBeInTheDocument();
    expect(await screen.findByText('तैपनि हामी सहयोग गर्न सक्छौं — 01-5407720 मा फोन गर्नुहोस्, हामी मर्मतको दरभाउ दिनेछौं।')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'वारेन्टी दाबी गर्नुहोस्' })).not.toBeInTheDocument();
    expectNoMissingWords();
  });

  it('says a voided warranty is no longer valid rather than when it ends', async () => {
    open({ warranty: { ...WARRANTY, status: 'VOID', isValid: false } });
    expect(await screen.findByTestId('warranty-standing')).toHaveTextContent('This warranty is no longer valid');
    expect(screen.getByRole('status')).toHaveTextContent('This warranty is no longer valid');
    expect(screen.getByRole('img', { name: 'Void' })).toBeInTheDocument();
  });

  it('shows a claim already open, in Nepali', async () => {
    open({ locale: 'ne', warranty: { ...WARRANTY, status: 'CLAIMED', claims: [{ id: 'cl1', status: 'open', description: 'x' }] } });
    expect(await screen.findByText('तपाईंको दाबी हाम्रो टोलीसँग छ')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'दाबी दर्ता भएको' })).toBeInTheDocument();
    expectNoMissingWords();
  });

  it('says a link it does not know in Nepali, with Try again', async () => {
    open({ locale: 'ne', warranty: null });
    expect(await screen.findByText('यो भेटिएन। लिङ्क पुरानो वा अधुरो हुन सक्छ।')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'फेरि प्रयास गर्नुहोस्' })).toBeInTheDocument();
    expectNoMissingWords();
  });

  // The seal's words are looked up at run time from the status — every one, in both languages.
  it.each(WARRANTY_STATUSES)('words the status %s in both languages', async (status) => {
    for (const locale of ['en', 'ne']) {
      const view = open({ locale, warranty: { ...WARRANTY, status, isValid: status === 'ACTIVE' } });
      const seal = await screen.findByRole('img');
      expect(seal).toHaveAccessibleName(locale === 'en' ? /^[A-Z]/ : /[ऀ-ॿ]/);
      view.unmount();
    }
    expectNoMissingWords();
  });
});
