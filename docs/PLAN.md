# Maintenance System — Master Build Plan

**Version:** 1.0 · **Date:** 2026-09-01
**Basis:** `homeplexdynamicsystemfindings.md` (site study of homeplexnepal.com)
**Stack:** Vite + React + MUI · Node/Express + Prisma + PostgreSQL · single-tenant · full field-service ops

---

## 0. The thesis

Homeplex is a **brochure**. Every promise on that page — 2-hour response, free consultation,
1-month warranty, transparent pricing, certified engineers — is an *operational* claim that the
site itself cannot keep, because nothing behind it tracks response time, jobs, technicians, or
warranties.

So we build the brochure *and* the machine that makes the brochure true:

| Their promise | Our system feature |
|---|---|
| "2 hour response" | Lead SLA timer, escalation, breach dashboard |
| "Free consultation, no visiting charge" | Inspection job type with zero-rate line item |
| "1 month warranty" | Warranty record auto-created on job completion, claim workflow |
| "Transparent pricing" | Public rate card + live sq.ft cost estimator |
| "Certified engineers" | Technician profiles, skills, ratings shown on job assignment |
| — | Quotations, work orders, materials, invoices, AMC contracts, reports |

The marketing site is **Module 1 of 9**, not the product.

---

## 1. Modules

```
M1  CMS + Public site      Dynamic, orderable, bilingual marketing site
M2  Media library          Upload, resize, WebP, alt text, folders
M3  Identity & RBAC        Users, roles, permissions, audit log
M4  Lead CRM               Capture → SLA → pipeline → assignment → conversion
M5  Customers & sites      Customer records, multiple properties per customer
M6  Quotations             Line items, rate card, VAT, PDF, approve/reject link
M7  Work orders (Jobs)     Scheduling, dispatch, technician mobile view, photos, sign-off
M8  Materials & costing    Catalog, stock, per-job consumption, job profitability
M9  Finance                Invoices, payments, expenses, VAT 13%, statements
M10 Aftercare              Warranty tracking, claims, AMC contracts, preventive visits
M11 Comms                  SMS (Sparrow), email, templates, in-app notifications
M12 Analytics & reports    Dashboards per role, exports, GA4/Pixel events
```

---

## 2. Architecture at a glance

```
                   ┌──────────────────┐
  Public visitor → │ apps/web  (Vite) │ ── SSG-ish, react-query, SEO tags, JSON-LD
                   └────────┬─────────┘
                            │ REST /api/v1/public/*
                   ┌────────▼─────────┐
                   │ apps/api         │  Express · Prisma · Postgres
   Staff / techs → │  auth · rbac     │  BullMQ + Redis (jobs: sms, email, images, SLA)
                   │  domain services │  S3-compatible object storage (or local disk in dev)
                   └────────▲─────────┘
                            │ REST /api/v1/admin/*
                   ┌────────┴─────────┐
                   │ apps/admin (Vite)│ ── MUI back-office, role-aware navigation
                   └──────────────────┘
```

Full detail in `docs/ARCHITECTURE.md`. Schema in `docs/DATA-MODEL.prisma`. Endpoints in `docs/API.md`.

---

## 3. Roles

| Role | Sees |
|---|---|
| `ADMIN` | Everything, settings, users, finance |
| `EDITOR` | CMS content + media only |
| `SALES` | Leads, customers, quotations |
| `DISPATCHER` | Jobs, scheduling, technicians, materials |
| `TECHNICIAN` | Only jobs assigned to them, mobile-first view |
| `ACCOUNTANT` | Invoices, payments, expenses, reports |

Permissions are role→action maps in `packages/shared/permissions.js`, enforced by `authorize()`
middleware on the API and used to hide navigation in the admin SPA. **The API is the authority;
the UI hiding things is a convenience, never a control.**

---

## 4. Build phases

Each phase is independently demoable and ends with hard acceptance criteria.
Estimates assume one full-time developer working with Claude Code.

