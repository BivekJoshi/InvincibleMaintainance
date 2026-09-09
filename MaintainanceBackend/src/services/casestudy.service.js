import { prisma } from '../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../utils/AppError.js';
import { uniqueSlug } from '../utils/slug.js';
import { invalidatePublic } from './cache.service.js';

/**
 * Publishing a finished job as a public case study.
 *
 * This is the "past records for similar problems" a customer reads before
 * booking, and it is fed by real work rather than written from scratch — the
 * survey supplies the problem and the recommendation, the job supplies the
 * duration and the before/after photos.
 *
 * Two rules protect the customer whose job this was: their name is omitted
 * unless someone explicitly opts in, and the money is published as a widened
 * band, never as their actual contract value.
 */

/** Widens a figure to a ±20% band and rounds outward to a clean 1,000 rupees. */
function costBand(totalPaisa) {
  if (!totalPaisa) return { costBandMin: null, costBandMax: null };
  const step = 100_000; // Rs 1,000 in paisa
  return {
    costBandMin: Math.max(0, Math.floor((totalPaisa * 0.8) / step) * step),
    costBandMax: Math.ceil((totalPaisa * 1.2) / step) * step,
  };
}

/** Full days between two instants, floored at 1 — a same-day job took a day. */
function durationDays(start, end) {
  if (!start || !end) return null;
  return Math.max(1, Math.round((new Date(end) - new Date(start)) / 86_400_000));
}

export async function publishJobAsCaseStudy(jobId, input = {}, userId) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    include: {
      customer: { select: { name: true } },
      site: { select: { area: true, address: true } },
      lead: { select: { serviceId: true, service: { select: { id: true, name: true, categoryId: true } } } },
      survey: { select: { problemSummary: true, diagnosis: true, recommendation: true, areaValue: true, areaUnit: true } },
      photos: { where: { kind: { in: ['BEFORE', 'AFTER'] } }, orderBy: { createdAt: 'asc' } },
      caseStudy: { select: { id: true, slug: true } },
      invoiceItems: { select: { amount: true } },
    },
  });
  if (!job) throw notFound('Job');
  if (!['COMPLETED', 'VERIFIED'].includes(job.status)) {
    throw unprocessable(`Job ${job.number} is ${job.status.toLowerCase()} — only finished work becomes a case study`);
  }
  if (job.caseStudy) {
    throw conflict('This job has already been published as a case study', { projectId: job.caseStudy.id });
  }

  const service = job.lead?.service ?? null;
  const title = input.title ?? `${service?.name ?? job.title}${job.site?.area ? ` — ${job.site.area}` : ''}`;
  const invoiced = job.invoiceItems.reduce((total, i) => total + i.amount, 0);
  const band = input.costBandMin != null || input.costBandMax != null
    ? { costBandMin: input.costBandMin ?? null, costBandMax: input.costBandMax ?? null }
    : costBand(invoiced);

  const images = input.imageIds?.length
    ? input.imageIds.map((mediaId, i) => ({ mediaId, sortOrder: i }))
    : job.photos.map((p, i) => ({ mediaId: p.mediaId, caption: p.kind === 'BEFORE' ? 'Before' : 'After', sortOrder: i }));

  const project = await prisma.project.create({
    data: {
      title,
      slug: await uniqueSlug(prisma, 'project', input.slug ?? title),
      jobId,
      serviceId: service?.id ?? null,
      categoryId: service?.categoryId ?? null,
      // Named only on an explicit opt-in.
      clientName: input.includeClientName ? job.customer?.name ?? null : null,
      location: job.site?.area ?? null,
      status: 'completed',
      problem: input.problem ?? job.survey?.problemSummary ?? job.description ?? null,
      solution: input.solution ?? job.survey?.recommendation ?? job.completionNote ?? null,
      outcome: input.outcome ?? job.completionNote ?? null,
      summary: job.survey?.diagnosis ?? null,
      durationDays: durationDays(job.actualStart, job.actualEnd),
      ...band,
      coverId: images[0]?.mediaId ?? null,
      completedAt: job.actualEnd,
      publishedAt: input.isActive ? new Date() : null,
      isActive: input.isActive ?? false,
      ...(images.length ? { images: { create: images } } : {}),
    },
    include: { images: { orderBy: { sortOrder: 'asc' } }, service: { select: { id: true, name: true, slug: true } } },
  });

  await invalidatePublic();
  return project;
}
