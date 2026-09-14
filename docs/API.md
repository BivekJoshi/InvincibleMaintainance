# API Surface — `/api/v1`

Conventions: `{ data, meta }` on success · `{ error: { code, message, details } }` on failure ·
lists accept `?page&limit&sort&q` plus per-resource filters · all mutations audited ·
money in requests is **rupees**, in responses **integer paisa**.

**Request id.** Every response carries `X-Request-Id` (exposed to browsers through CORS). A client may
send its own `X-Request-Id`; it is kept only if it matches `^[A-Za-z0-9._-]{8,64}$`, otherwise a UUID
replaces it. The same id is on every log line of the request and on every `AuditLog` row it wrote.

**Origins.** A browser request from an origin outside `PUBLIC_WEB_ORIGIN` / `ADMIN_ORIGIN` answers
`403 FORBIDDEN_ORIGIN`. A 5xx always answers `INTERNAL_ERROR` / "Something went wrong" (the detail is
logged, and reported to Sentry when `SENTRY_DSN` is set); only `NODE_ENV=development` shows the real message.

Every route below is exercised over HTTP by `npm run test:api`
(`MaintainanceBackend/tests/api/`), against a database whose name ends in `_test`.

## Public (no auth, rate-limited, cached 60s where marked ⚡)

Content endpoints take `?locale=en|ne`.

```
GET  /public/bootstrap              ⚡ settings + nav + home sections + booking rules in one call
GET  /public/home                   ⚡ every visible home section, hydrated, in order
GET  /public/services               ⚡ ?category&featured
GET  /public/services/:slug         ⚡ + related projects, faqs
GET  /public/projects               ⚡ ?service=<slug>&category=<slug>   case studies
GET  /public/projects/:slug         ⚡
GET  /public/offers                   active window only, cached 30s
GET  /public/pricing                ⚡ pricing plans + rate card + priced services
GET  /public/gallery                ⚡
GET  /public/testimonials           ⚡ approved only
GET  /public/faqs                   ⚡ ?group
GET  /public/posts  /posts/:slug    ⚡
GET  /public/pages/:slug            ⚡
POST /public/estimate                 { serviceId | pricingPlanId, qty } -> { min, max, breakdown }
GET  /public/availability             ?from&days  free survey capacity per day and slot
                                      demand = scheduled INSPECTION jobs + booking leads still
                                      NEW/CONTACTED (past that they have a Job and would double-count)
                                      cached 30s; a full slot is flagged, never rejected
POST /public/leads                    honeypot + timing + turnstile + rate limit -> creates Lead
                                      online booking adds { preferredAt, preferredSlot },
                                      which sets source=booking; a closed weekday is rejected
GET  /public/quotations/:token        customer views a quotation
POST /public/quotations/:token/decide { decision: approve|reject, note }   once — a second is 422
                                      a SENT quotation past validUntil is moved to EXPIRED here and
                                      answered 422 "This quotation has expired…", whether or not
                                      anyone opened the link first. Approval moves the lead to WON
                                      through the state machine (NEW via CONTACTED); a lead already
                                      WON is left alone, a LOST lead keeps its status and gets a
                                      timeline note — the lead never fails the customer's approval
GET  /public/invoices/:token          customer views an invoice (read-only; paid offline)
                                      payments[] include voided ones with voidedAt set (shown struck
                                      through); paidAmount already excludes them
GET  /public/warranties/:token
POST /public/warranties/:token/claim  { description }   one open claim at a time — a second is 422
GET  /sitemap.xml   /robots.txt   /json-ld              ?origin=https://…
```

A CMS write (create, update, toggle, reorder, delete, restore) invalidates the public cache, so
the change is visible on the next request rather than after the TTL.

## Auth

```
POST /auth/login            -> { user, accessToken } + httpOnly refresh cookie
POST /auth/refresh          rotates the cookie; the previous one stops working
POST /auth/logout           revokes the refresh token
POST /auth/forgot-password  same answer for known and unknown emails
POST /auth/reset-password
POST /auth/change-password  revokes every existing session
GET  /auth/me
```

