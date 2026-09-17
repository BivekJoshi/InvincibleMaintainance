# Architecture

## Processes

| Process | Port | Responsibility |
|---|---|---|
| `MaintainanceBackend` — `npm run dev` / `npm start` | 4000 | REST API, auth, business logic, Prisma; runs the schedulers and, without Redis, the job queue in-process |
| `MaintainanceBackend` — `npm run worker` | — | Standalone BullMQ worker (SMS, email, SLA sweep, invoice/quotation/warranty/AMC/reminder tasks) when `REDIS_URL` is set |
| `MaintainanceFrontend` — `npm run dev` | 5400 | **One Vite app** serving the public site, the `/admin` back office and the `/tech` field PWA, split by route group and lazy-loaded. Vite proxies `/api` and `/uploads` to :4000 |
| postgres | 5432 | System of record |
| redis (optional) | 6379 | Queues, public response cache, rate-limit counters — in-memory fallbacks when blank |
| S3-compatible storage (optional) | 9000 | Media originals + derivatives; local disk is the default driver |

## Request pipeline (API)

```
pino-http (genReqId → X-Request-Id, redacted request line)
  → requestContext (AsyncLocalStorage: requestId, ip, userAgent, actorType=public)
  → helmet → cors(allowlist; else 403 FORBIDDEN_ORIGIN, exposes X-Request-Id) → compression
  → express.json / urlencoded → cookieParser → rateLimit → route
      → validate(zodSchema)          400 on failure
      → authenticate                 401 on failure; fills userId, role, actorType=user
      → authorize(...roles)          403 on failure
      → controller (thin)
          → service (all business logic, transactions, recordEvent)
              → prisma (audit extension)
  → errorHandler (req.log: 5xx error + stack + Sentry · Prisma validation warn · other 4xx info
                  { code, status }; a 5xx never leaks internals outside development)
```

- **Request id.** An incoming `X-Request-Id` is kept only if it matches `^[A-Za-z0-9._-]{8,64}$` —
  anything else could forge or split a log line — otherwise a UUID is generated. It is echoed on the
  response and CORS exposes it.
- **Request context.** `src/lib/requestContext.js` (`runWithContext` / `getContext` / `setContext`) holds
  `{ requestId, userId, role, ip, userAgent, actorType }`. Body parsers and multer deliver the body from
  stream events, which Node runs outside any AsyncLocalStorage run, so the middleware binds `req.emit`
  and `res.emit` to the context; without that everything after `express.json()` would see no context.
  Background tasks run inside `runWithContext({ actorType: 'system', requestId: '<task>:<job id>' })`.
- **Redaction.** pino `redact` (censor `[redacted]`): `req.headers.authorization`, `req.headers.cookie`,
  `res.headers["set-cookie"]`, and `password`, `newPassword`, `currentPassword`, `token`, `refreshToken`,
  `accessToken`, `otp`, `passwordHash`, `tokenHash`, `publicToken` at the top level and two levels down.
  A log formatter masks phone numbers under `phone`, `altPhone`, `to`, `toAddress`, `mobile`,
  `onCallPhone` to the last four digits. The request serializer replaces the token in
  `/public/{quotations,invoices,warranties}/:token` URLs.
- **Log sinks.** stdout always (pino-pretty in development, JSON otherwise). With `LOG_FILE` set, a
  `pino-roll` target adds JSON files rotated daily — `LOG_FILE=/var/log/api/api.log` writes
  `api.2026-09-14.1.log` — keeping the current file plus `LOG_RETENTION_DAYS` older ones (default 14). `LOG_LEVEL` defaults to `info` in production, `debug` otherwise.
- **Sentry.** With `SENTRY_DSN` set, `src/lib/sentry.js` imports `@sentry/node` lazily and reports 5xx
  errors, failed tasks, unhandled rejections and uncaught exceptions, tagged with `requestId`. Unset,
  nothing is loaded.

## Cross-cutting services

- **`services/numbering.js`** — `QT-`/`JOB-`/`INV-`/`AMC-` sequences, per BS fiscal year, allocated
  inside the same transaction as the record to avoid gaps and races.
- **`services/money.js`** — paisa arithmetic, VAT, rounding. Nothing multiplies money outside this file.
- **`services/nepaliDate.js`** — AD↔BS conversion, fiscal year resolution. Display-only.
- **`services/storage.js`** — S3 adapter, signed URLs, sharp derivative pipeline.
- **`services/notify.js`** — channel-agnostic `notify(templateKey, to, vars)`; SMS adapter interface
  with a Sparrow implementation (Aakash as a drop-in alternative), nodemailer for email, DB rows for in-app.
