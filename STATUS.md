# Build status

Updated 2026-09-16. **Current build order: [`docs/ADMIN-PLAN.md`](docs/ADMIN-PLAN.md)** (one prompt per phase in
`docs/prompts/`). `docs/PLAN.md` is the historical v1 blueprint; the phase numbers 0–11 below are its v1 phases.

## Done

| Phase | Scope | State |
|---|---|---|
| 0 Foundations | Two apps, config validation, error/response contract, CI-ready scripts | ✅ |
| 1 Identity & media | Auth, RBAC, audit, settings, media pipeline, admin shell | ✅ |
| 2 CMS models | All 20 sections modelled, CRUD factory, home composer, i18n | ✅ backend · ✅ admin UI (v2 C–D) |
| 3 Public site | Storefront: search, catalogue, service pages, pricing, estimator, online booking, SEO; blog and generic pages (v2 D2) | ✅ |
| 4 Lead CRM + SLA | Capture, spam defence, SLA engine, board, pipeline, notifications, export | ✅ |
| 5 Customers & quotes | Customers, sites, rate card, quotations, public approval | ✅ backend · UI pending |
| 6 Jobs & dispatch | Work orders, templates, assignment, dispatch board, technician flow, offline sync | ✅ backend · `/tech` today screen built |
| 7 Materials | Catalog, derived stock, issue-to-job, job costing | ✅ backend · UI pending |
| 8 Finance | Invoices from actual consumption, payments, VAT, expenses, aging | ✅ backend · UI pending |
| 9 Aftercare | Warranty auto-creation, claims, AMC contracts + auto-scheduled visits, reminders | ✅ backend · public pages built |
| 10 Reports | Lead source, funnel, SLA compliance, margin, technician, warranty, dashboards | ✅ backend · dashboard built |
| 11 Site surveys | SURVEYOR role, survey capture, pricing preview, survey → quotation, offline queue | ✅ |
| **v2 · A Safety fixes** | Convert priced by `documentTotals` and atomic, quotation expiry at decide time + `quotation:expire`, DRAFT-only edits, payment void (no hard delete), `transitionLead`, `cms:purge`, CSV export via RTK Query, real booking timing, ESLint in both apps, GitHub Actions CI, doc housekeeping | ✅ 2026-09-14 |
| **v2 · B Logging & audit** | Request context (AsyncLocalStorage) and `X-Request-Id`; pino redaction, phone masking, context mixin, `LOG_FILE` via pino-roll, optional Sentry; `AuditLog` gains `requestId` / `userAgent` / `actorType` / `event` / `before` / `after`; audit rows written inside the caller's transaction for all 7 write operations, one row per id on bulk writes; 38 named domain events (`AUDIT_EVENTS`, 7 more reserved for F); `GET /admin/audit-logs` filters | ✅ 2026-09-14 |
| **v2 · C1 Admin UI primitives** | shadcn sheet/alert-dialog/textarea/popover/calendar/command/breadcrumb/scroll-area/radio-group/accordion/collapsible/progress/toggle-group; Vitest + Testing Library as `npm test` (in CI); DataTable v2 (row and bulk actions, page size, URL-synced filter bar, trash via `?deleted=true`, dnd-kit reorder with move buttons); `<ResourceForm>` with 16 field types, server-error mapping and an unsaved-changes guard (data router); `LocaleTabs`; `MediaPicker` with alt-required upload; `ConfirmDialog` / `useConfirm`; Devanagari slug fix in the API | ✅ 2026-09-14 |
| **v2 · C2 Registry, shell & first resources** | Resource registry (`config/admin/resources/`) rendered by generic `ResourceListPage` / `ResourceEditPage` under `/admin/content/:resource`; `cmsApi` (8 parameterised endpoints, `Cms` tags); `cms.schema.js` mirroring all CMS schemas; FAQs and process steps managed from registry entries alone; admin nav regrouped Overview · Sales · Operations · Finance · Aftercare · Content · Platform, capability-filtered, EDITOR lands on Content; route breadcrumb, brand from settings, notification panel; public FAQs localised (`?locale=ne`); purge from Trash fixed in the CRUD factory; dead barrels removed | ✅ 2026-09-14 |
| **v2 · D1 Services, rate card, media & home page** | Registry screens for service categories (icon picker, Nepali name), services (category/type/featured filters, price range in rupees, unit, warranty, image, SEO, Nepali name/card text/page text, View on site) and hero slides (CTA link checked against the site's routes); the rate card as a registry entry under Sales at `/admin/rate-card` (`basePath`, quotations:read/write, read-only for ACCOUNTANT, "In use"/Retire); bespoke home composer (`/admin/content/home`: drag or Move up/down, visibility, item limit, Save/Discard, empty-section flag) and media library (`/admin/content/media`: folder tree, search, drag-and-drop upload with required alt, dimensions and WebP variants, copy URL, alt/caption/folder edit, soft delete, Delete forever for ADMIN). API: the four missing rate-card endpoints, upper-case codes; service excerpt 40–200 and the price range checked on partial updates; home `limit` 1–50; non-empty media alt; validated folders, subfolders block a folder delete. Kit fixes: clean form after a save, toasts no longer close sheets | ✅ 2026-09-16 |
| **v2 · D2 Projects, content, blog & settings** | Registry screens for projects (story, cost band in rupees, client-name consent note, SEO, linked job number read-only, and a **Gallery** tab: add from the library or upload, drag or Move earlier/later, remove), offers (Nepali-ready title, bullets, price range, start/end in Nepal time with a Live / Scheduled / Ended column), pricing plans, testimonials (a moderation queue that opens on "Waiting for approval", Approve / Withdraw for `testimonials:moderate`), gallery, features and list items (by band; list items reorder one list at a time), content blocks (key fixed once saved, bullets, a label + link button), posts (draft / scheduled / published), post categories and pages (reserved addresses refused); the nav gains **Page blocks** and **Blog & pages**. Bespoke **site settings** at `/admin/platform/settings`: a card per group, inputs by setting type, Nepali phone rule, weekday checkboxes, editable badge and counter rows; ADMIN saves only what changed, EDITOR reads. Public **`/blog`**, **`/blog/:slug`** and a catch-all **`/:slug`** page; Blog in the nav once a post is published; CMS links may point at a live page. API: list-item positions count from 1 after a reorder, projects carry their job number, `ogImageId` no longer 500s on projects/pages/posts, Nepali copy on the home page's grouped sections and on posts and pages, `nav.blog` / `nav.pages` in bootstrap, blog and pages in the sitemap, a seeded blog and About page. Fixes: public pages ignore an empty SEO title, one session restore per page load in dev | ✅ 2026-09-16 |

**The whole backend is built and verified.** The frontend has its foundation, the public site,
auth, dashboard, SLA board, leads (list + detail), the site-survey inbox and review screen, the
quotation builder, the field app for technicians and surveyors, and the admin UI kit every later
screen is built from (DataTable v2, ResourceForm, LocaleTabs, MediaPicker, useConfirm). **Every CMS resource in
`docs/API.md` has a screen**: sixteen are registry entries — a config file each, Nepali copy included where the site
reads it — plus the rate card under Sales. The home page order, the media library and the site settings have screens
of their own. An EDITOR runs the whole public site, blog included, without a code change.

## Site surveys — how the business actually runs

The company's own sequence, now expressible end to end:

> browse services → read past work on similar problems → book a free consultation →
> a **site visitor** attends → **takes readings** → reports the **materials and labour
> required** → the office **reviews it and builds the priced quotation**.

- **The visit is a Job**, `type: INSPECTION`, `isBillable: false`. It keeps dispatch,
  assignment, geo-stamped status events and photos rather than growing a parallel scheduler.
- **`SiteSurvey`** hangs off that job (`jobId @unique`, which also makes creation idempotent
  for an offline device). `SurveyReading` carries a numeric *and* a text column — a moisture
  meter gives 18.4, "is there a DPC?" gives "none visible".
- **Quantities and money are separate.** `SurveyItem` has `qty`, `unit` and `wastagePct` and
  **no rate, no amount, no price snapshot**; the zod schema is `.strict()`, so a payload
  carrying one is rejected rather than ignored. `survey.service.js#priceSurvey` is the single
  place quantities meet the catalogue, and anything unpriceable comes back in `missing[]` with
  a reason instead of being priced at zero.
- **The money wall is a capability, not a screen.** `SURVEYOR` has no `quotations:read`, which
  is what guards `GET /admin/surveys/:id/pricing`. A dispatcher reads the findings and the
  quantities; the rates never load. No `/tech` response carries a money field at all.
- **`buildQuotationFromSurvey`** converts paisa back through `toRupees()` and hands the lines
  to the existing `createQuotation`, so `documentTotals` stays the only implementation of
  subtotal, discount and VAT. Two reviewers pressing the button resolve through a guarded
  `updateMany`, not a read-then-write.
- **Booking availability** (`GET /public/availability`) counts scheduled inspection jobs plus
  booking leads still `NEW`/`CONTACTED` against surveyor capacity. A full slot flags the lead
  `HIGH` with a timeline note — it never rejects the customer.
- **Case studies** — a finished job publishes as a `Project` with the problem, what we did, the
  duration and a ±20% cost band. The customer's name is omitted unless someone opts in, and
  the band is never their contract value.
- **Offline** — field mutations that fail for network reasons queue in IndexedDB and replay
  through `POST /tech/sync`. The service worker caches the app shell only; a cached job sheet
  would have a surveyor acting on stale scope.

Seeded demo: `survey@gharjatan.com.np` / `Password123`, with `SRV-2083-0001` sitting submitted
in the admin inbox and one case study published.

## Public site — storefront

The marketing site is a **service storefront**: browse, compare published prices, and book a
visit online. Single company still — no vendors, no `tenantId`.

- **Front door** — search field and category rail live in the header, so browsing works from
  every page. The home page opens with search, category tiles (with live service counts) and
  priced service cards that book in one click.
- **Catalogue** (`/services`) — category filter (server query), text search and sort
  (recommended / price / name) held in the URL, so a filtered view is shareable.
- **Booking** (`/book`, `/book/:slug`) — four steps: service → size → day and window →
  contact details. Step 2 calls the estimator for an indicative range; the calendar only
  offers open days. It creates a normal `Lead` with `preferredAt` / `preferredSlot` and
  `source=booking`, so a booking enters the same SLA clock, assignment and pipeline as any
  other enquiry, and shows in the admin leads table under "Requested visit".
- **Blog and pages** (`/blog`, `/blog/:slug`, `/:slug`) — published posts newest first with a category filter in
  the URL, an article page with an `Article` JSON-LD block, and editor-written pages such as `/about` at their own
  address. The generic page route sits after every other public route, so an address nothing else claims asks the API
  and renders the not-found page when there is no live page. "Blog" joins the header, drawer and footer only while a
  post is published (`nav.blog` from `/public/bootstrap`), and a CMS button may link to a live page. Posts and pages
  follow the Nepali switch like the rest of the site.
- **Vocabulary** — `src/components/site/` holds `SectionShell`, `SectionHeading`, `PageHero`,
  `ServiceCard`, `CategoryTile`, `PriceTag`, `DataIcon`. Every public page is assembled from
  these, so a price or a booking link can never be presented one way in one place and
  differently in another.
- **Motion** — `src/components/motion/` is the whole vocabulary: scroll progress, parallax,
  pointer tilt/magnetic/spotlight, staggered reveals, animated counters, marquee, back-to-top.
  Transform and opacity only, and every effect resolves to a static state under
  `prefers-reduced-motion` — reveals are removed there rather than shortened, so content never
  waits on an intersection callback.

Booking rules are content, not code: `booking.closedWeekdays` and `booking.maxDaysAhead` are
settings, served through `GET /public/bootstrap` and enforced again in the API.

## Next

The build order is **`docs/ADMIN-PLAN.md` §5**, one prompt per phase in `docs/prompts/`.
Phases A, B, C (C1 + C2) and D (D1 + D2) are done; next is **Phase E — Lead management & CRM**: the new-lead dialog,
bulk assign, saved filters, the pipeline board, lead detail actions, customers and sites
(`docs/prompts/PHASE-E-leads-crm.md`).

## Verification

- 92 backend unit tests pass (money, BS dates, phone, state machines, permissions, SLA, schemas, logging, slugs) — `npm test`.
- 399 API tests pass over HTTP against a seeded `_test` database — `npm run test:api` drives every
  route in `docs/API.md`, RBAC per role and the error envelope, and runs twice in a row without a reset.
- Phase A (2026-09-14): unit 59 → 62, API 347 → 368; every new test was run against the old code first and
  failed there. `npm run lint` is clean in the backend and has 0 errors (25 `react-refresh` warnings, kept on
  purpose) in the frontend; `npm run build` succeeds. `.github/workflows/ci.yml` runs all of it on push.
- Phase B (2026-09-14): unit 62 → 89, API 368 → 397. The rollback test was run against the old audit extension
  first and failed there (1 audit row survived a rolled-back transaction). Clean run: test database reset, then
  the full API suite twice in a row with no reset, both green. `npm run lint` is clean. Manual check: the API
  started with `LOG_FILE` against the `_test` database, signed in, made authenticated reads, a settings change
  with `X-Request-Id: verify-1789368602335`, a refresh and a request with a bogus Bearer token →
  `api.2026-09-14.1.log`, 9 lines, `grep -c Bearer` = 0, neither the access token nor the refresh cookie present,
  and that request id on the request line (with `userId`) and on its two `AuditLog` rows (`Setting` upsert and
  `settings.changed`, both with before/after).
- Phase C1 (2026-09-14): backend unit 89 → 92, API 397 → 399 (the trash list, strict `?deleted`, Devanagari
  slugs); the Devanagari slug test failed on the old `slugify` (`नेपाली` → `न-प-ल`). The frontend has a test runner
  for the first time: **40 tests in 6 files** — money rupees↔paisa (0, 1 paisa, 1,23,45,678.90), Kathmandu time,
  Devanagari slugs, `useListParams` ↔ URL, DataTable selection / page size / reorder and rollback / search re-sync /
  trash, ResourceForm 400 and 409 mapping, focus, the leave guard and slug following, `useConfirm`. `npm run lint`:
  0 errors in both apps (26 `react-refresh` warnings in the frontend); `npm run build` succeeds.
- Phase C1 browser walk-through (headless Chrome, dev servers, `sales@gharjatan.com.np`): Leads, Quotations and
  Surveys page, sort and search; the Leads status, response, source and received-date filters write the URL, survive
  a reload and Back from a lead's detail page, and "Clear filters" empties them; `?limit=2` shows 2 rows over 3 pages,
  Next goes to page 2, and choosing 10 rows per page shows all 5 on one page; no console errors.
- Phase C2 (2026-09-14): backend unit 92 (unchanged), API 399 → **416** — public FAQs in Nepali on the service page and
  `/public/faqs` (1), and "Delete forever" of a row already in Trash for each of the 16 CMS resources (16), which failed
  on the old CRUD factory with 404 for every resource. Frontend 40 → **61 tests in 10 files**: the registry guard (every
  entry has capability, schema, columns, fields in its schema, a path the API mounts, a matching nav item), `cmsApi`
  store tests with mocked fetch (create → list; update and delete → list + that record; reorder → list; never another
  resource), nav per role (ADMIN, EDITOR, SALES), landing and breadcrumbs, notification links. `npm run lint`: 0 errors
  in both apps (26 `react-refresh` warnings in the frontend, unchanged); `npm run build` succeeds, and the registry
  lands in its own admin chunk, not the main bundle.
- Phase C2 browser walk-through (headless Chrome, dev servers). As `editor@gharjatan.com.np`: lands on Content → FAQs
  (no Dashboard or Sales in the nav; breadcrumb Content › FAQs; brand "Ghar Jatan" from settings); the group filter and
  search write the URL; New FAQ refuses an empty form, creates, and opens its edit page; its Nepali question saved; the
  public service page shows it in English and, after switching the site to नेपाली, in Nepali; reordered to the top with
  Move up (the admin list, `/public/faqs` and the service page agree); switched off — gone from the site; deleted — in
  Trash; restored and switched on — back on the site with its Nepali copy; `/admin/content/nope` renders the 404 page.
  Process steps: 5 rows in step order and no Reorder; a Nepali title reaches `/public/home?locale=ne` and was removed
  again; a new step refuses an empty step number, creates, shows last on the home page, and deletes from its edit page;
  the FAQ list at 400px has no page overflow. As `sales@gharjatan.com.np`: no Content group; `/admin/content/faqs`
  returns to the dashboard; the bell showed 3 unread, the first opened `/admin/leads/:id` (the API wrote `/leads/:id`),
  and Mark all as read cleared the badge (those 3 demo notifications are now read). As `admin@gharjatan.com.np`: all
  seven groups; "Delete forever" in Trash purged a row. No console errors for any role. The walk-through's records
  were purged afterwards. The walk-through found three bugs, fixed before this record: purge from Trash (API), the
  reorder announcer inside `<table>` (C1 kit), and a 404 refetch after deleting from an edit page.
- Phase C2 second resource: `process-steps` (entry + registry line + nav item) was written in under a minute, with
  its registry test green 40 s after starting; its screens passed the browser walk-through above unchanged.
- Phase D1 (2026-09-16): backend unit 92 → **113** (the 20 shared service-schema cases, the long-excerpt case), API
  416 → **426** — rate card surface (get, toggle, reorder, trash, restore, purge needs cms:purge), upper-case codes,
  a rate change on `/public/pricing`, excerpt 40–200, price range on create and on partial updates, home reorder with a
  limit, home limit/key refusal, a Nepali hero slide on `/public/home?locale=ne`, non-empty alt, folder rules. Run
  against the old code, 7 of them fail (the rest guard behaviour that already worked). The API suite ran three times
  in a row with no reset, all green. Frontend 61 → **105 tests in 15 files** — the service schema mirror on the API's
  own cases, units against the API's list, the rate-card store tags and the home save, the folder tree, the home
  composer (Move up, visibility, save payload, a refused limit, read-only for SALES), the rate card screens as SALES
  and ACCOUNTANT and not under `/admin/content`, a clean form after a transforming save, a toast press keeping a sheet
  open (the last two failed before their fixes). `npm run lint`: 0 errors in both apps (26 warnings in the frontend,
  unchanged); `npm run build` succeeds, and the registry entries stay in the admin chunk.
- Phase D1 browser walk-through (headless Chrome, dev servers, dev database; **57/57 checks**). As
  `editor@gharjatan.com.np`: lands on Content › Home page; moved "How it works" to the top and hid "Popular services";
  leaving unsaved asked first; saved — `/public/home` and the reloaded `/` agree. New hero slide: a `/nowhere` link is
  refused; an image uploaded through the picker (Upload stays disabled until alt text is typed); Nepali headline saved;
  moved first with Reorder → the public headline and `/public/home?locale=ne` show it. New category with the
  `droplets` icon; new service in it: the boilerplate card text and a To below From are refused; Rs 500–1,250 per
  sq.ft stored as 50000–125000 paisa; Nepali name saved; it appears at `/services`, at `/services/:slug` with the
  range, and in Nepali after the language switch; the services list filters by that category from the URL. Media
  library: created a folder, uploaded into it, dimensions 900 × 600 and 400w/800w shown, Copy URL put the address on
  the clipboard, an empty alt is refused, alt and a Devanagari caption saved, closing with an unsaved caption asked
  first and kept the saved one, the non-empty folder was not deleted, the file was soft-deleted, and EDITOR was not
  offered Delete forever. No page overflow at 400px on the media library, the composer and the services list. As
  `sales@gharjatan.com.np`: Rate card in Sales and no Content; the banner; a rate changed by Rs 11 → `/public/pricing`
  and `/pricing` show it; `/admin/content/faqs` returns to the dashboard; breadcrumb Sales › Rate card › Edit. As
  `accounts@gharjatan.com.np`: the rate is read-only with no Save. As ADMIN: audit rows exist for the slide, the
  service, the category, the rate (with before/after), the image (`cms.deleted`), the home sections and the
  translations. Console: only the missing `/favicon.ico` and the deliberate "folder is not empty" 400. The walk found
  five bugs, fixed before this record (see ADMIN-PLAN D1 deviations). Everything it created was purged afterwards and
  the home order, the rate and the hero slide order were put back.
- Phase D2 (2026-09-16): backend unit 113 (unchanged), API 426 → **435** — list-item reorder numbering from 1 and the
  site's order, a project's job number and a dropped `ogImageId`, withdrawing an approval (and SALES refused), Nepali on
  the home page's grouped sections, published / draft / scheduled / hidden / deleted posts on the list and the article
  (404s), bootstrap `nav.blog` and `nav.pages`, hidden / deleted / unknown pages (404s), posts and pages in Nepali, the
  sitemap. Run against the old code, 7 of the 9 fail; the other two guard behaviour that already worked. The API suite
  ran twice in a row with no reset, both green (the `_test` database was reseeded with `node prisma/seed.js`, not
  reset). Frontend 105 → **162 tests in 24 files** — the offer window and publish state at Kathmandu midnight (the
  prompt's test), CMS links to live pages, the Blog nav item, the settings form (inputs by type, phone rule, only
  changed keys, jsonb key order, blank badge rows), the settings page as ADMIN and EDITOR, the testimonial queue and
  Approve, list-item Reorder waiting for a list, a locked block key and half a button, an offer in Nepali with rupees,
  a project's job and gallery (reorder, remove), a live page as a hero link, a reserved page address, the new field
  types, the approve and gallery cache tags, the blog index / article / generic page with their 404s, an empty SEO
  title, and one session restore under StrictMode (the last two failed before their fixes). `npm run lint`: 0 errors in
  both apps (26 warnings in the frontend, unchanged); `npm run build` succeeds, and the registry entries and the
  settings form stay out of the main bundle.
- Phase D2 browser walk-through (headless Chrome, dev servers, dev database; **38/38 checks**). As
  `editor@gharjatan.com.np`, in one sitting: lands on Content › Home page with Page blocks, Blog & pages and Settings in
  the nav and nothing marked Soon; moved "How it works" up two places and saved — the public order follows; a hero
  slide linking to `/about` is refused while there is no such page, created with `/pricing` and put first — the site
  shows it; a service at Rs 450–900 is stored as 45000–90000 paisa and has its page; a project refuses a reversed cost
  band, keeps its Gallery tab closed until saved, then takes **three pictures uploaded through the picker** (alt text
  each), one moved later — `/public/projects/:slug` and `/projects/:slug` show 3 pictures in that order, the band and
  "6 days on site"; an **offer titled in Nepali ending tomorrow** gets 23:59 as its end, reads "Live · Ends tomorrow at
  23:59" in the list and shows on the home page; a pending Nepali testimonial is in the queue, **approved from the row
  menu**, leaves the queue and shows on the home page; a **post published today** reads "Published today", appears at
  `/blog` with Blog in the header, and `/blog/:slug` renders its Devanagari paragraph under its own title; a page
  titled "Contact" is refused, **a page at `/about`** renders, and an unknown address shows the not-found page inside
  the site; the hero slide then links to `/about` and the home page's button goes there; list items offer Reorder only
  after a list is picked; an existing content block's key is read-only; settings are read-only. No page overflow at
  400px on the offers and testimonials lists, a project's edit page, settings and `/blog`. As `admin@gharjatan.com.np`:
  a primary phone of `12345` is refused; `01-5550199` and Sunday closed are saved — bootstrap has both, **the site header
  shows the new number**, and the `settings.changed` audit row lists exactly those two keys; then put back through the
  screen. The audit log has rows for the slide, the service, the project and its three pictures, the offer, the
  testimonial, the post, the page and the home sections. No unexpected console errors. Everything the walk created was
  purged afterwards, and the home order, the slide order and the settings were put back. The walk found three bugs,
  fixed before this record (see ADMIN-PLAN D2 deviations): the empty-SEO-title fallback, a dev-only sign-out on reload,
  and untouched counters counted as a settings change.
- Phase A browser walk-through (headless Chrome against the dev servers): signed in as
  `sales@gharjatan.com.np`, exported leads filtered to NEW — the first export call was forced to 401, the page
  refreshed once and retried, both calls carried the Bearer token, and the file (UTF-8 BOM) held exactly the 2
  NEW leads the API counts. A booking at `/book` (priced service, size, day + window, Nepali message) returned
  201, sent the measured `elapsedMs`, and created a `source=booking` lead with its slot and SLA deadline.
- Full pipeline exercised over HTTP against a live database: lead → SLA breach → response →
  customer → quotation → public approval → job → checklist → materials → completion → warranty →
  claim → free rework job → invoice → payments → PAID.
- Migration + seed verified on a throwaway database from empty.
- Both apps rendered in headless Chrome with zero runtime errors.

## API audit — 2026-09-11

The HTTP suite found three defects, all fixed and now covered:

- `POST /admin/jobs/:id/publish-case-study` failed on every call — it included a Job relation named
  `caseStudy` that does not exist (it is `project`). The seeded case study was written by the seed,
  so the endpoint itself had never run.
- `PATCH /admin/list-items/reorder` failed on every call — the CRUD factory wrote `sortOrder` to a
  model that orders by `position`. The factory now takes an `orderField`.
- `POST /admin/jobs` with a `quotationId` marked the quotation `CONVERTED` whatever its status, so a
  draft could become work without the customer ever approving it. It now asserts APPROVED → CONVERTED.

A replayed `survey_submit` now answers the same way whatever payload it carries (a no-op while the
survey is `SUBMITTED`). Prisma validation errors are logged at warn instead of debug — both
always-failing endpoints above had been answering 400 with nothing in the logs.

Gaps filled: `POST /admin/quotations/:id/convert-to-job`, `POST|DELETE /admin/jobs/:id/time-logs`
(labour when the timer was never started), `GET /admin/payments` (find a payment by its reference),
`PUT /admin/service-reminders/:id`, and `GET /:id` for technicians, job templates and expenses.
`docs/API.md` rewritten to match what is actually mounted.

## Known gaps

- Quotation `validUntil` is a date stored at midnight UTC, so "valid until the 14th" expires at 05:45 Kathmandu on
  the 14th (unchanged behaviour, now applied consistently by GET, decide and the sweep).
- A quotation whose `validUntil` has already passed can still be sent.
- Converting a lead with an unknown `surveyorId` answers 409 `FK_CONSTRAINT` ("referenced by other records")
  rather than naming the surveyor — the convert rolls back correctly, the message is just unhelpful.

- The public estimator prices from each service's own range, not the rate card (see ADMIN-PLAN D1 deviations).
- The hero band shows the first active slide's words but never its image. The seeded third slide links to `/about`;
  a fresh seed now creates that page, but a database seeded before D2 has none until an editor adds it.
- A content block's key is fixed in the screen only; `PUT /admin/content-blocks/:id` still accepts a new key.
  `about_intro` and `cta_banner` blocks are rendered nowhere. Block bullets have no Nepali version.
- An SEO title or description emptied in the editor is stored as `''` (the site now falls back past it).
- The storefront's popular searches and the feature-row headings are still in code (D2.5, optional, not done).
- `branding.logoId` can be set in settings, but the header still draws the company's initial.
- A money or number field emptied in a form is left out of the request (`ResourceForm` sends `undefined`), so a saved
  service price range cannot be cleared back to "priced on inspection" from the editor.
- Media has no Trash view: a soft-deleted file can only be restored through the database.
- `/public/home` treats a visible section with no content as absent, so the composer can only flag it for sections the
  site was already told to show.

- Quotation/invoice PDFs are not generated; the public token pages render the document in HTML
  and print cleanly. Add Puppeteer if a real PDF file is required.
- The S3 storage driver is a documented seam; local disk is the supported default.
- Turnstile is wired but inert until `TURNSTILE_SECRET` is set.
- An unknown `?sort=` field still reaches Prisma and returns a generic 400 `PRISMA_VALIDATION`
  rather than naming the fields a list can be sorted by.
