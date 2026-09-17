# Phase H1 — Operations: back-office screens

~4 days · branch `admin/phase-h1-operations-admin` · requires Phase G done

````text
You are working in the InvincibleMaintainance repo. This is Phase H1 of docs/ADMIN-PLAN.md. Phase H is
split in two: H1 builds the dispatcher's back office (jobs, dispatch board, technicians, templates,
materials and stock); H2 closes the field-app gaps. The backend exists; almost none of it has a
screen. Since Phase F, an accepted quotation lands here as an unscheduled DRAFT job.

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md, docs/ADMIN-PLAN.md §5 Phase H,
  docs/PLAN.md Phases 6 and 7 (original intent), docs/API.md "Admin — Operations"
- Backend: src/routes/admin/ops.routes.js (technicians use raw prisma ~95–129),
  src/services/job.service.js, material.service.js, availability.service.js, casestudy.service.js,
  notify.service.js, src/shared/stateMachines.js (JOB), schemas/ops.js, permissions.js,
  tests/api/05-ops.test.js, 06-tech.test.js; src/routes/tech.routes.js (/sync mutation kinds, ~214–283)
- Frontend: src/pages/admin/DashboardPage.jsx, src/components/common/RecordHistory.jsx, the Phase D2
  project editor (for publish case study)

RULES
- Kit only (DataTable v2, ResourceForm, registry, RecordHistory). Job status changes only via the
  status/complete/verify endpoints — never PUT a status.
- D5: move the technicians' raw prisma calls into technician.service.js and paginate technicians and
  dispatch/unassigned while you are there (API tests).
- Any SMS or email to a customer (job scheduled, technician on the way) uses the customer's
  preferredLocale (Phase E).
- Drag-and-drop is never the only way to do something — every drag has a dialog/keyboard equivalent.
- Post the plan first, including the dispatch board data shape.

TASKS

H1.1 · Jobs list — /admin/jobs: filters status, type, priority, technician, customer, unassigned,
date range; presets Today, Unassigned, On hold, Completed-not-verified, Not invoiced; New job sheet
(customer + site relation, type, title, description, priority, schedule, template, technicians,
optional APPROVED quotation).

H1.2 · Job detail — /admin/jobs/:id with tabs:
Overview (customer/site with tap-to-call and a map link; source lead/quotation/survey links; schedule;
assignment with lead technician; state-driven actions: schedule, assign, en route / in progress /
hold (note) / cancel (note), complete (checklist must be done; signature, rating, note), verify);
Checklist (add/edit/remove/tick); Photos (upload with kind BEFORE/DURING/AFTER/ISSUE, gallery grouped
by kind); Materials (issue from stock with qty and billable flag; reverse); Time (logs, add a manual
log per assigned technician, delete); Costing (labour + materials + expenses vs invoiced, margin);
Events (JobStatusEvent timeline with geo when present); History (RecordHistory). A "Publish case
study" action for COMPLETED/VERIFIED (cms:write) opens the D2 project editor with the prefilled draft.

H1.3 · Dispatch board — /admin/dispatch: day and week views, technicians × time slots from
GET /admin/dispatch/board; the unassigned queue (Phase F jobs land here) as a side list; drag a job
onto a technician/slot → assign + schedule; drag between slots → reschedule; conflict and
over-capacity (dailyCapacity) warnings before commit; filter by skill/area; a "Schedule" dialog on
every job card as the non-drag path. dnd-kit from Phase C1.

H1.4 · Technicians — pages/registry: user link, employee code, skills and service areas (stringList),
certifications, hourlyRate (money, only with technicians:write — the API already hides it), daily
capacity, availability toggle, rating (read-only), current load this week.

H1.5 · Job templates — registry: name, service relation, description, tasks as an ordered stringList.

H1.6 · Materials & stock — registry entries for materials (code, name, category, supplier, unit,
purchaseRate/sellRate money, reorderLevel), material categories and suppliers; a stock page from
GET /admin/stock with a low-stock filter (/stock/low) and a per-material movements drawer; a "Record
movement" sheet (PURCHASE, RETURN, ADJUSTMENT, WASTAGE with reference/note — ISSUE_TO_JOB only from
the job); the low-stock count on the DISPATCHER dashboard.

TESTS
API: technicians pagination and the moved service. vitest: dispatch conflict/capacity helper.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npm run lint
  cd MaintainanceFrontend && npm test && npm run lint && npm run build && npm run test:e2e
Manual as dispatch@gharjatan.com.np: take the job created by an accepted quotation and schedule it
on hari's slot tomorrow by drag and by the dialog; try to double-book → warning; issue 22 kg of a
material → stock falls; add a manual time log; costing shows labour + materials; complete from the
admin (blocked while checklist items are open); verify; publish a case study.

ACCEPTANCE
A dispatcher schedules on the board with conflict warnings; job detail manages checklist, photos,
materials, time and costing; stock falls by what was issued; job costing reconciles to the paisa.

GIT
- Work on a local branch `admin/phase-h1-operations-admin` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase G's work is present on `prabesh` (its files and migrations
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
- docs/API.md: technicians pagination and any changed ops endpoints.
- STRUCTURE.md: job detail tabs, the dispatch board and its helpers.
- CLAUDE.md: D5 progress (ops.routes.js no longer calls prisma for technicians).
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Screens, backend changes, test counts, manual walk-through results, follow-ups. Do not start Phase H2.
````