- **`services/cache.js`** — Redis get/set with tag-based invalidation; publishing any CMS record
  busts the `public:*` tags it touches.
- **`services/sla.js`** — schedules warn/breach jobs on lead creation, cancels them on first response.

## State machines

Transitions live in `MaintainanceBackend/src/shared/stateMachines.js` and are enforced in the
service layer — never by trusting a status string from the client.

```
Lead      NEW → CONTACTED → INSPECTION_SCHEDULED → QUOTED → WON | LOST ;  LOST → CONTACTED
Quotation DRAFT → PENDING_APPROVAL → OFFICE_APPROVED → SENT → APPROVED → CONVERTED
          PENDING_APPROVAL | OFFICE_APPROVED → DRAFT (send back · pull back)
          SENT → CHANGES_REQUESTED | REJECTED | EXPIRED
          SENT | CHANGES_REQUESTED | REJECTED | EXPIRED → SUPERSEDED (revise → a new DRAFT version)
Job       DRAFT → SCHEDULED → ASSIGNED → EN_ROUTE → IN_PROGRESS ⇄ ON_HOLD
                → COMPLETED → VERIFIED ;  any → CANCELLED
Invoice   DRAFT → SENT → PARTIAL → PAID ;  SENT|PARTIAL → OVERDUE ;  any → VOID
          voiding a payment walks it back:  PAID → PARTIAL | SENT | OVERDUE ;  PARTIAL → SENT
```

**Quotations — who moves them (Phase F).** No quotation reaches the customer without internal approval.
`APPROVED` means the *customer* accepted; `OFFICE_APPROVED` is the office's approval.

| From | To | Trigger | Who |
|---|---|---|---|
| DRAFT | PENDING_APPROVAL | submit (≥1 line, a customer, `validUntil` in the future) | `quotations:write` — SALES, MANAGER, ADMIN |
| PENDING_APPROVAL | OFFICE_APPROVED | approve — never the quotation's creator while `quotation.makerChecker` is on (403 `SELF_APPROVAL`) | `quotations:approve` — MANAGER, ADMIN |
| PENDING_APPROVAL | OFFICE_APPROVED | auto-approval inside the submit, when total < `quotation.autoApproveBelow` (paisa, 0 = off), any version | the system (`actorType: system`) |
| PENDING_APPROVAL | DRAFT | send back, note required | `quotations:approve` |
| OFFICE_APPROVED | SENT | send (issues the link, SMS + email) | `quotations:write` |
| OFFICE_APPROVED | DRAFT | pull back before sending, note required; the approval is cleared | `quotations:write` |
| SENT | APPROVED → CONVERTED | the customer taps Accept: one transaction also wins the lead and creates the DRAFT job | the customer (`public`) |
| SENT | CHANGES_REQUESTED · REJECTED | Ask for changes (message required) · Decline (reason optional) | the customer (`public`) |
| SENT | EXPIRED | past `validUntil` — on open, on decide, or the hourly task | the system |
| SENT · CHANGES_REQUESTED · REJECTED · EXPIRED | SUPERSEDED | revise: a new DRAFT version (lines and the change request copied) that is approved again | `quotations:write` |
| APPROVED (pre-Phase F) | CONVERTED | convert-to-job | `jobs:write` — DISPATCHER, ADMIN |

Every quotation move is a guarded `updateMany` on the status just read (`quotation.service.js#moveStatus`,
`claimAnswer` for the customer), with its domain event in the same transaction; moving to the status it already
has is refused. The customer's three answers are service functions (`acceptQuotation`,
`requestQuotationChanges`, `declineQuotation`), not route code, so a customer account (Phase K) reuses them.
Notifications go to named people once each (`notify.service.js#notifyUsers`), after the commit.

Every lead status change goes through `lead.service.js#transitionLead(tx, leadId, to, opts)`, which
asserts the transition, stamps `closedAt` and writes the `status_change` timeline entry inside the
caller's transaction. A quotation's `validUntil` is checked when the customer opens the link, when
they decide, and hourly by the `quotation:expire` task — one rule (`isExpired`) for all three.

## Logging & audit

Two layers with different readers.

| | Application log | Audit log |
|---|---|---|
| Reader | operators, on-call | the business: who changed what, when, from where |
| Where | stdout (+ `LOG_FILE`), Sentry | `AuditLog` table, `GET /admin/audit-logs` |
| Written by | pino, pino-http, `req.log` | the Prisma audit extension and `recordEvent` |
| Retention | `LOG_RETENTION_DAYS` rotated files; stdout is the platform's | kept; never deleted by the app |
| Joined by | `requestId` on every line (pino `mixin` reads the request context) | `requestId` column |

