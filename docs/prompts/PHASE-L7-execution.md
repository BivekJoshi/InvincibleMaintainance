# Phase L7 — Execution: site diary, progress, planned vs actual, purchases, variations

~5 days · branch `admin/phase-l7-execution` · requires Phase L6 done · decisions L-D1…L-D4 in ADMIN-PLAN §4

````text
You are working in the InvincibleMaintainance repo. This is Phase L7 of docs/ADMIN-PLAN.md §5 Phase L.
After L6, a won job carries its BOQ lines and requirements, and it is scheduled once the advance is paid.
This phase covers the weeks on site:
- a daily site diary the foreman files from a phone, offline;
- progress per BOQ line, with earned value;
- materials and labour, planned vs issued vs logged;
- a purchase list raised from the shortfall;
- variation orders that go through the same builder, approval and customer link as a quotation.

DECISIONS — DECIDED 2026-09-26, build exactly this
- A variation order is a quotation with `kind VARIATION` and a `jobId`. It reuses the builder, the
  approval (maker-checker, LOW_MARGIN) and the no-login customer link. Only this kind may have negative
  lines (omissions). Accepting a variation adds job lines and requirements instead of creating a job. The
  lead is not touched.
- The site diary is one entry per job per Kathmandu day. Daily-wage labour are not app users, so
  headcount is recorded per trade.
- Planned vs actual is compared per material and per trade, not per BOQ line.
- D1 and L-D4 are unchanged: the diary and every /tech screen carry no money. Earned value and cost are
  office views.

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md ("Operations (Phase H1)", the tech PWA offline pieces),
  docs/ADMIN-PLAN.md §5 Phases H and L (L7), docs/API.md "Admin — Operations", "Field app",
  "Admin — CRM" (quotations), docs/ARCHITECTURE.md "State machines", "Offline strategy"
- Backend: prisma/schema.prisma (Job, JobLine, JobRequirement, Quotation, StockMovement, Supplier,
  Material, Trade), src/services/handoff.service.js (L6), src/services/quotation.service.js
  (acceptQuotation ~648, createQuotation, reviseQuotation), src/services/boq.service.js (L3),
  src/services/material.service.js (createMovement ~143, issueToJob ~182, stockBalances),
  src/services/job.service.js, src/routes/tech.routes.js (/sync ~214), src/routes/admin/ops.routes.js,
  src/shared/stateMachines.js, src/shared/enums.js (STOCK_MOVEMENT_TYPES), src/utils/dates.js
  (Kathmandu days), src/utils/money.js, src/utils/quantity.js
- Tests: tests/api/06-tech.test.js (sync, key-scan), 15-operations-admin.test.js,
  13-quotation-approval.test.js, 19-handoff.test.js
- Frontend: src/pages/tech/TechJobPage.jsx, TechTodayPage.jsx, src/helpers/offlineQueue.js,
  src/hooks/useOfflineQueue.js, src/api/techApi.js, src/pages/admin/JobDetailPage/ (sections/
  JobMaterialsTab.jsx, JobPlanTab.jsx from L6), src/pages/admin/StockPage.jsx, src/api/stockApi.js,
  src/pages/admin/QuotationBuilderPage/, src/config/constants.js, src/config/crmMirror.test.js

RULES
- Money is integer paisa, and only src/utils/money.js does arithmetic on it: earned value, variation
  totals and negative lines (signed rounding `rs`). Quantities go only through src/utils/quantity.js.
- No /tech response carries money. Run the L0 key-scan over the new diary endpoints.
- Offline: the diary is a new sync kind, `diary_save`. It is a full replace keyed on job + day, so
  replaying it lands on the same state. Photos use H2's queue.
- Status changes go through stateMachines.js (the new purchase-list machine, mirrored in the SPA), with a
  domain event in the same transaction.
- A warning never blocks: OVER_PLAN goes in meta.warnings, and the action still happens.
- Kit only: CustomTable, ResourceForm, registry. The variation builder is the L3 builder, not a copy.
- Keep enum migrations separate from any data migration that uses the new values.
- Tests first for backend changes. Post the plan first: migrations, the diary model and its sync payload,
  the purchase-list transitions, and how a variation's accept differs from a quotation's.
- Update the docs in the same change.

TASKS

L7.1 · Site diary (field)
- New model SiteDiary, unique on (jobId, day):
  · the day is a Kathmandu day;
  · weather;
  · headcount per trade;
  · progress % per JobLine;
  · materials received, with the challan number;
  · issues, and lost hours with a reason (RAIN, LATE_MATERIAL, CUSTOMER, BANDH, FESTIVAL, OTHER);
  · photos;
  · createdBy.
- GET/PUT /tech/jobs/:id/diary/:day, for assigned people only. The /tech/sync kind `diary_save` is
  idempotent.
- The latest diary sets JobLine.progressPct.
- Say in your plan whether a diary receipt should also issue stock to the job. The default is no: stock
  moves through the purchase list and issue-to-job.
