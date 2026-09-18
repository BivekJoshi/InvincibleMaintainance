# CLAUDE.md — Maintenance System

Working context for Claude Code. Read this first, then `docs/ADMIN-PLAN.md` — the current build
order. `docs/PLAN.md` is the historical v1 blueprint.

## What we are building

A complete **home maintenance & construction services platform** for a single Nepal-based
company: a content-driven public marketing site (a better rebuild of `homeplexnepal.com`)
plus a full back-office — lead CRM with a 2-hour SLA, quotations, work orders, technician
dispatch, materials, invoicing, warranty and AMC contracts.

Reference study of the site being replaced: `homeplexdynamicsystemfindings.md`.
This is **not** a clone. The marketing page is one deliverable out of nine modules.

## Decisions already made — do not re-open

| Decision | Value |
|---|---|
| Front end | Vite + React 18 + **shadcn/ui + Tailwind** (JSX, not TSX) + **Redux Toolkit / RTK Query** + **Framer Motion** + react-hook-form |
| API | Node 20 + Express + Prisma + PostgreSQL 16 |
| Tenancy | **Single company.** No `tenantId` columns. |
| Ops depth | Full: leads → quotations → jobs → materials → invoices → warranty → AMC |
| Auth | JWT access (15m) + httpOnly refresh cookie (30d), RBAC by role |
| Roles | ADMIN, EDITOR, SALES, **MANAGER** (SALES + `quotations:approve`), DISPATCHER, TECHNICIAN, SURVEYOR, ACCOUNTANT |
| Quotation approval | **No quotation is sent without internal approval** — MANAGER/ADMIN, never your own (`quotation.makerChecker`), or auto below `quotation.autoApproveBelow`. Every revision is approved again. The customer answers Accept · Ask for changes · Decline with no login; Accept creates the job. |
| Language | English + Nepali (`en` / `ne`), UTF-8 everywhere, day one |
| Money | Integer **paisa** (NPR × 100). Never floats. |
| Dates | UTC in DB; display in Asia/Kathmandu (+05:45). BS dates display-only. |
| IDs | `cuid()` primary keys |

## Repo layout

```
MaintainanceBackend/    Express + Prisma + PostgreSQL      :4000
MaintainanceFrontend/   Vite + React + shadcn + RTK        :5400
docs/                   PLAN.md, ARCHITECTURE.md, DATA-MODEL.prisma, API.md
```

The frontend serves both the public marketing site and the back office from one Vite app,
split by route group: `(site)` public, `(admin)` staff, `(tech)` technician PWA.

## Conventions

**Everywhere**
- JavaScript + JSX. No TypeScript. JSDoc for non-obvious signatures.
- Named exports. Default export only for React components.
- 2-space indent, single quotes, no semicolon-free style — match Prettier config.
- Validation lives once, as zod schemas in `MaintainanceBackend/src/shared/schemas/`, mirrored for the
  SPA in `MaintainanceFrontend/src/form/schemas/`.

**API (`MaintainanceBackend`)**
- Layering: `routes/ → services/ → prisma`. The thin inline `asyncHandler` in a route file **is**
  the controller (decision D5, 2026-09-14): it takes the validated request, calls a service and
  shapes the response. Route files never call Prisma directly; business logic stays in services.
  Raw Prisma calls still in some routers move into services when each router is next touched.
  *Progress (Phase H1, 2026-09-17):* prisma-free — `platform`, `cms`, `crm`, `ops` (technicians moved to
  `services/technician.service.js`), `finance`, `aftercare`, `surveys`, `auth`, `public`. Still calling
  Prisma — `tech.routes.js` (sync), for Phase H2. A record's history route is `routes/admin/historyRoute.js`;
  every registry resource (content, materials, job templates, technicians) is mounted by
  `routes/admin/mountResource.js`.
- Every route: `validate(schema)` → `authenticate` → `authorize(...roles)` → controller.
- Errors: `throw new AppError(status, code, message)`. One error middleware serializes them.
- Responses: `{ data, meta }` on success, `{ error: { code, message, details } }` on failure.
- Lists are always paginated: `?page=1&limit=20&sort=-createdAt&q=`.
- Never delete content rows — soft delete via `deletedAt`.