---

### Phase 0 — Foundations · ~3 days

- Monorepo with npm workspaces: `apps/api`, `apps/web`, `apps/admin`, `packages/shared`.
- `docker-compose.yml`: postgres:16, redis:7, minio (S3 dev), mailpit (email dev).
- Prisma init, `.env.example`, config loader that **fails fast** on missing env vars.
- Express skeleton: helmet, cors (explicit origin allowlist), compression, pino logger with
  request id, rate limiter, `/healthz` and `/readyz`.
- Error class + error middleware + `asyncHandler` wrapper.
- Vite scaffolds for `web` and `admin` with MUI theme, router, axios client, react-query provider.
- ESLint + Prettier + Husky pre-commit. Vitest + Supertest configured.
- GitHub Actions: install → lint → test → build.

**Acceptance:** `npm run dev` starts all three apps; `/healthz` returns 200; CI green on an empty test.

---

### Phase 1 — Identity, RBAC, settings, media · ~5 days

- Models: `User`, `RefreshToken`, `PasswordReset`, `AuditLog`, `Setting`, `Media`, `MediaFolder`.
- Auth: register (admin-created only), login, refresh, logout, forgot/reset password, change password.
  Argon2id hashing. Access token 15m in memory; refresh token in httpOnly SameSite=Lax cookie, rotated on use.
- Login throttling: 5 failures per email+IP per 15 min → temporary lock.
- `authorize(...roles)` middleware + `packages/shared/permissions.js`.
- `AuditLog` written by a Prisma middleware for every create/update/delete on non-CMS models
  (actor, model, recordId, before/after diff, ip).
- **Settings** as typed key/value grouped rows (`contact`, `seo`, `branding`, `sla`, `finance`,
  `integrations`) with a generic admin editor. Seeded with the real contact data from the study:
  phones `01-5407720` / `9808338255`, email, Bhanimandal Lalitpur address, stat counters.
- **Media library:** multipart upload → sharp pipeline → original + `1600w/800w/400w` WebP +
  blurhash placeholder → S3/MinIO. Fields: alt text (en/ne), caption, folder, mime, size, dimensions.
  Admin grid with drag-drop upload, search, folder tree, and a reusable `<MediaPicker>` dialog.
- Admin shell: login page, role-aware sidebar, layout, toast system, confirm dialog, `<ResourceTable>`
  (server-side pagination/sort/search/bulk) and `<ResourceForm>` primitives. **Every later CRUD
  screen is built from these two components.**

**Acceptance:** Admin logs in, uploads an image, sees WebP derivatives; a SALES user gets 403 on
`/api/v1/admin/users`; audit log shows the settings change.

---

### Phase 2 — CMS content models + admin CRUD · ~7 days

All 20 sections of the studied page become data. Models (see `DATA-MODEL.prisma`):

`HeroSlide` · `ServiceCategory` · `Service` · `Project` + `ProjectImage` · `Offer` ·
`PricingPlan` · `Feature` (grouped cards) · `ListItem` (grouped numbered lists) ·
`ContentBlock` · `ProcessStep` · `Testimonial` · `GalleryImage` · `Faq` · `Page` ·
`Post` + `PostCategory` · `HomeSection` · `Translation`

Cross-cutting behaviours built once and reused:
- **Sortable:** drag-and-drop reorder writing `sortOrder`, single `PATCH /:resource/reorder`.
- **Publishable:** `isActive` toggle + `publishedAt` scheduling.
- **Translatable:** a `Translation(model, recordId, field, locale, value)` table with a
  `<LocaleTabs>` field wrapper (EN | NE) in the admin, and a `withLocale()` resolver on read.
- **SEO block:** `metaTitle`, `metaDescription`, `ogImageId`, `canonicalUrl` on Service, Project, Page, Post.
- **Soft delete + restore** with a trash view.

