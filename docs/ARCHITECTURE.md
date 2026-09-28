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
- **`services/pipeline.service.js`** (Phase L1) — the clocks after the first response. `leads:followups`
  (every 15 min) tells an owner when a lead's next action falls due, and from `pipeline.digestHour` sends
  one digest per salesperson per Kathmandu day (the scheduler runs intervals, not clock times, so "09:00"
  is the first run after the hour). `pipeline:stale` (hourly) reminds about quiet contacted leads, visits
  without surveys, unquoted surveys, waiting approvals, and unanswered or expiring quotations — once per
  day while each holds. Every reminder carries `Notification.dedupeKey` (`<rule>:<record>:<day>:<userId>`,
  unique; inserted with `skipDuplicates`), so a second run or a second instance sends nothing.
- **`services/visit.service.js`** (Phase L5) — the site visit as the customer sees it. A booked INSPECTION job
  sends `visit_booked` (window, surveyor, `/visit/:token`) to the customer and the site contact; the public
  page takes Confirm · Need another time (latest answer wins, IP and time kept; a new window clears it).
  `visits:remind` (every 15 min, from `visits.reminderHour` 17:00 Kathmandu) reminds tomorrow's visits once:
  the job's `visitReminderSentAt` is claimed compare-and-swap before the SMS goes — an SMS has no
  `Notification` row to carry a dedupeKey, so the claim is on the job, and a new window clears it.

## State machines

Transitions live in `MaintainanceBackend/src/shared/stateMachines.js` and are enforced in the
service layer — never by trusting a status string from the client.

```
Lead      NEW → CONTACTED → INSPECTION_SCHEDULED → QUOTED → WON | LOST ;  LOST → CONTACTED
          QUOTED = the customer HAS a quotation: sendQuotation moves the lead (a draft never does).
          LOST carries lostCategory (required) and lostAtStage; every move restarts stageEnteredAt;
          WON/LOST clear the next action. A decline or an expiry only asks sales "mark lost?".
Quotation DRAFT → PENDING_APPROVAL → OFFICE_APPROVED → SENT → APPROVED → CONVERTED
          PENDING_APPROVAL | OFFICE_APPROVED → DRAFT (send back · pull back)
          SENT → CHANGES_REQUESTED | REJECTED | EXPIRED
          SENT | CHANGES_REQUESTED | REJECTED | EXPIRED → SUPERSEDED (revise → a new DRAFT version)
Job       DRAFT → SCHEDULED → ASSIGNED → EN_ROUTE → IN_PROGRESS ⇄ ON_HOLD
                → COMPLETED → VERIFIED ;  any → CANCELLED
Invoice   DRAFT → SENT → PARTIAL → PAID ;  SENT|PARTIAL → OVERDUE ;  any → VOID
Purchase  DRAFT → ORDERED → RECEIVED ;  DRAFT|ORDERED → CANCELLED   (list; Phase L7 — RECEIVED writes PURCHASE stock)
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

**Won → hand-off (Phase L6, `services/handoff.service.js`).** Accept (and a staff convert-to-job) is one transaction:

1. SENT → APPROVED, guarded (`claimAnswer`) — a double tap or a replayed decide claims nothing and stops here;
2. the lead → WON (`transitionLead`; a staff convert wins it too);
3. the job — typed from the service's `jobType`, `plannedDays` from the estimate — whose creation claims
   APPROVED → CONVERTED, guarded (`markConverted`): the second guard;
4. `JobLine`s from the non-optional BOQ rows — unique `(jobId, quotationItemId)`;
5. `JobRequirement`s from the take-off — material packs and labour days by trade, no rates (L-D4);
6. the ADVANCE invoice for the ON_ACCEPT stage — `paymentStageId` unique (a stage is billed once), and
   `Job.advanceInvoiceId` unique — its total the stage's to the paisa (`money.js#stageDocument` uses the
   schedule's own VAT split, never VAT recomputed on the part).

The library, the templates and the take-off are read before the transaction (`handOffPlan`). After it commits the
customer is asked for the advance (`advance_due`, SMS in their language and email) and the dispatchers are told.

**The advance gate (L-D3).** `job.service.js#assertAdvanceCleared` runs in `scheduleJob`, `assignTechnicians`,
`changeStatus` (every move but CANCELLED and ON_HOLD) and `completeJob`: while the job's advance invoice is neither
PAID nor VOID, there is no override and `job.advanceGate` is on, it answers 422 `ADVANCE_UNPAID`. A MANAGER or
ADMIN may override with a reason (`job.advance_overridden`). Paying the advance in full tells the dispatchers.

