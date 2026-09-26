# Phase L3 — The BOQ builder

~5 days · branch `admin/phase-l3-boq-builder` · requires Phase L2 done · decisions L-D1 and L-D4 in ADMIN-PLAN §4

````text
You are working in the InvincibleMaintainance repo. This is Phase L3 of docs/ADMIN-PLAN.md §5 Phase L.
Today a quotation is a flat list: description · unit · qty · one sell rate. There are no sections, no
material or labour split, no cost or margin, no wastage, no measurements and no optional items.
Estimators build a bill of quantities (BOQ) in Excel instead. This phase makes the quotation builder
that sheet: sections, keyboard-first editing, paste from Excel, measured quantities, rows priced from the
L2 rate library with the recipe frozen on the line, a take-off, and a margin only managers see.

DECISIONS — DECIDED 2026-09-26, build exactly this
- L-D1: the recipe is snapshotted onto the quotation line when the row is inserted. The server builds the
  snapshot, and the client never sends a cost. A library change reaches a draft only through a deliberate
  reprice.
- L-D4: cost and margin reach only `costs:read` (MANAGER, ADMIN). SALES builds with sell rates and sees
  recipe quantities, never cost.
- A BOQ is one ordered list of rows, like the estimator's sheet: `rowType ITEM|SECTION|NOTE`. Numbering
  (A.1, A.2) and section subtotals are computed, never stored. Optional rows are shown but never totalled.
  The discount stays one paisa amount; the UI offers % and "target total" helpers that fill it.
