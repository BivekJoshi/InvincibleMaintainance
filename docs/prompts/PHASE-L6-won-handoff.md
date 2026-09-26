# Phase L6 — Won → hand-off: job lines, requirements, the advance and its gate

~4 days · branch `admin/phase-l6-won-handoff` · requires Phase I done (and L5) · decisions L-D3 and L-D4 in ADMIN-PLAN §4

````text
You are working in the InvincibleMaintainance repo. This is Phase L6 of docs/ADMIN-PLAN.md §5 Phase L.
It runs after Phase I, because Phase I's invoice screen is where the advance payment is recorded. Today an
accepted quotation becomes a DRAFT job typed REPAIR with a template checklist, and nothing more. The
quoted lines never reach the job, so there is no material list and no plan, and no advance is asked for.
This phase makes "WON" hand over everything execution needs, in the one accept transaction. The job
cannot be scheduled until the advance is paid.

DECISIONS — DECIDED 2026-09-26, build exactly this
- L-D3 Advance: the quotation's payment schedule (L4) decides the advance. On Accept, the advance invoice
  for the ON_ACCEPT stage is created automatically. The job cannot be scheduled until that invoice is
  paid. A MANAGER or ADMIN may override, with a reason, and the override is audited.
- L-D4: a JobRequirement carries no rates. The Plan tab shows quantities to everyone who reads jobs; cost
  stays with costs:read.
- The job carries the plan: JobLine rows, from the quotation (and from variations in L7), and
  JobRequirement rows (material packs, labour days by trade). Service.jobType replaces the hardcoded
  REPAIR.
- Accept stays one transaction and stays idempotent. A double tap creates one job and one invoice.

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md ("Operations (Phase H1)"), docs/ADMIN-PLAN.md §4 (D3)
  and §5 Phases F, H, I and L (L6), docs/API.md "Admin — CRM" (accept, convert-to-job),
  "Admin — Operations" (scheduling, dispatch), "Admin — Finance", docs/ARCHITECTURE.md "State machines"
- Backend: src/services/quotation.service.js (openForAnswer ~535, claimAnswer ~550,
  winLeadOnAcceptance ~578, jobPlanFor ~608 with its hardcoded REPAIR, acceptQuotation ~648,
  markConverted ~803), src/services/job.service.js (createJob ~103, createJobFromQuotation ~185,
  changeStatus ~249, assignTechnicians ~412, scheduleJob ~792, listUnassigned ~720),
  src/services/invoice.service.js (createInvoice, sendInvoice, recordPayment, getByPublicToken; L0's
  paisa builder), src/services/boq.service.js (take-off, L3), src/services/material.service.js
  (stockBalances), src/utils/money.js (paymentSchedule), src/shared/stateMachines.js,
  src/shared/permissions.js (jobs:advance-override from L2), src/shared/enums.js (AUDIT_EVENTS),
  src/routes/admin/crm.routes.js (convert-to-job ~189), src/routes/admin/ops.routes.js,
  prisma/schema.prisma (Service, Job, Invoice, QuotationPaymentStage), prisma/seed-data.js
  (job.advanceGate, finance.advanceDueDays from L2)
- Tests: tests/api/13-quotation-approval.test.js, 15-operations-admin.test.js, 07-finance.test.js,
  tests/api/helpers.js