- The page is pages/tech/SiteDiaryPage.jsx, linked from TechJobPage. It is built for 360 px, works
  offline and shows no money.

L7.2 · The job, in the office
- A "BOQ & progress" tab: lines by section with quoted qty, progress % and earned value (money.js). Who
  sees earned value: propose quotations:read / invoices:read / costs:read in your plan. When earned value
  passes the next MILESTONE stage, the tab prompts for the next running bill (L8 raises it).
- A "Materials / Labour" tab: planned (JobRequirement) vs issued (JobMaterial) vs logged (diary headcount
  and time logs), per material and per trade.
- issueToJob (material.service.js ~182) returns an `OVER_PLAN` warning when the issued quantity exceeds
  the plan.
- Show the diary days on the job page. Say where in your plan.

L7.3 · Purchase list
- New PurchaseList (number, jobId, supplierId, status DRAFT → ORDERED → RECEIVED, orderedAt, receivedAt,
  note) and PurchaseListItem (materialId, qty, packs, receivedQty). Add the machine to stateMachines.js and
  mirror it in the SPA.
- "Create from shortfall" on the job's Materials tab prefills the items.
- Receiving writes PURCHASE stock movements with the supplier, in one transaction. StockMovement gains a
  supplier link, or uses its reference; say which.
- Capability materials:write (DISPATCHER). A list page under Operations built from the kit.

L7.4 · Variations
- Quotation gains kind (QUOTATION | VARIATION, default QUOTATION) and jobId. Negative lines are allowed
  only on VARIATION: 422 on any other kind.
- A "Variations" tab on the job, with "New variation": the L3 builder, prefilled with the job's customer
  and site. Submit, approve, send and the customer's link all work unchanged.
- Accepting a VARIATION, in one transaction through handoff.service:
  · add JobLines (source VARIATION) and JobRequirements;
  · APPROVED → CONVERTED;
  · no new job and no lead change.
  Notify the job's dispatcher and the lead technician.
- Numbering: propose a prefix (for example VO-) or keep QT-. Say which in your plan.

L7.5 · Seed
The seeded running job gets three diary days (one lost to rain), progress on several lines, an over-plan
issue, a purchase list in ORDERED, and one accepted variation with an omission line.

TESTS
- New tests/api/20-variations.test.js, written first:
  · A variation is approved internally (self-approval 403, LOW_MARGIN applies) and accepted by the
    customer through its token.
  · Its lines appear in the job BOQ as VARIATION lines, with its requirements.
  · A negative line on a QUOTATION → 422. A double accept → applied once.
  · The lead is unchanged.
- 06-tech:
  · Three diary days filed offline and sent through /tech/sync apply once each; a replay reports
    duplicates.
  · One entry per job per day.
  · Only assigned people can file.
  · The key-scan finds no money in the diary responses.
- 15-operations-admin:
  · A purchase list goes DRAFT → ORDERED → RECEIVED, receiving raises stock with the supplier, and a
    wrong transition → 422.
  · OVER_PLAN appears in meta.warnings.
  · Planned vs issued vs logged totals.
- vitest: SiteDiaryPage at 360 px (offline queueing), the BOQ & progress tab, the Materials / Labour tab,
  the Variations tab, and crmMirror for the new machine and enums.
- e2e/boq-flow.spec.js gains: file a diary day as the technician, and see the progress on the job.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npx eslint src tests
  cd MaintainanceFrontend && npm test && npm run lint && npm run build && npm run test:e2e
Manual:
- As hari@gharjatan.com.np at 360 px, file three diary days with the network off, go back online and
  watch each sync once.
- As dispatch@gharjatan.com.np, read progress and planned vs actual, raise a purchase list from the
  shortfall and receive it (stock rises).
- As sales@gharjatan.com.np, raise a variation. manager@gharjatan.com.np approves it, the customer
  accepts, and the lines appear on the job.

ACCEPTANCE (ADMIN-PLAN §5 Phase L · L7)
Three diary days filed offline sync once each; progress and planned-vs-actual update; a variation is
approved internally, accepted by the customer and appears in the job BOQ; receiving a purchase list raises
stock.

GIT
- Work on a local branch `admin/phase-l7-execution` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase L6's work is present on `prabesh` (its files and migrations
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
- docs/API.md: the diary endpoints and the `diary_save` sync kind, purchase lists, Quotation.kind /
  jobId and the variation accept, OVER_PLAN, the planned-vs-actual payloads.
- docs/ARCHITECTURE.md "State machines" (the purchase list; the variation path through the quotation
  machine) and "Offline strategy" (diary_save, as built).
- STRUCTURE.md: SiteDiaryPage, the new job tabs, the purchase-list screen.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Migrations, endpoints, the sync kind, the purchase-list transitions, how a variation's accept was built,
test counts, the manual walk-through (viewport and network) and follow-ups. Do not start Phase L8.
````