Five failed logins lock an account for 15 minutes; a disabled account is refused at login and
on its next authenticated request.

## Admin — CMS (`ADMIN`, `EDITOR`)

Every resource below gets the same eight endpoints from one factory: `GET /`, `GET /:id`,
`POST /`, `PUT /:id` (partial), `PATCH /:id/toggle`, `PATCH /reorder { items: [{ id, sortOrder }] }`,
`DELETE /:id` (soft) and `PATCH /:id/restore`.

`DELETE /:id?hard=true` removes the row for good and needs **`cms:purge`**, which only ADMIN holds;
anyone else gets 403 `FORBIDDEN` and nothing is deleted. The same applies to `DELETE /admin/media/:id?hard=true`,
which also removes the stored file and its variants.

```
/admin/hero-slides
/admin/service-categories
/admin/services
/admin/projects                 + POST /:id/images, PATCH /:id/images/reorder, DELETE /:id/images/:imageId
/admin/offers
/admin/pricing-plans
/admin/features                 ?group=
/admin/list-items               ?group=   ordered by `position` — reorder maps sortOrder onto it
/admin/content-blocks
/admin/process-steps
/admin/testimonials             + PATCH /:id/approve   (testimonials:moderate)
/admin/gallery
/admin/faqs
/admin/pages  /admin/posts  /admin/post-categories

/admin/home-sections            GET, PUT { items: [{ key, sortOrder, isVisible, settings? }] }
/admin/translations             GET ?model&recordId, PUT { model, recordId, values }

/admin/settings                 GET (settings:read), PATCH { values } (ADMIN only)
/admin/media                    GET, POST (images, multipart `files`), GET /:id, PUT /:id,
                                DELETE /:id (soft; ?hard=true needs cms:purge)
/admin/media/documents          POST (PDFs and other files)
/admin/media/folders            GET, POST, DELETE /:id
```

## Admin — CRM (`ADMIN`, `SALES`)

```
GET    /admin/leads                 ?status&priority&source&assignedToId&serviceId&slaRisk&from&to&q
POST   /admin/leads                 manual entry (phone/walk-in)
GET    /admin/leads/sla-board       at-risk + breached
GET    /admin/leads/export.csv
POST   /admin/leads/merge           { primaryId, duplicateIds }   duplicates move to LOST and are soft-deleted;
                                    422 when a duplicate is WON — make that lead the primary instead
GET    /admin/leads/:id
GET    /admin/leads/:id/duplicates  other leads with the same phone or email
PUT    /admin/leads/:id
PATCH  /admin/leads/:id/status      validated transition; LOST needs lostReason; writes a status_change
                                    timeline entry; the status it already has is a no-op
PATCH  /admin/leads/:id/assign
POST   /admin/leads/:id/notes
POST   /admin/leads/:id/activities  logging a call stamps firstResponseAt
POST   /admin/leads/:id/convert     { customerId?, site?, createQuotation, createInspectionJob,
                                      scheduledStart, scheduledEnd, surveyorId }
                                    -> 201 { customer, site, quotation?, job?, survey? }
                                    assigning surveyorId schedules the visit and pre-creates its SiteSurvey.
                                    One transaction: any failure (e.g. an unknown surveyorId, 409) leaves no
                                    customer, site, quotation, job, survey or lead change behind.
                                    The quotation is priced like POST /admin/quotations (VAT included).
                                    The lead only moves forward, one timeline entry per step:
                                    NEW|LOST → CONTACTED → INSPECTION_SCHEDULED (job) → QUOTED (quotation)
DELETE /admin/leads/:id             soft delete

/admin/customers                    CRUD + /:id/sites CRUD + GET /:id/timeline
/admin/rate-card                    CRUD — quotations:read / quotations:write
/admin/quotations                   CRUD + POST /:id/send + POST /:id/revise
PUT    /admin/quotations/:id        DRAFT only. Any other status is 422 UNPROCESSABLE ("…cannot be edited.
                                    Create a revision to change it.") and nothing changes
POST   /admin/quotations/:id/convert-to-job      jobs:write · APPROVED only
                                    { type?, title?, description?, priority?, scheduledStart?,
                                      scheduledEnd?, templateId?, technicianIds?, leadTechnicianId? }
                                    -> 201 job. Customer, site and lead come from the quotation, which
                                    becomes CONVERTED. SALES can win the work but not schedule it.
```

