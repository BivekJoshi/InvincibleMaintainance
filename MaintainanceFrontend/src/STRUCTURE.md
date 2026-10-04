# Frontend structure

One Vite app serves three audiences — the public marketing site, the back office
and the technician PWA — split by **route group**, not by build. The tree below is
organised by **layer**: a file's folder tells you what kind of thing it is, and
its name tells you which domain it belongs to.

```
src/
├── api/            Server state. RTK Query, one file per domain.
├── components/     Everything that renders.
├── three/          Everything that animates.
├── pages/          Route targets, grouped by audience.
├── routes/         The route table and its guards.
├── providers/      App-wide context and side effects.
├── redux/          Client state. The store and its slices.
├── form/           zod schemas + the react-hook-form binding.
├── hooks/          Reusable behaviour with no UI of its own.
├── config/         Constants, env vars, locale rules, the theme's vocabulary.
├── helpers/        Pure functions.
└── styles/         Tailwind entry + CSS variables.

e2e/                The Playwright suite: the quotation loop (Phase F2), the dispatch walk-through (Phase H1), the BOQ (Phases L3–L6), the field app (Phase H2), aftercare and finance (Phase I).
├── quotation-flow.spec.js
├── operations-flow.spec.js   (on the first day from tomorrow with no closed job left by an earlier run on Hari) schedule by drag and by dialog, double-book warning, materials, time, costing, complete (since L8 through the handover dialog — its warranty link, then Done), verify, case study — since Phase L6 the set-up pays the advance the Accept raised (`support/handoff.js#payAdvance`): the gate is boq-flow's subject
├── field-flow.spec.js  (the customer's phone is 96… — a 97… number whose tail began with 7 read as the +977 prefix) Hari at 360 px: today → on my way → start → tick, timer → `context.setOffline(true)` → a photo, a material, a tick wait on the phone ("Offline — 3 waiting") → back online, the queue drains by itself → last tick, sign, complete; the dispatcher finds the photos (DURING + SIGNATURE = `signatureId`), the material, the time, the checklist and the warranty
├── boq-flow.spec.js    SALES builds a 3-section BOQ by keyboard, pastes 15 rows, adds a `/` library row, a measured and an optional row, saves (server totals = what the builder showed), submits; MANAGER sees the margin, approves (L4: the unknown cost needs the acknowledgement, recorded in the event), sends; the customer opens the link at 360 px (sections, the 50 · 40 · 10 schedule with the server's amounts, the words, the annex, no sideways scroll), SALES sees "Opened 1×", the customer accepts; the public view has no cost key. **L5** (a second test): SALES books the visit from a lead (window, a Devanagari caretaker with a `+977` number, a landmark, the SMS preview in Nepali), the customer opens `/visit/:token` at 360 px, switches to नेपाली and confirms (`visitAnswer` / `customerConfirmedAt` on the job); the surveyor opens it from the survey list and drives the stepper at 360 px **offline** (`setOffline(true)`, the GPS granted) — the pin, the seepage checklist (a flagged reading, a photo on each photo-required question), two rooms in feet-inches with a door deducted (210.5 sq.ft), a SKETCH filed under its room, the line's work item — and submits on the phone ("Offline — n waiting", the office still has a DRAFT); back online the queue drains by itself (photos, then the save carrying their media ids, then the submit); the office's survey has the flagged reading with its photo, the rows, the pin and the sketch; SALES builds the quotation from it and the BOQ row's measurements and quantity equal the survey's (the seeded seepage service is found by `?q=` its slug — the shared database holds more than 100 services). **L6** continues the first test past the Accept: the customer's page asks for the advance ("Pay the advance of Rs X by <date>", the server's stage-1 amount, a pay link to `/invoice/:token`) and again after a reload; the job carries the BOQ's priced, non-optional rows as lines and `awaitingAdvance`; the dispatcher sees "Awaiting advance" on the queue card (no drag handle) and the job page (advance card, Schedule… held with the reason, the Plan tab's readiness), and the API refuses the schedule (422 ADVANCE_UNPAID); `accounts@` records the whole advance through Phase I's Record payment sheet on the invoice ("Advance" badge, the job linked) → PAID; the dispatchers have "Advance paid — JOB-x is ready to schedule"; the dispatcher schedules it on Suresh (not Hari — the other specs plan Hari's days) and the end follows `plannedDays`. **L7**: Suresh (`E2E.users.SURESH`, on the job) opens the job at 360 px, taps **Site diary** → **Fill in today**, picks the weather, counts two people of a trade, moves the first BOQ line up three 5 % steps (15 %), writes a problem in Nepali and saves; it syncs at once ("All sent"), the API's job line has `progressPct` 15, the phone shows no `Rs.` and no sideways scroll; the dispatcher sees 15 % on the job's **BOQ & progress** tab (the work done by value, **no earned value** for dispatch) and the day on its **Site diary** tab. **L8** closes it (the test's timeout is 420 s): Suresh files the rest of the day's progress over the field API (every line 100 %), so the 40 % milestone is due; the accountant presses **Raise running bill** on the job's BOQ & progress prompt and lands on the RUNNING draft (the stage's amount to the paisa; sent over the API; a second raise answers 409 STAGE_BILLED); the dispatcher ticks the checklist, starts the job over the API and completes it through the **handover** dialog in the browser (the warranty's `/warranty/…` link, **Offer AMC** → an `amc_offer` lead for the customer); the accountant opens Invoices › **Create from job**, finds the job, reads the server's final-bill preview (this bill's total, the advance and the running bill deducted) and creates it → the FINAL draft, whose Invoice tab lists two DEDUCTION rows in their own block with no "Less:" and no "Rs. -"; over the API **advance + running + final = the quotation's total to the paisa** and the job's costing has invoiced the quotation's subtotal less its discount
├── aftercare-flow.spec.js  (Phase I) a job completed over the API with a 30-day warranty; the customer raises a claim from `/warranty/:token` at 360 px, no account (the warranty is CLAIMED); the dispatcher finds it in the claims queue by job number, sees the claim rate, accepts → the free WARRANTY job (DRAFT, not billable, `parentJobId` the original, nobody on it) is in `GET /admin/dispatch/unassigned` and its page says "Nobody is on this job yet"; then New contract — customer by phone, the 1st of next month to the 1st a year on through the calendar, `24,000.50` — and the saved visits' due dates equal the last `/preview` the sheet showed, all pending
├── finance-flow.spec.js  (Phase I) as the accountant: a job completed over the API with 10 × Rs. 2,500 of billable material is invoiced from Invoices › Create from job ("Bills what it used", Rs. 28,250.00 with 13 % VAT — the server's figures), sent (the link dialog), paid Rs. 10,000 by eSewa, that payment voided (struck through, the balance back to Rs. 28,250.00), then settled by cash and a bank transfer → PAID; aging lists it while owed and drops it once paid; collections show the two payments, not the voided one; the collections CSV has its header and the bank payment's row
├── fixtures/           boq-paste.tsv — the 15 rows pasted from "Excel" (a header, two text-only section rows, Indian grouping, `Rs.`); site-photo.jpg — the field flow's camera shot (320 × 240)
├── global-setup.js     migrates and seeds the *_test database
└── support/            e2eEnv.js (ports, database, the API's environment, the seeded logins — `TECHNICIAN` is Hari, `SURESH` the second technician since L7), api.js (HTTP + signIn; `upload(path, { file, fields })` for multipart), quotation.js (`approveInDialog` — ticks the low-margin acknowledgement when the dialog or the API asks — and `rupeesText`), survey.js (Phase L5: `checklistReadings(surveyor, surveyId)` — uploads one photo and answers a survey's required and photo-required questions, so an API submit passes the checklist; the quotation loop uses it for the seeded seepage checklist), handoff.js (Phase L6: `payAdvance(accountant, jobId)` — pays a held job's advance invoice in full over the API, for a spec whose point is not the gate; the API suite's `payAdvance` does the same)
```

## api/

`apiSlice.js` is the single RTK Query slice; every domain file injects into it with
`injectEndpoints`, so there is one cache and one tag registry. `baseQuery.js` holds
the refresh-on-401 mutex — a burst of 401s triggers exactly one refresh.

**File downloads go through RTK Query too, never `window.open` or a bare `<a href>`** — neither
sends the Bearer token, so the API answers 401. The pattern (worked example:
`exportLeadsCsv` in `leadsApi.js`, used by `pages/admin/LeadsPage.jsx`): a lazy query with
`responseHandler: (res) => res.text()` and `keepUnusedDataFor: 0` — text, because the cache only
holds serialisable values — and the page builds the `Blob` and clicks a temporary link. That way
the request carries the token and survives a 401 → refresh → retry. For CSV, prepend `'﻿'`
to the Blob: `res.text()` strips the byte-order mark the API sends, and Excel needs it to read
Devanagari. A **binary** file (Phase L4's quotation `.xlsx`, `quotationsApi#exportQuotationXlsx`) is cached as
**base64 text** — `responseHandler` encodes `res.arrayBuffer()` with `helpers/download#arrayBufferToBase64` (an
error answer stays the API's JSON) — and the page saves it with `downloadBase64(base64, filename, type)`.

`apiCore.js` exports only the core pieces. Domain endpoint files are **not** re-exported:
a barrel there would drag the back office's endpoints into the marketing bundle.
Import them directly — `import { useGetLeadsQuery } from '@/api/leadsApi'`.

`cmsApi.js` serves every CMS resource the API's CRUD factory mounts, by path segment: `listResource`,
`getResource`, `createResource`, `updateResource`, `toggleResource`, `reorderResource`, `deleteResource`
(`hard: true` for purge) and `restoreResource`, each taking `{ resource, … }` (`'faqs'`, `'process-steps'`).
A list is tagged `{ type: 'Cms', id: resource }`, a record `{ type: 'Cms', id: 'resource:id' }`. Create and
reorder invalidate the list; update, toggle, delete and restore invalidate the list and that record. Every
write also invalidates `Public`, so the site's cached pages in the same tab follow the change — and whatever
`ALSO_READ_AS` lists for that resource (`rate-card` → the quotation builder's `RateCard` list). It also holds the
home composer's `getHomeSections` / `updateHomeSections` (tag `{ type: 'Cms', id: 'home-sections' }`), the moderation
call `approveTestimonial({ id, isApproved })` (the testimonial list and record, and the site), and a project's gallery:
`addProjectImage`, `reorderProjectImages`, `removeProjectImage` (the project and the projects list, and the site).
`settingsApi.js` reads `GET /admin/settings` (tag `Setting`) and saves `PATCH /admin/settings` with the changed keys
only (it also invalidates `Public`, so the header shows a new phone at once). `publicApi.js` has the blog's
`getPublicPosts`, `getPublicPost` and the generic page's `getPublicPage`.
`mediaApi.js` has the picker's reads and upload plus the library's `updateMedia`, `deleteMedia`,
`createMediaFolder` and `deleteMediaFolder`, and (Phase I) **`uploadPhotoTo({ path, file })`** — one photo to an endpoint of
the caller's own, for the `photoUpload` field.

The CRM files (Phase E):

- `leadsApi.js` — the lead list, detail, create / update / status / assign, **`bulkAssignLeads`** (one request for a
  selection), activities (the answer carries `firstResponse` and the lead's `sla`), duplicates, **`getLeadCustomerMatches`**
  (who else has this phone — the convert dialogs), merge, convert, delete, export. Every write that lands in a lead's
  audit trail also invalidates `History`; convert invalidates the `Customer` and `Site` lists and that customer.
- `customersApi.js` — customers (tags `Customer`), their sites (`Site`, id `customer:<id>`), timeline, statement, and
  **`getCustomerRecords({ kind, customerId })`**: another domain's list filtered by the customer (`CUSTOMER_RECORD_PATHS`
  — quotations, jobs, invoices, warranties, AMC), so the customer page needs none of those domains' files.
- `historyApi.js` — **`getRecordHistory({ endpoint, page, limit })`**, one query for every record's History tab (tag `History`).
- `usersApi.js`, `auditApi.js`, `messagesApi.js` (Phase G, ADMIN) — see "Platform (Phase G)". `previewTemplate` is a
  **query** although it is a POST: it reads, and caching by its arguments is what a live preview wants.
- `jobsApi.js`, `stockApi.js` (Phase H1) — see "Operations (Phase H1)". Phase L7 added the job-on-site reads — **`getJobProgress`**,
  **`getJobPlannedVsActual`**, **`getJobDiary`**, **`getJobVariations`** (tags `progress:<id>`, `pva:<id>`, `diary:<id>`, `variations:<id>`,
  each also tagged with the job) — and **`createShortfallPurchaseList({ id })`**; `issueJobMaterial` now answers **`{ line, warnings }`**
  (`meta.warnings`, `OVER_PLAN`). `stockApi.js` gained the purchase list's moves **`orderPurchaseList`**, **`receivePurchaseList`**,
  **`cancelPurchaseList`** (the list itself is the registry's `purchase-lists` through `cmsApi`). See "Execution (Phase L7)".
  Phase L6 added **`getJobPlan(id)`** (`GET /admin/jobs/:id/plan`,
  tag `{ type: 'Job', id: 'plan:<id>' }`, refreshed by every move) and **`overrideJobAdvance({ id, reason })`**; `createJob` also
  invalidates the invoice list (a job from a quotation runs the hand-off). See "Won → hand-off (Phase L6)".
- Phase L8 (close-out, see "Close-out & final bill (Phase L8)"): `jobsApi.js` gained **`measureJobLine({ id, lineId, measurements })`**,
  **`closeJobMeasurement`** / **`reopenJobMeasurement`** (each refreshes the job, its progress tab and the final bill's preview —
  `jobsApi#finalBillTag`, `{ type: 'Job', id: 'final-bill:<id>' }`) and **`offerAmc({ id })`** (answered `{ lead, existing }` — the
  API's 200 for the customer's open AMC offer, 201 for a new lead; it refreshes the lead lists). `financeApi.js` gained
  **`raiseStageInvoice({ jobId, paymentStageId })`** (the RUNNING draft; money moved) and **`getFinalBill(jobId)`** (the preview,
  `keepUnusedDataFor: 0`, tagged with the job so every money move and measurement change reads it again). `techApi.js` gained
  **`measureMyJobLine({ id, lineId, measurements })`** — a plain PUT that writes the answer's `measurements` / `measuredQty` into the
  cached `getMyJob`; it needs signal, since `/tech/sync` has no kind for it.
- `techApi.js` — the field app. Phase L7 added the site diary's reads, **`getMyDiary(jobId)`** and **`getMyDiaryDay({ jobId, day })`**
  (kept 12 h, tags `{ type: 'Job', id: 'diary:<jobId>' }` / `'diary:<jobId>:<day>'`) — its one write is the `diary_save` sync kind.
  Phase H2 added **`uploadMyJobPhotos({ id, body })`** (multipart `files` + `kind` +
  `caption`, answered `{ photos, media }`) beside `uploadSurveyPhotos`; both are sent only by the upload queue's engine
  (`hooks/useOfflineQueue.js`), never straight from a screen. `getTechMaterials` is kept 12 h (reference data for the
  materials sheet offline); `getMyJobs({ from, to })` feeds History. See "The field app (Phase H2)". Since Phase L5 a survey
  upload carries `kind` (ISSUE, or SKETCH), `caption` and `area`, and `getMySurvey` answers the stepper's whole survey
  (template, lead photos and message, site pin and contact, `media`); the survey screen writes only through the queue.
- `publicApi.js` (Phase L5) — **`getVisitByToken(token)`** and **`respondToVisit({ token, answer, note })`** for the
  customer's `/visit/:token` page; a successful answer writes the returned visit into the GET's cache, so the page
  shows what was recorded.
- Phase L1 added to `leadsApi.js` **`setLeadNextAction`** (`PATCH …/next-action`: `{ at, type, note }`, or `{ at: null }` to
  clear) and uses the lazy **`useLazyGetLeadQuery`** on the board (a list row does not say whether a quotation exists).
  `addLeadActivity` now carries the outcome contract: the answer has `lead` (status, next action, attempts after it) and
  `dialog` (`'visit'` | `'quotation'` | null). **`reportsApi.js`** holds the sales reports — `getLostReport({ from, to })`
  (tag `{ type: 'Report', id: 'lost' }`, refreshed with the lead list).
- `dashboardApi.js` also holds **`getBreachedLeadCount`** (the SLA nav badge): the shell loads that file, and a count must
  not pull `leadsApi` into the main bundle.
- `quotationsApi.js` — Phase L7: `getQuotations` takes `?kind=` and `?jobId=`, `createQuotation({ jobId, items })` starts a
  VARIATION, and the staff convert of a variation refreshes the job it joined. Since Phase L3 it also has **`previewQuotation`** (`POST /admin/quotations/preview` — a **query** although
  it is a POST: the builder's live amounts, totals and margin, and the discount helpers through `useLazyPreviewQuotationQuery`),
  **`getQuotationTakeoff`** (tagged with the quotation, so a save refreshes it), **`repriceQuotation({ id, apply })`** (a preview
  invalidates nothing; `apply: true` the quotation, the list and History) and **`copyQuotation({ id, customerId?, siteId?, leadId? })`**.
  `createQuotation` takes `items: []` (a blank draft). `getRateCard` stays for older callers; the builder searches with
  `rateLibraryApi#searchRateLibrary`. Phase L4: **`exportQuotationXlsx(id)`** (the binary download above, lazy,
  `keepUnusedDataFor: 0`), `approveQuotation` takes `acknowledgeLowMargin`, and the preview body carries
  `paymentStages` when the schedule on screen is whole. The terms picker reads the library through
  `cmsApi#listResource({ resource: 'quotation-terms' })`.
- `rateLibraryApi.js` (Phase L2) — the rate library's two calls beyond the registry's eight: **`deriveRateCost`**
  (`POST /admin/rate-card/derive`, `costs:read` — a **query** although it is a POST, like `previewTemplate`: the Cost vs rate
  card asks again as the recipe changes; tag `{ type: 'RateCard', id: 'DERIVE' }`) and **`repriceRateCard({ ids, apply })`**
  (`apply: false` is a preview and invalidates nothing; `apply: true` invalidates the library, those rates, the builder's
  `RateCard` list, `Public` and `History`). A write to `materials` or `trades` (a purchase rate, a day wage) refreshes the
  library's "Out of date" flags and the cost card through `cmsApi`'s `ALSO_READ_AS`. Phase L3 added **`searchRateLibrary({ q })`**
  (`GET /admin/rate-card?q=&limit=20&onlyActive=true`, tag `{ type: 'RateCard', id: 'LIST' }`) — the BOQ grid's `/` search.
- `financeApi.js` (Phase I) — invoices, payments, the finance reports, the sales and operations reports of `/admin/reports`
  and **`downloadReportCsv({ path, params })`** — every report's `?format=csv` as `{ csv, truncated, disposition }` (the
  same pattern as the leads export). See "Finance screens (Phase I)". Since Phase L6 a write that moves money also invalidates
  `Job` and `Dispatch` — a payment on an advance invoice lifts the job's gate, voiding one can put it back — and `getInvoices`
  takes `?kind=`. `quotationsApi#convertQuotationToJob` (the staff hand-off) invalidates `Dispatch` and the invoice list. `lookupApi.js` gained **`getSuggestions({ path, tag })`**
  (an endpoint answering `string[]` — the expense categories) for a text field's `suggestionsFrom`.

## components/

| Folder | Holds |
|---|---|
| `ui/` | shadcn primitives. Generated by `npx shadcn@latest add <name>`, then edited freely — they are our source, not a dependency. |
| `common/` | Cross-cutting app furniture (Phase L7: `Toaster` has a **`warning`** variant — `uiSlice#toastWarning`, a thing done that someone should look at, e.g. `OVER_PLAN`): `PageHeader` (a list page's top; its `<h1>` is screen-reader only — the breadcrumb names the page), `RecordHeader` (a record page's top: avatar, the name as the `<h1>`, contact links, actions, and a foot strip), `EmptyState`, `ErrorState`, `ErrorBoundary/`, `SlaChip`, `Toaster`, `LocaleSwitch`, `StateBadge` (a record's state on the semantic surfaces — Live, Draft, Waiting) — and the **admin kit**: `CustomTable/`, `ResourceForm/`, `EditableGrid/` (Phase L3 — reached only through ResourceForm field types), `MediaPicker/`, `LocaleTabs`, `ConfirmDialog`, `RecordCombobox`, `FormDialog`, `RecordHistory`. See "The admin kit" below. `SmsCounter` (Phase G's; shared since Phase I) — characters and SMS parts for a text, and why it is Unicode. `AdBsDate` (Phase I) — a date in AD (Kathmandu) with its BS twin under it. |
| `theme/` | The colour-mode controls: `ThemeToggle` (one button) and `ThemeModeSwitch` (all three modes). Both read the theme context; neither takes state as a prop. |
| `layout/` | The three shells — `SiteLayout`, `AdminLayout/`, `TechLayout` (lazy since Phase H2: it carries the field sync engine) — plus what the public one is made of: `SiteHeader/`, `SiteFooter`, `MobileCallBar`. |
| `site/` | Marketing presentation, **one component per file**: `ServiceCard`, `ProjectCard`, `CategoryTile`, `PageHero`, `SectionShell`, `SectionHeading`, `Media`, `Breadcrumb`, `PromiseList`, `FaqList`, `FilterChip`, `PriceTag`, `Cta`, `Eyebrow`, `Stars`, `DataIcon`, `ProseBody` (long CMS copy — shared with the admin's prose preview). |
| `documents/` | The customer-facing sheet a token link opens: `DocumentShell` (tighter edges on a phone since L4), `DocumentHeader`, `LineItemsTable` (since L3 a BOQ: SECTION rows as numbered headings with their subtotal, NOTE rows as text, a row's `spec` under it, optional rows "not included in the total", provisional ones marked — an invoice's lines read as before; since L4 money never wraps and, on a phone, a line says to swipe the table for the rates and amounts), `TotalsList`, `DocumentNotice`, and Phase L3's **`QuotationDocument`** with its words (en **and** ne) in **`quotationDocumentCopy.js`** — the public quotation page, the builder's Customer view and (L4) the print route all render it. Phase L4 added **`DocumentLetterhead`** (logo, name, address, call-link phones, email, PAN/VAT — the API's `letterhead`), **`PaymentScheduleTable`** (stage · share · the server's amount with its VAT; the footer is the quotation's own total), **`SectionSummaryTable`** (`summaryOnly`: section subtotals only) and **`MeasurementsAnnex`** (collapsible on the page, open in print). See "Quotations — terms and the customer document (Phase L4)". Phase I's **`InvoiceDocument`** + `InvoicePayments` — the invoice on the public page, the office's invoice page and its print (dates in AD and BS, the server's figures; since L6 a stage bill names its stage under the dates — "Advance — on acceptance (50%)", `helpers/finance#invoiceStageLine` — and `LineItemsTable` writes a negative line, a final bill's "Less: advance INV-…", as "− Rs. 36,450.00" through `helpers/format#formatSignedNpr`, never "Rs. -…"). Phase L8's **`DeductionsTable`** — a final bill's lines of `kind` DEDUCTION in a block of their own under the billed lines ("Deducted — billed before": the bill, "Advance INV-…" — the server's "Less: …" without its "Less:" — and the amount with one sign, "− Rs. 30,450.00"; no quantity, no rate, no sum of its own; words en + ne in `quotationDocumentCopy.js#deductions`); `InvoiceDocument` and a locked draft split the lines with `helpers/finance#splitInvoiceItems`. Shared by the quotation, invoice and warranty pages. |
| `media/` | The media library screen's own parts: `MediaFolderTree` (folders as an indented tree) and `MediaDetailsSheet` (one file's facts, URL and alt/caption/folder form — a `ResourceForm` sheet) — and `MediaCell`, a list column's thumbnail of one media id (the gallery, features). |
| `projects/` | `ProjectGalleryTab` — the Gallery tab of a project's edit page (add from the library or upload, drag or Move earlier/later, remove; each change saves at once through the project image endpoints) — and `ProjectName`, a project's title from its id for a list column. |
| `homeComposer/` | `HomeSectionList` — the home page composer's sortable section rows (drag handle, Move up / down, visibility, item limit). |
| `agenda/` | The SLA board's **Calendar** tab (`pages/admin/SlaBoardPage.jsx`, `?tab=calendar`): `AgendaCalendar` (the tab — four tiles (overdue, due today, still to come, nobody owns), the period's AD and BS names with prev / Today / next, Month · Week · List, the legend that is also the kind filter, and beside the month or list the **Overdue** panel — every late item, oldest first, whatever month is on screen — and the picked day in full; the week takes the full width with the late items in columns under it), `AgendaMonthGrid` (six weeks Sunday–Saturday, the Saturday holiday shaded, each day's BS date, a red late count and its first three chips — dots at phone width), `AgendaWeekGrid` (a column a day), `AgendaDayList` (days with their items, sticky headings), `AgendaItem` (`AgendaChip` for a cell, `AgendaCard` in full — the kind's colour and mark, the time, how late, what to do, who owns it; each a link to its record) and `agendaIcons.js` (`KIND_ICONS`). Data: `leadsApi#getAgenda({ from, to })` → `GET /admin/agenda`, polled every 60 s; the arithmetic is `helpers/agenda.js`. The view, the day and the kinds switched off live in the URL (`cal`, `day`, `hide`) beside the board's `who`, which narrows the ownable kinds (a lead's work, a quotation) to Mine or Unassigned. The months are AD or BS — the account menu's Calendar (`useCalendarMode`): in BS the grid is the BS month (असोज २०८३, "Ashwin" beside it), steps are BS months, the weekdays are Nepali (आइत … शनि), each cell is headed with its BS day and carries the AD date in its corner (the other way round in AD); a day past the BS table falls back to AD. **A BS date is always written in Nepali script** — Devanagari digits and month names, "१८ असोज २०८३", the office's ask and the one place the English back office writes Devanagari digits; times and AD dates stay Latin. `AgendaOtherDate` sets the other calendar's date off as a pill a size up (gold for a Nepali date, blue for an English one); the calendar loads Noto Sans Devanagari (`helpers/devanagariFont.js`, shared with `providers/LocaleProvider`). |
| `leads/` | The lead screens' parts: `LeadFormSheet` (new / edit), `AssignLeadDialog` (one lead or a selection), `LostReasonDialog` (a required lost category, then the words — required only for "Other"), `LeadStatusMenu` (only the allowed moves), `ActivityComposer` (**the outcome composer** — see "Lead follow-through (Phase L1)"), `LeadRequestPanel` (contact, slot, estimate, UTM, language), `DuplicatesPanel` (merge with a preview), `CustomerMatchChoice` ("same person / different person", the email and language boxes), `ScheduleVisitDialog` and `ConvertLeadSheet` (the two converts, both with the choice; both report completion before they close, so a caller can tell done from Cancel — L1's new-quotation use of it became `quotations/NewQuotationSheet` in L3; since Phase L5 the visit is a window with a site contact, a landmark and an SMS preview from `visitBookedCopy.js` — see "The site-visit kit (Phase L5)"), `ConvertResult` (what a convert made, with links), `LeadPhotoGallery` (what the customer photographed, with a lightbox: arrow keys, thumbnails, full size), `ResponseRunway` (the SLA board's hero: every unanswered lead on its two-hour clock; `RunwayStrip` is the one-line version on the dashboard) `LeadStageTrack` (a lead's road from New to Won on its page; a lost lead shows its category and the stage it was lost at), and Phase L1's `NextActionCard`, `QualificationCard` and `StageAgeChip` (see "Lead follow-through (Phase L1)"). |
| `rateLibrary/` | Phase L2's rate library parts: `RateCostCard` (the edit form's live **Cost vs rate** card — a `preview` field behind `costs:read`), `RepricePreview` ("Update to derived rate"'s before/after table, inside the confirmation) and `RateLibraryIntro` (above a saved rate: how its rate is set, and "Out of date" with what its recipe gives today). See "The rate library and the money wall (Phase L2)". Phase L3's **`RateLibrarySearch`** is the BOQ grid's `/`: a cmdk palette over the server search — Enter adds the highlighted item, Shift+Enter ticks several, each becomes a row priced from the library (`helpers/boq.js#libraryRow`). |
| `quotations/` | Phase L3's **`NewQuotationSheet`** — the one way a quotation starts: blank · from a survey · copy. See "Quotations — the BOQ builder (Phase L3)". Phase L4's **`ApproveQuotationDialog`** — the margin, a remark, and the low-margin acknowledgement (`useQuotationActions` opens it for Approve). |
| `customers/` | `CustomerFormSheet` (new customer), `CustomerAvatar` (initials in a steady colour; squared for a company), `CustomerBook` (the list's summary tiles, each a filter) and `MapPinInput` ("use map pin": pasted coordinates fill a site's latitude and longitude — it sits in the site form's `intro`, inside the form). |
| `jobs/` | Phase H1, shared by the jobs list, the job page and the dispatch board: `JobFormSheet` (new job; the site and quotation follow the customer; since L6 the type may be left out — REPAIR, or the quotation's service's `jobType`), `ScheduleJobDialog` (window, who goes, lead, "text the customer" — the board's non-drag path; since L6 the end is prefilled `plannedDays` after the start and may be cleared), `AssignJobDialog`, `CompleteJobDialog` (since Phase L8 the **handover** — snags, then the sign-off, then the warranty and Offer AMC; see "Close-out & final bill (Phase L8)"), Phase L8's **`MeasureLineSheet`** (the office's final measurement of one job line — the kit's `measurements` field in a sheet) and **`OfferAmcButton`** (a lead for sales; on the handover and a finished job's Overview). Phase L6's advance parts: **`AwaitingAdvanceChip`** ("Awaiting advance", the invoice number on hover — the job page's header, the jobs list's status column, the dispatch card and so the unassigned queue), **`AdvanceNotice`** (why a held job cannot be scheduled or assigned — up front, or from a 422 ADVANCE_UNPAID: the server's words, the invoice, what is owed, Override… — inside the Schedule and Assign dialogs) with **`AdvanceInvoiceLink`** (the invoice as a link for `invoices:read`, its number as text for anyone else), **`AdvanceOverrideDialog`** (a `FormDialog`; the reason is required, 5–500). See "Won → hand-off (Phase L6)". |
| `stock/` | `StockMovementsSheet` — one material's movements, paged (Phase H1). |
| `tech/` | The field app's parts (Phase H2) — see "The field app (Phase H2)": `FieldSyncStatus` (`SyncButton` — the header's Offline / Syncing… / Sync now (n) / All sent — and `SyncBanner` — no signal, and each change the office refused), `PhotoCapture` (camera input, kind picker, caption, the queued thumbnails "Waiting to upload" and the sent ones — job and survey; since Phase L5 a survey's kinds too — ISSUE or SKETCH — and, with `areas`, the room the photo was taken in, suggesting the rooms measured), `MaterialsSheet` (pick from `/tech/materials`, quantity in its unit, − and +; no rate) and `SignaturePad` (pointer events, Undo, Clear, the minimum-ink check). Phase L8 moved the survey stepper's measurement card here as **`MeasurementCard`** (with `LengthInput`): one row as a card — what, nos, L, B, H in feet-inches, the deduction switch, the row's value as a preview — read by the survey's Measure step and the final measurement alike; its words are a `MeasureWords` object (`fieldCopy`'s `survey.measure` or `measure`). |
| `charts/` | Hand-drawn SVG charts, no chart library: `ChartCard` (the frame — title, Chart/Table switch, link; with `ChartTable`, `ChartTooltip`, `LegendKey`), `LineChart` (running lines, crosshair, arrow-key stepping), `ColumnChart` (a few columns, one emphasised, each a button), `RingMeter`, `Sparkline`. Width comes from `hooks/useElementWidth`. Series colours are `hsl(var(--chart-1))` (teal) and `--chart-2` (brass) from `globals.css`, validated as a colour-blind-safe pair — marks only, never text. Every chart has a table twin. |
| `dashboard/` | The admin dashboard's widgets, one per file: `DashboardHero` (greeting and the "to do" chips), `MetricGroup` (a titled strip of numbers — groups and names in `config/admin/dashboardCards.js`), `LatestCard` (your notifications), `LeadTrendCard`, `SlaCard`, `SlaQueueCard`, `PipelineCard`, `FunnelCard`, `HeatmapCard`, `LeadSourcesCard`, `TodayJobsCard`, `TechLoadCard`, `JobsWeekCard`, `JobStatusCard`, `RevenueCard`. `pages/admin/DashboardPage.jsx` lays them out on a 12-column grid by section and drops whatever the API did not send for the role; the arithmetic is in `helpers/dashboard.js`. |
| `aftercare/` | Phase I's aftercare parts — see "Aftercare screens (Phase I)": `AftercareStatus` (a warranty's, claim's, contract's, visit's or reminder's state in words, on the semantic surfaces), `ViewTabs` (a list's status tabs, kept in the URL), `ClaimDecisionSheet` (one claim and its decision) with `ClaimRatePanel`, `AmcContractSheet` (create and renew) with `AmcSchedulePreview` (the server's visit schedule, live), `ReminderFormSheet` with `ReminderMessageCounter`. |
| `finance/` | Phase I's finance parts — see "Finance screens (Phase I)": `InvoiceFromJobSheet` (a billable job, and how it bills), `NewInvoiceSheet` + `invoiceFields.js` (the manual invoice; the lines a draft edits), `RecordPaymentSheet` (rupees ≤ the server's balance), `InvoiceLinkCard` (the sent link: Copy, Open, WhatsApp), `PaymentTotals` (the server's totals by method), `CustomerStatement` (the ledger — on the customer page and in Finance reports), and Phase L6's `InvoiceKindBadge` ("Advance", "Running bill", "Final bill"; nothing for a STANDARD invoice), and Phase L8's **`FinalBillPreview`** (the server's final bill before it is raised — see "Close-out & final bill (Phase L8)"). |
| `reports/` | The report pieces built once for Finance reports and `/admin/reports` (Phase I): `ReportToolbar` (date range, quick ranges incl. this fiscal year, the range in BS, CSV), `ReportCsvButton` (the API's `?format=csv` with the filters on screen), `ReportTable`, `ReportFigures`. |
| `platform/` | The admin platform screens' parts (Phase G): `AuditDiff` (a before/after, nested fields by path, each line marked added / removed / changed on the semantic surfaces and in words), `AuditRowDetails` (an audit row opened: the diff, request id, ip, browser, "Show everything from this request", "Open the record"), `UserFormSheet` (new / edit — no password field), `SessionsDialog` (where someone is signed in, "Sign out everywhere"). |
| `public/`, `booking/`, `surveys/` | Domain components, named for the domain they serve. `booking/BookingWizard/` is a folder for the same reason a page is: the flow's state in `BookingWizard.jsx`, one file per step under `steps/`, and the Kathmandu date maths in `bookingDays.js`. `public/SitePhotoUpload` is shared by the booking wizard's details step and the enquiry form: each photo uploads as it is chosen (`POST /public/lead-photos`) and the enquiry carries only the ids. `surveys/SurveyFindings` is the office review's evidence (Phase L5: the customer's photos, readings flagged first, a measurement table per measured line, photos by area, the pin with a Maps link). |

A component used by exactly one page can live beside its domain here; a component
used by two pages **must**. Nothing imports upward from `pages/`.

There is no `siteBlocks.jsx` barrel any more — import the component, not a bundle
of fifteen: `import { ServiceCard } from '@/components/site/ServiceCard'`.

A layout becomes a folder on the same rule a page does. `SiteHeader/` is the
worked example: the bar and the state its panels share in `SiteHeader.jsx`, and
`MegaPanel`, `MobileDrawer`, `HeaderSearch` and `UtilityStrip` beside it.

`AdminLayout/` is the second: the shell and top bar in `AdminLayout.jsx`, the ink sidebar in `AdminSidebar.jsx`,
the shortcuts strip under the top bar in `ShortcutBar.jsx`, the Ctrl/⌘+K palette in `CommandPalette.jsx`, the notes
drawer in `NotesSheet.jsx`, the header's `AdminBreadcrumb` and `NotificationPanel` beside them, and `notificationLinks.js` — the one place a
notification's `link` (`/leads/:id`, `/admin/surveys/:id`, an absolute app URL) becomes an in-app path.
The nav itself is data, in `config/admin/adminNav.js` (see "The admin shell" below).

## The admin kit

Every admin list and every admin create/edit screen is built from these. A CMS resource screen is
not built from them by hand at all: it is a **registry entry** (see "The resource registry" below)
that the two generic pages render with this kit.

### `common/CustomTable/CustomTable.jsx` — the one table

Built on **TanStack Table** (`@tanstack/react-table`, headless) with shadcn/ui cells — the Material React
Table feature set without MUI. Server-side paging, sorting and search over `?page&limit&sort&q`, with the
params in the URL through `hooks/useListParams`; TanStack holds sorting, selection, expansion, and the
viewer's layout. The folder holds the table and its parts: `CustomTableHead` (sort, column actions menu,
resize handle), `CustomTableCell` (cell rendering, pinning offsets), `CustomTableViewOptions` (Columns,
density, full screen, export), `CustomTableFilters` (inline) and `CustomTableFilterPanel` (`filterLayout="panel"`: a Filters side panel of chips plus removable applied-filter chips), `CustomTableRowActions`, `CustomTablePagination`,
`CustomTableReorderBody`, `useCustomTableLayout` (the remembered layout) and `exportCsv`.

A column is `{ key, header, cell?(row), sortable?, className?, label?, hideable?, hidden?, size?, exportValue?(row) }`;
the table maps it to a TanStack column def, so callers never touch TanStack directly. Cells are rendered
as plain calls, not `flexRender` (which would remount every cell each render). The table adds its own
display columns on the edges — expand, select and # pinned left, row actions pinned right — so they stay
in view when a wide table scrolls sideways.

| Prop | Does |
|---|---|
| `columns`, `data` (the page's rows), `meta`, `params`, `onParamsChange` | the basics, unchanged from v1 |
| `onRowClick`, `toolbar`, `searchPlaceholder`, `empty*`, `isLoading`, `isFetching`, `error`, `refetch` | unchanged |
| `rowActions(row)` → `[{ label, icon?, onSelect(row), destructive?, disabled?, separator? }]` | a kebab menu per row |
| `bulkActions` → `[{ label, icon?, destructive?, onSelect(rows, clearSelection) }]` | checkbox column, select-all-on-page, an actions bar. Selection clears when the page or filters change |
| `pageSizes` (default `[10, 20, 50, 100]`) | "Rows per page", written to `limit` |
| `filters` → `[{ key, label, type: 'enum' \| 'boolean' \| 'relation' \| 'dateRange' \| 'text', options?, allLabel?, defaultValue?, relation?: { path, labelKey?, params? }, fixedOptions?, fromKey?, toKey?, className? }]` | the filter bar; every value lives in the URL. A date range writes `from` / `to`. A choice with a `defaultValue` has no "all" of its own (give it an explicit option), is where the list starts, and is not counted as an applied filter — the caller puts the default in its list params. A relation's `fixedOptions` (`[{ value: 'none', label: 'Unassigned' }]`) are choices that are not records. An enum option's `group` lists consecutive options under that heading (the audit log's events). A `text` filter (a request id, an ip) is applied on Enter or blur, not per key |
| `expandable` → `{ render(row) }` | a disclosure button per row (`aria-expanded`, `aria-controls`); an open row shows `render(row)` across the table beneath it. Open rows close when the params change |
| `searchable` (default true) | false hides the search box — a short, complete list inside a page (duplicates, sites, a statement) |
| `trash` → `{ onRestore(row), onPurge?(row), canPurge? }` | a Trash toggle (`?deleted=true`); rows offer Restore, and Delete forever (confirmed) to `cms:purge` |
| `reorderDisabledReason` | when not `reorderable`, a disabled Reorder button with this reason beside it (list items: pick a list first) |
| `reorderable`, `onReorder(items)` | Reorder mode: drag handles plus Move up / Move down. `items` is `[{ id, sortOrder }]` offset by earlier pages — the `PATCH /reorder` body. Optimistic; a rejected promise puts the order back |
| `getRowId` (default `row.id`), `rowLabel(row, i)` | identity, and how a row is named to a screen reader |
| `enableColumnActions`, `enableColumnPinning`, `enableColumnOrdering`, `enableColumnResizing` | a **column actions menu** in every header: Sort ascending / descending / Clear, Pin to left / right / Unpin (pinned columns stick while the table scrolls sideways), Move left / right, Reset width, Hide column. Resize by dragging a header's edge (double-click resets) or focusing it and pressing ←/→ |
| `enableHiding`, `enableDensityToggle`, `enableFullScreenToggle` | toolbar: a **Columns** menu (show / hide, Show all, Hide all, Reset layout), row density (Normal → Comfortable → Compact) and full screen (Esc leaves). A column opts out of hiding with `hideable: false`, starts hidden with `hidden: true`; `label` names it when `header` is not text |
| — defaults | every `enable*` above is **on for a full list** (searchable, more than four columns) and off for a short in-page table; pass `true` / `false` to override |
| `storageKey` | remembers the viewer's layout — hidden, ordered, pinned and resized columns, density — in this browser (`table:<key>:layout`). Every admin list page sets one; CMS lists use `content:<resource>` |
| `enableRowNumbers` | a # column, counted across pages |
| `exportable`, `exportName` | an **Export** button: this page, or the selected rows, as CSV — each column's cell text as shown (money as `Rs. …`), or its `exportValue(row)`. UTF-8 with a BOM so Excel reads Nepali; fields starting `= + - @` are prefixed `'` (CSV injection). Server-wide exports (leads) stay on their own endpoints |
| `maxHeight` | the body scrolls under a sticky header (full screen does the same) |

### `common/EditableGrid/EditableGrid.jsx` — the one spreadsheet (Phase L3)

The kit's editable grid, on TanStack-style column specs and dnd-kit. **Pages never render it**: they reach it only
through ResourceForm field types — `lineItems` (a quotation's BOQ), `grid` (generic), `measurements` (a measurement
sheet), `recipe` (the rate library's) and, since Phase L4, `paymentSchedule` (a quotation's stages) — which is how CLAUDE.md rule 3 still holds (a test in `EditableGrid.test.jsx`
fails if a page or a registry entry imports it). The folder: `EditableGrid.jsx` (state, keyboard, clipboard, the visible
window), `GridRow.jsx` (one memoised row; a sortable shell only when the grid is editable), `GridCellEditor.jsx` (the one
editor on screen: text, number, money, length, a `select` list, or a column's own `renderEditor`), `gridKeys.js` (the
keyboard map as data, `resolveCellKey` / `resolveEditorKey`, `gridKeymap` for the legend) and `gridPaste.js` (the clipboard).

- **One cell edits at a time.** Every cell is a plain `gridcell` with a roving tab stop; only the cell being edited renders
  an input, so a keystroke re-renders that input, not the grid. It saves on Enter (and moves down), Tab (and moves across)
  and blur; Esc cancels. Rows are memoised by object, so an edit re-renders the row it changed.
- **The keyboard map** (shown under every grid by its **Keyboard** button):

  | Keys | Does |
  |---|---|
  | ↑ ↓ ← → · Home / End · Ctrl+Home / End | move between cells (a section's spanning title is one cell; moving down through it comes back to the same column) |
  | Enter / F2 | edit the cell — Enter again saves and moves down; Enter on a measured Qty opens its sheet, on the actions cell the menu |
  | typing | overwrites the cell (arrows then save and move, as in a spreadsheet; in Enter/F2 mode ← → move the caret) |
  | Tab / Shift+Tab | save and move to the next / previous editable cell; after the last cell Tab adds a row |
  | Esc | cancels an edit; Esc then Tab leaves the grid |
  | Delete · Space | clear the cell · tick a yes/no cell |
  | Ctrl+Enter · Ctrl+Shift+Enter | add a row · a section below |
  | Ctrl+D · Alt+↑ / Alt+↓ · Ctrl+Delete | duplicate · move (the drag handle's keyboard way) · remove the row |
  | Ctrl+Z | undo the last change made in the grid (a change from outside — a drawer, a reload — ends the history) |
  | `/` | open `search` (the BOQ's rate library) |
  | Shift+F10 | the row's actions menu (its own actions, then add / duplicate / move / remove with their shortcuts) |
  | Ctrl+M | (BOQ) the row's measurement sheet — a field's own `shortcuts` join the legend |

- **Paste** (`gridPaste.js`): a range copied from Excel or Sheets is TSV — `parseClipboard` reads quoted cells too.
  `readPastedRows(text, columns)` detects a **header row** (two or more cells naming columns by `aliases` — `Particulars`,
  `Qty.`, `Rate (Rs)`) and maps by it, ignoring columns it does not know (S.N., Amount); without one, cells go in order and a
  leading serial-number column (`1`, `A.1`) is dropped. Numbers go through `parseGridNumber`: **Indian grouping**
  (`1,23,456.50`), `Rs` / `Rs.` / `NPR` stripped; lengths through `helpers/measurements#parseLength`; an unreadable number
  stays as typed for the schema to name. `pastedBoqRows` turns a row with **text but no quantity and no rate into a
  SECTION**. Pasted rows go in after the selected row (in place of it when it is blank); one value pastes into the cell.
- **Numbering** is the caller's `numbers` (the BOQ's `A`, `A.1` from `helpers/boq.js#boqNumbers`, the API's rule).
- **A `select` cell** opened with Enter/F2 lists every option; typing over it searches for what was typed (Phase L5 — it
  used to search for the stored value, `YES_NO`, and matched nothing).
- **Drag** by a row's handle (dnd-kit, pointer); every drag has the keyboard equivalent Alt+↑/↓ and the menu's Move up / down.
  A read-only grid has no handles and no dnd-kit context at all.
- **500 rows**: above 60 rows only the rows in view (plus a margin) render, from each row's known height; the selected
  row is scrolled to before it takes focus. The test renders 500.
- Column spec: `{ key, header, width | grow + minWidth, align, editor ('text'|'number'|'money'|'length'|'select'|'boolean'|
  'custom', or a function of the row), get/set, parse/toText, format(value, row, { meta, index, number }), editable(row),
  hidden(row), span(row), onActivate(row), options, suggestions (a datalist), renderEditor, label(row, i), placeholder }`.
  Grid props: `rows`, `onChange`, `getRowKey`, `numbers`, `rowKind`, `makeRow(kind)` + `kinds`, `duplicateRow`, `isBlankRow`,
  `paste`, `search`, `rowActions`, `shortcuts`, `rowMeta` (the server's figures per row), `rowErrors`, `rowHeight`,
  `readOnly`, `maxRows`, `focusRef` (react-hook-form's field ref: a failed save focuses the first bad cell), `apiRef`.

### `common/ResourceForm/ResourceForm.jsx` — a form described by data

`<ResourceForm schema fields defaultValues onSubmit submitLabel mode="page|sheet" />`, plus `onCancel`,
`open` / `onOpenChange` / `title` / `description` for a sheet, `guard`, `extraActions`, `readOnly` (every control
disabled, no Save — for a role that may read but not write) and `intro` (content above the fields, e.g. the
media sheet's preview).

- `defaultValues` is a record **as the API returns it** (money in paisa). `formValues.js` converts it for
  the form and back into a request body (money stays in rupees — requests send rupees).
- `onSubmit(body)` returns the mutation's `unwrap()`. A rejection's `error.details` lands on the named
  fields (`serverErrors.js` — both the `[{ path, message }]` and the `['field']` DUPLICATE shape); anything
  unplaced shows in an alert above the form, and the first failing field takes focus.
- After a save the form is clean: its baseline becomes the inputs' own values, not the schema's output (a
  transform such as "empty optional text → undefined" would otherwise leave it dirty and trip the leave guard).
- Controls are disabled while saving. Leaving with unsaved changes — a link, Back, closing the tab or
  the sheet — asks first (`hooks/useUnsavedChangesGuard`). One guard per page: `guard={false}` on any second form.
- Render it once the record has loaded, so a saved slug is known to be saved.
- A null value in a column the form has no field for is dropped from the form values (a schema's `.optional()` refuses
  null, and a hidden column must not block a save — a testimonial's `jobId`).
- `stickyActions` keeps Save in view at the bottom of a long page-mode form.
- A spec's **`hidden: true`** keeps the field — and its value, and its validation — without showing it (a group card's
  `hidden` does the same for the card): the quotation builder shows its BOQ and Payment & terms panels one at a time from
  one form. `formMode.js` tells the grid fields whether the form is read-only (`readOnly`, or a save in flight) — a
  `<fieldset disabled>` cannot disable grid cells.
- `onValuesChange(values)` is told the typed values on every change — a live preview beside the form (the message
  template editor). Pass a stable function (a state setter).
- **Fields that follow the values** (the outcome composer shows a time for "Call back at…", a lost category for "Not
  interested"): compute `fields` from what `onValuesChange` reports, and give `defaultValues` **every** field the form can
  show, blank. The form resets a clean form when its starting values change, and a starting point that grew with each
  field shown would wipe the pick that showed it (react-hook-form reports `isDirty` a render late). A value whose field
  is hidden stays in the form, so build the request from what the pick uses, not from everything (`activityBody`).

One file per field type under `fields/`. Every spec has `name`, `type`, `label`, and optionally
`description`, `placeholder`, `required`, `disabled`, `span: 'half'`, `defaultValue` — and, in a registry entry,
`lockedOnEdit` (editable on a new record, read-only once saved) and `capability` (shown only to a user holding it — a
technician's labour rate, the rate library's overhead %). Since Phase L2 a spec may also say:

- **`adapt(values)`** — the spec follows the form's values: it returns overrides (`{ disabled: true, description }`,
  `{ required: true }`), `{ hidden: true }` to leave the field out, or nothing. The rate library's Rate is read-only
  "Set from the recipe when you save." while the rate comes from the recipe. A hidden field keeps its value
  (`FieldRenderer.jsx#AdaptiveFieldCell`, which is the only cell that watches every value).
- **`nullable: true`** — an emptied value is **sent as null**, which is how the API clears a column (a material's pack size,
  a rate's overhead % back to the setting). Without it an empty value is left out, and an update keeps the old one.

`number` keeps what was typed, as `money` does: react-hook-form reports a field's starting value while it is `undefined`,
so a cleared input would otherwise show the saved number again.

| `type` | Value | Extra spec |
|---|---|---|
| `text` / `textarea` | string | `inputType`, `maxLength`, `rows`; a textarea's `lang: 'ne'` gives Nepali text the Devanagari face (the terms library's Nepali body) |
| `prose` (alias `markdown`) | plain text, blank line between paragraphs — **not** markdown, because the site renders `ProseBody` | `rows` |
| `number` | number | `min`, `max`, `step` |
| `money` | **rupees** (typed with grouping, `1,23,45,678.90`); the record's paisa converted on load | — |
| `switch` | boolean — a setting that is on or off | — |
| `checkbox` | boolean — a statement ticked on purpose (Phase L4: "I approve it below the minimum margin"); a schema's `refine(v => v)` makes it required | `tone: 'warning'` |
| `select` / `enum` | string; optional fields get "None" | `options` (values or `{ value, label }` — a plain value is title-cased, so pass `{ value, label }` for units and codes; a label may be JSX, as the icon picker's are), `noneLabel` |
| `relation` | id, or null to unlink | `relation: { path, labelKey?, valueKey?, params? }` |
| `date` | UTC ISO of the start of that day in Kathmandu | — |
| `datetime` | UTC ISO; shown and typed in Kathmandu time | `defaultTime` |
| `slug` | string; follows `source` on a new record until edited; a saved slug never moves on its own | `source`, `prefix` |
| `stringList` | `string[]`; blank lines dropped | `addLabel`, `maxItems` |
| `keyValue` | `{ [key]: string }` | `keyLabel`, `valueLabel`; or `keys` (fixed rows, e.g. `['label', 'url']`) with `keyLabels`, `placeholders` — the value then always has every key |
| `media` | media id | — |
| `photoUpload` | media id — **one photo uploaded to the form's own endpoint** (Phase I: an expense's bill, `POST /admin/expenses/bill`), for a role with no `media:read`; no MediaPicker. Choose or take a photo (`helpers/compressImage` shrinks it first), the answer's media object shows as the thumbnail, Replace / Remove; a saved record's picture is read from its `savedFrom` key; a failed upload says why under the field. Give it `nullable: true` so Remove clears the column | `upload` (the endpoint: multipart `files`, answered with `{ id, url, thumb }` — `mediaApi#uploadPhotoTo`), `savedFrom`, `addLabel` |
| `mediaList` | ordered media ids; drag or move buttons | `maxItems`, `addLabel` |
| `weekdays` | sorted day numbers, 0 = Sunday … 6 = Saturday | — |
| `checklist` | `string[]` — several values ticked from `options: [{ value, label, description?, disabled? }]`, kept in the options' order; a ticked value no longer listed stays, named by `unknownLabel(value)` (the technicians on a job) | `options`, `emptyText`, `unknownLabel` |
| `lineItems` | a quotation's **bill of quantities** (Phase L3, on EditableGrid): ITEM / SECTION / NOTE rows — description (a section's title, a note's text), unit, qty (typed, or measured: a ruler and the sheet's quantity), waste %, rate in **rupees**, amount, optional. The record's rows (paisa) come in through `helpers/boq.js#toBoqRows` with a client `_key`; the schema (`quotation.schema#boqRowsSchema`) sends `boqRowBody` rows and never a cost. **Every amount, section subtotal and measured quantity is the server's** — `figures`, a Map of row key → the saved rows' or the live preview's figures (`stale` dims them while a newer preview is on its way). `/` searches the rate library, Excel paste adds rows, and a row's actions open its **measurement sheet** (Ctrl+M — a `measurements` form in a sheet), its frozen **recipe** (read-only; quantities per the recipe and for this row; cost only for `costCapability`) and its **details** (specification, kind, optional, provisional). The drawers are their own forms, and their events are stopped before the builder's form | `figures`, `stale`, `costCapability`, `gridLabel`, `search` (false to switch the library off), `maxItems` (500), `signedQty` (Phase L7 — a variation's BOQ: the Qty cell takes a negative quantity, an omission, written "−12"; amounts and subtotals below zero read "− Rs. …") |
| `grid` | an array of small objects edited as a spreadsheet — the generic EditableGrid field; a completely blank row is dropped | `columns` (EditableGrid column specs, a module constant), `makeRow`, `maxItems`, `addLabel`, `emptyText`, `footer(rows)` |
| `measurements` | a measurement sheet: rows of area, description, nos, L, B, H and deduct. Lengths take **feet-inches** (`12'6"` → 12.5, `12'` → 12, `6"` → 0.5 — `helpers/measurements#parseLength`) and show as the number they were read as; each row's value (nos × L × B × H over the dimensions it has, negative for a deduction) and the sheet's total are a **preview** — the saved quantity is the server's. Sent as numbers, blank rows dropped (`measurementSheetSchema`) | `unit` (named in the total), `keptBy` (Phase L8 — what keeps the server's figure, in the footer: "job line"; default "quotation") |
| `recipe` | a rate-library recipe (Phase L2; on EditableGrid since L3): the API's `components` — one row per line: **What** (a material from `materials.path` or a trade from `trades.path` in a record picker that opens on Enter — or the words, for equipment and other), Kind, quantity (the material's own unit, man-days), unit, wastage % (materials), cost per unit in **rupees** (equipment and other; the column only for `costCapability`). "Add material / labour / equipment or other cost" put a line at the end of its section and select it; Ctrl+Enter adds one below. A line names its material or trade from the record it carries (`RecordCombobox selectedLabel`), so a reader who may not list materials sees names, and "Bought as bag = 50 kg" under a material with a pack. `helpers/recipe.js` converts both ways | `materials`, `trades` (`{ path, params }`), `costCapability`, `per: { qty, unit }` (the "Quantities below make 10 sq.m" line) |
| `paymentSchedule` | a quotation's **payment schedule** (Phase L4, on EditableGrid): one row per stage — label, **share in %**, when it falls due (`PAYMENT_TRIGGER_LABELS`: on acceptance / at a milestone / on completion) — and an Amount column that shows only the server's figure (`figures`, matched by position; "—" when there is none). Presets **50 · 40 · 10**, **40 · 30 · 20 · 10** and **100 on completion** above the grid (`PAYMENT_SCHEDULE_PRESETS`; the matching one is pressed), a live "Adds up to 100%." / "90% — 10% short" line under it. The record's stages (basis points) come in through `helpers/paymentSchedule#toStageRows`; `quotation.schema#paymentScheduleSchema` refuses what the API refuses (not exactly 100 %, two advances, 0.01–100 %, two decimals, a stage unnamed, 1–10 stages) and sends `{ label, basisPoints, trigger }`; no stages sends nothing (the API keeps its schedule). **Never a money sum** — shares only | `figures`, `stale`, `maxItems` (10) |
| `preview` | **no value** — a panel worked out from the form's values; never loaded or sent (`DISPLAY_TYPES` in `formValues.js`), and the registry test does not look for it in the schema. `component` renders inside the form and reads the values with `useWatch()`. The rate library's Cost vs rate card, behind `capability: 'costs:read'` | `component` |
| `objectList` | an array of small objects, one row each (move up/down, remove); a completely empty row is dropped on save — give the schema a `z.preprocess` that drops blank rows too, since validation runs first | `itemFields: [{ name, label, type?: 'text' \| 'select', options?, placeholder?, maxLength?, className? }]`, `itemLabel`, `addLabel`, `maxItems` |
| `group` | collapsible section (e.g. SEO); opens itself on an error inside. `variant: 'card'` is an always-open titled card (the settings page) | `fields`, `defaultOpen`, `variant` |

### The rest of the kit

- **`common/LocaleTabs.jsx`** — `<LocaleTabs model recordId fields sourceValues>{English form}</LocaleTabs>`.
  The Nepali tab edits the `ne` translations of `fields` through `GET/PUT /admin/translations`
  (`api/translationsApi.js`), shows the English copy under each field, and saves on its own button. It is
  disabled until the record has an id. Both panels stay mounted; the Nepali one is `lang="ne"`, which gives it
  the Devanagari font stack. `extraTabs` (`[{ value, label, content, disabled }]`) adds panels after the languages —
  a project's Gallery; with no translatable `fields` there is no Nepali tab and the first tab reads "Details".
- **`common/MediaPicker/MediaPicker.jsx`** — `<MediaPicker open onOpenChange multiple selected onSelect(ids, rows)>`.
  Library tab: search, folder filter, 24 per page. Upload tab (`media:write` only): alt text is required per
  picture, one file per request; a finished upload is selected. `MediaThumb` shows the stored blurhash, then the
  400px variant. `MediaGrid` / `MediaPager` are the grid and pager the picker and the library screen share;
  `MediaUpload` also takes `incoming` (files dropped elsewhere on a page). Endpoints in `api/mediaApi.js`.
- **Overlays and toasts** — `ui/sheet.jsx` and `ui/dialog.jsx` ignore a press on a toast (`helpers/overlay.js`,
  `[data-toaster]` on the Toaster). Toasts sit bottom-right, over a sheet's Save button, and pressing one must not
  close the form underneath.
- **`common/ConfirmDialog.jsx` + `hooks/useConfirm.jsx`** — `const [confirm, confirmDialog] = useConfirm()`,
  then `await confirm({ title, description, confirmLabel, destructive })` → true / false. The caller renders
  `confirmDialog`; there is deliberately no app-wide provider, so alert-dialog stays out of the marketing bundle.
  `description` may be a block (the reprice preview's table) — it is then rendered in a `div`, not the description's `p`.
- **`common/RecordCombobox.jsx`** — picks one record from an admin list endpoint, searching `?q=` on the server.
  The relation filter and the relation field are both this. `api/lookupApi.js` holds its two resource-agnostic
  queries (`searchRecords`, `getRecord`). `fixedOptions` adds choices that are not records (listed first, never looked up).
  `selectedLabel` names the current value when the caller already has it, so it is not looked up (a recipe line).
- **`common/FormDialog.jsx`** — a short `<ResourceForm>` in a dialog (a reason, an owner): Cancel and a save close it,
  and it never holds the page's leave-guard. The lost-reason and assign dialogs are this.
- **`common/RecordHistory.jsx`** — `<RecordHistory endpoint="/admin/leads/:id/history" />`: a record's History tab.
  Newest first, one line per step — the event's words (`config/auditEvents.js`), a detail line, who (name · role, or
  "Customer (website or link)" / "System") and when (Kathmandu time), and "Show details" for the before/after table.
  `helpers/history.js#foldHistory` folds a request's plain row writes into that request's named event, so a status change
  reads once. Pages with the API's own paging. It takes any endpoint the API gives a history scope
  (`services/history.service.js`) — since Phase G, any model (the API's `routes/admin/historyRoute.js`); every
  registry edit page carries it automatically. Every detail page carries one (ADMIN-PLAN §7).

## The resource registry

### Which screen is which (final, Phase D2)

Every CMS resource the API mounts has a screen. `cms` means `cms:read` to open and `cms:write` to change.

| Resource | Screen | Address · capability (read / write) | Nav group | Public page it feeds |
|---|---|---|---|---|
| Home page | **bespoke** `pages/admin/HomeComposerPage` | `/admin/content/home` · cms | Content | `/` section order and visibility |
| Hero slides | registry `hero-slides` | `/admin/content/hero-slides` · cms | Content | home hero (the first active slide's words) |
| Services | registry `services` | `/admin/content/services` · cms | Content | `/services`, `/services/:slug`, home, `/pricing`, estimator |
| Service categories | registry `service-categories` | `/admin/content/service-categories` · cms | Content | header rail, home tiles, `/services` filter |
| Projects | registry `projects` + its **Gallery tab** (`tabs`) | `/admin/content/projects` · cms | Content | `/projects`, `/projects/:slug`, home "Recent work", a service page's related work |
| Offers | registry `offers` | `/admin/content/offers` · cms | Content | home "Current offers" (while live) |
| Pricing plans | registry `pricing-plans` | `/admin/content/pricing-plans` · cms | Content | home packages, `/pricing`, estimator |
| Testimonials | registry `testimonials`, Approve row action | `/admin/content/testimonials` · cms; approving needs `testimonials:moderate` | Content | home reviews (approved only), JSON-LD |
| FAQs | registry `faqs` | `/admin/content/faqs` · cms | Content | service pages |
| Gallery | registry `gallery` | `/admin/content/gallery` · cms | Content | home "From the field" |
| Media library | **bespoke** `pages/admin/MediaLibraryPage` | `/admin/content/media` · cms:read to open, media:write to change | Content | every image |
| Features | registry `features` | `/admin/content/features` · cms | Page blocks | home promises, construction, steel buildings, kitchens |
| List items | registry `list-items` (`reorderWithin: 'group'`) | `/admin/content/list-items` · cms | Page blocks | home renovation reasons, kitchen steps, seepage signs |
| Content blocks | registry `content-blocks` (key `lockedOnEdit`) | `/admin/content/content-blocks` · cms | Page blocks | home seepage and interiors bands |
| Process steps | registry `process-steps` | `/admin/content/process-steps` · cms | Page blocks | home "How it works" |
| Posts | registry `posts` | `/admin/content/posts` · cms | Blog & pages | `/blog`, `/blog/:slug`, the Blog nav item |
| Post categories | registry `post-categories` | `/admin/content/post-categories` · cms | Blog & pages | `/blog` category filter |
| Pages | registry `pages` | `/admin/content/pages` · cms | Blog & pages | `/:slug` (e.g. `/about`), CMS button links |
| Rate library (the rate card until L2) | registry `rate-card`, own `basePath`; the `recipe` field, a `preview` cost card, `bulkActions` "Update to derived rate", cost columns behind `costs:read` | `/admin/rate-card` · rates:read / rates:write; History rates:read (the API masks cost in it) | Catalog | quotation lines, survey pricing, `/pricing` rate table |
| Trades & wages | registry `trades`, own `basePath`; the day wage behind `costs:read` | `/admin/trades` · rates:read / rates:write | Catalog | — (a recipe's labour) |
| Terms library | registry `quotation-terms` (Phase L4), own `basePath`; the English body and the Nepali `bodyNe` as two textareas (a column of its own, not a translation — so no LocaleTabs); **Default** moves the flag (the API's rule) | `/admin/quotation-terms` · rates:read / rates:write (the API also lets `quotations:read` list it); History rates:read | Catalog | — (a new quotation starts with the default's text; the builder's terms picker) |
| Technicians | registry `technicians`, own `basePath`, switch = **availability** (`activeField: 'isAvailable'`) | `/admin/technicians` · technicians:read / technicians:write; the rate field and the History tab need technicians:write | Operations | — |
| Job templates | registry `job-templates`, own `basePath`; steps as an `objectList` | `/admin/job-templates` · jobs:read / jobs:write | Operations | — (a new job copies the steps) |
| Inspection templates | registry `inspection-templates` (Phase L5), own `basePath`; the questions as a `grid` field (rows in the API's shape, columns with `get`/`set`); Reorder matters — a survey uses its service's first active template, else the first general one | `/admin/inspection-templates` · surveys:read / surveys:write (SALES, MANAGER; DISPATCHER reads); History surveys:read | Operations | — (the field stepper's checklist; the review page names readings by it) |
| Materials | registry `materials`, own `basePath`; pack size and name (`nullable`) since L2 | `/admin/materials` · materials:read / materials:write (the API also lets `rates:write` list and read them, for the recipe picker) | Operations | — (stock is the Stock page; a recipe's materials) |
| Material categories, Suppliers | registry `material-categories`, `suppliers`, own `basePath` | `/admin/material-categories`, `/admin/suppliers` · materials | Operations | — |
| Purchase lists | registry `purchase-lists` (Phase L7), own `basePath`; the items as a `grid` field (a material picked in a record picker, quantity, packs, note, received); no switch, no reorder; **`useRecordActions`** Mark ordered · Receive into stock… · Cancel list…, **`readOnlyReason`** past DRAFT, **`deletable`** a draft only | `/admin/purchase-lists` · materials:read / materials:write; History materials:read | Operations | — (receiving raises stock; a job's Materials / Labour tab drafts one from its shortfall) |
| Site settings | **bespoke** `pages/admin/SettingsPage` | `/admin/platform/settings` · settings:read to open; saving is ADMIN's (`settings:write`) | Platform | header, footer, contact, hero badges and counters, booking calendar, SEO defaults |

Why three are bespoke: the **home composer** edits a fixed set of 19 sections with no create or delete, saved
together in one `PUT /admin/home-sections` — a draft with Save / Discard, not a list of records. The **media
library** is a grid of files with folders, drag-and-drop upload and a details sheet, not rows and a form. Both
are listed in `BESPOKE_CONTENT` in `adminNav.js`, and the registry test checks they have no entry. Their static
routes outrank `/admin/content/:resource`. **Site settings** are a fixed set of keys saved together, not records:
`config/admin/settingsForm.js` builds a `ResourceForm` from the rows (one `variant: 'card'` group per `Setting.group`,
the input from the row's `type` and a few per-key rules — phones, emails, https links, number ranges, weekday
checkboxes, badge and counter rows) and `changes(body)` gives the PATCH body: only keys whose stored value would
change, compared with sorted object keys (jsonb reorders them). Setting keys contain dots, which react-hook-form reads
as nesting, so a field is named with `__` (`fieldNameOf`).

A project's **Gallery** is not a form field: each add, move and remove saves at once through
`POST/PATCH/DELETE /admin/projects/:id/images…`, so it is a tab beside the form (`tabs`), open once the project is saved.

### How a registry screen works

A CMS resource screen is **a config file, not a page**. `config/admin/resources/<resource>.jsx` describes the
resource; `config/admin/resourceRegistry.js` lists the entries; two generic pages render any of them:

| Route | Page | Does |
|---|---|---|
| `/admin/content` | `routes/AdminLanding` → `ContentHome` | redirects to the first built Content item the role can open |
| `/admin/content/:resource` | `pages/admin/ResourceListPage.jsx` | CustomTable: the entry's columns + an **On site** switch, its filters, search, Edit / View on site / Hide·Show / Delete, bulk Delete, Reorder (when `sortable`), Trash with Restore (and Delete forever for `cms:purge`) |
| `/admin/content/:resource/new`, `/:id` | `pages/admin/ResourceEditPage.jsx` | ResourceForm with the entry's fields and schema, inside LocaleTabs when `translatable` is set; View on site and Delete in the header. A created record opens its own edit page, where the Nepali tab is enabled |

The routes sit under `RequireAuth capability="cms:read"`. Each page also checks the entry's own `capability`
through `hooks/useResourceEntry.js` (`{ status: 'ok' | 'unknown' | 'forbidden', entry, canWrite }`); an unknown
resource renders `NotFoundPage`. The route table never imports the registry — only these lazy pages do, which
keeps every entry's columns, fields and schema out of the marketing bundle.

An entry holds:

| Key | |
|---|---|
| `resource` | the URL segment, the API segment (`/admin/<resource>`) and the Cms tag id |
| `path` | the API collection path, always `/admin/<resource>` (the registry test checks it is mounted in the API's `cms.routes.js`) |
| `model` | the Prisma client model name for `/admin/translations` — `faq`, `processStep` — the name the public site's `withLocale` reads |
| `label`, `labelPlural`, `description` | copy for titles, buttons, toasts and confirmations |
| `capability`, `writeCapability` | to see the screens (`cms:read`); to change anything (default `cms:write`) |
| `columns`, `filters` | CustomTable columns and filters (the On site column is added by the page). A column's `capability` shows it only to its holders (the rate library's Cost and Margin, a trade's Day wage — `costs:read`) |
| `fields`, `schema`, `defaultValues` | ResourceForm fields, the zod schema from `form/schemas/cms.schema.js`, and a new record in API shape. `schema` may be a function of `{ pageSlugs }` when a rule needs the live site — a CMS link may point at a live page (`linkIssue`). Read it through `schemaOf(entry, ctx)`; the edit page passes the pages from `useSiteSettings` |
| `sortable` | offers Reorder. `false` when the site orders by another column (process steps order by `stepNo`) |
| `translatable` | field names edited on the Nepali tab (text fields only) |
| `titleOf(record)`, `publicHref(record)` | names a record; where it shows on the site, or `null` when it shows nowhere |
| `searchPlaceholder`, `emptyTitle`, `emptyDescription` | list copy |
| `basePath` | the screen's own address when it is not content (`/admin/rate-card`). It needs fixed routes in `AppRoutes` that pass `resource` to the generic pages, is unknown under `/admin/content/…`, and has its nav item in its own group. `screenPathOf(entry)` answers either way |
| `notice` | a standing note above the list — what else reads this data |
| `activeCopy` | words for `isActive` when it does not mean "on the website" (the rate card: **In use** / Retire). `activeCopyOf(entry)` fills in the defaults |
| `defaultSort` | the list's first order when it is not the manual one (posts: `-publishedAt`) |
| `reorderWithin`, `reorderHint` | Reorder only while that filter is set, and the reason shown beside the disabled button (list items: positions are per list) |
| `intro(record)` | read-only facts above an existing record's form (a project's source job number) |
| `tabs` | `[{ value, label, component }]` — panels beside the form on an existing record, rendered with `{ record, canWrite }` (a project's Gallery). Disabled on a new record |
| `historyCapability` | who sees the edit page's **History** tab (default `capability`; the rate card's is `quotations:history`). Every saved record gets the tab — `RecordHistory` on `<path>/:id/history`, which the API's CRUD factory mounts. `historyCapabilityOf(entry)` answers |
| `activeField` | the boolean the list's switch and Hide/Show act on (default `isActive`) — the API's `toggle` flips the same column. Technicians use `isAvailable` with their own `activeCopy`. `activeFieldOf(entry)` answers |
| `bulkActions` | extra actions on the selected rows: `[{ label, icon?, capability?, run(rows, { dispatch, confirm }) }]`. `run` may ask first and resolves the toast (`{ title, description?, variant? }`), or null when the answer was no; a rejection toasts the API's message. Not offered in Trash. The rate library's "Update to derived rate" is one |
| `useRecordActions` | (Phase L7) a **hook** — `() => [actionsFor(record), dialogs]` — for a record with moves of its own (a purchase list's Mark ordered · Receive · Cancel): `actionsFor` answers `[{ key, label, icon?, primary?, destructive?, disabledReason?, onSelect }]` for the record's state; the list offers them in a row's menu, the edit page as header buttons (a disabled one's reason under them); the pages render `dialogs`. The entry is fixed per mounted page, so the hook is always the same one |
| `readOnlyReason(record)` | (Phase L7) why a saved record's form is read only in its state — the edit page shows it above a read-only form (a purchase list past DRAFT); null when it can be edited |
| `deletable(record)` | (Phase L7) whether Delete is offered for a record, on the list's row menu and the edit page (a purchase list only as a draft); default every record |
| `rowActions(row)` | extra list actions: `[{ label, icon?, capability?, endpoint, arg, done }]` — `endpoint` is a `cmsApi` mutation (`approveTestimonial`), dispatched with `arg`; `done` is the success toast. Hidden without `capability`. The registry test checks each endpoint exists |

A role with `capability` but not `writeCapability` (SALES and ACCOUNTANT on the rate library) sees the list with disabled
switches and no New, and the edit page read-only (`ResourceForm readOnly`); `…/new` sends it back to the list.

Icons are picked, not typed: `resources/iconOptions.jsx` offers exactly `DataIcon`'s `ICON_NAMES`, each drawn.

### Worked example: adding a resource

`process-steps` was the second entry, added in one sitting with no page code:

1. **The schema** — make sure `form/schemas/cms.schema.js` has the resource's schema, mirroring the API's
   `shared/schemas/cms.js` (every CMS schema is already mirrored there).
2. **The entry** — `config/admin/resources/processSteps.jsx`:

   ```jsx
   export const processSteps = {
     resource: 'process-steps', path: '/admin/process-steps', model: 'processStep',
     label: 'Process step', labelPlural: 'Process steps',
     capability: 'cms:read', writeCapability: 'cms:write',
     schema: processStepSchema,
     sortable: false,                      // the site orders by stepNo
     translatable: ['title', 'description'],
     titleOf: (r) => r.title,
     publicHref: () => '/',
     columns: [{ key: 'stepNo', header: 'Step', sortable: true, cell: (r) => … }, …],
     fields: [
       { name: 'stepNo', type: 'number', label: 'Step number', required: true, min: 1, max: 50, span: 'half' },
       { name: 'title', type: 'text', label: 'Title', required: true },
       …
     ],
     defaultValues: { isActive: true },
   };
   ```
3. **Register it** — add it to the array in `config/admin/resourceRegistry.js`.
4. **Give it a nav item** — `{ to: '/admin/content/process-steps', label: 'Process steps', icon, capability: 'cms:read' }`
   in the Content group of `config/admin/adminNav.js` (or turn a `soon` item into a built one).
5. `npm test` — `resourceRegistry.test.js` fails until the path is mounted in the API, every field is in the schema,
   every translatable field is a text field, the nav item and the entry agree on the capability, a filter's
   `defaultValue` is one of its options, `reorderWithin` names a filter, and every `rowActions` endpoint is a `cmsApi`
   mutation. The test reads the resources the API mounts through `mountResource` in `cms.routes.js` and
   `ops.routes.js` (Phase H1; the mounter is `routes/admin/mountResource.js`), `crm.routes.js` (Phase L2: the rate
   library and trades) and `surveys.routes.js` (Phase L5: inspection templates). Nothing is mounted by hand any more. Every field and column `capability` must be a real one, a
   `preview` field has a `component` and is not in the schema, and every `bulkActions` entry has a `run`.
6. When another screen reads the same data through its own endpoint, add its tag to `ALSO_READ_AS` in
   `api/cmsApi.js` (the rate card also invalidates the quotation builder's `RateCard` list; materials and trades refresh
   the rate library's out-of-date flags).

Check before step 2 how the **public site** reads the model: its order column (`sortable`), where a record shows
(`publicHref`), and whether the public query overlays translations (`withLocale`) — a Nepali tab the site never
reads is a trap for an editor.

## Quotations (Phase F2)

| Route | Page | Does |
|---|---|---|
| `/admin/quotations` | `QuotationsPage` | CustomTable under the API's `?stage=` tabs — Drafts · Needs approval · Ready to send · With customer · Customer asked for changes · Won · Declined/Expired · All. An approver opens on **Needs approval**; the count on that tab is theirs (`countCapability`), everyone else sees the tab without a number. A row's menu offers exactly what its state allows |
| `/admin/quotations/:id` | `QuotationBuilderPage/` | one version: the form (a draft only), the action bar, the notices, the totals, the customer link and its messages, the trail, and the History tab |
| `/quotation/:token` | `pages/public/QuotationPublicPage/` | the customer's page: the document, then **Accept · Ask for changes · Decline** (L4: decline offers reason chips) |
| `/admin/quotations/:id/print` | `pages/admin/QuotationPrintPage` (Phase L4) | the document on an A4 sheet, no app chrome — see "Quotations — terms and the customer document (Phase L4)" |

- **`helpers/quotationActions.js`** is the single table of what may be done: `quotationActions(quotation, { can, userId })`
  returns `[{ key, label, primary?, note?, disabledReason? }]`, and `waitingFor()` is the line under the title.
  Self-approval (`quotation.makerChecker`, sent by the API on the record) disables Approve and says why. The list,
  the builder and their tests all read this, and a unit test holds every action to `QUOTATION_TRANSITIONS`.
  `validityWarning()` flags a quotation the customer can still answer within `EXPIRY_WARN_DAYS` of its date (or past
  it), and `sentAge()` is the "Sent 5 days ago" follow-up cue — the list and the builder's notices both show them.
- **`hooks/useQuotationActions.jsx`** runs one: `const [runAction, actionDialogs] = useQuotationActions()`. Send back
  and pull back ask for a note (`FormDialog`), approve takes an optional remark, sending, revising and converting
  confirm first, and a revision opens its new version. A refusal toasts the API's reason.
- The builder is `ResourceForm` with a **`lineItems`** field (see the kit table; a BOQ since Phase L3 — see "Quotations — the
  BOQ builder (Phase L3)") plus a card group for the terms.
  It is `readOnly` unless the quotation is a DRAFT and the reader holds `quotations:write`; `onDirtyChange` holds
  the action bar while there are unsaved edits, because those buttons act on the **saved** record.
- `sections/`: `QuotationActionBar` (buttons, with the reason a disabled one is disabled), `QuotationNotices` (the
  customer's change request, what a revision answers, a send-back reason, an automatic approval, the self-approval
  rule), `SendPanel` (the public link, Copy, Open, and each SMS/email with its delivery state) and `VersionSwitcher`.
- The customer's page keeps **every word in one object**, `quotationPageCopy.js` — since Phase L4 `{ en, ne }` with `pageCopy(locale)`, both complete (a test compares their keys) — and
  decides what to show with the pure `quotationPageState.js` (open · accepted · changes · declined · expired ·
  replaced · replacedPending · closed) — both beside the page, both unit-tested. Its three buttons each open one
  confirm step: Accept repeats the total, Ask for changes takes a message (5–1000 characters), Decline offers reason
  chips (L4) and an optional note. No login, no code, no typed name (D4). It is checked at 360px in the end-to-end run.
- `api/quotationsApi.js` has the queues (`getQuotations`, `getQuotationStageCount`), the record, the draft save and
  the moves (`submit · approve · sendBack · pullBack · send · revise · convertToJob`). Every move invalidates the
  quotation, the list, `Dashboard`, `History` and `Notification`.
- `config/constants.js` mirrors the API's `QUOTATION_STATUSES`, `QUOTATION_TRANSITIONS`, the stage tabs and the
  status labels (the office's words, not the enum's); `crmMirror.test.js` fails if any of them drift.

## Quotations — the BOQ builder (Phase L3)

A quotation is a **bill of quantities**: one ordered list of ITEM, SECTION and NOTE rows (L-D1…L-D4 in ADMIN-PLAN §4).
Numbering (A, A.1) and section subtotals are computed, never stored; optional rows are shown, never totalled; a row priced
from the rate library carries its recipe as frozen when first saved.

**The builder** (`pages/admin/QuotationBuilderPage/`) — tabs in the URL (`?tab=`; the old `?tab=quotation` opens BOQ):

| Tab | Shows |
|---|---|
| **BOQ** | the `lineItems` grid, the discount (one amount) with its **helpers** — "%" and "target total" (`sections/DiscountHelper`, a `preview` field) ask the server's preview for the discount and fill the field — and VAT. On a DRAFT, **Reprice from the library** (`sections/RepriceButton`): `apply: false` → the before/after in a confirmation → `apply: true`; held while the form has edits |
| **Take-off** | `sections/TakeoffTab` — the saved rows' materials in **buying units** (packs × pack label), stock on hand and the shortfall, equipment and other, and the rows without a recipe; a Cost column only for `costs:read` |
| **Labour** | `sections/LabourTab` — man-days per trade, and a **crew size** per trade that shows the duration (days ÷ crew — quantity maths only, `helpers/boq.js#crewDuration`) |
| **Payment & terms** | Phase L4: **Contract** (contract type with the sentence the customer reads, duration in days, exclusions), **Payment schedule** (a `paymentSchedule` field with the server's stage amounts) and **Terms** (valid until, the **terms picker** `sections/TermsPicker`, the terms, the internal note) — another panel of the **same form**: one Save, and the panel not shown keeps its edits (`hidden` groups; a refused save opens the panel with the first error — `FIELD_TAB`) |
| **Customer view** | the form's third panel since L4 — **What the customer sees**: `showMeasurements`, `summaryOnly` — and under it `sections/CustomerViewTab`: the saved quotation through `components/documents/QuotationDocument`, exactly as the link shows it (the two switches apply before a save), in English or नेपाली (starting in the customer's language) |
| **History** | `RecordHistory` (`quotations:history`) |

The right rail: **Totals** (`sections/TotalsCard` — the server's live preview while the BOQ has edits, dimmed and `aria-busy`
while a newer answer is on its way, the saved figures otherwise; section subtotals and the optional total under it),
**Margin** (`sections/MarginCard` — cost total and margin, **only for `costs:read`**; unknown, never guessed, while a row has
no cost), **Send** (`SendPanel`) and **Trail** (`sections/TrailCard`). The header (L4): **Print** (a new tab on the print route)
and **Excel** (the `.xlsx`).

- **`useBoqFigures`** (beside the page) is the one source of amounts, totals and margin: nothing edited → the saved
  quotation's; edits → `helpers/boq.js#previewRequest(values)` (rows that cannot be priced yet are left out and counted)
  debounced to `POST /admin/quotations/preview`, each answer matched back to its rows by key
  (`serverFiguresByKey`). **The client adds up no money** — no amount, subtotal, VAT, discount or margin.
- The action bar's Submit says why it is disabled when the draft has no row that counts toward the total.
- `helpers/boq.js` — `boqNumbers`, `toBoqRows` / `boqRowBody`, `blankBoqRow`, `duplicateBoqRow` (a copy has no id, so the
  server prices it fresh), `isBlankBoqRow`, `previewRequest`, `serverFiguresByKey`, `libraryRow` (`kindForCategory`:
  "Labour" → LABOUR, else SERVICE), `surveyQuotationRows`, `crewDuration`. `helpers/measurements.js` — `parseLength`
  (feet-inches), `measurementRowValue` / `measurementTotal` (the API's `measurementQty`, as a preview), `measurementsBody`,
  `formatQty`.
- Schemas (`form/schemas/quotation.schema.js`): `boqRowSchema` / `boqRowsSchema` (a blank row is allowed and dropped, so an
  error's index is the grid's row), `measurementSheetSchema`, `boqRowDetailsSchema`, `newQuotationSchema(ctx)`.

**The New quotation sheet** (`components/quotations/NewQuotationSheet`) — opened from the quotations list ("New quotation"),
a lead (its "New quotation" button, the outcome "Interested — quote without a visit" and a drop on Quoted, through
`useLeadFollowUp`) and a customer's page. **Blank** creates an empty draft for the customer and site (for a lead that is not a
customer yet, blank is L1's convert with a draft — "same person / different person" and the site); **From a survey** lists
the customer's submitted and in-review surveys and opens the one picked, whose review page builds it; **Copy** posts
`/copy` (rows with their recipes as frozen, terms, discount, VAT) for this customer. Without `onCreated` it opens the new
draft; the lead page shows a convert's result, or opens a draft made for an existing customer.

**Survey → quotation** — `SurveyPricingTable` sends every line (`surveyQuotationRows`): kind, rate-card item, material,
the surveyor's quantity (`rawQty` — the server adds the wastage), wastage %, the note as the row's spec, the rate (rupees);
a line left out of the total — an optional one, by default — becomes an **optional row**, no longer dropped. The server
groups them into sections. Its amounts and subtotal come from the preview.

**The customer's page** renders `QuotationDocument` in the site's language: sections as numbered headings, notes as text,
a specification under its row, optional rows "not included in the total", provisional ones marked.

Tests: `components/common/EditableGrid/*.test.*` (the keyboard map, type-to-overwrite, Tab adding a row, sections spanning,
duplicate / move / remove / undo, paste — Indian grouping, `Rs`, text rows → sections, header detection — the library `/`,
read-only, 500 rows, the kit rule), `helpers/measurements.test.js` (feet-inches), the L3 block of `ResourceForm.test.jsx`
(`measurements`, `grid`), `RateLibraryScreens.test.jsx` (the recipe on the grid), `pages/admin/QuotationBuilder.test.jsx`
(tabs, numbering and figures, the margin rail hidden for SALES and shown for MANAGER, the recipe drawer per role, take-off
and labour, Customer view, terms, `/`, keyboard sections and paste, the measurement drawer, the discount helper, reprice),
`QuotationScreens.test.jsx` (the builder's approval loop on the grid), `components/quotations/NewQuotationSheet.test.jsx`
(the three paths, and from a customer), `SurveyReviewPage.test.jsx`, the BOQ block of `QuotationPublicPage.test.jsx`
(sections, notes, optional; Nepali), and `e2e/boq-flow.spec.js`.

## Quotations — terms and the customer document (Phase L4)

What a contract needs around the BOQ (L-D2, L-D3, L-D4 in ADMIN-PLAN §4), and the customer's document on the link, in
print and in Excel. **The client computes no money**: stage amounts, totals, section subtotals, the words and the margin
are the server's; BS dates come from the server (`dates.*Bs`); no cost key ever reaches a customer-facing screen or the
print.

**The customer's document** — `components/documents/QuotationDocument`, rendered by `/quotation/:token`, the builder's
Customer view and the print route, in this order:

| Part | From the API | Component |
|---|---|---|
| Letterhead: logo, company, tagline, address, phones (call links), email, **PAN/VAT No.** | `letterhead` | `DocumentLetterhead` |
| Number, "For …", status (not in print), version, **Date** and **Valid until**, each AD with its BS twin — "26 Sept 2026 (2083-06-10 B.S.)" | `createdAt`, `validUntil`, `dates.createdAtBs`, `dates.validUntilBs` | `DocumentHeader` + `DocumentDates` |
| The BOQ — sections numbered with subtotals, notes, specs, optional rows "Optional — not included in the total" — or, with `summaryOnly`, the **section summary** | `items`, `boq.sections` | `LineItemsTable` / `SectionSummaryTable` |
| Totals, the optional total apart (not in a summary) | `subtotal`, `discount`, `vatAmount`, `total`, `boq.optionalTotal` | `TotalsList` |
| **Amount in words**, in the page's language | `totalInWords.en` / `.ne` | — |
| **How the final bill is worked out** (the contract type's sentence), **Estimated duration**, **Not included in this price** | `contractType`, `estimatedDays`, `exclusions` | `ContractTerms` |
| **Payment schedule**: stage, when it falls due, share, amount (incl. VAT), and the total | `paymentStages[]` (`total`, `vat`) | `PaymentScheduleTable` |
| Terms | `terms` | — |
| **Measurements annex** — each measured row's sheet (where, nos × L × B × H, deductions, the line's quantity — quantity maths only) and its quantity in the bill; collapsed on the page, open in print; never with `summaryOnly` or `showMeasurements: false` | `items[].measurements` | `MeasurementsAnnex` |

Every word is in `quotationDocumentCopy.js` (the document) and `pages/public/QuotationPublicPage/quotationPageCopy.js`
(the answers, the decline reasons) as `{ en, ne }`; `quotationPageState.test.js` holds the two languages to the same keys.
Numbers stay in Latin digits. Everything works at 360 px: tables scroll inside their own box (the test checks every table
sits in an `overflow-x-auto`; the end-to-end run checks the page never scrolls sideways) and the BOQ says so on a phone
("Swipe the table sideways…", the description kept at least 9rem wide), the schedule is three columns with the trigger under
the label (left out when the label already says it), the letterhead's email takes its own line, and `DocumentShell` keeps
~300 px for the sheet on a phone.

**Decline reasons** — the decline dialog offers chips (a single-choice `ToggleGroup`, optional; a second tap takes it back)
for `DECLINE_CATEGORIES` (`config/constants.js` — PRICE "Too expensive", COMPETITOR, POSTPONED, BUDGET, OWN_LABOUR, OTHER; a
friendly subset of `LOST_CATEGORIES`, mirror-tested), sent as the decision's `category`. The office sees it on the builder
("The customer declined — Price too high"), and the "Mark lost?" notification links to `?markLost=1&category=PRICE`, which
`LeadDetailPage` turns into `changeStatus(lead, 'LOST', { lostCategory })` — the dialog starts on it; a person confirms.

**The print route** — `/admin/quotations/:id/print` (`pages/admin/QuotationPrintPage`, lazy, `quotations:read`, outside the
admin shell): a toolbar (`print:hidden` — Back, English / नेपाली starting in the customer's language, **Print** →
`window.print()`) over an A4 sheet (`.print-sheet.theme-light`) with the document in its print layout (`print`: no status
badge, the annex open, figures with their symbol). `styles/globals.css` holds `@media print` (A4, margins, rows never split)
and **`.theme-light`** — the light palette re-declared on an element, so the sheet is paper even in dark mode. The tab's
title (`QT-… v2 — customer`) is what the print dialog suggests as a file name. **No cost, even for a manager** (a test renders
a manager's record, cost and all, and finds none of it). J2's PDFs render this route.

**The builder (Payment & terms, Customer view)** — see the tab table in Phase L3's section. The contract type's description
is the customer's own sentence (`documentCopy('en').contract`, through the field's `adapt`); the schedule's amounts come from
`useBoqFigures().stages` — the saved stages, or the preview's for the schedule on screen (`helpers/boq#previewRequest` sends
`paymentStages` only when `helpers/paymentSchedule#validScheduleBody` says it is whole; `stages` is null — "—" — until then).
The **terms picker** (`sections/TermsPicker`, a `preview` field) lists the library's entries in use: **Use these terms**
(replaces — asked first when the text differs), **Add below**, and for a customer whose language is Nepali **Use the Nepali
text** where an entry has one. The header's **Excel** downloads `export.xlsx` (the BOQ with live formulas, measurements, the
schedule; a Cost sheet only for `costs:read` — the API's rule) as `QT-….xlsx`.

**The send panel** (`sections/SendPanel`) — Copy, Open, **WhatsApp** (`helpers/contact#whatsappShareHref`: a chat with the
customer's mobile, else WhatsApp's picker) and **Viber** (`viberShareHref`: `viber://forward?text=`), both carrying a short
message with the link in the customer's language; and **"Opened 2×"** with "First opened …" in Kathmandu time (`viewCount`,
`firstViewedAt` — the public GET stamps them), or "Not opened yet".

**The margin gate** (L-D4) — `ApproveQuotationDialog`: the approver (`costs:read`) sees the margin (`helpers/quotationActions#
marginOf` — the record's `margin` / `costComplete` / `costTotal`, or L3's `boq.cost`); an unknown cost asks for the
acknowledgement (a `checkbox` field) up front; a known margin below `quotation.minMarginPct` is the API's to judge — its 422
`LOW_MARGIN` (`details: { marginPct, minMarginPct, costComplete }`) shows its message and brings the box up, and the approval
is sent again with `acknowledgeLowMargin: true`. The quotations list gains a **Margin** column (`costs:read` only — "10% ·
Rs. …", or "Unknown").

**Parts**: `helpers/paymentSchedule.js` (`parsePct`, `basisPointsOf`, `formatShare`, `toStageRows` — stable keys —,
`stageBody` / `scheduleBody`, `scheduleTotal`, `presetRows`, `matchingPreset`, `validScheduleBody`), `helpers/download.js`
(`arrayBufferToBase64`, `downloadBase64`, `saveBlob`), `helpers/contact.js` (the two share links), `config/constants.js`
(`CONTRACT_TYPES` / `_LABELS`, `PAYMENT_TRIGGERS` / `_LABELS`, `PAYMENT_SCHEDULE_PRESETS`, `DECLINE_CATEGORIES`),
`form/schemas/quotation.schema.js` (`paymentStageRowSchema`, `paymentScheduleSchema`, the contract fields on
`quotationFormSchema`, `approveQuotationSchema(acknowledge)`, `changeRequestSchema(messages)` / `declineSchema(messages)` —
the customer's messages in their language — and `quotationTermsSchema`), `config/auditEvents.js` (`export.xlsx` "Quotation
exported to Excel").

Tests: the Phase L4 block of `QuotationPublicPage.test.jsx` (en and ne at 360 px — letterhead, AD+BS dates, sections, optional
rows and total, words, contract, duration, exclusions, the schedule's amounts, the annex; `summaryOnly`; the decline chips
sending the category, in both languages), `quotationPageState.test.js` (en/ne parity, decline words),
`helpers/paymentSchedule.test.js`, the L4 block of `ResourceForm.test.jsx` (`paymentSchedule`: 100 %, presets, basis points,
server amounts; `checkbox`), the L4 block of `QuotationBuilder.test.jsx` (contract sentence, schedule amounts from the saved
record then the preview, a preset re-asking the preview, a schedule short of 100 % never sent and stopping the save,
duration and exclusions saved, the terms picker in English and Nepali, Customer view switches with no cost for a manager,
"Opened 2×", the share links, Print and Excel), the margin-gate block of `QuotationScreens.test.jsx` (LOW_MARGIN → the
acknowledgement → sent again; unknown cost up front; the Margin column for MANAGER and not for SALES; the decline reason),
`QuotationPrintPage.test.jsx` (no cost key, `window.print()`), the terms library in `RateLibraryScreens.test.jsx`, the
`&category=` block in `LeadFollowUp.test.jsx`, `crmMirror.test.js` (contract types, triggers, presets, decline categories,
`export.xlsx`), `adminNav.test.js` (Terms library), and `e2e/boq-flow.spec.js`.

## Platform (Phase G)

Every screen here is ADMIN only: the routes sit under `RequireAuth roles={['ADMIN']}`, the nav items need
capabilities only ADMIN's `*` holds (`users:admin`, `audit:read`, `messages:admin`), and the API refuses every other role.

| Route | Page | Does |
|---|---|---|
| `/admin/platform/users` | `UsersPage` | CustomTable: role, status, **Locked** badge, last sign-in; role and status filters; New user / Edit in `UserFormSheet` (name, email, phone, role, can sign in — a new person gets a 72-hour invite email); row actions Edit · Sessions · Send reset link (confirmed; the toast names the address) · Unlock (only when locked) · Activity (the audit log for that user) · Switch off / on · Remove. The admin's own row cannot be switched off or removed, and their own sheet locks role and status. `?open=<id>` opens a person's sheet |
| `/admin/platform/roles` | `RolesPage` | the role → capability matrix from `helpers/capabilityMatrix.js`, which reads `helpers/permissions.js` (held to the API's by the parity test), plus the ADMIN-only capabilities `*` stands for. A fixed matrix, so a plain table |
| `/admin/platform/login-activity` | `LoginActivityPage` | "Needs attention" (locked now, or failures in 24 h — each with Unlock), then every `auth.*` event: the account (or the address typed for an unknown one), the reason and attempt, ip, browser; filters account, event, ip, date; a row opens like an audit row |
| `/admin/platform/audit` | `AuditLogPage` | CustomTable over `GET /admin/audit-logs`: event (grouped by prefix, with "Every … event" = `prefix.*`), record type (`/audit-logs/models`), staff member, done by, record id, request id, date. A row expands into `AuditRowDetails`; "Show everything from this request" sets `requestId` and sorts oldest first. The record column links through `helpers/recordLinks.js` |
| `/admin/platform/messages` | `MessageLogsPage` | every SMS and email: masked address, template, status chip with the error, what it was about (linked), the body when expanded; **Send again** for a failure — disabled for a message whose one-time link was redacted |
| `/admin/platform/message-templates` | `MessageTemplatesPage` | one row per key (`/groups`): who gets it and when (`config/admin/messageKeys.js`), and a chip per version — in use, switched off, not written |
| `/admin/platform/message-templates/:key` | `MessageTemplateEditPage/` | tabs SMS · English, SMS · नेपाली, Email · English, Email · नेपाली; the open tab only is mounted (one leave-guard). `sections/VariantEditor` is a `ResourceForm` (subject for email, message, in use; a version not written is created on save; Delete) beside `sections/PreviewPanel`: placeholder chips (a press copies `{{name}}`; a Nepali version also shows the English one's), an input per placeholder prefilled from `SAMPLE_VARS`, the API's rendering of the **unsaved** text (debounced), the empty ones, and for SMS `components/common/SmsCounter` (moved there in Phase I, when the service reminders took it too). `new` is a form for any key |
| `/reset-password` | `pages/public/ResetPasswordPage/` | where a reset or invite link lands: choose a password twice (the API's rule, mirrored in `auth.schema.js`), then sign in. No token → "open the link from your email". It never sends links itself, and neither does the login screen |

- **`helpers/auditDiff.js`** — `diffEntries(before, after)`: one line per changed field, walking nested objects to
  the field that moved (`translations.name.en`) and arrays of objects by position; an array of plain values, a value
  replaced by an object, or an added object is one line. `DIFF_KIND_STYLES` are the marks.
- **`helpers/contact.js`** — `whatsappHref(phone)`: a `wa.me/977…` link for a Nepali mobile, null for a landline.
  Used by the SLA board and the customer page.
- **`helpers/sms.js`** — `smsSegments(text)`: GSM-7 (160 / 153 a part, extension characters count twice) or Unicode
  (70 / 67, astral characters twice); Devanagari is always Unicode. `nonGsm` says why.
- **`helpers/recordLinks.js`** — `recordHref(row)`: an audit or message row's page (lead, customer, quotation, survey,
  job, user, settings, any registry entry by its Prisma model); a child row (note, site, quotation line, project picture,
  a job's assignment, task, photo, material or time log, Nepali copy) links to its parent; since Phase I an invoice opens its page, and a payment or invoice line its invoice.
- **`config/admin/messageKeys.js`** — `MESSAGE_KEYS` (every key the API sends — a test scans its services),
  `SAMPLE_VARS`, `placeholdersIn` (the API's pattern — a test checks the source), `nestVars`, `TEMPLATE_VARIANTS`,
  `templateHref`.
- `config/auditEvents.js` also has `AUDIT_EVENT_GROUPS`, `auditEventOptions()` and `AUTH_EVENT_NAMES`;
  `config/constants.js` has `ROLE_DESCRIPTIONS`, `MESSAGE_CHANNELS`, `MESSAGE_STATUSES` (mirror-tested).
- Schemas: `form/schemas/user.schema.js` (no password), `messageTemplate.schema.js`, and `resetPasswordSchema` in
  `auth.schema.js`.
- Tests: `pages/admin/PlatformScreens.test.jsx` (every screen above, with Devanagari names, a Nepali SMS and a
  `+977` phone), the three helpers' tests, `capabilityMatrix.test.js`, `messageKeys.test.js`, and the History tab in
  `ResourcePages.test.jsx`.

## Operations (Phase H1)

| Route | Page | Does |
|---|---|---|
| `/admin/jobs` | `JobsPage` | CustomTable: number and title, customer (tap to call, area), status in the office's words (`JOB_STATUS_LABELS`) and priority, when, technicians. Filters status, type, priority, technician, customer, "Nobody on it", invoiced, scheduled dates; URL presets from `config/admin/jobViews.js` — Today, Unassigned, On hold, Completed not verified, Not invoiced; New job (`JobFormSheet`); a row's Schedule… / Assign… / Verify… |
| `/admin/jobs/:id` | `JobDetailPage/` | the action bar (a disabled action says why — one line per reason), since Phase L6 the "Awaiting advance" chip and the **advance card** above the tabs, and eight tabs (`?tab=`) — nine on a BOQ job, whose **Plan** tab follows Overview (see "Won → hand-off (Phase L6)"): **Overview** (customer and site with tap-to-call and Maps, where it came from — lead, quotation, survey, rework, case study — when and who, the work, Edit details), **Checklist** (tick, skip, add, edit, remove), **Photos** (grouped by kind; add from the library or upload under a chosen kind), **Materials** (issue from stock with quantity, billed rate and billable; reverse), **Time** (logs; the office adds time for a technician on the job; delete), **Costing** (`GET …/costing`: labour, materials at cost, expenses, total, invoiced, margin, and the lines each total is the sum of — **only for `costs:read`** since Phase L2: the tab is not there for anyone else, and `?tab=costing` falls back to Overview; since Phase L8 it opens with **quoted vs actual** cost, and Invoiced is the taxable amount billed), **Events** (JobStatusEvent, with a Maps link where the field app sent a location), **History** (`jobs:history`). Since Phase L7 also **BOQ & progress**, **Materials / Labour**, **Site diary** and **Variations** — see "Execution (Phase L7)" |
| `/admin/dispatch` | `DispatchBoardPage/` | technicians × the day's hours (08–18) or × seven days; date, Day/Week, who, skill and area in the URL; the unassigned queue (`/dispatch/unassigned`, paged, searchable) and "Assigned, no time yet" beside it |
| `/admin/stock` | `StockPage` | balances from movements, Low — reorder, value at cost; "Low stock only" filter and the header's low count; a row opens its movements (`StockMovementsSheet`, also `?open=<id>` — the low-stock notification's link); **Record movement** (purchase, return, adjustment with a sign, wastage) |
| `/admin/technicians`, `/admin/job-templates`, `/admin/materials`, `/admin/material-categories`, `/admin/suppliers` | registry entries | see "Which screen is which" |

- **`helpers/jobActions.js`** — `jobActions(job, { can })`: what a job's state allows, and why a button is disabled
  (Complete while `openTasks(job)` is not empty, "Mark on the way" with nobody on it); a unit test holds every move to
  `JOB_TRANSITIONS`. Also `jobWaitingFor(job)` (the line under the title) and `siteMapHref(site)`.
- **`hooks/useJobActions.jsx`** — `const [runAction, dialogs] = useJobActions({ onDeleted })`: schedule, assign and
  complete open their dialogs; hold and cancel ask why (required), reopen asks optionally; verify and delete confirm;
  "Publish case study" drafts the project (title, name the customer — off) and opens `/admin/content/projects/:id`.
  Status moves go through `PATCH /status`, `complete`, `verify`, `schedule` and `assign` only — never an edit.
- **`helpers/dispatchBoard.js`** — the board without a DOM: Kathmandu days (`ktmDay`, `addDaysTo`,
  `shiftBoardDate`), hour columns, `durationOf`, `windowAt`, **`dropWindow(job, { day, hour? })`** (an hour cell starts
  it there; a day cell keeps its time of day, or 10:00; the length is kept), **`dropTechnicians(job, lane, fromLane)`**
  (from the queue the lane's person leads and the rest stay; lane to lane swaps the person; within a lane nothing
  changes), `isSameDrop`, `jobsInCell` (early and late jobs sit in the first and last hour), and
  **`scheduleWarnings({ job, window, technicianIds, lanes, days })`** — overlaps, days past `dailyCapacity`,
  unavailable people, and `unchecked` for a day the board is not showing; `warningText(w)` words each one.
- **`hooks/useScheduleCommit.jsx`** — the one way a screen schedules: `const [commit, dialog] = useScheduleCommit({
  lanes, days })`, then `await commit(job, { scheduledStart, scheduledEnd, technicianIds })`. It asks "Schedule …
  anyway?" with the warnings **before** sending, and toasts any the API found that the board could not see.
- **The board** (`DispatchBoardPage/`): `DispatchGrid` (a `role="grid"`; each cell a dnd-kit droppable named
  "Hari KC, Fri 18 Sept, 10:00"; the lane header shows load against the daily limit, unavailable and clashes),
  `DispatchJobCard` (drag handle + **Schedule…**, the keyboard and screen-reader path; work under way is not
  draggable; "Clash" on overlapping cards; since Phase L5 an inspection's **visit flag** — `helpers/dispatchBoard#visitFlag`:
  "Wants another time" loud, on every card size, "Not confirmed" quiet, "Confirmed" a small tick) and `UnassignedQueue`. Pointer-within collision like the pipeline; the
  keyboard sensor still works; auto-scroll only at the very edges, so a job dragged in from the queue does not scroll
  the hours away. **Every drag has the dialog as its equivalent** — the rule for any board.
- `api/jobsApi.js` — jobs, their parts, schedule (`{ job, warnings }`), the board, the queue, costing, publish, and the
  technician picker (`getDispatchTechnicians`, never a rate). A move invalidates the job, the lists, `Dispatch`,
  `Dashboard`, `History` and `Notification`; issuing material also `Stock`; anything with a cost the job's
  `costing:<id>` tag. `api/stockApi.js` — stock, movements, record. Registry writes to materials and technicians
  invalidate `Stock` / `Dispatch` through `cmsApi`'s `ALSO_READ_AS`.
- Schemas: `form/schemas/job.schema.js` (create, details, schedule, assign, notes, complete, task, material, time
  log, case-study start) and `ops.schema.js` (technician, template, material, category, supplier, stock movement)
  mirror the API's `shared/schemas/ops.js`.
- `config/constants.js` has `JOB_TRANSITIONS`, `JOB_STATUS_LABELS`, `JOB_TYPE_LABELS`, `JOB_PHOTO_KINDS`,
  `STOCK_MOVEMENT_TYPES` / `_LABELS`, `MANUAL_STOCK_MOVEMENTS` (mirror-tested); `config/admin/jobViews.js` the presets,
  the customer / technician / template / material relations and `technicianOption`;
  `config/admin/resources/inUseCopy.js` the "In use / Retire" words the operations entries share.
- Links: the customer page's Jobs tab, audit rows (`Job` and its parts, technicians, materials) and the dashboard's
  job and `stockLow` cards now open these screens.
- Tests: `pages/admin/OperationsScreens.test.jsx` (jobs presets, job actions and tabs with Devanagari and rupees, the
  board's dialog path through the clash warning, stock and Record movement, technician availability and the hidden
  rate), `helpers/dispatchBoard.test.js`, `helpers/jobActions.test.js`, and `e2e/operations-flow.spec.js`.

## The field app (Phase H2)

The technician and surveyor PWA under `/tech`, built for a 360 px phone and gloved thumbs: every control is at least
44 px tall (most 48–56), one primary action per card, the next status pinned above the tab bar. **The money wall holds**:
nothing under `/tech` shows a price, a rate or a cost — the API strips them anyway (`fieldSafe`), and no tech screen has a
money field. Motion is the page transition only (it respects `prefers-reduced-motion`); long lists are not staggered.

| Route | Page | Does |
|---|---|---|
| `/tech` | `TechTodayPage` | today's jobs (polled every 2 min); a card's one next step — On my way / Start work / Resume work — is **queued** |
| `/tech/jobs/:id` | `TechJobPage/` | the job sheet: contact, checklist, time (start / stop, Hold with a reason), photos, materials used, finish up (note, 1–5 rating, signature, Complete). Read only once closed, or while its signature uploads |
| `/tech/history` | `TechHistoryPage` | the technician's jobs between two Kathmandu days (7 / 30 / 90 days, or From and To), newest first; the range is in the URL |
| `/tech/history/:id` | `TechJobPage` with `readOnly` | the same sheet with no controls; Back returns to the same range |
| `/tech/surveys` | `SurveyListPage` | the surveyor's surveys — to fill in first, then with the office — with the visit's day and window (en/ne since Phase L5) |
| `/tech/surveys/:id` | `SurveyFormPage/` | **the survey stepper** (Phase L5) — see "The site-visit kit (Phase L5)" |
| `/tech/jobs/:id/diary`, `/tech/jobs/:id/diary/:day` | `SiteDiaryPage/` | **the site diary** (Phase L7): the days filed and today; one Kathmandu day — see "Execution (Phase L7)" |
| `/tech/jobs/:id/measure` (`?line=`) | `JobMeasurePage/` | **the final measurement** (Phase L8): the job's lines and where each stands; one line's cards — see "Close-out & final bill (Phase L8)" |

`TechJobPage/` is a folder page: `TechJobPage.jsx` (fetch, the queue overlay, what each action queues) and `sections/`
— `JobHeader` (with `JobContactCard`), `DiaryLinkCard` (Phase L7 — the way into the site diary), `ChecklistSection`,
`TimerSection`, `PhotosSection`, `MaterialsSection`, `FinishSection` (with `CompletedSummary`) and `NextStepBar` (with `HoldSheet`) — and
Phase L8's `MeasureLinkCard` (a BOQ job's way into the final measurement).
`SiteDiaryPage/` (Phase L7) is the same shape: `SiteDiaryPage.jsx`, `siteDiary.js` and `sections/`.

### Offline: two queues, one engine

| Piece | File | What it is |
|---|---|---|
| Storage | `helpers/fieldDb.js` | one IndexedDB database (`gharjatan-field` v2): `mutations` (key `idempotencyKey`) and `uploads` (key `id`, the picture as a Blob). Falls back to memory where IndexedDB is missing (jsdom, a private window). `nextStamp()` gives every entry of either queue a `seq` and an `at`, both strictly increasing on the device |
| Mutation queue | `helpers/offlineQueue.js` | `enqueue` (dedupes by key), `pending` (oldest first), `flush(send)` → `/tech/sync`, `settle` (pure), `failureKind`, `toWire` (`meta`, `seq`, `attempts` never leave the phone) |
| Upload queue | `helpers/uploadQueue.js` | `addUpload`, `pendingUploads`, `drainUploads(send, { followUp })`, `describeUpload` (an entry without its bytes) |
| Engine | `hooks/useOfflineQueue.js` | `useOfflineQueue()` — mounted once by `TechLayout` — and `useFieldQueue()` for screens (`queueMutation`, `queueUpload`, `syncNow`); `syncFieldQueue(dispatch)` runs one sync at a time |
| Mirror | `redux/slices/fieldSyncSlice.js` | the queues without their bytes, `online`, `syncing`, `lastSyncedAt` and `notes` (what the office refused) — every screen reads the same list |
| Overlay | `helpers/fieldJob.js` | `applyPending(job, mutations)` — the job as it will be once the queue is sent; plus `NEXT_STATUS`, `HOLDABLE`, `openTasks`, `runningTimer`, `completionUpload`, and the history range helpers |
| Thumbnails | `helpers/sentPhotos.js` | the thumbnail address of each photo this phone sent (the field API lists photos by `mediaId` only) — localStorage, newest 150 |

**The rules.**

1. **Everything goes through the queue, online or not.** A tap enqueues; when there is signal the engine flushes at once.
   So online and offline take the same path, and the screen shows the change straight away from the queue (the
   overlay), not from a hand-patched cache. Kinds used — exactly the ones `/tech/sync` accepts: `status` (EN_ROUTE,
   IN_PROGRESS, ON_HOLD with its `note`), `task` (`{ isDone }`), `material` (`{ materialId, qty }` — never a rate),
   `time_start`, `time_stop`, `complete` (`{ note?, customerRating?, signatureMediaId? }`), and — since Phase L5 for
   **every** survey write, online or not — `survey_draft` (the whole survey, a full replace) and `survey_submit`; since Phase L7
   `diary_save` (a job's Kathmandu day, a full replace — `{ jobId, payload: { day, … } }`).
2. **Order is the order the technician acted in.** `at` and `seq` are strictly increasing (two taps in a millisecond, or a
   clock set back, cannot swap), the queue sends oldest first, and the server sorts a batch by `at`.
3. **Dedupe by idempotency key**: enqueueing a key already waiting is a no-op; the server answers a key it applied before
   `duplicate`, which is dropped like `applied`.
4. **A sync** (one at a time; a request mid-sync makes it go round once more): (1) flush the mutations, (2) drain the
   uploads oldest first, (3) flush again. It runs when the shell mounts, on the `online` event, when the app returns to
   the foreground, every 30 s while anything waits, and on "Sync now". After it, applied changes are written into the
   cached job and today's list (no flicker) and the touched jobs are invalidated, so the server's truth follows.
5. **Failures.** No answer (offline, a timeout, a 401 while the session renews, 408, 429) keeps everything, uncounted.
   `failed` with a terminal code (`INVALID_TRANSITION` — a replay the office overtook — `UNPROCESSABLE`, `NOT_FOUND`,
   `FORBIDDEN`, `BAD_REQUEST`, `CONFLICT`, `VALIDATION_ERROR`) is **dropped and becomes a note** in the header strip
   ("Not sent — the office refused it", with a link to the job) until dismissed. Any other `failed`, a 5xx, or a whole
   batch refused is retried, at most 5 attempts, then dropped with a note. Never retried for ever.
6. **Uploads** keep their order: the first one with no answer stops the drain. A 4xx drops that picture with a note; a
   5xx counts an attempt. Photos are append-only on the server, so they never conflict.
7. **Signature → complete.** The signature PNG is queued as a SIGNATURE upload carrying `then: { kind: 'complete', jobId,
   payload }`. `complete` is enqueued **only after the upload succeeded**, with `payload.signatureMediaId` = the new
   media's id — so it also replays after every change made before it (the ticks it depends on). `then.idempotencyKey` is
   fixed when the signature is queued, so a follow-up enqueued twice is still one completion. While it waits, the job
   shows "Completing — the signature is waiting to upload" and is read only. Without a signature ("The customer is not
   here to sign") `complete` is queued directly.
8. **A survey reading waits for its photo** (Phase L5). A checklist photo is an upload like any other; the reading names
   the queue entry (`photoUploadId`). `flush(send, { resolve })` asks `useOfflineQueue#resolveSurveyPhotos` to prepare each
   entry: a reading whose picture is on the server gets its `mediaId` (`sentPhotos#mediaIdForUpload` — the upload's answer
   is remembered before the queue forgets it), one whose picture was refused is sent without it (the office's submit check
   then names it), and one whose picture still waits **holds the entry — and every later entry for the same survey** — so
   a survey's submit never overtakes the save it follows. Step 2 uploads the picture and step 3 sends both. Other jobs and
   surveys are not held. `photoUploadId` never reaches the wire.
9. **A newer save replaces an older one** (a diary day's too, keyed on job + day) — `queueMutation(mutation, { supersede })` drops waiting entries the new one
   replaces (`offlineQueue#dropPending`): a survey's older `survey_draft` is worth nothing once a newer full save waits.
10. **What the office refused, with its reasons** — a failed result's `details` travel into the note (the API lists a
   `SURVEY_INCOMPLETE` submit's missing answers and photos); `INVALID_MUTATION` and `SURVEY_INCOMPLETE` are terminal.
   A note about a survey links to it (`?step=checklist` for SURVEY_INCOMPLETE).
11. **A diary day waits for its photos** (Phase L7) — the day's pictures are the job's DURING uploads; the save names them in
   `meta.photoUploadIds` (never sent) and `useOfflineQueue#resolveDiaryPhotos` adds each one's media id to `payload.photoMediaIds`
   once it is up, holds the day while one still waits, and leaves a refused one out. A diary day is a scope of its own
   (`offlineQueue#scopeOf` → `diary:<jobId>:<day>`), so it holds that day's later saves, never the job's status changes or
   ticks. `JOB_NOT_ON_SITE`, `UNKNOWN_LINE` and `UNKNOWN_TRADE` are terminal. An applied change may carry `warnings`
   (`settle` keeps them on the entry): a material over the job's plan (`OVER_PLAN`) is said as a warning toast in the
   technician's language (`fieldCopy.materials.overPlan`) — the API's `/tech/sync` answer for a `material` carries no `warnings`
   yet, so the field toast shows once it does (the office's issue dialog has it now).

The header (`TechLayout` → `SyncButton`) shows the pending count — changes plus photos — with Offline, Syncing… or
"Sync now"; the strip under it says what is kept on the phone while there is no signal.

**Limits, as built:** the access token lives in memory, so reloading the page with no signal signs the technician out —
the queue survives in IndexedDB and is sent after the next sign-in. The service worker (`public/sw.js`, production only)
caches the app shell (`/`, `/index.html`, the manifest) on install and every same-origin static file it serves
(cache-first), never an `/api/` answer; it was not changed in H2. Offline timers and statuses are stamped by the server
when they replay, not when they were tapped (`/tech/sync` ignores `at` beyond ordering).

### Photos, signature, materials, history

- **`helpers/compressImage.js`** — `compressImage(file, { maxEdge = 1600, quality = 0.8, type = 'image/jpeg' })`: decodes
  upright (`createImageBitmap` with `imageOrientation: 'from-image'`, an `<img>` otherwise), draws the longest edge at most
  1600 px — **never upscaled** — and re-encodes (WebP falls back to JPEG where the browser cannot encode it). The original
  is kept when it needs no resizing, is JPEG/PNG/WebP and is no bigger than the re-encoding; a HEIC is always re-encoded; a
  picture the browser cannot decode goes as it is. `fitWithin(w, h, maxEdge)` is the arithmetic.
- **`components/tech/SignaturePad.jsx` + `helpers/signature.js`** — strokes as points in the pad's CSS pixels; drawn in the
  theme's foreground on screen, exported by `signatureToPng` as black on white at 2× (the office and the warranty read it on
  white). `isSignatureLongEnough` wants ≥ 8 points and ≥ 60 px of ink — a tap is not a signature.
- **Materials** — `MaterialsSheet` searches the cached `/tech/materials` (kept 12 h, and loaded by the job page while there is
  signal, so it opens in a basement), then asks the quantity in the material's unit.
- **History** — `GET /tech/jobs?from&to` reads its days in the server's clock, so `historyQuery` asks for a day more on each
  side and `jobsInRange` keeps the jobs whose `scheduledStart` falls on a Kathmandu day inside the range.

### Words

The field app's words are in **`config/tech/fieldCopy.js`**, English and Nepali, read through `hooks/useFieldCopy()` (the
`uiSlice` locale) — the shell, today, the job sheet, history, and since Phase L5 the survey list and the whole survey
stepper (`survey.*`; a question's own Nepali is the template's `labelNe`). J1 moves them into its catalogues;
`fieldCopy.test.js` holds the two languages to the same keys.

Tests: `helpers/compressImage.test.js`, `offlineQueue.test.js` (order, dedupe, failures), `uploadQueue.test.js` (retry, in
order, signature → complete), `fieldJob.test.js` (overlay, history range), `signature.test.js`, `hooks/useOfflineQueue.test.js`
(the engine against a mocked API), `pages/tech/TechScreens.test.jsx` (completion blocked while items are open, the materials
sheet, status / hold / timer through the queue, read-only history, the history range, the header's count and notes),
`config/tech/fieldCopy.test.js`, and `e2e/field-flow.spec.js`.

## The site-visit kit (Phase L5)

A booked visit is something the customer confirms, and the surveyor has a guided, offline stepper; the office gets
sections and measurement rows it can turn straight into a BOQ. **Quantities only** on every `/tech` and public visit
screen — no rate, cost, total or margin (D1).

**Booking the visit** — `ScheduleVisitDialog` books a **window**, not a start hour: the slot picker (the bootstrap's
`booking.slots`) fills a From / Until pair in Nepal time — the slot's own hours, or two hours from its start — and both can
be moved; an end at or before the start is refused under Until and Book stays disabled. The form is
`useZodForm(lead.schema#visitBookingSchema)`; `visitBookingBody` builds `scheduledStart` / `scheduledEnd` at +05:45
(`fromKathmanduParts`) and adds the surveyor, the address and, only when filled, the **site contact** (`siteContactName`,
`siteContactPhone` — a Nepali mobile or landline, normalised; a number needs a name, as the API says) and a **landmark**
(≤200), stored on the visit's site. Under the fields an **SMS preview** shows what `visit_booked` will say — text only,
built in the browser from `components/leads/visitBookedCopy.js`, whose en / ne bodies mirror the seeded template (a test
reads `prisma/seed-data.js` to hold them equal) — in the language of the customer the convert lands on, with an en / ne
toggle, the surveyor's name and phone, the day and window as the API writes them (`3 Oct 2026, 10:00–12:00`), and
`…/visit/…` for the link; "Also sent to <contact> (<phone>)" when the site contact's number is not the customer's.
`ConvertLeadSheet` takes the same three fields (`convertSiteFields`, `convertSiteSchema`), and a customer's site form
(`siteFields`, `customerSiteSchema`) edits them as `contactName` / `contactPhone` / `landmark` — `nullable`, so emptying
one clears it; the Sites tab shows the landmark under the address and a Site contact column.

**The customer's visit page** — `/visit/:token` → `pages/public/VisitPublicPage/` (lazy, in the site shell, no login; the
link in the `visit_booked` and reminder SMS). `VisitPublicPage.jsx` fetches `getVisitByToken` and shows a skeleton,
`sections/VisitUnavailable` (404: "This link is not valid", with the company phone from `useSiteSettings`; a network error:
Try again) or the visit: `sections/VisitHeading` (company, "Your site visit", the reference), `sections/VisitDetails` (the
window in Kathmandu time via `visitWhen` — "Friday, 2 October 2026", "10:00–12:00", Latin digits in Nepali too — the
address, area and landmark, the surveyor with a `tel:` call button, or the office's phone when none is assigned yet) and
`sections/VisitAnswer`, which follows `visitPageState(visit)`: unanswered → two ≥56 px buttons, **Confirm** (one tap) and
**Need another time** (the inline `sections/RescheduleForm`: an optional note, 500 at most, with a count); answered → the
recorded state (confirmed, or "We will call you to find another time" with their note echoed) and **Change my answer**
while `canAnswer` (the latest answer wins); `cancelled` / `underway` / `done` / `closed` → no buttons, a call to the office.
A 422 `VISIT_CLOSED` forces the closed state and refetches. Every word is in `visitPageCopy.js` as `{ en, ne }`
(`visitPageState.test.js` holds the keys equal); the page follows the site's locale and, when the customer's
`preferredLocale` differs, offers a one-tap switch written in that language ("नेपालीमा पढ्नुहोस्"). The answer goes
through `form/schemas/visit.schema#visitResponseSchema` (the API's, mirror-tested).

**The dispatch board** flags an inspection that is not confirmed — see "Operations (Phase H1)" (`visitFlag`: "Wants
another time" loud on every card size, with the note and time in its title when the board sends them; "Not confirmed"
quiet; "Confirmed" a small tick).

**Inspection templates** — the registry entry `config/admin/resources/inspectionTemplates.jsx` (see "Which screen is
which"; nav Operations › Inspection templates). The questions editor is the generic **`grid`** field: each row is already
a question in the API's shape (`{ key, label, labelNe?, type, unit?, metric?, options?, flag?, required, photoRequired }`)
and the columns reach into it with `get` / `set` / `parse` / `toText` — Question, In Nepali, Key, Type, Unit, Metric,
Options, Flag above, Flag below, Flag when, Required, Needs photo. The key follows the words (`suggestQuestionKey`) until
someone types one; changing the type drops what the new type does not use, and a cell the type does not use is read-only
and shaded; options and a choice's flagged values are comma-separated text (`splitOptions`). `form/schemas/
inspectionTemplate.schema.js` holds the rules once (`questionIssues`, at the API's paths — a duplicate or bad key, a choice
with fewer than two options, a flag that does not fit its type or names an option the question does not offer), places
each message on its column and sends `questionBody`, exactly the API shape; its test runs the same cases through the API's
own schema. `config/constants.js` has `INSPECTION_QUESTION_TYPES` / `_LABELS`, `SURVEY_PHOTO_KINDS` and `VISIT_ANSWERS`
(mirror-tested), and `SKETCH` joined `JOB_PHOTO_KINDS`.

**The survey stepper** — `pages/tech/SurveyFormPage/` (the single-file form it replaced is gone). The step is in the URL
(`?step=`, and `&line=` for the line being measured), so Back and a reload land where the surveyor was; the step bar
(`sections/StepBar`) is one row of 48 px buttons that scrolls sideways on a phone, each with a tick or its count ("3/5").

| Step | File (`steps/`) | Does |
|---|---|---|
| Before you go | `BeforeYouGoStep` | the site (address, area, landmark, access, Open in Maps), who to meet (the customer and the caretaker, each with a call button), what the customer wrote, the photos they sent (`lead.photos`) |
| Arrived | `ArrivedStep` | `navigator.geolocation` → `sitePin: { lat, lng, accuracy }` in the next save (the site's pin); **asks before replacing** a pin the site already has; the accuracy shown, and "step outside" when it is worse than 50 m; the pin opens in Maps |
| Checklist | `ChecklistStep` | the survey's template (`survey.template` — the service's, else the general one): yes / no as two big toggles, a number with its unit, a choice as chips, words; an answer crossing its flag is highlighted at once (`helpers/inspection#predictFlag`, the server's rule) and the server's own `flagged` decides once it holds the same answer (`surveyForm#serverFlagFor`); a photo-required question takes its photo through the upload queue (its answer keeps `photoUploadId` until the engine links the `mediaId`); then "Other readings" |
| Measure | `MeasurementsStep` | pick the line (or start a new measured one), then rooms, **one card per row** — what, nos, L, B, H (feet-inches through `helpers/measurements#parseLength`, "= 12.5 ft" under the input, "Could not read this" when it does not), the deduction switch, the row's value; each room's total and the line's are previews, and the quantity the server derived shows once the sheet it holds is the one on the phone (`surveyForm#serverQtyFor`); a row that does not read stays on the phone |
| Photos | `PhotosStep` | `PhotoCapture` with the kinds ISSUE / SKETCH and the room (suggesting the rooms measured) |
| Findings | `FindingsStep` | the complaint, the diagnosis, the recommendation, the area, the days, the urgency, access, risks |
| Lines | `LinesStep` | one card per line: kind, a material or a work item (code · name — never a rate), words, quantity, unit, waste; **Measure this line** opens the sheet on it, and a measured line's quantity is the sheet's, read only |

- **Every write is a `survey_draft`** through the field queue, online or not (`surveyForm.js#surveyPayload` — the fields,
  the readings with the template's answers first, the lines with their measurement rows as numbers, `sitePin` when taken):
  a moment after the last tap (`AUTOSAVE_MS`), on every step change, when the screen goes or the phone locks. A newer draft
  replaces a waiting one (`supersede`), and the entry's `meta.form` keeps the form as typed (12'6", not 12.5), so coming
  back before it is sent shows what was typed. A line is saved once it has a description and a quantity above 0; a line
  whose deductions exceed its area waits on the phone (the API would answer `NEGATIVE_LINE`).
- **Submit** checks the template first (`helpers/inspection#missingAnswers` — the API's `checklistGaps`, one step stricter:
  a photo-required question's photo rides on its answer, so a photo with no answer names the answer). Anything missing →
  the Checklist step opens with `sections/IncompletePanel` ("Moisture … — photo needed", each with **Show me**), each card
  marked `aria-invalid` with what it lacks, and the focus on the first; nothing is queued. Otherwise the last draft and
  `survey_submit` are queued and, with signal, synced at once: the office's own 422 `SURVEY_INCOMPLETE` (a refused
  `survey_submit`, with its `details`) is shown the same way — an item the office named stays until its question is
  touched. With no signal the survey is "Submitted on this phone" and read only until it is sent.
- Parts: `surveyForm.js` (the pure side — `surveyToForm`, `surveyPayload`, `stepProgress`, `serverQtyFor`, `serverFlagFor`,
  `groupByArea`, `areasOf`, `currentFix`, `siteMapHref`), `helpers/inspection.js` (answers ⇄ readings, the flag, what is
  missing, the question's words in the viewer's language), `hooks/usePendingPicture.js` (a queued picture as an object URL
  — `PhotoCapture` and the checklist share it).

**The office review** (`SurveyReviewPage` → `components/surveys/SurveyFindings`): what the customer wrote and their photos
(`LeadPhotoGallery`); the findings with the site's address, landmark, site contact (tap to call) and the **pin as a Google
Maps link** (`https://www.google.com/maps?q=lat,lng`); readings **flagged first** — a flagged row on `surface-warning`
saying "Flagged — above 20 %", named by its template question, with the answer's photo; a **measurement table per measured
line** (rows by room, "− deduction", each row's value a preview, the quantity the server's); site photos **grouped by
area** ("No area" last) with their kind (Sketch too). The pricing table marks a measured line. **Build quotation** sends each
line's measurement rows (`helpers/boq.js#surveyQuotationRows`), so the BOQ row derives the same quantity and the server
sections the quotation by room when a line was measured in one.

Tests: `pages/tech/SurveyFormPage/SurveyFormPage.test.jsx` (Before you go; submit blocked and pointing at each missing
answer and photo, nothing queued; the office's SURVEY_INCOMPLETE shown on the checklist; a complete submit — draft then
submit; the checklist's toggles, chips, live flags and a queued photo, offline; the GPS pin with its confirmation and
accuracy; Nepali; the measurement cards at 360 px — one card per row, feet-inches, deduction, room and line previews, the
office's quantity, the payload; a new measured line and Lines' link back), `surveyForm.test.js`, `helpers/inspection.test.js`,
`helpers/measurements.test.js` (12' 6", 6", plain decimals), the L5 blocks of `helpers/offlineQueue.test.js` (supersede,
held entries, SURVEY_INCOMPLETE details) and `hooks/useOfflineQueue.test.js` (SKETCH with its room; a save and submit held
until the checklist photo is up, then sent with its media id; a refused photo), `VisitPublicPage.test.jsx` (en and ne at
360 px: confirm, reschedule with a note, closed, VISIT_CLOSED, 404) and `visitPageState.test.js`, `form/schemas/
visit.schema.test.js`, `DispatchJobCard.test.jsx` and the `visitFlag` block of `helpers/dispatchBoard.test.js`,
`config/admin/resources/inspectionTemplates.test.jsx` and `form/schemas/inspectionTemplate.schema.test.js`, the L5 blocks
of `SurveyReviewPage.test.jsx`, `LeadScreens.test.jsx`, `LeadFollowUp.test.jsx`, `CustomerScreens.test.jsx`,
`lead.schema.test.js`, `contactFields.test.js`, `components/leads/visitBookedCopy.test.js`, `crmMirror.test.js` and
`EditableGrid.test.jsx` (the select fix), and the L5 test of `e2e/boq-flow.spec.js`.

## Won → hand-off (Phase L6)

A customer's Accept (and the staff convert, and `POST /admin/jobs` with a quotation) hands the work over in one
transaction: the job typed from the service's `jobType`, `plannedDays` from the estimate, the BOQ's non-optional rows as
**job lines**, the take-off as **job requirements** (quantities, never rates — L-D4), and — when the payment schedule has
an ON_ACCEPT stage — the **ADVANCE invoice** (SENT, with its public link). Until that invoice is PAID the job is held:
schedule, assign, every status move but hold and cancel, and complete answer **422 ADVANCE_UNPAID** (L-D3). A MANAGER or
ADMIN may override with a reason (`jobs:advance-override`, audited as `job.advance_overridden`). The screens say all of
this before anyone tries; the server decides.

- **`helpers/handoff.js`** — the gate without a DOM: `awaitingAdvanceOf(job)` (the detail's `advance.awaitingAdvance`, or a
  list row's `awaitingAdvance`), `advanceInvoiceOf`, `advanceState(advance)` (`awaiting` · `paid` · `overridden` · `void` ·
  `unpaid` — the gate off — each with its words and tone), `canOverrideAdvance(job, can)`, `advanceRefusal(err)` (the 422's
  `{ message, invoiceId, invoiceNumber, balance }`, else null), `ADVANCE_LOCK_REASON`; the crew calculator — **`crewDays(labourDays,
  crew)` = ⌈days ÷ crew⌉**, rounded to six places first so float noise never adds a day — `defaultCrewSize` (the people
  assigned, else 2), `crewVerdict` (against `plannedDays`); `formatQty` (a quantity without float noise) and
  `plannedEnd(start, plannedDays)` (what the API does when a schedule has no end). Days and quantities, never money.
- **`helpers/jobActions.js`** holds the gated actions **on the bar, disabled** with `ADVANCE_LOCK_REASON` (schedule, assign,
  on the way, start / resume, complete, reopen — not hold, not cancel), and `jobWaitingFor` says "Waiting for the customer’s
  advance". `JobActionBar` writes one line per reason ("Schedule, Assign technicians: the advance is not paid yet.").
- **The job page**: `AwaitingAdvanceChip` in the header; **`sections/JobAdvanceCard`** above the tabs — the state in words,
  the advance invoice (`AdvanceInvoiceLink`: a link for `invoices:read`, else its number), its status, the customer's payment
  page, the advance, paid, still to pay (the server's paisa) and the due date in AD and BS, "Overridden by X on … : “reason”",
  and **Override…** (`AdvanceOverrideDialog`) for `jobs:advance-override` while the gate holds. Nothing for a job without an
  advance.
- **The Plan tab** (`sections/JobPlanTab.jsx`) — only on a BOQ job (`job.lines.length > 0`; `?tab=plan` on any other job falls
  back to Overview). `GET /admin/jobs/:id/plan` (`jobs:read`), quantities only: the **hand-off checklist** from the server's
  `readiness[]` (advance, BOQ, materials, crew, schedule, site — "n of 6 ready"), the **advance** with its invoice, the **BOQ
  imported** (the line count; sections as `CustomTable` rows that open onto their lines — number, item, quoted quantity,
  provisional), **materials needed vs stock** (need, packs of the pack label, on hand, and "Short 70 kg" on the warning
  surface; "n short" beside the title), and the **crew plan** (labour days by trade, a crew-size input starting at the people
  assigned or 2, "12.5 labour days ÷ 2 people = 7 days on site (rounded up)" against the planned days, the foreman — the lead
  technician). Kit only: `Card`, `CustomTable` (`expandable`), `StateBadge`, an `Input`.
- **The board and the lists**: `DispatchJobCard` (and so the unassigned queue and "Assigned, no time yet") wears the chip and
  has **no drag handle** while held — the drop would be refused — but keeps **Schedule…**, whose dialog explains; the jobs
  list's status column has the chip (and its CSV the words).
- **Schedule and Assign dialogs**: `AdvanceNotice` above the form when the job is known to be held, and after a 422
  ADVANCE_UNPAID (a row fetched before the advance may not know): the server's message, the invoice, "Rs. … to pay", and
  Override… for holders — the dialog stays open; once overridden the notice goes. `useScheduleCommit(…, { rethrow: true })`
  lets the dialog see the refusal instead of a toast. The Schedule dialog prefills the end `plannedDays` after the start ("From
  the plan: 8 days after the start…"); `jobScheduleSchemaFor(job)` asks for an end only when the job has no plan; a window may
  run 90 days (it was 14). The staff convert's toast says the job waits for its advance.
- **Invoices**: `kind` (`INVOICE_KINDS` / `_LABELS`, mirror-tested) — `InvoiceKindBadge` by the number in the list and on the
  detail, a **Kind** filter (`?kind=`) and a hidden Kind column; the detail links its `job` and names its `paymentStage`
  (`helpers/finance#invoiceStageLine`); `InvoiceDocument` (public page, office, print) says "Advance — <the stage's label>
  (<share>%)" from `paymentStage` (the public answer carries it too) — "Advance — Mobilisation (40%)"; a label that only
  repeats the kind (the default schedule's "Advance") gives way to when it falls due: "Advance — on acceptance (50%)". A
  non-STANDARD invoice's draft has **locked lines**: read-only lines, discount and VAT, and a form for the due date, note
  and terms only (422 INVOICE_LINES_LOCKED told in words).
  `billingRuleOf` says a quoted job whose advance was billed is billed "…as accepted, less the advance INV-…" (the server's
  FINAL bill carries the negative line).
- **The customer's quotation page**: once accepted — right after the tap, and on every reload — `AdvanceDue` (in
  `QuotationDecision.jsx`) reads the API's `advance` (`{ number, total, dueDate, status, url }`): "Pay the advance of Rs X by
  <date>" (AD with BS), why, and a **Pay the advance** button to the invoice's own page; "Advance received" once PAID; nothing
  for a void one or none. The words are `quotationPageCopy.js#advance` in en and ne.
- **Services**: the registry entry has **Job type when won** (a select of `JOB_TYPE_LABELS`, REPAIR by default; a hidden list
  column) — `serviceSchema.jobType`.
- `config/auditEvents.js` names `job.advance_overridden` (its History line: the invoice and the reason);
  `config/admin/messageKeys.js` describes `advance_due` (sample vars `quotation`, `payTo`).
- Tests: `pages/admin/HandoffScreens.test.jsx` (the chip, card and held buttons for a dispatcher; the override dialog — a
  manager's, the reason required, then sent; an admin's invoice link; paid and no-advance jobs; the Plan tab only on a BOQ job,
  its checklist, sections, the shortfall, no rates; the crew calculator rounding up, from the people assigned, the foreman;
  the Schedule dialog's planned end and ADVANCE_UNPAID for an admin and a dispatcher, and up front; the chip on the unassigned
  queue — no drag — and the jobs list; the invoice kind badge, filter, stage line on the office and public pages (the
  default label and a stage's own), and a final bill's deduction; a locked draft — lines, discount and VAT read-only, only
  the header sent, INVOICE_LINES_LOCKED in words — and a STANDARD draft as before; the services' `jobType`), `helpers/handoff.test.js`, the L6 blocks of `DispatchJobCard.test.jsx`,
  `QuotationPublicPage.test.jsx` (the advance after Accept, on reload in Nepali, paid, none) and `helpers/finance.test.js`
  (`INVOICE_KINDS` mirror, `formatSignedNpr`, `invoiceLinesLocked`, the staged billing rule), and the L6 steps of
  `e2e/boq-flow.spec.js`.

## Execution (Phase L7)

The weeks on site: a daily **site diary** the foreman files from a phone, offline; **progress** per BOQ line with earned value;
**materials and labour** planned vs issued vs logged; a **purchase list** raised from the shortfall; and **variation orders**
through the same builder, approval and customer link as a quotation. **No money on the phone** (D1): the diary carries
none, and the office's earned value is behind `quotations:read` / `invoices:read`.

**The site diary** — `pages/tech/SiteDiaryPage/` (one route target for `/tech/jobs/:id/diary` and `/tech/jobs/:id/diary/:day`),
linked from the job sheet (`TechJobPage/sections/DiaryLinkCard` — not on an inspection), which also loads today's page while
there is signal so it opens in a basement (`getMyDiaryDay`, kept 12 h). Built for 360 px and gloves: every control ≥ 44 px,
steppers 48 px, the save pinned at the bottom; en and ne (`fieldCopy.diary`).

| Part | File | Does |
|---|---|---|
| The days | `sections/DiaryDays` | today on top (the server's Kathmandu day, the phone's with no signal) — filed · not filed · saved on this phone — with one big button; **Another day** (a date, up to 60 days back, never tomorrow — `siteDiary#isDiaryDay`); the days filed newest first, the server's with the ones still on the phone |
| Weather | `sections/WeatherCard` | five chips (`WEATHER`), a second tap clears |
| Who was on site | `sections/HeadcountCard` | each trade with − / count / + (0–200; a count can be typed for a big crew), the day's total in people |
| Progress | `sections/ProgressCard` | the job's lines by section (`linesBySection`) — number, words, "of 240 sq.ft", a bar, −5 % / +5 % / Done; a line starts where the job stands (`progressPct`) and only a line marked this day is sent. No rate reaches the phone |
| Materials received | `sections/ReceivedCard` | "Add a delivery" through the field app's `MaterialsSheet` (the material and its quantity), or "Something not on the list"; each with its challan number. **A delivery does not move stock** |
| Time lost | `sections/LostTimeCard` | half hours 0–24; once any are lost, why (`LOST_TIME_REASONS` chips) — asked for before the day saves |
| Photos | `sections/DiaryPhotos` | the rear camera → `compressImage` → the upload queue as the job's DURING photos, captioned with the day; "Waiting to upload" until sent |
| Problems, note | `sections/NotesCard` | the foreman's words (`lang="ne"`) |

- **Every write is a `diary_save`** (`useFieldQueue#queueMutation`), online or not: the whole day (`siteDiary#diaryPayload` — the
  API's `diarySchema`, strict), keyed on job + day, a **full replace**; a newer save of the same day **supersedes** a waiting one
  (`isDiarySave`). `meta.form` keeps the form as typed, so coming back before it is sent shows it; `meta.photoUploadIds` names
  the pictures still uploading (see the offline rules, 11). Save checks the API's rules first (`diaryProblems`: a delivery needs
  what and a quantity above 0, lost hours need a reason) and marks what is wrong; leaving the screen saves what can be saved.
- A job whose diary is closed (DRAFT, CANCELLED, VERIFIED — the API's 422 `JOB_NOT_ON_SITE`) reads its days, read only.

**The job page** gains four tabs (each loads only while open; `?tab=` falls back to Overview where it is not offered):

| Tab | On | From | Shows |
|---|---|---|---|
| **BOQ & progress** (`sections/JobProgressTab`) | a BOQ job | `GET /admin/jobs/:id/progress` | work done by value (`earnedPct`), the lines by section — quoted quantity, a progress bar, VARIATION lines marked, an omission's quantity in red — and, **only for `quotations:read` / `invoices:read`** (`helpers/execution#seesEarnedValue`) and only when the server sent it, each line's rate, value and earned value and the totals ("− Rs." below zero). The payment stages (billed · due now · not yet) and, once earned value passes a MILESTONE, **"Earned value has passed <label> — raise the running bill"** (`nextBillPrompt`), linking the invoices for `invoices:read` — since Phase L8 with **Raise running bill** for `invoices:write`, the final measurement and the final bill (see "Close-out & final bill (Phase L8)") |
| **Materials / Labour** (`sections/JobPlannedActualTab`) | a BOQ job | `GET /admin/jobs/:id/planned-vs-actual` | per material planned · issued · received on site (the diary's challans) and "Over plan by 10.5 kg" / "Not in the plan" on the warning surface; per trade planned vs logged labour days (headcount × the hours worked of an 8-hour day) with Over plan / On plan / Within plan (`labourState`); the timers' hours. Quantities only. **Create purchase list from shortfall** |
| **Site diary** (`sections/JobDiaryTab`) | any job but an inspection | `GET /admin/jobs/:id/diary` | a `CustomTable` of the days — day in AD and BS, weather, people on site, time lost and why, lines marked ("A.1 50%"), photos, who filed it; a row opens onto the day: headcount by trade, progress, deliveries with the challan, problems and note, the photos (the answer's `media`); CSV |
| **Variations** (`sections/JobVariationsTab`) | a quoted job (lines or a quotation), not an inspection | `GET /admin/jobs/:id/variations` | the job's variation orders — number, status ("Accepted · on the job" once converted), total (only when sent, for `quotations:read`), raised / sent / answered; a row opens the builder for `quotations:read`. **New variation** (`quotations:write`, not on a cancelled or verified job) posts `{ jobId, items: [] }` and opens the draft |

`sections/ShortfallPurchaseListButton` (`materials:write`, on Materials and Materials / Labour) posts
`/admin/jobs/:id/purchase-lists/from-shortfall` and opens the DRAFT it answers; 422 `NO_SHORTFALL` is said in words ("Nothing
is short"). **OVER_PLAN** — issuing material past the plan still issues it: the Materials tab's dialog toasts the success and a
**warning** (`toastWarning`, `overPlanText`: "Crystalline slurry: 130.5 kg issued to this job against 120 kg planned.").

**Purchase lists** — the registry entry `config/admin/resources/purchaseLists.jsx` (see "Which screen is which"; nav
Operations › Purchase lists): number and date, state (`PURCHASE_LIST_TONES`), the job (linked) or "For the store", supplier,
items, ordered and received in AD + BS; filters state, job, supplier; newest first. The form: job, supplier, the items grid
(`ITEM_COLUMNS` — the material in a `RecordCombobox` that opens on Enter, quantity in its unit, packs of its pack label, note,
received) and a note; `ops.schema#purchaseListSchema` drops blank rows and sends `{ materialId, qty, packs?, note? }`.
The moves are **`hooks/usePurchaseListActions`** (the entry's `useRecordActions`): **Mark ordered** (confirmed), **Receive into
stock…** (a `FormDialog` of one quantity per item, as ordered to start with — `purchaseReceiveFormSchema`; as ordered sends
`{}`, less sends every item — `helpers/purchaseLists#receiveBody`), **Cancel list…** (a reason, 3–500). What a state allows is
`helpers/purchaseLists#purchaseListActions`, held to `PURCHASE_LIST_TRANSITIONS` (the API's machine, mirrored in
`config/constants.js`). Past DRAFT the form is read only (`purchaseListLock`) and Delete is not offered (`purchaseListDeletable`).

**Variations in the quotation screens** — a variation is a quotation with `kind: 'VARIATION'` and a `jobId`, numbered VO-:

- **The list** (`QuotationsPage`): a "Variation" badge and the job's number under the number, a **Kind** filter (`?kind=`), and
  totals below zero as "− Rs. …".
- **The builder** is the L3 `QuotationBuilderPage` itself, in variation mode (`quotation.kind === 'VARIATION'`): the "Variation"
  badge, `sections/VariationBanner` (the job, linked to its Variations tab, and what accepting does), the `lineItems` field's
  **`signedQty`** (the Qty cell takes "-12", "−12" or "- 12" — `helpers/boq#signedQtyOf`), `quotation.schema#quotationFormSchemaFor({
  variation })` (a negative quantity allowed, never 0; on a QUOTATION a quantity ≤ 0 is "More than 0" — the API's 422
  NEGATIVE_LINE), the preview asked with `kind: 'VARIATION'` (`helpers/boq#previewRequest`), **no Payment schedule** (the tab reads
  **Terms**; nothing is sent), and totals below zero as "− Rs. …" (`TotalsCard`). Submit, approve (maker-checker, the margin gate),
  send and the customer's link are unchanged; the APPROVED convert reads **Add to the job** (`VARIATION_CONVERT_LABEL`) and
  confirms that its rows join the job with no new job and no advance; `waitingFor` speaks of the job.
- **The customer's page**: `QuotationDocument` names it **Variation order** / परिवर्तन आदेश with "Change to your job JOB-…" in the
  header (`quotationDocumentCopy.js#variation`); the page adds a notice (`data-testid="variation-notice"`) and answers with
  `quotationPageCopy.js#variationPageCopy` — **"Accept this change" / "यो परिवर्तन स्वीकार्नुहोस्"**, the total (possibly "− Rs.") repeated
  in the confirm, and "the change is accepted — we have added it to your job". No advance is asked for.

Parts: `helpers/execution.js` (`seesEarnedValue`, `overPlanText`, `nextBillPrompt`, `pctText`, `labourState`, `qtyWithUnit`),
`helpers/purchaseLists.js`, `pages/tech/SiteDiaryPage/siteDiary.js` (the form ⇄ the API's day, the payload, the checks, the day
bounds, the steps), `config/constants.js` (`QUOTATION_KINDS`, `WEATHER`, `LOST_TIME_REASONS`, `PURCHASE_LIST_STATUSES` /
`_TRANSITIONS`, each with its `*_LABELS`), `config/auditEvents.js` (`site_diary.saved`, `purchase_list.*`, `job.variation_added`,
and the groups Site diary and Purchase lists), `helpers/recordLinks.js` (a purchase list and its items; a diary day opens its
job's Site diary tab), `ui/progress.jsx` (the bar now tells a screen reader its value).

Tests: `pages/tech/SiteDiaryPage/SiteDiaryPage.test.jsx` (at 360 px, offline: the whole day in one `diary_save` with no money
key; the lost-hours reason asked for first; a newer save of the day supersedes the waiting one and another day's stays; the form
starts from the waiting save; a photo held until uploaded, then the day sent with the media id and never the upload id; read
only on a closed job; Nepali; the days list with the waiting day and "Another day"; the job sheet's link and today's prefetch, none
on an inspection), `siteDiary.test.js` (round trip, the API's own `diarySchema`, bounds, steps), the L7 blocks of
`hooks/useOfflineQueue.test.js` (a held day never holds the job's status change; a refused photo; JOB_NOT_ON_SITE dropped with a
note; OVER_PLAN toasted in Nepali) and `helpers/offlineQueue.test.js` (`scopeOf`, warnings kept, terminal codes),
`pages/admin/ExecutionScreens.test.jsx` (the four tabs and where they show; earned value for SALES, never for a dispatcher — even
from a doctored answer; the next-bill prompt; over plan and labour; shortfall → the draft opens, NO_SHORTFALL in words, no button
for SALES; the issue dialog's OVER_PLAN warning; the diary tab and a day's details; variations with totals for SALES and New
variation, none for a dispatcher; the purchase lists' row moves by state, order, receive as ordered and short, cancel with a
reason, the lock, the items grid saved in the API's shape), `helpers/purchaseLists.test.js` (held to the machine; the API's own
schemas), `helpers/execution.test.js`, the L7 blocks of `QuotationBuilder.test.jsx` (variation mode; a negative quantity refused
on a quotation), `QuotationPublicPage.test.jsx` (en and ne) and `quotationActions.test.js`, `crmMirror.test.js` (the purchase-list
machine, the new enums with words in both field languages, the queue's kinds = `/tech/sync`'s), `adminNav.test.js`,
`recordLinks.test.js`, and the L7 steps of `e2e/boq-flow.spec.js`.

## Close-out & final bill (Phase L8)

The money loop closes: a **running bill** per MILESTONE stage, the **final measurement** (office and site — quantities only),
the **FINAL invoice** by the contract type less every stage bill, and a **handover** that records snags, shows the warranty and
offers an AMC. Advance + running + final = the contract to the paisa — the server's arithmetic (`money.js#finalBillTotals`); the
screens show its figures and add nothing up.

**Running bills** — on the job's **BOQ & progress** tab (`sections/JobProgressTab`), for `invoices:write`: the next-bill prompt has
**Raise running bill**, and each unbilled MILESTONE stage in the **Payment stages** table has it in its row menu
(`helpers/closeout#stageRaisable` — never the advance, never ON_COMPLETION). A stage not reached yet asks first ("The work done by
value (15%) has not reached this stage (90%) yet"). `financeApi#raiseStageInvoice` → the RUNNING DRAFT opens (its lines locked,
Phase L6's `InvoiceEditForm`). A refusal — 409 STAGE_BILLED, 422 STAGE_NOT_MILESTONE, 422 FINAL_ALREADY_BILLED, 404 STAGE_NOT_FOUND
— is toasted in the server's words; STAGE_BILLED reads the stages again. A dispatcher sees the prompt ("Tell accounts.") and no
button.

**The final measurement, in the office** — the same tab:

- a **Measured** column: each line's `measuredQty` from the job detail's `lines` (the progress answer carries none), or **To
  measure** on a line the contract measures (`helpers/closeout#mustMeasure`, the API's rule: ITEM_RATE every line but an omission,
  LUMP_SUM its provisional lines);
- a line's **Measure…** (`jobs:write`) opens **`components/jobs/MeasureLineSheet`** — a `ResourceForm` sheet with the kit's
  `measurements` field (`keptBy: 'job line'`), `form/schemas/job.schema#jobLineMeasureSchema` (1–200 rows, feet-inches read, sent as
  numbers) → `jobsApi#measureJobLine`; the toast repeats the **server's** quantity. Off, with no request, on an omission and while
  closed (`measureLock`);
- **`sections/JobMeasurementCard`** — the contract type, "1 of 2 lines measured" (`measurementState` — counts, never money),
  closed with who and when, **Close measurement** / **Reopen measurement** (`jobs:write`, each confirmed). A 422
  MEASUREMENT_INCOMPLETE lists the lines the server named, each with **Measure…**; a 422 FINAL_ALREADY_BILLED on reopen is said in
  its words.

**The final measurement, on site** — `pages/tech/JobMeasurePage/` (`/tech/jobs/:id/measure`, linked from the job sheet of a BOQ job by
`TechJobPage/sections/MeasureLinkCard`): `sections/MeasureLineList` (the lines by section, each a ≥ 56 px row: number and words, the
quoted quantity, **Measured: 252 sq.ft** / **To measure** / **Not measured yet**; an omission is shown, not opened) and, on
`?line=`, `sections/MeasureSheet` — Phase L5's pattern: rooms, **one `components/tech/MeasurementCard` per row**, feet-inches, the
deduction switch, the room's and the line's totals as a preview, "Saved — office quantity: 190.5 sq.ft" once the cards are what the
server holds (`jobMeasure#sameAsSaved`), else "not saved yet"; **Save measurements** is pinned at the bottom (≥ 48 px). The pure side is
`jobMeasure.js` (`rowsFromLine`, `measureBody`, `measureProblem` — a row that does not read, none, more than 200 —
`phoneTotal`, `linesBySection`). **Quantities only**: the lines come from `/tech/jobs/:id` without a rate, and the PUT body is
measurement rows. **It needs signal** — `/tech/sync` has no kind for it: with none, the screen says so and keeps the cards (they are
not kept after the screen closes). A refusal is in the technician's words (`fieldCopy.measure.refused`: MEASUREMENT_CLOSED,
LINE_NOT_MEASURED, NEGATIVE_LINE, NOT_FOUND); MEASUREMENT_CLOSED reads the job again and the sheet turns read only. en + ne.

**The final bill** — `components/finance/InvoiceFromJobSheet` asks the server first for a quoted job: `financeApi#getFinalBill` →
**`components/finance/FinalBillPreview`** on a BOQ job (`boq: true`): the contract type and the measurement's state; **What it bills**
(each line at the quantity it bills, its rate and amount — a variation's marked, an omission "− Rs."); **Deducted — billed before**
(each ADVANCE / RUNNING bill's number, kind, taxable, VAT, total); **Totals** (subtotal, discount, then taxable, VAT and total for the
contract, billed before and this bill); and, first, what **blocks** it — MEASUREMENT_INCOMPLETE with its lines and a link to the job's
BOQ & progress tab, FINAL_BELOW_BILLED, FINAL_ALREADY_BILLED — while which **Create final bill (draft)** is disabled. It sends only the
due date (the API's QUOTED_JOB_BILLS_SCOPE otherwise); a refusal reads the preview again and shows the server's words. `{ boq: false }`
bills as Phase I says. The job page's **Final bill** card (`invoices:write`, `helpers/closeout#finalBillAction` — off until the job is
completed, and once invoiced) opens the sheet on the job (`job` prop, no list).

**Deductions in the documents** — invoice lines carry `kind` (`INVOICE_ITEM_KINDS`): `InvoiceDocument` (office, print, the customer's
page) and a locked draft split them (`helpers/finance#splitInvoiceItems`) and list the DEDUCTION lines in
**`components/documents/DeductionsTable`** — one sign each, no "Less:" (`deductionLabel`), never "Rs. -". A line with no `kind` (from
before L8) is billed.

**Costing** — `sections/JobCostingTab` opens with **Quoted vs actual cost** (`costs:read`): materials, labour, other (expenses) and
the total — the recipes' frozen cost (`quoted`, "—" where unknown) beside the actual, "Over the quote" / "Within the quote" (a
comparison, no difference worked out), and a note when `quoted.complete` is false. **Invoiced** is the taxable amount billed ("Before
VAT, net of discount").

**The handover** — `components/jobs/CompleteJobDialog` (what "Complete…" opens, from the bar and the jobs list): **snags** first (a
`stringList`; each becomes a checklist item through `POST /admin/jobs/:id/tasks`; "An open item blocks completion" is said up front —
with any snag the sign-off fields hide, the button reads "Add 2 snags to the checklist", the dialog records them and closes **without
completing**); with none, the sign-off (`form/schemas/job.schema#jobHandoverSchema`; what was left empty is not sent, so the warranty
keeps its default wording); then **handed over**: the warranty from the refreshed job detail (scope, covered until in AD + BS, the
certificate link `/warranty/:token` — `helpers/aftercare#certificateUrl` — Copy / Open, the warranty record for `warranties:read`)
and **`OfferAmcButton`** — `POST /admin/jobs/:id/offer-amc` → "A lead is with sales … — <owner>. Open the lead" (201), or "This
customer already has an open AMC offer with sales" (200), never a second lead. The button is also on a finished job's Overview.

Tests: `pages/admin/CloseoutScreens.test.jsx` (the running bill from the prompt → the draft opens; a stage not reached asks first,
STAGE_BILLED in the server's words, no advance or completion stage offered, nothing for a dispatcher; the Measured column, Measure… on a
line — Devanagari room, the body in numbers with no money key, the server's quantity toasted — off on an omission and while closed; close
→ MEASUREMENT_INCOMPLETE's lines each opening its sheet; closed by whom, reopen refused FINAL_ALREADY_BILLED; SALES read only; quoted vs
actual from a mocked costing, "—", over / within, the incomplete note; the handover — two snags (one Devanagari) → two tasks and no
completion; complete → the warranty link and Offer AMC's new lead with its link; an open offer said so on the Overview; the final-bill
preview with a doctored server figure shown as sent, the deductions and totals, created sending only the due date; blocking reasons,
Create disabled; not before completion; `boq: false` as Phase I; DEDUCTION rows on the office page, the customer's page and a locked
draft — one sign, no "Less:", not among the work), `pages/tech/JobMeasurePage/JobMeasurePage.test.jsx` (at 360 px: the job sheet's
link, the lines' states with no money; two rooms' cards in feet-inches with a door deducted, the previews, the PUT body in numbers with no
money key, the office's quantity back; nothing to save and an unreadable row said first; no signal; MEASUREMENT_CLOSED in words, then
read only; Nepali; `jobMeasure.js`), `helpers/closeout.test.js`, the L8 blocks of `helpers/finance.test.js` and
`config/crmMirror.test.js` (`amc_offer`, `INVOICE_ITEM_KINDS`, the two audit events), and the L8 steps of `e2e/boq-flow.spec.js`.

## Leads and customers (Phase E)

| Route | Page | Does |
|---|---|---|
| `/admin/leads` | `LeadsPage` | CustomTable opening on **My leads** (D6) with a one-click **All leads**; filters next action, status, priority, source, service, owner (with Unassigned), response state, requested visit, date; URL-saved views (the follow-up ones first: **Due today · Overdue · No next action**); a **Next action** column (sortable, `?sort=nextActionAt`) and an **"Nd in stage"** chip; New lead sheet; bulk Assign (one `bulk-assign` request) and Export selected; Export (filtered) |
| `/admin/leads/board` | `LeadBoardPage/` | the pipeline: a column per status (the list endpoint, 20 per column, "+N more" to the table); drag by the handle or use a card's "Move to" menu; only `LEAD_TRANSITIONS` drops are open (others dim); a move with work behind it opens that work (**Visit booked** → the visit booking, **Quoted** without a quotation → the new-quotation sheet, **Lost** → why) and the card moves only when it completes; a refused move goes back with a toast; cards show "Nd in stage"; pointer collision; no layout animation under reduced motion |
| `/admin/leads/:id` | `LeadDetailPage` | Edit, Change status (the board's rules: the visit and quotation dialogs), Assign, Convert (book the visit / without a visit), Delete; the **NextActionCard** above the tabs; Overview (request, the outcome composer and the timeline with each outcome, qualification, where it got to), Duplicates (merge), History (`leads:history`). `?markLost=1` opens Mark lost on load, then leaves the address |
| `/admin/reports/sales?report=lost` | `ReportsPage/sections/LostReport` | `reports:sales` (nav: Reports › Sales reports, tab Lost leads — Phase I10 folded Phase L1's `LostReportPage` in; `/admin/reports/lost` redirects there). Why leads are lost: the count per category, then category × the stage it was lost at × service with its share; the reports' shared range and the API's CSV |
| `/admin/customers` | `CustomersPage` | CustomTable: sites, open jobs, language, balance due for `invoices:read`; type filter, a tag chip filters by tag; New customer sheet |
| `/admin/customers/:id` | `CustomerDetailPage/` | Profile form (read-only without `customers:write`), Sites (one primary; "use map pin"), Timeline, the record tabs a role may read (quotations and jobs link to their pages; since Phase I warranties and AMC contracts too, by `warranties:read` / `amc:read`), Statement (`reports:finance`), History (`customers:history`) |

Both converts ask **"same person / different person"** whenever an existing customer has the lead's phone
(`CustomerMatchChoice`); Book / Convert waits for the answer, and the lead's email reaches an existing customer only when
"Also save … on this customer" is ticked. The public contact form and booking wizard send an optional email and the
site's language (`uiSlice.locale`) as `preferredLocale`.

### Lead follow-through (Phase L1)

Every open lead has a next action and a clock. The API holds the rules (`lead.service#addActivity`); the screens show
them and refuse what the API would.

- **`components/leads/NextActionCard`** — at the top of the lead page: what is next, when (Kathmandu words — "Today,
  14:30", "Tomorrow, 10:00", "Mon 21 Sept, 10:00"), overdue set apart on the destructive surface **and** labelled
  "Overdue" with how late; "Due today" otherwise; contact attempts and days in stage. **Done** clears it (`at: null`),
  **Reschedule** is a `FormDialog` (time, type, note); an open lead with nothing next says so and offers "Set next
  action". Nothing for a won or lost lead.
- **The outcome composer** (`components/leads/ActivityComposer`) — a `ResourceForm` whose fields follow the pick
  (`config/admin/crmForms.js#activityFieldsFor`): for a contact on an open lead, **What came of it** (`LEAD_OUTCOMES`), then
  what that outcome needs — a time for "Call back at…" / "Not now" (the type defaults to the outcome's suggestion,
  `OUTCOME_NEXT_TYPE`), the lost category (+ words for "Other") for "Not interested", "next action or close" for "Wrong
  number", and "Set a different next action" for the rest (off: the API's default, in words). The summary may stay empty
  (the outcome's words are sent). `activityFormSchema` refuses what the API would answer 422 `NEXT_ACTION_REQUIRED`;
  `activityBody(values)` builds the request. After the save it opens the step the answer's `dialog` names — the visit
  booking or the new-quotation sheet — and calls `onLogged(activity, followUp)` once that is done or cancelled, so the SLA
  board's dialog stays up for it. A note, or a won / lost lead, has no outcome.
- **`hooks/useLeadFollowUp`** — `const [openFollowUp, dialogs] = useLeadFollowUp()`, then `await openFollowUp(lead,
  'visit' | 'quotation')` → the convert's result (or, since L3's New quotation sheet, `{ quotation }` for a lead that is
  already a customer), or null on Cancel. The quotation path toasts "Draft QT-… created — The
  lead moves to Quoted when the quotation is sent" (QUOTED means *sent*; drafting never moves the lead). The composer,
  the board and the lead page's status menu use it.
- **Board drops** — `helpers/leadBoard.js#dropDialogFor(to, hasQuotation(lead))`: `visit` for Visit booked, `quotation` for
  Quoted without a quotation (the board reads the lead's record when the row does not say), `lost` for Lost, null for a
  plain `PATCH /status`. The drop, the keyboard sensor and the "Move to" menu all run one `move`; the card stays put while a
  dialog is open and shows wherever the server lists it afterwards.
- **`components/leads/QualificationCard`** — property, floors, building age, budget band (a label, never money), who
  decides (including "Owner abroad"): what is known, and "Missing: budget, decision maker…" (`helpers/leadFollowUp.js#
  qualificationSummary`; land is not asked for floors or age). Edit is a `FormDialog` saving `qualification` through
  `PUT /admin/leads/:id` (null when emptied).
- **`components/leads/StageAgeChip`** — "4d in stage" / "In stage today" from `stageEnteredAt` (whole days, rounded down;
  amber from 3 days), on list rows, board cards and the NextActionCard.
- **Views** — `config/admin/leadViews.js`: Due today · Overdue · No next action → `?nextAction=due_today|overdue|none`.
  They are `keepView` presets: they narrow My leads or All leads, whichever is on, rather than switching to All — the
  morning digest's link (`/admin/leads?nextAction=due_today`) lands on the salesperson's own. `clearPreset` switches one
  off. The Filters panel has the same **Next action** filter.
- **Lost** — `LostReasonDialog` asks a category (`LOST_CATEGORIES`, required) beside the words; `useLeadStatusChange`
  sends `{ status: 'LOST', lostCategory, lostReason? }`. A declined or expired quotation's notification links to
  `/admin/leads/:id?markLost=1`, which opens it — a person decides; nothing is lost automatically. Since Phase L4 a decline
  carries the customer's reason as `&category=PRICE`, and the dialog starts on that category
  (`changeStatus(lead, 'LOST', { lostCategory })` → `LostReasonDialog defaultCategory`).
- `helpers/leadFollowUp.js` — `nextActionState` (none · overdue · today · later, "today" by Kathmandu's calendar),
  `formatWhen`, `lateBy`, `daysInStage`, `stageAgeLabel`, `isClosedLead`, `qualificationSummary`.
- Tests: `pages/admin/LeadFollowUp.test.jsx` (the card, the composer, the lost dialog, the views, `?markLost=1`, the
  qualification card, the status menu, the lost report — with Devanagari names and notes), the board's Phase L1 block in
  `LeadScreens.test.jsx`, `helpers/leadFollowUp.test.js`, `form/schemas/lead.schema.test.js`, and `crmMirror.test.js` for
  the new lists.

## The rate library and the money wall (Phase L2)

The rate card became the **rate library**: a selling rate per unit of work, and the **recipe** behind it (L-D1) — what
`recipeQty` units need in materials (with wastage), labour man-days by trade, equipment and other costs — plus overhead %,
profit % and a round-up. It is still one registry entry (`config/admin/resources/rateCard.jsx`, `/admin/rate-card`,
nav **Catalog › Rate library**) rendered by `ResourceListPage` / `ResourceEditPage`; **Trades & wages**
(`resources/trades.jsx`, `/admin/trades`) sits beside it. Both read with `rates:read` (SALES, MANAGER, ACCOUNTANT) and
write with `rates:write` (MANAGER); SALES no longer writes rates, because a recipe carries cost.

- **Rate set by** — *Typed by hand* (`MANUAL`: the rate is typed; a recipe, if any, only costs it for the margin) or
  *Worked out from the recipe* (`DERIVED`: the server sets the rate from the recipe on save; the Rate field is read-only,
  via `adapt`). The recipe is the `recipe` field; overhead %, profit % and "Round up to" are `nullable` (blank = the
  setting) and `capability: 'costs:read'`.
- **Out of date** — a new purchase rate or day wage never moves a rate. The row's `outOfDate` / `derivedRate` (a selling
  rate, so every reader sees it) show as the **Price check** column ("Out of date — Recipe gives Rs. …") and, on the
  record, as `RateLibraryIntro`. A rate changes only by a save or by the bulk action **Update to derived rate**
  (`rates:write`): `POST /reprice { ids, apply: false }` → the before/after in a confirmation (`RepricePreview`) →
  `{ ids: <exactly those shown>, apply: true }`.
- **Cost vs rate** — the edit form's `preview` field (`components/rateLibrary/RateCostCard`), shown with `costs:read`:
  once every recipe line is complete it sends the recipe as typed (`helpers/recipe.js#deriveRequest`, debounced) to
  `POST /admin/rate-card/derive` and shows the server's material, labour, equipment, other, overhead and unit cost, the
  derived rate, and the margin at the rate now (and at the derived rate). A line with no price yet is named, and there is
  no derived rate until every line is priced.
- **Columns** — Code, Work, Rate, Set by, Price check; **Cost** and **Margin %** only with `costs:read` (column `capability`).

**The money wall on the client.** The API is the wall: it strips cost keys (`cost`, `unitCost`, `lineCost`,
`costBreakdown`, `margin`, `overheadPct`, `profitPct`, `purchaseRate`, `dayWage`, …) for anyone without `costs:read`,
masks them in History, and answers 403 to job costing and the job-margin report. The client follows two rules:

1. **Never compute cost or margin.** A recipe is priced by the server (`/derive`, and the rows it lists), and `/derive`
   also answers the margin at the form's rate and at the derived rate — for exactly the recipe on screen.
2. **Show cost only behind `costs:read`** — a column's or field's `capability`, the recipe field's `costCapability`, the
   job page's Costing tab. A screen never relies on a key simply being absent.

Parts: `helpers/recipe.js` (API components ⇄ form rows, `recipeBody`, `deriveRequest`), `api/rateLibraryApi.js`,
`form/schemas/rateCard.schema.js` (`rateCardItemSchema` — a typed rate needs its rate, a derived one its recipe —
`recipeComponentSchema`, `tradeSchema`), `config/constants.js` (`UNITS` with the metric and pack units, `RATE_MODES`,
`RECIPE_COMPONENT_KINDS`, each with labels), and `helpers/capabilityMatrix.js#CAPABILITY_DESCRIPTIONS` (the Roles &
permissions matrix words `costs:read`, `rates:read`, `rates:write` and `jobs:advance-override` in full). Materials gained
**pack size** and **pack** (`bag = 50 kg`), shown on the list and beside a recipe's material.

Tests: `pages/admin/RateLibraryScreens.test.jsx` (the list per role, the out-of-date badge, the bulk reprice — preview,
confirm, apply, decline, nothing to do — the form for MANAGER and for SALES, a recipe created end to end in rupees, the
rules, trades' wage, materials' pack), `helpers/recipe.test.js`, the L2 block in `ResourceForm.test.jsx` (`adapt`,
`nullable`, `preview`), the Costing tab per role in `OperationsScreens.test.jsx`, and `crmMirror.test.js` (units, rate
modes, recipe kinds, the permission map and who holds each new capability).

## Finance screens (Phase I)

Invoices, payments, expenses and the reports — the **Finance** group (Invoices · Payments · Expenses · Finance
reports) and the **Reports** group (Sales reports · Operations reports · Job margin), both on the Home tab, each item
behind its own capability. ACCOUNTANT holds the finance ones (`invoices:*`, `payments:*`, `expenses:*`,
`reports:finance`); ADMIN everything; nobody else sees Finance. **Money is where this breaks**, so the rule is simple:
every total, VAT, paid amount and balance on these screens is the **server's** (paisa → `helpers/format.js`); the UI never
adds, multiplies or works out VAT. The one check against a figure is the payment sheet's amount ≤ the server's `balance`.
Money typed in a form is rupees and goes to the API as rupees.

| Route | Page | Does |
|---|---|---|
| `/admin/invoices` | `InvoicesPage` | `invoices:read`. Status tabs All · Draft · Sent · Part paid · Overdue · Paid · Void with the server's counts (`meta.counts`, under the other filters — `config/admin/financeViews#INVOICE_TABS`); filters kind (Phase L6, `?kind=` — an advance wears "Advance" by its number), customer, issued between (Kathmandu days → `from`/`to`), **Overdue only** (`?overdueOnly=true` — the overdue notification's link); columns number + status, customer (tap to call), issued and due **in AD and BS** (`AdBsDate`), total, paid, balance (`formatBalance` — never negative; a void invoice reads "Void"). `invoices:write` (ADMIN, ACCOUNTANT): **Create from job** (`components/finance/InvoiceFromJobSheet`) and **New invoice** (`NewInvoiceSheet`, the manual one for AMC fees and one-off work). A row: Open, Print, and what its state allows (`useInvoiceActions`) |
| `/admin/invoices/:id` | `InvoiceDetailPage/` | The header (number, status in words — and since Phase L6 its kind badge — customer, the jobs and quotation it bills, an advance's `job` and payment stage, Print, Customer link, the state's actions, the server's Total · Paid · Balance) and tabs: **Edit** (a DRAFT to `invoices:write` only — `sections/InvoiceEditForm`: the lines through the kit's `lineItems` field, invoice variant, then discount, VAT, due date, note, terms; `PUT` re-prices on the server; a 422 **INVOICE_LOCKED** is told in words, `INVOICE_LOCKED_MESSAGE`. Since Phase L6 a stage or closing bill — `kind` ADVANCE, RUNNING or FINAL, `helpers/finance#invoiceLinesLocked` — has **locked lines**: its draft shows the lines, discount and VAT read-only (`LineItemsTable` + `TotalsList`, a final bill's "Less: advance …" as "− Rs. …") and its form (`INVOICE_HEADER_FIELDS`, `finance.schema#invoiceHeaderEditSchema`) edits and sends only the due date, note and terms; a 422 **INVOICE_LINES_LOCKED** is told in words, `INVOICE_LINES_LOCKED_MESSAGE`), **Invoice** (`components/documents/InvoiceDocument` — the public page's own component — and the customer link card; a sent one says it can no longer be edited), **Payments** (`sections/InvoicePaymentsTab`: received in AD + BS, method, reference, amount; a voided one struck through (`<del>`) with why; "Void payment…" for `payments:write`), **History** (`invoices:history`). Actions: **Send** (confirm → the link dialog: Copy, Open, WhatsApp in the customer's language), **Record payment** (sheet), **Void** (a reason; off while payments still count) |
| `/admin/invoices/:id/print` | `InvoicePrintPage` | outside the shell, like the quotation print: `InvoiceDocument` without the status badge on an A4 `print-sheet` (light palette), Back and Print |
| `/admin/finance/payments` | `PaymentsPage` | `payments:read`. Every payment: search by reference / invoice number / customer (Enter), filters method, received between, customer; voided rows struck through; the footer is `components/finance/PaymentTotals` — the server's `meta.totals` (total, count, each method) over **every page** under the filters, never the rows on screen, never a voided payment |
| `/admin/expenses`, `/new`, `/:id` | registry entry `expenses` | see below |
| `/admin/finance/reports` | `FinanceReportsPage/` | `reports:finance`. Tabs (`?report=`): **Aging** (as of now — the dates do not apply; the five buckets as `ReportFigures` buttons with a proportion bar, each drilling down to its invoices below (`?bucket=`), then by customer), **Revenue** (`?groupBy=month|service|technician`: taxable, VAT, invoiced, collected, outstanding and the totals; by month also a `ColumnChart` of invoiced with its table twin), **Collections** (the total and each method, then the newest 500 payments — it says so when there are more), **Customer statement** (pick a customer, `?customerId=`; `components/finance/CustomerStatement`) |
| `/admin/reports/:group` | `ReportsPage/` | Phase I10. `sales` (`reports:sales`: Lead sources, Funnel, SLA compliance, Lost leads — Phase L1's report folded in; `LostReportPage` is gone), `operations` (`reports:ops`: Technicians, Warranty claims by service and by type), `job-margin` (**`costs:read` only** — the money wall). The group checks its own capability and a role without it is sent to its first group (or `/admin`); `/admin/reports` opens the first; `/admin/reports/lost` (the old address) redirects to `sales?report=lost`, keeping its query. Groups and tabs are data: `financeViews#REPORT_GROUPS` |

**Expenses** are a registry entry (`config/admin/resources/expenses.jsx`, own `basePath`, `expenses:read` /
`expenses:write`, History `expenses:read`): category (a text field that **suggests** the categories in use —
`suggestionsFrom: { path: '/admin/expenses/categories', tag }`), amount (`money`), spent on (`date`), paid to, the job
(`relation` to `/admin/jobs` — a job's expenses are its cost), the bill photo (the kit's **`photoUpload`** field: choose or
take a photo, shrunk on the device and uploaded at once to `POST /admin/expenses/bill` — `expenses:write`, so the accountant,
who holds no `media:*`, never needs MediaPicker — its id saved as `billMediaId`; Replace, Remove sends null) and a note. `approvedBy` is the server's (who records it); the list
shows `approver.name`, the job's number and the bill's thumbnail from the row's `bill`. **No switch and no reorder**
(`toggle: false`, `sortable: false` — the model has neither); delete is soft with Trash and Restore; filters category
(text), job, spent between; the footer is the server's `meta.totals.total` (`footer(meta)`).

The kit grew, for these screens only:

- `lineItems` **`variant: 'invoice'`** — description, unit, qty, rate (rupees) and the server's amount (`figures` by the
  saved line's id; a changed line shows "—" until saved); items only — no sections, notes, waste, library or drawers; a
  line's `jobId` rides along (`helpers/boq#toBoqRows` keeps it). `form/schemas/finance.schema#invoiceLinesSchema` sends
  `{ description, unit?, qty, rate, jobId? }`.
- `text` fields take `suggestions` (`string[]`) or `suggestionsFrom` (`{ path, tag? }` → `lookupApi#getSuggestions`, an
  endpoint answering `string[]`) as a datalist.
- a **`photoUpload`** field type (`fields/PhotoUploadField.jsx`, registered in `FieldRenderer`) — one photo uploaded to the
  form's own endpoint; the expense's bill.
- `ResourceForm` `sheetClassName` (the manual invoice's sheet is `sm:max-w-3xl`); `ColumnChart` `formatValue` (money on a
  cap: `formatNprShort`).
- Registry entries may say `toggle: false` and `footer(meta, { inTrash })`; `resourceRegistry.test.js` reads
  `finance.routes.js` too and allows `text` filters.

Shared pieces:

- **`components/reports/`** — built once, used by both report pages: `ReportToolbar` (the kit's `DateRangeFilter` on
  `from`/`to`, quick ranges — last 30 · last 90 · **this fiscal year** from Shrawan 1 — the range again in BS, a slot for
  a grouping, and the CSV), `ReportCsvButton` (the API's `?format=csv` with the page's filters through
  `financeApi#downloadReportCsv` — Bearer token, refresh-on-401 — saved with the BOM put back, named by the API's
  `Content-Disposition`; a toast says when `X-Export-Truncated` capped it at 10,000 rows), `ReportTable` (a whole answer
  in `CustomTable`: one page, no search), `ReportFigures` (headline figures; a tile may be a button with a proportion bar).
  `hooks/useReportParams` keeps a report's range (the last 30 Kathmandu days to start — what the API assumes), tab and
  grouping in the URL; `reportQueryParams` is what the query and its CSV both send.
- **`components/finance/`** — `InvoiceFromJobSheet` (the billable, not-invoiced jobs — `GET /admin/jobs?invoiced=false` —
  each with **how it bills**, `helpers/finance#billingRuleOf`: its quotation as accepted, or what it used; a quoted job is
  asked only a due date and is never sent `includeMaterials`/`includeLabour`; since Phase L8 a quoted job's **final-bill
  preview** comes first and a `job` prop opens it on one job — see "Close-out & final bill (Phase L8)"), `NewInvoiceSheet` + `invoiceFields.js`
  (`INVOICE_LINE_FIELDS`, shared with the draft's edit form; since L6 `INVOICE_HEADER_FIELDS` — due date, note, terms — for a draft with locked lines), `RecordPaymentSheet` (`paymentFormSchema(balance)`),
  `InvoiceLinkCard`, `PaymentTotals`, `CustomerStatement` (the customer page's Statement tab renders it too).
- **`components/documents/InvoiceDocument`** + **`InvoicePayments`** — the invoice as the customer reads it: dates in AD and
  BS, the lines (`LineItemsTable`), subtotal, discount, VAT, total, paid and the balance (**Amount due** / **Settled**,
  never negative); a void invoice says so and owes nothing; payments with voided ones struck through (`detailed` adds the
  reference and why). `pages/public/InvoicePublicPage` renders it (its `PaymentHistory` section moved here) with the
  token endpoint's own `balance` — the page works nothing out.
- **`hooks/useInvoiceActions.jsx`** — `const [runAction, dialogs] = useInvoiceActions()`, then
  `runAction('send' | 'recordPayment' | 'void' | 'voidPayment' | 'link', invoice, payment?)`: the one way a screen sends,
  voids or takes money. `helpers/finance#invoiceActions(invoice, { can })` says what a state allows and why a button is
  off; `canEditInvoice` is the DRAFT rule.
- **`components/common/AdBsDate`** — a date as the finance screens state it: AD (Kathmandu) with its BS twin under it.

**Money and BS helpers** (both tested against hand-computed values):

- `helpers/format.js` — `formatNpr` (Nepali grouping, `Rs. 1,23,45,678.90`, en-IN), `formatBalance` (the server's
  balance, never below zero), `kathmanduDay`, **`formatDateBs(iso, { long, locale })`** (the BS date of the day it was in
  **Kathmandu** — a due date stored as 18:15 UTC is the next day's), `formatDateAdBs` ("17 Jul 2026 (2083-04-01 BS)"),
  `fiscalYearOf` ("2083/84").
- `helpers/nepaliDate.js` — **a byte-for-byte copy** of the API's `utils/nepaliDate.js` (the conversion table, `adToBs`,
  `bsToAd`, `formatBs`, `fiscalYear`, `fiscalYearLabel`, the month names in en and ne). Never edit it here:
  `nepaliDate.test.js` fails unless the two files are identical, and checks the functions agree on every day of
  2025–2027 and every 5th day 2000–2034, and the Shrawan 1 boundary (2083 Shrawan 1 = 17 July 2026: the day before is Ashadh 32 and FY 2082/83).
- `helpers/finance.js` — `invoiceActions`, `canEditInvoice`, `standingPayments`, `billingRuleOf`, `defaultReportRange`,
  `reportRangePresets` (this fiscal year from Shrawan 1), `csvFileName`.

Also:

- `api/financeApi.js` — invoices (list with `meta.counts`, one with `balance`/`publicUrl`/`jobs`, create, from-job, update,
  send, void, payments and their void), payments (with `meta.totals`), the finance reports, the sales and operations
  reports and `downloadReportCsv` (lazy, `keepUnusedDataFor: 0`, `{ csv, truncated, disposition }`). Every write that
  moves money invalidates the invoice, `Invoice`/`Payment` LISTs, `Report`, `Customer`, `History` and `Dashboard`; from-job
  also the job. `reportsApi.js` keeps the lost-lead report. An expense save (through `cmsApi`) refreshes `Job` (costing)
  and `Report`.
- `form/schemas/finance.schema.js` mirrors the API's invoice, from-job, payment, void and expense bodies (an optional date
  cleared is left out, never sent as null — `z.coerce.date()` would read 1970). `config/constants.js` has
  `INVOICE_STATUS_LABELS` and `PAYMENT_METHOD_LABELS`; `config/admin/financeViews.js` the invoice tabs, the aging buckets,
  the revenue groupings, the payment method options and the report groups.
- The customer page's **Invoices** tab links each invoice and shows the server's balance; its **Statement** tab is
  `CustomerStatement` (with its CSV).
- Tests: `pages/admin/FinanceScreens.test.jsx` (the README fixture — 3 lines × 210.5 sq.ft, a discount, 13 % VAT — shown to
  the paisa and a doctored server figure shown as sent; a partial eSewa payment then its void, the balance back up and
  the row struck through; a negative balance shown as Rs. 0.00; DRAFT-only editing and `INVOICE_LOCKED`; the payment sheet
  refusing more than the balance; the invoice tabs, counts and the overdue link; Create from job's billing rule; the
  payments footer from `meta.totals`; the expenses entry — no switch, the total, category suggestions, rupees, the bill
  photo uploaded to `/admin/expenses/bill` (a mocked POST; its id sent as `billMediaId`), a saved bill shown, Remove sent
  as null, a refused upload told; the public page showing the server's `balance`, and a void one owing nothing; the CSVs with the filters on screen; aging drill-down; collections; the statement; job
  margin for `costs:read` only), `helpers/finance.test.js` (grouping, balance, BS by Kathmandu day, the actions, the
  fiscal-year preset, the enum mirror, each report group's nav item), `helpers/nepaliDate.test.js`,
  `form/schemas/finance.schema.test.js` (the same bodies through the form's schema and the API's — lines in rupees with
  Indian grouping, a payment to the paisa of the balance, Devanagari), the Finance and Reports blocks in `adminNav.test.js`,
  and `recordLinks.test.js` (an invoice, its payments and lines, an expense).
- End to end: `e2e/finance-flow.spec.js` — see the e2e list at the top.

## Aftercare screens (Phase I)

Warranties, their claims, AMC contracts and service reminders — the **Aftercare** nav group (Home tab). The API guards
them with capabilities that replaced `aftercare.routes.js`'s role lists with the same effective access, mirrored in
`helpers/permissions.js` (`config/aftercareMirror.test.js` holds both the map and who holds what):

| Capability | Held by |
|---|---|
| `warranties:read`, `amc:read`, `reminders:read` | SALES, MANAGER, DISPATCHER (+ ADMIN via `*`) |
| `warranties:write`, `amc:write`, `reminders:write` | DISPATCHER (+ ADMIN) — dispatch decides claims (an accepted one is a job to schedule) and runs contracts and reminders |
| — | ACCOUNTANT holds none: no Aftercare group, no Warranties or AMC tab on a customer |

Each route sits under `RequireAuth capability="…:read"`; every write button checks its `…:write` (a reader gets the
page read-only). The nav only hides — the API refuses.

| Route | Page | Does |
|---|---|---|
| `/admin/warranties` | `WarrantiesPage` | CustomTable under status tabs (`?view=` — All · Active · Claim open · Expiring soon · Expired · Void). **Expiring soon** is active cover ending within N days (`expiringDays`; an "Ending within" filter of 7 · 14 · 30 · 60 · 90 in `?days=`, 30 to start, soonest first). Search: customer, phone or job number. Columns: the job, the customer (tap to call), what it covers, status with the claim count, "Covered until" with the days left (amber within 30). A row's menu copies or opens the certificate |
| `/admin/warranties/:id` | `WarrantyDetailPage` | cover (scope, from, until, the void reason), the **certificate link** (`publicUrl`, else built from the token — Copy / Open), the job, the customer, and every claim (status, what the customer wrote, the reject reason or the free job with its status, "Decide…" into the queue). `warranties:write`: **Edit** (a `ResourceForm` sheet — scope and "Covered until", a `date` field at 23:59 Kathmandu; the schema strips anything else, so no status is ever sent) and **Void…** (a `FormDialog`: a reason of 3–500 characters, required — `POST /void`). A void warranty is read-only. Tabs **Details** · **History** (`?tab=history` — `RecordHistory` on `/admin/warranties/:id/history`, `warranties:read`, loaded only when opened) |
| `/admin/warranty-claims`, `/admin/warranty-claims/:id` | `WarrantyClaimsPage` | the claims queue in the API's order — **open first**, then accepted, then the rest, newest first within (tabs `?view=`: All — open first · Open · Accepted · Rejected · Resolved). A row opens `ClaimDecisionSheet` at the claim's own address, which is where the claim notification links; closing it keeps the list's filters |
| `/admin/amc-contracts` | `AmcContractsPage` | tabs Active · **Renewals due (60 days)** (`renewalsDays=60`, soonest end first; `?renewals=true` — the renewals notification's link — opens it too) · Expired · Cancelled · All; columns number, customer and site, plan and services, term ("Ends in 23 days"), visits done, amount (`formatNpr` of the server's paisa) with the billing cycle, status. `amc:write`: **New contract**, and a row's Renew… / Cancel contract… |
| `/admin/amc-contracts/:id` | `AmcContractDetailPage` | customer and site, the plan (amount, billing, covered services, notes), the term, and **the visits** (a short CustomTable: due date, `pending` "Not booked yet" · `scheduled` "Job made" · `completed` · `missed`, the job made for it with its status and time). `amc:write`: **Renew…**, **Edit** (plan, services, amount, billing, notes, site — never the schedule, which the API refuses: a new schedule is a renewal), **Cancel…** (`PUT { status: 'cancelled' }`, so it stays under Cancelled) / **Reactivate…**, and **Remove** (`DELETE` — the API's soft delete hides it from every list; for a contract made by mistake). Tabs **Details** · **History** (`?tab=history` — `RecordHistory` on `/admin/amc-contracts/:id/history`, `amc:read`) |
| `/admin/service-reminders` | `ServiceRemindersPage` | tabs Pending (the start, soonest first) · Sent · Failed · Skipped · All; customer and "Goes out" (`from`/`to`, Kathmandu days) filters; search message, customer or phone. A Nepali message is `lang="ne"`. `reminders:write`: **New reminder**, and — **while pending only** — Edit (a row click or the menu) and Delete (confirmed); for any other state both stay in the menu, disabled, and the row says why (`helpers/aftercare#reminderLock`) |

**The decision sheet** (`components/aftercare/ClaimDecisionSheet`) — a `ui/sheet` with the claim (what the customer
wrote, the original job, the warranty and its end, the customer with tap-to-call), `ClaimRatePanel`, and for
`warranties:write` the decisions the claim's state allows (`helpers/aftercare#claimDecisions`, the API's rule), each a
`ResourceForm`:

- **Accept** (an open claim) — an optional "Visit on" `datetime`; `PATCH { status: 'accepted', scheduledStart? }`. The
  answer's `resolvedJob` shows as "Free warranty job JOB-… created", with **Open JOB-…** and the dispatch board: the job
  is unassigned, so it waits in the dispatch queue.
- **Reject** (an open claim) — a required reason (`claimRejectSchema`); the customer is sent it.
- **Resolve** (an open or accepted claim).
- **422 `CLAIM_DECIDED`** (someone else decided first): an alert with the API's message, a toast, and the claim
  refetched — the sheet then shows where it stands and offers only what is left.
- `ClaimRatePanel` — `GET /admin/reports/warranty-claims` over the last 365 Kathmandu days, only for `reports:ops`
  (DISPATCHER; ADMIN): the rate for the claim's service — a claim row's `warranty.job.service` is the service name the report groups
  by (its lead's, else its quotation's lead's), or null; `claimService` reads it and `claimRateFor` picks that `byService`
  row — else, when it is null or unlisted, its job type (`byType`), else all work — beside the overall rate. A 403 or
  failure shows no panel.

**The AMC create sheet** (`components/aftercare/AmcContractSheet`) — customer, site (the customer's, as the job form
does it), plan, covered services (a `checklist` of the catalogue's names from `/admin/services` — `hooks/useServiceNames`,
`services:read` — matched ignoring case, so the seed's `plumbing` is the catalogue's Plumbing; a `stringList` when the
catalogue cannot be read), start / end (`date`), visits a year, then **the visit schedule** — `AmcSchedulePreview`, a
`preview` field that sends the three schedule inputs (debounced, once `amcSchedulePreviewSchema` passes) to
`POST /admin/amc-contracts/preview` and lists exactly the visits create will lay down; the client never spaces visits
itself — then amount (`money`, typed in rupees with grouping), billing cycle, notes. **Renew** opens the same sheet from
`helpers/aftercare#renewalDefaults(contract)`: the day after it ends (Kathmandu), the same number of days, plan,
services, visits, amount (the paisa it came with — the form shows rupees), billing cycle and site, and "Renewal of AMC-…".

**The reminder sheet** (`components/aftercare/ReminderFormSheet`) — customer (fixed once saved), "Send at" (`datetime`,
Kathmandu), SMS or email, an optional job (the customer's) and service, the message (5–1000), and under it
`ReminderMessageCounter`: Phase G's `components/common/SmsCounter` for SMS — one Devanagari letter makes the whole
message Unicode, 70 characters a part (67 once split) — or the length for email.

Also:

- `api/aftercareApi.js` — every endpoint above. Lists are tagged `{ type, id: 'LIST' }` (`Warranty`, `WarrantyClaim`,
  `AmcContract`, `Reminder`) — the tags the customer page's record tabs read. A claim decision also invalidates the
  warranties, `Job` LIST, `Dispatch`, `Dashboard`, `Notification` and `History`. `previewAmcSchedule` is a **query**
  although it is a POST (it reads). `getWarrantyClaimRates` is the claims report.
- `form/schemas/aftercare.schema.js` — mirrors the API's `warrantyUpdateSchema`, `warrantyVoidSchema`,
  `warrantyClaimDecisionSchema`, `amcContractSchema`, `amcSchedulePreviewSchema`, `amcContractUpdateSchema` and
  `serviceReminderSchema`; `aftercare.schema.test.js` runs the same bodies (Devanagari, the 5-year limit, `-1` rupees)
  through both. The forms strip what they do not name, where the API's bodies are `.strict()`.
- `config/admin/aftercareViews.js` — the four lists' tabs as data (`viewQuery(views, params, fallback)` → the API's
  query; `selectView` → page 1 and no leftover `days` / `renewals`), `RENEWALS_DAYS`, the "Ending within" options, the
  status → tone maps, `SERVICE_LOOKUP`. `config/admin/aftercareForms.js` — `amcPlanFields`, shared by create and Edit.
- `config/constants.js` — `WARRANTY_STATUSES`, `CLAIM_STATUSES`, `AMC_STATUSES`, `AMC_BILLING_CYCLES`,
  `AMC_VISIT_STATUSES`, `REMINDER_STATUSES` with their `*_LABELS`, and `REMINDER_CHANNEL_LABELS` (mirror-tested).
- `helpers/aftercare.js` — `coverLeft` ("12 days left", by Kathmandu day), `kathmanduDaysBetween`, `contractEndsIn`,
  `certificateUrl`, `claimDecisions`, `claimService`, `claimRateFor`, `renewalDefaults`, `matchServices`, `reminderLock`.
- Links in: the customer page's **Warranties** and **AMC** tabs (were "Soon") list the customer's records and open them
  (`warranties:read` / `amc:read`, not a role list); a job's Overview links its warranty; audit rows open a warranty,
  claim, contract (and a visit's contract) or the reminders (`helpers/recordLinks.js`); `config/auditEvents.js` words
  `warranty.voided` and `warranty.claim_decided` (group Warranties). The dashboard's cards that said "Soon" now link:
  Outstanding → the aging report, Unpaid invoices → `/admin/invoices`, Active warranties → `?view=active`, AMC renewals
  → `?view=renewals`; the revenue and lead-source charts open their reports.
- Tests: `pages/admin/AftercareScreens.test.jsx` (the claims queue — open first, accept makes and links the free job,
  reject needs a reason, `CLAIM_DECIDED`; the warranty's certificate and void-with-a-reason; the expiring preset; the
  AMC create sheet's live schedule from a mocked `/preview` and rupees sent; Renew's prefill; the renewals preset;
  reminders — pending-only edit and delete, the SMS counter with Nepali; each screen read-only for SALES; the claim rate by
  service and its type fallback; each detail page's History tab; the customer
  tabs), `helpers/aftercare.test.js`, `config/aftercareMirror.test.js`, `form/schemas/aftercare.schema.test.js`, the
  Aftercare block in `adminNav.test.js`, and the Phase I link test in `DashboardPage.test.jsx`.
- End to end: `e2e/aftercare-flow.spec.js` — see the e2e list at the top.

## The admin shell

`components/layout/AdminLayout/` renders `config/admin/adminNav.js`, which is pure data and pure functions (tested
without a DOM in `adminNav.test.js`):

- **`ADMIN_NAV`** — eleven groups, each in one of the sidebar's four **`NAV_TABS`**:
  **Home** (Overview · Sales · Operations · Finance · Aftercare — the daily work), **Helpers** (Catalog — rate card,
  job templates, materials, material categories, suppliers · Page blocks · Messaging — message templates),
  **Others** (Content · Blog & pages — the website) and **Settings** (Platform). The content groups all point under
  `/admin/content/…` and need `cms:read`; Page blocks holds the pieces the home page's bands are made of (features,
  list items, content blocks, process steps). Platform holds Users, Roles & permissions, Login activity, Audit log and
  Messages (ADMIN only — Phase G) and Settings (`/admin/platform/settings`, `settings:read`). A group moves tab by
  changing its `tab`. An item is `{ to, label, icon, capability?, end?, soon? }`; `soon` renders greyed with a "Soon" tag,
  never as a link.
- **`navTabsForRole(role)`** / **`activeNavTab(pathname)`** — the tabs a role sees (an empty one is dropped) and
  the tab a path belongs to; the sidebar follows the page, and clicking a tab only changes what it lists.
- **`navForRole(role)`** — the items the role's capabilities allow, empty groups dropped. The same map the API
  enforces (`helpers/permissions.js`); the nav only hides, the API refuses.
- **`landingPathFor(role)`** — where `/admin` sends a role. An EDITOR lands on Content (`/admin/content` →
  Home page), and the Dashboard item is hidden from a role that lands elsewhere. `routes/AdminLanding.jsx` does the redirect.
- **`contentHomeFor(role)`** — the first built Content screen the role can open.
- **`breadcrumbsFor(pathname)`** — group › screen › New / Edit / Details, from the nav (Edit for any screen under
  `/admin/content/`, Details elsewhere; an item's `editLabel` overrides the last word — the rate card says Edit although
  it is in Sales); `AdminBreadcrumb` shows it
  in the header, so no page sets its own.

- **`activeNavPath(pathname)`** — the item a path belongs to, by the same longest match as the breadcrumbs, so
  `/admin/leads/board` lights Pipeline and not Leads. The sidebar uses it instead of `NavLink`'s own matching.
- An item's **`badge`** names a live count (`slaBreached` on the SLA board: leads past their deadline). `hooks/useNavBadges`
  polls it at `SHELL_POLL_MS` (one minute), only for a role that can open the screen.

The shell around the nav:

- **Sidebar** (`AdminSidebar`) — an ink panel: brand, the four tabs as a segmented control (a red dot on a tab hides
  an SLA breach), "Find a screen" (matches across every tab), folding groups (remembered per browser) and the
  signed-in user. On desktop it folds to an icon rail (`uiSlice.sidebarOpen`, remembered per browser); on a phone it
  is the drawer (`uiSlice.mobileNavOpen`).
- **Top bar** — the breadcrumb (the screen's name on a phone), the search button, Kathmandu time, the bell, the
  theme toggle and the account menu. The menu sets the theme and the **Calendar** — English (AD) or Nepali (BS),
  `common/CalendarModeSwitch` → `uiSlice.calendar` (`hooks/useCalendarMode`, remembered per browser like the theme,
  `config/locale.js#CALENDARS`). It is display only: the clock's day (in BS, in Nepali script — "आइत १८ असोज") and the
  SLA board's calendar read in it; the API and every input stay AD.
- **Command palette** (`CommandPalette`, `hooks/usePaletteHotkey`) — Ctrl/⌘+K anywhere: every screen the role can
  open, your shortcuts, your notes, and shell actions (theme, sidebar, sign out). `uiSlice.commandOpen`.
- **Shortcuts strip** (`ShortcutBar`) — the user's pinned screens (up to 12), a star that pins the page on screen
  (name and icon from `config/admin/shortcuts.js`'s `suggestShortcut`, editable) or unpins it, and a manager to
  rename, re-icon, drag-reorder and remove them. Stored per user by the API (`/admin/me/shortcuts`, `api/meApi.js`),
  so they follow the user between devices; icons are stored by name from `SHORTCUT_ICONS`.
- **Notes** (`NotesSheet`) — private sticky notes (`/admin/me/notes`), five colours (`--note-*` tokens), pinned
  first, edited in place, searchable once there are a few. `uiSlice.notesOpen`.

The sidebar's brand comes from `useSiteSettings` (the company name in settings). The bell is `NotificationPanel`:
the unread count polls every `SHELL_POLL_MS` (the dashboard refreshes on the same beat); the list loads when the panel
opens; opening an item marks it read and navigates to `notificationHref(link)`; "Mark all as read" clears the badge.
Since Phase E the API writes every staff link as an `/admin/...` path (`/tech/...` for field staff);
`notificationHref` still reads the older `/leads/:id` and absolute forms, which remain in the database. A query string is
kept: Phase L1's reminders open `/admin/leads/:id?markLost=1` and `/admin/leads?nextAction=due_today|overdue`.

## three/

Both kinds of motion, in one place.

- `three/motion/motionKit.jsx` — Framer Motion primitives (`Reveal`, `Stagger`, `Tilt`, `Magnetic`,
  `Marquee`, `CountUp`, `WordReveal`, `ScrollStage`…). Every one of them respects
  `prefers-reduced-motion`; use `useMotionVariants` when you add another.
- `three/scenes/` — WebGL. `BlueprintScene` is ~120 kB gzipped of three.js, so scenes
  are **always** `lazy()`-imported at the call site and never re-exported through a
  barrel — that is what keeps them out of the initial bundle.

A scene becomes a folder on the same rule a page does. `SectionCutScene/` is split by
the question each file answers, which is what keeps a 1,000-line procedural model
readable:

```
SectionCutScene/
├── SectionCutScene.jsx  the browser end: renderer, camera rig, observers, caption
├── constants.js         the drawing, in metres
├── profiles.js          the turned profiles and the drilled cement board
├── model.js             builds it — geometry, materials, lights, the whole graph
├── palette.js           CSS variables → materials and lights, re-read on theme change
├── timeline.js          what the scene is doing at time t — pure, touches no graph
├── pose.js              applies a pose to the graph — the only writer
├── easing.js            the four curves the timeline is written with
└── rooms.js             the five fit-outs the model cycles through
```

`timeline.js` and `pose.js` are the split that matters: because a pose is a plain
object and only `applyPose` writes to three, the reduced-motion still frame is a
composition no moment on the timeline produces, and a resize or a theme change
re-applies the last pose instead of guessing a time. Everything but the entry file
runs without a DOM, so the model can be built and driven in a plain node script.

## pages/

`public/` (landing, services, pricing, projects, booking, the token-addressed
quotation/invoice/warranty views, **and login**), `admin/`, `tech/`. Every page is
`lazy()`-loaded from `routes/`, so the marketing site never downloads the back office.

`admin/` has two folder pages since Phase E: `LeadBoardPage/` (the page, `BoardColumn` — one status, its own query and
drop target — and `BoardCard` with its "Move to" menu) and `CustomerDetailPage/` (the page and `sections/`: sites,
timeline, the record tabs, statement).

A page is one file until it stops being readable as one. When it grows past that,
it becomes a **folder of the same name**, and the whole public site is now built
that way:

```
public/
├── HomePage/            hero, promise strip, and every CMS-driven band
├── ServicesPage/        the catalogue: toolbar + grid, sorting in servicesSort.js
├── ServiceDetailPage/   masthead, body, FAQs, related work, the enquiry panel
├── PricingPage/         the estimator column, the packages, the rate card
├── ProjectsPage/        filter + grid
├── ProjectDetailPage/   facts, the problem→work→result story, gallery, CTA
├── ContactPage/         the form, the direct lines, the map
├── BlogPage/            /blog: category chips (in the URL) + the post grid
├── BlogPostPage/        /blog/:slug: header, article, CTA; postSeo.js is its Article JSON-LD
├── GenericPage/         /:slug: an editor's page (About…); a 404 renders NotFoundPage
├── LoginPage/           the WebGL stage, the form, and useLoginFlow beside them
├── QuotationPublicPage/ }
├── InvoicePublicPage/   } token-addressed, all three built from components/documents/
├── WarrantyPublicPage/  }
├── VisitPublicPage/     token-addressed too (Phase L5): the customer confirms a site visit, en/ne, 360 px
└── BookingPage.jsx      still one file, because it still reads as one
```

Each folder holds the same four kinds of thing, and nothing else:

```
ServiceDetailPage/
├── ServiceDetailPage.jsx  the route target: fetch, the three states, the order
│                          of the bands — and no markup of its own
├── serviceSeo.js          pure logic this page needs (here, its JSON-LD)
├── useLoginFlow.js        …or a hook, where the behaviour is stateful (LoginPage)
└── sections/              one file per band, named for what it renders
```

The entry file repeats the folder name — `@/pages/public/HomePage/HomePage` — so the
editor tab says which page you are in. Everything in the folder is private to that
page; the moment a second page needs one of these components it moves to
`components/`, by the rule above. The chunk is named from the file, so the bundle
report stays legible without help from `vite.config.js`.

A section file renders one band and owns no fetching. If it needs data it takes a
prop, which is what keeps the page's own file a readable table of contents.

## routes/ and providers/

`routes/AppRoutes.jsx` is the whole route table (the field shell, `TechLayout`, is `lazy()` there since Phase H2, so its sync
engine and the field API stay out of the marketing bundle); `routes/RequireAuth.jsx` gates by role or
capability. The router is a **data router** (`createBrowserRouter` in `AppProviders`, one splat route
around `<AppRoutes>`), because `useBlocker` — the unsaved-changes guard — only works in one. The
route table itself is still plain `<Routes>`. `routes/AdminLanding.jsx` holds the two redirects of the admin
shell (`/admin` per role, `/admin/content` to the first content screen). `providers/AppProviders` composes store → router → theme →
the route's language (`LocaleProvider`, Phase J1 — English under `/admin`, the visitor's choice elsewhere; `<html lang>` and
the Devanagari font; see "Words — English and Nepali") → tooltips → scroll and session effects, so `main.jsx` stays a mount point.

Render errors are caught in `components/common/ErrorBoundary/` at three levels: `PageOutlet` wraps each page in a
`RouteErrorBoundary` (the shell stays up, and any navigation clears it); `RouterShell` wraps the route table in
another, and the splat route's `errorElement` (`RouterErrorElement`) replaces React Router's bare error screen; an
outer `ErrorBoundary` around the store and router catches the rest. The fallback shows the stack, the component stack,
a copy button and a Vite open-in-editor link in development only, and a "reload" prompt for a stale lazy chunk.
A query error is not a render error — that stays `ErrorState`'s job.

The public group ends with **`/:slug`** (`GenericPage`, an editor's page). Static routes outrank a dynamic one, so
`/login`, `/admin` and every fixed public page win; the page form refuses those addresses (`RESERVED_SLUGS`). The
catch-all `*` still handles deeper unknown paths.

`providers/SessionEffect` restores the session once per page load: the refresh token rotates on each use, and React's
StrictMode runs the effect twice in development, so the two runs share one in-flight request (a second request with
the same cookie is refused, and its 401 used to sign the user out).

### The theme

Colour mode is the one piece of UI state with a context of its own, because two
different values are wanted in two different places:

| | | |
|---|---|---|
| `mode` | `'light' \| 'dark' \| 'system'` | what the user chose. Persisted in `uiSlice`. |
| `theme` | `'light' \| 'dark'` | what that resolves to right now. Derived, never stored. |

A control that *changes* the palette needs `mode` — a three-way switch showing
"light" for a system preference that merely happens to be light today is wrong. An
icon or a WebGL palette that *reflects* it needs `theme`. Deriving both in every
consumer is how the header and the login screen drifted apart, so it is derived
once in `providers/ThemeProvider.jsx` and read through `hooks/useTheme.js`.

The provider is also the only thing that touches `document.documentElement` for
colour: the `dark` class, `color-scheme`, `data-theme`, `<meta name="theme-color">`,
one frame of suppressed transitions during a swap, and the `storage` listener that
keeps two open tabs agreeing. `config/theme.js` holds the vocabulary — the modes,
the storage key, the resolver, the two chrome colours.

The first paint happens before React exists, so `index.html` carries a small inline
script that answers the same question the same way. It and `config/theme.js` are a
deliberate copy of one rule; change them together.

## redux/

`store.js` is the store. `slices/` holds UI state only — **server state belongs in
`api/`**, never mirrored into a slice. `fieldSyncSlice` (Phase H2) mirrors the field app's on-device queues — client
state, not server data.

## form/

`schemas/fields.js` holds field-level building blocks (`nepaliPhone` — a mobile or a landline with its area code —
`optionalPhone`, `optionalEmail` — trimmed and lower-cased, as the API stores it — `preferredLocale`, `personName`,
`rupees`); the `*.schema.js` files compose them. `lead.schema.js` has the public form (with an optional email), the
staff lead (`adminLeadSchema`), the lost reason (category + words), the activity — `leadActivitySchema` (the API body)
and `activityFormSchema` (the composer's flat values), both checked by `leadOutcomeIssues`, the API's outcome rules —
`activityBody`, `nextActionSchema`, `qualificationSchema` and the convert site (`lead.schema.test.js`); `customer.schema.js` has the
customer and site and `parseMapPin`. `contactFields.test.js` covers mobile, landline and invalid numbers on every
contact form, email normalisation and Devanagari names. These mirror the backend's zod
schemas — when an API rule changes, change it here in the same commit. `cms.schema.js` mirrors the
whole of the API's `shared/schemas/cms.js`, one schema per CMS resource, for the registry entries, plus
`mediaUpdateSchema` and `mediaFolderSchema`; `rateCard.schema.js` mirrors `rateCardItemSchema`, `recipeComponent` and
`tradeSchema` from the API's `shared/schemas/crm.js` (Phase L2). `cms.schema.test.js` runs the API's own service cases
(`MaintainanceBackend/tests/fixtures/serviceSchemaCases.js`) against the mirror, and checks `UNITS` against the
API's `shared/enums.js` — the one test import that is a relative path, because the fixture is outside `src/`.
There is no `formKit.js`-style barrel for it: import the schema you need.

Phase L5 added `visit.schema.js` (`visitResponseSchema` — the customer's answer to a visit, mirror-tested against the API's
own) and `inspectionTemplate.schema.js` (see "The site-visit kit (Phase L5)"); `lead.schema.js` gained
`visitBookingSchema` / `visitBookingBody` and the site contact on `convertSiteSchema`, `customer.schema.js` the site's
contact and landmark.

`useZodForm(schema, options)` is the only place `zodResolver` is imported. Since Phase J1 it words every error in the
screen's language through `form/zodMessages.js` (an error map for unworded issues, and the `vKey('…')` message keys that
`fields.js` uses) — see "Words — English and Nepali (Phase J1)".

## config/ vs helpers/

`config/` is data that describes the system: `constants.js` (enums mirroring the
backend — including `LEAD_TRANSITIONS`, the lead state machine the status menu and the board offer, the loggable
activity types, and Phase L1's `LEAD_OUTCOMES` / `REACHED_OUTCOMES`, `NEXT_ACTION_TYPES`, `LOST_CATEGORIES`,
`PROPERTY_TYPES`, `BUDGET_BANDS` and `DECISION_MAKERS`, each with its `*_LABELS`; `config/crmMirror.test.js` imports the
API's own files and fails when they drift or a value has no words — plus
`SHELL_POLL_MS` and status→Tailwind maps), `auditEvents.js` (every `AUDIT_EVENTS` name in words, for History; the same
test checks the list), `env.js` (the single place `import.meta.env` is read),
`locale.js` (timezone, currency, the Nepali phone rule; since Phase J1 `NE_DISPLAY_DIGITS`, `DEVANAGARI_FONT_URL` and
`isEnglishOnlyPath` — `/admin` stays English), `i18n/` (the catalogues — see "Words — English and Nepali (Phase J1)"), `theme.js` (the colour
modes and how one resolves), and `site/` — the storefront's own copy: `siteNav.js`
(the nav — `siteNavFor(nav)` adds Blog while `bootstrap.nav.blog` is true — the paths a CMS link is validated
against, and `RESERVED_SLUGS`, the first segments a generic page may not use), `promises.js` (free
inspection / 2-hour response / 1-month warranty, in one place), `company.js` (the
settings keys, and what the header shows before `/public/bootstrap` answers). `admin/` is the back
office's own: `adminNav.js` (the grouped nav, landing, breadcrumbs, `BESPOKE_CONTENT`), `resourceRegistry.js` and
`resources/` (one entry per CMS resource — see "The resource registry"), `crmForms.js` (the lead, customer, site,
activity, lost-reason, assign and convert forms as `ResourceForm` fields, and the assignee and service relations; since
Phase L1 `activityFieldsFor(pick)` — the outcome composer's fields for what is picked — `OUTCOME_DEFAULT_NEXT`,
`nextActionFormFields` and `qualificationFields`),
`leadViews.js` (My leads / All leads → the API's `assignedToId=me`, and the URL-saved presets: Due today, Overdue, No
next action (`keepView` — see "Lead follow-through (Phase L1)"), Breached, Unassigned,
Bookings this week — the Kathmandu week starts on Sunday), `customerTabs.jsx` (the customer page's record tabs: columns,
links, and which role may see each), `homeSections.js` (what each home
section shows, where its content is edited, which ones take a `limit`, and `toSectionItems`), and `settingsForm.js`
(the settings screen as data — see "Which screen is which"). `tech/fieldCopy.js` is the field app's words in en and ne (Phase H2;
the survey stepper's since L5). `auditEvents.js` names Phase L5's `visit.confirmed`, `visit.reschedule_requested` and
`site.pinned` (their groups Site visits and Sites); `admin/messageKeys.js` describes `visit_booked` and `visit_reminder`.
Phase L7: `constants.js` has `QUOTATION_KINDS`, `WEATHER`, `LOST_TIME_REASONS` and `PURCHASE_LIST_STATUSES` / `_TRANSITIONS`, each with
its words; `auditEvents.js` names the diary, purchase-list and variation events; `tech/fieldCopy.js` has `diary.*` (see "Execution
(Phase L7)"). Phase L6: `constants.js` has `INVOICE_KINDS` / `INVOICE_KIND_LABELS`; `auditEvents.js` names `job.advance_overridden`;
`messageKeys.js` describes `advance_due`. Phase L8: `constants.js` has `INVOICE_ITEM_KINDS` / `_LABELS` (ITEM, DEDUCTION) and
`LEAD_SOURCES` gained `amc_offer` ("AMC offer"); `auditEvents.js` names `job.measurement_closed` and `job.measurement_reopened`;
`tech/fieldCopy.js` has `measure.*` and `job.measure.*` (the card's words shared with `survey.measure` through `EN_MEASURE_ROW` /
`NE_MEASURE_ROW`).

`helpers/` is behaviour with no state (Phase L8 added `closeout.js` — which lines the contract measures, the measurement's state,
the running and final bills' rules, `apiRefusal` — `splitInvoiceItems` and `deductionLabel` to `finance.js`, and moved the phone cards'
reading of a sheet — `isReadableMeasurement`, `savedMeasurements`, `readableRowValue`, `readableTotal`, `groupMeasurementsByArea` —
into `measurements.js`; Phase L7 added `execution.js` and `purchaseLists.js`, and `signedQtyOf` to `boq.js` — see
"Execution (Phase L7)"; Phase L6 added `handoff.js` — the advance gate and the crew calculator, see "Won →
hand-off (Phase L6)" — `invoiceStageLine` and `invoiceLinesLocked` in `finance.js` and `formatSignedNpr` in `format.js`; Phase I added `finance.js`, `nepaliDate.js` — a byte-for-byte copy of the API's — and the BS and balance display in `format.js`: see "Finance screens (Phase I)"; Phase L5 added `inspection.js` — see "The site-visit kit (Phase L5)"; Phase L4 added `paymentSchedule.js` and `download.js` — see "Quotations — terms and
the customer document (Phase L4)"; Phase L3 added `boq.js` and `measurements.js` — see "Quotations — the BOQ builder
(Phase L3)"; Phase L2 added `recipe.js` — see "The rate library and the money wall"; Phase H1 added `jobActions.js` and `dispatchBoard.js` — see "Operations
(Phase H1)" — and `formatMinutes` in `format.js`; Phase G added `auditDiff.js`, `sms.js`, `recordLinks.js` and
`capabilityMatrix.js` — see "Platform (Phase G)"): `format.js` (money — `rupeesToPaisa`, `parseRupees`,
`formatRupees` — dates, Kathmandu time and `toKathmanduParts` / `fromKathmanduParts` for inputs),
`slug.js` (a copy of the API's `slugify` — change both together), `prose.js` (`splitParagraphs`),
`links.js` (`siteHref` — an editor's typo must not become a dead CTA; a live page counts when its slug is passed —
and `linkIssue`, the admin forms' check), `schedule.js` (`offerWindow` — live / scheduled / ended — and
`publishState` — draft / scheduled / published — worded by Kathmandu calendar day),
`permissions.js` (`can(role, capability)` — navigation only; the API is the authority; the parity test holds it to
the API's map), `leadBoard.js` (`nextStatuses`, `canDrop`, `dropDialogFor` and `hasQuotation` — which moves open a dialog —
`cardsForColumn`, `columnTableHref`, `responseResult` — "Responded in 34 min — within the promise"), `leadFollowUp.js`
(Phase L1: next action state, Kathmandu "when" words, days in stage, qualification summary), `agenda.js` (the SLA board's
calendar: Kathmandu `YYYY-MM-DD` days — `monthGrid`, `weekDays`, `shiftAnchor`, `spanFor`, `periodLabel`, `bsSpanLabel`, `bsCell` —
`AGENDA_KINDS` (each kind's words and `--tone`); the month, step and heading helpers take `calendar` — `'ad'` or `'bs'` — and
`monthDays`, `otherPeriodLabel`, `dayNumber`, `cornerCell`, `bsDate`, `NE_WEEKDAY_NAMES` give a BS grid its days, its AD
subtitle and corners — every BS date in Nepali script), `devanagariFont.js` (`loadDevanagariFont` — the Nepali face, once), `itemsByDay`, `itemsInScope`, `agendaSummary`, `itemTime`, `itemAction`, `lateLabel`), `history.js` (`describeHistoryEntry`, `diffRows`, `foldHistory`),
`customerMatch.js` (convert's customer decision: `initialChoice`, `choiceBody`, `emailDiffers`), `leadDisplay.js`
(`describeEstimate` — a website estimate as sentences — and `mergePreview`),
`utils.js` (`cn`), the field app's offline pieces (Phase H2 — `fieldDb.js`, `offlineQueue.js`, `uploadQueue.js`, `fieldJob.js`,
`sentPhotos.js`, `compressImage.js`, `signature.js`; see "The field app (Phase H2)"), `mediaFolders.js`
(`flattenFolderTree`), `overlay.js` (`ignoreToastInteraction`). `format.js` also has `formatBytes`.

`config/`, `helpers/` and `hooks/` have no barrel files (`config.js`, `helpers.js` and `hooks.js` had no importers
and were removed in C2) — import the module itself.

`hooks/useOfflineQueue.js` is the field app's sync engine and `useFieldCopy` its words (Phase H2); `usePendingPicture` (Phase L5)
a queued picture as an object URL.
`hooks/` also holds the admin kit's behaviour: `usePurchaseListActions` (Phase L7 — a purchase list's moves, the registry's
`useRecordActions`), `useJobActions` and `useScheduleCommit` (Phase H1), `useConfirm`, `useUnsavedChangesGuard`,
`useDebouncedValue`, `useListParams` (whose `defaults` are compared by value), `useLeadStatusChange` (the one way a
screen moves a lead: `const [changeStatus, dialog] = useLeadStatusChange()`; LOST asks why first — a category and the
words; resolves false when refused or cancelled, so the board can put a card back), `useLeadFollowUp` (Phase L1: opens the
visit booking or the new-quotation sheet and resolves with the result, or null on Cancel), `useNavBadges`, and `useResourceEntry`
(the registry entry behind `/admin/content/:resource` — or a fixed route's `resource` — with the capability check).

`hooks/useSiteSettings.js` sits between the two: it reads the cached bootstrap
query once and hands back the company's name, numbers and address with the
fallbacks already applied, so no component writes
`settings['contact.phonePrimary'] ?? '01-5407720'` a sixth time. It also hands back `nav` (the site nav for what the
site has now) and `pageSlugs` (the live generic pages), which `Cta` and the admin link checks use.

## Words — English and Nepali (Phase J1)

**Every word a visitor, a customer or a technician reads goes through `t()`.** The field app (`/tech`), the public site,
booking, the lead forms, the login and the customer's document pages (`/quotation`, `/invoice`, `/warranty`, `/visit`)
are English and Nepali. **The back office stays English** (decision D7): `providers/LocaleProvider.jsx` makes every
`/admin` path English whatever the browser chose on the site, so a shared component (a form's validation message, the
error boundary) is English there by itself. Content — service names, pages, posts, FAQs, gallery captions — is not UI
text: the API overlays its Nepali with `?locale=ne` (the Translation table), and every public query passes the locale.

- **Catalogues** — `config/i18n/<audience>.js`, one export each, `{ en, ne }`: `common.js` (`COMMON` — the language
  switch, and the API error codes a visitor can meet), `validation.js` (`VALIDATION` — form messages), `site.js`
  (`SITE`), `field.js` (`FIELD`), `documents.js` (`DOCUMENTS`). A screen imports only its audience's catalogue, so the
  marketing bundle never carries the field app's words. A catalogue is **plain data**: nested objects whose leaves are
  strings with `{name}` placeholders, or plural forms `{ one, other, zero? }` picked by `count` (`Intl.PluralRules` —
  English and Nepali both use one/other). No functions, no arrays — a translator can read it, and
  `npm run -s i18n:review > review.csv` prints every text beside its English (the API's Nepali messages and checklist
  words too) for a native speaker.
- **`useT(CATALOGUE)`** (`hooks/useT.js`) → `t('sync.waiting', { count: 3 })`. A number in the values is printed with
  lakh grouping in the locale's digits; pass a string to print it as it is (a job number, a year). `t.rich(key, vars,
  { link: (children) => <Link …>{children}</Link> })` fills `<link>…</link>` spans in a sentence — the tags are found
  before the values go in, so a customer's name never becomes markup. `t.locale` feeds the format helpers;
  `t.has(key)`. `useT(CAT, { locale })` pins a language (a document in the customer's, not the reader's);
  `LocaleScope` pins one for a subtree. `useLocale()` is the screen's language; `createT(CAT, locale)`
  (`helpers/i18n.js`) is the same outside React. A key Nepali lacks falls back to English with a development-only
  `console.warn('[i18n] missing ne text for "…"')`; a key neither has prints itself.
- **API errors** — `useApiErrorText(CATALOGUE)` → `(error) => words`: the catalogue's `errors.<CODE>`, then `COMMON`'s,
  then the server's message (English), then `COMMON.errors.generic`; `FETCH_ERROR` is "no internet". The API's codes
  are the contract (docs/API.md); its messages are only a fallback.
- **Validation (J1.4)** — `useZodForm` words every zod error in the screen's language: `form/zodMessages.js` gives zod
  an error map for the issues a schema left unworded (a length, a range, an empty field — `validation.js#issues`), and
  resolves the message keys a schema chose — `form/schemas/fields.js` writes `vKey('phone')`, not English. A schema's own
  plain English (the back office's) and a schema-level `required_error` are kept. A message shown outside `useZodForm`
  goes through `translateValidationMessage(message, locale)`.
- **Formatting (J1.6)** — `helpers/format.js` takes `{ locale }` (default `'en'`, so admin calls are unchanged):
  `formatNpr` (`रु.` in Nepali), `formatNumber`, `formatDate` (`2026 सेप्टेम्बर 14`; `calendar: 'bs'` →
  `29 भदौ 2083`), `formatDateTime`, `formatTime`, `formatDateBs`, `formatDateAdBs` (`… (2083-05-29 वि.सं.)`),
  `relativeTime`, `formatMinutes` (`1 घण्टा 35 मिनेट`). Numbers keep Nepal's lakh grouping in both languages. Digits
  stay **Latin** in Nepali (`NE_DISPLAY_DIGITS` in `config/locale.js`; `{ digits: 'deva' }` per call) — an amount, a job
  number or a phone is read back over the phone — and nothing in an input or a request is ever converted;
  `toLatinDigits` reads a Devanagari digit typed on a Nepali keyboard (`parseRupees` does).
- **Font (J1.7)** — Noto Sans Devanagari is fetched only while Nepali is on: `index.html`'s head script adds it before
  the first paint when the page opens in Nepali, `LocaleProvider` when someone switches (`display=optional`, so a font
  that is late is skipped rather than swapped in — no reflow; the phone's own Devanagari face stands in). The sans stack
  is Inter first, so Latin letters in a Nepali sentence stay Inter. `<html lang>` follows the screen's language, and
  `:lang(ne)` gives h1–h3 room for the vowel signs.
- **Adding words** — add the key to both `en` and `ne` of the audience's catalogue, then `t('the.key')`.
  `config/i18n/catalogues.test.js` fails when the two languages differ in keys, placeholders, `<tags>` or kind, when a
  leaf is not text, and when code asks a translator for a literal key its catalogue lacks.

Tests: `helpers/i18n.test.jsx` (placeholders, plurals, fallback and the one warning, rich text, API errors),
`config/i18n/catalogues.test.js`, `helpers/format.test.js` (Nepali grouping, Devanagari digits, BS dates, `रु.`),
`form/zodMessages.test.jsx` (a zod error in Nepali; English under `/admin`), `providers/LocaleProvider.test.jsx`
(`<html lang>`, the font once, `/admin` English, `index.html`'s URL), and each audience's screens rendered in Nepali with
no `[i18n]` warning.

## Tests

`npm test` (Vitest, jsdom) and `npm run test:e2e` (Playwright — `e2e/`, see the README). A test sits **beside the file it tests** as `*.test.js(x)`; the end-to-end suite is the exception, because it drives both apps at once rather than one module. `src/test/` holds
only the harness: `setup.js` (jest-dom matchers, browser API stubs — `ResizeObserver`, `IntersectionObserver`,
`matchMedia`…), `renderWithProviders.jsx` (a fresh store and a memory data router, plus `signedInAs(role)`) and
`mockApi.js` (`mockApi(handler)` stubs `fetch` and returns the calls as `{ method, path, query, body }`; `json`,
`page`, `notFound` build responses — the screen tests since D2 use it). A toast is asserted in the store
(`store.getState().ui.toasts`), since no Toaster is rendered. Money, phone numbers and Devanagari are tested on
every new form.

## Rules

1. **Money is integer paisa.** Only `helpers/format.js` converts it for display.
2. **Server state is RTK Query.** No react-query, no Context for server data.
3. **Add shadcn components with the CLI**, never by hand-copying.
4. New admin screens are built from the admin kit — `CustomTable` and `ResourceForm`
   in `components/common/`. Do not hand-roll another table or form. A CMS resource screen is
   a **registry entry** in `config/admin/resources/`, never a page of its own — the exceptions are
   screens that are not a list and a form (the home composer, the media library, the site settings; see the table
   above) — and those are still built from the kit.
5. Colours come from the CSS variables in `styles/globals.css`. No hardcoded hex,
   and no raw Tailwind palette either — `bg-emerald-50 dark:bg-emerald-950` is a
   fourth palette that no theme switch can follow. Use the semantic tokens:
   `surface-success`, `surface-warning`, `surface-info`, `text-success`,
   `text-warning`, and `destructive` for danger.
6. Imports use the `@/` alias. No `../../..`.
7. **No file is called `index`.** Every module is named for what it holds —
   `apiCore.js`, `AppRoutes.jsx`, `store.js`, `HomePage.jsx`. A folder's entry file
   repeats the folder name rather than hiding behind `index`, so an editor tab and a
   stack trace both name the thing you are looking at. Import the file, not the
   folder: `@/redux/store`, never `@/redux`.
8. **Cost is the server's.** The client never works out a cost; it shows one only behind `costs:read` (a field's,
   column's or tab's capability), even though the API already strips it for everyone else. See "The rate library and the
   money wall (Phase L2)". Since Phase L3 the same holds for every amount on a quotation: totals, section subtotals,
   discounts from % or a target, and margins come from the server's preview; since Phase L4 also each payment stage's
   amount and the total in words. A customer-facing screen and the print never show a cost key, even to a manager. Since
   Phase I the same holds for invoices, payments and reports: every total, VAT, paid amount and balance is the server's
   (a balance is shown never below zero); the one check the UI makes against a figure is a payment ≤ the server's balance. Since Phase L8 also the final bill's
   preview — its lines, deductions, pro-rata discount and VAT — and a running bill's amount.
9. **EditableGrid is reached only through ResourceForm field types** (`lineItems`, `grid`, `measurements`, `recipe`,
   `paymentSchedule`) —
   never imported by a page or a registry entry. Every drag has a keyboard equivalent.
