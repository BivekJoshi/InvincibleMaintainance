# Phase G — Audit, logs & platform screens

~3 days · branch `admin/phase-g-audit-platform` · requires Phases B + C (E for RecordHistory)

````text
You are working in the InvincibleMaintainance repo. This is Phase G of docs/ADMIN-PLAN.md: make
the logging built in Phase B visible and useful, and give admins the platform screens — users,
message templates, delivery logs, login activity.

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md, docs/ADMIN-PLAN.md §5 Phase G
- docs/API.md "Admin — Platform" (as updated in Phase B)
- Backend: src/routes/admin/platform.routes.js (users CRUD with raw prisma ~87–137, audit-logs,
  message-templates, message-logs), src/services/audit.service.js, auth.service.js,
  notify.service.js, src/shared/enums.js (AUDIT_EVENTS), permissions.js, prisma/schema.prisma
  (User, AuditLog, MessageTemplate, MessageLog, Technician), tests/api/09-platform.test.js
- Frontend: components/common/RecordHistory.jsx and the lead/customer history endpoints (Phase E),
  src/components/layout/AdminLayout.jsx, src/api/*

RULES
- DataTable v2 / ResourceForm / registry only. ADMIN-only screens hidden from other roles AND
  refused by the API.
- D5 (Phase A): route files must not call prisma — move the users and message-log handlers you
  touch into services (user.service.js, platform/message services) as part of this phase.
- Tests first for backend changes; docs/API.md updated. Post the plan first.

BACKEND

G1 · Generic record history
Generalise Phase E: a helper that, given (model, recordId, capability), returns redacted paginated
audit rows; mount GET /admin/<resource>/:id/history for quotations, jobs, invoices, services and
every CMS resource (through the CRUD factory), each guarded by that resource's read capability.
API test RBAC for three of them.

G2 · Users
Move to user.service.js. Add: POST /admin/users/:id/send-password-reset (admin-initiated; emails
the normal reset link — admins never set or see passwords), POST /admin/users/:id/unlock (clears
failedLogins/lockedUntil), GET /admin/users/:id/sessions (active refresh tokens: created, ip, UA)
and DELETE /admin/users/:id/sessions (revoke all). Creating a TECHNICIAN or SURVEYOR also
creates/links the Technician profile (or clearly returns what is missing). All emit Phase B events
(user.created, user.disabled, user.role_changed, auth.sessions_revoked, auth.unlocked).

G3 · Login activity
GET /admin/login-activity (ADMIN): auth.* audit events, filters user, event, ip, from/to; plus a
per-user summary (last login, failures in 24h, locked until).

G4 · Message templates + logs
- POST /admin/message-templates/:id/preview { vars } → rendered subject/body; response lists the
  placeholders found and any missing vars. Placeholder syntax per notify.service.js.
- GET /admin/message-logs: validated filters channel, status, templateKey, relatedModel,
  relatedId, q (toAddress, masked in the response except last 4 digits), from/to; paginated.
- POST /admin/message-logs/:id/retry for failed messages (ADMIN), audited.

FRONTEND (Platform nav group, ADMIN)

G5 · Audit log viewer — /admin/platform/audit
DataTable v2 with filters event (grouped by prefix), model, actor (relation), actorType, requestId,
record id, date range. Row expands to a before/after diff (added/removed/changed highlighting via
semantic tokens), ip, user agent, request id with "show everything from this request" filter.
Record column links to the record page where one exists.

G6 · RecordHistory everywhere — add a History tab to: quotation, customer, lead (exists), service
and every registry edit page (via the generic endpoint), job/invoice pages when they exist.

G7 · Users & roles — /admin/platform/users: list (role, active, last login, locked badge),
create/edit sheet (name, email, phone, role, active), actions: disable/enable (not self),
send reset link, unlock, sessions dialog with revoke all. A read-only role → capability matrix page
rendered from src/helpers/permissions.js so admins can see what each role can do.

G8 · Message templates — registry/editor grouped by key with EN | NE and channel (sms/email)
variants, live preview panel using the preview endpoint, SMS length + segment counter (GSM vs
Unicode — Devanagari is Unicode, 70 chars/segment), placeholder chips.

G9 · Message logs — /admin/platform/messages: delivery table with status chips, error text,
related record link, retry for failed.

G10 · Login activity — /admin/platform/login-activity.

TESTS
API: history RBAC; admin cannot disable self; reset-link endpoint never returns a token; unlock
clears lock; revoke sessions invalidates refresh; preview reports missing vars; message-log phone
masking; retry audited. vitest: SMS segment counter with English and Devanagari fixtures; diff
renderer for nested/JSON fields.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npm run lint
  cd MaintainanceFrontend && npm test && npm run lint && npm run build
Manual as admin@gharjatan.com.np: trace one quotation from creation to customer approval in the
audit viewer, then jump to "everything from this request" for the approval; lock
sales@gharjatan.com.np with 5 bad logins, see it in login activity, unlock it; edit an SMS template
in Nepali and preview it. As sales@gharjatan.com.np: Platform is absent from the nav and
/api/v1/admin/users and /admin/audit-logs return 403.

ACCEPTANCE (ADMIN-PLAN Phase G = v1 Phase 1 acceptance)
An ADMIN can trace any record's full history and any request's effects; users, sessions, templates
and delivery logs are manageable; non-admins are refused by the API and see no Platform nav.

GIT
- Work on a local branch `admin/phase-g-audit-platform` created from DEVELOPMENT.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase F2's work is present on DEVELOPMENT (its files and migrations
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
- docs/API.md: users actions (reset link, unlock, sessions), login activity, template preview,
  message-log filters + retry, generic record history endpoints.
- docs/ARCHITECTURE.md security section: session revocation, admin-initiated resets.
- CLAUDE.md: D5 progress (which routers are now prisma-free).
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Screens, endpoints, prisma calls moved out of routes, test counts, manual results, follow-ups.
Do not start Phase H.
````
