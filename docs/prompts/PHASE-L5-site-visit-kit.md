# Phase L5 — Site-visit kit: booking, checklist, measurement sheet, photos

~4 days · branch `admin/phase-l5-site-visit-kit` · requires Phases H2 and L4 done · decisions L-D1…L-D4 in ADMIN-PLAN §4

````text
You are working in the InvincibleMaintainance repo. This is Phase L5 of docs/ADMIN-PLAN.md §5 Phase L.
It runs after H2 because it needs H2's photo upload queue. Today a booked visit has only a start hour and
sends the customer nothing. The field survey has no service checklist and no measurement sheet (a
quantity is a single number), and the surveyor never sees the photos the customer sent. This phase makes
the visit something the customer confirms, and gives the surveyor a guided, offline stepper. The office
then receives sections and measurement rows it can turn straight into a BOQ.

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md (the tech PWA offline pieces from H2), docs/ADMIN-PLAN.md
  §4 (D1, D7) and §5 Phase L (L5), docs/API.md "Field app", "Admin — Site surveys", "Public",
  docs/ARCHITECTURE.md "Offline strategy"
- Backend: prisma/schema.prisma (Job, SiteSurvey, SurveyReading, SurveyItem, JobPhoto, LeadPhoto,
  CustomerSite), src/services/convert.service.js (the inspection job ~140–165),
  src/services/survey.service.js (INCLUDE, FIELD_INCLUDE ~47, saveDraft, submitSurvey,
  toQuotationLine ~456, buildQuotationFromSurvey ~477), src/services/leadPhoto.service.js,
  src/services/job.service.js (scheduleJob ~792, dispatchBoard ~667), src/routes/tech.routes.js
  (surveys ~134–172, /sync ~214 with the survey_draft kind), src/routes/public.routes.js,
  src/middleware/rateLimit.js, src/shared/schemas/survey.js (surveySaveSchema ~61),
  src/shared/schemas/crm.js (leadConvertSchema ~104), src/shared/enums.js (JOB_PHOTO_KINDS),
  src/utils/quantity.js (measurementQty, L2), src/services/notify.service.js, src/crons/index.js,
  src/queues/handlers.js, prisma/seed-data.js (message templates)
- Tests: tests/api/04-surveys.test.js, 06-tech.test.js (the L0 key-scan), 02-public.test.js,
  22-lead-follow-up.test.js
- Frontend: src/pages/tech/SurveyFormPage.jsx (it becomes a folder), SurveyListPage.jsx,
  src/api/techApi.js (uploadSurveyPhotos), src/helpers/offlineQueue.js, src/hooks/useOfflineQueue.js,
  src/components/layout/TechLayout.jsx, public/sw.js, src/components/leads/ScheduleVisitDialog.jsx,
  ConvertLeadSheet.jsx, src/pages/admin/SurveyReviewPage.jsx, src/components/surveys/SurveyFindings.jsx,
  SurveyPricingTable.jsx, src/pages/admin/DispatchBoardPage/DispatchJobCard.jsx, src/routes/AppRoutes.jsx

RULES
- D1: the surveyor reports quantities only. No /tech response and no field screen carries a rate, cost,
  total or margin. The L0 key-scan runs over the new /tech shapes.
- Designed for a 360 px screen and gloves-on thumbs: large targets, few taps, one card per measurement
  row on a phone.
- Offline first: every field write goes through the existing `survey_draft` sync kind (a full replace).
  Photos go through H2's upload queue and are append-only.
- Customer messages (visit_booked, the reminder) use the customer's preferredLocale, en and ne, with
  Nepali text and Nepali phone numbers tested. The /visit/:token page is in en and ne.
