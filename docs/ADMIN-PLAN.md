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

✅ = closed, with the phase and date. Open rows are picked up by the phase named in §5.

| # | Severity | Defect | Where |
|---|---|---|---|
| ✅ 1 · A 2026-09-14 | **High · money** | Lead-convert builds a quotation by hand with `vatApplied: true`, `vatRate: 13` but `vatAmount: 0` and `total = subtotal`, bypassing `documentTotals`. The customer can be sent a quote missing its VAT. | `src/services/convert.service.js:44-67` |
| ✅ 2 · A 2026-09-14 | **High** | Expired quotations can still be approved. Expiry is only applied when someone GETs the quotation, and `decideByToken` checks `status === 'SENT'` only. There is no expiry cron. | `quotation.service.js:188,198` |
| ✅ 3 · A 2026-09-14 | **High** | A `SENT` quotation can be edited in place. `updateQuotation` blocks only APPROVED/CONVERTED, so a customer can approve numbers different from the ones they were sent. `reviseQuotation` never supersedes the parent. | `quotation.service.js:85` |
| ✅ 4 · B 2026-09-14 | **High · security** | Access tokens and refresh cookies are almost certainly in the logs. The pino logger has no `redact`, and pino-http's default serializer logs request headers. | `src/lib/logger.js`, `src/app.js:22` |
| ✅ 5 · A 2026-09-14 | **High · finance** | Payments are hard-deleted, although CLAUDE.md requires soft delete and money records must never vanish. | `invoice.service.js:243` |
| ✅ 6 · A 2026-09-14 | Medium | Lead status is written past the state machine (`→ WON` with `.catch(() => {})`; `→ CONTACTED / QUOTED / INSPECTION_SCHEDULED` directly). | `quotation.service.js:218`, `convert.service.js:37,70,103` |
| ✅ 7 · A 2026-09-14 | Medium | Lead-convert writes customer, lead, job and survey in separate statements, so a failure midway leaves orphans. | `convert.service.js` |
| ✅ 8 · A 2026-09-14 | Medium | EDITOR can `?hard=true` permanently delete any CMS row or media file. | `crud.service.js` via `cms.routes.js` |
| ✅ 9 · B 2026-09-14 | Medium | Audit gaps: `upsert` and `createMany` are not audited (so **settings changes are unaudited**, which fails the v1 Phase 1 acceptance). There is no before-state. Rows are written outside the transaction. Public and cron writes have no actor or IP. The lead-merge audit write fails silently. | `src/lib/prisma.js:38-64` |
| ✅ 10 · A 2026-09-14 | Medium | Leads CSV export always 401s. It uses `window.open`, but the API accepts only a Bearer header. | `MaintainanceFrontend/src/pages/admin/LeadsPage.jsx` |
| ✅ 11 · A 2026-09-14 | Medium | The booking wizard hardcodes `elapsedMs: 60_000`, which defeats the anti-spam timing check. | `components/booking/BookingWizard/BookingWizard.jsx` |
| ✅ 12 · A 2026-09-14 | Low | `npm run lint` fails: eslint 9 with no `eslint.config.js` in the frontend. | `MaintainanceFrontend/` |
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
| **D6** | Lead visibility for SALES | All leads are visible, and "My leads" is the default view. *As built (Phase E, 2026-09-16):* the leads table and the pipeline open on My leads (`view=mine` → `GET /admin/leads?assignedToId=me`), one click shows All leads, and no record-level restriction exists. |
| **D7** | Nepali UI (chrome, not just content) | The field app, the public website + booking, and the customer quotation / invoice / warranty pages. **The admin panel stays English.** Customer SMS and email use the customer's preferred language, captured at booking (Phase E). *As built (Phase E):* `Lead.preferredLocale` / `Customer.preferredLocale` (`en` \| `ne`, default `en`); the contact form and booking wizard send the site's language; convert copies it to a new customer and changes an existing customer's only when staff tick "Write to them in …"; every customer-facing `notify()` passes it, and a missing Nepali template falls back to the English one. Staff messages stay English. |
| **D8** | Customer accounts | **Never required.** Customers book a consultation, accept quotations and get the work done with contact details only. **After launch** (Phase K) a customer may **sign up with their email**; once verified, they see all earlier history recorded under that email. Phase E starts capturing an optional, normalised email. A matching phone number never attaches an email to someone else's record: staff confirm it, and accounts link by email only, never by phone. *As built (Phase E):* email is stored trimmed and lower-case; when a customer has the lead's phone, convert answers 409 `CUSTOMER_MATCH` unless staff chose `customerId` ("same person") or `createNewCustomer` ("different person"); the lead's email reaches an existing customer only with `confirmEmail` (event `customer.email_confirmed`, actor = the staff member). The only other writer of a customer's email is a staff edit (`PUT /admin/customers/:id`, an audited model change). |