**Front end (`MaintainanceFrontend`)** — full map in `MaintainanceFrontend/src/STRUCTURE.md`.
- Organised by **layer**, not by feature: `api/ components/ three/ pages/ routes/
  providers/ redux/ form/ hooks/ config/ helpers/ styles/`. A file's folder says what
  kind of thing it is; its name says which domain it serves.
- Server state = **RTK Query** (`src/api/`), one API slice that every domain file
  injects into, with tag-based invalidation. UI state = **Redux Toolkit slices**
  (`src/redux/slices/`). No react-query, no Context for server data.
- `src/api/apiCore.js` exports core pieces only — import domain endpoints directly, or
  the back office lands in the marketing bundle.
- **No file is named `index`.** Every module is named for what it holds; a folder's
  entry file repeats the folder name (`HomePage/HomePage.jsx`). Import the file, not
  the folder — `@/redux/store`, never `@/redux`.
- Animation lives in `src/three/`: `motion/motionKit.jsx` for Framer Motion primitives,
  `scenes/` for WebGL. Scenes are always `lazy()`-imported and never re-exported from a barrel.
- Pages are grouped by audience: `pages/public/` (marketing **and** login),
  `pages/admin/`, `pages/tech/`. All lazy-loaded from `src/routes/`.
- zod schemas live in `src/form/schemas/`; `useZodForm` is the only importer of
  `zodResolver`. `src/config/env.js` is the only reader of `import.meta.env`.
- One `baseQuery` with a refresh-on-401 mutex, so a burst of 401s triggers one refresh.
- Styling = **Tailwind + shadcn/ui**. Components live in `src/components/ui/` (generated by
  the shadcn CLI, then edited freely — they are our source, not a dependency).
  Colors come from CSS variables in `index.css`; no hardcoded hex in components.
- Motion = **Framer Motion**. Page transitions, list stagger, and layout animations only.
  Respect `prefers-reduced-motion`; never animate anything that blocks input.
- Forms: react-hook-form + `zodResolver`, using the schemas mirrored from the backend.

**Backend** (`MaintainanceBackend`) — see its README for the full picture. Three rules matter
most: money is integer paisa and only `utils/money.js` does arithmetic on it; every registry
resource (CMS and, since H1, the operations lists) is mounted through `routes/admin/mountResource.js` rather than hand-written; status transitions are
asserted server-side from `shared/stateMachines.js`.

**Database**
- One Prisma migration per logical change, named descriptively.
- Seed script must produce a fully browsable demo site (`npm run db:seed`).
- Any user-visible list has an `sortOrder` Int and an `isActive` Boolean.

## Commands

```bash
# backend
cd MaintainanceBackend
npm run dev            # API on :4000
npm run db:migrate     # prisma migrate dev
npm run db:seed        # demo content + full demo pipeline
npm run db:studio
npm test               # vitest

# frontend
cd MaintainanceFrontend
npm run dev            # Vite on :5400
npm test               # vitest (jsdom)
npm run test:e2e       # playwright: the quotation loop and the dispatch walk-through (starts its own API :4010 + Vite :5410)
```

Seeded logins are listed in `MaintainanceBackend/README.md` (password `Password123`).

## Rules of engagement for Claude

1. Work phase by phase from `docs/ADMIN-PLAN.md` (prompts in `docs/prompts/`). Finish a phase's acceptance criteria before starting the next.
2. Before adding a model or field, update `docs/DATA-MODEL.prisma` and `docs/API.md` in the same change.
3. New admin CRUD screens are built from the admin kit in `MaintainanceFrontend/src/components/common/`:
   **`<CustomTable>`** (TanStack Table + shadcn, the Material React Table feature set: filters, row and bulk actions, page size, trash, reorder, column actions — pin / move / resize / hide — density, full screen, CSV export, remembered layout) and **`<ResourceForm>`** (declarative
   fields, server-error mapping, unsaved-changes guard), with `LocaleTabs`, `MediaPicker` and `useConfirm`. A CMS
   resource screen is a **registry entry** — one file in `MaintainanceFrontend/src/config/admin/resources/`,
   registered in `resourceRegistry.js` with a nav item in `adminNav.js` — rendered by the generic
   `ResourceListPage` / `ResourceEditPage`. Do not hand-roll another table, form or per-resource CMS page.
4. Add shadcn components with `npx shadcn@latest add <name>` — do not hand-copy them.
5. Money, phone numbers, and Nepali text are the three things that break. Test them.
6. No secrets in the repo. Everything through `.env` with a matching `.env.example` entry.
