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
requestId → pino logger → helmet → cors(allowlist) → compression → rateLimit
  → express.json → route
      → validate(zodSchema)          400 on failure
      → authenticate                 401 on failure
      → authorize(...roles)          403 on failure
      → controller (thin)
          → service (all business logic, transactions)
              → prisma
  → errorMiddleware (AppError → status/code; unknown → 500 + log, never leak internals)
```

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
Quotation DRAFT → SENT → APPROVED | REJECTED | EXPIRED → CONVERTED
Job       DRAFT → SCHEDULED → ASSIGNED → EN_ROUTE → IN_PROGRESS ⇄ ON_HOLD
                → COMPLETED → VERIFIED ;  any → CANCELLED
Invoice   DRAFT → SENT → PARTIAL → PAID ;  SENT|PARTIAL → OVERDUE ;  any → VOID
          voiding a payment walks it back:  PAID → PARTIAL | SENT | OVERDUE ;  PARTIAL → SENT
```

Every lead status change goes through `lead.service.js#transitionLead(tx, leadId, to, opts)`, which
asserts the transition, stamps `closedAt` and writes the `status_change` timeline entry inside the
caller's transaction. A quotation's `validUntil` is checked when the customer opens the link, when
they decide, and hourly by the `quotation:expire` task — one rule (`isExpired`) for all three.

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
- PII exports (`leads.csv`, customer statements) are logged to `AuditLog` with the actor.

## Environments

`.env.example` covers: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `S3_*`,
`SMTP_*`, `SPARROW_TOKEN`, `SPARROW_FROM`, `TURNSTILE_SECRET`, `PUBLIC_WEB_ORIGIN`,
`ADMIN_ORIGIN`, `VAT_RATE`, `SLA_LEAD_MINUTES`, `WARRANTY_DEFAULT_DAYS`, `SENTRY_DSN`.
Config loader validates all of them at boot and exits on a missing required key.