## Admin — Site surveys (`ADMIN`, `SALES`; `DISPATCHER` reads)

The surveyor reports quantities; the admin owns price. Note the split guard: reading a
survey is `surveys:read`, but seeing any money is `quotations:read` — that is the wall.

```
GET    /admin/surveys                ?status&surveyorId&customerId&from&to&q     surveys:read
GET    /admin/surveys/:id            readings + quantity items + job photos      surveys:read
GET    /admin/surveys/:id/pricing    priced preview (paisa) + missing[]          quotations:read
PATCH  /admin/surveys/:id/review     { status: IN_REVIEW|RETURNED, note }        surveys:write
                                     RETURNED requires a note and SMSes the surveyor
POST   /admin/surveys/:id/quotation  { items?, discount?, vatApplied?, validUntil?, terms? }
                                     -> 201 { survey, quotation }  rates in RUPEES   quotations:write
DELETE /admin/surveys/:id            soft delete, DRAFT only                     surveys:write
```

`GET /:id/pricing` resolves each quantity line against today's catalogue —
`LABOUR → rateCardItem.rate`, `MATERIAL → material.sellRate`, `SERVICE → service.priceFrom` —
and returns anything unpriceable in `missing[]` with a reason rather than pricing it at zero.

## Admin — Operations (`ADMIN`, `DISPATCHER`)

```
GET    /admin/jobs                  ?status&type&priority&technicianId&customerId&unassigned&from&to&q
POST   /admin/jobs                  a quotationId must belong to the customer and be APPROVED
                                    (it becomes CONVERTED); a templateId pulls its checklist
GET    /admin/jobs/:id
PUT    /admin/jobs/:id
DELETE /admin/jobs/:id
PATCH  /admin/jobs/:id/status       validated transition, writes JobStatusEvent;
                                    ON_HOLD and CANCELLED need a note
POST   /admin/jobs/:id/assign       { technicianIds, leadTechnicianId }
POST   /admin/jobs/:id/tasks        + PATCH /tasks/:taskId + DELETE /tasks/:taskId
POST   /admin/jobs/:id/photos       { mediaId, kind } + DELETE /photos/:photoId
POST   /admin/jobs/:id/materials    issues stock + DELETE /materials/:jobMaterialId (reverses it)
POST   /admin/jobs/:id/time-logs    { technicianId, startedAt, endedAt | minutes, note }
                                    labour the office records by hand — the timer was never started.
                                    The technician must be assigned to the job (422 otherwise).
DELETE /admin/jobs/:id/time-logs/:logId
POST   /admin/jobs/:id/complete     { note, signatureMediaId, customerRating, ... }
                                    checklist must be done -> creates Warranty, enables invoicing
POST   /admin/jobs/:id/verify       COMPLETED -> VERIFIED
GET    /admin/jobs/:id/costing      labour + materials + expenses vs invoiced
POST   /admin/jobs/:id/publish-case-study   cms:write · COMPLETED|VERIFIED only · once (409)
                                    pre-fills problem/solution from the survey, duration from the
                                    job, images from its BEFORE/AFTER photos, and the cost as a
                                    +/-20% band. The customer's name is omitted unless opted in.

GET    /admin/dispatch/board        ?date&view=day|week  technicians x timeslots
GET    /admin/dispatch/unassigned
/admin/technicians                  GET ?role&available, GET /:id, POST, PUT /:id, DELETE /:id
                                    hourlyRate is returned only to callers with technicians:write
/admin/job-templates                GET, GET /:id, POST, PUT /:id, DELETE /:id

/admin/materials  /admin/material-categories  /admin/suppliers    CRUD + PATCH /reorder
GET  /admin/stock                   derived balances
GET  /admin/stock/low
GET  /admin/stock/movements         ?materialId
POST /admin/stock/movements
```

