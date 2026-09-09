# API Surface — `/api/v1`

Conventions: `{ data, meta }` on success · `{ error: { code, message, details } }` on failure ·
lists accept `?page&limit&sort&q` plus per-resource filters · all mutations audited.

## Public (no auth, rate-limited, cached 60s where marked ⚡)

```
GET  /public/bootstrap              ⚡ settings + nav + home sections + booking rules in one call
GET  /public/home                   ⚡ every visible home section, hydrated, in order
GET  /public/services               ⚡ ?category&featured
GET  /public/services/:slug         ⚡ + related projects, faqs
GET  /public/projects                 ?service=<slug>&category=<slug>  case studies               ⚡ ?category&status
GET  /public/projects/:slug         ⚡
GET  /public/offers                 ⚡ active window only
GET  /public/pricing                ⚡ pricing plans + rate card
GET  /public/gallery                ⚡
GET  /public/testimonials           ⚡ approved only
GET  /public/faqs                   ⚡ ?group
GET  /public/posts  /posts/:slug    ⚡
GET  /public/pages/:slug            ⚡
POST /public/estimate                 { serviceId, qty, unit } -> { min, max, breakdown }
GET  /public/availability             ?from&days  free survey capacity per day and slot
                                      demand = scheduled INSPECTION jobs + booking leads still
                                      NEW/CONTACTED (past that they have a Job and would double-count)
                                      cached 30s; a full slot is flagged, never rejected
POST /public/leads                    honeypot + turnstile + rate limit -> creates Lead
                                      online booking adds { preferredAt, preferredSlot },
                                      which sets source=booking; a closed weekday is rejected
GET  /public/quotations/:token        customer views a quotation
POST /public/quotations/:token/decide { decision: approve|reject, note }
GET  /public/warranties/:token
POST /public/warranties/:token/claim
GET  /sitemap.xml   /robots.txt
```

## Auth

```
POST /auth/login            -> access token + httpOnly refresh cookie
POST /auth/refresh
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/change-password
GET  /auth/me
```

## Admin — CMS (`ADMIN`, `EDITOR`)

Full CRUD for each, plus `PATCH /:resource/reorder` and `PATCH /:id/toggle`:

```
/admin/settings                 GET, PATCH (bulk)
/admin/media                    GET, POST (upload), PATCH, DELETE ; /admin/media/folders
/admin/home-sections            GET, PATCH reorder/visibility
/admin/hero-slides
/admin/service-categories
/admin/services
/admin/projects                 + /:id/images
/admin/offers
/admin/pricing-plans
/admin/rate-card
/admin/features                 ?group=
/admin/list-items               ?group=
/admin/content-blocks
/admin/process-steps
/admin/testimonials             + PATCH /:id/approve
/admin/gallery
/admin/faqs
/admin/pages  /admin/posts  /admin/post-categories
/admin/translations             GET/PUT ?model&recordId
```

## Admin — CRM (`ADMIN`, `SALES`)

```
GET    /admin/leads                 ?status&assignedTo&source&slaRisk&from&to
POST   /admin/leads                 manual entry (phone/walk-in)
GET    /admin/leads/:id
PATCH  /admin/leads/:id
PATCH  /admin/leads/:id/status
PATCH  /admin/leads/:id/assign
POST   /admin/leads/:id/notes
POST   /admin/leads/:id/activities  logging a call stamps firstResponseAt
POST   /admin/leads/:id/convert     { createInspectionJob, scheduledStart, scheduledEnd, surveyorId, ... }
                                    -> { customerId, siteId, quotationId?, jobId? }
                                    assigning surveyorId schedules the visit and pre-creates its SiteSurvey
POST   /admin/leads/merge           { primaryId, duplicateIds }
GET    /admin/leads/export.csv
GET    /admin/leads/sla-board       at-risk + breached

/admin/customers                    CRUD + /:id/sites CRUD + /:id/timeline
/admin/quotations                   CRUD + /:id/send + /:id/pdf + /:id/revise + /:id/convert-to-job
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
                                     -> { survey, quotation }  rates in RUPEES   quotations:write
DELETE /admin/surveys/:id            soft delete, DRAFT only                     surveys:write
```

`GET /:id/pricing` resolves each quantity line against today's catalogue —
`LABOUR → rateCardItem.rate`, `MATERIAL → material.sellRate`, `SERVICE → service.priceFrom` —
and returns anything unpriceable in `missing[]` with a reason rather than pricing it at zero.

