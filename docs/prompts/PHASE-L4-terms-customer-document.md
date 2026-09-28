# Phase L4 — Terms & the customer document

~3–4 days · branch `admin/phase-l4-terms-document` · requires Phase L3 done · decisions L-D2, L-D3 and L-D4 in ADMIN-PLAN §4

````text
You are working in the InvincibleMaintainance repo. This is Phase L4 of docs/ADMIN-PLAN.md §5 Phase L.
L3 made the quotation a real BOQ. This phase adds what a contract needs around it: the contract type, a
payment schedule, the duration, exclusions, and terms from a library. It also puts a margin gate on
approval, and makes the customer's document read like a professional quotation, on the link page, in
print and as an Excel file that recalculates.

DECISIONS — DECIDED 2026-09-26, build exactly this
- L-D2 Final bill: chosen per quotation. `LUMP_SUM` is the quote ± customer-approved variations.
  `ITEM_RATE` is billed at measured qty × quoted rate, after the engineer measures the finished work. L8
  bills it; this phase records the choice and says it plainly to the customer.
- L-D3 Advance: the quotation carries a payment schedule, defaulted from `quotation.defaultPaymentSchedule`
  (50 · 40 · 10). The advance invoice and the scheduling gate come in L6. This phase stores and shows the
  stages.
- L-D4: approval warns below `quotation.minMarginPct`, and cost stays with `costs:read`. The customer's
  view, the print and the customer's Excel file never carry a cost key.
- Stages are basis points summing to 10000, with trigger ON_ACCEPT | MILESTONE | ON_COMPLETION. The
  amounts come from money.js#paymentSchedule: VAT is applied per stage, and the last stage absorbs the
  remainder, so the stages sum to the quotation total exactly.

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md ("Quotations (Phase F2)"), docs/ADMIN-PLAN.md §4
  (D2, D4, D7) and §5 Phase L (L4), docs/API.md "Admin — CRM" (quotations) and "Public"
- Backend: prisma/schema.prisma (Quotation), src/services/quotation.service.js (submitQuotation ~276,
  approveQuotation ~323, reviseQuotation ~429, publicView ~485, getByPublicToken ~520,
  declineQuotation ~737), src/services/boq.service.js (L3), src/utils/money.js (paymentSchedule, boqTotals),
  src/utils/nepaliDate.js (formatBs), src/shared/enums.js (QUOTATION_DECISIONS, AUDIT_EVENTS),
  src/shared/schemas/crm.js (quotationSchema ~219, quotationApproveSchema ~250,
  quotationDecisionSchema ~264), src/routes/public.routes.js (~61–64), src/routes/admin/crm.routes.js,
  src/routes/admin/mountResource.js, src/services/settings.service.js, prisma/seed-data.js
  (finance.quotationTerms ~53, finance.panVatNo, contact.*, branding.logoId)
- Tests: tests/api/02-public.test.js, 13-quotation-approval.test.js, 18-boq-quotation.test.js,
  tests/api/helpers.js (findKeys, from L2)
