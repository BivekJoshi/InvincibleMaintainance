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
| `admin@homeplexnepal.com` | ADMIN | everything |
| `editor@homeplexnepal.com` | EDITOR | CMS + media only |
| `sales@homeplexnepal.com` | SALES | leads, customers, quotations |
| `dispatch@homeplexnepal.com` | DISPATCHER | jobs, technicians, materials |
| `accounts@homeplexnepal.com` | ACCOUNTANT | invoices, payments, reports |
| `hari@homeplexnepal.com` | TECHNICIAN | only jobs assigned to them |

The seed builds a browsable demo: 18 services, 3 projects, a rate card, 10 materials with
opening stock, and a complete pipeline — leads (one already SLA-breached, one at risk) →
customer → approved quotation → completed job → warranty → part-paid invoice → AMC contract.

## Commands

```
npm run dev          API with reload            npm run db:migrate
npm start            production                 npm run db:seed
npm run worker       standalone job worker      npm run db:studio
npm test             vitest (42 tests)          npm run db:reset
```

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
  lib/                 prisma (with audit extension), redis, logger
  shared/              enums, permissions, state machines, zod schemas
  utils/               money (paisa), nepaliDate (BS), numbering, phone, pagination
  middleware/          validate, authenticate, authorize, upload, rateLimit, error
  services/            all business logic — controllers never touch Prisma
  routes/              public · auth · tech · admin/{cms,crm,ops,finance,aftercare,platform}
  queues/ crons/       SLA sweep, overdue invoices, AMC visits, reminders
prisma/                schema.prisma · seed.js · seed-data.js
tests/                 money, BS dates, phone, state machines, permissions, SLA, schemas
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
warranty and opens the job for invoicing.

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
- Every write is audited with actor, model, record and a redacted diff.

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
