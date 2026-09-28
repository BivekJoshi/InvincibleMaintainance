# Phase L2 — Foundations, rate library & money wall

~4 days · branch `admin/phase-l2-rate-library` · requires Phase L1 done · decisions L-D1 and L-D4 in ADMIN-PLAN §4

````text
You are working in the InvincibleMaintainance repo. This is Phase L2 of docs/ADMIN-PLAN.md §5 Phase L.
It lays the foundations the BOQ quotation (L3) and everything after it stand on: the money and quantity
maths, the units a site team uses, a recipe-based rate library, and one money-wall capability that keeps
cost and margin away from everyone who should not see them.

DECISIONS — DECIDED 2026-09-26, build exactly this
- L-D1 Recipe rates. A rate-library item holds what one unit of work needs: materials with wastage, labour
  man-days by trade, equipment and other costs, an overhead % and a profit %. Quantity × recipe gives the
  material take-off and labour days automatically. The recipe is snapshotted onto the quotation line in L3.
- L-D4 Cost visibility. Only MANAGER and ADMIN see cost and margin, through a new capability. SALES builds
  quotations with sell rates. Approval warns below a minimum margin setting (L4). The surveyor still never
  sees any rate (D1).
- One capability, `costs:read`, for MANAGER; ADMIN has it through '*'. It shows cost, margin, recipe cost,
  trade wages and the job Costing tab. `rates:read` goes to SALES, MANAGER and ACCOUNTANT; `rates:write` to
  MANAGER. SALES loses write access to the rate card, because a recipe carries cost. `jobs:advance-override`
  goes to MANAGER (enforced from L6). SURVEYOR and TECHNICIAN get none of these.
- Job costing is readable today by any `jobs:read` role. It moves behind `costs:read`. DECIDED 2026-09-26:
  ACCOUNTANT does not get costs:read, and GET /admin/reports/job-margin moves behind costs:read too.
- Library price changes never move a public price silently. They mark items "Out of date", and a rate
  changes only through a deliberate reprice: preview, then apply.

READ FIRST
- CLAUDE.md (money rules; the registry; rule 3), MaintainanceFrontend/src/STRUCTURE.md ("The admin kit",
  "The resource registry"), docs/ADMIN-PLAN.md §4 (D1, L-D1…L-D4) and §5 Phase L (L2), docs/API.md
  "Admin — CRM" (rate card) and "Admin — Operations" (costing), docs/ARCHITECTURE.md
- Backend: src/utils/money.js, src/services/survey.service.js (effectiveQty ~358, priceSurvey),
  src/shared/enums.js (UNITS ~63), src/shared/permissions.js, src/routes/admin/crm.routes.js (the rate card
  is hand-written at ~125–155), src/routes/admin/mountResource.js (it passes `{ role }` to list and get),
  src/routes/admin/historyRoute.js, src/services/history.service.js (recordHistory),
  src/services/crud.service.js (makeCrud), src/services/technician.service.js (withRateFor: today's
  cost-hiding pattern), src/utils/moneyWall.js (L0: isMoneyKey and fieldSafe, the field wall on /tech),
  src/services/job.service.js (jobCosting ~559), src/routes/admin/ops.routes.js (costing ~47),
  src/services/report.service.js (jobMarginReport), src/services/material.service.js,
  prisma/schema.prisma (RateCardItem, Material), prisma/seed-data.js (settings, rate card, materials),
  src/shared/schemas/crm.js (rateCardItemSchema ~197)
- Tests: tests/money.test.js, tests/moneyWall.test.js (L0), tests/permissions.test.js,
  tests/schemas.test.js, tests/api/15-operations-admin.test.js, tests/api/06-tech.test.js (the L0 key-scan,
  `moneyKeys`), tests/api/helpers.js