## Field app (`TECHNICIAN`, `SURVEYOR` — scoped to own assignments)

`ADMIN` and `DISPATCHER` may also call these; with `?technicianId=` they act on that
technician's queue, and without one they have an empty queue rather than an error.

```
GET   /tech/jobs/today
GET   /tech/jobs                    ?from&to
GET   /tech/jobs/:id
PATCH /tech/jobs/:id/status         EN_ROUTE | IN_PROGRESS | ON_HOLD | COMPLETED
PATCH /tech/jobs/:id/tasks/:taskId
POST  /tech/jobs/:id/photos         multipart `files` + `kind`
POST  /tech/jobs/:id/materials
POST  /tech/jobs/:id/time/start  |  /time/stop
POST  /tech/jobs/:id/complete       { note, signatureMediaId, customerRating? }
POST  /tech/sync                    offline mutation queue replay (idempotency keys)

GET   /tech/surveys                 ?status              own surveys
GET   /tech/surveys/:id
POST  /tech/jobs/:id/survey         create-or-return for this INSPECTION job (201, then 200)
PUT   /tech/surveys/:id             save draft — fields + readings + items, FULL REPLACE
POST  /tech/surveys/:id/submit      DRAFT|RETURNED -> SUBMITTED, closes the inspection job
POST  /tech/surveys/:id/photos      multipart -> JobPhoto{ kind: 'ISSUE' } on the parent job
GET   /tech/materials               offline reference — id, code, name, unit. NO rate.
GET   /tech/rate-card               offline reference — id, code, name, unit. NO rate.
```

`/tech` responses never carry money. `PUT /tech/surveys/:id` accepts quantities only; a
payload carrying `rate` or `amount` is rejected (400), not silently ignored.

`sync` gains the mutation kinds `survey_draft` and `survey_submit`, which address a
`surveyId` instead of a `jobId`. A replayed `survey_submit` on a survey that is still
`SUBMITTED` is a no-op: it comes back `applied`, and the survey is unchanged whatever payload
the replay carries. Once the office has moved the survey on (`IN_REVIEW`, `QUOTED`), a submit is
refused with 422 `INVALID_TRANSITION`, which the client treats as terminal and drops.

## Admin — Finance (`ADMIN`, `ACCOUNTANT`)

```
/admin/invoices                     GET ?status&customerId&overdueOnly&from&to&q, POST, GET /:id, PUT /:id
                                    no DELETE — an invoice is voided, never removed
POST   /admin/invoices/:id/send
POST   /admin/invoices/:id/void     { reason }
POST   /admin/invoices/from-job/:jobId          once per job — a second is 422
POST   /admin/invoices/:id/payments             payments:write · an overpayment is refused;
                                                status (PARTIAL / PAID) follows the paid total
POST   /admin/invoices/:id/payments/:paymentId/void   payments:write · { reason } (3–500 chars)
                                    -> 200 the payment, with voidedAt, voidReason, voidedById set.
                                    Payments are never deleted (the old DELETE is gone). paidAmount is
                                    recomputed from the payments not voided, and the status follows it
                                    back down: PAID → PARTIAL, or → SENT / OVERDUE (past due) when none
                                    are left. 400 no reason · 404 payment not on this invoice ·
                                    422 already voided
GET    /admin/payments              ?q&method&customerId&from&to    payments:read
                                    q matches the payment reference, invoice number or customer.
                                    Voided payments are listed, flagged by voidedAt — never hidden
/admin/expenses                     GET, GET /:id, POST, PUT /:id, DELETE /:id
GET  /admin/reports/aging
GET  /admin/reports/revenue         ?groupBy=service|month|technician
GET  /admin/reports/collections     ?from&to   payments received, summed by method (voided excluded)
GET  /admin/customers/:id/statement             ledger of invoices and payments (voided excluded)
```

