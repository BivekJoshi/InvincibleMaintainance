# Admin Panel & Workflow Plan — v2

**Date:** 2026-09-11 · **Basis:** audit of `DEVELOPMENT` @ `c60995f` · **Supersedes:** the "Next" list in `STATUS.md`
**Scope:** finish the back office — service listing, every CMS action, lead management + CRM,
the engineer → office-approval → customer-acceptance → job workflow, and proper logging/audit.

`docs/PLAN.md` (v1) stays as the original blueprint. This document is the build order from here.

**Run it with the prompts in `docs/prompts/`** — one self-contained prompt per phase, each ending with the docs it must update. `docs/prompts/DOCS-SYNC.md` reconciles all docs with the code at any time.

---

## 1. Where the project stands

The **backend is effectively complete** for all eleven v1 phases: 7 routers, ~60 services, the CRUD
factory, state machines, SLA engine, queues/crons, and 59/59 unit tests passing. The **public
site is complete** and `vite build` succeeds. The **back office is the gap**: the admin area has
8 pages and roughly 85% of the admin API has no screen.

| Module | Backend | Admin UI today |
|---|---|---|
| Auth / RBAC | ✅ | ✅ login, role-gated routes |
| Dashboard | ✅ role-aware payload | ✅ read-only (job/invoice/warranty cards say "soon") |
| **CMS — 16 resources, home composer, translations** | ✅ CRUD factory | ❌ none — an EDITOR sees only the dashboard |
| **Services / categories / rate card** | ✅ | ❌ none |
| Media library, settings | ✅ | ❌ none |
| **Leads** | ✅ | ⚠ list + detail; no create, edit, status, assign, merge, delete, board |
| SLA board | ✅ | ✅ |
| **Customers + sites** | ✅ | ❌ none |
| Site surveys | ✅ | ✅ inbox + review + build quotation |
| **Quotations** | ✅ (no internal approval) | ⚠ list + builder; no create, delete, convert-to-job |
| Jobs, dispatch, technicians, templates | ✅ | ❌ none (only the `/tech` field app) |
| Materials, stock, suppliers | ✅ | ❌ none |
| Invoices, payments, expenses, reports | ✅ | ❌ none |
| Warranties, claims, AMC, reminders | ✅ | ❌ admin none (public token pages exist) |
| Users, audit log, message templates/logs | ✅ | ❌ none |
| Notifications | ✅ | ⚠ unread count only; bell has no panel |

Shared admin primitives: `components/common/DataTable.jsx` exists (server paging/sort/search) but has
no row actions, bulk select, filter API, reorder or trash view. **`<ResourceForm>` does not exist.**
Missing shadcn pieces: sheet, alert-dialog, textarea, popover, calendar, command, breadcrumb,
scroll-area, radio-group, accordion.

---

## 2. The target workflow vs. what exists

```
 Customer books / enquires ──► Lead (2h SLA) ──► Inspection job + SiteSurvey ──► Engineer submits survey
        ✅ /book, forms            ✅                ✅ convert + surveyorId            ✅ /tech, offline
                                                                                       │
                                                                                       ▼
 Job starts ◄── Customer accepts ◄── Offered to customer ◄── Back-office approval ◄── Quotation drafted
    ❌ manual       ⚠ token link        ✅ token link + SMS      ❌ DOES NOT EXIST        ✅ office prices survey
    dispatcher      expired quotes      but nothing gates it                             (engineer never sees
    not notified    still approvable                                                     rates — "money wall")
```

Gaps against the intended business process:

1. **No internal approval.** `QUOTATION_TRANSITIONS` is `DRAFT → SENT`
   (`MaintainanceBackend/src/shared/stateMachines.js:14`). Anyone with `quotations:write` (SALES)
   can send any price to a customer. `APPROVED` currently means *the customer* approved.
2. **Customer acceptance does not start anything.** `decideByToken`
   (`src/services/quotation.service.js:195`) notifies ADMIN + SALES only. DISPATCHER, who owns
   `jobs:write`, is never told. A job needs someone to press convert-to-job by hand.
