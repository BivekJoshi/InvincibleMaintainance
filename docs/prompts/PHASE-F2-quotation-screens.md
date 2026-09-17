# Phase F2 — Quotation approval & customer response: screens + first end-to-end test

~2 days · branch `admin/phase-f2-quotation-screens` · requires Phase F1 done

````text
You are working in the InvincibleMaintainance repo. This is Phase F2 of docs/ADMIN-PLAN.md. F1 built
the backend of the quotation flow (internal approval, customer Accept / Ask for changes / Decline,
automatic job creation, notifications). F2 builds the staff screens, the customer link page, the
dashboard counts, and the repo's first automated end-to-end test of the whole business loop.

DECISIONS (built in F1 — read ADMIN-PLAN §4 and docs/API.md for the exact contract)
MANAGER / ADMIN approve; no self-approval; auto-approve below a threshold (off by default, applies to
revisions); every revision is approved again; the customer side is one link with Accept · Ask for
changes · Decline — no login, no code, no typed name; acceptance creates the job automatically.

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md (kit + registry sections)
- docs/ADMIN-PLAN.md §4 and §5 Phase F; docs/API.md quotations + public decide (as updated in F1);
  docs/ARCHITECTURE.md "State machines"
- MaintainanceBackend/src/shared/stateMachines.js (to mirror), permissions.js
- Frontend: src/pages/admin/QuotationsPage.jsx, QuotationBuilderPage.jsx,
  src/components/quotations/QuotationLineEditor.jsx, src/api/quotationsApi.js,
  src/pages/public/QuotationPublicPage/* (incl. sections/QuotationDecision.jsx),
  src/components/documents/*, src/pages/admin/DashboardPage.jsx, src/api/dashboardApi.js,
  src/helpers/permissions.js, src/config/constants.js, src/components/common/RecordHistory.jsx (Phase E)
- .github/workflows/ci.yml, MaintainanceBackend/tests/api/prepare-db.js and setup.js (how the test
  database is prepared)

RULES
- Kit only (DataTable v2, ResourceForm, RecordHistory). Totals always come from the server.
- Customer-facing strings for the link page live in one content object (Phase J1 translates them).
- The public page is mobile-first; respect prefers-reduced-motion.
- Post the plan first, including how the E2E test gets a clean, seeded database.

TASKS

F2.1 · Quotations list — stage tabs using ?stage=: Drafts · Needs approval (count; quotations:approve
only) · Ready to send · With customer · Customer asked for changes (count) · Won · Declined/Expired ·
All. Row actions follow the state.

F2.2 · Quotation builder — rebuild on ResourceForm + a zod schema mirroring the backend (adapt
QuotationLineEditor to the kit). Read-only unless DRAFT. Action bar by state and capability:
Submit for approval · Approve · Send back (note) · Pull back (note) · Send (public link + copy +
SMS/email status) · Revise · Convert to job (legacy quotations only). Shows an auto-approved badge, a
self-approval hint, the customer's change message prominently on CHANGES_REQUESTED and on the
revision built from it, the approval/response timeline (RecordHistory), and a version switcher.

F2.3 · Public quotation page — the document, then three large buttons Accept · Ask for changes ·
Decline. Accept's confirm dialog repeats the total; Ask for changes opens a textarea; afterwards say
what happens next (accepted: "our team will call you to schedule the work"; changes: "we will send
you an updated quotation"). A replaced notice links to the newer version; an expired notice offers a
call button. No login, no code, no typed name. Check at 360px.

F2.4 · Dashboard widgets for F1's counts, linking to the filtered list tabs.

F2.5 · First end-to-end test (Playwright)
MaintainanceFrontend/e2e/quotation-flow.spec.js + playwright.config.js (webServer starts the API
against the *_test database and Vite on :5400). One happy path — browser where a person acts, API
calls for set-up steps that are not under test:
  customer books at /book (browser) → sales converts with an inspection (API) → surveyor submits the
  survey (API) → sales builds the quotation from the survey and submits it (browser) → manager
  approves (browser) → sales sends (browser) → customer opens the link and taps Ask for changes with a
  Nepali message (browser) → sales revises + submits, manager approves, sales sends (API) → customer
  taps Accept (browser) → assert via API: lead WON, exactly one job in the unassigned queue,
  notifications once each.
Add `npm run test:e2e` and a CI job: postgres service, `prisma migrate deploy` + seed, install
Playwright Chromium, run headless, upload the trace on failure.

TESTS (vitest)
Action-bar state → buttons mapping per capability; quotation transitions mirror parity with the
backend; public page actions per status (SENT, CHANGES_REQUESTED, SUPERSEDED, EXPIRED, APPROVED).

VERIFY
  cd MaintainanceFrontend && npm test && npm run lint && npm run build && npm run test:e2e
Manual end to end on the seeded demo (both apps running):
 1. /book a service as a customer
 2. sales converts with an inspection visit for survey@gharjatan.com.np
 3. the surveyor submits the survey in /tech
 4. sales builds the quotation from the survey and submits it
 5. sales cannot approve their own; manager@gharjatan.com.np approves
 6. sales sends it; open the public link at phone width
 7. tap Ask for changes with a message in Nepali
 8. sales sees it, revises to v2, submits; the manager approves again; sales sends
 9. the old link says replaced; on the new link tap Accept
10. customer SMS/email (console driver); in-app notifications for salesperson, creator, every
    dispatcher and the manager — once each; lead WON; job in the dispatch unassigned queue with checklist
11. set quotation.autoApproveBelow above a quotation's total, revise and submit → auto-approved
12. the admin audit log shows the whole trail

ACCEPTANCE (ADMIN-PLAN Phase F)
The whole loop works from the UI exactly as decided, the customer responds in one tap from a phone,
and the Playwright test proves it locally (and in CI once you push).

GIT
- Work on a local branch `admin/phase-f2-quotation-screens` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase F1's work is present on `prabesh` (its files and migrations
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
- STRUCTURE.md: quotation screens, the public page content object, the e2e folder and how to run it.
- MaintainanceFrontend/README.md: `npm run test:e2e` and its prerequisites.
- docs/ADMIN-PLAN.md §2: mark the workflow gaps closed.
- STATUS.md "Verification": the E2E test and what it covers.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Screens built, E2E design and CI job, test counts, the manual run step by step, follow-ups. Do not start Phase G.
````