**Model changes.** The extension in `src/lib/prisma.js` audits every write operation on every model
outside `AUDIT_SKIP`. It reads the before-state with the same `where` (ids first for `*Many`, one row per
record, capped at 500), and stores a shallow, redacted diff of the scalar columns that changed
(`src/lib/auditDiff.js`, driven by the Prisma DMMF so relations never leak in).

**Transactions.** The exported `prisma` wraps `$transaction(fn)` so `fn` runs with its transaction client
in an AsyncLocalStorage. When Prisma marks an operation as part of an interactive transaction
(`__internalParams.transaction.kind === 'itx'`), the extension does its before-read and its audit insert
through that client, so a rollback removes the audit row with the change, and a failed audit insert fails
the transaction. Writes outside an interactive transaction (plain calls, array-form `$transaction`) are
audited through the base client after they succeed; a failed audit insert there is logged at warn.
`tests/api/11-logging-audit.test.js` proves both. `__internalParams` is a Prisma internal: re-check it
on a Prisma major upgrade (the rollback test fails loudly if it changes).

**Domain events.** `audit.service.js#recordEvent(event, { model, recordId, before, after, meta, actorId }, tx)`
records a named business moment in the caller's transaction. Names live in `shared/enums.js`
(`AUDIT_EVENTS`); `docs/API.md` lists when each fires. A model change and its event share a `requestId`,
so "what happened" and "what changed" read together.

**Actors.** `user` (a valid access token, or the user a login just signed in), `public` (forms and token
links — ip and user agent say who), `system` (tasks, and scripts with no context).

**Background tasks.** `queues/index.js#runJob` runs every handler, BullMQ or in-process, and logs
`{ task, jobId, durationMs, count }` on finish or the error with the job id on failure.

## Offline strategy (technician PWA)

- Service worker caches the app shell and today's job payloads.
- Mutations are appended to an IndexedDB queue with a client-generated `idempotencyKey`.
- `POST /tech/sync` replays them; the server dedupes on the key, so a double-send is harmless.
- Photos upload separately, append-only, so they never conflict.
- Conflicts on scalar fields resolve last-write-wins, with every attempt recorded in `JobStatusEvent`.

## Security

- Argon2id passwords; access tokens in memory only (never `localStorage`); refresh in httpOnly cookie.
- RBAC enforced server-side on every admin route; UI hiding is cosmetic.
- Public token links (quotation, warranty) are random 32-byte, single-purpose, expiring, scoped to one record.
- Uploads validated by magic bytes, not extension; EXIF stripped; private media served via signed URLs.
- CSP, HSTS, no inline scripts. Turnstile + honeypot + timing + IP rate limit on all public POSTs.
- PII exports (`leads.csv`) are recorded as `export.csv` audit events with the actor and the filters used.
- No access token, refresh cookie or password reaches a log line; see *Redaction* above.
- **Sessions.** Each sign-in is one refresh token row (hashed, with ip and user agent), rotated on every refresh.
  Ending sessions revokes the rows: an admin's "revoke all" (`DELETE /admin/users/:id/sessions`, event
  `auth.sessions_revoked`), a password change or reset, and disabling or deleting an account. A revoked session
  cannot be refreshed. An access token already issued stays valid for its 15 minutes — except that
  `authenticate` re-reads the account on every request, so a **disabled** account is refused at once.
- **Admins never set or see a password.** A new account gets a 72-hour "choose your password" link by email; a
  forgotten one, the normal 1-hour reset link (`POST /admin/users/:id/send-password-reset`, event
  `auth.password_reset_requested` with `by: admin`). The raw token exists only in that email: the database holds its
  hash, the message log holds the message with the token replaced by `[redacted]` (such a message cannot be retried
  from the log), and no response carries it. The link opens `<web origin>/reset-password`.
- **Lockout.** Five failed sign-ins lock an account for 15 minutes (`auth.locked`); an admin can lift it early
  (`auth.unlocked`). The login activity screen lists every `auth.*` event with ip and user agent.
- **Admin screens hold no more than they need.** The message log shows a phone's last four digits and an email's
  first two letters; a record's History tab has no ip or user agent (those stay in the ADMIN-only audit log).

## Environments

`.env.example` covers: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `S3_*`,
`SMTP_*`, `SPARROW_TOKEN`, `SPARROW_FROM`, `TURNSTILE_SECRET`, `PUBLIC_WEB_ORIGIN`,
`ADMIN_ORIGIN`, `VAT_RATE`, `SLA_LEAD_MINUTES`, `WARRANTY_DEFAULT_DAYS`, `LOG_LEVEL`, `LOG_FILE`,
`LOG_RETENTION_DAYS`, `SENTRY_DSN`.
Config loader validates all of them at boot and exits on a missing required key.
