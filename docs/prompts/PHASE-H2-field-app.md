# Phase H2 — Operations: field app

~3 days · branch `admin/phase-h2-field-app` · requires Phase H1 done

````text
You are working in the InvincibleMaintainance repo. This is Phase H2 of docs/ADMIN-PLAN.md: close the
gaps in the technician/surveyor field app (/tech) so a technician can finish a whole job on a phone,
partly offline. H1 built the dispatcher's side.

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md, docs/ADMIN-PLAN.md §5 Phase H,
  docs/PLAN.md Phase 6 (the field flow), docs/ARCHITECTURE.md "Offline strategy",
  docs/API.md "Field app"
- Backend: src/routes/admin/ops.routes.js (technicians use raw prisma ~95–129),
  src/services/job.service.js, material.service.js, availability.service.js, casestudy.service.js,
  notify.service.js, src/shared/stateMachines.js (JOB), schemas/ops.js, permissions.js,
  tests/api/05-ops.test.js, 06-tech.test.js; src/routes/tech.routes.js (/sync mutation kinds, ~214–283)
- Frontend: src/pages/tech/*, src/components/layout/TechLayout.jsx, src/api/techApi.js,
  src/helpers/offlineQueue.js, src/hooks/useOfflineQueue.js, public/sw.js

RULES
- /tech responses and screens never show money (the money wall).
- Photos: compress client-side (max 1600px long edge, JPEG/WebP ~0.8) before upload; EXIF is stripped
  server-side already. Photos are append-only, so they never conflict.
- Designed for a 360px screen and gloves-on thumbs: large targets, few taps.
- Post the plan first, including the offline mutation kinds you will use.

TASKS

H2.1 · Photos — job photos (camera capture input, kind picker, compressed upload, retry) and survey
photos (the uploadSurveyPhotos hook exists but is unused). Uploads that fail offline wait in a queue
and retry when back online.

H2.2 · Materials used — pick from /tech/materials (no rates), qty, submit via POST /tech/jobs/:id/materials.

H2.3 · Signature + completion — canvas signature → upload as media → complete with signatureMediaId,
note, optional rating; blocked with a clear message while checklist items are open.

H2.4 · Offline job mutations — route job status, task toggles, timer start/stop, materials and
complete through offlineQueue using the mutation kinds /tech/sync accepts (add a kind server-side
only if a needed one is missing, with an API replay/idempotency test). Show the pending queue count
in TechLayout.

H2.5 · My history — past jobs via getMyJobs (hook exists, unused), with a date range.

TESTS
API: any new sync kind replays idempotently. vitest: image compression helper (dimensions, size);
offline queue ordering and dedupe by idempotency key.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npm run lint
  cd MaintainanceFrontend && npm test && npm run lint && npm run build && npm run test:e2e
Manual as hari@gharjatan.com.np at 360px: open today → en route → start → tick the checklist → go
offline (devtools) → add a photo, log a material, tick more tasks → back online → everything syncs →
sign and complete; then as dispatch@gharjatan.com.np verify the job, check costing and that the
warranty exists.

ACCEPTANCE (ADMIN-PLAN Phase H = v1 Phase 6 acceptance)
The technician completes the whole flow on a phone, partly offline, and everything syncs — photos,
checklist, signature, time, materials.

GIT
- Work on a local branch `admin/phase-h2-field-app` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase H1's work is present on `prabesh` (its files and migrations
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
- docs/API.md: any new /tech/sync mutation kinds.
- docs/ARCHITECTURE.md "Offline strategy": what is queued, photo upload retry, what the service worker
  caches — as built, not as planned.
- STRUCTURE.md: the tech PWA offline pieces and the image compression helper.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Screens, sync kinds, test counts, manual walk-through results (note the viewport), follow-ups. Do not start Phase I.
````
