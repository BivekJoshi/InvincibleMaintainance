import { prisma } from '../lib/prisma.js';
import { AppError, notFound, unprocessable } from '../utils/AppError.js';
import { toRupees } from '../utils/money.js';
import { customersWithPhone, siteForConvert } from './customer.service.js';
import { createJob, announceAssignment } from './job.service.js';
import { createFromJob } from './survey.service.js';
import { createQuotation } from './quotation.service.js';
import { transitionLead } from './lead.service.js';
import { recordEvent } from './audit.service.js';

/** Funnel order. Convert only ever moves a lead forward along it, never back. */
const FUNNEL = ['NEW', 'CONTACTED', 'INSPECTION_SCHEDULED', 'QUOTED', 'WON'];
// Converting a LOST lead means it is being worked again, so it starts from the top.
const funnelRank = (status) => (status === 'LOST' ? 0 : FUNNEL.indexOf(status));

/**
 * Existing customers this lead could be — same phone — for the convert dialogs.
 * @returns {Promise<object[]>} see `customersWithPhone`
 */
export async function customerMatches(leadId) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null } });
  if (!lead) throw notFound('Lead');
  return customersWithPhone([lead.phone, lead.altPhone].filter(Boolean));
}

/**
 * Which customer the lead becomes, inside the convert transaction.
 *
 * A phone number is shared (families, tenants) and recycled, so it is never enough
 * to pick a customer on its own:
 * - a lead already linked keeps its customer (a second convert adds a visit or a quote);
 * - `customerId` is staff saying "same person";
 * - `createNewCustomer` is staff saying "different person" — a new customer, even with
 *   the same phone;
 * - neither, and a customer has this phone: 409 CUSTOMER_MATCH with the candidates;
 * - neither, and nobody has it: a new customer.
 *
 * The lead's email lands on an existing customer only with `confirmEmail`, and then as
 * the audited `customer.email_confirmed`. A new customer takes the lead's email and language.
 */
async function resolveCustomer(tx, lead, input) {
  const linkedId = !input.customerId && !input.createNewCustomer ? lead.customerId : null;
  const existingId = input.customerId ?? linkedId;

  if (existingId) {
    let customer = await tx.customer.findFirst({ where: { id: existingId, deletedAt: null } });
    if (!customer) throw notFound('Customer');
    const patch = {};
    if (input.preferredLocale && input.preferredLocale !== customer.preferredLocale) {
      patch.preferredLocale = input.preferredLocale;
    }
    const newEmail = input.confirmEmail && lead.email && lead.email !== customer.email ? lead.email : null;
    if (newEmail) patch.email = newEmail;
    if (Object.keys(patch).length) {
      const before = customer;
      customer = await tx.customer.update({ where: { id: customer.id }, data: patch });
      if (newEmail) {
        await recordEvent('customer.email_confirmed', {
          model: 'Customer',
          recordId: customer.id,
          before: { email: before.email },
          after: { email: newEmail },
          meta: { leadId: lead.id },
        }, tx);
      }
    }
    return { customer, created: false };
  }

  if (!input.createNewCustomer) {
    const candidates = await customersWithPhone([lead.phone, lead.altPhone].filter(Boolean), tx);
    if (candidates.length) {
      throw new AppError(409, 'CUSTOMER_MATCH',
        'A customer already has this phone number. Choose whether this is the same person or a different one.',
        { candidates });
    }
  }

  const customer = await tx.customer.create({
    data: {
      name: lead.name,
      phone: lead.phone,
      altPhone: lead.altPhone ?? null,
      email: lead.email ?? null,
      preferredLocale: input.preferredLocale ?? lead.preferredLocale ?? 'en',
    },
  });
  return { customer, created: true };
}

/**
 * Lead -> Customer (+ Site) -> optionally a draft Quotation and/or an inspection Job
 * with its SiteSurvey.
 *
 * One transaction: the customer, the site, the lead's link and status, the
 * quotation, the job and the survey commit together or not at all. The surveyor's
 * SMS goes out only after the commit, so nobody is sent to a visit that rolled back.
 *
 * The lead moves forward through the state machine, one timeline entry per step:
 * NEW (or LOST) → CONTACTED → INSPECTION_SCHEDULED when a visit is booked → QUOTED
 * when a quotation is drafted. A lead already further along (or WON) is not moved back.
 */
