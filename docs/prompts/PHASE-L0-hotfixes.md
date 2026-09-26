# Phase L0 — Hotfixes: double billing, the /tech money leak, survey photos

~1 day · branch `admin/phase-l0-hotfixes` · requires Phase H1 done · defects #16–#18 in ADMIN-PLAN §3 · decisions L-D1…L-D4 in §4

> **Note.** L0 is being implemented in the planning session on 2026-09-26. This prompt records its scope as built
> (see "Deviations (Phase L0)" in ADMIN-PLAN §5 Phase L) so the work can be reviewed, or re-run in a fresh session.

````text
You are working in the InvincibleMaintainance repo. This is Phase L0 of docs/ADMIN-PLAN.md §5 Phase L
("Pipeline stages that work like a site team"). While planning Phase L we found three defects, now #16,
#17 and #18 in ADMIN-PLAN §3. Fix them before anything is built on top of them. The work is mostly
backend, plus one frontend read.

NOTE: L0 is being implemented in the planning session on 2026-09-26. This prompt documents its scope for
review and re-runs. Before you edit anything, check each task against the code and against "Deviations
(Phase L0)" in ADMIN-PLAN §5 Phase L. If a fix and its test are already present, verify them: run the
tests and read the change. Then report "already done" and do not rebuild it.

THE DEFECTS
#16 Double billing (money). invoice.service.js#createFromJob bills every quoted line. It then also adds
    the job's billable materials, and a labour line priced at the technician's internal hourlyRate, which
    is a cost and not a sell rate. invoiceFromJobSchema (src/shared/schemas/ops.js ~302) turns both
    switches on by default, and `z.coerce.boolean()` reads the string "false" as true. So every job that
    came from a quotation is billed twice. The quotation's discount is dropped. Rates go from paisa to
    rupees and back to paisa (`qi.rate / 100`). The invoice and `job.invoicedAt` are written in separate
    statements, so two clicks can invoice one job twice.
#17 Money reaches the field app. GET /tech/jobs/:id returns jobs.getJob. getJob's INCLUDE (job.service.js
    ~25–33) carries quotation.total, every assigned technician's full row including hourlyRate (so a
    technician can read a colleague's pay) and JobMaterial.rate. The status, material and timer replies
    return the same office job. D1 says the field never sees money.
#18 Survey photos never render. MaintainanceFrontend/src/components/surveys/SurveyFindings.jsx:110 reads
    `survey.media[p.mediaId]`, but getSurvey (src/services/survey.service.js ~97) never returns `media`.

