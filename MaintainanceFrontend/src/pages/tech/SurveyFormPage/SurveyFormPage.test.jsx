import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SurveyFormPage from '@/pages/tech/SurveyFormPage/SurveyFormPage';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';
import { resetFieldDbForTests } from '@/helpers/fieldDb';
import { pending } from '@/helpers/offlineQueue';
import { pendingUploads } from '@/helpers/uploadQueue';
import { resetSentPhotosForTests } from '@/helpers/sentPhotos';
import { fieldSyncSettled } from '@/hooks/useOfflineQueue';
import uiReducer from '@/redux/slices/uiSlice';
import { watchI18nWarnings } from '@/test/i18nWarnings';
import { SURVEY_STEPS } from './surveyForm';

vi.mock('@/hooks/useIdlePreload', () => ({ useIdlePreload: () => {} }));
// jsdom cannot decode a picture: the photo goes as it was chosen.
vi.mock('@/helpers/compressImage', () => ({ compressImage: async (file) => file }));

let online;
beforeEach(() => {
  resetFieldDbForTests();
  resetSentPhotosForTests();
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
});
afterEach(async () => {
  // Unmounting saves what is unsaved: let that reach the (mocked) API before the mocks go.
  cleanup();
  await new Promise((r) => { setTimeout(r, 30); });
  await fieldSyncSettled();
  delete navigator.geolocation;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const TEMPLATE = {
  id: 't1',
  name: 'Seepage & damp — site checklist',
  questions: [
    {
      key: 'moisture_low', label: 'Moisture at 300 mm', labelNe: 'भुइँबाट 300 mm माथिको चिस्यान', type: 'NUMBER', unit: '%', metric: 'moisture',
      flag: { above: 20 }, required: true, photoRequired: true,
    },
    { key: 'salt', label: 'Salt deposits', labelNe: 'नुनको दाग', type: 'CHOICE', options: ['None', 'Light', 'Heavy'], flag: { values: ['Heavy'] }, required: true, photoRequired: false },
    { key: 'dpc_visible', label: 'DPC visible', labelNe: 'DPC देखिन्छ', type: 'YES_NO', flag: { equals: 'no' }, required: true, photoRequired: false },
    { key: 'customer_story', label: 'What the customer says', type: 'TEXT', required: false, photoRequired: false },
  ],
};

const SURVEY = {
  id: 's1', number: 'SV-2083-0007', status: 'DRAFT',
  customer: { id: 'c1', name: 'सीता राई', phone: '9841234567' },
  site: {
    id: 'st1', label: 'Home', address: 'Jhamsikhel, Lalitpur', area: 'Lalitpur', landmark: 'भाटभटेनीको अगाडि',
    contactName: 'हरि (caretaker)', contactPhone: '9851000000', lat: null, lng: null,
  },
  service: { id: 'sv1', name: 'Seepage & Damp Treatment' },
  lead: {
    id: 'l1', message: 'भुइँतलाको भित्तामा चिस्यान।',
    photos: [{ id: 'lp1', mediaId: 'lm1', caption: 'North wall', url: '/uploads/lm1.jpg', thumb: '/uploads/lm1-400.webp' }],
  },
  template: TEMPLATE,
  readings: [],
  items: [],
  job: { id: 'j1', number: 'JOB-2083-0101', photos: [], scheduledStart: '2026-10-02T04:15:00.000Z', scheduledEnd: '2026-10-02T06:15:00.000Z' },
  media: {},
};

/** The checklist answered on the server — moisture with its photo, salt, DPC. */
const ANSWERED = [
  { id: 'r1', questionKey: 'moisture_low', label: 'Moisture at 300 mm', metric: 'moisture', value: 24, unit: '%', mediaId: 'm-moist', flagged: true, sortOrder: 0 },
  { id: 'r2', questionKey: 'salt', label: 'Salt deposits', metric: 'observation', textValue: 'Light', flagged: false, sortOrder: 1 },
  { id: 'r3', questionKey: 'dpc_visible', label: 'DPC visible', metric: 'observation', textValue: 'yes', flagged: false, sortOrder: 2 },
];

const LINE = {
  id: 'i1', kind: 'SERVICE', description: 'Wall putty two coats', unit: 'sq.ft', qty: 102.333, wastagePct: 0, isOptional: false, sortOrder: 0,
  measurements: [
    { area: 'Living room', description: 'North wall', nos: 1, l: 12.3333, h: 10 },
    { area: 'Living room', description: 'Door', nos: 1, l: 3, h: 7, deduct: true },
  ],
};

const applied = (body, answers = {}) => json({
  data: { results: body.mutations.map((m) => ({ idempotencyKey: m.idempotencyKey, status: 'applied', ...(answers[m.kind] ?? {}) })) },
});

function api(survey = SURVEY, { sync } = {}) {
  return mockApi(({ method, path, body }) => {
    if (method === 'GET' && path === '/tech/surveys/s1') return json({ data: survey });
    if (method === 'GET' && (path === '/tech/rate-card' || path === '/tech/materials')) return json({ data: [] });
    if (method === 'POST' && path === '/tech/sync') return sync ? sync(body) : applied(body);
    if (method === 'POST' && path === '/tech/surveys/s1/photos') {
      return json({ data: { photos: [{ id: 'p9', mediaId: 'm-new' }], media: [{ id: 'm-new', thumb: '/uploads/m-new-400.webp' }] } }, 201);
    }
    return undefined;
  });
}

const renderSurvey = (step, { locale = 'en' } = {}) => renderWithProviders(<SurveyFormPage />, {
  path: '/tech/surveys/:id',
  initialPath: `/tech/surveys/s1${step ? `?step=${step}` : ''}`,
  preloadedState: { ...signedInAs('SURVEYOR'), ui: { ...uiReducer(undefined, { type: '@@init' }), locale } },
  routes: [{ path: '/tech/surveys', element: <p>Survey list</p> }],
});

const drafts = async () => (await pending()).filter((m) => m.kind === 'survey_draft');

describe('SurveyFormPage — the stepper', () => {
  it('opens on Before you go: the customer’s message and photos, the landmark and who to meet — no money', async () => {
    api();
    renderSurvey();
    expect(await screen.findByRole('heading', { name: 'Before you go' })).toBeInTheDocument();
    expect(screen.getByText('भुइँतलाको भित्तामा चिस्यान।')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'North wall' })).toHaveAttribute('src', '/uploads/lm1-400.webp');
    expect(screen.getByText('भाटभटेनीको अगाडि')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Call हरि \(caretaker\)/ })).toHaveAttribute('href', 'tel:9851000000');
    expect(screen.getByRole('navigation', { name: 'Survey steps' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Rs\.|rate|cost|margin/i);
  });

  it('blocks submit, jumps to the checklist and points at each missing answer and photo — nothing is sent', async () => {
    const user = userEvent.setup();
    api();
    renderSurvey('lines');

    await user.click(await screen.findByRole('button', { name: /Submit survey/ }));

    expect(await screen.findByRole('heading', { name: 'Checklist' })).toBeInTheDocument();
    const panel = screen.getByTestId('survey-incomplete');
    expect(within(panel).getByText('Moisture at 300 mm — answer needed')).toBeInTheDocument();
    expect(within(panel).getByText('Salt deposits — answer needed')).toBeInTheDocument();
    expect(within(panel).getByText('DPC visible — answer needed')).toBeInTheDocument();
    const moisture = document.getElementById('question-moisture_low');
    expect(moisture).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(document.activeElement).toBe(moisture));
    expect((await pending()).some((m) => m.kind === 'survey_submit')).toBe(false);

    // Answering moves the item on: the number is flagged at once, and now the photo is what is missing.
    await user.type(within(moisture).getByRole('textbox', { name: 'Moisture at 300 mm' }), '24');
    expect(within(moisture).getByTestId('flag-moisture_low')).toHaveTextContent('Flagged');
    expect(within(panel).getByText('Moisture at 300 mm — photo needed')).toBeInTheDocument();
    expect(within(moisture).getByText('Photo needed', { selector: 'p' })).toBeInTheDocument();

    // "Show me" puts the focus on the question.
    await user.click(within(panel).getByRole('button', { name: 'Show me: DPC visible' }));
    expect(document.activeElement).toBe(document.getElementById('question-dpc_visible'));
  });

  it('shows the office’s SURVEY_INCOMPLETE from a refused survey_submit on the checklist, pointing at the item', async () => {
    const user = userEvent.setup();
    const sent = [];
    api({ ...SURVEY, readings: ANSWERED }, {
      sync: (body) => {
        sent.push(...body.mutations);
        return applied(body, {
          survey_submit: {
            status: 'failed', code: 'SURVEY_INCOMPLETE', error: 'The checklist is not finished: Moisture at 300 mm (photo)',
            details: [{ questionKey: 'moisture_low', label: 'Moisture at 300 mm', missing: 'photo' }],
          },
        });
      },
    });
    const { store } = renderSurvey('lines');

    await user.click(await screen.findByRole('button', { name: /Submit survey/ }));

    expect(await screen.findByRole('heading', { name: 'Checklist' })).toBeInTheDocument();
    const panel = await screen.findByTestId('survey-incomplete');
    expect(within(panel).getByText('Moisture at 300 mm — photo needed')).toBeInTheDocument();
    expect(screen.getByText('The office could not take the survey — something is missing.')).toBeInTheDocument();
    expect(document.getElementById('question-moisture_low')).toHaveAttribute('aria-invalid', 'true');
    // The draft went first, the submit after it — and the refusal is shown here, not as a header note.
    expect(sent.map((m) => m.kind)).toEqual(['survey_draft', 'survey_submit']);
    expect(store.getState().fieldSync.notes).toEqual([]);
    expect(screen.queryByText('Survey list')).not.toBeInTheDocument();
  });

  it('submits a complete survey: the last draft, then survey_submit, and goes back to the list', async () => {
    const user = userEvent.setup();
    const sent = [];
    api({ ...SURVEY, readings: ANSWERED }, { sync: (body) => { sent.push(...body.mutations); return applied(body); } });
    const { store } = renderSurvey('lines');

    await user.click(await screen.findByRole('button', { name: /Submit survey/ }));

    expect(await screen.findByText('Survey list')).toBeInTheDocument();
    expect(sent.map((m) => m.kind)).toEqual(['survey_draft', 'survey_submit']);
    const [draft] = sent;
    expect(draft.payload.readings.slice(0, 3)).toEqual([
      { questionKey: 'moisture_low', label: 'Moisture at 300 mm', metric: 'moisture', value: 24, unit: '%', mediaId: 'm-moist', sortOrder: 0 },
      { questionKey: 'salt', label: 'Salt deposits', metric: 'observation', textValue: 'Light', sortOrder: 1 },
      { questionKey: 'dpc_visible', label: 'DPC visible', metric: 'observation', textValue: 'yes', sortOrder: 2 },
    ]);
    expect(store.getState().ui.toasts.map((t) => t.title)).toContain('Survey submitted');
  });

  it('answers the checklist with big toggles and chips, takes a required photo through the upload queue, and saves offline', async () => {
    online = false;
    const user = userEvent.setup();
    const calls = api();
    renderSurvey('checklist');

    await user.type(await screen.findByRole('textbox', { name: 'Moisture at 300 mm' }), '18');
    expect(screen.queryByTestId('flag-moisture_low')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Heavy' }));
    expect(screen.getByTestId('flag-salt')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'No' }));
    expect(screen.getByTestId('flag-dpc_visible')).toBeInTheDocument();

    const photo = new File([new Uint8Array(16)], 'meter.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Take the photo: Moisture at 300 mm'), { target: { files: [photo] } });
    expect(await screen.findByText('Waiting to upload')).toBeInTheDocument();
    const [upload] = await pendingUploads();
    expect(upload).toMatchObject({ target: 'survey', targetId: 's1', kind: 'ISSUE', caption: 'Moisture at 300 mm' });

    // Leaving the step saves at once — on the phone, as one survey_draft (a newer one replaces the older).
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(async () => expect(await drafts()).toHaveLength(1));
    const [draft] = await drafts();
    expect(draft.payload.readings).toEqual([
      { questionKey: 'moisture_low', label: 'Moisture at 300 mm', metric: 'moisture', value: 18, unit: '%', photoUploadId: upload.id, sortOrder: 0 },
      { questionKey: 'salt', label: 'Salt deposits', metric: 'observation', textValue: 'Heavy', sortOrder: 1 },
      { questionKey: 'dpc_visible', label: 'DPC visible', metric: 'observation', textValue: 'no', sortOrder: 2 },
    ]);
    expect(calls.some((c) => c.path === '/tech/sync')).toBe(false);
  });

  it('pins the site from the GPS, asking before it replaces a saved pin, and shows the accuracy', async () => {
    const user = userEvent.setup();
    online = false;
    const getCurrentPosition = vi.fn((ok) => ok({ coords: { latitude: 27.6712345, longitude: 85.3134567, accuracy: 12.4 } }));
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
    api({ ...SURVEY, site: { ...SURVEY.site, lat: 27.6, lng: 85.3 } });
    renderSurvey('arrived');

    expect(await screen.findByText('This site has a pin')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Pin it again here/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Replace the saved pin?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Replace the pin' }));

    expect(await screen.findByText('Pinned — it goes to the office with the survey.')).toBeInTheDocument();
    expect(screen.getByText('Accurate to about 12 m')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open the pin in Maps/ })).toHaveAttribute('href', 'https://www.google.com/maps?q=27.671235,85.313457');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(async () => expect(await drafts()).toHaveLength(1));
    expect((await drafts())[0].payload.sitePin).toEqual({ lat: 27.671235, lng: 85.313457, accuracy: 12 });
  });

  it('speaks Nepali: the steps, the question words and the buttons', async () => {
    api();
    renderSurvey('checklist', { locale: 'ne' });
    expect(await screen.findByRole('heading', { name: 'चेकलिस्ट' })).toBeInTheDocument();
    expect(screen.getByText('भुइँबाट 300 mm माथिको चिस्यान')).toBeInTheDocument();
    expect(screen.getAllByRole('radio', { name: 'छैन' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /अर्को/ })).toBeInTheDocument();
  });

  it('walks every step in Nepali with no word missing', async () => {
    const warned = watchI18nWarnings();
    // Each step, with a word of its own that must be Nepali.
    const expected = {
      before: 'ग्राहकले भनेको कुरा',
      arrived: 'यहीँ पिन राख्नुहोस्',
      checklist: 'अरू रिडिङ',
      measure: 'कुन लाइन नाप्दै हुनुहुन्छ?',
      photos: 'यो केको फोटो हो?',
      findings: 'कत्तिको जरुरी',
      lines: 'मात्रा मात्र — मूल्य अफिसले राख्छ।',
    };
    const headings = { before: 'जानुअघि', arrived: 'पुगेँ', checklist: 'चेकलिस्ट', measure: 'नाप', photos: 'फोटो', findings: 'के भेटियो', lines: 'के चाहिन्छ' };
    expect(Object.keys(expected)).toEqual(SURVEY_STEPS);
    for (const [i, step] of SURVEY_STEPS.entries()) {
      api({ ...SURVEY, items: [LINE] });
      renderSurvey(step, { locale: 'ne' });
      expect(await screen.findByRole('heading', { name: headings[step] })).toBeInTheDocument();
      expect(screen.getByText(`चरण ${i + 1} / ${SURVEY_STEPS.length}`)).toBeInTheDocument();
      expect(screen.getByText(expected[step])).toBeInTheDocument();
      expect(screen.getByText('भर्दै')).toBeInTheDocument(); // the survey's status
      expect(screen.getByRole('navigation', { name: 'सर्भेका चरण' })).toBeInTheDocument();
      if (step === 'measure') {
        expect(screen.getByRole('group', { name: 'नाप 1 — Living room' })).toBeInTheDocument();
        expect(screen.getByTestId('line-total')).toHaveTextContent('यो लाइन: 102.333 sq.ft');
      }
      if (step === 'lines') expect(screen.getByRole('group', { name: 'लाइन 1' })).toBeInTheDocument();
      if (step === 'photos') expect(screen.getByRole('radio', { name: 'कागजको स्केच' })).toBeInTheDocument();
      cleanup();
    }
    expect(warned()).toEqual([]);
  }, 20_000);

  it('shows a choice’s Nepali words (`optionsNe`) and still records the English option', async () => {
    const user = userEvent.setup();
    online = false;
    const warned = watchI18nWarnings();
    const salt = { ...TEMPLATE.questions[1], optionsNe: ['छैन', 'थोरै', 'धेरै'] };
    api({ ...SURVEY, template: { ...TEMPLATE, questions: [TEMPLATE.questions[0], salt, ...TEMPLATE.questions.slice(2)] } });
    renderSurvey('checklist', { locale: 'ne' });

    const card = await screen.findByRole('group', { name: 'नुनको दाग' });
    const chips = within(card).getByRole('radiogroup', { name: 'नुनको दाग' });
    expect(within(chips).getAllByRole('radio').map((r) => r.textContent)).toEqual(['छैन', 'थोरै', 'धेरै']);
    expect(within(card).getByText('धेरै भए चिन्ह')).toBeInTheDocument();
    await user.click(within(chips).getByRole('radio', { name: 'धेरै' }));
    expect(within(card).getByTestId('flag-salt')).toHaveTextContent('ध्यान दिनुपर्ने');

    await user.click(screen.getByRole('button', { name: /अर्को/ }));
    await waitFor(async () => expect(await drafts()).toHaveLength(1));
    const reading = (await drafts())[0].payload.readings.find((r) => r.questionKey === 'salt');
    expect(reading).toMatchObject({ questionKey: 'salt', textValue: 'Heavy' });
    expect(warned()).toEqual([]);
  });

  it('reads a checklist number typed on a Nepali keyboard', async () => {
    const user = userEvent.setup();
    online = false;
    api();
    renderSurvey('checklist', { locale: 'ne' });
    const box = await screen.findByRole('textbox', { name: 'भुइँबाट 300 mm माथिको चिस्यान' });
    await user.type(box, '२४.५');
    expect(screen.getByTestId('flag-moisture_low')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /अर्को/ }));
    await waitFor(async () => expect(await drafts()).toHaveLength(1));
    expect((await drafts())[0].payload.readings.find((r) => r.questionKey === 'moisture_low')).toMatchObject({ value: 24.5 });
  });
});

