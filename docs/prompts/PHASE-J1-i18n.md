# Phase J1 — UI internationalisation (en / ne)

~2 days · branch `admin/phase-j1-i18n` · requires Phases C–I

````text
You are working in the InvincibleMaintainance repo. This is Phase J (part 1 of 3) of
docs/ADMIN-PLAN.md. CLAUDE.md requires English + Nepali from day one, but today only CONTENT is
bilingual (?locale= on public queries, Translation table). Every UI string — buttons, labels,
errors, the whole field app — is hardcoded English. Technicians in Kathmandu need the field app in
Nepali; that is mandatory. The public site, booking and the customer document pages are next.
The admin panel stays English (decided 2026-09-14).

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md, docs/ADMIN-PLAN.md §5 Phase J
- src/config/locale.js, src/redux/slices/uiSlice.js (locale state), src/components/common/LocaleSwitch.jsx,
  src/api/publicApi.js (which queries pass locale — gallery, faqs, availability do not)
- src/pages/tech/*, src/components/layout/TechLayout.jsx, SiteHeader/*, SiteFooter.jsx,
  src/config/site/*.js, src/form/schemas/*.js (validation messages), src/helpers/format.js
- MaintainanceBackend/src/middleware/error.js and a few services' AppError messages (API messages
  shown to users), notify templates (already en/ne)

DECISIONS FOR THIS PHASE (state them in the plan; defaults)
- Library: a small in-house `t()` over plain JS catalogues (src/config/i18n/en.js, ne.js) with
  interpolation and plural support, unless you show in the plan that i18next/react-i18next is
  clearly worth its bundle cost here. Marketing bundle size matters.
- Scope — DECIDED 2026-09-14: the engineer/technician field app, the public website + booking, and
  the customer quotation / invoice / warranty pages. The admin panel stays English — do not
  translate admin screens. Phase K's customer account will use t() from day one.
- Order: field app → public site + booking → customer document pages → validation messages.
- Customer SMS/email already follow Lead/Customer preferredLocale (Phase E). Make sure the locale the
  booking and lead forms send is the one the visitor chose in LocaleSwitch.
- API error messages: the API returns stable error `code`s; the UI maps codes to catalogue strings
  and falls back to the server message.

TASKS
J1.1 · i18n core: catalogues, `useT()` hook reading locale from uiSlice, `<Trans>`-like helper for
       embedded links if needed, missing-key warning in dev only, a key-parity test (every en key
       exists in ne and vice versa).
J1.2 · Field app fully translated (Nepali reviewed for plain, field-friendly wording; keep
       technical units as-is), locale switch in TechLayout, persisted.
J1.3 · Public chrome: header, mega panel, drawer, footer, booking wizard, contact/lead forms,
       estimator, document pages (quotation/invoice/warranty), NotFound. Pass ?locale= on the
       public queries that miss it. Add <html lang> updates and hreflang/canonical per useSeo if
       routes support locale.
J1.4 · zod messages: shared message keys in form/schemas/fields.js resolved through t().
J1.5 · Customer document pages: every string on the quotation (incl. the Phase F Accept /
       Ask for changes / Decline flow and its content object), invoice and warranty pages.
J1.6 · Formatting: numbers with Nepali grouping, optional Devanagari digits for ne display only
       (never in inputs sent to the API), dates in Kathmandu with BS option — all in helpers/format.js.
J1.7 · Font: Noto Sans Devanagari subset loaded only when ne is active (no layout shift).

TESTS (vitest)
Key parity; interpolation/plural; format helpers for ne (grouping, Devanagari digits, BS date);
tech page renders in ne without missing-key warnings; zod error in ne.

VERIFY
  cd MaintainanceFrontend && npm test && npm run lint && npm run build (report bundle size delta
  for the public entry chunk)
Manual: switch to नेपाली on a 360px viewport and run the technician flow and an online booking;
screenshots or a description of any overflow/truncation fixed.

ACCEPTANCE
Field app, public site + booking and customer document pages 100% Nepali-capable; validation
messages bilingual; admin untouched; no key missing in either catalogue; public bundle growth justified.

GIT
- Work on a local branch `admin/phase-j1-i18n` created from `prabesh`.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase I's work is present on `prabesh` (its files and migrations
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
- STRUCTURE.md: new i18n section — catalogue location, useT, adding a key, parity test, formatting.
- CLAUDE.md: the UI-string convention (all user-visible strings via t()).
- MaintainanceFrontend/README.md: Nepali font loading and how to test ne.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Library decision, catalogue size, coverage per area, bundle delta, test counts, follow-ups.
````
