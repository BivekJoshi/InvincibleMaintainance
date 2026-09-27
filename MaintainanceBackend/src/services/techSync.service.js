import { ZodError } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { badRequest, forbidden } from '../utils/AppError.js';
import { FIELD_ROLES } from '../shared/enums.js';
import { can } from '../shared/permissions.js';
import * as s from '../shared/schemas/ops.js';
import * as sv from '../shared/schemas/survey.js';
import * as jobs from './job.service.js';
import * as surveys from './survey.service.js';

/**
 * The field app's offline queue, replayed (POST /tech/sync). Mutations are applied in the order the
 * technician made them (`at`), each at most once: a key already applied answers `duplicate`, which is how a
 * device that resends after a lost response stays harmless. The key is remembered as a `TechSync` audit row.
 * A mutation that fails is reported and the batch carries on.
 *
 * @param {object[]} mutations  techSyncSchema's
 * @param {{ user: { id: string, role: string }, technician: { id: string } }} ctx
 */
export async function applySync(mutations, { user, technician }) {
  const results = [];
  const ordered = [...mutations].sort((a, b) => new Date(a.at) - new Date(b.at));

  for (const m of ordered) {
    const seen = await prisma.auditLog.findFirst({ where: { model: 'TechSync', recordId: m.idempotencyKey }, select: { id: true } });
    if (seen) {
      results.push({ idempotencyKey: m.idempotencyKey, status: 'duplicate' });
      continue;
    }
    try {
      if (FIELD_ROLES.includes(user.role)) {
        if (m.surveyId) await surveys.assertOwnSurvey(m.surveyId, technician.id);
        else await jobs.assertAssigned(m.jobId, technician.id);
      } else if (m.surveyId && !can(user.role, 'surveys:write')) {
        throw forbidden('You can read surveys but not change them');
      }

      switch (m.kind) {
        case 'status':
          await jobs.changeStatus(m.jobId, s.jobStatusSchema.parse(m.payload), user.id);
          break;
        case 'task':
          await jobs.updateTask(m.jobId, m.taskId, s.jobTaskUpdateSchema.parse(m.payload));
          break;
        case 'material':
          await jobs.addMaterial(m.jobId, s.jobMaterialSchema.parse(m.payload), user.id);
          break;
        // A timer keeps the times the technician tapped (`at`), not the time the queue synced.
        case 'time_start':
          await jobs.startTimer(m.jobId, technician.id, m.payload.note, m.at);
          break;
        case 'time_stop':
          await jobs.stopTimer(m.jobId, technician.id, m.payload.note, m.at);
          break;
        case 'complete':
          await jobs.completeJob(m.jobId, s.jobCompleteSchema.parse(m.payload), user.id);
          break;
        // saveDraft is a full replace, so replaying it lands on the same state.
        case 'survey_draft':
          await surveys.saveDraft(m.surveyId, sv.surveySaveSchema.parse(m.payload), { userId: user.id });
          break;
        // Not idempotent: a replay throws INVALID_TRANSITION (422), which the client must treat as
        // terminal success and drop, not retry forever.
        case 'survey_submit':
          await surveys.submitSurvey(m.surveyId, sv.surveySubmitSchema.parse(m.payload), { userId: user.id });
          break;
        default:
          throw badRequest(`Unknown mutation kind: ${m.kind}`);
      }
      await prisma.auditLog.create({
        data: {
          actorId: user.id, action: 'sync', model: 'TechSync', recordId: m.idempotencyKey,
          changes: { kind: m.kind, jobId: m.jobId ?? null, surveyId: m.surveyId ?? null },
        },
      });
      results.push({ idempotencyKey: m.idempotencyKey, status: 'applied' });
    } catch (err) {
      logger.warn({ err: err.message, mutation: m.kind, jobId: m.jobId, surveyId: m.surveyId }, 'sync mutation rejected');
      // A payload that fails its schema will fail every time: INVALID_MUTATION tells the phone to stop retrying.
      const code = err instanceof ZodError ? 'INVALID_MUTATION' : err.code ?? 'SYNC_FAILED';
      results.push({ idempotencyKey: m.idempotencyKey, status: 'failed', error: err.message, code });
    }
  }

  return {
    results,
    applied: results.filter((r) => r.status === 'applied').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    failed: results.filter((r) => r.status === 'failed').length,
  };
}