**Home page composer:** `HomeSection(key, sortOrder, isVisible, settings JSON)` — marketing drags
sections into order, hides any of them, and the public renderer walks that list. No developer needed
to rearrange the page.

**Fixing the study's findings:**
- Service `excerpt` and `body` are required and validated as unique-ish — the templated
  *"Professional {service} with expert tools and results."* boilerplate is rejected by a seed lint check.
- Every service and project gets a slug and a real detail page (Phase 3).

**Acceptance:** An EDITOR can build the entire home page — reorder sections, add a hero slide, a
service, a project with a gallery, an offer in Nepali — with zero code changes, and see it live.

---

### Phase 3 — Public site + SEO + estimator · ~7 days

Routes (`apps/web`):
```
/                       home, sections rendered from HomeSection order
/services               grid + category filter
/services/:slug         detail: body, gallery, price range, FAQs, related projects, inquiry form
/projects               filterable portfolio
/projects/:slug         case study + image gallery + lightbox
/offers                 active offers only, respects starts_at/ends_at
/pricing                full rate card + cost estimator
/gallery                masonry, lazy loaded
/blog  /blog/:slug      SEO long-tail
/faq  /about  /contact  contact with map embed
/:slug                  generic Page fallback
/ne/*                   Nepali mirror of every route
```

- **Cost estimator** (a real gap in the original): pick service → enter sq.ft / units → live
  min–max estimate from `PricingPlan` + `Service.priceFrom/priceTo` → "Get exact quote" converts
  to a Lead with the estimate attached. This is the highest-leverage conversion feature on the site.
- **Lead forms** everywhere: hero strip, service pages, offers, floating CTA. Honeypot + timing
  check + Cloudflare Turnstile + per-IP rate limit. Nepali phone regex `^(97|98)\d{8}$|^0\d{1,2}-\d{6,7}$`.
- Sticky mobile action bar: **Call**, **Viber**, **WhatsApp**, **Request visit**.
- SEO: per-route meta from DB, `sitemap.xml` and `robots.txt` generated from published content,
  JSON-LD `LocalBusiness` + `Service` + `Project` + `Review` + `FAQPage` + `BreadcrumbList`,
  OG/Twitter cards, canonical URLs, `hreflang` en/ne pairs.
- Performance budget: LCP < 2.5s on 4G, CLS < 0.1. Responsive `<picture>` with WebP srcset +
  blurhash placeholders, route-level code splitting, public GET responses cached in Redis (60s)
  and busted on content publish.
- Accessibility: keyboard-navigable, focus rings, alt text enforced at upload, contrast-checked theme.

**Acceptance:** Lighthouse ≥ 90 on Performance/SEO/Accessibility for `/` and `/services/:slug`;
Nepali page renders Devanagari correctly; estimator produces a lead visible in admin.

---

### Phase 4 — Lead CRM + 2-hour SLA + notifications · ~6 days

This is the module that pays for the project.

- `Lead`: name, phone, altPhone, email, address, area, serviceId, message, source
  (`web_form|estimator|call|whatsapp|viber|walk_in|referral`), sourcePage, utm fields, ip, userAgent,
  attachments, estimatedAmount, status, priority, assignedToId, firstResponseAt, slaDueAt, closedAt,
  lostReason.
- Pipeline: `NEW → CONTACTED → INSPECTION_SCHEDULED → QUOTED → WON → LOST`. Kanban board with
  drag-between-columns, plus a table view with saved filters.
- **SLA engine:** `slaDueAt = createdAt + settings.sla.leadResponseMinutes` (default 120).
  A BullMQ delayed job fires at T−30min (warn) and T+0 (breach). Dashboard shows a live countdown
  chip per lead: green / amber / red. `firstResponseAt` is stamped the moment a staff member logs the
  first contact activity — that timestamp is what the SLA report measures, not a status change.
- Duplicate detection on phone number; merge action.
- `LeadActivity` timeline (call, sms, email, note, status change, assignment) — auto-logged where
  possible, manual otherwise. `LeadNote` with @mentions.
