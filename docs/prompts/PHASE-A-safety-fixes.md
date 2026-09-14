# Phase A — Safety fixes + doc housekeeping

~2 days · branch `admin/phase-a-safety-fixes`

````text
You are working in the InvincibleMaintainance repo (MaintainanceBackend = Express + Prisma +
PostgreSQL, MaintainanceFrontend = Vite + React JSX + shadcn + RTK Query). This is Phase A of
docs/ADMIN-PLAN.md: fix the defects that later phases would otherwise build on, and make the docs
tell the truth so every later session is not misled.

READ FIRST
- CLAUDE.md
- docs/ADMIN-PLAN.md — §3 (defects #1–#12) and §5 Phase A, §8
- MaintainanceBackend/README.md
- MaintainanceBackend/src/shared/stateMachines.js, src/shared/permissions.js
- MaintainanceBackend/src/services/convert.service.js, quotation.service.js, lead.service.js,
  invoice.service.js, crud.service.js, job.service.js (createJob), survey.service.js (createFromJob)
- MaintainanceBackend/src/crons/index.js, src/routes/admin/finance.routes.js, crm.routes.js, cms.routes.js
- MaintainanceBackend/tests/api/helpers.js and one existing API test file, to copy the style
- MaintainanceFrontend/src/STRUCTURE.md, src/pages/admin/LeadsPage.jsx,
  src/components/booking/BookingWizard/BookingWizard.jsx, src/api/baseQuery.js, src/api/leadsApi.js

RULES
- Follow CLAUDE.md. Money is integer paisa; only utils/money.js does arithmetic on it.
- Status changes go through shared/stateMachines.js — never write a status string directly.
- Any schema change: edit prisma/schema.prisma, create ONE descriptively named migration
  (`npx prisma migrate dev --name <name>`), and update docs/DATA-MODEL.prisma and docs/API.md in
  the same commit. Update prisma/seed.js if seeded data is affected.
- For every backend behaviour change, write the API test first, watch it fail, then fix.
- Do not refactor beyond what a task needs.

STEP 0 — BASELINE
Run and record the results before touching anything:
  cd MaintainanceBackend && npm test && npm run test:api
If test:api cannot connect because maintainance_test does not exist, STOP and tell me — I create
it by hand (docs/prompts/README.md). Then post your plan and wait for nothing — proceed.

TASKS

A1 · Lead-convert quotation VAT (money bug, ADMIN-PLAN #1, #7)
convert.service.js builds a Quotation with prisma directly: vatApplied defaults true, vatRate 13,
but vatAmount 0 and total = subtotal. Route it through quotation.service createQuotation so
documentTotals is the only VAT arithmetic. Then make the whole convert atomic: customer/site,
lead update, quotation, inspection job and survey either all commit or none do. If createJob /
createFromJob cannot accept a transaction client without an invasive change, say so in your plan
and propose the smallest safe alternative (e.g. pass `tx` through, or make convert idempotent and
resumable). Tests: converted quotation totals equal a hand-computed fixture including 13% VAT;
a forced failure in the job step leaves no customer/quotation rows behind.

A2 · Expired quotations can be approved (#2)
decideByToken only checks status === 'SENT'. Treat `validUntil < now` as expired at decide time:
transition to EXPIRED (via the state machine) and answer 422 with the existing expired message.
Test: a SENT quotation with validUntil in the past, never fetched via GET, cannot be approved.

A3 · Quotation expiry sweep
Add a `quotation:expire` task to crons/index.js next to the existing sweeps: SENT and
validUntil < now → EXPIRED, one guarded updateMany, logged with a count. Unit/API test the service
function the cron calls.

A4 · Sent quotations are editable in place (#3)
updateQuotation must allow edits only in DRAFT; anything else is 422 with a message telling the
caller to revise. Check the frontend QuotationBuilderPage offers no save on a non-DRAFT quotation
(read-only + a Revise button). Test: PUT on a SENT quotation → 422, totals unchanged.
(Superseding the parent on revise is Phase F — do not add new statuses here.)

A5 · Payments are hard-deleted (#5)
Replace `DELETE /admin/invoices/:id/payments/:paymentId` with
`POST /admin/invoices/:id/payments/:paymentId/void { reason }` (payments:write). Migration
`payment_void`: Payment gets voidedAt DateTime?, voidReason String?, voidedById String?.
paidAmount and the derived invoice status ignore voided payments. INVOICE_TRANSITIONS currently
has PAID: ['VOID'] only — voiding a payment on a PAID invoice needs PAID → PARTIAL and
PARTIAL → SENT (or OVERDUE when past due); add those transitions with unit tests. GET responses
include voided payments flagged, never hide them. Update the public invoice page's payment
history to show voided rows struck through. Tests: void → paidAmount and status recompute;
voiding twice → 422; reason required → 400.

A6 · Lead status written past the state machine (#6)
Add one `transitionLead(tx, leadId, to, { actorId, note })` in lead.service.js that asserts the
transition, stamps closedAt for WON/LOST, and writes a LeadActivity. Replace every direct lead
status write (convert.service.js ~37, ~70, ~103; quotation.service.js ~218 with its
`.catch(() => {})`). Decide and document the edge cases instead of swallowing errors:
- convert from NEW must pass through CONTACTED before QUOTED/INSPECTION_SCHEDULED;
- customer approval when the lead is already WON/LOST must not fail the customer's approval —
  record a LeadActivity note instead.
grep for any other `lead.update(... status` and fix those too. Tests for each edge case.

A7 · EDITOR can hard-delete (#8)
Add capability `cms:purge` (ADMIN only via '*'). crud.service.js honours `?hard=true` only when
the caller has it; otherwise 403. Same for media hard delete if applicable. Tests: EDITOR 403,
ADMIN 200; soft delete unaffected. Update permissions unit test.

A8 · Leads CSV export always 401s (#10)
LeadsPage uses window.open, which sends no Bearer token. Add an `exportLeadsCsv` endpoint to
src/api/leadsApi.js using `responseHandler: (res) => res.text()` and keepUnusedDataFor: 0 (text is
serialisable; a Blob is not), triggered lazily; build the Blob and download it in the page with the
current filters applied. It must survive a 401 → refresh → retry through baseQuery.

A9 · Booking anti-spam timing bypassed (#11)
BookingWizard sends a hardcoded elapsedMs: 60_000. Record the wizard's mount time with a ref and
send the real elapsed time. Check the backend minimum in lead.service/public schema so a genuine
fast user is not rejected.

A10 · Lint is broken in both apps (#12)
Neither app has an eslint flat config although both have `npm run lint`. Add eslint.config.js to
each: @eslint/js recommended + globals; frontend adds eslint-plugin-react, react-hooks and
react-refresh. Fix real errors (unused vars, hooks rules); do NOT mass-reformat or disable rules
to get green — list anything you intentionally left as a warning.

A11 · Doc housekeeping (ADMIN-PLAN §8)
- CLAUDE.md: replace `packages/shared` and `apps/api` with the real paths
  (MaintainanceBackend/src/shared, MaintainanceFrontend/src/form/schemas).
- D5 (controllers layer) — DECIDED (2026-09-14): the thin inline
  asyncHandler in a route file IS the controller; route files must not call prisma directly;
  business logic stays in services. Amend the CLAUDE.md layering rule to say exactly that. (Moving
  the existing raw prisma calls out of routes happens when each router is next touched.)
- docs/PLAN.md: add a banner at the top — historical v1 blueprint; MUI/monorepo/apps/* no longer
  apply; current build order is docs/ADMIN-PLAN.md.
- docs/ARCHITECTURE.md: one Vite app on :5400 serving site/admin/tech, not apps/web + apps/admin.
- docs/DATA-MODEL.prisma: regenerate from prisma/schema.prisma (keep its header comment explaining
  it mirrors the schema), so rule 2 is meaningful again.
- STATUS.md: replace "Next" with a pointer to docs/ADMIN-PLAN.md and record Phase A.

A12 · Continuous integration (GitHub Actions)
The repo has no CI and its remote is GitHub. Add .github/workflows/ci.yml, triggered on pull
requests into DEVELOPMENT and pushes to DEVELOPMENT:
- backend job: Node 20, `npm ci`, `npx prisma generate`, `npm run lint`, `npm test`; a postgres:16
  service with a database named maintainance_test; `npx prisma migrate deploy` and `npm run db:seed`
  against it (not migrate reset); then `npm run test:api`. Set DATABASE_URL / TEST_DATABASE_URL and
  throwaway JWT secrets in the workflow env — obviously test-only values, never real secrets.
- frontend job: Node 20, `npm ci`, `npm run lint`, `npm run build` (Phase C1 adds `npm test`, Phase
  F2 adds the end-to-end job).
- npm cache keyed on each package-lock.json; any failing step fails the run.
This session cannot run it — check the YAML carefully (valid syntax, the commands match package.json);
it runs when you push.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npm run lint
  cd MaintainanceFrontend && npm run lint && npm run build
Then run both apps (`npm run dev` in each), log in as sales@gharjatan.com.np / Password123,
export leads CSV with a filter applied, and complete one online booking at /book.

ACCEPTANCE
- Every task above has a test that fails on the old code and passes now.
- Backend unit + API suites green, both lints green, frontend builds.
- CSV export downloads a file with the filtered rows; a booking still creates a lead.
- CLAUDE.md, PLAN.md banner, ARCHITECTURE.md, DATA-MODEL.prisma and STATUS.md match the code.
- .github/workflows/ci.yml is in place and its commands match the package.json scripts (it runs when you push).

GIT
- Work on a local branch `admin/phase-a-safety-fixes` created from DEVELOPMENT.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- This is the first phase; start from DEVELOPMENT.
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
- CLAUDE.md: real paths instead of packages/shared and apps/api; the controllers-layer rule per D5.
- docs/PLAN.md historical banner; docs/ARCHITECTURE.md processes table (one Vite app on :5400).
- docs/DATA-MODEL.prisma regenerated from the schema; STATUS.md "Next" points at docs/ADMIN-PLAN.md.
- docs/API.md: payment void endpoint (DELETE removed), cms:purge on ?hard=true, quotation edit lock,
  expiry at decide time; ARCHITECTURE.md state-machine block gains the new INVOICE transitions.
- Both READMEs: how to run lint, and what CI runs when you push.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
What changed per task (files), migrations added, test counts before → after, lint warnings left
and why, anything skipped, follow-ups for later phases. Do not start Phase B.
````
