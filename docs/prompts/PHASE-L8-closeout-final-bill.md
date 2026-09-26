# Phase L8 — Close-out & final bill

~3 days · branch `admin/phase-l8-closeout-final-bill` · requires Phase L7 done · decisions L-D2 and L-D3 in ADMIN-PLAN §4

````text
You are working in the InvincibleMaintainance repo. This is Phase L8 of docs/ADMIN-PLAN.md §5 Phase L,
the last Phase L prompt. A BOQ job now has an advance (L6), progress, variations and purchases (L7). This
phase closes the money loop:
- running bills per payment stage;
- the final measurement for item-rate contracts;
- a FINAL invoice that follows the contract type and deducts everything billed before it;
- a handover that records snags, the warranty and an AMC offer.
Advance + running + final must equal the contract value to the paisa.

DECISIONS — DECIDED 2026-09-26, build exactly this
- L-D2 Final bill, chosen per quotation:
  · LUMP_SUM = the quoted rows (provisional rows at their measured qty) + approved variations − the
    discount.
  · ITEM_RATE = measured qty × quoted rate + variations, with the discount applied pro rata. It needs the
    measurement closed; otherwise 422 `MEASUREMENT_INCOMPLETE`.
  Both deduct every earlier ADVANCE and RUNNING bill as DEDUCTION lines, through money.js#finalBillTotals,
  and VAT reconciles to the paisa.
- L-D3: each payment stage is billed once (Invoice.paymentStageId @unique). A MILESTONE stage becomes a
  RUNNING bill.
- Deferred, not built: credit notes. A final bill below what was already billed is refused.
- Measuring is quantities only. The engineer measures from admin or from /tech and never sees a rate.

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md, docs/ADMIN-PLAN.md §5 Phases I and L (L0 and L8),
  docs/API.md "Admin — Finance", "Admin — Operations", "Field app", docs/ARCHITECTURE.md (billing, money
  wall)
- Backend: src/services/invoice.service.js (createFromJob as L0 left it, createInvoice, sendInvoice,
  voidInvoice), src/utils/money.js (finalBillTotals, proRata, rs, paymentSchedule),
  src/utils/quantity.js (measurementQty), src/services/job.service.js (completeJob ~287, verifyJob ~400,
  jobCosting ~559), src/services/handoff.service.js (L6), src/services/warranty.service.js,
  src/services/report.service.js (jobMarginReport, revenueReport), src/routes/admin/ops.routes.js,
  src/routes/admin/finance.routes.js, src/routes/tech.routes.js, src/shared/schemas/ops.js,
  src/shared/enums.js (LEAD_SOURCES, AUDIT_EVENTS), prisma/schema.prisma (Invoice, InvoiceItem, Job,
  JobLine, QuotationPaymentStage)
- Tests: tests/api/07-finance.test.js, 19-handoff.test.js, 20-variations.test.js, 06-tech.test.js,
  tests/money.test.js (the property test from L2)