- Frontend: src/pages/admin/JobDetailPage/ (JobDetailPage.jsx, sections/*),
  src/pages/admin/DispatchBoardPage/UnassignedQueue.jsx, DispatchJobCard.jsx,
  src/components/jobs/ScheduleJobDialog.jsx, AssignJobDialog.jsx, src/helpers/jobActions.js,
  src/pages/public/InvoicePublicPage/, Phase I's invoice detail and Record payment sheet,
  src/config/admin/resources/services.jsx

RULES
- Money is integer paisa, and only src/utils/money.js does arithmetic on it. The advance invoice's total
  must equal paymentSchedule's ON_ACCEPT stage amount to the paisa. If documentTotals can disagree with
  the stage VAT, fix it in money.js, not in the service.
- One transaction for the hand-off. Read the library, templates and service before it opens. Inside it,
  guard every step with compare-and-swap or unique indexes, so a replay does nothing twice.
- Job status changes only through JOB_TRANSITIONS and the schedule/status/assign endpoints.
- The advance_due SMS uses the customer's preferredLocale, en and ne, with the amount formatted by
  formatNpr.
- Keep enum migrations separate from any data migration that uses the new values.
- Kit only. Drag is never the only way (H1 rule).
- Tests first for backend changes. Post the plan first: migrations, the transaction's step list, the
  unique indexes that make it idempotent, and the gate's rules.
- Update the docs in the same change.

TASKS

L6.1 · Schema (one migration per logical change)
- Service gains jobType (JobType), shown on the services registry entry.
- Job gains plannedDays, advanceInvoiceId (unique), advanceOverrideById, advanceOverrideReason and
  advanceOverriddenAt.
- New JobLine: jobId, source (QUOTATION | VARIATION), quotationItemId, section, description, unit,
  quotedQty, rate (paisa), measurements, measuredQty, progressPct, isProvisional and sortOrder, with a
  unique (jobId, quotationItemId). measuredQty and progressPct are filled in L7 and L8.
- New JobRequirement: jobId, kind (MATERIAL | LABOUR), materialId or tradeId, qty, packs and source. It
  has no rates.
- Invoice gains kind (STANDARD | ADVANCE | RUNNING | FINAL, default STANDARD), jobId, and
  paymentStageId @unique, so a stage is billed once.

L6.2 · handoff.service.js
- New src/services/handoff.service.js. It absorbs createJobFromQuotation (job.service.js ~185), so a staff
  convert also wins the lead. Keep POST /admin/quotations/:id/convert-to-job working and idempotent.
- Inside the existing accept transaction (acceptQuotation, quotation.service.js:648), in this order:
  1. the approve compare-and-swap;
  2. the lead → WON;
  3. the job, with its type from the service and plannedDays from the estimate;
  4. JobLines from the non-optional rows;
  5. JobRequirements from the take-off;
  6. the ADVANCE invoice for the ON_ACCEPT stage (status SENT, public link, paymentStageId);
  7. CONVERTED.
- Library and template reads (jobPlanFor ~608) run before the transaction. Idempotency comes from both
  compare-and-swap steps and the unique indexes.
- A quotation with no ON_ACCEPT stage creates no advance invoice and no gate.
- Notify the customer after commit: the advance_due SMS, and email when one is on file.

L6.3 · The advance gate
- `assertAdvanceCleared(job)` runs in scheduleJob, assignTechnicians and changeStatus. When
  job.advanceGate is on, the job has an advance invoice, the invoice is not PAID and there is no override,
  it answers 422 `ADVANCE_UNPAID`.
- POST /admin/jobs/:id/advance-override { reason } (jobs:advance-override: MANAGER, ADMIN). It writes the
  event `job.advance_overridden`. DISPATCHER gets 403.
- An "Awaiting advance" chip on the unassigned queue, the dispatch card and the job page. When the
  advance is paid, notify the dispatchers that the job is ready to schedule.
- The `advance_due` SMS carries the amount, the payment link (the public invoice page) and the bank /
  Fonepay details from settings (propose the keys). Its due date comes from finance.advanceDueDays.
- scheduledEnd defaults from plannedDays when the dispatcher does not set it.

L6.4 · The Plan tab (BOQ jobs only)
JobDetailPage/sections/JobPlanTab.jsx is a hand-off checklist:
- advance status, with a link to the invoice;
- BOQ imported (how many lines, grouped by section);
- materials needed vs stock, with the shortfall;
- the crew plan (labour days ÷ crew = duration; the foreman is the lead technician);
- site readiness.

L6.5 · Seed
Services with a jobType. One accepted BOQ quotation whose job has lines, requirements and an unpaid
advance, so it is gated. One job whose advance is paid and which is ready to schedule.

TESTS
- New tests/api/19-handoff.test.js, written first:
  · Accepting a 50/40/10 quote creates the BOQ lines, the requirements and one ADVANCE invoice.
  · The stage amounts sum to the quotation total to the paisa, and the advance total equals stage 1.
  · A double tap, or a replayed decide, creates one job and one invoice.
  · schedule, assign and status moves → 422 ADVANCE_UNPAID until the invoice is paid or overridden.
  · The override is audited with its reason. DISPATCHER → 403 on the override.
  · A staff convert-to-job also wins the lead. The job type comes from the service.
  · No ON_ACCEPT stage → no invoice and no gate.
  · The advance_due SMS uses the ne template for a ne customer.
- 13-quotation-approval: the existing accept tests still pass, with their notification recipients.
- The L0 /tech key-scan still passes on a BOQ job.
- vitest: the Plan tab (shortfall, crew calculator), the "Awaiting advance" chip, and the override dialog
  (shown only with jobs:advance-override).
- e2e/boq-flow.spec.js gains: the customer accepts; as the accountant, record the advance payment; as the
  dispatcher, scheduling is refused before the payment and works after it.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npx eslint src tests
  cd MaintainanceFrontend && npm test && npm run lint && npm run build && npm run test:e2e
Manual: accept the seeded BOQ quotation on its link. As dispatch@gharjatan.com.np, see "Awaiting advance"
and a refused schedule. As accounts@gharjatan.com.np, record the payment. As dispatch, schedule it. On a
second job, override as manager@gharjatan.com.np, and read the audit trail.

ACCEPTANCE (ADMIN-PLAN §5 Phase L · L6)
Accepting a 50/40/10 quote creates the BOQ lines, requirements and one advance invoice; stage amounts sum
to the quotation total to the paisa; a double tap creates one job and one invoice; scheduling is 422 until
paid or overridden (audited, dispatcher 403 on override).

GIT
- Work on a local branch `admin/phase-l6-won-handoff` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase I's and Phase L5's work is present on `prabesh` (their files and
  migrations exist; Phase I's Record payment sheet in particular). If it is not, STOP and tell me.
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
- docs/API.md: what Accept creates now, ADVANCE_UNPAID on schedule/assign/status, advance-override,
  Invoice.kind / jobId / paymentStageId, job lines and requirements on GET /admin/jobs/:id, jobType on
  services.
- docs/ARCHITECTURE.md "State machines": the hand-off transaction step by step, and the advance gate;
  billing notes (the advance invoice).
- MaintainanceBackend/README.md: the "Status is the server's decision" paragraph gains the advance gate;
  the new settings and the advance_due template.
- CLAUDE.md decisions table: the quotation-approval row says Accept creates the job; add that it also
  raises the advance invoice, which gates scheduling. Call it out in the report.
- STRUCTURE.md: the Plan tab and the advance chip.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Migrations, the transaction's steps as built, the idempotency guards, endpoints and error codes, test
counts, the manual walk-through and follow-ups. Do not start Phase L7.
````
