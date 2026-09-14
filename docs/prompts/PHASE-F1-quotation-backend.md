# Phase F1 — Quotation approval & customer response: backend

~3 days · branch `admin/phase-f1-quotation-backend` · requires Phase E done · decisions in ADMIN-PLAN §4

````text
You are working in the InvincibleMaintainance repo. This is Phase F1 of docs/ADMIN-PLAN.md — the
backend of the core business flow (F2 builds the screens and the first end-to-end test):

  customer books → engineer inspects and submits a survey (quantities only) → the office prices a
  DRAFT quotation → a MANAGER approves it (or it auto-approves below a threshold) → it is sent to
  the customer as a link → the customer taps Accept, Ask for changes, or Decline → on Accept the
  CRM is updated, every stakeholder is notified, and a job is created for dispatch.

Today the quotation goes DRAFT → SENT with no internal approval, `APPROVED` means the *customer*
approved, the customer can only approve or reject, and acceptance creates no job and never tells
DISPATCHER.

DECISIONS — DECIDED 2026-09-14, build exactly this
- D1 Pricing: the engineer/surveyor reports QUANTITIES ONLY (money wall unchanged — no rates on
  /tech, SURVEYOR has no quotations:read). SALES / MANAGER / ADMIN price the DRAFT from the survey
  (buildQuotationFromSurvey) or from scratch.
- D2 Internal approval: new role MANAGER and new capability `quotations:approve` (MANAGER, and
  ADMIN via '*'). MANAGER = every SALES capability + quotations:approve + reports:sales (propose
  anything more in your plan). Rules:
  · No self-approval: the approver cannot be the quotation's createdBy (setting
    `quotation.makerChecker`, default true).
  · Auto-approval: setting `quotation.autoApproveBelow` (paisa), default 0 = OFF. When set, ANY
    version — including revisions — whose total is below it goes straight to OFFICE_APPROVED on
    submit, approved by the system (actorType 'system', event quotation.auto_approved).
  · Re-approval on every revision: a revision is a new DRAFT version and must be submitted and
    approved again (auto-approval applies when under the threshold).
- D3 On customer acceptance — always, no setting — ONE transaction: quotation SENT → APPROVED →
  CONVERTED; CRM updated (lead → WON via transitionLead, a LeadActivity and a customer-timeline
  entry "Customer accepted QT-… vN · NPR …"); an unscheduled DRAFT job created. After commit, notify
  — deduplicated, one notification per person:
  · the customer: SMS + email (email only if on file) in the customer's preferredLocale (Phase E),
    template `quotation_accepted` (en + ne)
  · the lead's assigned salesperson and the quotation's creator: in-app + email
  · every active DISPATCHER user: in-app + email, linking the new job
  · the manager who approved it: in-app (skipped when auto-approved)
- D4 The customer side must be SIMPLE: no OTP, no login, no typed name. The link page shows the
  quotation and three buttons — Accept · Ask for changes · Decline — each with one confirm step.
  Ask for changes needs a short message; Decline takes an optional reason. IP and user agent are
  recorded automatically.
- Customer accounts come after launch (Phase K) and reuse this logic — put accept /
  ask-for-changes / decline in quotation.service.js functions, not in the public route handler.

READ FIRST
- CLAUDE.md, docs/ADMIN-PLAN.md §2, §4, §5 Phase F; docs/API.md CRM + surveys + public sections
- src/shared/stateMachines.js, permissions.js, enums.js (AUDIT_EVENTS), schemas/crm.js
- src/services/quotation.service.js (createQuotation, updateQuotation, sendQuotation,
  reviseQuotation, decideByToken), survey.service.js (buildQuotationFromSurvey and its
  compare-and-swap), job.service.js (createJob, markConverted), lead.service.js (transitionLead from
  Phase A), customer.service.js (timeline; preferredLocale from Phase E), notify.service.js,
  settings.service.js, audit.service.js (recordEvent from Phase B), src/crons/index.js