## Admin — Operations (`ADMIN`, `DISPATCHER`)

```
GET    /admin/jobs                  ?status&type&technicianId&from&to&customerId
POST   /admin/jobs
GET    /admin/jobs/:id
PATCH  /admin/jobs/:id
PATCH  /admin/jobs/:id/status       validated transition, writes JobStatusEvent
POST   /admin/jobs/:id/assign       { technicianIds, leadTechnicianId }
POST   /admin/jobs/:id/tasks        + PATCH /tasks/:taskId
POST   /admin/jobs/:id/photos
POST   /admin/jobs/:id/materials
POST   /admin/jobs/:id/time-logs
POST   /admin/jobs/:id/complete     { note, signature } -> creates Warranty, enables invoicing
GET    /admin/jobs/:id/costing      labour + materials + expenses vs invoiced
POST   /admin/jobs/:id/publish-case-study   cms:write · COMPLETED|VERIFIED only
                                    pre-fills problem/solution from the survey, duration from the
                                    job, images from its BEFORE/AFTER photos, and the cost as a
                                    +/-20% band. The customer's name is omitted unless opted in.

GET    /admin/dispatch/board        ?date&view=day|week  technicians x timeslots
GET    /admin/dispatch/unassigned
GET    /admin/technicians           + CRUD, availability, skills
GET    /admin/job-templates         + CRUD

/admin/materials  /admin/material-categories  /admin/suppliers
GET  /admin/stock                   derived balances
POST /admin/stock/movements
GET  /admin/stock/low
```

## Field app (`TECHNICIAN`, `SURVEYOR` — scoped to own assignments)

```
GET   /tech/jobs/today
GET   /tech/jobs                    ?from&to
GET   /tech/jobs/:id
PATCH /tech/jobs/:id/status         EN_ROUTE | IN_PROGRESS | ON_HOLD | COMPLETED
PATCH /tech/jobs/:id/tasks/:taskId
POST  /tech/jobs/:id/photos
POST  /tech/jobs/:id/materials
POST  /tech/jobs/:id/time/start  |  /time/stop
POST  /tech/jobs/:id/complete       { note, signatureImage, rating? }
POST  /tech/sync                    offline mutation queue replay (idempotency keys)

GET   /tech/surveys                 ?status              own surveys
GET   /tech/surveys/:id
POST  /tech/jobs/:id/survey         create-or-return for this INSPECTION job (idempotent)
PUT   /tech/surveys/:id             save draft — fields + readings + items, FULL REPLACE
POST  /tech/surveys/:id/submit      DRAFT|RETURNED -> SUBMITTED, closes the inspection job
POST  /tech/surveys/:id/photos      multipart -> JobPhoto{ kind: 'ISSUE' } on the parent job
GET   /tech/materials               offline reference — id, code, name, unit. NO rate.
GET   /tech/rate-card               offline reference — id, code, name, unit. NO rate.
```

`/tech` responses never carry money. `PUT /tech/surveys/:id` accepts quantities only; a
payload carrying `rate` or `amount` writes nothing. `sync` gains the mutation kinds
`survey_draft` and `survey_submit`, which address a `surveyId` instead of a `jobId`.
A replayed `survey_submit` returns 422 `INVALID_TRANSITION` — the client must treat that
as terminal success and drop it from the queue rather than retrying forever.

## Admin — Finance (`ADMIN`, `ACCOUNTANT`)

```
/admin/invoices                     CRUD + /:id/send + /:id/pdf + /:id/void
POST /admin/invoices/from-job/:jobId
/admin/payments                     CRUD + /:id/receipt.pdf
/admin/expenses                     CRUD
GET  /admin/reports/aging
GET  /admin/reports/revenue         ?groupBy=service|month|technician
GET  /admin/reports/collections
GET  /admin/customers/:id/statement
```

## Admin — Aftercare

```
/admin/warranties                   GET, PATCH ; GET /expiring
/admin/warranty-claims              GET, PATCH, POST /:id/create-job
/admin/amc-contracts                CRUD + /:id/visits + /renewals-due
/admin/service-reminders            CRUD
```

## Admin — Platform (`ADMIN`)

```
/admin/users                        CRUD + /:id/toggle
GET /admin/audit-logs               ?model&recordId&actorId&from&to
/admin/message-templates            CRUD
GET /admin/message-logs
GET /admin/notifications            + PATCH /:id/read
GET /admin/dashboard                role-aware widget payload
```
