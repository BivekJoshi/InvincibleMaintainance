# Phase L1 — Lead follow-through: next actions, outcomes, stale reminders, lost reasons

~3 days · branch `admin/phase-l1-lead-follow-through` · requires Phase L0 done · decisions L-D1…L-D4 in ADMIN-PLAN §4

````text
You are working in the InvincibleMaintainance repo. This is Phase L1 of docs/ADMIN-PLAN.md §5 Phase L.
The lead pipeline (NEW → CONTACTED → INSPECTION_SCHEDULED → QUOTED → WON / LOST) exists, but only the
first step has a clock. After NEW there is no next action, follow-up date or reminder. A call outcome is
free text. Moving a card on the board creates nothing. LOST is free text that no report reads. A declined
or expired quotation never prompts anyone to mark the lead lost. This phase gives every open lead a next
action and a clock.

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md ("Leads and customers"), docs/ADMIN-PLAN.md §4 (D6)
  and §5 Phase L (L1), docs/API.md "Admin — CRM", docs/ARCHITECTURE.md "State machines"
- Backend: prisma/schema.prisma (Lead, LeadActivity, Notification), src/shared/stateMachines.js
  (LEAD_TRANSITIONS), src/shared/enums.js (LEAD_STATUSES, LOGGABLE_ACTIVITY_TYPES,
  CONTACT_ACTIVITY_TYPES), src/shared/schemas/crm.js (leadStatusSchema ~64, leadActivitySchema ~80,
  leadConvertSchema ~104, leadListQuery ~128), src/services/lead.service.js (addActivity ~335,
  transitionLead ~381, changeStatus ~407), src/services/convert.service.js (~100–175: the QUOTED step at
  ~167), src/services/survey.service.js (buildQuotationFromSurvey: the QUOTED step at ~543),
  src/services/quotation.service.js (sendQuotation ~386, winLeadOnAcceptance ~578, declineQuotation,
  expireQuotations), src/services/sla.service.js, src/services/notify.service.js (notify, notifyUsers),
  src/services/report.service.js, src/routes/admin/crm.routes.js, src/routes/admin/platform.routes.js
  (sales reports ~168), src/crons/index.js, src/queues/handlers.js, src/utils/dates.js,
  prisma/seed-data.js
- Tests: tests/api/12-leads-crm.test.js, 03-crm.test.js, 04-surveys.test.js, 13-quotation-approval.test.js,
  tests/stateMachines.test.js, tests/schemas.test.js
