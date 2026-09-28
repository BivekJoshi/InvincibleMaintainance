# Maintenance System — Backend API

Node 20 · Express · Prisma · PostgreSQL 16 · single-tenant · full field-service operations.

A content-driven marketing site **plus** the back office that makes its promises true:
lead CRM with a 2-hour SLA, quotations, work orders, technician dispatch, materials,
invoicing, warranties and AMC contracts.

---

## Quick start

```bash
cp .env.example .env          # then set DATABASE_URL + the two secrets
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev                   # http://localhost:4000
```

No Postgres yet? `docker compose up -d` brings up postgres, redis and mailpit.
Or create the database locally:

```bash
sudo -u postgres psql -c "CREATE ROLE maintainance LOGIN PASSWORD 'maintainance' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE maintainance OWNER maintainance;"
```

**Seeded logins** (password `Password123` for all):

| Email | Role | Sees |
|---|---|---|
| `admin@gharjatan.com.np` | ADMIN | everything |
| `editor@gharjatan.com.np` | EDITOR | CMS + media only |
| `sales@gharjatan.com.np` | SALES | leads, customers, quotations (prepares and submits them); reads warranties, AMC contracts and service reminders |
| `manager@gharjatan.com.np` | MANAGER | everything SALES sees, plus approving quotations, the rate library's cost and margin |
| `dispatch@gharjatan.com.np` | DISPATCHER | jobs, the dispatch board, technicians, materials and stock; decides warranty claims, runs AMC contracts and service reminders; reads the service catalogue |
| `accounts@gharjatan.com.np` | ACCOUNTANT | invoices, payments, expenses, the finance reports and customer statements — no aftercare, no cost |
| `hari@gharjatan.com.np` | TECHNICIAN | only jobs assigned to them |
| `suresh@gharjatan.com.np` | TECHNICIAN | a second technician, for crews and the dispatch board |
| `survey@gharjatan.com.np` | SURVEYOR | site visits and surveys assigned to them (the field app's survey stepper) |

The seed builds a browsable demo: 18 services, 3 projects, a rate card, 10 materials with
opening stock, a blog (2 published posts in 2 categories), an About page at `/about`, and a complete pipeline — leads (one already SLA-breached, one at risk) →
customer → approved quotation → completed job → warranty → part-paid invoice → AMC contract.
It also seeds `quotation.validDays` (15 — the valid-until date a quotation gets when nobody sets one) and
one quotation at each step of the approval loop — DRAFT (sent back once), PENDING_APPROVAL,
OFFICE_APPROVED, SENT and CHANGES_REQUESTED (a Nepali customer's message) — the
`quotation.makerChecker` / `quotation.autoApproveBelow` settings, and the `quotation_accepted`,
`quotation_changes_received` and `quotation_changes_requested_staff` templates in English and Nepali, and the
`password_reset` and `account_invite` emails staff accounts receive.

Phase L1 adds leads to work — one due today (with its qualification filled), one overdue, one with
nothing booked — a quotation sent five days ago and unanswered (the stale sweep reminds its owner), and
four lost leads across categories and stages for the lost report. The `pipeline.*` settings (SLA group)
hold the follow-up clocks: the No-answer retry (120 min), price-shopper follow-up (3 days), digest hour
(09:00 Kathmandu), quiet-lead (3 days), unquoted-survey (48 h), waiting-approval (24 h), unanswered-quote
(3 days) and expiring-quote (2 days) thresholds.

Phase L2 adds the rate library's demo: five trades with **illustrative** day wages (set your own under
Trades & wages), pack sizes on the materials plus a floor tile and a tile adhesive, and recipes per 100
sq.ft on internal plaster, floor tiling and chemical damp treatment (MANUAL — their rates stay, the recipe
costs them for the margin) and on interior painting (DERIVED and left at its old rate, so the library shows
one item "Out of date" to reprice). The quotation costing settings (minimum margin 15 %, overhead 10 %,
profit 10 %, derived rates rounded up to Rs 1, contract type, the 50/40/10 payment schedule, the advance
gate and its 7-day due date) sit in the finance group. Recipe norms are simplified for the demo — review
them before quoting real work.

Phase L3 adds one quotation as a real bill of quantities (customer Prakash Joshi, Bhaisepati): three
sections, measured rows with a door deducted, a note, an optional flooring row and rows priced from the
rate library with their recipes frozen — built through the same service as the builder, so its take-off
and labour tabs have something to show.

Phase L4 adds the **terms library** (a default "Standard terms" in English and Nepali, and a waterproofing
warranty entry), gives the BOQ demo a 50/40/10 schedule, a 6-day duration and exclusions, and seeds a
quotation priced under the minimum margin, waiting for approval (customer Sunil Maharjan) — approving it
asks for the acknowledgement. Dependency: **exceljs** (the quotation's Excel export); `package.json` overrides its
`uuid` to ^11.1.1 (GHSA-w5hq-g745-h8pq — exceljs only uses uuid v4, but the patched version costs nothing).

Phase L5 adds the **site-visit kit's** demo: the `visit_booked` and `visit_reminder` SMS templates in English
and Nepali; a **"Seepage & damp — site checklist"** inspection template on the seepage service (moisture at
300 mm and 1 m with flag thresholds, salt deposits, DPC visible, source of water, a wet room behind the wall,
hollow plaster, the customer's story — the moisture and salt answers need a photo); a visit tomorrow that the
customer has confirmed (Ramesh Shrestha, Sanepa — two photos he sent with the enquiry), one the day after
that nobody has answered (a Nepali customer abroad, her brother-in-law as the site contact); and a submitted
survey (Laxmi Karki, Sitapaila) with the checklist answered — three flagged answers, the meter's photo on its
reading — two rooms measured with the door and window deducted, photos by room and a paper sketch. The
photos are generated placeholder images stored through the media service. The **`visits:remind`** task
(every 15 min) sends tomorrow's visit reminders from `visits.reminderHour` (17:00 Kathmandu, a setting in the
SLA group), once per visit and window.

Phase I adds a **finance & aftercare** demo (customer Bishnu Prasad Koirala, Maharajgunj): receivables in every
aging bucket (not yet due, 12, 45 and 100 days overdue — one part-paid by Khalti), a draft and a void invoice, a paid
one whose first eSewa payment was entered twice and voided (struck through), four expenses on a job, a warranty
with an open claim for the claims queue, an AMC contract due for renewal within 60 days and a service reminder the
SMS provider refused. Aftercare routes now check capabilities (`warranties:*`, `amc:*`, `reminders:*`) instead of
role lists — the same access as before (see the table above). Every report downloads as CSV with `?format=csv`.

Phase L6 adds the **won → hand-off** demo: two BOQ quotations accepted through the real Accept — Rabin Maharjan's
job waits for its advance (the gate holds it), Sabina Shakya's advance is paid (Fonepay) and her job is ready to
schedule. Services carry a job type (renovation, installation…). New settings `finance.bankAccount` and
`finance.fonepayNumber` (illustrative values — set your own) print in the new **`advance_due`** SMS (en/ne) and
email the customer gets on accepting.

Phase L7 puts that paid job **on site**: Hari's three diary days (one lost to heavy rain), progress on its
lines, more cement issued than planned (the Materials tab's over-plan warning), a purchase list ORDERED for the
second week, and an accepted **variation** (VO-…) that adds the store room and omits plaster on one wall. New
setting `job.workdayHours` (8, finance group) turns the diary's headcount into labour days.

Phase L8 closes the loop with two jobs billed **advance → running bill → final bill**: Keshav Bhandari's
**lump-sum** job, and Anita Gurung's **item-rate** job, measured 5 % over its quote with one variation, its
measurement closed. Each job's three invoices add up to its contract to the paisa, and the Costing tab's
"invoiced" equals the contract's taxable value.

**Billing, in one paragraph.** An accepted quotation raises the ADVANCE (its ON_ACCEPT stage); the accountant raises
a RUNNING bill for each milestone stage from the job (`POST /admin/jobs/:id/invoices/stage`); when the job is done,
"invoice the job" raises the FINAL bill by the contract type — lump sum: the contract ± variations; item rate: what
was measured × the quoted rates + variations — less every stage bill, VAT reconciled (see ARCHITECTURE "Billing").
An unquoted job is still billed from its actual materials and labour.

**Staff accounts.** An admin never sets a password. A user created from the Users screen gets a 72-hour
"choose your password" email; a forgotten password is the normal reset link, which an admin can also send.
Both links open `<PUBLIC_WEB_ORIGIN>/reset-password`. With no `SMTP_HOST`, the email — link included — is
printed to the API's console (`[MAIL:console]`); the message log keeps it with the token redacted.

## Commands

```
npm run dev          API with reload            npm run db:migrate
npm start            production                 npm run db:seed
npm run worker       standalone job worker      npm run db:studio
npm test             unit suite, no database    npm run db:reset
npm run test:api     every route over HTTP      npm run test:api:prepare
```

## API tests

`npm run test:api` drives every route over HTTP against a real, seeded database —
auth, public, CRM, surveys, operations, the field app, finance, aftercare, platform
and all sixteen CMS resources, including RBAC and the error envelope. It refuses to
run against any database whose name does not end in `_test`.

```bash
sudo -u postgres psql -c "CREATE DATABASE maintainance_test OWNER maintainance;"   # once
npm run test:api:prepare    # migrate + seed it — once, or whenever you want a clean slate
npm run test:api
```

Every test creates the records it acts on and reads seed data without changing it, so the
suite runs repeatedly against the same database with no reset in between. `test:api:prepare`
wraps `prisma migrate reset`, which Prisma refuses to run from an AI agent without a human's
consent — run it yourself. Point the suite elsewhere with `TEST_DATABASE_URL`. Files run one at
a time in a single process, because they share the database and the app's in-memory rate-limit
store.

## Lint and CI

`npm run lint` runs ESLint 9 over `src` and `prisma` with `eslint.config.js` (`@eslint/js`
recommended, Node globals; a leading `_` marks a binding that is unused on purpose).

`.github/workflows/ci.yml` runs on every push to `prabesh`, `admin/**` and `DEVELOPMENT`, and on
pull requests into `prabesh` or `DEVELOPMENT`. The backend job, on Node 20: `npm ci` →
`npx prisma generate` → `npm run lint` → `npm test` → `npx prisma migrate deploy` and
`npm run db:seed` against a `postgres:16` service database named `maintainance_test` →
`npm run test:api`. The database URL and JWT secrets it uses are throwaway values written in the
workflow. Any failing step fails the run. A frontend job lints and builds `MaintainanceFrontend`
in parallel.

## Redis is optional

Without `REDIS_URL` the queue runs in-process and the cache is an in-memory Map, so
development needs one service instead of three. Set `REDIS_URL` in production to get BullMQ
with retries and a separate worker process (`npm run worker`, plus `RUN_WORKER_INLINE=false`
on the API).

---

## Layout

```
src/
  config/env.js        validated config — the process exits on a missing required var
  lib/                 prisma (audit extension), requestContext, auditDiff, logger, sentry, redis
  shared/              enums, permissions, state machines, zod schemas
  utils/               money (paisa), nepaliDate (BS), numbering, phone, pagination
  middleware/          validate, authenticate, authorize, upload, rateLimit, error
  services/            all business logic — controllers never touch Prisma
  routes/              public · auth · tech · admin/{cms,crm,ops,finance,aftercare,platform}
                       admin/historyRoute.js — GET …/:id/history for any model
  queues/ crons/       SLA sweep, overdue invoices, quotation expiry, AMC visits, reminders,
                       lead follow-ups + morning digest, stale-pipeline reminders (Phase L1),
                       tomorrow's site-visit reminders (visits:remind, Phase L5)
prisma/                schema.prisma · seed.js · seed-data.js
tests/                 unit: money, BS dates, phone, state machines, permissions, SLA, schemas, logging,
                       notification links (a source scan: staff links are /admin/…, field links /tech/…),
                       message templates (placeholders, preview, address masking)
tests/api/             every route over supertest, against a database whose name ends in _test
tests/fixtures/        plain-data cases shared with the SPA's tests (the service schema's valid/invalid inputs)
```

### Three ideas hold the code together

**1. Money is an integer number of paisa.** `utils/money.js` is the only file that multiplies
or divides money. VAT is computed once at document level, never per line, so rounding cannot
accumulate. Rupees appear only at the API boundary.

**2. One CRUD factory.** `services/crud.service.js` builds list/get/create/update/delete/
toggle/restore/reorder for any model; `routes/admin/mountResource.js` mounts those endpoints plus the
record's history. The CMS resources (`cms.routes.js`) and, since Phase H1, materials, material
categories, suppliers, job templates and technicians (`ops.routes.js`, technicians through
`services/technician.service.js`) are all mounted this way — there is no second way to write a CRUD screen.

**3. Status is the server's decision.** Transitions live in `shared/stateMachines.js` and are
asserted in the service layer. A client cannot set a job to `COMPLETED`; it calls the complete
endpoint, which validates the checklist, closes timers, stamps `actualEnd`, creates the
warranty and opens the job for invoicing. A quotation is never sent without **internal approval**:
SALES submits it, a MANAGER or ADMIN who did not write it approves it (or it auto-approves below
`quotation.autoApproveBelow`), and only then can it be sent. On the link the customer can Accept, Ask for
changes or Decline; a change request loops into a revision — a new version that is approved again — and
an acceptance converts the quotation, wins the lead and creates the job in one transaction — since Phase L6 with
the accepted BOQ as its lines, the take-off as its requirements and, when the payment schedule has an advance, the
ADVANCE invoice. **The job cannot be scheduled, assigned or started until that advance is paid** (422
`ADVANCE_UNPAID`); a manager may override, with a reason, audited. `job.advanceGate` switches the gate off.

---

## What makes it more than the site it replaces

The studied site makes five operational promises with nothing behind them. Each is now a mechanism:

| Promise on the page | Mechanism in the system |
|---|---|
| 2-hour response | `slaDueAt` on every lead, a sweep every 5 minutes, warn at T−30, escalate on breach. `firstResponseAt` is stamped when contact is *logged*, not when a status changes — so the compliance report cannot be gamed. |
| Free consultation | `INSPECTION` job type, `isBillable: false`, zero-rate rate-card line. |
| 1-month warranty | A `Warranty` row is created automatically on job completion, with a public certificate link. A claim spawns a free `WARRANTY` job linked to the original. |
| Transparent pricing | One `RateCardItem` table feeds the public pricing page, the cost estimator and quotation line items. |
| Certified engineers | Technician profiles with skills, capacity and a rating recomputed from customer feedback. |

Plus what the original has no way to do: quotations customers approve by link, dispatch with
conflict detection, offline-tolerant technician sync, stock derived from movements, per-job
margin, aging and collections, and AMC contracts that schedule their own visits.

---

## API shape

`{ data, meta }` on success · `{ error: { code, message, details } }` on failure.
Lists take `?page&limit&sort&q` plus per-resource filters. Full surface in `../docs/API.md`.

```
/api/v1
  /public/*            no auth, rate-limited, 60s cache
       bootstrap · home · services · projects · offers · pricing · gallery
       testimonials · faqs · posts · pages
       POST estimate · POST leads
       quotations/:token (+ /decide) · warranties/:token (+ /claim) · invoices/:token
  /auth                login · refresh · logout · forgot/reset/change password · me
  /tech/*              TECHNICIAN, scoped to own assignments, incl. POST /sync
  /admin/*             CMS · CRM · ops · finance · aftercare · platform
  /sitemap.xml  /json-ld  /robots.txt
```

### Security

- Argon2id passwords; 5 failed attempts locks the account for 15 minutes.
- Access token 15m in the `Authorization` header; refresh token in an httpOnly cookie,
  rotated on every use and revoked on password change. A session lapses after its client's idle
  limit or its absolute limit from sign-in (`WEB_SESSION_*`, `DESKTOP_SESSION_*` in `.env`).
- RBAC enforced server-side on every route. `shared/permissions.js` is shared with the SPA,
  but the API is the authority.
- Login and password-reset responses are uniform, so neither endpoint enumerates accounts.
- Uploads validated by magic bytes, not extension; images re-encoded through sharp, which
  drops EXIF (including GPS).
- Public links (quotation, warranty, invoice) are 32-byte random, single-purpose and
  scoped to one record.
- Lead form: honeypot + submission-timing check + IP rate limit + optional Turnstile.
- Every write is audited with actor (`user` / `public` / `system`), request id, ip, user agent, model,
  record and a redacted before/after of the changed fields — inside the same transaction, so a
  rollback leaves no row. Business moments (`quotation.customer_approved`, `auth.locked`, …) are named
  domain events; the list is `AUDIT_EVENTS` in `shared/enums.js`, documented in `docs/API.md`.

### Logging

- Every response carries `X-Request-Id`; every log line of that request and every audit row it wrote
  carry the same id. An incoming id is kept only if it is a plain 8–64 character token.
- pino redacts the `Authorization` header, cookies, `Set-Cookie` and password/token/otp fields, masks
  phone numbers to the last four digits, and hides the token in customer link URLs.
- `LOG_LEVEL` (default `info` in production, `debug` otherwise) · `LOG_FILE` adds a daily-rotated file
  via **pino-roll**, keeping `LOG_RETENTION_DAYS` (14) · `SENTRY_DSN` turns on **@sentry/node**, loaded
  only when set, for 5xx errors, failed tasks and crashes.
- Background tasks log `{ task, jobId, durationMs, count }` when they finish.

---

## Verified end to end

Against a live database and running server:

- Home page assembled from 19 ordered sections; hiding and reordering a section changes the
  public payload immediately.
- Spam guards reject a filled honeypot, a 300ms submission and a malformed phone (400 each);
  a genuine submission creates a lead and fires SMS + email.
- SLA board correctly separates breached from at-risk; logging a call stamps the response.
- Quotation of 3 lines × 210.5 sq.ft with a discount reconciles to the paisa against
  hand-computed totals; customer approves by link; a second decision returns 422.
- Job created from the approved quotation pulls an 8-item template checklist; completing with
  items still open returns 422.
- Completion creates the warranty; a customer claim spawns a free `WARRANTY` job; a duplicate
  claim returns 422.
- Issuing material reduces derived stock (WP-CRYST 60 → 38 kg).
- Invoice built from actual consumption; invoicing the same job twice returns 422;
  overpayment rejected; exact balance settles the invoice to `PAID`.
- Offline sync: 3 mutations applied, identical replay returns 3 duplicates and 0 side effects.
- 506KB PNG → 17KB WebP with 400/800 derivatives and an LQIP placeholder; a text file renamed
  `.png` is rejected.
- RBAC spot-checks: SALES gets 403 on users/invoices/dispatch, 200 on leads; a technician gets
  403 on another technician's job.