- Frontend: src/config/admin/resources/rateCard.jsx, materials.jsx, src/config/admin/resourceRegistry.js,
  adminNav.js, src/components/common/ResourceForm/* (fields/, FieldRenderer.jsx),
  src/pages/admin/JobDetailPage/sections/JobCostingTab.jsx, src/helpers/permissions.js,
  src/helpers/capabilityMatrix.js, src/config/constants.js (UNITS ~219), src/config/crmMirror.test.js,
  src/form/schemas/rateCard.schema.js

RULES
- Money is integer paisa, and only src/utils/money.js does arithmetic on it. Quantity maths (measurements,
  wastage, packs, take-off) lives only in the new src/utils/quantity.js. Neither file imports the other's
  job: a quantity is never rounded as money, and money is never rounded as a quantity.
- The money wall: cost keys leave the server only for `costs:read`. Strip them in services with one
  helper, and mask them in audit history too. The client never sends a cost. The server derives every
  cost from the library.
- D1 is unchanged: nothing under /tech carries a rate, and the L0 key-scan must still pass.
- Kit only. The rate library is a registry entry. The recipe editor is a ResourceForm field type, not a
  hand-rolled form.
- Keep enum migrations separate from any data migration that uses the new values.
- Tests first for backend changes. Post the plan first: the function signatures in money.js and
  quantity.js, the cost-key list, migrations, endpoints and every settings default.
- Update the docs in the same change.

TASKS

L2.1 · money.js and quantity.js, with unit tests first
- money.js gains:
  · allocate(total, weights): largest remainder; the parts always sum to total.
  · recipeCost(recipe, prices): the per-unit cost breakdown (material, labour, equipment, other,
    overhead, unitCost) ÷ recipeQty.
  · sellRate(unitCost, { profitPct, roundTo }): rounds up to roundTo and never eats the margin.
  · margin(sell, cost): { amount, pct }. It returns null when the cost is unknown.
  · boqTotals(rows, opts): wraps the existing documentTotals. SECTION, NOTE and optional rows are
    excluded, and section subtotals are returned.
  · paymentSchedule(totals, stages): stage amounts from basis points, VAT per stage. The last stage
    absorbs the remainder, so the stages sum to the quotation total exactly.
  · finalBillTotals(lines, earlierBills, opts): earlier bills are deducted, and VAT reconciles to the
    paisa.
  · rs (signed rounding, for negative variation lines) and proRata(amount, part, whole).
- New src/utils/quantity.js: measurementQty(rows), for rows { area, description, nos, l, b, h, deduct }
  where deduct rows subtract; effectiveQty, moved here from survey.service.js ~358 with its 3 dp
  rounding; packs(qty, packSize) (round up); takeOff(recipe, qty). No money in this file.
- tests/money.test.js gains a property test: 1,000 random schedules where the stages sum to the quotation
  total, and advance + running + final equals the contract, to the paisa. Add a new
  tests/quantity.test.js.

L2.2 · Units, packs and trades
- UNITS (enums.js, mirrored in config/constants.js) add sq.m, cu.ft, cu.m, m, rmt, box, tin, trip and
  point.
- Material gains packSize and packLabel (for example 50 and "bag"). The materials registry shows both.
- New model Trade (code @unique, name, dayWage in paisa, sortOrder, isActive, deletedAt). Mount it with
  mountResource at /admin/trades: rates:read to list, rates:write to change. dayWage is stripped without
  costs:read. Add a registry entry config/admin/resources/trades.jsx, registered in resourceRegistry.js,
  with a nav item in adminNav.js.

L2.3 · Capabilities and the money wall
- permissions.js adds costs:read, rates:read, rates:write and jobs:advance-override, mirrored in
  helpers/permissions.js (crmMirror.test.js enforces the mirror). The Roles & permissions matrix shows them.
- src/utils/moneyWall.js already holds L0's field wall (isMoneyKey and fieldSafe on /tech, which removes
  every price). Add the staff cost wall next to it: stripCosts(obj, ctx). It is recursive, is driven by one
  exported list of cost keys (cost, unitCost, costAmount, margin, marginPct, dayWage, the recipe's cost
  parts…) that is narrower than the field rule because staff see sell rates, and is a no-op when
  can(ctx.role, 'costs:read'). ctx is `{ role }`, as mountResource already passes it. Apply it in the
  services that return rate-library items, trades and job costing (and quotation lines in L3). Do not
  strip Material.purchaseRate from the materials registry DISPATCHER maintains; raise it in your plan if
  you disagree.
- history.service.js#recordHistory takes the caller's ctx (historyRoute.js passes `{ role }`) and masks
  the same keys in before, after and changes, so an audit snapshot never leaks a cost.
- GET /admin/jobs/:id/costing moves to costs:read, so SALES, DISPATCHER and ACCOUNTANT get 403. Hide
  JobCostingTab without costs:read. GET /admin/reports/job-margin (reports:ops) also shows cost and
  margin: propose in your plan whether it goes behind costs:read too.
- jobCosting (job.service.js ~559) replaces its own Math.round calls with money.js functions.

L2.4 · The rate library (backend)
- RateCardItem gains rateMode DERIVED|MANUAL, recipeQty (Float, default 1; DoR norms are "per 10 sq.m"),
  overheadPct, profitPct, roundTo, a cached unitCost, and whatever marks it out of date (a stored
  derivedRate, or a computed flag; choose one).
- New model RateCardComponent (rateCardItemId, kind MATERIAL|LABOUR|EQUIPMENT|OTHER, materialId?,
  tradeId?, description?, qty, wastagePct, rate for equipment and other, sortOrder).
- New src/services/rateLibrary.service.js. Saving a recipe derives unitCost (recipeCost) and, for
  DERIVED, the rate (sellRate). MANUAL keeps the typed rate and still caches unitCost for margins. A
  change to Material.purchaseRate or Trade.dayWage never changes a rate; it marks the affected items "Out
  of date".
- The rate card moves off the hand-written routes in crm.routes.js (~125–155) onto mountResource at the
  same path, /admin/rate-card: list, get, create, update, toggle, reorder, delete, restore and history.
  Reads need rates:read and writes rates:write. Soft delete is unchanged, and `?hard=true` still needs
  cms:purge.
- POST /admin/rate-card/reprice { ids?, apply } (rates:write): with apply false it returns a preview (old
  rate, derived rate, delta) and writes nothing. With apply true it writes and records `rate_card.repriced`.
- A cost preview for the editor, for example POST /admin/rate-card/derive (costs:read), so the live card
  uses the one server implementation. Propose the shape.

L2.5 · The rate library (screen)
- Rename rateCard.jsx to "Rate library" in the UI. It stays one registry entry rendered by
  ResourceListPage / ResourceEditPage.
- A new ResourceForm field type `recipe`: materials with wastage · labour trade-days · equipment · other
  · overhead % / profit %. Build it on the existing kit now; L3 moves it onto EditableGrid.
- A live cost-vs-rate card (field-level `capability: 'costs:read'`), an "Out of date" badge column, and a
  bulk action "Update to derived rate" that runs reprice as preview, then confirm, then apply.
- SALES sees the library read-only, with recipe quantities and no cost.

L2.6 · Settings and seed
- Settings in prisma/seed-data.js, with labels and hints: quotation.minMarginPct 15,
  quotation.defaultOverheadPct 10, quotation.defaultProfitPct 10, quotation.sellRateRoundTo (paisa;
  propose a default), quotation.defaultContractType (LUMP_SUM unless I say otherwise),
  quotation.defaultPaymentSchedule (json, 50/40/10 as basis points with labels and triggers),
  job.advanceGate true, finance.advanceDueDays 7.
- Seed DoR-style recipes on PLASTER-INT, PAINT-INT, TILE-FLOOR and SEEP-CHEM, with Kathmandu trade wages
  (mason, helper, painter, tile fitter, waterproofing applicator; say where each figure comes from in a
  comment) and pack sizes (cement bag, paint tin, tile box). Recipe quantities are in each material's own
  unit, because unit conversion is deferred. Leave one seeded item out of date so the badge shows.

TESTS
- New tests/api/17-rate-library.test.js, written first:
  · The plaster recipe's derived rate equals a hand calculation to the paisa; write the calculation in a
    comment.
  · Raising the cement purchase rate marks the item out of date and leaves its rate unchanged.
  · reprice with apply false writes nothing; apply true writes and records the event.
  · As SALES, the rate-card list, get and history, and the trades list, contain no cost keys. SALES POST
    /admin/rate-card → 403.
  · GET /admin/jobs/:id/costing → 403 for SALES and 200 for MANAGER.
- Move L0's key scanner (`moneyKeys` in 06-tech.test.js) into tests/api/helpers.js as
  `findKeys(value, isKey)`, so 06-tech, 17, 18, 02-public and 21 all use it. Use the cost-key list for
  staff and isMoneyKey for /tech.
- Unit: tests/money.test.js (every new function, plus the property test), tests/quantity.test.js,
  tests/moneyWall.test.js (extend L0's with stripCosts per role), and tests/permissions.test.js for the new
  capabilities per role.
- The L0 /tech key-scan still passes.
- vitest: the recipe field, the cost card hidden for SALES, the out-of-date badge and bulk action, and
  crmMirror for UNITS and permissions.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npx eslint src tests
  cd MaintainanceFrontend && npm test && npm run lint && npm run build && npm run test:e2e
Manual: as manager@gharjatan.com.np, open the plaster item and check its cost breakdown by hand. Raise the
cement price in Materials, then see "Out of date", preview, and apply. As sales@gharjatan.com.np, the same
item shows quantities and no cost, and a job's Costing tab is gone.

ACCEPTANCE (ADMIN-PLAN §5 Phase L · L2)
A plaster recipe's derived rate equals a hand calculation to the paisa; raising cement price flags the
item without changing its rate; SALES responses contain no cost keys; costing is 403 for SALES.

GIT
- Work on a local branch `admin/phase-l2-rate-library` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase L1's work is present on `prabesh` (its files and migrations
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
- docs/API.md: the rate card's mountResource surface, its new capabilities and the recipe contract;
  reprice and derive; /admin/trades; costing behind costs:read; the new settings.
- docs/ARCHITECTURE.md: extend the "Money wall (D1)" note L0 added with the office wall (costs:read,
  stripCosts, history masking), and describe the split
  between money.js and quantity.js under "Cross-cutting services".
- MaintainanceBackend/README.md: the roles table and permission notes (SALES loses rate-card write), and
  the money paragraph (quantity.js).
- CLAUDE.md "Backend" paragraph: quantity maths lives only in utils/quantity.js, and cost leaves the server
  only for costs:read. Call it out in the report.
- STRUCTURE.md: the `recipe` field type and the Rate library and Trades registry entries.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
The function signatures added, the cost-key list, migrations, endpoints, the capability table per role,
settings and defaults, the plaster hand calculation, test counts (including the property test), the manual
results and follow-ups. Do not start Phase L3.
````