3. **Customers cannot ask for changes.** The link offers only approve or reject, so change requests happen
   off-system by phone. Decided (D4): keep the link one-tap simple with no OTP, add "Ask for changes",
   and add a customer account in Phase K.
4. **Who writes "the engineer's quotation"** is undefined. Today the surveyor reports quantities
   only, and SALES/ADMIN turns them into money. See decision D1.

---

## 3. Defects to fix before building on top

| # | Severity | Defect | Where |
|---|---|---|---|
| 1 | **High · money** | Lead-convert builds a quotation by hand with `vatApplied: true`, `vatRate: 13` but `vatAmount: 0` and `total = subtotal`, bypassing `documentTotals`. The customer can be sent a quote missing its VAT. | `src/services/convert.service.js:44-67` |
| 2 | **High** | Expired quotations can still be approved. Expiry is only applied when someone GETs the quotation, and `decideByToken` checks `status === 'SENT'` only. There is no expiry cron. | `quotation.service.js:188,198` |
| 3 | **High** | A `SENT` quotation can be edited in place. `updateQuotation` blocks only APPROVED/CONVERTED, so a customer can approve numbers different from the ones they were sent. `reviseQuotation` never supersedes the parent. | `quotation.service.js:85` |
| 4 | **High · security** | Access tokens and refresh cookies are almost certainly in the logs. The pino logger has no `redact`, and pino-http's default serializer logs request headers. | `src/lib/logger.js`, `src/app.js:22` |
| 5 | **High · finance** | Payments are hard-deleted, although CLAUDE.md requires soft delete and money records must never vanish. | `invoice.service.js:243` |
| 6 | Medium | Lead status is written past the state machine (`→ WON` with `.catch(() => {})`; `→ CONTACTED / QUOTED / INSPECTION_SCHEDULED` directly). | `quotation.service.js:218`, `convert.service.js:37,70,103` |
| 7 | Medium | Lead-convert writes customer, lead, job and survey in separate statements, so a failure midway leaves orphans. | `convert.service.js` |
| 8 | Medium | EDITOR can `?hard=true` permanently delete any CMS row or media file. | `crud.service.js` via `cms.routes.js` |
| 9 | Medium | Audit gaps: `upsert` and `createMany` are not audited (so **settings changes are unaudited**, which fails the v1 Phase 1 acceptance). There is no before-state. Rows are written outside the transaction. Public and cron writes have no actor or IP. The lead-merge audit write fails silently. | `src/lib/prisma.js:38-64` |
| 10 | Medium | Leads CSV export always 401s. It uses `window.open`, but the API accepts only a Bearer header. | `MaintainanceFrontend/src/pages/admin/LeadsPage.jsx` |
| 11 | Medium | The booking wizard hardcodes `elapsedMs: 60_000`, which defeats the anti-spam timing check. | `components/booking/BookingWizard/BookingWizard.jsx` |
| 12 | Low | `npm run lint` fails: eslint 9 with no `eslint.config.js` in the frontend. | `MaintainanceFrontend/` |
| 13 | Low | Unvalidated `?sort` and `?status` reach Prisma. Sub-resource `:id` params are unvalidated in crm, ops and finance routes. Several lists are unpaginated. | routes |
| 14 | Low | `notify()` is awaited inside the request with no retry. Crons have no leader lock, so they are unsafe on more than one instance. | `notify.service.js`, `crons/index.js` |
| 15 | Low | Raw Prisma calls in route files (technicians, users, tech sync) break the "routes never touch Prisma" rule. | `ops.routes.js:95-129`, `platform.routes.js:87-137`, `tech.routes.js:214-283` |

---

## 4. Decisions (recorded 2026-09-14)