- Assignment: manual, or round-robin among SALES users by service category.
- **Notifications (M11):** on new lead → in-app + email to sales + SMS via Sparrow SMS to the on-call
  number; on SLA warn/breach → escalate to ADMIN. All templates editable in settings with variable
  placeholders. Provider adapter interface so Sparrow can be swapped for Aakash SMS.
- Convert action: Lead → Customer (+ Site) → optionally straight into a Quotation or an Inspection Job.
- CSV export with the current filter applied.

**Acceptance:** Submitting the public form creates a lead, sends an SMS + email within 30s, shows a
120-minute countdown, escalates on breach, and converts cleanly into a Customer + Quotation.

---

### Phase 5 — Customers, sites, quotations, rate card · ~6 days

- `Customer` (individual | company, PAN/VAT no., phones, email, notes, tags) with
  `CustomerSite` (label, address, area, coordinates, access notes, photos) — one customer can own
  several properties, which matters for AMC later.
- `RateCardItem`: code, name (en/ne), unit (`sq.ft`, `rft`, `nos`, `hour`, `lump`), rate, category,
  isActive. This single table feeds the public pricing page, the estimator, and quotation line items —
  one source of truth for price.
- `Quotation`: number (`QT-2082-0001`, resets per fiscal year), customer, site, validUntil, items
  (from rate card or free-text), qty, rate, discount, subtotal, VAT 13% toggle, total, terms,
  internal notes, status `DRAFT → SENT → APPROVED → REJECTED → EXPIRED → CONVERTED`.
- Versioning: revising a sent quotation creates `v2` and keeps the history.
- PDF generation (branded, bilingual) + email/SMS send with a **public token link** where the
  customer can Approve or Reject without logging in; the decision is recorded with IP and timestamp.
- Approved quotation → "Create Job" in one click, carrying line items across.

**Acceptance:** Quote built from the rate card, VAT correct to the paisa, PDF matches on-screen
totals, customer approves via link, job is created pre-populated.

---

### Phase 6 — Work orders, dispatch, technician view · ~9 days

The operational core.

- `Job`: number (`JOB-2082-0001`), type (`INSPECTION|REPAIR|INSTALLATION|RENOVATION|AMC_VISIT|WARRANTY`),
  customer, site, sourceLead, sourceQuotation, description, priority, scheduledStart, scheduledEnd,
  actualStart, actualEnd, status
  `DRAFT → SCHEDULED → ASSIGNED → EN_ROUTE → IN_PROGRESS → ON_HOLD → COMPLETED → VERIFIED → CANCELLED`.