## Admin — Aftercare (reads `ADMIN`, `DISPATCHER`, `SALES`; writes `ADMIN`, `DISPATCHER`)

```
/admin/warranties                   GET, GET /expiring ?days, GET /:id, PUT /:id
/admin/warranty-claims              GET, PATCH /:id { status: accepted|rejected|resolved,
                                                      rejectReason?, scheduledStart? }
                                    accepting creates the free WARRANTY job, linked to the original;
                                    rejecting needs a reason
/admin/amc-contracts                GET, GET /renewals-due ?days, POST, GET /:id, PUT /:id, DELETE /:id
                                    POST lays down the visit schedule; visits come back inside GET /:id,
                                    and a cron turns each into a scheduled job a week before it is due
/admin/service-reminders            GET, POST, PUT /:id (pending only — 422 once sent), DELETE /:id
```

## Admin — Platform

```
/admin/users                        ADMIN · GET, POST, PUT /:id, PATCH /:id/toggle, DELETE /:id
                                    an admin cannot disable or delete their own account (400)
                                    events: user.created · user.role_changed · user.disabled (toggle off,
                                    PUT isActive=false, DELETE)
GET   /admin/audit-logs             ADMIN · paginated, newest first
                                    ?event&actorType=user|public|system&requestId&model&recordId&actorId
                                     &action&from&to&q&page&limit&sort=createdAt|-createdAt
                                    q matches event/model/action (contains) or recordId/requestId (exact)
                                    400 on an unknown actorType or sort
                                    row: { id, event, action, model, recordId, actorId, actorType,
                                           requestId, ip, userAgent, before, after, changes, createdAt,
                                           actor: { id, name, role } | null }
/admin/message-templates            ADMIN · GET, POST, PUT /:id, DELETE /:id
GET   /admin/message-logs           ADMIN · ?status&channel
GET   /admin/notifications          own only · ?unreadOnly · meta.unread
PATCH /admin/notifications/:id/read  ·  PATCH /admin/notifications/read-all
GET   /admin/dashboard              every role · role-aware widget payload
GET   /admin/reports/lead-sources | /funnel | /sla                  reports:sales
GET   /admin/reports/job-margin | /technicians | /warranty-claims   reports:ops
```

## Audit log

Two kinds of `AuditLog` row, both carrying `requestId`, `actorId`, `actorType`, `ip` and `userAgent`
from the request (or `<task>:<job id>` and `system` for background work):

- **Model change** — written automatically by the Prisma extension for `create`, `createMany`, `update`,
  `updateMany`, `upsert`, `delete`, `deleteMany` on every model except `AuditLog`, `RefreshToken`,
  `PasswordReset`, `MessageLog`, `Notification`, `JobStatusEvent`, `LeadActivity`, `Counter`.
  `event` is null, `action` is the operation without `Many`, `before`/`after` hold only the scalar
  columns that changed (redacted: anything named `*password*`, `*token*`, `*secret*`, `otp*`), one row
  per record for bulk writes (the first 500; past that a warning is logged). `changes` is null.
- **Domain event** — a named business moment. `action` is the part after the dot, `before`/`after`
  hold the fields that describe it, and `changes` holds extra detail (`meta`). Written in the same
  transaction as the change, so a rollback removes it too.

Rows written before Phase B have `changes` holding the sanitized write data, no `before`/`after`, and
`actorType` `user`.