- A measurement sheet is JSON rows `{ area, description, nos, l, b, h, deduct }`. The server derives the
  quantity (quantity.js#measurementQty). The UI accepts feet-inches such as 12'6".
- Spreadsheet editing is one new kit component, components/common/EditableGrid/. Pages reach it only
  through ResourceForm field types (`lineItems` rebuilt on it; new `grid` and `measurements`; `recipe`
  moved onto it), so CLAUDE.md rule 3 still holds.

READ FIRST
- CLAUDE.md (rule 3; money), MaintainanceFrontend/src/STRUCTURE.md ("The admin kit", "Quotations (Phase
  F2)"), docs/ADMIN-PLAN.md §5 Phase F and Phase L (L3), docs/API.md "Admin — CRM" (quotations),
  "Admin — Site surveys"
- Backend: prisma/schema.prisma (Quotation, QuotationItem, SurveyItem, RateCardItem, RateCardComponent),
  src/services/quotation.service.js (buildTotals ~60, getQuotation ~169, createQuotation ~202,
  updateQuotation ~235, reviseQuotation ~429, publicView ~485), src/services/survey.service.js
  (priceSurvey, toQuotationLine ~456, buildQuotationFromSurvey ~477),
  src/services/rateLibrary.service.js (L2), src/services/material.service.js (stockBalances),
  src/utils/money.js and src/utils/quantity.js (L2), src/utils/moneyWall.js (stripCosts, L2),
  src/shared/schemas/crm.js (quotationSchema ~219), src/routes/admin/crm.routes.js (quotations),
  src/routes/admin/surveys.routes.js
- Tests: tests/api/13-quotation-approval.test.js, 04-surveys.test.js, 17-rate-library.test.js,
  tests/api/helpers.js
- Frontend: src/pages/admin/QuotationBuilderPage/ (QuotationBuilderPage.jsx; it loads the rate card with
  `useGetRateCardQuery({ limit: 100 })` at ~92), sections/*, src/pages/admin/QuotationsPage.jsx,
  LeadDetailPage.jsx, CustomerDetailPage/, src/components/common/ResourceForm/fields/LineItemsField.jsx
  (it re-renders every input on each keystroke), FieldRenderer.jsx, src/components/common/CustomTable/
  (TanStack patterns), src/components/surveys/SurveyPricingTable.jsx, src/api/quotationsApi.js,
  src/form/schemas/quotation.schema.js, src/helpers/format.js

RULES
- Money is integer paisa, and only src/utils/money.js does arithmetic on it. Quantity maths goes only
  through src/utils/quantity.js. Request rates stay in the rupee wire format the quotation endpoints
  already use.
- Displayed totals come from the server. The builder's live preview goes through the same
  boq.service.js#buildLines as the save, via a preview endpoint. If you propose a client mirror instead,
  it must pass the same fixtures to the paisa.
- The money wall: quotation responses go through an allowlist, and stripCosts removes cost without
  costs:read. The client never sends unitCost, costAmount or a recipe's cost. The server ignores or
  refuses them; say which in your plan.
- A negative line is refused on a quotation. Negative lines exist only on variations (L7).
- Kit only. EditableGrid is reached only through ResourceForm field types. Every drag has a keyboard
  equivalent.
- Keep enum migrations separate from the backfill that uses the new values.
- Tests first for backend changes. Post the plan first: the row schema, the recipe snapshot's version and
  shape, the migrations and backfill, the endpoints and the keyboard map.
- Update the docs in the same change.

TASKS

L3.1 · EditableGrid (kit)
- components/common/EditableGrid/, on TanStack Table and dnd-kit (both installed). One cell edits at a
  time and commits on Enter or blur.
- Keyboard: arrows, Enter, Tab and Esc; type-to-overwrite; Ctrl+Enter adds a row; Ctrl+Shift+Enter adds a
  section; Ctrl+D duplicates; Alt+↑/↓ moves a row; `/` opens a rate-library search. The search is cmdk
  backed by a server search (GET /admin/rate-card?q=) and replaces the 100-item dropdown.
- Paste TSV from Excel: Indian digit grouping (1,23,456.50) and "Rs" / "Rs." are handled, and text-only
  rows become sections.
- Field types: `lineItems` is rebuilt on EditableGrid, `grid` and `measurements` are new, and L2's `recipe`
  moves onto it. Add a line to STRUCTURE.md and to CLAUDE.md rule 3: EditableGrid is reached only through
  ResourceForm field types.

L3.2 · Schema (one migration per logical change)
- QuotationItem gains rowType (ITEM|SECTION|NOTE), kind (the SurveyItemKind values), materialId,
  measurements Json, netQty, wastagePct, isOptional, isProvisional, spec, recipe Json (versioned and
  zod-checked), unitCost and costAmount.
- The backfill migration sets every existing line to rowType ITEM, sets kind from its rate-card item, and
  leaves cost null, which means "unknown", not zero.

L3.3 · boq.service.js (backend)
- New src/services/boq.service.js#buildLines(rows, ctx). For each row: measurements → qty → wastage → the
  recipe snapshot, built from the library at insert and frozen after → unitCost and costAmount →
  boqTotals. createQuotation, updateQuotation and reviseQuotation all use it. A revision copies the rows,
  measurements and snapshots as they are.
- The staff view is an allowlist. Without costs:read it drops cost (stripCosts), and history is masked
  the same way (L2).
- GET /admin/quotations/:id/takeoff: materials in buying units (bags, boxes, trips, from packSize) with
  stock on hand, and labour days per trade. SALES sees quantities, managers see cost too.
- POST /admin/quotations/:id/reprice: DRAFT only (otherwise 422). It re-snapshots recipes and rates from
  the library, with a preview first, as in L2's reprice.
- POST /admin/quotations/preview: the unsaved rows through buildLines, for the builder's live totals.
  Propose the exact shape.

L3.4 · The builder
- Tabs: BOQ · Take-off · Labour · Payment & terms · Customer view · History. Payment & terms keeps
  today's terms field until L4 fills it. The right rail shows Totals · Margin (costs:read only) · Send ·
  Trail.
- A measurement drawer per row: rows by room, feet-inches input, deductions. A recipe drawer: quantities
  for SALES, cost for managers.
- The Take-off tab is in buying units with stock on hand and shortfall. The Labour tab shows days per
  trade with a crew-size calculator (days ÷ crew = duration).
- Discount helpers: "%" and "target total" fill the paisa discount. The server still computes every
  total.

L3.5 · Survey → quotation, and the New quotation sheet
- toQuotationLine (survey.service.js ~456) keeps kind, materialId, wastagePct, isOptional and the note
  (as spec). Optional survey lines become optional BOQ rows instead of being dropped. Sections come from
  the rate-card category, or the service.
- A New quotation sheet with three options: blank · from survey · copy existing. It opens from
  QuotationsPage, LeadDetailPage and CustomerDetailPage, and replaces L1's minimal sheet.

L3.6 · Seed
Replace one demo quotation with a real BOQ: three sections, measured rows, an optional row and recipe
snapshots, so the builder, take-off and labour tabs have something to show.

TESTS
- New tests/api/18-boq-quotation.test.js, written first:
  · A 3-section BOQ with measured, optional, NOTE and SECTION rows: the saved totals equal the preview to
    the paisa, and optional rows are excluded.
  · The recipe snapshot does not change when the library changes; reprice changes it on a DRAFT, and on
    any other status reprice → 422.
  · Cost sent by the client is ignored or refused. A negative line → 422.
  · As SALES, findKeys finds no cost key in the quotation, takeoff or history. As MANAGER, cost and margin
    are present.
  · Take-off and labour days match the recipes × quantities.
  · A revision copies rows, measurements and snapshots.
  · The backfilled legacy lines read as ITEM rows with unknown cost.
- 04-surveys: building from a survey keeps kind, material, wastage, optional and note, and forms
  sections.
- 13-quotation-approval: the approval loop still passes with BOQ rows.
- vitest: EditableGrid's keyboard map, type-to-overwrite, the paste parser (Indian grouping, "Rs"
  stripped, text rows → sections), the feet-inches parser (12'6" → 12.5), the margin rail hidden for
  SALES, and the builder tabs.
- New e2e/boq-flow.spec.js (L4–L8 extend it): as SALES, build a 3-section BOQ by keyboard, paste 15 rows
  from a TSV fixture, add a library row with `/`, a measured line and an optional row, then submit. As
  MANAGER, approve and see the margin, then send.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npx eslint src tests
  cd MaintainanceFrontend && npm test && npm run lint && npm run build && npm run test:e2e
Manual: as sales@gharjatan.com.np, build a 40-row BOQ without the mouse, paste rows from a real
spreadsheet, and open the take-off. As manager@gharjatan.com.np, check the margin rail. Revise a sent
quotation and compare the rows.

ACCEPTANCE (ADMIN-PLAN §5 Phase L · L3)
A 3-section, 40-row BOQ built by keyboard with 15 rows pasted from Excel, a library search, a measured
line and an optional row; server totals equal the preview to the paisa; margin visible only to MANAGER;
take-off and labour match the recipes; a revision copies rows, measurements and snapshots.

GIT
- Work on a local branch `admin/phase-l3-boq-builder` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase L2's work is present on `prabesh` (its files and migrations
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
- docs/API.md: the quotation row contract (rowType, kind, measurements, flags, the recipe snapshot), which
  cost fields each capability sees, takeoff, reprice, preview, and survey → quotation carrying
  kind/material/wastage/optional.
- CLAUDE.md rule 3: one line saying EditableGrid is reached only through ResourceForm field types. Call it
  out in the report.
- STRUCTURE.md: EditableGrid (keyboard map, paste rules), the `lineItems` / `grid` / `measurements` /
  `recipe` field types, the builder tabs and the New quotation sheet.
- docs/ARCHITECTURE.md: the money-wall note gains quotation lines.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
The row schema and snapshot version, migrations and backfill counts, endpoints, the keyboard map as
built, test counts, the e2e result, the manual results and follow-ups. Do not start Phase L4.
````
