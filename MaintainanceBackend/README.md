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
| `sales@gharjatan.com.np` | SALES | leads, customers, quotations (prepares and submits them) |
| `manager@gharjatan.com.np` | MANAGER | everything SALES sees, plus approving quotations |
| `dispatch@gharjatan.com.np` | DISPATCHER | jobs, technicians, materials |
| `accounts@gharjatan.com.np` | ACCOUNTANT | invoices, payments, reports |
| `hari@gharjatan.com.np` | TECHNICIAN | only jobs assigned to them |

The seed builds a browsable demo: 18 services, 3 projects, a rate card, 10 materials with
opening stock, a blog (2 published posts in 2 categories), an About page at `/about`, and a complete pipeline — leads (one already SLA-breached, one at risk) →
customer → approved quotation → completed job → warranty → part-paid invoice → AMC contract.
It also seeds `quotation.validDays` (15 — the valid-until date a quotation gets when nobody sets one) and
one quotation at each step of the approval loop — DRAFT (sent back once), PENDING_APPROVAL,
OFFICE_APPROVED, SENT and CHANGES_REQUESTED (a Nepali customer's message) — the
`quotation.makerChecker` / `quotation.autoApproveBelow` settings, and the `quotation_accepted`,
`quotation_changes_received` and `quotation_changes_requested_staff` templates in English and Nepali.

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
  queues/ crons/       SLA sweep, overdue invoices, quotation expiry, AMC visits, reminders
prisma/                schema.prisma · seed.js · seed-data.js
tests/                 unit: money, BS dates, phone, state machines, permissions, SLA, schemas, logging,
                       notification links (a source scan: staff links are /admin/…, field links /tech/…)
tests/api/             every route over supertest, against a database whose name ends in _test
tests/fixtures/        plain-data cases shared with the SPA's tests (the service schema's valid/invalid inputs)
```

### Three ideas hold the code together

**1. Money is an integer number of paisa.** `utils/money.js` is the only file that multiplies
or divides money. VAT is computed once at document level, never per line, so rounding cannot
accumulate. Rupees appear only at the API boundary.

**2. One CRUD factory.** `services/crud.service.js` builds list/get/create/update/delete/
toggle/restore/reorder for any model; `routes/admin/cms.routes.js` mounts eight endpoints from
it. Eighteen CMS resources, one pattern — there is no second way to write a CRUD screen.

**3. Status is the server's decision.** Transitions live in `shared/stateMachines.js` and are
asserted in the service layer. A client cannot set a job to `COMPLETED`; it calls the complete
endpoint, which validates the checklist, closes timers, stamps `actualEnd`, creates the
warranty and opens the job for invoicing. A quotation is never sent without **internal approval**:
SALES submits it, a MANAGER or ADMIN who did not write it approves it (or it auto-approves below
`quotation.autoApproveBelow`), and only then can it be sent. On the link the customer can Accept, Ask for
changes or Decline; a change request loops into a revision — a new version that is approved again — and
an acceptance converts the quotation, wins the lead and creates the job in one transaction.

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
  rotated on every use and revoked on password change.
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
