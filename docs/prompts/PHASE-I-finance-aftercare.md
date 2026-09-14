# Phase I — Finance & aftercare screens

~6 days · branch `admin/phase-i-finance-aftercare` · requires Phase H2 done

````text
You are working in the InvincibleMaintainance repo. This is Phase I of docs/ADMIN-PLAN.md: screens
for invoicing, payments, expenses and financial reports (ACCOUNTANT), aftercare — warranties,
claims, AMC contracts, service reminders — and the sales/ops reports the API already serves.
Money is where this system breaks; treat every number as a test case.

READ FIRST
- CLAUDE.md (money = integer paisa; only utils/money.js does arithmetic on it; VAT 13% computed
  once at document level), MaintainanceFrontend/src/STRUCTURE.md, docs/ADMIN-PLAN.md §5 Phase I,
  docs/PLAN.md Phases 8–10, docs/API.md "Admin — Finance", "Admin — Aftercare", platform reports
- Backend: src/routes/admin/finance.routes.js, aftercare.routes.js (uses role lists, not
  capabilities), src/services/invoice.service.js (incl. Phase A payment void), warranty.service.js,
  report.service.js, src/utils/money.js, nepaliDate.js, numbering.js, src/shared/permissions.js,
  tests/api/07-finance.test.js, 08-aftercare.test.js
- Frontend: src/helpers/format.js, src/components/documents/* (shared by public token pages),
  src/pages/public/InvoicePublicPage/*, WarrantyPublicPage/*, src/pages/admin/DashboardPage.jsx

RULES
- Kit only. Displayed totals always come from the server; the UI never recomputes VAT or totals.
- Dates: AD stored, Asia/Kathmandu display; show BS alongside AD on financial documents and
  reports (nepaliDate helpers — mirror or expose from the API, do not reimplement conversion).
- aftercare.routes.js: replace hard-coded role lists with capabilities (warranties:read/write,
  amc:read/write, …) in permissions.js, keeping today's effective access; permissions unit test +
  API RBAC tests.
- Report CSV export: generated server-side with the current filters (add ?format=csv to report
  endpoints), audited as export.csv (Phase B). Never unbounded.
- Customer-facing messages (invoice sent, overdue reminders, service reminders, warranty) use the
  customer's preferredLocale (Phase E).
- Tests first for backend changes. Post the plan first.

FINANCE

I1 · Invoices list — status tabs (Draft, Sent, Partial, Overdue, Paid, Void), filters customer,
date range, overdue only; columns number, customer, issued (AD + BS), due, total, paid, balance.
"Create from job" picks a completed, not-yet-invoiced job (POST /from-job/:jobId); manual create
for ADMIN.

I2 · Invoice detail — the document rendered with components/documents (same look as the public
page), editable only in DRAFT (lines, discount, VAT toggle, due date, note, terms); actions Send
(shows public link), Void (reason), Record payment sheet (amount rupees ≤ balance, method CASH /
BANK / ESEWA / KHALTI / FONEPAY / CHEQUE, reference, receivedAt), payment list with Void payment
(reason) showing voided rows struck through, History tab, print.

I3 · Payments — /admin/finance/payments: search by reference / invoice number / customer, method
filter, date range, totals by method in the footer (server-provided).

I4 · Expenses — registry: category, amount (money), job relation, vendor, bill photo (media),
spentAt, approvedBy, note.

I5 · Reports — /admin/finance/reports: Aging (0–30/31–60/61–90/90+ with drill-down to invoices),
Revenue (groupBy service|month|technician), Collections (by method, date range), Customer
statement (from the customer page too). Charts only where they add meaning; tables always present.
CSV export on each.

AFTERCARE

I6 · Warranties — list (status, expiring in N days), detail (job, customer, scope, dates, public
certificate link, claims), edit scope / void with reason.

I7 · Claims queue — open claims first; decide: accept (schedule start → creates the free WARRANTY
job linked to the original; link to it), reject (reason), resolve. Claim rate per service shown
from the warranty-claims report.

I8 · AMC contracts — list with renewals due in 60 days preset; create sheet (customer + site,
plan name, covered services, start/end, visits per year, amount, billing cycle) with a preview of
the visit schedule before saving; detail with visits (due date, status, linked job) and renew
action (new contract prefilled).

I9 · Service reminders — list pending/sent/failed, create/edit (pending only), delete, channel,
message with SMS segment counter (reuse Phase G helper).

REPORTS (sales & ops)

I10 · /admin/reports: lead sources, funnel, SLA compliance (reports:sales); job margin,
technician productivity, warranty claims (reports:ops); date range filter + CSV; dashboard cards
that were "soon" now link here and to the new finance/aftercare pages.

TESTS
API: capability-based aftercare RBAC unchanged in effect; CSV export respects filters and is
audited. vitest — money display fixtures against hand-computed values: 3 lines × 210.5 sq.ft with a
discount and 13% VAT (the README fixture), a partial payment then void, balance never negative,
Nepali number grouping (1,23,45,678.90) and BS date display for a Shrawan 1 fiscal-year boundary.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npm run lint
  cd MaintainanceFrontend && npm test && npm run lint && npm run build
Manual: as accounts@gharjatan.com.np invoice the job completed in Phase H, send it, record a
partial eSewa payment, void it, record two payments to settle → PAID; aging and collections
reflect it; export CSV. As dispatch@gharjatan.com.np accept a warranty claim from the public
warranty page → free WARRANTY job appears unassigned. Create an AMC contract and confirm the visit
schedule.

ACCEPTANCE (ADMIN-PLAN Phase I = v1 Phase 8/9 UI)
Job → invoice with real materials and labour, partial payment recorded and voidable, aging correct,
VAT reconciles to the paisa with the server; warranty claim → free job; AMC schedules visits; every
report viewable and exportable by the right roles only.

GIT
- Work on a local branch `admin/phase-i-finance-aftercare` created from DEVELOPMENT.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase H2's work is present on DEVELOPMENT (its files and migrations
  exist). If it is not, STOP and tell me.
- Do NOT push, open a pull request or merge. I review the work and handle git myself.

DOCS — part of the definition of done; update them together with the code they describe (in the same commit), not at the end
Always:
- docs/ADMIN-PLAN.md — mark this phase ✅ with the date in the §6 timeline, tick the §3 defects it
  closed, and add a "Deviations" note under the phase for anything built differently from the plan
  (what and why).
- STATUS.md — move this phase into "Done", update "Next", and record the verification results
  (test counts, manual walk-through outcome).
- docs/API.md — every endpoint added, changed or removed: method, path, capability, request body,
  response shape, error codes. The doc must match what is mounted.
- docs/DATA-MODEL.prisma — mirror every prisma/schema.prisma change (CLAUDE.md rule 2).
- .env.example + MaintainanceBackend/README.md / MaintainanceFrontend/README.md — every new env var,
  npm script, dependency or seeded login.
- MaintainanceFrontend/src/STRUCTURE.md — every new folder, shared component, convention or rule.
- CLAUDE.md — only if a convention or a "decision already made" changed; call it out in the report.
This phase specifically:
- docs/API.md: capability names on aftercare routes, ?format=csv on reports.
- MaintainanceBackend/README.md roles table / permissions notes.
- STRUCTURE.md: money and BS-date display helpers and their tests.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Screens, capability changes, test counts including the money fixtures, manual results, follow-ups.
Do not start Phase J.
````
