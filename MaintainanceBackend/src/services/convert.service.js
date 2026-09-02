import { prisma } from '../lib/prisma.js';
import { notFound, unprocessable } from '../utils/AppError.js';
import { findOrCreateByPhone } from './customer.service.js';
import { createJob } from './job.service.js';
import { nextNumber } from '../utils/numbering.js';

/**
 * Lead -> Customer (+ Site) -> optionally a draft Quotation and/or an inspection Job.
 * One transaction boundary per artifact so a partial failure leaves nothing dangling.
 */
export async function convertLead(leadId, input, userId) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, include: { service: true } });
  if (!lead) throw notFound('Lead');
  if (lead.customerId && !input.createQuotation && !input.createInspectionJob) {
    throw unprocessable('This lead is already linked to a customer');
  }

  let customer;
  let site;

  if (input.customerId) {
    customer = await prisma.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
    if (!customer) throw notFound('Customer');
    site = await prisma.customerSite.findFirst({ where: { customerId: customer.id, deletedAt: null, isPrimary: true } });
  } else {
    ({ customer, site } = await findOrCreateByPhone({
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      address: input.site?.address ?? lead.address,
      area: input.site?.area ?? lead.area,
      siteLabel: input.site?.label,
    }));
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { customerId: customer.id, status: lead.status === 'NEW' ? 'CONTACTED' : lead.status, firstResponseAt: lead.firstResponseAt ?? new Date() },
  });

  const result = { customer, site, quotation: null, job: null };

  if (input.createQuotation) {
    result.quotation = await prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, 'QT');
      return tx.quotation.create({
        data: {
          number,
          customerId: customer.id,
          siteId: site?.id ?? null,
          leadId,
          createdById: userId ?? null,
          items: {
            create: [{
              description: lead.service?.name ?? lead.message?.slice(0, 200) ?? 'Site work',
              unit: lead.service?.priceUnit ?? 'lump',
              qty: 1,
              rate: lead.service?.priceFrom ?? 0,
              amount: lead.service?.priceFrom ?? 0,
              sortOrder: 0,
            }],
          },
          subtotal: lead.service?.priceFrom ?? 0,
          total: lead.service?.priceFrom ?? 0,
        },
        include: { items: true },
      });
    });
    await prisma.lead.update({ where: { id: leadId }, data: { status: 'QUOTED' } });
  }

  if (input.createInspectionJob) {
    result.job = await createJob({
      type: 'INSPECTION',
      customerId: customer.id,
      siteId: site?.id ?? null,
      leadId,
      title: `Free inspection — ${lead.service?.name ?? 'site visit'}`,
      description: lead.message ?? null,
      priority: lead.priority,
      scheduledStart: input.scheduledStart,
      isBillable: false,
    }, userId);
    await prisma.lead.update({ where: { id: leadId }, data: { status: 'INSPECTION_SCHEDULED' } });
  }

  await prisma.leadActivity.create({
    data: {
      leadId, userId: userId ?? null, type: 'note',
      summary: `Converted to customer ${customer.name}` +
        (result.quotation ? ` · quotation ${result.quotation.number}` : '') +
        (result.job ? ` · job ${result.job.number}` : ''),
    },
  });

  return result;
}
