import { describe, it, expect, beforeAll } from 'vitest';
import {
  anon, as, expectStatus, createAssignedJob, createCompletedJob, prisma, phone, dayMatching, uid, approveAndSend, pngBuffer,
  uploadImage, daysFromNow,
} from './helpers.js';
import { customerDate } from '../../src/utils/dates.js';

/**
 * Phase J1 — the Nepali UI, from the API's side: a refusal a visitor or customer can meet carries a stable code the site
 * words in their language; gallery captions come in Nepali; and a Nepali-speaking customer's messages are Nepali
 * throughout — the words, the Bikram Sambat dates and रु. amounts.
 */

const code = (res, status) => expectStatus(res, status).error.code;
const lead = (extra = {}) => ({
  name: 'J1 Lead', phone: phone(), message: 'Damp on the wall', elapsedMs: 6000, website: '', ...extra,
});

describe('POST /public/leads — refusals by code', () => {
  it('a filled honeypot, a submission faster than a person, a closed day', async () => {
    expect(code(await anon().post('/public/leads').send(lead({ website: 'http://spam.example' })), 400)).toBe('SUBMISSION_REJECTED');
    expect(code(await anon().post('/public/leads').send(lead({ elapsedMs: 300 })), 400)).toBe('SUBMITTED_TOO_FAST');
    const closed = dayMatching((d) => d === 6);
    expect(code(await anon().post('/public/leads').send(lead({ preferredAt: `${closed}T06:00:00.000Z`, preferredSlot: 'morning' })), 400))
      .toBe('BOOKING_DAY_CLOSED');
  });
});

describe('POST /public/lead-photos — refusals by code', () => {
  const big = async (bytes) => Buffer.concat([await pngBuffer(), Buffer.alloc(bytes)]);

  it('no photo, a file that is not one, too many at once', async () => {
    expect(code(await anon().post('/public/lead-photos'), 400)).toBe('PHOTOS_REQUIRED');
    expect(code(await anon().post('/public/lead-photos').attach('files', Buffer.from('%PDF-1.4 not a photo'), 'quote.pdf'), 400))
      .toBe('UNSUPPORTED_FILE_TYPE');
    let req = anon().post('/public/lead-photos');
    for (let i = 0; i < 6; i += 1) req = req.attach('files', await pngBuffer(), `site-${i}.png`);
    expect(code(await req, 400)).toBe('TOO_MANY_FILES');
  });

  it('a photo over the enquiry limit names the limit; a file over the upload limit is 413', async () => {
    const tooBig = expectStatus(await anon().post('/public/lead-photos').attach('files', await big(11 * 1024 * 1024), 'big.png'), 400);
    expect(tooBig.error).toMatchObject({ code: 'PHOTO_TOO_LARGE', details: { maxMb: 10 } });
    expect(code(await anon().post('/public/lead-photos').attach('files', await big(16 * 1024 * 1024), 'huge.png'), 413)).toBe('FILE_TOO_LARGE');
  });
});

describe('POST /public/warranties/:token/claim — refusals by code', () => {
  let dispatcher;
  beforeAll(async () => { dispatcher = await as('DISPATCHER'); });

  const warrantyFor = async () => {
    const { job } = await createCompletedJob();
    return prisma.warranty.findFirst({ where: { jobId: job.id } });
  };
  const claim = (w) => anon().post(`/public/warranties/${w.publicToken}/claim`).send({ description: 'The damp is back on the same wall.' });

  it('an open claim, an ended warranty, a voided one', async () => {
    const open = await warrantyFor();
    expectStatus(await claim(open), 201);
    expect(code(await claim(open), 422)).toBe('CLAIM_OPEN');

    const ended = await warrantyFor();
    await prisma.warranty.update({ where: { id: ended.id }, data: { endsAt: daysFromNow(-2) } });
    const res = expectStatus(await claim(ended), 422);
    expect(res.error).toMatchObject({ code: 'WARRANTY_EXPIRED', details: { endsAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) } });

    const voided = await warrantyFor();
    expectStatus(await dispatcher.post(`/admin/warranties/${voided.id}/void`).send({ reason: 'Work redone by others' }), 200);
    expect(code(await claim(voided), 422)).toBe('WARRANTY_VOID');
  });
});

describe('GET /public/gallery?locale=', () => {
  it('overlays a caption’s Nepali version, and keeps English without it', async () => {
    const editor = await as('EDITOR');
    const media = await uploadImage(editor, '#335577');
    const caption = `Terrace after waterproofing ${uid()}`;
    const image = expectStatus(await editor.post('/admin/gallery').send({ mediaId: media.id, caption }), 201).data;
    expectStatus(await editor.put('/admin/translations').send({
      model: 'galleryImage', recordId: image.id, values: { caption: { ne: 'वाटरप्रुफिङपछिको छत' } },
    }), 200);

    const ne = expectStatus(await anon().get('/public/gallery?locale=ne'), 200).data.items.find((i) => i.id === image.id);
    expect(ne.caption).toBe('वाटरप्रुफिङपछिको छत');
    const en = expectStatus(await anon().get('/public/gallery?locale=en'), 200).data.items.find((i) => i.id === image.id);
    expect(en.caption).toBe(caption);
  });
});