- `JobTask` checklist (from a `JobTemplate` per service — e.g. "Seepage repair" seeds its 6
  checkpoints straight from the studied page's checklist), each with done/skipped + note.
- `JobAssignment`: many technicians per job, one lead technician, role on job, accepted/declined.
- `Technician` profile: skills, certifications, service areas, daily capacity, rating, active hours.
  Assignment UI surfaces skill match, current load, and distance.
- `JobStatusEvent` — immutable audit of every transition with actor, timestamp, geo (optional), note.
- `JobPhoto` typed `BEFORE | DURING | AFTER | ISSUE | SIGNATURE`, EXIF-stripped, compressed client-side.
- `TimeLog` per technician per job (start/stop), feeding labour cost and productivity reports.
- **Dispatch board:** day/week calendar by technician (drag to schedule/reassign), unassigned queue,
  conflict and overtime warnings, map view of the day's jobs.
- **Technician mobile view** (`/tech` inside admin, mobile-first, installable PWA):
  today's jobs → job detail → tap-to-call/navigate → start → checklist → photos → materials used →
  time → customer signature on canvas → complete. Offline-tolerant: a service worker queues
  mutations and syncs on reconnect (this is Kathmandu; connectivity drops).
- On `COMPLETED`: customer gets an SMS with a rating link; a `Warranty` record is auto-created
  (Phase 9); job becomes invoiceable.

**Acceptance:** Dispatcher schedules a job on the calendar; the assigned technician completes the
whole flow on a phone, offline for part of it, and everything syncs — photos, checklist, signature,
time, materials.

---

### Phase 7 — Materials, stock, job costing · ~5 days

- `MaterialCategory`, `Material` (code, name en/ne, unit, purchaseRate, sellRate, reorderLevel,
  supplierId), `Supplier`.
- `StockMovement` (`PURCHASE|ISSUE_TO_JOB|RETURN|ADJUSTMENT|WASTAGE`) — current stock is derived
  from movements, never stored as a mutable number.
- `JobMaterial`: material, qty, rate at time of issue, billable flag. Issuing from the technician
  view writes a stock movement.
- `PurchaseOrder` + receipt (lightweight).
- Low-stock alerts to DISPATCHER.
- **Job costing:** labour (TimeLog × technician rate) + materials + expenses vs. invoiced amount →
  per-job margin, and a margin-by-service-type report. This is the number the owner actually wants
  and the original site has no way to produce.

**Acceptance:** Materials issued on a job reduce stock, appear on the invoice, and the job P&L
reconciles to the paisa.

---

### Phase 8 — Invoicing, payments, finance · ~6 days

- `Invoice`: number (`INV-2082-0001`), customer, job(s), items (pulled from quotation + actual
  materials/labour), discount, VAT 13%, total, dueDate, status `DRAFT|SENT|PARTIAL|PAID|OVERDUE|VOID`.
- `Payment`: amount, method (`CASH|BANK|ESEWA|KHALTI|FONEPAY|CHEQUE`), reference, receivedAt,
  receivedBy, receipt PDF. Partial payments supported; invoice status derived.
- `Expense`: category, amount, jobId (optional), vendor, bill photo, approvedBy.
- Nepal specifics: VAT 13% configurable, PAN/VAT number on documents, invoice numbering per BS
  fiscal year (Shrawan–Ashadh), BS date shown alongside AD on printed documents.
- Aging report (0-30/31-60/61-90/90+), customer statement, revenue by service/month, collection report.
- Overdue reminders: automated SMS/email at +1, +7, +15 days.

**Acceptance:** Job → invoice with real materials and labour, partial payment recorded, aging report
correct, VAT arithmetic verified by test against hand-computed fixtures.

---

### Phase 9 — Warranty, AMC, retention · ~5 days

Turns one-off jobs into recurring revenue — the biggest strategic gap in the original site.

- `Warranty`: auto-created on job completion. `startsAt = job.actualEnd`,
  `endsAt = +settings.warranty.defaultDays` (30, per the public promise), scope text, per-service
  override, status `ACTIVE|EXPIRED|VOID|CLAIMED`. Certificate PDF sent to the customer.
- `WarrantyClaim`: customer raises via a public token link or phone; creates a zero-cost
  `WARRANTY` job; tracked to resolution. Claim rate per service is a quality report.
- `AmcContract`: customer, site(s), plan, startDate, endDate, visitsPerYear, amount, billing cycle,
  covered services, status. Auto-generates `AmcVisit` schedule; a cron creates the `AMC_VISIT` jobs
  7 days before each due date and reminds the customer.
- `ServiceReminder`: rule-based follow-ups ("waterproofing done 11 months ago → pre-monsoon check").
  This is the single highest-ROI feature for a maintenance business in Nepal.
- Renewal pipeline: contracts expiring in 60 days surface on the sales dashboard.
- Customer feedback: post-job rating + comment; 4★+ prompts a testimonial that lands in the CMS
  `Testimonial` moderation queue — closing the loop back to Module 1.

**Acceptance:** Completed job produces a warranty certificate; a claim spawns a free job; an AMC
contract auto-schedules and auto-creates its visits.

---

### Phase 10 — Dashboards, reports, hardening, launch · ~6 days

- Role dashboards: ADMIN (revenue, margin, pipeline, SLA compliance, tech utilisation),
  SALES (my leads, SLA at risk, conversion rate), DISPATCHER (today's board, unassigned, overdue),
  TECHNICIAN (my day), ACCOUNTANT (receivables, aging, collections).
- Reports with date-range + CSV/PDF export: lead source ROI, conversion funnel, SLA compliance,
  revenue by service, job margin, technician productivity, warranty claim rate, AMC renewals.
- GA4 + Meta Pixel on the public site with events: `form_submit`, `call_click`, `whatsapp_click`,
  `estimator_used`, `quote_approved` — attributed back to `Lead.utm*` so ad spend is measurable.
- **Security pass:** OWASP checklist, `npm audit`, rate limits on all public POSTs, file-type and
  magic-byte validation on upload, signed URLs for private media, PII access logged, CSP headers,
  dependency pinning. Public token links (quote approval, warranty claim) are single-purpose,
  expiring, and scoped to one record.
- **Backups:** nightly `pg_dump` to off-site storage, weekly restore drill documented.
- Load test the public home page and the lead endpoint.
- Deploy: Docker images, nginx reverse proxy, Let's Encrypt, PM2/systemd, staging + production,
  Sentry, uptime monitor, runbook in `docs/OPERATIONS.md`.
- Admin user manual (English + Nepali) and a 20-minute handover video.

**Acceptance:** Production deployed, backups verified by an actual restore, staff trained, real leads
flowing.

---

## 5. Timeline

| Phase | Days | Cumulative |
|---|---|---|
| 0 Foundations | 3 | 3 |
| 1 Identity/media | 5 | 8 |
| 2 CMS | 7 | 15 |
| 3 Public site | 7 | 22 |
| 4 Lead CRM + SLA | 6 | 28 |
| 5 Customers/quotes | 6 | 34 |
| 6 Jobs/dispatch | 9 | 43 |
| 7 Materials | 5 | 48 |
| 8 Finance | 6 | 54 |
| 9 Warranty/AMC | 5 | 59 |
| 10 Reports/launch | 6 | **65 days ≈ 13 weeks** |

**MVP cut line for a first revenue-generating release: Phases 0–4 (28 days).**
That ships the public site plus the lead CRM with the SLA — everything the current site does, done
better, plus the one thing it cannot do. Phases 5–10 then land incrementally without downtime.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Scope creep — 9 modules is a lot | Phase gates with acceptance criteria; MVP cut line at Phase 4 |
| Technicians won't use the mobile app | Design for 6 taps end-to-end, offline-first, Nepali UI, pilot with two techs in Phase 6 |
| SMS gateway reliability / cost | Provider adapter interface; queue with retry + dead-letter; email fallback |
| Spam on public lead forms | Turnstile + honeypot + timing + IP rate limit + phone-format validation |
| Nepali (Devanagari) rendering & sorting | `utf8mb4`/UTF-8 end to end, tested fixtures, Noto Sans Devanagari webfont subset |
| BS date + fiscal-year numbering mistakes | Isolate in one `nepaliDate` util with a full test suite; AD is the source of truth in the DB |
| Offline sync conflicts | Last-write-wins per field with a server-side event log; photos are append-only so never conflict |
| Money rounding | Integer paisa everywhere; VAT computed once at document level; fixture-based tests |

---

## 7. Definition of done (any phase)

- Zod schema in `packages/shared`, used by both API and UI.
- API route validated, authorized, paginated, documented in `docs/API.md`.
- Prisma migration committed + seed data updated.
- Admin UI built from `<ResourceTable>` / `<ResourceForm>`.
- Tests: unit for service logic, Supertest for routes, one happy-path E2E.
- Both locales present for user-visible strings.
- Works on a 360px viewport.
- No console errors, no `TODO` left in shipped code.