READ FIRST
- CLAUDE.md; docs/ADMIN-PLAN.md §3 (#16–#18), §4 (D1, L-D1…L-D4), §5 Phase L (L0 and its Deviations) and
  §5 Phase I (its acceptance line); docs/API.md "Admin — Finance", "Field app", "Admin — Site surveys"
- Backend: src/services/invoice.service.js (createInvoice, createFromJob), src/shared/schemas/ops.js
  (invoiceFromJobSchema), src/routes/admin/finance.routes.js (POST /invoices/from-job/:jobId),
  src/utils/money.js (documentTotals), src/services/settings.service.js, src/routes/tech.routes.js,
  src/services/job.service.js (INCLUDE, getJob), src/services/technician.service.js (withRateFor),
  src/services/survey.service.js (INCLUDE, FIELD_INCLUDE, getSurvey), src/services/media.service.js,
  prisma/seed-data.js (settings; rate-card code LABOUR-SKILL)
- Tests: tests/api/helpers.js (approveAndSend, technicianIdFor, createCompletedJob),
  tests/api/07-finance.test.js, 06-tech.test.js, 04-surveys.test.js, tests/money.test.js
- Frontend: src/components/surveys/SurveyFindings.jsx, src/pages/admin/SurveyReviewPage.jsx,
  src/pages/admin/SurveyScreens.test.jsx

RULES
- Money is integer paisa, and only src/utils/money.js does arithmetic on it. VAT is computed once, at
  document level (documentTotals).
- D1 money wall: no /tech response carries a rate, amount, total, cost, price, discount, VAT, pay or
  margin. Enforce it in one place, so an include added later cannot leak a price by accident.
- Tests first. Each fix starts with a failing API test that proves the defect on today's code.
- Make the smallest change that closes each defect. Phase L2 brings src/utils/quantity.js and the staff
  cost wall (costs:read, stripCosts); do not start them here.
- Post the plan first: the files, the rule that decides a money key, and the setting you add.

TASKS

L0.1 · Invoice a job by exactly one rule (#16)
- From a quotation: bill its lines, discount and VAT choice, which is what the customer accepted, so the
  invoice total equals the quotation total to the paisa. `opts.discount` (rupees) and `opts.vatApplied`
  may override the quotation's. If the request asks for materials or labour on a quoted job, answer 422
  `QUOTED_JOB_BILLS_SCOPE`: extra work is invoiced on its own (variations arrive in L7).
- Without a quotation: bill what the job consumed. Billable materials are billed at the JobMaterial.rate
  they were issued at. Logged time is one line at the rate-card item named by a new setting,
  `finance.labourRateCode` (seeded `LABOUR-SKILL`, priced per hour), and never at Technician.hourlyRate.
  If that item is missing or not priced per hour, answer 422 `LABOUR_RATE_MISSING`, with a message saying
  how to fix it. If nothing was recorded, write one lump line at 0 to price by hand while the invoice is a
  draft.
- invoiceFromJobSchema: includeMaterials, includeLabour and vatApplied become plain optional booleans, with
  no coercion and no default.
- Paisa straight through. Every invoice is written by one paisa-native
  `insertInvoice(tx, header, items, opts)` that uses documentTotals. createInvoice (rupee wire format) and
  createFromJob both use it; there is no `/100` and back.
- Claim the job in the same transaction: `job.updateMany({ where: { id, invoicedAt: null } })` as a
  compare-and-swap. If the count is 0, answer 422 "already invoiced" and write nothing.

L0.2 · One money wall on the field router (#17)
- src/utils/moneyWall.js:
  · `isMoneyKey(key)`: a key is money when one of its camelCase words is rate, amount, total, subtotal,
    discount, margin, balance, cost, price, wage, paid, vat or estimate (plurals included). Links
    (`…Id`) and `priceUnit` are not money.
  · `fieldSafe(value)`: a deep copy without money keys, at any depth. Dates and primitives pass through.
- Apply fieldSafe to every /tech response in src/routes/tech.routes.js: one router-level middleware that
  wraps `res.json` and filters `data`.
- The plan named a per-endpoint `techJobView` allowlist. It was not built, because the status, material and
  timer replies also returned the office job, so an allowlist would have to follow every mutation. The
  router filter covers them all. This is recorded as a deviation.

L0.3 · Survey photos render (#18)
- getSurvey's office view returns `media`: the site photos' images keyed by media id
  (media.service#resolveMediaMap), which is the shape SurveyFindings.jsx already reads. The field view is
  unchanged.

L0.4 · Correct the billing rule where it is written down
- docs/ADMIN-PLAN.md §5 Phase I acceptance: "job → invoice by the job's billing rule — a quoted job bills
  its quoted scope, an unquoted job its real materials and labour (never both; defect #16, Phase L0)".
- Make the same change to the ACCEPTANCE line of docs/prompts/PHASE-I-finance-aftercare.md ("Job → invoice
  with real materials and labour"), and to its I1 "Create from job" text if that implies the materials and
  labour switches.

TESTS (written first)
- 07-finance:
  · A quoted job with billable materials and time logs invoices at exactly the quotation total,
    discount included. This test must fail on today's code.
  · Materials or labour asked for on a quoted job → 422 QUOTED_JOB_BILLS_SCOPE.
  · An unquoted job's labour uses LABOUR-SKILL's rate, never hourlyRate. A missing or non-hourly item →
    422 LABOUR_RATE_MISSING. The string "false" is refused, not read as true.
  · Two concurrent from-job calls produce one invoice.
- 06-tech: a key-scan (`moneyKeys`, the same word rule) over about ten field responses. Use a quoted job
  with two technicians, a material and a timer. Cover status, material, time start and stop, today, list,
  detail, materials, rate-card, and surveys as SURVEYOR. Expect no money key in any `data`. Then check the
  screen still works: both people and the material are present.
- tests/moneyWall.test.js: isMoneyKey names money by its words (hourlyRate, vatAmount, dayWage, marginPct
  yes; rateCardItemId, customerRating, priceUnit, estimatedDays no); fieldSafe strips at every depth and
  keeps Dates and Devanagari text.
- 04-surveys: a survey with an uploaded photo returns `media[photo.mediaId]` to the office.
- vitest (SurveyScreens.test.jsx): the review page renders the photo's image src.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npx eslint src tests
  cd MaintainanceFrontend && npm test && npm run lint && npm run build && npm run test:e2e
Manual, with the dev server on a seeded database: as accounts@gharjatan.com.np, POST
/admin/invoices/from-job/:jobId (with curl) for a quoted, completed job, and compare its total with the
quotation total. As hari@gharjatan.com.np, GET /tech/jobs/:id and read the JSON. As
sales@gharjatan.com.np, open a survey review page that has photos.

ACCEPTANCE (ADMIN-PLAN §5 Phase L · L0)
A quoted job with billable materials and time logs invoices at exactly the quotation total (test fails on
today's code); the key-scan finds no `rate|cost|total|hourlyRate|margin` under `/tech`; survey photos
render on the review page.

GIT
- Work on a local branch `admin/phase-l0-hotfixes` created from `prabesh`.
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
- docs/ADMIN-PLAN.md §3: tick #16, #17 and #18 with "L0" and the date.
- docs/API.md: POST /admin/invoices/from-job/:jobId (the two rules, the optional switches and overrides,
  QUOTED_JOB_BILLS_SCOPE, LABOUR_RATE_MISSING); "Field app" (no response carries money, and why);
  `media` on GET /admin/surveys/:id.
- docs/ARCHITECTURE.md: the billing rule (quoted scope vs actuals), and the field money wall
  (moneyWall.js#fieldSafe on the /tech router), next to the money notes.
- docs/ADMIN-PLAN.md §5 Phase I acceptance and docs/prompts/PHASE-I-finance-aftercare.md (L0.4).
- MaintainanceBackend/README.md: `finance.labourRateCode` wherever the seeded settings are listed.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
For each defect: "fixed" or "already done — verified", the failing-then-passing test, the money-key rule as
built, the setting added, test counts, the manual results and follow-ups. Do not start Phase L1.
````
