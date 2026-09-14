# Phase C2 — Admin UI kit: resource registry, admin shell & first resource

~1.5 days · branch `admin/phase-c2-registry-shell` · requires Phase C1 done

````text
You are working in the InvincibleMaintainance repo. This is Phase C2 of docs/ADMIN-PLAN.md. C1 built
DataTable v2, ResourceForm, LocaleTabs, MediaPicker and ConfirmDialog. C2 turns them into a pattern:
after this phase, a CMS resource screen is a config file, not a page — proven on FAQs.

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md (the C1 kit section)
- docs/ADMIN-PLAN.md §5 Phase C; docs/API.md "Admin — CMS"
- src/components/common/DataTable.jsx and src/components/common/ResourceForm/ (as built in C1)
- src/components/layout/AdminLayout.jsx, src/routes/AppRoutes.jsx, src/routes/routeModules.js,
  src/routes/RequireAuth.jsx, src/helpers/permissions.js, src/hooks/useSiteSettings.js
- src/api/apiSlice.js, src/api/baseQuery.js, src/api/dashboardApi.js (notifications hooks)
- MaintainanceBackend/src/shared/schemas/cms.js, src/routes/admin/cms.routes.js, src/shared/permissions.js

RULES
- Build only from the C1 kit — no new table or form components.
- One RTK Query slice; every admin page lazy-loaded; import files, not folders.
- Post the plan first: the registry shape, file locations and route layout.

TASKS

C2.1 · Generic CMS API + resource registry
- src/api/cmsApi.js: endpoints parameterised by resource path — listResource, getResource,
  createResource, updateResource, toggleResource, reorderResource, deleteResource, restoreResource —
  tagged { type: 'Cms', id: `${resource}` } and `${resource}:${id}`; add the 'Cms' tag type to apiSlice.
- Registry: one file per resource (proposed src/config/admin/resources/<resource>.jsx — .jsx because
  columns render cells; argue a better layer in the plan if you see one) holding { resource, path,
  label, capability, columns, filters, fields, schema, defaultValues, sortable,
  translatable: [fields], publicHref(record) }.
- Generic pages src/pages/admin/ResourceListPage.jsx and ResourceEditPage.jsx; lazy routes
  /admin/content/:resource, /admin/content/:resource/new, /admin/content/:resource/:id, guarded by the
  entry's capability; an unknown resource renders NotFoundPage.
- zod schemas mirroring MaintainanceBackend/src/shared/schemas/cms.js in src/form/schemas/cms.schema.js.

C2.2 · Admin shell
- AdminLayout nav regrouped: Overview · Sales · Operations · Finance · Aftercare · Content · Platform,
  capability-filtered; unbuilt items keep the existing "Soon" treatment. An EDITOR lands on Content,
  not an empty dashboard.
- Admin breadcrumb from the route; brand name from useSiteSettings instead of hardcoded text.
- The notification bell opens a panel (getNotifications, markNotificationRead, markAllRead); links
  navigate inside /admin.

C2.3 · Proof: FAQs end to end, then a timed second resource
- Registry entry for `faqs` only: list (group filter, search, toggle, reorder, trash/restore),
  create/edit (question, answer in the format the public site renders, group), NE translation. No
  FAQ-specific page component.
- Then add `process-steps` the same way and time it; report how long it took.

C2.4 · Cleanup
Remove the dead barrels config/config.js, helpers/helpers.js and hooks/hooks.js only if they still
have zero importers.

TESTS (vitest)
A registry guard test (every entry has capability, schema, columns and a valid path); cmsApi
invalidates the right tags on create/update/delete (store-level test with mocked fetch); nav items
filtered correctly for ADMIN, EDITOR and SALES.

VERIFY
  cd MaintainanceFrontend && npm test && npm run lint && npm run build
Run both apps. As editor@gharjatan.com.np: Content → FAQs, create an FAQ, add its Nepali
translation, reorder it to the top, disable it, delete it, restore it; confirm each change on the
public site (the FAQ list on a service page). As sales@gharjatan.com.np: Content is absent from the
nav and /admin/content/faqs is refused.

ACCEPTANCE (ADMIN-PLAN Phase C)
FAQs fully managed from a registry entry alone; a second simple resource added in under an hour
(reported); the nav is role-correct and the notification panel works.

GIT
- Work on a local branch `admin/phase-c2-registry-shell` created from DEVELOPMENT.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase C1's work is present on DEVELOPMENT (its files and migrations
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
- MaintainanceFrontend/src/STRUCTURE.md: the resource registry with a worked "add a resource"
  example, cmsApi, the generic pages, the nav groups.
- CLAUDE.md rule 3: admin CRUD screens are registry entries on DataTable v2 / ResourceForm.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Registry shape, files added, time taken for the second resource, test counts, manual walk-through results, follow-ups. Do not start Phase D1.
````