export async function convertLead(leadId, input, userId) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, include: { service: true } });
  if (!lead) throw notFound('Lead');
  if (lead.customerId && !input.createQuotation && !input.createInspectionJob) {
    throw unprocessable('This lead is already linked to a customer');
  }

  const result = await prisma.$transaction(async (tx) => {
    const { customer, created } = await resolveCustomer(tx, lead, input);
    // The visit goes where staff said: an address typed here that the customer has no
    // site for becomes a site. With no address typed, the primary site (or the lead's address).
    const site = await siteForConvert(tx, customer.id, input.site
      ? { ...input.site, explicit: true }
      : { address: lead.address, area: lead.area, explicit: false });

    await tx.lead.update({
      where: { id: leadId },
      data: { customerId: customer.id, firstResponseAt: lead.firstResponseAt ?? new Date() },
    });

    const out = { customer, customerCreated: created, site, quotation: null, job: null, survey: null };

    if (input.createQuotation) {
      // Through createQuotation, so documentTotals stays the only place VAT is worked out.
      out.quotation = await createQuotation({
        customerId: customer.id,
        siteId: site?.id ?? null,
        leadId,
        items: [{
          description: lead.service?.name ?? lead.message?.slice(0, 200) ?? 'Site work',
          unit: lead.service?.priceUnit ?? 'lump',
          qty: 1,
          rate: toRupees(lead.service?.priceFrom ?? 0),
        }],
      }, userId, tx);
    }

    if (input.createInspectionJob) {
      // The visit the customer booked. Passing surveyorId assigns it and moves the
      // job to ASSIGNED; the SMS follows the commit, below.
      out.job = await createJob({
        type: 'INSPECTION',
        customerId: customer.id,
        siteId: site?.id ?? null,
        leadId,
        title: `Free inspection — ${lead.service?.name ?? 'site visit'}`,
        description: lead.message ?? null,
        priority: lead.priority,
        // Fall back to the slot the customer picked online rather than losing it.
        scheduledStart: input.scheduledStart ?? lead.preferredAt ?? undefined,
        scheduledEnd: input.scheduledEnd,
        isBillable: false,
        ...(input.surveyorId
          ? { technicianIds: [input.surveyorId], leadTechnicianId: input.surveyorId }
          : {}),
      }, userId, tx);

      // Created here rather than on the device: the number comes from a server-side
      // counter, so the field app cannot mint one offline. It downloads a real
      // survey id along with the job instead.
      const { survey } = await createFromJob(out.job.id, { surveyorId: input.surveyorId }, userId, tx);
      out.survey = survey;
    }

    const stages = ['CONTACTED', ...(out.job ? ['INSPECTION_SCHEDULED'] : []), ...(out.quotation ? ['QUOTED'] : [])];
    let { status } = lead;
    for (const stage of stages) {
      if (funnelRank(status) < funnelRank(stage)) {
        ({ status } = await transitionLead(tx, leadId, stage, { actorId: userId, note: 'Lead converted' }));
      }
    }

    await tx.leadActivity.create({
      data: {
        leadId, userId: userId ?? null, type: 'note',
        summary: `Converted to customer ${customer.name}` +
          (out.quotation ? ` · quotation ${out.quotation.number}` : '') +
          (out.job ? ` · job ${out.job.number}` : '') +
          (out.survey ? ` · survey ${out.survey.number}` : ''),
      },
    });

    await recordEvent('lead.converted', {
      model: 'Lead',
      recordId: leadId,
      before: { customerId: lead.customerId },
      after: { customerId: customer.id },
      meta: { quotationId: out.quotation?.id, jobId: out.job?.id, surveyId: out.survey?.id },
    }, tx);

    return out;
    // Several documents, each with its numbering row and audit write: more than
    // Prisma's 5s default on a slow CI runner.
  }, { timeout: 15_000 });

  if (result.job?.assignments?.length) {
    await announceAssignment(result.job, result.job.assignments.map((a) => a.technicianId));
  }
  return result;
}
