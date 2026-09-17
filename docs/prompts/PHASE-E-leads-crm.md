# Phase E — Lead management & CRM

~5 days · branch `admin/phase-e-leads-crm` · requires Phase C (B recommended)

````text
You are working in the InvincibleMaintainance repo. This is Phase E of docs/ADMIN-PLAN.md: make
the sales team able to work a lead from first contact to a converted customer entirely in the
admin UI. The backend endpoints mostly exist; the frontend has a lead list + detail with most
actions missing, and no customers screens at all.

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md (Phase C kit section)
- docs/ADMIN-PLAN.md §4 (D6) and §5 Phase E; docs/API.md "Admin — CRM"
- Frontend: src/pages/admin/LeadsPage.jsx, LeadDetailPage.jsx, SlaBoardPage.jsx,
  src/components/leads/ScheduleVisitDialog.jsx, src/api/leadsApi.js (many hooks exist but are
  unused: create/update/setStatus/assign/merge/delete/duplicates), src/api/dashboardApi.js,
  src/components/common/SlaChip.jsx, src/config/constants.js, src/form/schemas/lead.schema.js
- Backend: src/routes/admin/crm.routes.js, src/services/lead.service.js, convert.service.js,
  customer.service.js, sla.service.js, notify.service.js, src/shared/stateMachines.js (LEAD),
  src/shared/schemas/crm.js, src/shared/permissions.js, tests/api/03-crm.test.js

DECISION D6 — DECIDED (2026-09-14): every SALES user can see all leads; the Leads page defaults
to "My leads" (assigned to me) with a one-click "All leads". No record-level restriction.

RULES
- Build lists with DataTable v2 and forms with ResourceForm (bespoke layouts are fine; bespoke
  tables/forms are not). Lead status changes only through PATCH /:id/status (state machine).
- Phone numbers: Nepali rule from src/config/locale.js / schemas/fields.js on every phone input;
  test mobile (98XXXXXXXX), landline (01-5407720) and invalid cases.
- Backend changes listed below each need an API test and a docs/API.md update.
- Post the plan first.

TASKS

E1 · Leads list
- "New lead" sheet (the button exists with no onClick): name, phone, altPhone, email, address, area,
  service (relation), source enum (call, walk_in, whatsapp, viber, referral, web_form …— use the
  backend enum), priority, message, assignee. POST /admin/leads.
- Default view "My leads": backend accepts `assignedToId=me` (resolve to req.user.id) — add it if
  missing. Toggle to All.
- Declarative filters: status, priority, source, service, assignee, SLA risk, date range,
  "Requested visit" (source=booking).
- Bulk actions: assign selected (PATCH assign per id, or add POST /admin/leads/bulk-assign if you
  judge per-id calls unacceptable — justify), export selected/filtered.
- URL-saved presets: "Breached", "Unassigned", "Bookings this week".

E2 · Pipeline board — /admin/leads/board
Kanban columns = LEAD statuses. Cards show name, service, area, assignee avatar, SlaChip, age.
Drag between columns calls setLeadStatus; only drops allowed by LEAD_TRANSITIONS are enabled
(mirror the transitions in src/config/constants.js with a parity test); dropping on LOST opens a
lostReason dialog; failed transitions roll the card back with a toast. Data: the list endpoint per
column with limit + meta.total ("+N more" link to the filtered table). Respect reduced motion.

E3 · Lead detail
Header actions: Edit (sheet, ResourceForm), Change status (menu of allowed next states),
Assign (user combobox of SALES/ADMIN), Delete (confirm, soft). Panels:
- Contact + request (preferred visit slot, estimate payload rendered readably, UTM, source page)
- Activity composer with typed entries: call, sms, whatsapp, email, visit, note — logging a
  call/contact stamps firstResponseAt (show the SLA result after logging)
- Duplicates panel (GET /:id/duplicates) with Merge → POST /merge { primaryId, duplicateIds },
  a preview of what moves, confirm dialog
- Linked customer, quotations, jobs, survey (existing links)
- Convert: keep ScheduleVisitDialog for inspection booking; add "Convert without visit" →
  customer + site + optional quotation (POST /:id/convert). Show the created records with links.
- History tab: see E6.

E4 · Customers — /admin/customers
- List (DataTable v2): name, type, phone, email, sites count, open jobs, balance due if the caller
  has finance capability; filters type/tags; New customer sheet.
- Detail: profile edit (type individual|company, PAN/VAT no., phones, email, notes, tags),
  Sites tab (CRUD: label, address, area, lat/lng with a "use map pin" text input for now,
  accessNotes, isPrimary — exactly one primary), Timeline tab (GET /:id/timeline), Quotations,
  Jobs, Invoices, Warranties, AMC tabs as filtered DataTables linking to their records (render
  "Soon" for record pages not built yet), Statement link when the user has reports/finance cap.
- Add the customersApi.js RTK file; tags Customer / CustomerSite, invalidated by lead convert.

E5 · Notifications
Normalise backend notification links to SPA admin paths: every notify caller emits `/admin/...`
(decideByToken currently emits `/quotations/:id`). grep all `link:` in services, fix them, API test
one of each kind. Frontend panel (from Phase C) navigates to them; unread badge polls with the
dashboard cadence.