- src/routes/admin/crm.routes.js, src/routes/public.routes.js, src/middleware/rateLimit.js
- prisma/schema.prisma (Quotation, Job, JobTemplate, Role, Lead, Customer), prisma/seed.js +
  seed-data.js (settings, users, message templates)
- tests/api/03-crm.test.js, 02-public.test.js, tests/stateMachines.test.js, tests/permissions.test.js

RULES
- Backend only. State transitions only via stateMachines.js; every transition emits a Phase B
  domain event inside the same transaction.
- Postgres cannot use a new enum value in the same transaction that adds it — keep the enum
  migration separate from any data migration that uses the new values.
- Money through documentTotals / utils/money.js only.
- Tests first. Post the plan first, including the final transition table and migration list.

TASKS

F1.1 · State machine + schema
QuotationStatus adds PENDING_APPROVAL, OFFICE_APPROVED, CHANGES_REQUESTED, SUPERSEDED.
  DRAFT             → PENDING_APPROVAL      submit
  PENDING_APPROVAL  → OFFICE_APPROVED       approve (or auto-approve during submit)
  PENDING_APPROVAL  → DRAFT                 send back — note required
  OFFICE_APPROVED   → SENT                  send
  OFFICE_APPROVED   → DRAFT                 pull back before sending — note required
  SENT              → APPROVED | CHANGES_REQUESTED | REJECTED | EXPIRED   customer / expiry
  SENT | CHANGES_REQUESTED | REJECTED | EXPIRED → SUPERSEDED            staff revise
  APPROVED          → CONVERTED             job created
New Quotation fields: submittedAt, submittedById, approvedById, approvedAt, approvalNote,
autoApproved Boolean @default(false), sentBackReason, decidedUserAgent, supersededById. Reuse the
existing decisionNote for the customer's change request / decline message. Role enum adds MANAGER.
Unit tests: every allowed transition and a sample of forbidden ones; permissions test for MANAGER.

F1.2 · Staff endpoints (crm.routes.js — validated, audited)
  POST /admin/quotations/:id/submit               quotations:write
       DRAFT → PENDING_APPROVAL, or → OFFICE_APPROVED when total < quotation.autoApproveBelow
  POST /admin/quotations/:id/approve { note? }    quotations:approve   → OFFICE_APPROVED
       403 SELF_APPROVAL when makerChecker is on and the caller created it
  POST /admin/quotations/:id/send-back { note }   quotations:approve   → DRAFT
  POST /admin/quotations/:id/pull-back { note }   quotations:write     OFFICE_APPROVED → DRAFT
  POST /admin/quotations/:id/send                 now requires OFFICE_APPROVED
  POST /admin/quotations/:id/revise               from SENT / CHANGES_REQUESTED / REJECTED / EXPIRED:
       new DRAFT version (version+1, parentId, lines copied, the customer's message carried onto it);
       parent → SUPERSEDED
  GET  /admin/quotations?stage=drafts|approval|ready|with_customer|changes_requested|won|lost|all
Editing stays DRAFT-only (Phase A). Submit requires ≥1 line, a customer and validUntil in the future.
Notifications: submit → all approvers (in-app + email) unless auto-approved; approve / send back →
the creator (in-app). The existing convert-to-job endpoint stays for quotations APPROVED before this
phase shipped, and must be idempotent with F1.3.

F1.3 · Customer response (public, no login)
- GET /public/quotations/:token adds: version, status, `replaced` ({ token } of the newer version
  when it is SENT, else null), the customer's earlier change message if any, and `actions` (which of
  approve / request_changes / reject are available now).
- POST /public/quotations/:token/decide { decision: 'approve' | 'request_changes' | 'reject', note }
  note required (5–1000 chars) for request_changes, optional for reject; public rate limit; only
  from SENT; expiry checked at decide time; a second response → 422 with a friendly message.
