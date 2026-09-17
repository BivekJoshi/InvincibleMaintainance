import {
  Users, Timer, AlertTriangle, Briefcase, Receipt, ShieldCheck, RefreshCw,
  Boxes, FileCheck2, MessageSquareWarning, Send, Wrench, UserPlus, CalendarClock,
} from 'lucide-react';
import { ktmDay } from '@/helpers/dispatchBoard';

/** The jobs list's Today preset: Kathmandu's today, whenever the card is drawn. */
const todayQuery = () => `from=${ktmDay()}&to=${ktmDay()}`;

/**
 * The dashboard's stat tiles, keyed by the API's card names; the API decides which
 * a role gets. `tone` marks a count that is a problem when above zero — those also
 * feed the hero's "needs you" list, with `short` as their chip text. `soon` is a
 * card whose screen is not built yet: shown, dimmed, not linked. `cell` is the
 * shorter name used inside a group, where the group heading says the rest.
 */
export const DASHBOARD_CARDS = {
  leadsToday: { label: 'Leads today', icon: UserPlus, to: '/admin/leads', hint: 'New enquiries since midnight' },
  leadsOpen: { label: 'Open leads', icon: Users, to: '/admin/leads', hint: 'Not yet won or lost' },
  slaBreached: { label: 'SLA breached', short: 'past the 2-hour promise', icon: AlertTriangle, to: '/admin/sla', tone: 'danger', hint: 'Waited past the 2-hour promise' },
  slaAtRisk: { label: 'Response due soon', cell: 'Due soon', short: 'due for a call soon', icon: Timer, to: '/admin/sla', tone: 'warn', hint: 'Call before the clock runs out' },
  jobsToday: { label: 'Jobs today', icon: CalendarClock, to: () => `/admin/jobs?${todayQuery()}`, hint: 'On the calendar for today' },
  jobsOpen: { label: 'Open jobs', icon: Briefcase, to: '/admin/jobs', hint: 'Not finished or cancelled' },
  jobsUnassigned: { label: 'Unassigned jobs', short: 'jobs with nobody going', icon: AlertTriangle, to: '/admin/dispatch', tone: 'warn', hint: 'Nobody is going yet' },
  outstandingAmount: { label: 'Outstanding', icon: Receipt, to: '/admin/invoices', money: true, soon: true, hint: 'Invoiced, not yet paid' },
  outstandingInvoices: { label: 'Unpaid invoices', icon: Receipt, to: '/admin/invoices', soon: true, hint: 'Sent, partial or overdue' },
  warrantiesActive: { label: 'Active warranties', icon: ShieldCheck, to: '/admin/warranties', soon: true, hint: 'Still in cover' },
  amcRenewals: { label: 'AMC renewals due', icon: RefreshCw, to: '/admin/warranties', soon: true, hint: 'Ending within 60 days' },
  // Phase F: each opens its quotation queue.
  quotationsPendingApproval: { label: 'Quotations to approve', cell: 'To approve', short: 'quotations to approve', icon: FileCheck2, to: '/admin/quotations?stage=approval', tone: 'warn', hint: 'Waiting on a manager' },
  quotationsChangesRequested: { label: 'Customers asked for changes', cell: 'Changes asked', short: 'change requests', icon: MessageSquareWarning, to: '/admin/quotations?stage=changes_requested', tone: 'warn', hint: 'Revise and send again' },
  quotationsAwaitingCustomer: { label: 'Quotations with customers', cell: 'With customers', icon: Send, to: '/admin/quotations?stage=with_customer', hint: 'Sent, no answer yet' },
  // Phase H1: accepted quotations wait on the board's unassigned queue.
  acceptedJobsUnscheduled: { label: 'Accepted jobs to schedule', cell: 'Accepted, to book', short: 'accepted jobs to schedule', icon: Wrench, to: '/admin/dispatch', tone: 'warn', hint: 'Customer said yes — book it' },
  stockLow: { label: 'Materials to reorder', cell: 'Low stock', short: 'materials to reorder', icon: Boxes, to: '/admin/stock?lowOnly=true', tone: 'warn', hint: 'At or below reorder level' },
};

/**
 * How the numbers are grouped on the page. A group shows only the cards the API
 * sent, and disappears when it sent none of them.
 */
export const DASHBOARD_GROUPS = [
  { key: 'sales', label: 'Leads', cards: ['leadsToday', 'leadsOpen', 'slaBreached', 'slaAtRisk'] },
  { key: 'quotes', label: 'Quotations', cards: ['quotationsPendingApproval', 'quotationsChangesRequested', 'quotationsAwaitingCustomer', 'acceptedJobsUnscheduled'] },
  { key: 'ops', label: 'Jobs and stock', cards: ['jobsToday', 'jobsOpen', 'jobsUnassigned', 'stockLow'] },
  { key: 'money', label: 'Money and aftercare', cards: ['outstandingAmount', 'outstandingInvoices', 'warrantiesActive', 'amcRenewals'] },
];

/** A card's link, resolved now (some depend on today's date). */
export const cardHref = (def) => (typeof def.to === 'function' ? def.to() : def.to);