| # | Question | Decision |
|---|---|---|
| **D1** | Who prices the quotation after the site visit? | **The office.** The engineer reports quantities only; SALES / MANAGER / ADMIN price from the rate card. The money wall stays. |
| **D2** | Internal approval | New **MANAGER** role and ADMIN hold `quotations:approve`. **No self-approval** (setting, default on). **Auto-approve** below `quotation.autoApproveBelow`: off (0) until an admin sets it, and it applies to every version including revisions. **Every revision is approved again.** |
| **D3** | What happens when the customer accepts | Always, in one transaction: lead → WON with a timeline entry, and an unscheduled DRAFT job with its checklist. Notify once each: the customer (SMS + email), the salesperson and the quotation creator, every dispatcher, and the approving manager. |
| **D4** | How the customer responds | **Keep it simple:** no OTP, no login, no typed name. The link page offers **Accept · Ask for changes · Decline**. Ask for changes loops into a revision. An optional **customer account** comes after launch (D8). |
| **D5** | Controllers layer | The inline route handler is the controller; raw Prisma moves out of routes into services; CLAUDE.md is amended (Phase A). |
| **D6** | Lead visibility for SALES | All leads are visible, and "My leads" is the default view. |
| **D7** | Nepali UI (chrome, not just content) | The field app, the public website + booking, and the customer quotation / invoice / warranty pages. **The admin panel stays English.** Customer SMS and email use the customer's preferred language, captured at booking (Phase E). |
| **D8** | Customer accounts | **Never required.** Customers book a consultation, accept quotations and get the work done with contact details only. **After launch** (Phase K) a customer may **sign up with their email**; once verified, they see all earlier history recorded under that email. Phase E starts capturing an optional, normalised email. A matching phone number never attaches an email to someone else's record: staff confirm it, and accounts link by email only, never by phone. |

---

## 5. Build phases

Each phase ends with acceptance criteria. Estimates assume one developer working with Claude Code.

C, D, F and H each run as two prompts (C1/C2, D1/D2, F1/F2, H1/H2) so every session stays focused. Sessions work on a local branch, ask the owner before every commit, and stop; the owner reviews the work and handles branches, pull requests and merges between phases.

### Phase A — Safety fixes · ~2 days

Backend
- #1 Route lead-convert's quotation through `createQuotation`, so `documentTotals` is the only VAT maths. Wrap convert in one transaction (#7).
- #2 Check `validUntil` at decide time. Add a `quotation:expire` cron.
- #3 Only `DRAFT` is editable. Editing anything else means `revise`.
- #5 Payments: `voidedAt` / `voidReason` / `voidedById` replace delete, and the invoice's paid total ignores voided rows. This needs a migration and updates to `DATA-MODEL.prisma` and `API.md`.
- #6 Add one `transitionLead()` helper that every writer uses, with no swallowed errors.
- #8 Hard delete needs a new `cms:purge` capability (ADMIN only).

Frontend
- #10 Replace the CSV `window.open` with fetch → blob download.
- #11 Measure `elapsedMs` for real.
- #12 Add `eslint.config.js`.
- Docs housekeeping (§8).

CI
- GitHub Actions on pushes and pull requests to `DEVELOPMENT`: lint, unit tests, API tests against a Postgres service, frontend build. C1 adds frontend tests; F2 adds the end-to-end test.

**Acceptance:** each fix has an API test that fails on the old code. `npm test`, `npm run test:api` and `npm run lint` are green, locally and in CI.

### Phase B — Logging & audit backbone (backend) · ~3 days

This is the "proper logging" requirement. It comes early because every later screen writes audit
rows and Phase F needs domain events.

**Application logs (pino)**
- Add `redact` for `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]` and `*.password`, `*.token`, `*.refreshToken`, `*.otp`. Mask phone numbers in logs to the last 4 digits.
- `LOG_LEVEL` defaults to `info` in production and `debug` in development (`src/config/env.js:82`).
- Add an **AsyncLocalStorage request context** `{ requestId, userId, role, ip, userAgent }`. It is set in one middleware and read by the logger mixin, the audit extension and `notify()`.
- Echo `X-Request-Id` on every response. `errorHandler` uses `req.log`, so every error line carries the request id. 4xx responses log at `info` with their error code. A CORS rejection becomes a 403, not a 500.
- Optional file sink behind `LOG_FILE` (pino-roll, daily rotation, 14-day keep). The production default stays stdout for docker/systemd.
- Wire `SENTRY_DSN`, which is read today and never used, for 5xx errors and unhandled rejections.
- Crons and queue jobs log `start / finish / count / durationMs` and failures with the job id.