- Frontend: src/pages/admin/LeadDetailPage.jsx, LeadsPage.jsx, LeadBoardPage/*, LeadScreens.test.jsx,
  src/components/leads/ActivityComposer.jsx, LostReasonDialog.jsx, ScheduleVisitDialog.jsx,
  ConvertLeadSheet.jsx, src/helpers/leadBoard.js, src/config/admin/leadViews.js,
  src/config/constants.js, src/config/crmMirror.test.js, src/form/schemas/lead.schema.js

RULES
- Lead status changes only through transitionLead and LEAD_TRANSITIONS. Every change writes its domain
  event in the same transaction.
- Postgres cannot use a new enum value in the transaction that adds it. Keep each enum migration separate
  from any data migration that uses the new values.
- Nothing becomes LOST automatically. A decline or an expiry only prompts a person.
- Kit only: CustomTable, ResourceForm, the existing dialogs and sheets. Mirror every new enum and zod schema
  in the SPA; crmMirror.test.js enforces it.
- Money is integer paisa, and only src/utils/money.js does arithmetic on it (budget bands are labels, not
  amounts).
- Tests first for backend changes. Post the plan before editing: migrations, the outcome table (outcome →
  status move → next action → dialog), cron timing and settings.
- Update the docs in the same change.

TASKS

L1.1 · Schema (one migration per logical change)
- Lead gains nextActionAt, nextActionType, nextActionNote, stageEnteredAt, contactAttempts (Int, default
  0), lostCategory (a new enum LostCategory: PRICE, COMPETITOR, UNREACHABLE, POSTPONED, BUDGET,
  OWN_LABOUR, OUT_OF_SCOPE, OUT_OF_AREA, DUPLICATE_SPAM, OTHER) and lostAtStage (LeadStatus). Index
  nextActionAt.
- stageEnteredAt: transitionLead sets it on every move. Backfill it from the last status_change activity,
  or from createdAt when there is none.
- Qualification: property type, floors, building age, budget band, and decision maker, including "owner
  abroad". Store these as Lead columns or as one zod-checked `qualification` Json; choose one and say why
  in your plan.
- LeadActivity gains `outcome`. Notification gains `dedupeKey String? @unique`.

L1.2 · Call outcomes with rules (lead.service.js#addActivity)
- The outcomes: No answer · Call back at… · Interested, book visit · Interested, quote without visit ·
  Price shopping · Not now · Not interested… Complete the list in your plan, for example with Wrong
  number.
- Rules, all in addActivity, in one transaction:
  · Any call attempt counts as the SLA first response (the existing CONTACT_ACTIVITY_TYPES rule) and adds
    one to contactAttempts.
  · An outcome where the customer was reached moves NEW → CONTACTED. No answer and Wrong number do not.
  · Each outcome sets the next action or asks the client to open the matching dialog: No answer → retry
    at a setting-driven delay; Call back at → the time given; Book visit → CONTACTED plus the visit
    booking dialog; Quote without visit → CONTACTED plus the new-quotation sheet; Not interested → the
    Mark lost dialog.
  · On an open lead, saving an outcome requires a next action or closing the lead: 422, with a code you
    name in the plan (for example NEXT_ACTION_REQUIRED).
- PATCH /admin/leads/:id/next-action { at, type, note } (leads:write) sets or clears the next action and
  is audited.
- LOST (leadStatusSchema, changeStatus) requires lostCategory and keeps the free-text reason. The server
  records lostAtStage.

L1.3 · QUOTED means the customer has a quotation
- The lead moves to QUOTED when a quotation is sent: in sendQuotation, inside its transaction, forward only.
  A lead that is already WON or LOST keeps its status and gets a timeline note.
- Remove the QUOTED step from buildQuotationFromSurvey (survey.service.js ~543) and from convert
  (convert.service.js ~167). A draft is not a quotation the customer has.
- Update the existing tests that expected QUOTED at build time (04-surveys, 03-crm, 12-leads-crm), and say
  so in the report.

L1.4 · Board drops open the dialog behind the move
- LeadBoardPage: dropping a card on INSPECTION_SCHEDULED opens the visit booking dialog
  (ScheduleVisitDialog / ConvertLeadSheet). Dropping on QUOTED without a quotation opens the new-quotation
  sheet. The card moves only when the dialog completes, and Cancel puts it back. The keyboard path and the
  "Move to" path behave the same way (helpers/leadBoard.js).
- In L1 the new-quotation sheet is the existing convert-with-draft-quotation path, or a minimal sheet. L3
  grows it into blank · from survey · copy existing.

L1.5 · Crons, settings and one-time sends
- `leads:followups`: next actions that are due or overdue. In-app when an item falls due, and a 09:00
  Kathmandu digest per salesperson.
- `pipeline:stale`: contacted and quiet for 3 days; visit day passed without a survey; survey not quoted
  within 48 h; approval waiting 24 h; quote unanswered for 3 days; quote expiring in 2 days. Each rule goes
  to the lead's owner, and approvals go to the approvers.
- Settings `pipeline.*` in prisma/seed-data.js hold every threshold above, the digest hour and the
  No-answer retry delay, with labels and hints.
- src/crons/index.js is an interval scheduler, not a clock. A "09:00" task runs every hour and acts once
  per Kathmandu day after the hour. Register the handlers in src/queues/handlers.js.
- `Notification.dedupeKey`: every reminder carries a key, for example
  `stale:quote_unanswered:<quotationId>:<ktm-day>`, so a second run of the cron, or two instances, send
  once.
- A decline or an expiry notifies the salesperson with a "Mark lost?" link that opens the dialog. It never
  changes the lead.

L1.6 · Screens (kit only)
- LeadDetailPage: a NextActionCard (what is next, when, overdue state, Done / Reschedule) and an outcome
  composer built on ActivityComposer. The composer opens the right dialog per outcome and refuses to save
  without a next action unless the lead is being closed.
- A qualification card on the lead.
- Leads list views Due today · Overdue · No next action (config/admin/leadViews.js, with filters on
  leadListQuery). An "Nd in stage" chip on list rows and board cards, from stageEnteredAt.
- LostReasonDialog gains the category, which is required, next to the free text.
- Lost report: GET /admin/reports/lost?from&to (reports:sales), category × stage × service, in
  report.service.js next to the other sales reports. Show it on a small CustomTable page under Sales;
  Phase I10 folds it into /admin/reports.

L1.7 · Seed
Leads that show each state: due today, overdue, no next action, a stale sent quote, and lost leads across
several categories and stages, so the report has rows. `npm run db:seed` must still run on an empty
database.

TESTS
- New tests/api/22-lead-follow-up.test.js, written first:
  · No answer on a NEW lead stamps firstResponseAt, adds one to contactAttempts, sets nextActionAt, and
    leaves the lead NEW.
  · Book visit → CONTACTED. An outcome without a next action on an open lead → 422.
  · LOST without a category → 422. lostAtStage is recorded.
  · Building a quotation from a survey leaves the lead where it was; sending the quotation moves it to
    QUOTED.
  · Running the stale cron handler twice sends one notification. The follow-up digest goes once per
    Kathmandu day.
  · A decline or an expiry notifies with a Mark lost link, and the lead is unchanged.
  · GET /admin/reports/lost groups by category × stage × service; it is 403 without reports:sales.
- Unit: tests/schemas.test.js for the new schemas; tests/stateMachines.test.js unchanged.
- vitest (LeadScreens.test.jsx): a board drop to QUOTED opens the sheet, and Cancel returns the card; the
  NextActionCard's overdue state; the three views' queries; the lost dialog requires a category;
  crmMirror.test.js covers the new enums.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npx eslint src tests
  cd MaintainanceFrontend && npm test && npm run lint && npm run build && npm run test:e2e
Manual as sales@gharjatan.com.np: log No answer on a NEW lead, and confirm the SLA stops and the next call
is scheduled. Log Book visit, and confirm the lead is CONTACTED and the booking dialog opens. Drag a
CONTACTED card to QUOTED, cancel, and confirm the card returns. Run the stale handler twice, and confirm
one notification. Open the lost report.

ACCEPTANCE (ADMIN-PLAN §5 Phase L · L1)
"No answer" on a NEW lead meets the SLA and schedules the next call; "Book visit" moves to CONTACTED and
opens the dialog; a board drop to QUOTED without a quotation opens the sheet and reverts on cancel; a stale
quote reminds once across two cron runs; the lost report shows categories.

GIT
- Work on a local branch `admin/phase-l1-lead-follow-through` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase L0's work is present on `prabesh` (its files and migrations
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
- docs/API.md: the new lead fields, the activity `outcome` contract and its rules, PATCH …/next-action,
  the list filters, GET /admin/reports/lost, LOST requiring a category, QUOTED on send.
- docs/ARCHITECTURE.md "State machines" (QUOTED on send; LOST with a category and stage) and
  "Cross-cutting services" (the two crons, once-per-day timing, Notification.dedupeKey).
- MaintainanceBackend/README.md: the crons and the `pipeline.*` settings.
- STRUCTURE.md: NextActionCard, the outcome composer, and the board-drop dialogs.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
The outcome table as built, the migrations, endpoints, settings, the cron timing, the tests you changed
for QUOTED-on-send, test counts, the manual results and follow-ups. Do not start Phase L2.
````