describe('inspection questions: a choice’s options in Nepali (optionsNe)', () => {
  const SALT = { key: 'salt', label: 'Salt deposits', labelNe: 'भित्तामा नुनको सेतो दाग', type: 'CHOICE', options: ['None', 'Light', 'Heavy'], flag: { values: ['Heavy'] } };

  it('one Nepali word per option, on a choice only — and the surveyor gets them with the checklist', async () => {
    const sales = await as('SALES');
    const bad = async (questions) => expectStatus(await sales.post('/admin/inspection-templates').send({ name: `Bad ${uid()}`, questions }), 400);
    await bad([{ ...SALT, optionsNe: ['छैन', 'थोरै'] }]);
    await bad([{ key: 'note', label: 'Note', type: 'TEXT', optionsNe: ['एक', 'दुई'] }]);

    const service = await prisma.service.create({ data: { name: `J1 service ${uid()}`, slug: uid('j1-svc-'), excerpt: 'Test service' } });
    const template = expectStatus(await sales.post('/admin/inspection-templates').send({
      serviceId: service.id, name: `Nepali choices ${uid()}`, questions: [{ ...SALT, optionsNe: ['छैन', 'थोरै', 'धेरै'] }],
    }), 201).data;
    expect(template.questions[0]).toMatchObject({ options: ['None', 'Light', 'Heavy'], optionsNe: ['छैन', 'थोरै', 'धेरै'] });

    const surveyor = await as('SURVEYOR');
    const { job } = await createAssignedJob({ assignee: 'SURVEYOR', type: 'INSPECTION' });
    const survey = expectStatus(await surveyor.post(`/tech/jobs/${job.id}/survey`).send({}), 201).data;
    await prisma.siteSurvey.update({ where: { id: survey.id }, data: { serviceId: service.id } });
    const body = expectStatus(await surveyor.get(`/tech/surveys/${survey.id}`), 200).data;
    expect(body.template.questions[0]).toMatchObject({ labelNe: SALT.labelNe, optionsNe: ['छैन', 'थोरै', 'धेरै'] });
  });
});

describe("a Nepali customer's messages", () => {
  let sales;
  beforeAll(async () => { sales = await as('SALES'); });

  const logOf = (relatedId, templateKey, channel) => prisma.messageLog.findFirst({ where: { relatedId, templateKey, channel } });

  it('the quotation SMS and email: Nepali words, रु. and the valid-until date in Bikram Sambat', async () => {
    const customer = expectStatus(await sales.post('/admin/customers').send({
      name: 'सीता श्रेष्ठ', phone: phone(), email: `sita.${uid()}@example.com`, preferredLocale: 'ne',
    }), 201).data;
    const draft = expectStatus(await sales.post('/admin/quotations').send({
      customerId: customer.id, items: [{ description: 'छत वाटरप्रुफिङ', qty: 1, rate: 125000 }],
    }), 201).data;
    const sent = await approveAndSend(draft.id);

    const sms = await logOf(draft.id, 'quotation_sent', 'sms');
    expect(sms.body).toContain('तपाईंको कोटेसन');
    expect(sms.body).toMatch(/रु\. 1,41,250\.00/);
    expect(sms.body).not.toContain('Rs.');
    const mail = await logOf(draft.id, 'quotation_sent', 'email');
    expect(mail.subject).toContain('कोटेसन');
    expect(mail.body).toContain(`${customerDate(sent.validUntil ?? (await prisma.quotation.findUnique({ where: { id: draft.id } })).validUntil, 'ne')} सम्म मान्य`);
  });

  it('an English customer keeps English, Rs. and the AD date', async () => {
    const customer = expectStatus(await sales.post('/admin/customers').send({
      name: 'Ram English', phone: phone(), email: `ram.${uid()}@example.com`, preferredLocale: 'en',
    }), 201).data;
    const draft = expectStatus(await sales.post('/admin/quotations').send({
      customerId: customer.id, items: [{ description: 'Terrace waterproofing', qty: 1, rate: 125000 }],
    }), 201).data;
    await approveAndSend(draft.id);
    const { validUntil } = await prisma.quotation.findUnique({ where: { id: draft.id } });
    expect((await logOf(draft.id, 'quotation_sent', 'sms')).body).toMatch(/^Quotation .* for Rs\. 1,41,250\.00 is ready/);
    expect((await logOf(draft.id, 'quotation_sent', 'email')).body).toContain(`Valid until ${customerDate(validUntil, 'en')}.`);
    expect(customerDate(validUntil, 'en')).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
  });

  it('the invoice SMS and email: बिल, रु. and the due date in Bikram Sambat', async () => {
    const accountant = await as('ACCOUNTANT');
    const { job, customer } = await createCompletedJob({ withMaterial: true });
    await prisma.customer.update({ where: { id: customer.id }, data: { preferredLocale: 'ne', email: `inv.${uid()}@example.com` } });
    const invoice = expectStatus(await accountant.post(`/admin/invoices/from-job/${job.id}`).send({}), 201).data;
    expectStatus(await accountant.post(`/admin/invoices/${invoice.id}/send`), 200);
    const { dueDate, total } = await prisma.invoice.findUnique({ where: { id: invoice.id } });

    const sms = await logOf(invoice.id, 'invoice_sent', 'sms');
    expect(sms.body).toMatch(/^बिल /);
    expect(sms.body).toContain(`${customerDate(dueDate, 'ne')} भित्र तिर्नुहोस्`);
    expect(sms.body).toContain(`रु. ${(total / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    const mail = await logOf(invoice.id, 'invoice_sent', 'email');
    expect(mail.subject).toContain('बिल');
    expect(mail.body).toContain('आदरणीय');
  });
});