**Audit log (database)**
- Migration: `AuditLog` gains `requestId`, `userAgent`, `actorType (user|public|system)`, `event` (nullable domain event) and `before` / `after` JSON.
- Prisma extension:
  - cover `upsert` and `createMany`
  - capture the before-state for updates and deletes
  - write through the transaction client
  - write one row per id for `{ in: [...] }`
  - redact `passwordHash`, `tokenHash`, `publicToken`
- Named **domain events** recorded with `recordAudit`:
  - leads: `lead.created | status_changed | assigned | merged | converted`
  - quotations: `quotation.created | sent | customer_approved | customer_rejected | expired | revised`
    (Phase F adds `submitted | auto_approved | office_approved | sent_back | pulled_back | customer_changes_requested | superseded`)
  - jobs and money: `job.status_changed`, `invoice.sent | voided`, `payment.recorded | voided`
  - accounts: `auth.login | login_failed | locked | password_changed`
  - platform: `settings.changed`, `export.csv`, `cms.deleted | restored | purged`

**Acceptance:**
- Grepping a day of logs for `Bearer` finds nothing.
- A request log line and its audit rows share one `requestId`.
- A settings change shows before and after.
- A public quotation approval is audited with IP, user agent and `actorType=public`.
- Audit contents are asserted in API tests.

### Phase C — Admin UI kit · ~4 days

Every later screen is built from this, so it is the highest-leverage phase.