- Frontend: src/pages/admin/JobDetailPage/ (sections/JobCostingTab.jsx, the L7 BOQ & progress tab),
  src/components/jobs/CompleteJobDialog.jsx, Phase I's invoice screens, src/pages/tech/TechJobPage.jsx,
  src/components/documents/*

RULES
- Money is integer paisa, and only src/utils/money.js does arithmetic on it. The final bill,
  deductions, pro-rata discount and VAT all come from finalBillTotals, never from the service or the SPA.
- InvoiceItem.kind DEDUCTION lines are negative, so every existing costing and revenue report that sums
  invoice lines stays correct. Prove it with jobCosting.invoiced.
- /tech measurement endpoints take and return quantities only. Run the L0 key-scan over them.
- Unquoted jobs keep L0's rule: a STANDARD invoice from actuals.
- Keep enum migrations separate from any data migration that uses the new values.
- Tests first for backend changes. Post the plan first: the final-bill formula for each contract type
  with a worked example, the migrations, the endpoints and the error codes.
- Update the docs in the same change.

TASKS

L8.1 · Running bills
- POST /admin/jobs/:id/invoices/stage { paymentStageId } (invoices:write) raises a RUNNING invoice for a
  MILESTONE stage, with the stage amount from paymentSchedule.
- A stage that is already billed → 409 or 422 (say which). A stage from another job → 404.
- The L7 progress prompt links here.

L8.2 · Final measurement (ITEM_RATE)
- PUT /admin/jobs/:id/lines/:lineId/measure (jobs:write) and PUT /tech/jobs/:id/lines/:lineId/measure
  (assigned people). Both take measurement rows; the server derives measuredQty with measurementQty, and
  the reply carries quantities only.
- POST /admin/jobs/:id/measurement/close sets Job.measurementClosedAt and the person who closed it, with
  the event `job.measurement_closed`. Propose whether it can be reopened, and by whom.
- The measure form on the job's BOQ & progress tab, and on TechJobPage at 360 px.

L8.3 · The FINAL invoice
- createFromJob on a BOQ job raises the FINAL invoice by the contract type (see DECISIONS).
  InvoiceItem gains kind (ITEM | DEDUCTION, and whatever else your plan needs), in its own migration.
- A final below what was already billed is refused with 422 (name the code), because credit notes are
  deferred.
- The Costing tab (costs:read) shows quoted vs actual: quoted cost from the recipe snapshots, against the
  actual materials, labour and expenses.

L8.4 · Handover
A handover dialog at completion (CompleteJobDialog):
- Snags become job tasks. Open tasks already block completion; say so in the dialog.
- The warranty, which completion already creates, is shown with its public link.
- "Offer AMC" creates a lead for sales, linked to the customer and site. Propose its source value: add
  one to LEAD_SOURCES and mirror it, or reuse an existing value.

L8.5 · Seed
One LUMP_SUM job and one ITEM_RATE job, each billed through advance → running → final. The ITEM_RATE job
is measured about 5 % over the quote and has one accepted variation. Both must be browsable end to end.

TESTS
- New tests/api/21-contract-billing.test.js, written first:
  · An ITEM_RATE job measured 5 % over quote bills measured × rate + the variation − the stage bills.
  · A LUMP_SUM job bills the contract ± variations − the stage bills.
  · Advance + running + final = the contract value to the paisa, and jobCosting.invoiced equals the
    contract value.
  · Final on an open ITEM_RATE measurement → 422 MEASUREMENT_INCOMPLETE.
  · A running bill is raised once per stage. A final below billed → 422.
  · /tech measure returns no money (key-scan), and only assigned people may measure.
- tests/money.test.js: the L2 property test still passes. Add a case built from the two seeded jobs'
  numbers.
- vitest: the final-bill preview (server numbers), the measure form, the handover dialog and "Offer AMC".
- e2e/boq-flow.spec.js is complete: lead → visit → BOQ → approve → accept → advance paid → schedule →
  diary → final bill, with the final invoice's total asserted over the API.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npx eslint src tests
  cd MaintainanceFrontend && npm test && npm run lint && npm run build && npm run test:e2e
Manual: with the seeded jobs:
- As accounts@gharjatan.com.np, raise the running bill, then the final bill.
- On the ITEM_RATE job, measure as hari@gharjatan.com.np at 360 px and close the measurement as dispatch.
- Check that the three invoices add up to the contract value.
- As manager@gharjatan.com.np, read quoted vs actual on the Costing tab.
- Complete a job with a snag, and offer AMC.
Then run `npm run db:seed` on an empty database and walk the whole Phase L pipeline once.

ACCEPTANCE (ADMIN-PLAN §5 Phase L · L8)
An ITEM_RATE job measured 5 % over quote bills measured × rate + variation − stage bills; a LUMP_SUM job
bills contract ± variations − stage bills; advance + running + final = contract value to the paisa;
`jobCosting.invoiced` equals the contract value.

GIT
- Work on a local branch `admin/phase-l8-closeout-final-bill` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase L7's work is present on `prabesh` (its files and migrations
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
- docs/API.md: the stage-bill endpoint, measure and close (admin and /tech), the FINAL invoice rules per
  contract type, InvoiceItem.kind and DEDUCTION, MEASUREMENT_INCOMPLETE and the below-billed refusal,
  Offer AMC.
- docs/ARCHITECTURE.md: a billing section (STANDARD / ADVANCE / RUNNING / FINAL, deductions, what each
  contract type bills).
- docs/ADMIN-PLAN.md: Phase L marked complete in §5 and §6, with the deferred list confirmed.
- MaintainanceBackend/README.md: the seeded LUMP_SUM and ITEM_RATE demo jobs, and the billing paragraph.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
The final-bill formulas as built with a worked example for each contract type, migrations, endpoints,
error codes, test counts (including the property test and the full e2e), the manual walk-through and
follow-ups. Do not start Phase J1.
````
