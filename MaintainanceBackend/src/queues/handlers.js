import { registerHandler } from './index.js';
import { runSlaSweep } from '../services/sla.service.js';
import { sweepOverdue } from '../services/invoice.service.js';
import { expireQuotations } from '../services/quotation.service.js';
import { sweepExpired, sweepContracts, materialiseAmcVisits, dispatchReminders, scheduleFollowUp } from '../services/warranty.service.js';
import { runFollowUps, runStaleSweep } from '../services/pipeline.service.js';
import { runVisitReminders } from '../services/visit.service.js';

// runJob logs { task, durationMs, count } for each of these when it finishes.
registerHandler('sla:sweep', async () => runSlaSweep());
registerHandler('invoice:sweepOverdue', async () => sweepOverdue());
registerHandler('quotation:expire', async () => expireQuotations());
registerHandler('warranty:sweepExpired', async () => sweepExpired());
registerHandler('amc:sweepContracts', async () => sweepContracts());
registerHandler('amc:materialiseVisits', async () => materialiseAmcVisits());
registerHandler('reminders:dispatch', async () => dispatchReminders());
registerHandler('leads:followups', async () => runFollowUps());
registerHandler('pipeline:stale', async () => runStaleSweep());
registerHandler('visits:remind', async () => runVisitReminders());
registerHandler('job:scheduleFollowUp', async ({ jobId }) => scheduleFollowUp(jobId));
