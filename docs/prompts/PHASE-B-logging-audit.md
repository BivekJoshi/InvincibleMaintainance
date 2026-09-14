# Phase B — Logging & audit backbone (backend)

~3 days · branch `admin/phase-b-logging-audit` · requires Phase A

````text
You are working in the InvincibleMaintainance repo. This is Phase B of docs/ADMIN-PLAN.md:
"proper logging". Backend only. Two layers: application logs (pino, stdout/file, for operators)
and the audit log (AuditLog table, for the business: who changed what, when, from where).

READ FIRST
- CLAUDE.md, docs/ADMIN-PLAN.md §3 (#4, #9, #14) and §5 Phase B
- MaintainanceBackend/src/lib/logger.js, src/app.js, src/config/env.js, .env.example
- src/middleware/error.js, src/middleware/authenticate.js (it sets an audit context ~line 31)
- src/lib/prisma.js (the audit extension, ~38–64, AUDIT_SKIP), src/services/audit.service.js
- src/services/auth.service.js, settings.service.js, lead.service.js (merge ~353),
  quotation.service.js, invoice.service.js, job.service.js, notify.service.js
- src/crons/index.js, src/queues/index.js, src/queues/worker.js
- src/routes/admin/platform.routes.js (GET /audit-logs)
- tests/api/09-platform.test.js and tests/api/helpers.js

RULES
- Follow CLAUDE.md. Schema change → one named migration + docs/DATA-MODEL.prisma + docs/API.md.
- Tests first for every behaviour change. Do not change public response shapes except where stated.
- No new dependency without naming it and why in the plan (expected: pino-roll, @sentry/node).
- Post a plan before editing, including how audit rows will be written inside interactive
  transactions — verify the current behaviour with a test before redesigning it.

TASKS

B1 · Request context (AsyncLocalStorage)
Create src/lib/requestContext.js exporting `runWithContext`, `getContext`, `setContext`
({ requestId, userId, role, ip, userAgent, actorType: 'user'|'public'|'system' }).
- A middleware placed right after pino-http opens the context for every request (actorType
  'public', ip from req.ip with trust proxy, userAgent truncated to 300 chars).
- authenticate.js fills userId/role and actorType 'user' — replace whatever it does today at ~31.
- Crons and queue handlers run inside `runWithContext({ actorType: 'system', requestId: <job/cron id> })`.
- genReqId: accept an incoming x-request-id only if it matches /^[A-Za-z0-9._-]{8,64}$/, else
  generate a UUID (prevents log injection). Echo it as the `X-Request-Id` response header, and
  expose it via CORS exposedHeaders.

B2 · Application logs
- pino `redact` (censor '[redacted]'): req.headers.authorization, req.headers.cookie,
  res.headers["set-cookie"], and any *.password, *.newPassword, *.currentPassword, *.token,
  *.refreshToken, *.accessToken, *.otp, *.passwordHash, *.tokenHash, *.publicToken.
  Mask phone numbers in logged bodies to the last 4 digits via a serializer.
- pino `mixin` adds requestId/userId from the context to every line, so service-level logs
  correlate with the request line.
- env.js: LOG_LEVEL defaults to 'info' when NODE_ENV=production, 'debug' otherwise. Add LOG_FILE
  (optional path) and LOG_RETENTION_DAYS (default 14); when LOG_FILE is set, add a pino-roll
  daily-rotating file target alongside stdout. Add both to .env.example with comments.
- error.js: log with req.log (not the global logger). 5xx → error with stack; Prisma validation →
  warn; other 4xx → info with { code, status } (no stack). A CORS rejection must answer 403
  FORBIDDEN_ORIGIN, not 500. Never leak internals in the response.
- Sentry: if SENTRY_DSN is set, init @sentry/node (lazy import) and report 5xx + unhandled
  rejections/uncaught exceptions with requestId as a tag; no-op when unset.
- Crons/queues: each run logs { task, durationMs, count } at info on finish and error with the
  job id on failure.

B3 · AuditLog schema
Migration `audit_log_context_and_diff`: add requestId String?, userAgent String?,
actorType String @default("user"), event String?, before Json?, after Json?. Keep `changes`
readable for existing rows (do not drop it; new rows may leave it null or mirror the diff —
choose one and document it). Indexes: (event, createdAt), (requestId).

B4 · Audit extension (src/lib/prisma.js)
- Cover create, update, delete, upsert, createMany, updateMany, deleteMany.
- Capture the before-state for update/upsert/delete (findUnique by the same where) for audited
  models; for *Many operations capture ids first and write one row per id (fixes the lead-merge
  `{ in: [...] }` recordId bug). Cap bulk rows (e.g. 500) and log a warning past the cap.
- Store before/after as a redacted, shallow diff of changed scalar fields only. Redact
  passwordHash, tokenHash, publicToken, otp*, and any field named *secret*.
- Fill requestId/userId/ip/userAgent/actorType from the request context.
- Rows written for operations inside an interactive transaction must roll back with it. Prove it
  with a test (throw inside prisma.$transaction after an update → no AuditLog row).
- Revisit AUDIT_SKIP: keep high-volume/append-only models skipped, but Translation changes MUST be
  audited (they are editor content). Settings (upsert) and home-sections must now be audited.

B5 · Domain events
Extend audit.service.js with `recordEvent(event, { model, recordId, before, after, meta }, tx?)`
and call it at these business moments (inside the same transaction as the change):
  lead.created · lead.status_changed · lead.assigned · lead.merged · lead.converted
  quotation.created · quotation.sent · quotation.customer_approved · quotation.customer_rejected
  quotation.expired · quotation.revised
  job.created · job.status_changed · job.assigned · job.completed · job.verified
  invoice.created · invoice.sent · invoice.voided · payment.recorded · payment.voided
  survey.submitted · survey.returned · survey.quoted
  auth.login · auth.login_failed · auth.locked · auth.logout · auth.password_changed ·
  auth.password_reset_requested
  settings.changed · export.csv · cms.deleted · cms.restored · cms.purged · user.created ·
  user.disabled · user.role_changed
Put the event names in src/shared/enums.js (AUDIT_EVENTS) so the frontend can mirror them.
Leave quotation.submitted / auto_approved / office_approved / sent_back / pulled_back /
customer_changes_requested / superseded for Phase F, but reserve the names now.

B6 · Audit read API
GET /admin/audit-logs gains validated filters: event, actorType, requestId, model, recordId,
actorId, from, to, q; paginated like every list; includes actor { id, name, role }. Keep ADMIN only
(per-record history for other roles comes in Phases E/G).

TESTS (write first)
- Logger: a captured pino destination for a request carrying Authorization + Cookie + a
  password body contains none of those values and contains '[redacted]'.
- X-Request-Id echoed; an invalid incoming id is replaced.
- The request log line's reqId equals the AuditLog.requestId written by that request.
- PATCH /admin/settings → audit row with event settings.changed, before and after.
- Public quotation decision → actorType 'public', ip and userAgent set, event customer_approved.
- Lead merge of 2 duplicates → one audit row per merged id, no warning logged.
- Rolled-back transaction → no audit row.
- 5 failed logins → auth.login_failed ×5 and auth.locked.
- CORS rejection → 403.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npm run lint
Start the API with LOG_FILE set, make a few authenticated requests, and show that
`grep -c Bearer <logfile>` is 0 and that one requestId appears in both the log file and AuditLog.

ACCEPTANCE (ADMIN-PLAN Phase B)
No token or cookie value in any log; every request log line and its audit rows share a requestId;
settings changes show before/after; public writes are attributed to 'public' with ip + UA; every
listed domain event is emitted and asserted in at least one API test. docs/API.md documents the
new audit-log filters, X-Request-Id and the event list; .env.example has the new variables.

GIT
- Work on a local branch `admin/phase-b-logging-audit` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase A's work is present on `prabesh` (its files and migrations
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
- docs/ARCHITECTURE.md: request pipeline (request context, redaction, X-Request-Id, log sinks,
  Sentry) and a new "Logging & audit" section (app logs vs audit log, domain events, retention).
- docs/API.md: X-Request-Id, audit-log filters, the full AUDIT_EVENTS list with when each fires.
- MaintainanceBackend/README.md security/logging bullets; .env.example LOG_FILE, LOG_RETENTION_DAYS,
  SENTRY_DSN with comments.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Files changed, migration name, the transaction strategy you chose and the test proving it, events
implemented vs reserved, test counts before → after, follow-ups. Do not start Phase C.
````
