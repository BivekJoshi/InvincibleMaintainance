import { JOB_TRANSITIONS } from '@/config/constants';

/**
 * What may be done to a job now, and by whom — the single table the job detail's action bar
 * and the jobs list's row menu both read. The API asserts every move; this only decides what
 * is offered, and says why an offered action is disabled.
 *
 * Status moves go through `PATCH /status` (`to`), except completion (`complete`, which takes a
 * sign-off) and verification (`verify`). Scheduling and assigning have their own endpoints.
 *
 * @typedef {object} JobAction
 * @property {string} key       schedule | assign | status | complete | verify | publish | openCaseStudy | delete
 * @property {string} label
 * @property {string} [to]      the status a `status` action moves to
 * @property {boolean} [note]   asks why first (hold, cancel, reopen)
 * @property {boolean} [noteRequired]
 * @property {boolean} [primary]
 * @property {boolean} [destructive]
 * @property {string} [disabledReason]
 */

const CLOSED = ['COMPLETED', 'VERIFIED', 'CANCELLED'];
const SCHEDULABLE = ['DRAFT', 'SCHEDULED', 'ASSIGNED', 'ON_HOLD'];

const allowed = (from, to) => (JOB_TRANSITIONS[from] ?? []).includes(to);

/** The checklist items still open (neither done nor skipped). */
export const openTasks = (job) => (job?.tasks ?? []).filter((t) => !t.isDone && !t.isSkipped);

/**
 * @param {object} job  as `GET /admin/jobs/:id` returns it (a list row works too; the
 *   checklist rule then reads what the row carries)
 * @param {{ can: (capability: string) => boolean }} ctx
 * @returns {JobAction[]}
 */
export function jobActions(job, { can }) {
  if (!job) return [];
  const { status } = job;
  const people = job.assignments?.length ?? 0;
  const actions = [];
  const write = can('jobs:write');
  const dispatch = can('jobs:dispatch');

  if (dispatch && SCHEDULABLE.includes(status)) {
    actions.push({
      key: 'schedule',
      label: job.scheduledStart ? 'Reschedule' : 'Schedule',
      primary: status === 'DRAFT' || status === 'ON_HOLD' || !job.scheduledStart,
    });
  }
  if (dispatch && !CLOSED.includes(status) && !['EN_ROUTE', 'IN_PROGRESS'].includes(status)) {
    actions.push({ key: 'assign', label: people ? 'Change technicians' : 'Assign technicians' });
  }

  if (write) {
    if (allowed(status, 'EN_ROUTE')) {
      actions.push({
        key: 'status', to: 'EN_ROUTE', label: 'Mark on the way',
        ...(people ? {} : { disabledReason: 'Assign a technician first' }),
      });
    }
    if (allowed(status, 'IN_PROGRESS') && status !== 'COMPLETED') {
      actions.push({
        key: 'status', to: 'IN_PROGRESS', label: status === 'ON_HOLD' ? 'Resume work' : 'Start work',
        primary: status === 'EN_ROUTE',
        ...(people ? {} : { disabledReason: 'Assign a technician first' }),
      });
    }
    if (allowed(status, 'COMPLETED')) {
      const open = openTasks(job).length;
      actions.push({
        key: 'complete', label: 'Complete', primary: true,
        ...(open ? { disabledReason: `${open} checklist item${open === 1 ? ' is' : 's are'} still open` } : {}),
      });
    }
    if (allowed(status, 'VERIFIED')) actions.push({ key: 'verify', label: 'Verify', primary: true });
    if (status === 'COMPLETED') {
      actions.push({ key: 'status', to: 'IN_PROGRESS', label: 'Reopen', note: true });
    }
    if (allowed(status, 'ON_HOLD')) {
      actions.push({ key: 'status', to: 'ON_HOLD', label: 'Put on hold', note: true, noteRequired: true });
    }
  }

  if (['COMPLETED', 'VERIFIED'].includes(status) && can('cms:write')) {
    actions.push(job.project
      ? { key: 'openCaseStudy', label: 'Open case study' }
      : { key: 'publish', label: 'Publish case study' });
  }

  if (write && allowed(status, 'CANCELLED')) {
    actions.push({ key: 'status', to: 'CANCELLED', label: 'Cancel job', note: true, noteRequired: true, destructive: true });
  }
  if (write && ['DRAFT', 'CANCELLED'].includes(status)) {
    actions.push({ key: 'delete', label: 'Delete', destructive: true });
  }
  return actions;
}

/** A line under the job's title: what it is waiting for. */
export function jobWaitingFor(job) {
  if (!job) return '';
  const people = job.assignments?.length ?? 0;
  switch (job.status) {
    case 'DRAFT': return people ? 'Waiting for a date' : 'Waiting for a date and a technician';
    case 'SCHEDULED': return people ? 'Scheduled' : 'Scheduled — nobody is on it yet';
    case 'ASSIGNED': return job.scheduledStart ? 'Waiting for the technician to set off' : 'Assigned — waiting for a date';
    case 'EN_ROUTE': return 'The technician is on the way';
    case 'IN_PROGRESS': return openTasks(job).length ? `Work under way · ${openTasks(job).length} checklist item(s) open` : 'Work under way · checklist done';
    case 'ON_HOLD': return job.holdReason ? `On hold: ${job.holdReason}` : 'On hold';
    case 'COMPLETED': return job.invoicedAt ? 'Completed and invoiced — waiting for verification' : 'Completed — waiting for verification';
    case 'VERIFIED': return job.invoicedAt || !job.isBillable ? 'Verified' : 'Verified — not invoiced yet';
    case 'CANCELLED': return job.cancelReason ? `Cancelled: ${job.cancelReason}` : 'Cancelled';
    default: return '';
  }
}

/** Google Maps for a site: its pin when it has one, else its address. */
export function siteMapHref(site) {
  if (!site) return null;
  if (site.lat != null && site.lng != null) return `https://www.google.com/maps/search/?api=1&query=${site.lat},${site.lng}`;
  const where = [site.address, site.area].filter(Boolean).join(', ');
  return where ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}` : null;
}
