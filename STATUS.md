# Build status

Updated 2026-09-02. Plan and phases: `docs/PLAN.md`.

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

**The whole backend is built and verified.** The frontend has its foundation plus the public
site, auth, dashboard, SLA board, leads list and the technician today screen.

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

1. Lead detail drawer — timeline, notes, convert-to-customer.
2. Customers + sites, quotation builder off the rate card.
3. Job detail (checklist, photos, materials, timer) and the dispatch calendar.
4. Materials/stock, invoices + payments, warranty/AMC screens.
5. CMS editors on `<DataTable>` + the home-section drag-and-drop composer.
6. Technician offline queue (service worker + IndexedDB) against `POST /tech/sync`.

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