---

## 5. Build phases

Each phase ends with acceptance criteria. Estimates assume one developer working with Claude Code.

C, D, F and H each run as two prompts (C1/C2, D1/D2, F1/F2, H1/H2) so every session stays focused. Sessions branch from `prabesh`, ask the owner before every commit, and stop; the owner reviews the work, merges each phase branch into `prabesh`, and later merges `prabesh` into `DEVELOPMENT`.

### Phase A — Safety fixes · ~2 days · ✅ done 2026-09-14

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
- GitHub Actions on pushes to `prabesh`, phase branches and `DEVELOPMENT`, and on pull requests into `prabesh` or `DEVELOPMENT`: lint, unit tests, API tests against a Postgres service, frontend build. C1 adds frontend tests; F2 adds the end-to-end test.

**Acceptance:** each fix has an API test that fails on the old code. `npm test`, `npm run test:api` and `npm run lint` are green, locally and in CI.

**Deviations (Phase A, 2026-09-14)** — built differently from the plan, or beyond it:
- **Convert atomicity (#7):** `createQuotation`, `createJob` and `findOrCreateByPhone` take an optional transaction
  client (`createFromJob` already did). Inside a caller's transaction `createJob` does not notify; convert calls the
  now-exported `announceAssignment` after commit. The convert transaction has a 15 s timeout (Prisma's 5 s default is
  tight for several numbered documents plus audit writes on a CI runner).
- **Lead funnel on convert (#6):** the lead only moves forward — NEW|LOST → CONTACTED → INSPECTION_SCHEDULED (job) →
  QUOTED (quotation). With both a job and a quotation it now ends **QUOTED** (it used to end INSPECTION_SCHEDULED);
  a lead already further along, or WON, is not moved back.
- **Customer approval (#6):** NEW passes through CONTACTED to WON; WON is left alone; a LOST lead keeps its status and
  gets a timeline note. The approval itself never fails because of the lead.
- **Beyond the plan (#6):** `mergeLeads` closes duplicates through `transitionLead` and refuses (422) to merge away a
  WON duplicate. `transitionLead` also takes `data` (columns written with the move, e.g. `lostReason`), and moving a
  lead to the status it already has is a no-op. `survey.service` quoting goes through it as well.
- **Invoice transitions (#5):** besides PAID → PARTIAL and PARTIAL → SENT, voiding the only payment needs PAID → SENT
  and PAID → OVERDUE, so those were added too. Voided payments are also left out of the collections report and the
  customer statement. Payment `voidedById` is a plain string like `receivedBy`, not a relation.
- **cms:purge (#8)** guards media hard delete as well as the CRUD factory.
- **Expiry (#2):** one `isExpired` rule shared by GET, decide and the sweep; `quotation:expire` runs hourly and once at start.
- **Lint (#12):** it was broken in *both* apps, not only the frontend. `eslint-plugin-react-hooks` is pinned to v5
  (v6+ brings React Compiler rules), `react/prop-types` is off (project uses JSDoc), and 25
  `react-refresh/only-export-components` warnings are left as warnings. Real findings were fixed in files Phase A did
  not otherwise touch: unused imports, a dead constant in `BlueprintScene`, stale disable comments, a literal BOM in
  `crm.routes.js`, `BookingWizard`'s un-memoised `services`, and `useOfflineQueue`'s run-once effect (now a ref).
- **CSV export (#10)** has no automated frontend test — there is no frontend test runner until C1. It was verified in
  a headless-browser walk-through instead, including a forced 401 → refresh → retry.

### Phase B — Logging & audit backbone (backend) · ~3 days · ✅ done 2026-09-14

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

**Deviations (Phase B, 2026-09-14)** — built differently from the plan, or beyond it:
- **Transaction strategy:** the exported `prisma` is a Proxy whose `$transaction(fn)` runs `fn` with its
  transaction client in an AsyncLocalStorage; the extension uses that client only when Prisma's
  `__internalParams.transaction.kind` says the operation is in an interactive transaction. That is a Prisma
  internal, so the rollback test is the tripwire on upgrades. Inside a transaction a failed audit insert
  now fails the transaction (it used to be swallowed); outside one it is still logged at warn.
- **`changes` column:** model-change rows leave it null (the diff is `before`/`after`); domain-event rows put
  their `meta` there (export filters, merged ids). Pre-B rows keep their sanitized write data.
- **Actor with no context** (scripts, seed, tests calling Prisma directly) is `system`; the column default
  stays `user` so pre-B rows read as before. `recordEvent` also takes an `actorId` override, for login and
  logout, where the request is public until the user is known.
- **After-state is re-read** when the write had a `select` or `include`, because a select can hide the
  changed column (user updates never select `passwordHash`). One extra query on those writes.
- **Beyond the plan:** customer-link tokens in request URLs are redacted in logs; a 4xx request line now
  logs at `info` (it was `warn`) to match the error handler; a 5xx message is hidden everywhere except
  `NODE_ENV=development` (it was production only); `auth.login_failed` also fires for an unknown email
  (`meta.email`), a locked and a disabled account; completing a reset link emits `auth.password_changed`.
- **`cms.*` events** fire for every resource the CRUD factory mounts (rate card, materials, message
  templates too) and for media; a delete on a model without soft delete is `cms.purged`.
- **`expireQuotations`** now expires quotation by quotation through the guarded `markExpired`, so each
  gets its own `quotation.expired` event (it was one `updateMany`).
- **#15, partly:** user create/update/toggle/delete moved from `platform.routes.js` into
  `services/user.service.js`, which is where the `user.*` events live. Technicians, notifications,
  message logs and tech sync still call Prisma from routes.
- **Not done here:** `AUDIT_EVENTS` is not yet mirrored in the frontend (Phase G builds the screen that needs
  it). The `TechSync` idempotency rows are unchanged and carry no `requestId`; the mutations they replay are
  audited normally. #14 stays open — Phase B added task logging, not retries or a cron leader lock (J2).

### Phase C — Admin UI kit · ~4 days · ✅ done 2026-09-14 (C1 + C2)

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

**Deviations (Phase C1, 2026-09-14)** — built differently from the plan, or beyond it. C1 closed none of the §3 defects
(none were assigned to it); #13 stays with the phases that touch those routes.
- **Router:** `AppProviders` now uses a data router (`createBrowserRouter`, one splat route around the unchanged
  `<AppRoutes>`). `useBlocker`, which the unsaved-changes guard needs for links and the back button, does not work
  under `<BrowserRouter>`. Only one guard can be active per page, so a second form on a page passes `guard={false}`.
- **Markdown field:** the public site does not render markdown — `ServiceBody` split plain text on blank lines. The
  field type is `prose` (`markdown` is accepted as an alias) and its preview uses the same `components/site/ProseBody`
  the service page now renders with. `splitParagraphs` also treats a whitespace-only line as a paragraph break and
  drops empty paragraphs, a small change on the public page too.
- **Beyond the plan (backend):** `slugify` split Devanagari words at every vowel sign and virama (`नेपाली` →
  `न-प-ल`), because marks (`\p{M}`) counted as separators. Fixed in `src/utils/slug.js`, mirrored in the SPA's
  `helpers/slug.js`, with a unit test and an API test. `?deleted` is parsed strictly (`true`/`false`, else 400), unlike
  `includeInactive`/`includeDeleted`, whose `z.coerce.boolean()` reads `'false'` as true — left as it was.
- **shadcn on Tailwind 3:** `shadcn@latest add` rewrote `tailwind.config.js` (comments stripped, the Devanagari font
  entry broken as `'Noto Sans Devanagari"'`), so the file was restored; `calendar.jsx` arrived with Tailwind 4-only
  classes, fixed by hand; `button` and `dialog` were not overwritten; the new overlays match `dialog`; the generated
  `textarea` got `Input`'s focus and invalid styling; `command.jsx` spreads its `cmdk-input-wrapper` attribute so lint
  passes. The Radix, `cmdk`, `react-day-picker` and `date-fns` dependencies came with the CLI.
- **Structure:** `DataTable` became the folder `components/common/DataTable/` (entry `DataTable.jsx`) by the folder
  rule, and the callers' imports changed. New shared pieces not named in the prompt: `RecordCombobox` with
  `api/lookupApi.js` (the relation filter and the relation field are the same component), `hooks/useDebouncedValue`,
  `hooks/useUnsavedChangesGuard`, `api/mediaApi.js`, `api/translationsApi.js`, `src/test/renderWithProviders.jsx`.
- **List pages:** Quotations and Surveys moved their status selects onto `filters` as well, and Leads gained a
  "Received" date-range filter (`from`/`to`, which the API already accepted).
- **Dependencies beyond the expected list:** `@dnd-kit/utilities` (sortable transforms), `blurhash` (thumbnail
  placeholders), `@testing-library/user-event` and `@testing-library/jest-dom` (interaction tests, DOM matchers).
- **useConfirm** returns `[confirm, dialogElement]` for the caller to render, rather than an app-wide provider, so
  alert-dialog stays out of the marketing bundle.
- **MediaPicker** uploads one file per request, because `POST /admin/media` takes a single `alt` for the batch.
- **Form values:** money is held in rupees; an empty number, money, date or media field is `undefined` (a mirrored
  `z.coerce.number()` turns null into 0), an empty relation is `null` (how the API unlinks). A failed save focuses the
  first failing field once the form is enabled again.
- **Not browser-tested yet:** ResourceForm, LocaleTabs and MediaPicker have no screen until C2; they are covered by
  component tests. Lint warnings went 25 → 26 (the generated `toggle.jsx` exports its variants).

**Deviations (Phase C2, 2026-09-14)** — built differently from the plan, or beyond it. C2 closed none of the §3 defects
(none were assigned to it).
- **Beyond the plan (backend):** the public site never showed a Nepali FAQ — `getService` and `GET /public/faqs`
  returned FAQs without `withLocale`, so the NE translation the acceptance asks for could be saved but not seen.
  Both now overlay `faq` translations (`/public/faqs` takes `?locale`), with an API test. Translations must be saved
  under the Prisma client model name (`faq`, `processStep`), which is what `withLocale` reads; the older API test
  saves `Faq`, which stores fine but never reaches the site.
- **Registry layer:** kept in `config/admin/resources/*.jsx`. `resourceRegistry.js` is imported only by the two lazy
  generic pages, so the entries stay out of the main bundle (checked in the build output). Because the route table
  cannot import the registry, the routes are guarded by `cms:read` and each page checks its entry's own capability
  through `hooks/useResourceEntry`. The entry shape adds `model` (translations), `labelPlural`, `description`,
  `writeCapability`, `titleOf` and list copy to the planned keys.
- **Nav as data:** `config/admin/adminNav.js` holds the groups plus `navForRole`, `landingPathFor`, `contentHomeFor` and
  `breadcrumbsFor`, so all of it is unit-tested. `AdminLayout` became the folder `components/layout/AdminLayout/`
  (breadcrumb, notification panel, `notificationLinks.js`). Items added as `soon`: Dispatch board, Expenses,
  Services, Projects, Media library, Users, Audit log. The Media library item needs `cms:read`, not `media:read`,
  which SALES and DISPATCHER hold for job photos. Users and Audit log use `users:read` / `audit:read`, which only
  ADMIN's `*` satisfies (both API routes are ADMIN-only). The EDITOR's Dashboard item is hidden, since `/admin`
  redirects it to Content.
- **List page behaviour every entry gets:** an On site switch column, row actions (Edit, View on site, Hide/Show,
  Delete with confirm), bulk Delete, Trash with Restore, and Delete forever for `cms:purge` (ADMIN).
- **FAQ group:** a free-text field (default `general`) and an enum filter over the three seeded groups. The public
  service page lists group = its slug or `general`; `pricing` and `warranty` show on no page, so their "View on site"
  is hidden. A picker offering "general + each service" needs a relation with a static option — D2.
- **FAQ answer** is a `textarea`, not `prose`: `FaqList` renders the answer as one `<dd>` paragraph.
- **Process steps:** `sortable: false`, because the site orders them by `stepNo` and Reorder would change nothing a
  visitor sees; the step number is a field instead. `icon` is free text (a `DataIcon` name).
- **Notifications:** links are normalised in the SPA (`/leads/:id` → `/admin/leads/:id`, absolute app URLs → paths,
  `/tech/…` and token pages kept). Phase E still normalises them in the API.
- **cmsApi** writes also invalidate the `Public` tag, so the SPA's cached copy of the site follows an edit.
- **cms.schema.js** mirrors all 16 CMS schemas (and `FEATURE_GROUPS`/`LIST_GROUPS`), not only FAQ's.
- **Cleanup:** `config/config.js`, `helpers/helpers.js` and `hooks/hooks.js` had zero importers and were removed.
- **Second resource timing:** `process-steps` (entry, registry line, nav item) took under 1 minute to write, with the
  registry test green 40 s after starting; the browser walk-through of its screens is recorded in `STATUS.md`.
- **Found by the browser walk-through, fixed:**
  - *Backend:* "Delete forever" in Trash could never work. The CRUD factory's `remove` looked the row up with
    `get()`, which excludes soft-deleted rows, so `DELETE ?hard=true` on a trashed row answered 404 for all 16 CMS
    resources. The existing test only purged a live row. A purge now finds the row including Trash; a new
    per-resource API test failed on the old code (404 for every resource) and passes now.
  - *C1 kit:* in reorder mode dnd-kit's screen-reader announcer (a `<div>`) rendered inside `<table>`
    (`validateDOMNesting`); it is portalled to `<body>` now.
  - *C2:* deleting from an edit page refetched the just-deleted record (one 404); the page stops that query and shows
    a snapshot until it navigates.
- **Known, not changed:** a mirrored `optionalText` turns an emptied optional text into `undefined`, so a PUT cannot
  clear it (e.g. a process step's description) — the API schema's behaviour, left for D1.

### Phase D — Service listing & CMS · ~6 days · ✅ done 2026-09-16 (D1 + D2)

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

**Deviations (Phase D1, 2026-09-16)** — built differently from the plan, or beyond it. D1 closed none of the §3
defects (none were assigned to it); the media folder body is now validated, a small part of #13's "unvalidated
input", which otherwise stays open.
- **The rate card does not feed the estimator.** Items 2 above and the D1 prompt say it does; `estimate.service.js`
  prices from the service's (or pricing plan's) own `priceFrom`/`priceTo`. The rate card feeds quotation lines,
  survey pricing and the rate table on `/pricing`. The screen's banner says so, and the prompt's manual check 4 was
  run against `/pricing` only. Making the estimator read the rate card is a pricing decision, left open.
- **The hero shows words only.** `StorefrontHero` renders the first active slide's title, subtitle and button, never
  its image (the WebGL scene is the picture). The slide keeps an image field, labelled as such, and the list says
  that the first switched-on slide is the one shown. The seeded third slide links to `/about`, which the site does
  not serve (it falls back to `/book`); the form now flags that link when the slide is saved.
- **Rate card as a registry entry with its own address.** SALES has no `cms:read`, so the rate card cannot live under
  `/admin/content`. Entries gained `basePath` (fixed routes under `quotations:read` pass `resource` to the generic
  pages), `notice` (a standing banner) and `activeCopy` ("In use" / Retire instead of "On site"). The four endpoints
  the generic screens need and the API lacked were added to `crm.routes.js` (`GET /:id`, `/toggle`, `/restore`,
  `/reorder`), and `DELETE ?hard=true` now reaches the factory (cms:purge). Codes are stored upper-case. A retired
  rate is not offered for a new quotation line, but a line already using it still shows it.
- **Read-only generic screens.** ACCOUNTANT reads the rate card: the list has no New and disabled switches, the edit
  page is `ResourceForm readOnly`, `…/new` returns to the list. Before D1 every registry reader was also a writer.
- **Service rules.** The excerpt limit was 20–400 in both schemas; it is now 40–200 (every seeded excerpt is
  112–136). Both schemas already had the boilerplate and price-range refinements, but `PUT` used the unrefined
  partial schema, so `priceTo < priceFrom` passed on an update — the service's `update` now checks the range against
  the stored price the body leaves out. The service and SPA schemas run the same fixture file
  (`MaintainanceBackend/tests/fixtures/serviceSchemaCases.js`, 20 cases).
- **Featured.** `isFeatured` is edited and filterable, but no public page treats featured services differently; the
  field says so. The API reads any `?featured` value as "featured only", so the filter offers only that choice.
- **Home composer.** Per-section settings are the one key the site reads, `limit` (services, projects, gallery,
  testimonials), not a free key/value editor — other keys would do nothing. The API now validates `limit` (1–50).
  Each row says what the section shows and links to where its content is edited; a visible section the site skips
  for having no content is flagged. Save / Discard with a leave guard, rather than saving on every drag.
- **Media library backend.** `PUT /admin/media/:id` refuses an empty alt; `POST /admin/media/folders` is
  zod-validated and checks the parent exists; a folder with subfolders is not deleted (they used to jump to the top
  level). Media has no Trash view — a soft-deleted file leaves the library, and ADMIN's "Delete forever" is offered
  on a live file. Drag-and-drop works anywhere on the page and opens the upload panel; each file still needs alt text.
- **Icon picker.** Icons are a select over `DataIcon`'s names (exported as `ICON_NAMES`), drawn in the options; the
  process-steps entry switched from free text to it.
- **Found by the browser walk-through, fixed (kit-wide):**
  - `ResourceForm` was dirty right after a save whenever the schema transformed a value (an empty optional text
    becomes `undefined`), so leaving the page after saving raised the unsaved-changes prompt. It now resets to the
    inputs' own values. Covered by a test that failed before.
  - Pressing a toast closed an open sheet or dialog (Radix treats it as outside). Toasts sit bottom-right, over a
    sheet's Save button. `ui/sheet.jsx` and `ui/dialog.jsx` now ignore presses on `[data-toaster]`. Covered by a test
    that failed before.
  - The select field title-cased plain options, so units read "Sq.Ft", "Rft"; units are passed as `{ value, label }`.
  - A badge (a `<div>`) inside a `<p>` in the composer and the services list (React DOM-nesting warning).
  - The first media details sheet wrapped a page-mode form in its own sheet, so closing it dropped unsaved alt text
    without asking. It is now a `ResourceForm` sheet (with the new `intro` slot), which asks first.
- **Beyond the plan:** `ResourceForm` gained `intro` (content above the fields) and `readOnly`; `MediaGrid`/`MediaPager` were split out of `MediaPicker` and are shared with
  the library; `cmsApi` writes to the rate card also refetch the quotation builder's rate list (`ALSO_READ_AS`).

**Deviations (Phase D2, 2026-09-16)** — built differently from the plan, or beyond it. D2 closed none of the §3 defects
(none were assigned to it).
- **Nav.** Content would have held 18 items, so it is three groups under `/admin/content/…`: **Content** (home page, hero
  slides, services, categories, projects, offers, pricing plans, testimonials, FAQs, gallery, media library), **Page
  blocks** (features, list items, content blocks, process steps) and **Blog & pages** (posts, post categories, pages).
  The admin nav has nine groups, not seven. Settings moved from the `soon` item at `/admin/settings` to
  `/admin/platform/settings`, as the D2 prompt asks.
- **Site settings are the one bespoke D2 screen**, and still built from the kit: `config/admin/settingsForm.js` turns
  the `Setting` rows into card groups of `ResourceForm` fields by `type` (`string`, `number`, `boolean`, `richtext`,
  `media`, `json`), with key rules on top — the Nepali phone rule on the five phone keys, email and `https://` checks,
  weekday checkboxes for `booking.closedWeekdays`, editable rows for `badges.items` and `stats.items`, a JSON textarea
  for any other JSON setting, and ranges on the numbers. Save sends only the keys whose stored value changes, compared
  with sorted keys, because jsonb stores object keys in its own order. `branding.logoId` is editable but the site does
  not show a logo yet (the field says so).
- **Kit additions, all generic:** registry entries may give `schema` as a function of `{ pageSlugs }` (read through
  `schemaOf`), `tabs` (a project's Gallery), `intro(record)` (the linked job), `rowActions` (a `cmsApi` mutation, e.g.
  Approve), `reorderWithin` + `reorderHint`, and `defaultSort`; a filter may have a `defaultValue`; a field may be
  `lockedOnEdit`. New field types `weekdays` and `objectList`; `keyValue` with fixed `keys`; `group` with
  `variant: 'card'`; `ResourceForm stickyActions`; `LocaleTabs extraTabs` (and no Nepali tab when nothing is
  translatable); a null value in a column the form does not edit is dropped instead of failing the schema (a
  testimonial's `jobId`). New shared pieces: `common/StateBadge`, `media/MediaCell`, `projects/ProjectGalleryTab`,
  `projects/ProjectName`, `helpers/schedule.js` (`offerWindow`, `publishState`), `api/settingsApi.js`.
- **Backend, beyond the listed changes** (each with an API test; 7 of the 9 new tests fail on the old code):
  - *List-item reorder:* Phase A's `orderField` mapping stored the table's 0-based index in `position`, which the site
    prints — the first item read "0". The CRUD factory has `orderBase` (list items: 1). The screen offers Reorder only
    once a list is picked, because positions are per list.
  - *Projects* now carry `job: { id, number }`, which the edit page shows read-only.
  - *`ogImageId`* is no longer accepted for projects, pages and posts. None of those tables has the column, so sending
    one answered 500. Services keep it.
  - *Nepali copy the site never showed:* the home page's grouped sections (kitchen cards and steps, seepage block and
    checklist, the interior block) now overlay translations, and `/public/posts`, `/posts/:slug` and `/pages/:slug` take
    `?locale`. That is what makes the Nepali tabs on features, list items, content blocks, posts and pages honest.
  - *`/public/bootstrap`* adds `nav.blog` (a published post exists) and `nav.pages` (live pages), for the Blog link and
    for CMS links. `/public/posts` also returns the `categories` that hold a published post. The sitemap lists `/blog`,
    posts and pages.
  - *Seed:* two published posts in two categories and an About page at `/about` — the seeded third hero slide linked
    there, and the site sent it to `/book`.
- **CMS links to pages.** `siteHref` accepts `/blog`, `/blog/…` and a single-segment address that is a live page; the hero
  slide, offer and content-block forms check links against the live pages (a link to `/about` is refused until the page
  exists). Page addresses the app already routes (`/contact`, `/admin`, …) are refused in the page form.
- **Testimonials** have no Nepali tab (they are published as written, with a language field that sets the typeface).
  Approve / Withdraw approval is a row action for `testimonials:moderate`, not a form field, and the list opens on
  "Waiting for approval".
- **Content blocks.** The key is a select over the four `CONTENT_BLOCK_KEYS` (only `seepage_explainer` and
  `interior_design` show on the site; the other two are labelled "not shown yet"), locked once saved — in the screen
  only; the API still accepts a key change. The button is `{ label, url }`; both empty means no button, and the site
  now draws a block's button only when both are set. Bullets are English only (a JSON list has no translation).
- **Form-only rules** (stricter than the API): an offer's and a plan's "to" price and a project's cost band top must be
  at least the lower figure. An offer's picked end day ends at 23:59 and its start day begins at 00:00, Kathmandu time.
- **Posts** have no manual order (the blog is newest first); the list sorts by publish time and shows Draft / Scheduled /
  Published. "View on site" appears only for a published post.
- **Public site, small fixes:** an offer or a package with only a "from" price no longer prints "– 0", and a package with
  no price reads "On inspection". `/:slug` with no page renders the not-found page inside the site's shell.
- **Found by the browser walk-through, fixed:**
  - Every public detail page fell back to its own title with `??`, but an SEO field left empty in the admin is saved as
    `''` — so a post, a page, and D1's service and project pages kept the site's default `<title>`. They use `||` now
    (a test failed before).
  - *Dev only, pre-existing:* React StrictMode ran `SessionEffect` twice, so every reload sent two refreshes with one
    rotating cookie; when the refused one answered last, the user was signed out (about one reload in eight). The page
    now shares one restore (a test failed before).
  - The settings screen reported `stats.items` as changed when nobody touched it (jsonb key order) — fixed as above.
- **Tests and harness:** `src/test/mockApi.js` is the shared fetch mock for new screen tests; `test/setup.js` stubs
  `IntersectionObserver`. The service-reminder API test now lists `?sort=-createdAt`: after repeated runs without a
  reset, the reminder it creates fell off the first page (a test-only change).
- **Not done:** D2.5 (optional) — the storefront's popular searches and the feature-row headings are still in code.
  The `about_intro` and `cta_banner` blocks are rendered nowhere. In the walk-through the new hero slide was moved
  first through the API (the Reorder screen itself was walked in D1).

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

**Deviations (Phase E, 2026-09-16)** — built differently from the plan, or beyond it. E closed none of the §3 defects
outright; it narrowed #13 (the customer-site routes now validate `:id` / `:siteId`, and the lead list's new `ids`,
`requestedVisit` and `assignedToId` values are parsed) and #15 is unchanged.
- **Endpoints the prompt left open, added:**
  - `POST /admin/leads/bulk-assign` rather than one `PATCH` per lead: one transaction (a selection is assigned whole or
    not at all), the assignee gets **one** notification instead of N, and each lead still gets its own timeline entry
    and `lead.assigned` event.
  - `GET /admin/leads/assignees` (+ `/:id`): `/admin/users` is ADMIN-only, and sales needs the list to assign. Assigning
    is now limited to active SALES and ADMIN users (it accepted any active user before).
  - `GET /admin/leads/:id/customer-matches`, so both convert dialogs show "Existing customer with this phone" before
    submitting; the 409 remains the guard.
  - `?requestedVisit=true|false` (the lead names a visit day) instead of `source=booking`: a booking folded onto an
    earlier enquiry keeps its slot but not the booking source. `?assignedToId=none` for Unassigned; `export.csv?ids=` for
    Export selected.
  - `GET /admin/services` and `/:id` also accept `services:read` (SALES held it, but nothing used it), so the lead form
    and filter can pick a service. Services writes stay `cms:write`. `requires(...)` accepts several capabilities.
- **History capabilities.** The prompt asks for "that record's own read capability" and also "DISPATCHER 403" — but
  DISPATCHER holds `leads:read`. Resolved with **`leads:history` / `customers:history`**, held by SALES (and ADMIN):
  DISPATCHER and ACCOUNTANT read the records but not their trails. Phase G can extend them per role.
- **History content.** Scopes live in `services/history.service.js` (`HISTORY_SCOPES`): a lead's rows and events plus
  its notes' rows; a customer's plus its sites'. Lead timeline entries are not audited row by row (`LeadActivity` is in
  `AUDIT_SKIP`), so staff-logged activities now write **`lead.activity_logged`**; staff may log only call, sms, whatsapp,
  email, visit and note (`status_change` / `assignment` entries are the system's — a hand-typed one is 400). The screen
  folds a request's plain row writes into its named event, so a status change reads once. `ip` and `userAgent` are not
  returned.
- **Notification links.** Office staff links are `/admin/...` everywhere (leads, SLA, quotations, jobs, materials,
  warranty claims, overdue invoices, AMC renewals). Notifications to technicians and surveyors keep `/tech/...` — their
  app. Staff **email** links used `APP_URL`, the API's own origin, so they never opened; they now use the web origin
  (`utils/links.js`). The decided-quotation notification type was `quotation_rejectd` (`${decision}d`); it is
  `quotation_approved` / `quotation_rejected`. A source-scan unit test fails on any other `link:` form.
- **Convert.** `findOrCreateByPhone` is gone. The response adds `customerCreated`. An address typed in the convert
  dialog becomes a site of an existing customer when it has none with that address (primary only if it has no sites),
  so a second property is not booked against the first one's address. `loadTemplate` now falls back to the `en`
  template explicitly (it used to take any active template, whatever its language). No existing convert API test had
  to change: they all use fresh phone numbers; the matching cases are new tests.
- **Sites.** "Exactly one primary" is enforced in the API: the first site is primary whatever was sent, marking another
  moves the flag, unmarking the primary is 422, deleting it promotes the oldest remaining site.
- **Lead detail** now reads each job's title and survey (the old page linked a survey the API never sent). Duplicates
  match the alt phone and the email too, as `docs/API.md` already claimed, and carry the counts the merge preview shows.
- **Customers list** adds site and open-job counts, and `balanceDue` only for `invoices:read`. The tag filter is a chip
  on the row (tags are free text, so there is no option list). The record tabs follow each API's own guard: warranties
  and AMC by role (ADMIN, DISPATCHER, SALES), the rest by capability; job, invoice, warranty and AMC rows say "Soon".
- **Board.** Pointer-based collision (a column is where the pointer is), each card also has a "Move to" menu for the
  keyboard and screen readers, and a move shows in its new column until the server lists it there.
- **Shell.** Pipeline is a Sales nav item; Customers is built; the SLA board item carries a breached-leads badge. The
  badge, the notification count and now the dashboard poll every `SHELL_POLL_MS` (60 s) — the dashboard did not poll
  before. The sidebar highlights the longest matching item, as the breadcrumbs do.
- **Kit additions, generic:** `FormDialog`, `RecordHistory`, `DataTable searchable`, `RecordCombobox fixedOptions` (a
  relation filter's "Unassigned").

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
| A Safety fixes ✅ 2026-09-14 | 2 | 2 | Correct money, locked quotations, no hard-deleted payments, honest docs |
| B Logging & audit ✅ 2026-09-14 | 3 | 5 | Redacted request-id logs, complete audit with domain events |
| C Admin UI kit ✅ 2026-09-14 (C1 + C2) | 4 | 9 | DataTable v2, ResourceForm, registry, nav |
| D Services & CMS ✅ 2026-09-16 (D1 + D2) | 6 | 15 | Editors run the whole public site |
| E Leads & CRM ✅ 2026-09-16 | 5 | 20 | Sales works entirely in the UI |
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

_Moved into Phase A (task A11), because every later session reads CLAUDE.md and would be misled by the stale paths._ **✅ Done in Phase A, 2026-09-14** — every item below.

- `docs/PLAN.md` still says MUI, an npm-workspace monorepo, `apps/*` and `packages/shared`. The real layout is `MaintainanceBackend` / `MaintainanceFrontend` with shadcn, and schemas mirrored in `src/shared/schemas` and `src/form/schemas`. Mark it historical.
- `docs/DATA-MODEL.prisma` (992 lines) is an older draft of `prisma/schema.prisma` (1,390 lines). Regenerate it from the schema, or make the schema the source and replace the file with a pointer. CLAUDE.md rule 2 depends on this.
- `docs/ARCHITECTURE.md` lists `apps/admin` on :5174. It is one Vite app on :5400.
- CLAUDE.md: amend the controllers rule per D5, and replace `packages/shared` with the real paths.
- `STATUS.md`: replace "Next" with a pointer to this document.