- Measured quantities are derived on the server (quantity.js#measurementQty). The feet-inches parser in
  the SPA only turns 12'6" into a decimal.
- Kit only: the inspection template is a registry entry.
- Tests first for backend changes. Post the plan first: migrations, where the booking fields live, the
  checklist question schema, the stepper's steps and their offline payloads.
- Update the docs in the same change.

TASKS

L5.1 · Booking the visit
- The booking (ScheduleVisitDialog / convert) takes a time window (start and end), a site contact name and
  phone (the caretaker when the owner is abroad, which ties to L1's qualification), and a landmark. Say in
  your plan where they live; the inspection Job is the natural home.
- After commit, a `visit_booked` SMS (en + ne) goes to the customer, and to the site contact when that is
  someone else. It carries the surveyor's name and phone, the window, and a /visit/:token link.
- A public page /visit/:token (en/ne) with two buttons, Confirm · Need another time:
  · GET /public/visits/:token
  · POST /public/visits/:token/respond { answer: 'confirm' | 'reschedule', note? }, rate-limited, with
    the time and IP recorded. "Need another time" notifies the salesperson and the dispatchers.
- A `visits:remind` task at 17:00 Kathmandu time the day before each visit, sent once (L1's dedupeKey).
- Unconfirmed visits are flagged on the dispatch board card.

L5.2 · Inspection templates and the new survey data (schema)
- New model InspectionTemplate (serviceId?, name, questions Json, isActive, sortOrder), mounted with
  mountResource, as a registry entry under Operations.
- The question types: yes/no, number with a flag threshold, choice, and text. Each question has a key and
  a label, and can be required and can require a photo.
- SurveyReading gains questionKey and flagged. The server computes flagged from the template's threshold.
- SurveyItem gains measurements Json (rows `{ area, description, nos, l, b, h, deduct }`), and the server
  derives qty from them.
- JobPhoto gains area. JOB_PHOTO_KINDS gains SKETCH, for a photo of a paper sketch.
- Submit refuses a survey with a required answer or a required photo missing: 422, with a code you name,
  and a details list the stepper can point at.

L5.3 · The field stepper
- pages/tech/SurveyFormPage.jsx becomes the folder pages/tech/SurveyFormPage/, with SurveyFormPage.jsx and
  a file per step:
  · Before you go: the customer's own photos (LeadPhoto) and message. No money.
  · Arrived: GPS → the site pin (CustomerSite lat/lng), with a confirm step when a pin already exists.
  · Service checklist: from the service's inspection template; flagged answers are highlighted.
  · Measurement sheet: by room, feet-inches input, deductions, one card per row on a phone, and the
    derived quantity shown after sync.
  · Photos: caption and area, through H2's queue, including SKETCH.
  · Findings.
  · Lines.
- FIELD_INCLUDE adds the lead's photos and message and the inspection template. It still carries no
  money.

L5.4 · The office review
- SurveyReviewPage / SurveyFindings show the customer's photos, the survey photos grouped by area, flagged
  readings first, the measurements and the pin (with a map link).
- Build quotation carries sections (by area or category) and the measurement rows into the BOQ
  (toQuotationLine and L3's buildLines), so the quotation arrives with the same sections and quantities.

L5.5 · Seed
A damp/seepage inspection template (a moisture reading with a flag threshold, salt deposits, DPC visible,
source of water, required photos). The visit_booked and visit reminder templates in en and ne. One booked
visit that is confirmed and one that is not. A submitted survey with a flagged reading, measured rooms and
photos by area.

TESTS
- 04-surveys:
  · A missing required answer or photo blocks submit, and flagged is computed from the threshold.
  · Two rooms with a door deduction derive the expected qty.
  · survey_draft replays idempotently with measurements and readings.
  · Build quotation keeps the sections and measurement rows.
- 02-public: /public/visits/:token confirm and reschedule; a second answer; an unknown token; the rate
  limit.
- 22-lead-follow-up (or 04-surveys): visits:remind sends once across two runs; the ne template reaches a
  ne customer; the Nepali phone number is normalised.
- 06-tech: the key-scan still passes on the new /tech survey shape.
- vitest:
  · the feet-inches parser: 12'6", 12' 6", 6", and plain decimals;
  · the stepper blocks submit and points at the missing item;
  · the measurement cards at 360 px;
  · the /visit page in en and ne;
  · the unconfirmed flag on the dispatch card.
- e2e/boq-flow.spec.js gains: book the visit, and build the quotation from the submitted survey.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npx eslint src tests
  cd MaintainanceFrontend && npm test && npm run lint && npm run build && npm run test:e2e
Manual:
- As sales@gharjatan.com.np, book a visit with a caretaker contact, then open the SMS link as the customer
  in Nepali and confirm.
- As survey@gharjatan.com.np, at 360 px with the network set to offline in devtools: complete a damp
  checklist with a flagged reading and a photo, measure two rooms with a door deduction in feet-inches,
  pin the GPS, go back online and watch it sync.
- As sales, build the quotation and compare its sections and quantities with the survey.

ACCEPTANCE (ADMIN-PLAN §5 Phase L · L5)
The customer confirms in Nepali, reminder sent once; offline at 360 px the surveyor completes a damp
checklist with a flagged reading + photo, measures two rooms with a door deduction in feet-inches, pins GPS
and syncs; the quotation arrives with the same sections and quantities; the `/tech` key-scan still passes.

GIT
- Work on a local branch `admin/phase-l5-site-visit-kit` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase H2's and Phase L4's work is present on `prabesh` (their files and
  migrations exist; H2's photo upload queue in particular). If it is not, STOP and tell me.
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
- docs/API.md: the booking fields, /public/visits/:token, inspection templates, the survey
  readings/measurements/photo-area contract, the submit error, the new FIELD_INCLUDE keys.
- docs/ARCHITECTURE.md "Offline strategy": what the stepper queues and how measurements travel in
  survey_draft, as built.
- STRUCTURE.md: the SurveyFormPage folder and its steps, the feet-inches parser, the /visit page.
- MaintainanceBackend/README.md: the visits:remind task and the new templates; add
  survey@gharjatan.com.np (SURVEYOR) to the seeded logins table if it is still missing.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Migrations, endpoints, the question schema, the stepper's steps and offline payloads, the templates, test
counts, the manual walk-through (note the viewport and the network state) and follow-ups. Do not start
Phase I; Phase I runs next, then L6.
````
