# Phase D1 — Services, rate card, media & home page

~3 days · branch `admin/phase-d1-services-home` · requires Phase C2 done

````text
You are working in the InvincibleMaintainance repo. This is Phase D1 of docs/ADMIN-PLAN.md. Phase D
is split in two: D1 covers the service listing, prices, media and the home page; D2 covers projects,
the remaining content, blog/pages and site settings. The backend CRUD already exists; Phase C built
the admin kit. Use the kit — do not hand-roll a table or form.

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md (the C1/C2 kit and registry sections)
- docs/ADMIN-PLAN.md §5 Phase D; docs/API.md "Public" and "Admin — CMS"
- homeplexdynamicsystemfindings.md §2 and §3 (the section anatomy and the boilerplate-excerpt finding)
- src/config/admin/resources/faqs.jsx (the C2 proof) and the generic Resource pages
- MaintainanceBackend/src/shared/schemas/cms.js, src/routes/admin/cms.routes.js,
  src/routes/admin/crm.routes.js (rate-card), src/routes/admin/platform.routes.js (media, settings,
  home-sections, translations), src/services/cms.service.js, prisma/schema.prisma CMS models,
  prisma/seed-data.js (home section keys, settings groups and types)
- Public pages that consume this content: src/pages/public/HomePage/HomePage.jsx (SECTIONS
  registry), ServicesPage, ServiceDetailPage, PricingPage, ProjectsPage, ProjectDetailPage,
  src/api/publicApi.js, src/hooks/useSeo.js, src/config/site/siteNav.js

RULES
- One registry entry per factory resource. A bespoke page only where the resource is not a plain
  list/form — say which and why in the plan.
- Money fields send rupees and display paisa via helpers/format.js.
- Translatable text fields use LocaleTabs; test Devanagari round trips.
- Backend changes only where listed, each with an API test and a docs/API.md update.
- Post the plan first (resource → registry/bespoke, capability, nav group, public page it affects).

TASKS — in this order

D1.1 · Service categories — registry: name, slug, icon (a picker over the icon names the public
CategoryTile supports), image, sortOrder (reorder), isActive; NE translation of name.

D1.2 · Services — registry with category, featured and type filters.
Fields: name, slug, category, type, excerpt, body (the format ServiceBody renders), icon, image,
priceFrom/priceTo (money) + priceUnit, warrantyDays, isFeatured, SEO group (metaTitle,
metaDescription, ogImage), NE translations of name/excerpt/body. Row action "View on site"
(/services/:slug). Validation on both sides: priceTo ≥ priceFrom; excerpt 40–200 characters; reject
the templated boilerplate "Professional … with expert tools and results." with a refine in
MaintainanceBackend/src/shared/schemas/cms.js AND the mirrored frontend schema.

D1.3 · Rate card — registry under the Sales nav group (write: quotations:write; read:
quotations:read): code (unique, upper-case), name, description, category, unit (take the unit list
from the backend), rate (money), isActive, reorder. A banner explains it feeds the estimator, the
pricing page and quotation lines.

D1.4 · Media library — bespoke page /admin/content/media: folder tree (GET/POST/DELETE folders),
grid with search + pagination, drag-drop multi-upload, edit alt/caption (alt required), variants and
dimensions shown, soft delete (hard delete only with cms:purge), copy URL. Reuse the C1 MediaPicker
internals rather than duplicating the grid.

D1.5 · Home composer + hero slides
- Bespoke page /admin/content/home: the HomeSection rows, drag to reorder (with a keyboard
  alternative), visibility switch, per-section settings editor (keyValue or known keys), a "Preview
  home" link; saves with PUT /admin/home-sections { items }.
- Hero slides registry: title, subtitle, ctaLabel, ctaUrl (validated against siteHref / siteNav
  paths the way the public site does), image, reorder, toggle, NE translations.

TESTS
API: boilerplate excerpt rejected; priceTo < priceFrom rejected. vitest: services schema mirror
parity (the same valid/invalid fixtures as the backend).

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api
  cd MaintainanceFrontend && npm test && npm run lint && npm run build
Manual, both apps running:
 1. as editor@gharjatan.com.np reorder home sections and hide one → the public / reflects it on reload;
 2. add a hero slide with an uploaded image (alt text required);
 3. add a service in a category with a price range and a Nepali name → it appears at /services, at
    /services/:slug, and in Nepali with the locale switch;
 4. as sales@gharjatan.com.np change a rate-card rate → /pricing and the estimator reflect it.

ACCEPTANCE
Editors manage categories, services, media, home-section order and hero slides with zero code
changes; the rate card is managed by sales/admin; every change is audited (Phase B).

GIT
- Work on a local branch `admin/phase-d1-services-home` created from DEVELOPMENT.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase C2's work is present on DEVELOPMENT (its files and migrations
  exist). If it is not, STOP and tell me.
- Do NOT push, open a pull request or merge. I review the work and handle git myself.

DOCS — part of the definition of done; update them together with the code they describe (in the same commit), not at the end
Always:
- docs/ADMIN-PLAN.md — mark this phase ✅ with the date in the §6 timeline, tick the §3 defects it
  closed, and add a "Deviations" note under the phase for anything built differently from the plan
  (what and why).
- STATUS.md — move this phase into "Done", update "Next", and record the verification results
  (test counts, manual walk-through outcome).
- docs/API.md — every endpoint added, changed or removed: method, path, capability, request body,
  response shape, error codes. The doc must match what is mounted.
- docs/DATA-MODEL.prisma — mirror every prisma/schema.prisma change (CLAUDE.md rule 2).
- .env.example + MaintainanceBackend/README.md / MaintainanceFrontend/README.md — every new env var,
  npm script, dependency or seeded login.
- MaintainanceFrontend/src/STRUCTURE.md — every new folder, shared component, convention or rule.
- CLAUDE.md — only if a convention or a "decision already made" changed; call it out in the report.
This phase specifically:
- docs/API.md: the boilerplate-excerpt and price-range validation rules.
- STRUCTURE.md: which resources so far are registry entries and which are bespoke pages, and why.
- MaintainanceBackend/README.md: seed description if seed content changed.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Resource → screen table (registry vs bespoke), backend changes with tests, test counts, manual walk-through results, follow-ups. Do not start Phase D2.
````