**Variations (Phase L7).** A variation order is a quotation of kind VARIATION against a job, so it travels the
quotation machine unchanged — DRAFT → PENDING_APPROVAL → OFFICE_APPROVED → SENT → APPROVED → CONVERTED, with the
maker-checker, the margin gate and the customer's link. Only it may carry negative rows (omissions; `lineAmount`
and `documentTotals` round negatives away from zero, and a net-negative total takes no discount and never
auto-approves). Accepting it runs `handoff.service.js#applyVariation` in the accept transaction instead of the
hand-off: its rows join the job as VARIATION lines and its take-off as VARIATION requirements, APPROVED →
CONVERTED guarded — no new job, no lead, no advance.

## Billing

Four kinds of invoice (`Invoice.kind`), each line an ITEM or a DEDUCTION (`InvoiceItem.kind`, negative):

| Kind | Raised by | What it bills |
|---|---|---|
| STANDARD | the accountant (a hand invoice), or `createFromJob` on a job with no quotation | its lines; an unquoted job bills its billable materials and its logged time at the rate card's labour rate — never a technician's own pay (L0) |
| ADVANCE | the hand-off, on acceptance (L6) | the ON_ACCEPT stage of the payment schedule |
| RUNNING | `POST /admin/jobs/:id/invoices/stage` (L8) | a MILESTONE stage |
| FINAL | `createFromJob` on a BOQ job (L8) | the contract by its type, less every stage bill |

A stage's bill (ADVANCE, RUNNING) carries the schedule's own amount and VAT split (`money.js#stageDocument`), and
`paymentStageId` is unique — a stage is billed once; voiding the bill frees the stage. The FINAL bill
(`billing.service.js#finalBillPlan`, previewed by `GET /admin/jobs/:id/final-bill`):

- **LUMP_SUM** — every job line at its quoted quantity (a provisional line at its measured quantity; an omission as
  quoted), less each source document's own discount (the quotation's and each accepted variation's).
- **ITEM_RATE** — every line at its measured quantity (omissions as quoted) × its rate, each document's discount
  scaled to what was measured of its own lines (`proRata`); the measurement must be closed.
- Both then take off each earlier ADVANCE and RUNNING bill that is not void as a DEDUCTION line, with the VAT that is
  left (`money.js#finalBillDocument` on `finalBillTotals`) — so advance + running + final = the contract to the
  paisa, VAT included. A final that would come out negative is refused (`FINAL_BELOW_BILLED`); credit notes are
  deferred.

Worked example (the seeded item-rate job): damp treatment 240 sq.ft at Rs 220 and plaster 400 sq.ft at Rs 95,
Rs 2,000 off, 13 % VAT, 50/40/10 — the advance and the running bill are 50 % and 40 % of Rs 1,00,344.00 (taxable
Rs 88,800.00). Measured 5 % over (252 and 420 sq.ft) with a 60 sq.ft variation measured at 63: lines Rs 1,01,325.00,
the discount scaled to Rs 2,100.00, taxable Rs 99,225.00, VAT Rs 12,899.25 — contract Rs 1,12,124.25; the final is
that less the advance and the running bill. As lump sum the same quotation's contract is Rs 1,00,344.00.

`jobCosting.invoiced` (and the job-margin report) sums a job's invoice lines net of each invoice's discount, void
invoices left out — deductions are negative, so a job billed advance → running → final comes to its contract's
taxable value.

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

As built in Phase H2 (2026-09-27):
- **The service worker** (`public/sw.js`, production only) caches the app shell (`/`, `index.html`, the
  manifest) and same-origin static files cache-first as they are fetched (`/uploads` included); it never
  caches `/api/`, and a navigation falls back to the cached `index.html`. Job payloads are NOT cached by the
  worker: the screens work offline within a running session from RTK Query's cache (the materials list is kept
  12 hours). The access token lives in memory, so a reload without signal signs the technician out; the queue
  survives in IndexedDB and syncs after the next sign-in.
- **The mutation queue** (`helpers/offlineQueue.js` on IndexedDB, `hooks/useOfflineQueue.js` the engine): job
  status, checklist ticks, timer start/stop, materials and completion go through it even online (flushed at
  once), with a client `idempotencyKey`, strictly in the order the technician acted (same-millisecond taps and a
  clock set back included). The screen shows each change at once from the queue. `POST /tech/sync` replays it;
  the server applies each key once and keeps the tapped time for timers. A terminal refusal
  (`INVALID_TRANSITION`, `INVALID_MUTATION`) is dropped with a visible note; network errors keep everything;
  other failures retry up to 5 times.
- **The upload queue** (`helpers/uploadQueue.js`): every picture is compressed (`helpers/compressImage.js`,
  longest edge ≤ 1600 px, JPEG 0.8, never upscaled) and queued, shown as "Waiting to upload", and sent in order
  when there is signal. Photos are append-only, so they never conflict.
- **Signature → completion:** the signature waits in the upload queue carrying the completion; the `complete`
  mutation is queued only once the upload has its media id, under a fixed key, so it replays after every tick
  made before it and happens once (the API also refuses a second completion).
