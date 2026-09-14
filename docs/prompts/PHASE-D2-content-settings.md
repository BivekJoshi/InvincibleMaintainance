# Phase D2 — Projects, remaining content, blog & settings

~3 days · branch `admin/phase-d2-content-settings` · requires Phase D1 done

````text
You are working in the InvincibleMaintainance repo. This is Phase D2 of docs/ADMIN-PLAN.md. D1
delivered the service listing, rate card, media library, home composer and hero slides. D2 finishes
the public-site content: projects, every remaining CMS resource, blog and generic pages (including
their public routes) and site settings. Use the kit and the registry.

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

TASKS

D2.1 · Projects / case studies — registry for the record (title, slug, category, service, location,
clientName with an explicit "show the client's name" consent note, status, summary, problem,
solution, outcome, durationDays, costBandMin/Max money, cover, completedAt, publishedAt, featured,
SEO) plus a bespoke Gallery tab on the edit page using POST /:id/images, PATCH /:id/images/reorder
and DELETE /:id/images/:imageId. Show the linked job number read-only when jobId is set.

D2.2 · The rest of the content, all registry entries:
offers (bullets stringList, badge, priceMin/Max money, startsAt/endsAt datetime with a
"live / scheduled / ended" status column), pricing-plans (inclusions stringList, unit, money range),
features (group filter + group field), list-items (group filter; reorder maps to position — verify
it works with the Phase A fix), content-blocks (key read-only after create, bullets, cta keyValue),
process-steps (done in C2 — check it), gallery (media + optional project relation), faqs (done in
C2), testimonials (rating 1–5, locale, photo) with a moderation view: default filter
isApproved=false and a row action Approve → PATCH /:id/approve (testimonials:moderate).

D2.3 · Pages, posts, post categories — registry entries, and the public side, which does not exist
yet: routes /blog, /blog/:slug and a catch-all generic page /:slug placed AFTER every other public
route (NotFound when the API 404s), using the existing GET /public/posts, /posts/:slug and
/pages/:slug; add those endpoints to src/api/publicApi.js; useSeo for meta; lazy-loaded pages in
src/pages/public/ following the folder-per-page rule. Add Blog to siteNav only when at least one post
is published.

D2.4 · Site settings — bespoke page /admin/platform/settings (write: ADMIN; view: settings:read):
one card per Setting.group, inputs chosen by Setting.type (derive the real list from seed-data.js),
label + hint from the row, save with PATCH /admin/settings { values } for changed keys only; phone
fields validated with the Nepali phone rule; booking.closedWeekdays as weekday checkboxes.

D2.5 · Optional, only if time remains: move StorefrontHero POPULAR_SEARCHES and
HomePage/sections/FeatureRow.jsx COPY into content blocks/settings with seed data, keeping the
current copy as the fallback.

TESTS
API: list-items reorder; public post/page 404s. vitest: the offer live/scheduled/ended helper at
Asia/Kathmandu day boundaries.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api
  cd MaintainanceFrontend && npm test && npm run lint && npm run build
Manual, both apps running:
 1. as editor@gharjatan.com.np add a project with a 3-image gallery → /projects/:slug;
 2. add an offer written in Nepali ending tomorrow → visible on the home page;
 3. approve a pending testimonial → it shows publicly;
 4. publish a post → /blog and /blog/:slug; create a page "about" → /about;
 5. as admin@gharjatan.com.np change the primary phone in settings → the site header shows it;
 6. then run the whole v1 Phase 2 scenario in one sitting: reorder the home page, add a hero slide, a
    service, a project with a gallery and an offer in Nepali, with zero code changes.

ACCEPTANCE (ADMIN-PLAN Phase D = v1 Phase 2 acceptance)
An EDITOR builds the entire home page with zero code changes and sees it live; every CMS resource in
docs/API.md has a screen; settings are editable by ADMIN; blog and generic pages render publicly;
every change is audited.

GIT
- Work on a local branch `admin/phase-d2-content-settings` created from DEVELOPMENT.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase D1's work is present on DEVELOPMENT (its files and migrations
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
- docs/API.md: the public blog/page routes as consumed; any backend change.
- STRUCTURE.md: the final resource → registry/bespoke table; the new public blog/page folders.
- STATUS.md "Public site": blog and generic pages now exist.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Resource → screen table, backend changes with tests, test counts, manual walk-through results, follow-ups. Do not start Phase E.
````
