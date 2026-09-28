import { JOB_TYPE_LABELS } from '@/config/constants';
import { addDaysTo, ktmDay } from '@/helpers/dispatchBoard';
import { formatDate, fromKathmanduParts } from '@/helpers/format';

/**
 * Aftercare's rules without a DOM (Phase I): how much warranty cover is left, what a claim may still become,
 * the claim rate that applies to a claim, a renewal's starting values, and why a reminder is locked. The API
 * holds every rule; these only decide what a screen offers and how it words it.
 */

const DAY_MS = 86_400_000;

/** Whole Kathmandu calendar days from one instant to another (negative when `to` is earlier). */
export function kathmanduDaysBetween(from, to) {
  return Math.round((Date.parse(`${ktmDay(to)}T00:00:00Z`) - Date.parse(`${ktmDay(from)}T00:00:00Z`)) / DAY_MS);
}

/**
 * What is left of a warranty's cover, by Kathmandu calendar day: `{ days, label, soon }` — "12 days left",
 * "Last day today", "Ended 03 Sept 2026". `soon` is within 30 days and not yet over.
 *
 * @param {{ endsAt?: string|null }} warranty
 * @param {Date} [now]
 */
export function coverLeft(warranty, now = new Date()) {
  if (!warranty?.endsAt) return null;
  const days = kathmanduDaysBetween(now, warranty.endsAt);
  const label = days < 0 ? `Ended ${formatDate(warranty.endsAt)}`
    : days === 0 ? 'Last day today'
      : `${days} day${days === 1 ? '' : 's'} left`;
  return { days, label, soon: days >= 0 && days <= 30 };
}

/**
 * "Ends in 23 days" / "Ends today" for an active contract ending within `withinDays` Kathmandu days, else null.
 *
 * @param {{ status: string, endDate: string }} contract
 * @param {number} withinDays
 * @param {Date} [now]
 */
export function contractEndsIn(contract, withinDays, now = new Date()) {
  if (contract?.status !== 'active' || !contract.endDate) return null;
  const days = kathmanduDaysBetween(now, contract.endDate);
  if (days < 0 || days > withinDays) return null;
  return days === 0 ? 'Ends today' : `Ends in ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * The customer's certificate link: the API's `publicUrl`, else built from the token on this origin.
 *
 * @param {{ publicUrl?: string|null, publicToken?: string|null }} warranty
 * @param {string} [origin]
 */
export function certificateUrl(warranty, origin = globalThis.location?.origin ?? '') {
  if (warranty?.publicUrl) return warranty.publicUrl;
  return warranty?.publicToken ? `${origin}/warranty/${warranty.publicToken}` : null;
}

/**
 * What a claim may still become (the API's rule — anything else is 422 CLAIM_DECIDED): accept or reject an
 * open claim; resolve an open or an accepted one. Nothing without `warranties:write`.
 *
 * @param {{ status: string }} claim
 * @param {(capability: string) => boolean} can
 * @returns {{ accept: boolean, reject: boolean, resolve: boolean }}
 */
export function claimDecisions(claim, can) {
  const write = Boolean(can?.('warranties:write'));
  const open = claim?.status === 'open';
  return {
    accept: write && open,
    reject: write && open,
    resolve: write && (open || claim?.status === 'accepted'),
  };
}

/** The service a claim's job did, when the API names it (`job.service` as a name or `{ name }`). */
export function claimService(claim) {
  const job = claim?.warranty?.job;
  const service = job?.service ?? job?.serviceName ?? claim?.service ?? null;
  return typeof service === 'string' ? service : service?.name ?? null;
}

/**
 * The claim rate that speaks for a claim, from `GET /admin/reports/warranty-claims`: its job's service when the
 * report and the claim both name it, else its job type, else every warranty.
 *
 * @param {{ totalWarranties: number, totalClaims: number, claimRate: number, byType?: object[], byService?: object[] }|undefined} report
 * @param {{ service?: string|null, type?: string|null }} of
 * @returns {{ scope: 'service'|'type'|'all', label: string, warranties: number, claims: number, claimRate: number }|null}
 */
export function claimRateFor(report, { service, type } = {}) {
  if (!report) return null;
  const pick = (row) => ({ warranties: row.warranties, claims: row.claims, claimRate: row.claimRate });
  const byService = service ? report.byService?.find((r) => r.service === service) : null;
  if (byService) return { scope: 'service', label: service, ...pick(byService) };
  const byType = type ? report.byType?.find((r) => r.type === type) : null;
  if (byType) return { scope: 'type', label: JOB_TYPE_LABELS[type] ?? type, ...pick(byType) };
  return {
    scope: 'all', label: 'All warranted work',
    warranties: report.totalWarranties ?? 0, claims: report.totalClaims ?? 0, claimRate: report.claimRate ?? 0,
  };
}

/**
 * A renewal's starting values (API shape — the amount stays in paisa; the form shows rupees): the same
 * customer, site, plan, services, visits, amount and billing cycle, starting the Kathmandu day after the
 * contract ends and running the same number of days.
 *
 * @param {object} contract  as `GET /admin/amc-contracts/:id` returns it
 */
export function renewalDefaults(contract) {
  const startDay = ktmDay(contract.startDate);
  const endDay = ktmDay(contract.endDate);
  const length = Math.max(1, Math.round((Date.parse(`${endDay}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`)) / DAY_MS));
  const nextStart = addDaysTo(endDay, 1);
  return {
    customerId: contract.customer?.id ?? contract.customerId,
    siteId: contract.site?.id ?? contract.siteId ?? null,
    planName: contract.planName,
    coveredServices: Array.isArray(contract.coveredServices) ? [...contract.coveredServices] : [],
    startDate: fromKathmanduParts(nextStart),
    endDate: fromKathmanduParts(addDaysTo(nextStart, length)),
    visitsPerYear: contract.visitsPerYear,
    amount: contract.amount,
    billingCycle: contract.billingCycle,
    notes: `Renewal of ${contract.number}`,
  };
}

/**
 * A contract's covered services matched to the catalogue's names, ignoring case (the seed's `plumbing` is the
 * catalogue's `Plumbing`), so a tick list does not show the same service twice. Anything the catalogue does not
 * list is kept as it was.
 *
 * @param {string[]|undefined} values
 * @param {string[]} names
 */
export function matchServices(values, names) {
  if (!Array.isArray(values)) return [];
  const byKey = new Map(names.map((n) => [n.trim().toLowerCase(), n]));
  return [...new Set(values.map((v) => byKey.get(String(v).trim().toLowerCase()) ?? v))];
}

/** Why a reminder cannot be changed or removed any more, or null while it is pending (the API's rule). */
export function reminderLock(reminder) {
  if (!reminder || reminder.status === 'pending') return null;
  return {
    sent: 'Already sent — it stays on the customer’s record.',
    failed: 'The provider refused it — it stays on record. Add a new reminder instead.',
    skipped: 'Skipped (no address on that channel) — it stays on record. Add a new reminder instead.',
  }[reminder.status] ?? 'Only a pending reminder can be changed.';
}