| Event | Fires when | before → after · meta |
|---|---|---|
| `lead.created` | a lead is created from the public form (`public`) or by staff | → status, source, priority, serviceId, assignedToId |
| `lead.status_changed` | any lead status move (`transitionLead`: staff, convert, approval, survey quote, merge) | status → status · note |
| `lead.assigned` | `PATCH /admin/leads/:id/assign` | assignedToId → assignedToId · note |
| `lead.merged` | `POST /admin/leads/merge`, on the primary lead | · duplicateIds |
| `lead.converted` | `POST /admin/leads/:id/convert` | customerId → customerId · quotationId, jobId, surveyId |
| `quotation.created` | a quotation is created (admin, convert, survey quote) | → number, status, total, customerId, leadId |
| `quotation.sent` | `POST /admin/quotations/:id/send` | status → SENT |
| `quotation.customer_approved` | the customer approves by link (`public`) | SENT → APPROVED · note |
| `quotation.customer_rejected` | the customer rejects by link (`public`) | SENT → REJECTED · note |
| `quotation.expired` | a SENT quotation past `validUntil` is expired by the link or the `quotation:expire` task | SENT → EXPIRED |
| `quotation.revised` | `POST /admin/quotations/:id/revise`, on the new version | → number, version, status, total · parentId, version |
| `job.created` | a job is created (admin, convert, quotation) | → number, type, status, customerId, quotationId, leadId, technicianIds |
| `job.status_changed` | `PATCH …/jobs/:id/status` (admin or field app), except completion | status → status · note |
| `job.assigned` | `POST /admin/jobs/:id/assign` | technicianIds, status → technicianIds, status |
| `job.completed` | a job is completed (admin, field app, survey submit) | status → COMPLETED · customerRating |
| `job.verified` | `POST /admin/jobs/:id/verify` | COMPLETED → VERIFIED |
| `invoice.created` | an invoice is created (admin or from a job) | → number, status, total, customerId, quotationId |
| `invoice.sent` | `POST /admin/invoices/:id/send` | status → SENT |
| `invoice.voided` | `POST /admin/invoices/:id/void` | status → VOID · reason |
| `payment.recorded` | `POST /admin/invoices/:id/payments` (model `Payment`) | → invoiceId, amount (paisa), method, reference · invoiceStatus, paidAmount |
| `payment.voided` | `POST …/payments/:paymentId/void` (model `Payment`) | voidedAt, amount → voidedAt, voidReason · invoiceId, invoiceStatus, paidAmount |
| `survey.submitted` | the surveyor submits (model `SiteSurvey`) | DRAFT/RETURNED → SUBMITTED · jobId, lines |
| `survey.returned` | `PATCH /admin/surveys/:id/review` with RETURNED | status → RETURNED · note |
| `survey.quoted` | `POST /admin/surveys/:id/quotation` | status → QUOTED · quotationId, quotationNumber |
| `auth.login` | a successful sign-in (actor = the user) | |
| `auth.login_failed` | a wrong password, a locked or disabled account, or an unknown email (`public`; recordId null, `meta.email` for the last) | · reason, attempt |
| `auth.locked` | the fifth consecutive failure locks the account | → lockedUntil · attempts |
| `auth.logout` | `POST /auth/logout` with a live refresh cookie (actor = the user) | |
| `auth.password_changed` | `POST /auth/change-password` or `POST /auth/reset-password` | · via: change_password \| reset_link |
| `auth.password_reset_requested` | `POST /auth/forgot-password` for an existing, active account (nothing is written for an unknown email) | |
| `settings.changed` | `PATCH /admin/settings`, once per save, only the keys whose value moved | { key: old } → { key: new } · keys |
| `export.csv` | `GET /admin/leads/export.csv` | · the filters used |
| `cms.deleted` | a soft delete through the CRUD factory (any resource it mounts) or `DELETE /admin/media/:id` | |
| `cms.restored` | `PATCH …/:id/restore` | deletedAt → null |
| `cms.purged` | `?hard=true` (needs `cms:purge`), or a delete on a resource with no soft delete | the removed row's scalars → |
| `user.created` · `user.role_changed` · `user.disabled` | see `/admin/users` above | |

Reserved for Phase F and not emitted yet: `quotation.submitted`, `quotation.auto_approved`,
`quotation.office_approved`, `quotation.sent_back`, `quotation.pulled_back`,
`quotation.customer_changes_requested`, `quotation.superseded`. The list lives in
`MaintainanceBackend/src/shared/enums.js` (`AUDIT_EVENTS`); `recordEvent` refuses any other name.

## Not implemented

- Quotation, invoice and payment-receipt PDFs. The public token pages render the document in
  HTML and print cleanly; add a headless-browser renderer if a PDF file is required.
