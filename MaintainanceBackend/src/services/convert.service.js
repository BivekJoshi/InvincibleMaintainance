import { prisma } from '../lib/prisma.js';
import { notFound, unprocessable } from '../utils/AppError.js';
import { toRupees } from '../utils/money.js';
import { findOrCreateByPhone } from './customer.service.js';
import { createJob, announceAssignment } from './job.service.js';
import { createFromJob } from './survey.service.js';
import { createQuotation } from './quotation.service.js';
import { transitionLead } from './lead.service.js';

/** Funnel order. Convert only ever moves a lead forward along it, never back. */
const FUNNEL = ['NEW', 'CONTACTED', 'INSPECTION_SCHEDULED', 'QUOTED', 'WON'];
// Converting a LOST lead means it is being worked again, so it starts from the top.
const funnelRank = (status) => (status === 'LOST' ? 0 : FUNNEL.indexOf(status));

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
    let customer;
    let site;

    if (input.customerId) {
      customer = await tx.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
      if (!customer) throw notFound('Customer');
      site = await tx.customerSite.findFirst({ where: { customerId: customer.id, deletedAt: null, isPrimary: true } });
    } else {
      ({ customer, site } = await findOrCreateByPhone({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: input.site?.address ?? lead.address,
        area: input.site?.area ?? lead.area,
        siteLabel: input.site?.label,
      }, tx));
    }

    await tx.lead.update({
      where: { id: leadId },
      data: { customerId: customer.id, firstResponseAt: lead.firstResponseAt ?? new Date() },
    });

    const out = { customer, site, quotation: null, job: null, survey: null };

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

    return out;
    // Several documents, each with its numbering row and audit write: more than
    // Prisma's 5s default on a slow CI runner.
  }, { timeout: 15_000 });

  if (result.job?.assignments?.length) {
    await announceAssignment(result.job, result.job.assignments.map((a) => a.technicianId));
  }
  return result;
}
