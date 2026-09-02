# Maintenance System — Frontend

Vite · React 18 (JSX) · shadcn/ui + Tailwind · Redux Toolkit + RTK Query · Framer Motion

One app serving three audiences from one build: the public marketing site, the staff back
office, and a mobile-first technician view.

---

## Quick start

```bash
cp .env.example .env       # leave VITE_API_URL blank in dev
npm install
npm run dev                # http://localhost:5173
```

The backend must be running on `:4000` (`cd ../MaintainanceBackend && npm run dev`).
Vite proxies `/api` and `/uploads` to it, which keeps the browser same-origin so the
httpOnly refresh cookie works without any CORS or SameSite juggling.

Sign in with `admin@homeplexnepal.com` / `Password123` (all seeded logins are in the
backend README).

```
npm run dev      npm run build      npm run preview      npm run lint
```

---

## Layout

```
src/
  app/
    api/apiSlice.js       one RTK Query API; features inject their own endpoints
    api/baseQuery.js      auth header + single-flight refresh-on-401
    store/                configureStore
    routes.jsx            route groups + lazy loading
    AuthGate.jsx          silent refresh before the first route renders
    RequireAuth.jsx       role / capability route guard
  components/
    ui/                   shadcn primitives — our source, edit freely
    common/               DataTable, SlaChip, Toaster, EmptyState, ErrorState, PageHeader
    motion/               the whole motion vocabulary, in one file
  features/<domain>/      api slice + feature components
  layouts/                SiteLayout · AdminLayout · TechLayout
  pages/site|admin|tech/  route components
  hooks/                  useAuth, useTheme, useListParams, useSeo
  lib/                    utils, format, constants, permissions
```

### Four decisions that shape everything

**1. RTK Query is the only server state.** No react-query, no data in `useState`. Endpoints are
injected per feature so `apiSlice.js` never grows, and tag invalidation is declared next to the
mutation that causes it. Redux slices hold UI state only — theme, locale, toasts.

**2. The access token lives in memory.** Never `localStorage`, where any XSS could read it. On a
cold load `AuthGate` calls `/auth/refresh` once using the httpOnly cookie, so a page refresh
does not bounce a signed-in user to the login screen. A burst of 401s shares **one** in-flight
refresh (`baseQuery.js`) — otherwise eight parallel dashboard queries would fire eight refreshes
and rotate the token out from under themselves.

**3. One table.** `<DataTable>` drives the API's `?page&limit&sort&q` contract, and
`useListParams` keeps those filters in the URL so a filtered view is shareable and survives the
back button. Every list screen is built from it.

**4. Motion is decoration.** `components/motion/index.jsx` holds the entire vocabulary:
`PageTransition`, `Stagger`, `Reveal`, `HoverLift`, `CountUp`. Three rules — nothing animates
past 400ms, nothing blocks input, and every variant collapses to an instant state under
`prefers-reduced-motion` (handled in `useMotionVariants` *and* a global CSS media query).

### Adding a screen

1. Add endpoints in `features/<domain>/<domain>Api.js` via `apiSlice.injectEndpoints`.
2. Build the page from `<DataTable>` / shadcn primitives; wrap it in `<PageTransition>`.
3. Register the route in `app/routes.jsx` behind the right `<RequireAuth capability="…">`.
4. Add the nav entry in `layouts/AdminLayout.jsx` with its capability — it hides itself for
   roles that lack it.

New primitives come from `npx shadcn@latest add <name>` (configured for JSX in
`components.json`), not hand-copied.

---

## What is built

**Public site** — home assembled from the API's ordered, visible sections (change the order in
the admin, the page changes); services list and per-service detail with JSON-LD; pricing with
the live cost estimator; contact; and the customer self-service pages for quotation approval
and warranty claims, both opened from an SMS link with no login.

**Back office** — login, role-aware dashboard, the SLA response board, and the leads table with
status/response/source filters, URL-persisted, CSV export.

**Technician** — mobile-first `/tech` with today's jobs, tap-to-call, tap-to-navigate, and
one-tap status advance.

**Not yet built** (backend endpoints exist and are documented in `../docs/API.md`): lead detail
drawer, customers, quotation builder, job detail + dispatch board, materials, invoices, warranty
and AMC screens, the CMS editors, and the offline sync queue for the technician PWA.

---

## Theming and i18n

- Theme is `light | dark | system`, stored per browser, applied as a class on `<html>`
  (`useTheme`). All colors are CSS variables in `index.css` — no hardcoded hex in components.
- Nepali (`ne`) is a locale toggle that re-queries the public API; the server overlays its
  translations. Devanagari gets its own font stack via `:lang(ne)`, because the Latin stack
  renders it in a fallback face.
- Money arrives as integer paisa and is formatted only in `lib/format.js`.
  Dates arrive as UTC and render in Asia/Kathmandu.

## Verified in a real browser

Driven through headless Chrome against the live API:

- The home page renders all 19 dynamic sections in both themes, with Devanagari offers and
  testimonials in the correct face.
- A real form login as ADMIN lands on the dashboard (cards, funnel, SLA compliance); as
  TECHNICIAN it routes to `/tech` and shows the assigned job.
- The SLA board shows the breached lead with a live "9m overdue" chip and a one-tap
  "Log response" that stops the clock.
- The leads table renders live countdown chips: "1h 33m left", "Responded", "9m overdue".
- Zero runtime errors and zero unresolved modules across all 63 source files.
