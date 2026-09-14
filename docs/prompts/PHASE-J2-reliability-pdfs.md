# Phase J2 — Reliability, PDFs & code-rule cleanup (backend)

~2 days · branch `admin/phase-j2-reliability` · requires Phase B

````text
You are working in the InvincibleMaintainance repo. This is Phase J (part 2 of 3) of
docs/ADMIN-PLAN.md: make background work reliable on more than one instance, generate real PDF
documents, and close the remaining code-rule gaps from the audit.

READ FIRST
- CLAUDE.md, docs/ADMIN-PLAN.md §3 (#13, #14, #15) and §5 Phase J, STATUS.md "Known gaps"
- MaintainanceBackend/src/services/notify.service.js, src/queues/index.js, handlers.js, worker.js,
  src/crons/index.js, src/lib/redis.js, src/server.js, src/config/env.js
- src/services/storage.service.js, media.service.js, quotation.service.js, invoice.service.js,
  warranty.service.js, public.service.js
- src/utils/pagination.js, src/middleware/validate.js, src/shared/schemas/common.js (listQuery)
- every file in src/routes/ (look for `prisma.` usage)
- Frontend: src/components/documents/*, the three public token pages (the PDF must match them)

RULES
- Redis stays optional: every change must work with and without REDIS_URL (in-process fallback).
- Tests first; docs/API.md, .env.example, STATUS.md updated. Post the plan first.

TASKS

J2.1 · Notifications through the queue
notify() enqueues instead of awaiting providers inside the request. Handler: send, update
MessageLog status (queued → sent/failed), retry with exponential backoff (e.g. 5 attempts), then
dead-letter status 'dead' visible in the Phase G message log. In-app Notification rows stay
synchronous (they are DB writes). Request context (requestId) travels in the job payload. Test:
a failing SMS provider → retries → dead, request returns quickly regardless.

J2.2 · Cron leader lock
Wrap each cron task in a Postgres advisory lock (pg_try_advisory_lock with a stable key per task)
so two API instances never run the same sweep concurrently; skip with a debug log when not
acquired. Works without Redis. Test with two concurrent invocations → one runs.

J2.3 · PDFs
Puppeteer (or playwright-core with system Chromium — justify) in the worker: render quotation,
invoice, payment receipt and warranty certificate from an internal HTML template that reuses the
same layout/data as the public token pages (bilingual, BS + AD dates, PAN/VAT no., totals from the
stored document — never recomputed). Store via storage.service, cache by document id + updatedAt,
regenerate on change. Endpoints: GET /admin/quotations/:id/pdf, /admin/invoices/:id/pdf,
/admin/invoices/:id/payments/:paymentId/receipt.pdf, /admin/warranties/:id/certificate.pdf and the
public token equivalents (/public/quotations/:token/pdf etc.). Attach the PDF to the send email.
Tests: totals text in the PDF equals the API totals for the README fixture; Devanagari glyphs
present (font embedded); token scoping (a token cannot fetch another document).

J2.4 · List query validation (#13)
Every list route validates `sort` against a per-resource allowlist and enum filters against their
enums, answering 400 with `details.allowedSort` instead of Prisma errors. Replace
listQuery.passthrough() usages with explicit per-route query schemas. Validate every :id and
sub-resource id param. Paginate the remaining unbounded lists (notifications, sla-board if large,
expiring warranties, renewals-due, sites, tech lists) with sensible caps.

J2.5 · Prisma out of routes (#15, D5)
Move every remaining `prisma.` call in src/routes/** into services (tech.routes.js sync handler,
platform, ops leftovers). Add a lint rule or a unit test that fails if a file under src/routes
imports lib/prisma.js.

J2.6 · S3 storage driver
Implement the documented S3 seam (@aws-sdk/client-s3), signed URLs for private media (bills,
signatures, PDFs), local disk remains default. Env vars in .env.example. Test with a mocked client.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npm run lint
Run API + worker with REDIS_URL unset and then set (if Redis available): send a quotation and show
MessageLog transitions and the attached PDF; start two API processes and show one cron run per tick.

ACCEPTANCE
Requests never wait on SMS/email; failed messages retry then dead-letter visibly; crons are
single-run across instances; branded bilingual PDFs match on-screen totals; no route imports
prisma; bad sort/filter values answer a helpful 400.

GIT
- Work on a local branch `admin/phase-j2-reliability` created from DEVELOPMENT.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase J1's work is present on DEVELOPMENT (its files and migrations
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
- docs/ARCHITECTURE.md: notification queue with retry/dead-letter, cron advisory locks, PDF
  pipeline, S3 driver and signed URLs.
- docs/API.md: PDF endpoints (admin + public), 400 details.allowedSort, new pagination caps.
- .env.example: S3_*, Chromium path, queue retry settings; STATUS.md "Known gaps" pruned.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Design choices (queue payloads, lock keys, PDF engine), test counts, manual results, follow-ups.
````
