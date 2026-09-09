# Build status

Updated 2026-09-09. Plan and phases: `docs/PLAN.md`.

## Done

| Phase | Scope | State |
|---|---|---|
| 0 Foundations | Two apps, config validation, error/response contract, CI-ready scripts | ✅ |
| 1 Identity & media | Auth, RBAC, audit, settings, media pipeline, admin shell | ✅ |
| 2 CMS models | All 20 sections modelled, CRUD factory, home composer, i18n | ✅ backend · admin UI pending |
| 3 Public site | Storefront: search, catalogue, service pages, pricing, estimator, online booking, SEO | ✅ |
| 4 Lead CRM + SLA | Capture, spam defence, SLA engine, board, pipeline, notifications, export | ✅ |
| 5 Customers & quotes | Customers, sites, rate card, quotations, public approval | ✅ backend · UI pending |
| 6 Jobs & dispatch | Work orders, templates, assignment, dispatch board, technician flow, offline sync | ✅ backend · `/tech` today screen built |
| 7 Materials | Catalog, derived stock, issue-to-job, job costing | ✅ backend · UI pending |
| 8 Finance | Invoices from actual consumption, payments, VAT, expenses, aging | ✅ backend · UI pending |
| 9 Aftercare | Warranty auto-creation, claims, AMC contracts + auto-scheduled visits, reminders | ✅ backend · public pages built |
| 10 Reports | Lead source, funnel, SLA compliance, margin, technician, warranty, dashboards | ✅ backend · dashboard built |
| 11 Site surveys | SURVEYOR role, survey capture, pricing preview, survey → quotation, offline queue | ✅ |

**The whole backend is built and verified.** The frontend has its foundation, the public site,
auth, dashboard, SLA board, leads (list + detail), the site-survey inbox and review screen, the
quotation builder, and the field app for technicians and surveyors.

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

Frontend screens for modules whose APIs already exist (`docs/API.md`):

1. ~~Lead detail — timeline, notes, convert-to-customer~~ ✅
2. ~~Quotation builder off the rate card~~ ✅ — customers + sites screens still to do.
3. Job detail (checklist, photos, materials, timer) and the dispatch calendar.
4. Materials/stock, invoices + payments, warranty/AMC screens.
5. CMS editors on `<DataTable>` + the home-section drag-and-drop composer.
6. ~~Field offline queue against `POST /tech/sync`~~ ✅ — job mutations still to be wired to it;
   only survey drafts and submits queue today.

## Verification

- 42 backend unit tests pass (money, BS dates, phone, state machines, permissions, SLA, schemas).
- Full pipeline exercised over HTTP against a live database: lead → SLA breach → response →
  customer → quotation → public approval → job → checklist → materials → completion → warranty →
  claim → free rework job → invoice → payments → PAID.
- Migration + seed verified on a throwaway database from empty.
- Both apps rendered in headless Chrome with zero runtime errors.

## Known gaps

- Quotation/invoice PDFs are not generated; the public token pages render the document in HTML
  and print cleanly. Add Puppeteer if a real PDF file is required.
- The S3 storage driver is a documented seam; local disk is the supported default.
- Turnstile is wired but inert until `TURNSTILE_SECRET` is set.