- One sync at a time: mutations, then photos, then mutations again. The header shows Offline / Syncing / the
  pending count with "Sync now". The queue belongs to the device, not the user — a follow-up is to scope it per
  signed-in user.
- Conflicts on scalar fields resolve last-write-wins, with every attempt recorded in `JobStatusEvent`.

The site diary, as built in Phase L7 (2026-09-28): one entry per job per Kathmandu day, saved through the queue as
`diary_save` — `{ jobId, payload: { day, …the whole entry } }`, a full replace keyed on job + day, so a replay or a
second save of the same day lands on one row (`SiteDiary @@unique([jobId, day])`); the phone supersedes a waiting
save for the same day. Its photos are the job's DURING uploads, named in the queue entry's `meta.photoUploadIds` (never sent); the
engine holds the day until each is up, then sends it with `photoMediaIds` (a refused photo is left out). A diary day
is its own record in the queue (`diary:<jobId>:<day>`), so a held day never holds the job's status changes, ticks or
materials. Each line's progress is the latest day's that mentions it, so a
late entry for an older day never rolls progress back.

The survey stepper, as built in Phase L5 (2026-09-27):
- **Every write is a `survey_draft`**, online or not — a full replace of the survey's fields, its readings
  (checklist answers carry `questionKey`; the server works out `flagged`), its items with their `measurements`
  rows as plain numbers (the phone turns 12'6" into 12.5; the server derives the quantity) and `sitePin`. It saves
  1.2 s after the last tap, on every step change and when the screen closes; a newer draft replaces one still
  waiting, and the form as typed rides in the queue entry's `meta`, so the stepper reopens where it was.
- **A checklist photo is an ordinary upload** (with its kind — ISSUE or SKETCH — and room). Its reading carries
  the upload's `photoUploadId`; the sync engine swaps that for the uploaded picture's `mediaId` before sending,
  and holds that survey's later entries (its save, its submit) until the picture is up, so a submit never
  overtakes the save it depends on.
- **`survey_submit` is queued after the last draft.** The phone checks the checklist first with the server's rule;
  a server refusal `SURVEY_INCOMPLETE` comes back through `/tech/sync` with its `details` and is terminal: the
  stepper jumps to the checklist and marks each missing answer or photo.

## Security

- Argon2id passwords; access tokens in memory only (never `localStorage`); refresh in httpOnly cookie.
- RBAC enforced server-side on every admin route; UI hiding is cosmetic.
- **Money wall (D1).** Field staff never see a price, a cost, a total or a colleague's pay: every `/tech` response
  passes `utils/moneyWall.js#fieldSafe`, which drops money-named keys at any depth, and an API test scans every
  field response for them.
- **Cost wall (L-D4, Phase L2).** Office staff see selling rates; what work *costs* and its margin — recipe
  cost, purchase rates and wages in the rate library, job costing, the job-margin report — is `costs:read`
  (MANAGER, ADMIN). Services pass their results through `moneyWall.js#stripCosts(obj, { role })`, driven by
  one exported `COST_KEYS` list, and the record history of cost-bearing models (rate library, trades) is
  masked the same way. The client never sends a cost: the server prices recipes from the library.
  Quotation rows (Phase L3) carry a frozen recipe and cost: the `/admin/quotations*`, `/admin/leads*` and
  `/admin/surveys*` routes run the cost wall as path-scoped middleware (`middleware/costWall.js` — never
  router-wide, since several routers share `/admin`), and the public quotation view is an allowlist
  (`quotation.service.js#publicView`) — sell rates, totals, sections, measurements, the schedule and the words,
  and a key-scan test (23-quotation-document) proving no cost, margin, recipe or pay key. The customer's Excel
  copy has no Cost sheet. Approval has a margin gate (`quotation.minMarginPct`; unknown cost counts as low).
- **Rate library (L-D1).** A rate is a recipe at a moment's prices: `money.js#recipeCost` → `sellRate`
  (rounded up). Price changes flag items `outOfDate`; rates move only through a reprice (preview → apply,
  `rate_card.repriced`). Quantities (measurements, wastage, packs, take-offs) live in `utils/quantity.js`,
  money in `utils/money.js`, and neither rounds the other's numbers.
- Public token links (quotation, warranty) are random 32-byte, single-purpose, expiring, scoped to one record.
- Uploads validated by magic bytes, not extension; EXIF stripped; private media served via signed URLs.
- CSP, HSTS, no inline scripts. Turnstile + honeypot + timing + IP rate limit on all public POSTs.
- PII exports (`leads.csv`) are recorded as `export.csv` audit events with the actor and the filters used.
- No access token, refresh cookie or password reaches a log line; see *Redaction* above.
- **Sessions.** Each sign-in is one refresh token row (hashed, with client, ip and user agent), rotated on every
  refresh. A session has an idle limit and an absolute limit per client (`WEB`, `DESKTOP`; see *Session
  lifetimes* in API.md), so an active session is renewed but never outlives its cap from sign-in.
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
