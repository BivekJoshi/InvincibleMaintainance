# Phase C1 — Admin UI kit: primitives

~2.5 days · branch `admin/phase-c1-ui-primitives` · requires Phase B done

````text
You are working in the InvincibleMaintainance repo. This is Phase C1 of docs/ADMIN-PLAN.md. Phase C
is split in two: C1 builds the primitives every later admin screen is made from; C2 builds the
resource registry, the admin shell and the first real resource on top of them. The admin today has
8 pages and ~85% of the admin API has no screen.

READ FIRST
- CLAUDE.md and MaintainanceFrontend/src/STRUCTURE.md (layer layout, no `index` files, import the
  file not the folder, semantic colour tokens only, RTK Query for server state)
- docs/ADMIN-PLAN.md §1 and §5 Phase C; docs/API.md "Admin — CMS" (the eight factory endpoints),
  media and translations
- src/components/common/DataTable.jsx, src/hooks/useListParams.js and the three current callers:
  src/pages/admin/LeadsPage.jsx, QuotationsPage.jsx, SurveysPage.jsx
- src/form/useZodForm.js, src/form/formKit.js, src/form/schemas/fields.js, src/helpers/format.js
- src/components/ui/* (what exists), components.json, src/redux/slices/uiSlice.js,
  src/components/common/Toaster.jsx (existing toasts)
- src/pages/public/ServiceDetailPage/sections/ServiceBody.jsx — find out how `body` is rendered
  (markdown? HTML? plain?) so the markdown field produces exactly that format
- MaintainanceBackend/src/services/crud.service.js, src/routes/admin/cms.routes.js,
  src/routes/admin/platform.routes.js (media, translations)
- .github/workflows/ci.yml (added in Phase A)

RULES
- shadcn components ONLY via `npx shadcn@latest add <name>` (CLAUDE.md rule 4), then edit freely.
- Extend the existing DataTable — do not create a second table component.
- zodResolver stays inside useZodForm. import.meta.env stays inside config/env.js.
- Money: requests send RUPEES, responses carry PAISA (docs/API.md). Conversion only in
  helpers/format.js (add helpers there if needed), never inline.
- Respect prefers-reduced-motion; no animation that blocks input.
- Name every new dependency in the plan with a reason. Expected: @dnd-kit/core + @dnd-kit/sortable
  (reorder), vitest + @testing-library/react + jsdom (there is no frontend test runner today).
- Post a plan (component APIs and file locations) before editing.

TASKS

C1.1 · shadcn + test runner
`npx shadcn@latest add sheet alert-dialog textarea popover calendar command breadcrumb scroll-area
radio-group accordion collapsible progress toggle-group`. Remove the hand-added Textarea from
components/ui/input.jsx and update its importers. Add vitest (jsdom) as `npm test` in
MaintainanceFrontend/package.json, and add `npm test` to the frontend job in .github/workflows/ci.yml.

C1.2 · DataTable v2 (extend components/common/DataTable.jsx; keep the three callers working)
- `rowActions(row)` → kebab dropdown column; `bulkActions` with row selection + select-all-on-page
- page-size selector (10/20/50/100) wired to `limit`
- declarative `filters` prop: [{ key, label, type: 'enum'|'relation'|'dateRange'|'boolean', options|query }]
  rendered as a filter bar and synced to the URL through useListParams — move LeadsPage's current
  toolbar filters onto it as the first real use
- `trash` mode: toggles `?deleted=true` and swaps row actions to Restore (and Purge when the user has
  `cms:purge`). If the CRUD factory list cannot list soft-deleted rows, add that to crud.service.js
  with an API test (the only backend change in scope)
- `reorderable`: drag-handle mode with dnd-kit, optimistic, calls a provided onReorder(items); a
  keyboard-accessible move up/down alternative
- fix: the search box re-syncs when params.q changes (back button); the JSDoc says data is an array
- fix: the useListParams `defaults` memo (callers pass inline objects)

C1.3 · ResourceForm (components/common/ResourceForm/ResourceForm.jsx + one file per field type)
Declarative: `<ResourceForm schema fields defaultValues onSubmit submitLabel mode="page|sheet" />`.
Field types: text, textarea, markdown (matching how the public site renders body — editor + preview),
number, money (rupees input; paisa values from the API converted for display), switch, select/enum,
relation (async combobox: command + popover, queries an admin list endpoint with q), date, datetime
(Asia/Kathmandu display, UTC out), slug (auto from a source field until edited), stringList (JSON
array of strings — bullets, inclusions), keyValue (JSON object), media (single, via MediaPicker),
mediaList (ordered), and a `group` wrapper (collapsible sections, used for SEO).
Behaviour: maps API `error.details` onto fields; unsaved-changes guard on navigation; disabled while
submitting; accessible labels and error text.

C1.4 · LocaleTabs
EN | NE tabs around translatable fields. EN edits the record; NE reads/writes GET/PUT
/admin/translations (model, recordId, values). The NE tab is disabled until the record exists.
Devanagari renders with the site's Nepali font stack.

C1.5 · MediaPicker + ConfirmDialog
- MediaPicker dialog: grid from GET /admin/media (search, folder filter, pagination), upload via
  POST /admin/media (multipart `files`), alt text required before selecting a new upload; returns
  media ids; shows variant/blurhash thumbnails.
- ConfirmDialog (alert-dialog) + a `useConfirm()` promise hook; destructive variant.

TESTS (vitest)
money field rupees↔paisa round trip including 0, 1 paisa and 1,23,45,678.90; slug generation with
Devanagari input; ResourceForm maps a 400 details payload to field errors and guards a dirty form;
useListParams filter ↔ URL round trip; DataTable selection, page size and reorder callbacks;
useConfirm resolves true/false.

VERIFY
  cd MaintainanceFrontend && npm test && npm run lint && npm run build
  (plus `cd MaintainanceBackend && npm test && npm run test:api` if C1.2 touched crud.service.js)
Run both apps. As sales@gharjatan.com.np: Leads, Quotations and Surveys still page, sort and search;
Leads filters now come from the filter bar and survive a reload and the back button; page size
changes the row count.

ACCEPTANCE
Every primitive exists with tests; the three existing list pages run on DataTable v2 with no
regressions; no hardcoded hex or raw Tailwind palette classes; nothing registry- or CMS-specific yet
(that is C2).

GIT
- Work on a local branch `admin/phase-c1-ui-primitives` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase B's work is present on `prabesh` (its files and migrations
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
- MaintainanceFrontend/src/STRUCTURE.md: DataTable v2 props, ResourceForm field types, LocaleTabs,
  MediaPicker, ConfirmDialog, where tests live and how to run them.
- MaintainanceFrontend/README.md: `npm test`, new dependencies and why.
- CLAUDE.md rule 3 names the real primitives (DataTable v2 / ResourceForm; the registry comes in C2).
- docs/API.md: `?deleted=true` on CRUD lists if you added it.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Components and their props, dependencies added, test counts, regression checks on the three list pages, follow-ups. Do not start Phase C2.
````