- `npx shadcn@latest add sheet alert-dialog textarea popover calendar command breadcrumb scroll-area radio-group accordion collapsible progress`. Replace the hand-added `Textarea` in `input.jsx`.
- **DataTable v2** (extend the existing one, don't fork it):
  - row-actions column, bulk select with bulk actions, page-size choice
  - declarative filter bar (enum, relation, date range)
  - trash view (`?deleted=true` with restore)
  - reorder mode (dnd-kit → `PATCH /reorder`)
  - fix the `q` re-sync and the JSDoc
- **`<ResourceForm>`**: a declarative field spec → `useZodForm`. Field types:
  - text, textarea, markdown, number
  - money (rupees in, paisa out, through `helpers/format.js`)
  - switch, enum, async relation combobox, date/datetime (Asia/Kathmandu)
  - slug (auto from title), string list (bullets JSON), key/value JSON
  - media and media gallery (via `<MediaPicker>`)
  - SEO group and `<LocaleTabs>` (EN | NE through `/admin/translations`)

  It maps server `error.details` onto fields and guards against leaving with unsaved changes.
- `<ConfirmDialog>` / `useConfirm`, `<MediaPicker>` with upload, admin breadcrumb, notification panel (the hooks already exist), brand from `useSiteSettings`.
- **Resource registry**: one config file per resource under `src/config/admin/resources/` (path, capability, columns, filters, fields, schema, sortable). A generic `ResourceListPage` and `ResourceEditPage` render it. `src/api/cmsApi.js` holds parameterised endpoints tagged `{ type: 'Cms', id: resource }`. zod schemas go in `src/form/schemas/cms.schema.js`, mirroring `src/shared/schemas/cms.js`.
- Regroup the admin nav: Overview · Sales · Operations · Finance · Aftercare · Content · Platform, capability-filtered so an EDITOR lands on Content.

**Acceptance:** FAQs are fully managed (list, filter, create, edit, NE translation, reorder, toggle, trash, restore) from a registry entry alone, with no bespoke page. Adding a second resource takes under an hour.

### Phase D — Service listing & CMS · ~6 days

This is v1 Phase 2's missing admin half. In order of business value:

1. **Service categories and services**: category filter, featured, price range (rupees), unit, warranty days, image, markdown body, SEO, NE translations, reorder, toggle, trash, and a "view on site" link. Enforce the non-boilerplate `excerpt` rule from the site study.
2. **Rate card**: the single source of price for the estimator, the pricing page and quotations.
3. **Media library**: grid, folders, drag-drop upload, required alt text, WebP variants shown.
4. **Home composer**: drag sections, show or hide them, per-section settings. Hero slides.
5. **Projects / case studies**: image gallery (add, reorder, remove), link to the job.
6. Offers (date window), pricing plans, features and list items (by group), content blocks, process steps, FAQs, gallery, **testimonials with a moderation queue**.
7. Pages, posts and post categories. The public `/blog`, `/blog/:slug` and `/:slug` routes are not wired yet, so add them here.
8. **Site settings** editor, grouped and typed from the `Setting` rows (ADMIN).
9. Optionally move the hardcoded storefront copy (`HomePage/sections/FeatureRow.jsx` `COPY`, `StorefrontHero` popular searches) into content blocks.

**Acceptance (v1 Phase 2):** an EDITOR reorders the home page, adds a hero slide, a service, a project with a gallery and an offer in Nepali, with zero code changes, sees it live on the next request, and every step appears in the audit log.

### Phase E — Lead management & CRM · ~5 days

- **Leads list:**
  - "New lead" dialog (call, walk-in, WhatsApp, referral)
  - bulk assign
  - URL-saved filter presets
  - "My leads" default for SALES
  - working export
- **Pipeline board (kanban):** drag between columns runs the state-machine transition. LOST prompts for a reason.
- **Lead detail:**
  - edit, status, assign, delete
  - typed activity logging (call, SMS, WhatsApp, visit)
  - a duplicates panel with **merge**
  - the full convert flow (customer + site → inspection with surveyor, or a direct quotation)
  - a "History" tab reading the audit log
- **Customers:**
  - list, create and edit
  - detail with sites CRUD, a unified timeline, quotations, jobs, invoices, warranties and AMC
  - statement (finance capability)
- **Notifications:** panel, mark read, deep links. Normalise backend links: `decideByToken` emits `/quotations/:id` while the SPA route is `/admin/quotations/:id`.
- **Safe customer matching (D8):** a matching phone never silently reuses a customer. Staff choose "same person" or "different person", and an email is saved onto an existing customer only when staff tick it (audited). The booking and contact forms gain an optional email, stored trimmed and lower-cased.
- **Preferred language (D7):** leads and customers store `preferredLocale` from the site language at booking, and every customer SMS and email uses it.

**Acceptance (v1 Phase 4):** a public form or booking creates a lead that shows a 120-minute countdown and can be assigned, worked, merged and converted into customer + site + scheduled inspection entirely in the UI. Every step appears on the lead's History tab. A shared phone number never merges two people or moves an email between them.

### Phase F — Quotation approval, customer response & job hand-off · ~5 days

Two prompts: `PHASE-F1-quotation-backend.md`, then `PHASE-F2-quotation-screens.md` (screens and the first Playwright end-to-end test).

**Transitions** (`APPROVED` keeps meaning *customer approved*):

| From | To | Trigger |
|---|---|---|
| DRAFT | PENDING_APPROVAL | submit — or straight to OFFICE_APPROVED when the total is below `quotation.autoApproveBelow` (any version) |
| PENDING_APPROVAL | OFFICE_APPROVED · DRAFT | manager/admin approves (not their own) · sends back with a note |
| OFFICE_APPROVED | SENT · DRAFT | send · pull back with a note |
| SENT | APPROVED · CHANGES_REQUESTED · REJECTED · EXPIRED | customer taps Accept / Ask for changes / Decline on the link · expiry |
| SENT · CHANGES_REQUESTED · REJECTED · EXPIRED | SUPERSEDED | staff revise → new DRAFT v+1, which must be approved again |
| APPROVED | CONVERTED | the job is created in the same transaction |

**Backend**
- New MANAGER role and `quotations:approve` capability; settings `quotation.makerChecker` (on) and `quotation.autoApproveBelow` (0 = off).
- Endpoints `submit · approve · send-back · pull-back · send · revise`, a `stage` list filter, approval notifications.
- Public decide gains `request_changes` (message required). The customer gets an acknowledgement SMS; the salesperson and creator are notified. No OTP, no login.
- **On Accept, one transaction:**
  - lead → WON, with a timeline entry
  - an unscheduled DRAFT job with the template checklist
  - quotation → CONVERTED, idempotent against double taps
- **Then notify, once each:**
  - the customer (SMS + email, in their preferred language)
  - the salesperson and the quotation creator
  - every dispatcher
  - the approving manager
- Response logic lives in `quotation.service.js` so Phase K's customer account reuses it.

**Frontend**
- Stage tabs: Needs approval · Customer asked for changes · …
- The builder is read-only unless DRAFT, with a state-driven action bar, the customer's message, the approval/response timeline and a version switcher.
- The public page is simple and mobile-first: Accept · Ask for changes · Decline.
- Dashboard counts.
- The first **Playwright end-to-end test** drives this whole loop in CI.

**Acceptance:** the whole loop runs on the seeded demo:
1. booking → survey → priced draft
2. manager approval → sent
3. the customer asks for changes (in Nepali) → revision → re-approval → sent
4. the customer accepts → lead WON, stakeholders notified once each, exactly one job in the dispatch queue
5. the whole trail is in the audit log

### Phase G — Audit, logs & platform screens · ~3 days

- **Audit log viewer:** filters by event, model, record, actor, actor type, date and request id; a before/after diff view; links through to the record. A reusable `<RecordHistory model recordId>` tab on lead, customer, quotation, job, service and invoice detail pages.
- **Message log** (SMS and email delivery status, provider error) and a login activity view (success, failure, lockouts).
- **Users:** CRUD, enable/disable, role, reset password, last login, lock status.
- **Message templates** editor with placeholder preview in EN and NE.

**Acceptance (v1 Phase 1):** an ADMIN traces any quotation from creation to customer approval, and every change, by request id. A SALES user gets 403 on users and audit logs, and their navigation hides both.

### Phase H — Operations screens · ~7 days

- **Jobs:**
  - list with filters
  - detail: checklist, photos, materials issue and reverse, time logs, status events, costing, complete, verify, publish case study
  - create from an approved quotation
- **Dispatch board** by day and week (drag to assign or reschedule, conflict warnings) and the unassigned queue.
- Technicians, job templates, materials, categories and suppliers, stock with movements, low-stock alerts.
- Field app gaps: photo upload, material logging, job mutations on the offline queue, job history.

**Acceptance:** a dispatcher schedules on the board. The technician completes the whole job on a phone, partly offline, and everything syncs: photos, checklist, signature, time, materials. Stock falls by what was issued, and job costing reconciles to the paisa.

### Phase I — Finance & aftercare screens · ~6 days

- Invoices (from job, send, void, payments), payment search, expenses, and reports (aging, revenue, collections, customer statement).
- Warranties, the claims decision queue, AMC contracts and visits, renewals due, service reminders.
- A reports page for the sales and ops reports the API already serves (lead sources, funnel, SLA, job margin, technicians, warranty claims).

**Acceptance:** job → invoice from real materials and labour. A partial payment is recorded and can be voided. Aging is correct and VAT reconciles to the paisa. A warranty claim creates a free job, and an AMC contract schedules its visits.

### Phase J — Launch hardening · ~6 days (v1 Phase 10, plus the following)

Split into three prompts: `PHASE-J1-i18n.md`, `PHASE-J2-reliability-pdfs.md` and `PHASE-J3-security-deploy.md`. Production launch follows J3; optional customer accounts (Phase K) come after launch.

- An i18n message catalogue for UI chrome (D7): field app, public site + booking, customer document pages. Admin stays English.
- Quotation and invoice PDFs (Puppeteer).
- `notify()` through the queue with retry and dead-letter. A leader lock on crons.
- Raw Prisma out of routes (#15, D5). Validated `sort` / `status` enums per list.
- Security pass, backups with a restore drill, deploy, Sentry, runbook.

### Phase K — Optional customer accounts (email signup) · ~6 days · after launch

Prompt: `docs/prompts/PHASE-K-customer-account.md`. Decision D8.

- **Accounts are never required.** Booking, quotation links, acceptance, invoices and warranties keep working for guests with contact details only.
- **Signup with email.** Once the email is verified, the account links every customer record and open request under that email (trimmed, lower-cased), including history from before signup, plus anything created later. Nothing is visible before verification. Staff can link records with a missing or different email by hand. Linking is **by email only, never by phone**, because phones are shared and recycled.
- **Customer sees:**
  - requests and quotations (Accept / Ask for changes / Decline through the Phase F service, plus a message thread)
  - jobs with visit windows
  - invoices and payments
  - warranties (certificate + claim)
  - AMC visits and sites
  - Book again (a normal SLA lead)
- **Admin:** account status, link/unlink, block, "invite to create an account".
- Separate auth from staff. Every `/customer` endpoint is scoped and IDOR-tested; responses use a field allowlist. The phase carries its own security review.
- Still to ask the owner when the phase starts: sign in with a password, or with an emailed one-time code.

**Acceptance:** guests still need no account; a verified customer sees their earlier and later history under their email, and never anyone else's.

---

## 6. Timeline

| Phase | Days | Cumulative | Delivers |
|---|---|---|---|
| A Safety fixes | 2 | 2 | Correct money, locked quotations, no hard-deleted payments, honest docs |
| B Logging & audit | 3 | 5 | Redacted request-id logs, complete audit with domain events |
| C Admin UI kit (C1 + C2) | 4 | 9 | DataTable v2, ResourceForm, registry, nav |
| D Services & CMS (D1 + D2) | 6 | 15 | Editors run the whole public site |
| E Leads & CRM | 5 | 20 | Sales works entirely in the UI |
| F Quotation approval (F1 + F2) | 5 | 25 | The business flow end to end, incl. customer change requests |
| G Audit & platform UI | 3 | 28 | Traceability, users, templates |
| H Operations (H1 + H2) | 7 | 35 | Dispatch and job management |
| I Finance & aftercare | 6 | 41 | Billing and retention |
| J1 Nepali UI | 2 | 43 | Field app, site, customer pages in Nepali |
| J2 Reliability & PDFs | 2 | 45 | Queued notifications, cron locks, PDFs |
| J3 Security & deploy | 2 | **47 ≈ 9.5 weeks** | **Production launch** |
| K Customer accounts (after launch) | 6 | 53 | Optional email signup showing earlier history |

**First usable release: A–F (~25 days). Production launch after J3 (~47 days); optional customer accounts (K) follow.** Content, sales and the approval-gated quotation flow are
all operable from the UI. The phase order stays as listed (decided 2026-09-14).

---

## 7. Definition of done (every phase)

v1 `PLAN.md` §7 still applies. In addition:
- Every mutation lands in the audit log with its `requestId`, and the relevant domain event is asserted in an API test.
- Every admin screen is built from DataTable v2 / `<ResourceForm>` / the resource registry, never a new variant.
- Detail pages carry a `<RecordHistory>` tab.
- Money, Nepali phone numbers and Devanagari text are tested on every new form.
- Docs updated in the same commits: this plan (phase ✅, defects ticked, deviations), STATUS.md, docs/API.md, docs/DATA-MODEL.prisma, READMEs + .env.example, src/STRUCTURE.md, and CLAUDE.md when a convention changes.

## 8. Documentation housekeeping

_Moved into Phase A (task A11), because every later session reads CLAUDE.md and would be misled by the stale paths._

- `docs/PLAN.md` still says MUI, an npm-workspace monorepo, `apps/*` and `packages/shared`. The real layout is `MaintainanceBackend` / `MaintainanceFrontend` with shadcn, and schemas mirrored in `src/shared/schemas` and `src/form/schemas`. Mark it historical.
- `docs/DATA-MODEL.prisma` (992 lines) is an older draft of `prisma/schema.prisma` (1,390 lines). Regenerate it from the schema, or make the schema the source and replace the file with a pointer. CLAUDE.md rule 2 depends on this.
- `docs/ARCHITECTURE.md` lists `apps/admin` on :5174. It is one Vite app on :5400.
- CLAUDE.md: amend the controllers rule per D5, and replace `packages/shared` with the real paths.
- `STATUS.md`: replace "Next" with a pointer to this document.