E6 · Record history (backend + component)
GET /admin/audit-logs is ADMIN-only, but sales must see a lead's history. Add
GET /admin/leads/:id/history and GET /admin/customers/:id/history, each guarded by that record's
own read capability, returning that record's AuditLog rows (and child rows you consider part of it,
e.g. LeadNote/LeadActivity creations) — redacted, paginated, newest first, actor name + role.
Build components/common/RecordHistory.jsx ({ endpoint } → timeline with event label, actor, time
in Kathmandu, expandable before/after diff). Phase G generalises it — keep the API generic enough.

E7 · SLA board polish — deep links into lead detail, "Log response" uses the typed activity
composer, breached count in the nav badge.

E8 · Contact details that stay safe for later customer accounts (small — do NOT build accounts)
Customers never need an account, but after launch (Phase K) a customer may sign up with their email
and see the history recorded under it. Customers are matched by PHONE today, and phones are shared
(families, tenants) and recycled — so an email must never attach itself to someone else's record.
- Add an optional Email field to the public booking wizard's contact step and the contact/lead form
  (the backend lead schema already accepts `email`; the forms never ask for it).
- Normalise email to trimmed lower-case in the shared field schema (backend
  src/shared/schemas/common.js optionalEmail and its frontend mirror).
- Convert must NOT silently reuse a customer because the phone matches. When a customer with that
  phone exists, the convert UI (ScheduleVisitDialog and "Convert without visit") shows it —
  "Existing customer with this phone: <name> · <n> jobs · last visit <date>" — and staff choose:
  · "Same person" — link to it. If the lead's email differs from the customer's (or the customer has
    none), a separate checkbox "Also save <email> on this customer", unchecked by default; saving it
    emits the audited event customer.email_confirmed with the staff member as actor.
  · "Different person" — create a new customer with this phone and the lead's email.
  POST /admin/leads/:id/convert takes { customerId } or { createNewCustomer: true } plus
  { confirmEmail }; when neither is given and the phone matches, it answers 409 CUSTOMER_MATCH with
  the candidates instead of guessing. Update the existing convert API tests deliberately and say so.
- Nothing else may write an email onto an existing customer except a staff edit (audited) or, after
  launch, the customer's own verified account.
Tests: normalisation (case, spaces); phone match with no decision → 409 with candidates; "different
person" creates a second customer with the same phone; "same person" without confirmEmail leaves the
customer's email untouched; with confirmEmail it is saved and audited; booking with and without an
email both create a lead.

E9 · Customer's preferred language
Leads and customers have no language field, so every customer SMS and email goes out in English even
when they booked in Nepali. Migration `contact_preferred_locale`: Lead.preferredLocale and
Customer.preferredLocale String @default("en"), validated en|ne.
- The public booking wizard and the lead form send the site's current locale (uiSlice).
- Convert copies it onto a new customer; for an existing customer staff see both and keep the
  customer's unless they change it.
- Lead and customer screens show and edit "Preferred language: English / नेपाली".
- Every notify() call whose recipient is a customer or lead passes that record's preferredLocale.
  grep the notify callers, fix them all, and list them in the report. Verify loadTemplate falls back
  to en when the ne template is missing.
Tests: a booking in ne → lead.preferredLocale 'ne' → the customer-facing SMS uses the ne template;
missing ne template → en fallback; convert copies the value to a new customer.

TESTS
API: assignedToId=me; history endpoints RBAC (SALES 200 on leads history, DISPATCHER 403);
notification links. vitest: lead transitions mirror parity; phone validation fixtures; board drop
enablement helper.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api
  cd MaintainanceFrontend && npm test && npm run lint && npm run build
Manual as sales@gharjatan.com.np: submit a lead on the public contact form → it appears under
New with a 120-minute countdown → assign to self → log a call (SLA stamped) → move on the board to
CONTACTED → find its duplicate (create a second lead with the same phone first) and merge →
convert with an inspection visit and surveyor (choose "same person" / "different person" when
the phone matches an existing customer) → open the customer, add a second site → lead
History tab shows each step.

ACCEPTANCE (ADMIN-PLAN Phase E = v1 Phase 4 UI half)
A lead can be created, assigned, worked, merged and converted into customer + site + scheduled
inspection entirely in the UI; customers and sites are manageable; every step shows on the
History tab; export works with filters; a matching phone never silently
reuses a customer or copies an email onto one; leads and customers carry a preferred language that
customer messages follow.

GIT
- Work on a local branch `admin/phase-e-leads-crm` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase D2's work is present on `prabesh` (its files and migrations
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
- docs/API.md: assignedToId=me, bulk assign (if added), lead/customer history endpoints and their
  capabilities, the notification link convention (/admin/...).
- STRUCTURE.md: RecordHistory component; customersApi.
- docs/ADMIN-PLAN.md §4: record D6, and the D7/D8 notes (language capture, email confirmation), as built.
- docs/API.md: convert's explicit customer choice (409 CUSTOMER_MATCH, confirmEmail) and preferredLocale
  on leads and customers; docs/DATA-MODEL.prisma: preferredLocale.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Screens built, backend changes + tests, test counts, manual walk-through results, follow-ups.
Do not start Phase F.
````
