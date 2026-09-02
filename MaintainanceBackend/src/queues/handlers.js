import { registerHandler } from './index.js';
import { runSlaSweep } from '../services/sla.service.js';
import { sweepOverdue } from '../services/invoice.service.js';
import { sweepExpired, sweepContracts, materialiseAmcVisits, dispatchReminders, scheduleFollowUp } from '../services/warranty.service.js';
import { logger } from '../lib/logger.js';

registerHandler('sla:sweep', async () => {
  const result = await runSlaSweep();
  logger.info(result, 'SLA sweep complete');
  return result;
});

registerHandler('invoice:sweepOverdue', async () => {
  const result = await sweepOverdue();
  logger.info(result, 'overdue invoice sweep complete');
  return result;
});

registerHandler('warranty:sweepExpired', async () => sweepExpired());
registerHandler('amc:sweepContracts', async () => sweepContracts());
registerHandler('amc:materialiseVisits', async () => materialiseAmcVisits());
registerHandler('reminders:dispatch', async () => dispatchReminders());
registerHandler('job:scheduleFollowUp', async ({ jobId }) => scheduleFollowUp(jobId));
