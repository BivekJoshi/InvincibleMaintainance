# Phase prompts

One prompt per phase of `docs/ADMIN-PLAN.md`. Paste a prompt's fenced block into a **fresh**
Claude Code session opened at the repository root. Each prompt is self-contained: it tells the
session what to read, what to build, how to verify it and what to report.

## Order

```
A  Safety fixes, CI, doc housekeeping
B  Logging & audit backbone
C1 Admin UI kit — primitives
C2 Admin UI kit — registry, shell, FAQs
D1 Services, rate card, media, home page
D2 Projects, remaining content, blog, settings
E  Leads & CRM (safe customer matching, preferred language)
F1 Quotation approval & customer response — backend
F2 Quotation screens + first end-to-end test
G  Audit, logs & platform screens
H1 Operations — back office
H2 Operations — field app
I  Finance & aftercare screens
J1 Nepali UI (field app, site, customer pages)
J2 Reliability & PDFs
J3 Security, backups & deploy        → production launch

K  Optional customer accounts (email signup)   after launch
```

Finish a phase's acceptance criteria before starting the next (CLAUDE.md rule 1).

## Branches

All phase work starts from **`prabesh`** (created from `DEVELOPMENT`; it already carries this plan and
these prompts). Each session creates its `admin/phase-…` branch from `prabesh`; you merge each phase
branch back into `prabesh`, and `prabesh` into `DEVELOPMENT` whenever you choose.

## Before Phase A — one-time, by hand

The API suite needs a database whose name ends in `_test`. Its prepare step wraps
`prisma migrate reset`, which Prisma refuses to run from an AI agent, so do this yourself:

```bash
sudo -u postgres psql -c "CREATE DATABASE maintainance_test OWNER maintainance;"
cd MaintainanceBackend && npm run test:api:prepare
```

Re-run `npm run test:api:prepare` whenever a phase adds a migration and the prompt asks for a clean slate.

## Decisions (recorded 2026-09-14)

All open decisions are answered and written into the prompts and `docs/ADMIN-PLAN.md` §4:

- **Pricing** — the office prices; the engineer reports quantities only.
- **Approval** — new MANAGER role + ADMIN approve; no self-approval; auto-approve below an amount
  (off until set, applies to revisions too); every revision is approved again.
- **On acceptance** — lead → WON, job created, notify customer (SMS + email), salesperson +
  quotation creator, all dispatchers, approving manager.
- **Customer side** — no OTP / login on the link: Accept · Ask for changes · Decline.
- **Accounts are optional** — guests book and get the service with contact details only. After
  launch (Phase K) a customer may sign up with their email and, once verified, see all earlier
  history under that email. Phase E starts capturing an optional, normalised email so this works.
- **Leads** — everyone sees all leads; "My leads" is the default view.
- **Nepali UI** — field app, public site + booking, customer document pages. Admin stays English.
- **Customer messages** — SMS and email go in the customer's preferred language, captured at booking (Phase E).
- **Safe matching** — a matching phone never attaches an email to someone else's record; staff confirm it,
  and accounts link by email only, never by phone (Phases E and K).
- **Code structure** — inline route handler = controller; Prisma out of routes (Phase A amends CLAUDE.md).

Change a decision by editing ADMIN-PLAN §4 **and** the prompt that uses it before running that phase.

## How each session works

Every prompt asks the session to:

1. Check that the previous phase's work is present, and **stop if it is not**.
2. Read the listed files and post a short plan (files to touch, migrations, open questions) **before** editing.
3. Work on a local branch created from `prabesh` and **ask your permission before every commit** — showing the changed files
   and the proposed message; nothing is committed without your yes.
4. Write the failing test first for every backend behaviour change.
5. Run the phase's verification commands.
6. **Update the docs** together with the code (same commit) — every prompt has a `DOCS` block: the
   always-updated set (ADMIN-PLAN progress + deviations, STATUS, API, DATA-MODEL, READMEs,
   .env.example, STRUCTURE, CLAUDE.md when a convention changes) plus that phase's specific docs.
7. End with a report: what changed, test results with counts, each doc "updated" or "no change
   needed — reason", anything skipped and why, follow-ups.
8. Stop — never push, open a pull request, merge, or start the next phase.

**Between phases (you):** review the work, merge the phase branch into `prabesh` (and `prabesh` into `DEVELOPMENT` when you choose), then
paste the next prompt into a fresh session. CI (added in Phase A) runs lint, unit and API tests when
you push; C1 adds frontend tests and F2 the end-to-end test.

## Keeping docs honest between phases

`DOCS-SYNC.md` is a docs-only prompt. Run it after any phase (or any ad-hoc change) to reconcile
every document with the code as it actually is — it edits docs only and reports code/doc conflicts
instead of "fixing" code.

Tip: start the larger prompts (C1, D1, D2, F1, H1) in plan mode (`shift+tab`) so you approve the plan before any edit.