- request_changes: SENT → CHANGES_REQUESTED, decisionNote = message, LeadActivity "Customer asked for
  changes: …" (lead stays QUOTED); notify salesperson + creator (in-app + email, message included);
  SMS the customer an acknowledgement in their preferredLocale (template
  `quotation_changes_received`, en + ne).
- reject: SENT → REJECTED, LeadActivity; the lead is NOT auto-marked LOST (sales decides); notify
  salesperson + creator.
- approve: the D3 transaction. Idempotency: a conditional updateMany on status (the survey.service
  compare-and-swap pattern) so a double tap or replay creates exactly one job. Job: type from the
  survey/service (REPAIR by default), title from service/quotation, customer, site, lead,
  quotationId, checklist from the service's JobTemplate when one exists, status DRAFT, unscheduled.

F1.4 · Cron + dashboard
Expiry sweep (Phase A) unchanged. GET /admin/dashboard adds role-aware counts: pending approval,
customers asked for changes, sent awaiting customer, accepted jobs not yet scheduled.

F1.5 · Seed
MANAGER user manager@gharjatan.com.np / Password123. Demo quotations in DRAFT, PENDING_APPROVAL
(created by sales), OFFICE_APPROVED, SENT and CHANGES_REQUESTED (with a Nepali customer message).
Settings rows quotation.makerChecker (true) and quotation.autoApproveBelow (0) with labels and hints.
Message templates quotation_accepted, quotation_changes_received and
quotation_changes_requested_staff (en + ne). The seed still runs on an empty database.

TESTS (API, written first)
- the full loop over HTTP, asserting the exact notification recipients and dedupe when the
  salesperson is also the creator, and that the customer SMS uses the ne template for a ne customer;
- self-approval 403; auto-approve below threshold for v1 AND for a revision; threshold 0 → never auto;
- send before approval → 422;
- request_changes → CHANGES_REQUESTED, note required, notifications + customer SMS;
- revise from CHANGES_REQUESTED → v2 DRAFT, parent SUPERSEDED; the old token shows replaced and cannot
  be accepted;
- decline does not mark the lead LOST;
- double accept → exactly one job; accept when the lead is already WON/LOST → activity note, and the
  acceptance still succeeds;
- expired → 422;
- audited events: quotation.submitted, auto_approved, office_approved, sent_back, pulled_back, sent,
  customer_approved, customer_changes_requested, customer_rejected, superseded, job.created.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npm run lint
Then against the dev server (npm run dev, seeded DB), walk the loop with curl or a scratch script
(not committed): submit as sales → approve as manager → send → decide request_changes via the token →
revise → submit → approve → send → decide approve → GET the job and the notifications. Paste the
condensed transcript in the report.

ACCEPTANCE
No quotation can reach SENT without approval (manager or threshold); customer responses loop
correctly through revision and re-approval; acceptance updates the CRM, notifies exactly the agreed
people once each and creates exactly one job; expired and superseded quotations cannot be accepted;
the whole trail is audited — all proven by API tests.

GIT
- Work on a local branch `admin/phase-f1-quotation-backend` created from DEVELOPMENT.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase E's work is present on DEVELOPMENT (its files and migrations
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
- docs/ARCHITECTURE.md "State machines": the new Quotation transitions and who may trigger each.
- docs/API.md: submit / approve / send-back / pull-back / send / revise, the stage filter, the public
  decide contract with request_changes, auto job creation, new error codes (SELF_APPROVAL, …).
- MaintainanceBackend/README.md: MANAGER in the seeded logins table; the "Status is the server's
  decision" paragraph mentions internal approval and customer change requests.
- CLAUDE.md: add the approval rule (no quotation is sent without internal approval) and the MANAGER
  role to the decisions table.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Transition table as built, migrations, endpoints, settings and templates added, notification recipients per event, test counts, the curl walk-through transcript, follow-ups. Do not start Phase F2.
````