describe('SurveyFormPage — the measurement sheet at 360 px', () => {
  beforeEach(() => {
    window.innerWidth = 360;
    window.dispatchEvent(new Event('resize'));
  });

  it('shows one card per row by room, reads feet-inches, previews the values and shows the office’s quantity once synced', async () => {
    const user = userEvent.setup();
    online = false;
    api({ ...SURVEY, items: [LINE] });
    const { container } = renderSurvey('measure');

    expect(await screen.findByRole('heading', { name: 'Measure' })).toBeInTheDocument();
    // One card per measurement row — never a table on a phone.
    expect(container.querySelector('table')).toBeNull();
    const cards = screen.getAllByTestId('measurement-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAccessibleName('Row 1 — Living room');
    expect(within(cards[1]).getByRole('switch', { name: /Deduct/ })).toBeChecked();
    expect(within(cards[1]).getByTestId('row-value')).toHaveTextContent('= −21 sq.ft');
    expect(screen.getByTestId('room-total')).toHaveTextContent('Room: 102.333 sq.ft');
    // The phone's rows are the server's: its derived quantity shows.
    expect(screen.getByTestId('office-qty')).toHaveTextContent('Office quantity: 102.333 sq.ft');

    // A second room, measured in feet and inches.
    await user.type(screen.getByLabelText('Room or area', { selector: '#new-room' }), 'Bedroom');
    await user.click(screen.getByRole('button', { name: /Add a room/ }));
    const bedroom = screen.getByRole('group', { name: 'Row 3 — Bedroom' });
    await user.type(within(bedroom).getByLabelText('What'), 'East wall');
    await user.type(within(bedroom).getByLabelText('Nos'), '1');
    await user.type(within(bedroom).getByLabelText('Length'), '12\' 6"');
    expect(within(bedroom).getByText('= 12.5 ft')).toBeInTheDocument();
    await user.type(within(bedroom).getByLabelText('Height'), '10\'');
    expect(within(bedroom).getByTestId('row-value')).toHaveTextContent('= 125 sq.ft');
    expect(screen.getByTestId('line-total')).toHaveTextContent('This line: 227.333 sq.ft');
    // Changed on the phone: the office's figure waits for the sync.
    expect(screen.queryByTestId('office-qty')).not.toBeInTheDocument();
    expect(screen.getByText('The office quantity shows once this is synced.')).toBeInTheDocument();

    // An unreadable size says so and keeps that row on the phone.
    await user.type(within(bedroom).getByLabelText('Breadth'), 'twelve');
    expect(within(bedroom).getByText(/Could not read this/)).toBeInTheDocument();
    await user.clear(within(bedroom).getByLabelText('Breadth'));

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(async () => expect(await drafts()).toHaveLength(1));
    const [draft] = await drafts();
    expect(draft.payload.items).toEqual([{
      kind: 'SERVICE', description: 'Wall putty two coats', unit: 'sq.ft', qty: 227.333, wastagePct: 0, isOptional: false, sortOrder: 0,
      measurements: [
        { area: 'Living room', description: 'North wall', nos: 1, l: 12.3333, h: 10 },
        { area: 'Living room', description: 'Door', nos: 1, l: 3, h: 7, deduct: true },
        { area: 'Bedroom', description: 'East wall', nos: 1, l: 12.5, h: 10 },
      ],
    }]);
    // Quantities only.
    expect(JSON.stringify(draft.payload)).not.toMatch(/rate|amount|cost/i);
  });

  it('starts a new measured line from the sheet, and Lines links back to it', async () => {
    const user = userEvent.setup();
    online = false;
    api();
    renderSurvey('measure');

    await user.click(await screen.findByRole('button', { name: /New measured line/ }));
    await user.type(screen.getByLabelText('What are you measuring?'), 'Damp-proof plaster');
    await user.click(screen.getByRole('button', { name: 'Start measuring' }));
    expect(screen.getByRole('radio', { name: /Damp-proof plaster/ })).toBeChecked();
    await user.type(screen.getByLabelText('Room or area', { selector: '#new-room' }), 'Kitchen');
    await user.click(screen.getByRole('button', { name: /Add a room/ }));
    const row = screen.getByRole('group', { name: 'Row 1 — Kitchen' });
    await user.type(within(row).getByLabelText('Length'), '10');
    await user.type(within(row).getByLabelText('Height'), '4');

    await user.click(screen.getByRole('button', { name: /^Lines/ }));
    const line = await screen.findByRole('group', { name: 'Line 1' });
    expect(within(line).getByText('Measured: 40 sq.ft')).toBeInTheDocument();
    expect(within(line).getByLabelText('Quantity')).toHaveAttribute('readonly');
    await user.click(within(line).getByRole('button', { name: /Change the measurements/ }));
    expect(await screen.findByRole('heading', { name: 'Measure' })).toBeInTheDocument();
  });
});