- Frontend: src/pages/public/QuotationPublicPage/ (QuotationPublicPage.jsx, quotationPageCopy.js,
  quotationPageState.js, sections/QuotationDecision.jsx, the tests), src/components/documents/*
  (DocumentShell, DocumentHeader, LineItemsTable, TotalsList), src/pages/admin/QuotationBuilderPage/
  sections/SendPanel.jsx, src/pages/admin/QuotationsPage.jsx, src/routes/AppRoutes.jsx,
  src/helpers/format.js, src/components/common/LocaleTabs.jsx

RULES
- Money is integer paisa, and only src/utils/money.js does arithmetic on it: stage amounts, amount in
  words and section subtotals all come from the server. The SPA never recomputes VAT or totals.
- The public view stays an allowlist (publicView). A key-scan test proves it carries no cost key. Sell
  rates and totals are allowed there; cost, margin, recipe and wages are not.
- Customer-facing words live in en and ne (quotationPageCopy.js), ready for J1. Every public screen works
  at 360 px.
- BS dates are display-only. The API supplies them from utils/nepaliDate.js; do not reimplement the
  conversion in the SPA.
- Kit only: the terms library is a registry entry, and the payment schedule is a ResourceForm field type
  on EditableGrid.
- Tests first for backend changes. Post the plan first: migrations, the terms model, the LOW_MARGIN rule,
  the public view additions and the xlsx layout.
- Update the docs in the same change. exceljs is a new backend dependency; record it.

TASKS

L4.1 · Contract and payment (schema + builder)
- Quotation gains contractType (LUMP_SUM | ITEM_RATE, defaulted from quotation.defaultContractType),
  estimatedDays, exclusions, firstViewedAt, viewCount, and a decline category. New model
  QuotationPaymentStage (quotationId, label, bp, trigger, sortOrder); stages are copied on revise.
- Server validation: the stages' bp sum to 10000, and at most one stage is ON_ACCEPT.
- The builder's "Payment & terms" tab:
  · the contract type, with the plain sentence each one means;
  · a `paymentSchedule` field type (EditableGrid) with the presets 50/40/10, 40/30/20/10 and "100 on
    completion", which must total 100 %, and the stage amounts the server returns;
  · the duration, the exclusions, and a terms picker.

L4.2 · Terms library
- A new registry resource (name the model in your plan, for example QuotationTerms: title, body in en/ne
  through LocaleTabs, sortOrder, isActive), mounted with mountResource and managed with rates:write or
  quotations:write (propose which).
- finance.quotationTerms seeds its default row and is finally used: every new quotation starts with the
  default terms.

L4.3 · Margin gate on approval
- approveQuotation, and the auto-approve inside submitQuotation: when the margin is below
  quotation.minMarginPct, or any row's cost is unknown, answer 422 `LOW_MARGIN`. The approver can resend
  with `acknowledgeLowMargin: true`, which is recorded in the quotation.office_approved event's meta.
- Auto-approval never fires on low margin: the quotation goes to PENDING_APPROVAL instead.
- The Needs-approval queue (QuotationsPage) gains a margin column (costs:read only). The approve dialog
  shows the margin and asks for the acknowledgement when it is needed.

L4.4 · The customer's page (QuotationPublicPage)
- Show sections with subtotals, or a section summary; a measurements annex; optional rows marked "not
  included"; the payment schedule with amounts; the contract wording; the duration; and the total in words
  (lakh/crore, en and ne), from one tested helper.
- Decline offers reason chips that map onto L1's LOST categories. quotationDecisionSchema gains the
  category, and L1's "Mark lost?" prompt pre-fills it.
- GET /public/quotations/:token stamps firstViewedAt and increments viewCount. SendPanel shows "Opened 2×"
  and the first-viewed time, and gains WhatsApp and Viber share buttons that carry the public link.

L4.5 · Print and Excel
- A print route /admin/quotations/:id/print, rendered with components/documents/*: the letterhead from the
  contact.* and branding settings, finance.panVatNo, and BS + AD dates. J2's PDFs will render this same
  route.
- GET /admin/quotations/:id/export.xlsx (quotations:read), built with exceljs:
  · a BOQ sheet with live formulas (qty × rate, section subtotals, discount, VAT, total);
  · a measurements sheet and the payment schedule;
  · a cost sheet only for costs:read.
  Every formula cell also stores its computed result. Audit the export the way Phase B audits export.csv.

L4.6 · Seed
The demo BOQ quotation gains a 50/40/10 schedule, contract type and duration, exclusions, and terms from
the library. One more demo quotation is priced below the minimum margin, to show the gate.

TESTS
- 13-quotation-approval: a low-margin approve → 422 LOW_MARGIN, and with the acknowledgement it succeeds
  and records it in the event. Unknown cost is treated the same way. Low margin never auto-approves.
- 18-boq-quotation: stage bp must sum to 10000; the stage amounts sum to the quotation total to the paisa;
  stages are copied on revise.
- The export: as SALES, the workbook has no cost sheet; as MANAGER it has one. Each formula cell's stored
  result equals the server totals. Say in your plan how you prove the formulas recalculate to the same
  totals, for example LibreOffice headless where it is available.
- 02-public: findKeys finds no /cost|unitCost|costAmount|margin|recipe|purchaseRate|hourlyRate|dayWage/i
  in the public view; viewCount increments; the decline category is stored.
- vitest: the public page in en and ne at 360 px, including optional rows, the schedule and the words; the
  words helper (1,23,45,678.90); the paymentSchedule field must total 100 %; "Opened 2×".
- e2e/boq-flow.spec.js gains: open the link as the customer, see "Opened", and accept.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npx eslint src tests
  cd MaintainanceFrontend && npm test && npm run lint && npm run build && npm run test:e2e
Manual: open the seeded BOQ link on a 360 px viewport in English and in Nepali. Print it and compare the
totals with the page. Open the .xlsx in a spreadsheet app, change a quantity and watch the totals follow.
Download it as sales@gharjatan.com.np and confirm there is no cost sheet. Approve the low-margin demo as
manager@gharjatan.com.np.

ACCEPTANCE (ADMIN-PLAN §5 Phase L · L4)
Public page works en/ne at 360 px; print totals equal the page; the .xlsx formulas recompute to the same
totals; SALES's export has no cost sheet; a low-margin quote needs the acknowledgement.

GIT
- Work on a local branch `admin/phase-l4-terms-document` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase L3's work is present on `prabesh` (its files and migrations
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
- docs/API.md: the contract fields and payment stages, the terms resource, LOW_MARGIN and
  acknowledgeLowMargin, the public view additions (sections, schedule, words, view tracking), the decline
  category, export.xlsx.
- MaintainanceBackend/README.md: the exceljs dependency; the new seeded demo quotations.
- STRUCTURE.md: the `paymentSchedule` field type, the print route, and the public page's sections and copy.
- docs/ARCHITECTURE.md: the public view is an allowlist with a cost key-scan test.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Migrations, endpoints, the LOW_MARGIN rule as built, the public view's new keys, the xlsx layout and how
the formula check was done, test counts, the manual results (viewport and languages) and follow-ups. Do
not start Phase H2; H2 runs next, then L5.
````
