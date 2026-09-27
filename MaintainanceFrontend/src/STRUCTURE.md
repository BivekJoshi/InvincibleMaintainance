# Frontend structure

One Vite app serves three audiences — the public marketing site, the back office
and the technician PWA — split by **route group**, not by build. The tree below is
organised by **layer**: a file's folder tells you what kind of thing it is, and
its name tells you which domain it belongs to.

```
src/
├── api/            Server state. RTK Query, one file per domain.
├── components/     Everything that renders.
├── three/          Everything that animates.
├── pages/          Route targets, grouped by audience.
├── routes/         The route table and its guards.
├── providers/      App-wide context and side effects.
├── redux/          Client state. The store and its slices.
├── form/           zod schemas + the react-hook-form binding.
├── hooks/          Reusable behaviour with no UI of its own.
├── config/         Constants, env vars, locale rules, the theme's vocabulary.
├── helpers/        Pure functions.
└── styles/         Tailwind entry + CSS variables.

e2e/                The Playwright suite: the quotation loop (Phase F2), the dispatch walk-through (Phase H1) and the BOQ (Phases L3–L4).
├── quotation-flow.spec.js
├── operations-flow.spec.js   schedule by drag and by dialog, double-book warning, materials, time, costing, complete, verify, case study
├── boq-flow.spec.js    SALES builds a 3-section BOQ by keyboard, pastes 15 rows, adds a `/` library row, a measured and an optional row, saves (server totals = what the builder showed), submits; MANAGER sees the margin, approves (L4: the unknown cost needs the acknowledgement, recorded in the event), sends; the customer opens the link at 360 px (sections, the 50 · 40 · 10 schedule with the server's amounts, the words, the annex, no sideways scroll), SALES sees "Opened 1×", the customer accepts; the public view has no cost key. L5–L8 extend it
├── fixtures/           boq-paste.tsv — the 15 rows pasted from "Excel" (a header, two text-only section rows, Indian grouping, `Rs.`)
├── global-setup.js     migrates and seeds the *_test database
└── support/            e2eEnv.js (ports, database, the API's environment), api.js (HTTP + signIn), quotation.js (`approveInDialog` — ticks the low-margin acknowledgement when the dialog or the API asks — and `rupeesText`)
```

## api/

`apiSlice.js` is the single RTK Query slice; every domain file injects into it with
`injectEndpoints`, so there is one cache and one tag registry. `baseQuery.js` holds
the refresh-on-401 mutex — a burst of 401s triggers exactly one refresh.

**File downloads go through RTK Query too, never `window.open` or a bare `<a href>`** — neither
sends the Bearer token, so the API answers 401. The pattern (worked example:
`exportLeadsCsv` in `leadsApi.js`, used by `pages/admin/LeadsPage.jsx`): a lazy query with
`responseHandler: (res) => res.text()` and `keepUnusedDataFor: 0` — text, because the cache only
holds serialisable values — and the page builds the `Blob` and clicks a temporary link. That way
the request carries the token and survives a 401 → refresh → retry. For CSV, prepend `'﻿'`
to the Blob: `res.text()` strips the byte-order mark the API sends, and Excel needs it to read
Devanagari. A **binary** file (Phase L4's quotation `.xlsx`, `quotationsApi#exportQuotationXlsx`) is cached as
**base64 text** — `responseHandler` encodes `res.arrayBuffer()` with `helpers/download#arrayBufferToBase64` (an
error answer stays the API's JSON) — and the page saves it with `downloadBase64(base64, filename, type)`.

`apiCore.js` exports only the core pieces. Domain endpoint files are **not** re-exported:
a barrel there would drag the back office's endpoints into the marketing bundle.
Import them directly — `import { useGetLeadsQuery } from '@/api/leadsApi'`.

`cmsApi.js` serves every CMS resource the API's CRUD factory mounts, by path segment: `listResource`,
`getResource`, `createResource`, `updateResource`, `toggleResource`, `reorderResource`, `deleteResource`
(`hard: true` for purge) and `restoreResource`, each taking `{ resource, … }` (`'faqs'`, `'process-steps'`).
A list is tagged `{ type: 'Cms', id: resource }`, a record `{ type: 'Cms', id: 'resource:id' }`. Create and
reorder invalidate the list; update, toggle, delete and restore invalidate the list and that record. Every
write also invalidates `Public`, so the site's cached pages in the same tab follow the change — and whatever
`ALSO_READ_AS` lists for that resource (`rate-card` → the quotation builder's `RateCard` list). It also holds the
home composer's `getHomeSections` / `updateHomeSections` (tag `{ type: 'Cms', id: 'home-sections' }`), the moderation
call `approveTestimonial({ id, isApproved })` (the testimonial list and record, and the site), and a project's gallery:
`addProjectImage`, `reorderProjectImages`, `removeProjectImage` (the project and the projects list, and the site).
`settingsApi.js` reads `GET /admin/settings` (tag `Setting`) and saves `PATCH /admin/settings` with the changed keys
only (it also invalidates `Public`, so the header shows a new phone at once). `publicApi.js` has the blog's
`getPublicPosts`, `getPublicPost` and the generic page's `getPublicPage`.
`mediaApi.js` has the picker's reads and upload plus the library's `updateMedia`, `deleteMedia`,
`createMediaFolder` and `deleteMediaFolder`.

The CRM files (Phase E):

- `leadsApi.js` — the lead list, detail, create / update / status / assign, **`bulkAssignLeads`** (one request for a
  selection), activities (the answer carries `firstResponse` and the lead's `sla`), duplicates, **`getLeadCustomerMatches`**
  (who else has this phone — the convert dialogs), merge, convert, delete, export. Every write that lands in a lead's
  audit trail also invalidates `History`; convert invalidates the `Customer` and `Site` lists and that customer.
- `customersApi.js` — customers (tags `Customer`), their sites (`Site`, id `customer:<id>`), timeline, statement, and
  **`getCustomerRecords({ kind, customerId })`**: another domain's list filtered by the customer (`CUSTOMER_RECORD_PATHS`
  — quotations, jobs, invoices, warranties, AMC), so the customer page needs none of those domains' files.
- `historyApi.js` — **`getRecordHistory({ endpoint, page, limit })`**, one query for every record's History tab (tag `History`).
- `usersApi.js`, `auditApi.js`, `messagesApi.js` (Phase G, ADMIN) — see "Platform (Phase G)". `previewTemplate` is a
  **query** although it is a POST: it reads, and caching by its arguments is what a live preview wants.
- `jobsApi.js`, `stockApi.js` (Phase H1) — see "Operations (Phase H1)".
- Phase L1 added to `leadsApi.js` **`setLeadNextAction`** (`PATCH …/next-action`: `{ at, type, note }`, or `{ at: null }` to
  clear) and uses the lazy **`useLazyGetLeadQuery`** on the board (a list row does not say whether a quotation exists).
  `addLeadActivity` now carries the outcome contract: the answer has `lead` (status, next action, attempts after it) and
  `dialog` (`'visit'` | `'quotation'` | null). **`reportsApi.js`** holds the sales reports — `getLostReport({ from, to })`
  (tag `{ type: 'Report', id: 'lost' }`, refreshed with the lead list).
- `dashboardApi.js` also holds **`getBreachedLeadCount`** (the SLA nav badge): the shell loads that file, and a count must
  not pull `leadsApi` into the main bundle.
- `quotationsApi.js` since Phase L3 also has **`previewQuotation`** (`POST /admin/quotations/preview` — a **query** although
  it is a POST: the builder's live amounts, totals and margin, and the discount helpers through `useLazyPreviewQuotationQuery`),
  **`getQuotationTakeoff`** (tagged with the quotation, so a save refreshes it), **`repriceQuotation({ id, apply })`** (a preview
  invalidates nothing; `apply: true` the quotation, the list and History) and **`copyQuotation({ id, customerId?, siteId?, leadId? })`**.
  `createQuotation` takes `items: []` (a blank draft). `getRateCard` stays for older callers; the builder searches with
  `rateLibraryApi#searchRateLibrary`. Phase L4: **`exportQuotationXlsx(id)`** (the binary download above, lazy,
  `keepUnusedDataFor: 0`), `approveQuotation` takes `acknowledgeLowMargin`, and the preview body carries
  `paymentStages` when the schedule on screen is whole. The terms picker reads the library through
  `cmsApi#listResource({ resource: 'quotation-terms' })`.
- `rateLibraryApi.js` (Phase L2) — the rate library's two calls beyond the registry's eight: **`deriveRateCost`**
  (`POST /admin/rate-card/derive`, `costs:read` — a **query** although it is a POST, like `previewTemplate`: the Cost vs rate
  card asks again as the recipe changes; tag `{ type: 'RateCard', id: 'DERIVE' }`) and **`repriceRateCard({ ids, apply })`**
  (`apply: false` is a preview and invalidates nothing; `apply: true` invalidates the library, those rates, the builder's
  `RateCard` list, `Public` and `History`). A write to `materials` or `trades` (a purchase rate, a day wage) refreshes the
  library's "Out of date" flags and the cost card through `cmsApi`'s `ALSO_READ_AS`. Phase L3 added **`searchRateLibrary({ q })`**
  (`GET /admin/rate-card?q=&limit=20&onlyActive=true`, tag `{ type: 'RateCard', id: 'LIST' }`) — the BOQ grid's `/` search.

## components/

| Folder | Holds |
|---|---|
| `ui/` | shadcn primitives. Generated by `npx shadcn@latest add <name>`, then edited freely — they are our source, not a dependency. |
| `common/` | Cross-cutting app furniture: `PageHeader` (a list page's top; its `<h1>` is screen-reader only — the breadcrumb names the page), `RecordHeader` (a record page's top: avatar, the name as the `<h1>`, contact links, actions, and a foot strip), `EmptyState`, `ErrorState`, `ErrorBoundary/`, `SlaChip`, `Toaster`, `LocaleSwitch`, `StateBadge` (a record's state on the semantic surfaces — Live, Draft, Waiting) — and the **admin kit**: `CustomTable/`, `ResourceForm/`, `EditableGrid/` (Phase L3 — reached only through ResourceForm field types), `MediaPicker/`, `LocaleTabs`, `ConfirmDialog`, `RecordCombobox`, `FormDialog`, `RecordHistory`. See "The admin kit" below. |
| `theme/` | The colour-mode controls: `ThemeToggle` (one button) and `ThemeModeSwitch` (all three modes). Both read the theme context; neither takes state as a prop. |
| `layout/` | The three shells — `SiteLayout`, `AdminLayout/`, `TechLayout` — plus what the public one is made of: `SiteHeader/`, `SiteFooter`, `MobileCallBar`. |
| `site/` | Marketing presentation, **one component per file**: `ServiceCard`, `ProjectCard`, `CategoryTile`, `PageHero`, `SectionShell`, `SectionHeading`, `Media`, `Breadcrumb`, `PromiseList`, `FaqList`, `FilterChip`, `PriceTag`, `Cta`, `Eyebrow`, `Stars`, `DataIcon`, `ProseBody` (long CMS copy — shared with the admin's prose preview). |
| `documents/` | The customer-facing sheet a token link opens: `DocumentShell` (tighter edges on a phone since L4), `DocumentHeader`, `LineItemsTable` (since L3 a BOQ: SECTION rows as numbered headings with their subtotal, NOTE rows as text, a row's `spec` under it, optional rows "not included in the total", provisional ones marked — an invoice's lines read as before; since L4 money never wraps and, on a phone, a line says to swipe the table for the rates and amounts), `TotalsList`, `DocumentNotice`, and Phase L3's **`QuotationDocument`** with its words (en **and** ne) in **`quotationDocumentCopy.js`** — the public quotation page, the builder's Customer view and (L4) the print route all render it. Phase L4 added **`DocumentLetterhead`** (logo, name, address, call-link phones, email, PAN/VAT — the API's `letterhead`), **`PaymentScheduleTable`** (stage · share · the server's amount with its VAT; the footer is the quotation's own total), **`SectionSummaryTable`** (`summaryOnly`: section subtotals only) and **`MeasurementsAnnex`** (collapsible on the page, open in print). See "Quotations — terms and the customer document (Phase L4)". Shared by the quotation, invoice and warranty pages. |
| `media/` | The media library screen's own parts: `MediaFolderTree` (folders as an indented tree) and `MediaDetailsSheet` (one file's facts, URL and alt/caption/folder form — a `ResourceForm` sheet) — and `MediaCell`, a list column's thumbnail of one media id (the gallery, features). |
| `projects/` | `ProjectGalleryTab` — the Gallery tab of a project's edit page (add from the library or upload, drag or Move earlier/later, remove; each change saves at once through the project image endpoints) — and `ProjectName`, a project's title from its id for a list column. |
| `homeComposer/` | `HomeSectionList` — the home page composer's sortable section rows (drag handle, Move up / down, visibility, item limit). |
| `leads/` | The lead screens' parts: `LeadFormSheet` (new / edit), `AssignLeadDialog` (one lead or a selection), `LostReasonDialog` (a required lost category, then the words — required only for "Other"), `LeadStatusMenu` (only the allowed moves), `ActivityComposer` (**the outcome composer** — see "Lead follow-through (Phase L1)"), `LeadRequestPanel` (contact, slot, estimate, UTM, language), `DuplicatesPanel` (merge with a preview), `CustomerMatchChoice` ("same person / different person", the email and language boxes), `ScheduleVisitDialog` and `ConvertLeadSheet` (the two converts, both with the choice; both report completion before they close, so a caller can tell done from Cancel — L1's new-quotation use of it became `quotations/NewQuotationSheet` in L3), `ConvertResult` (what a convert made, with links), `LeadPhotoGallery` (what the customer photographed, with a lightbox: arrow keys, thumbnails, full size), `ResponseRunway` (the SLA board's hero: every unanswered lead on its two-hour clock; `RunwayStrip` is the one-line version on the dashboard) `LeadStageTrack` (a lead's road from New to Won on its page; a lost lead shows its category and the stage it was lost at), and Phase L1's `NextActionCard`, `QualificationCard` and `StageAgeChip` (see "Lead follow-through (Phase L1)"). |
| `rateLibrary/` | Phase L2's rate library parts: `RateCostCard` (the edit form's live **Cost vs rate** card — a `preview` field behind `costs:read`), `RepricePreview` ("Update to derived rate"'s before/after table, inside the confirmation) and `RateLibraryIntro` (above a saved rate: how its rate is set, and "Out of date" with what its recipe gives today). See "The rate library and the money wall (Phase L2)". Phase L3's **`RateLibrarySearch`** is the BOQ grid's `/`: a cmdk palette over the server search — Enter adds the highlighted item, Shift+Enter ticks several, each becomes a row priced from the library (`helpers/boq.js#libraryRow`). |
| `quotations/` | Phase L3's **`NewQuotationSheet`** — the one way a quotation starts: blank · from a survey · copy. See "Quotations — the BOQ builder (Phase L3)". Phase L4's **`ApproveQuotationDialog`** — the margin, a remark, and the low-margin acknowledgement (`useQuotationActions` opens it for Approve). |
| `customers/` | `CustomerFormSheet` (new customer), `CustomerAvatar` (initials in a steady colour; squared for a company), `CustomerBook` (the list's summary tiles, each a filter) and `MapPinInput` ("use map pin": pasted coordinates fill a site's latitude and longitude — it sits in the site form's `intro`, inside the form). |
| `jobs/` | Phase H1, shared by the jobs list, the job page and the dispatch board: `JobFormSheet` (new job; the site and quotation follow the customer), `ScheduleJobDialog` (window, who goes, lead, "text the customer" — the board's non-drag path), `AssignJobDialog`, `CompleteJobDialog` (note, signature photo, rating, warranty). |
| `stock/` | `StockMovementsSheet` — one material's movements, paged (Phase H1). |
| `charts/` | Hand-drawn SVG charts, no chart library: `ChartCard` (the frame — title, Chart/Table switch, link; with `ChartTable`, `ChartTooltip`, `LegendKey`), `LineChart` (running lines, crosshair, arrow-key stepping), `ColumnChart` (a few columns, one emphasised, each a button), `RingMeter`, `Sparkline`. Width comes from `hooks/useElementWidth`. Series colours are `hsl(var(--chart-1))` (teal) and `--chart-2` (brass) from `globals.css`, validated as a colour-blind-safe pair — marks only, never text. Every chart has a table twin. |
| `dashboard/` | The admin dashboard's widgets, one per file: `DashboardHero` (greeting and the "to do" chips), `MetricGroup` (a titled strip of numbers — groups and names in `config/admin/dashboardCards.js`), `LatestCard` (your notifications), `LeadTrendCard`, `SlaCard`, `SlaQueueCard`, `PipelineCard`, `FunnelCard`, `HeatmapCard`, `LeadSourcesCard`, `TodayJobsCard`, `TechLoadCard`, `JobsWeekCard`, `JobStatusCard`, `RevenueCard`. `pages/admin/DashboardPage.jsx` lays them out on a 12-column grid by section and drops whatever the API did not send for the role; the arithmetic is in `helpers/dashboard.js`. |
| `platform/` | The admin platform screens' parts (Phase G): `AuditDiff` (a before/after, nested fields by path, each line marked added / removed / changed on the semantic surfaces and in words), `AuditRowDetails` (an audit row opened: the diff, request id, ip, browser, "Show everything from this request", "Open the record"), `UserFormSheet` (new / edit — no password field), `SessionsDialog` (where someone is signed in, "Sign out everywhere"). |
| `public/`, `booking/`, `surveys/` | Domain components, named for the domain they serve. `booking/BookingWizard/` is a folder for the same reason a page is: the flow's state in `BookingWizard.jsx`, one file per step under `steps/`, and the Kathmandu date maths in `bookingDays.js`. `public/SitePhotoUpload` is shared by the booking wizard's details step and the enquiry form: each photo uploads as it is chosen (`POST /public/lead-photos`) and the enquiry carries only the ids. |

A component used by exactly one page can live beside its domain here; a component
used by two pages **must**. Nothing imports upward from `pages/`.

There is no `siteBlocks.jsx` barrel any more — import the component, not a bundle
of fifteen: `import { ServiceCard } from '@/components/site/ServiceCard'`.

A layout becomes a folder on the same rule a page does. `SiteHeader/` is the
worked example: the bar and the state its panels share in `SiteHeader.jsx`, and
`MegaPanel`, `MobileDrawer`, `HeaderSearch` and `UtilityStrip` beside it.

`AdminLayout/` is the second: the shell and top bar in `AdminLayout.jsx`, the ink sidebar in `AdminSidebar.jsx`,
the shortcuts strip under the top bar in `ShortcutBar.jsx`, the Ctrl/⌘+K palette in `CommandPalette.jsx`, the notes
drawer in `NotesSheet.jsx`, the header's `AdminBreadcrumb` and `NotificationPanel` beside them, and `notificationLinks.js` — the one place a
notification's `link` (`/leads/:id`, `/admin/surveys/:id`, an absolute app URL) becomes an in-app path.
The nav itself is data, in `config/admin/adminNav.js` (see "The admin shell" below).

## The admin kit

Every admin list and every admin create/edit screen is built from these. A CMS resource screen is
not built from them by hand at all: it is a **registry entry** (see "The resource registry" below)
that the two generic pages render with this kit.

### `common/CustomTable/CustomTable.jsx` — the one table

Built on **TanStack Table** (`@tanstack/react-table`, headless) with shadcn/ui cells — the Material React
Table feature set without MUI. Server-side paging, sorting and search over `?page&limit&sort&q`, with the
params in the URL through `hooks/useListParams`; TanStack holds sorting, selection, expansion, and the
viewer's layout. The folder holds the table and its parts: `CustomTableHead` (sort, column actions menu,
resize handle), `CustomTableCell` (cell rendering, pinning offsets), `CustomTableViewOptions` (Columns,
density, full screen, export), `CustomTableFilters` (inline) and `CustomTableFilterPanel` (`filterLayout="panel"`: a Filters side panel of chips plus removable applied-filter chips), `CustomTableRowActions`, `CustomTablePagination`,
`CustomTableReorderBody`, `useCustomTableLayout` (the remembered layout) and `exportCsv`.

A column is `{ key, header, cell?(row), sortable?, className?, label?, hideable?, hidden?, size?, exportValue?(row) }`;
the table maps it to a TanStack column def, so callers never touch TanStack directly. Cells are rendered
as plain calls, not `flexRender` (which would remount every cell each render). The table adds its own
display columns on the edges — expand, select and # pinned left, row actions pinned right — so they stay
in view when a wide table scrolls sideways.

| Prop | Does |
|---|---|
| `columns`, `data` (the page's rows), `meta`, `params`, `onParamsChange` | the basics, unchanged from v1 |
| `onRowClick`, `toolbar`, `searchPlaceholder`, `empty*`, `isLoading`, `isFetching`, `error`, `refetch` | unchanged |
| `rowActions(row)` → `[{ label, icon?, onSelect(row), destructive?, disabled?, separator? }]` | a kebab menu per row |
| `bulkActions` → `[{ label, icon?, destructive?, onSelect(rows, clearSelection) }]` | checkbox column, select-all-on-page, an actions bar. Selection clears when the page or filters change |
| `pageSizes` (default `[10, 20, 50, 100]`) | "Rows per page", written to `limit` |
| `filters` → `[{ key, label, type: 'enum' \| 'boolean' \| 'relation' \| 'dateRange' \| 'text', options?, allLabel?, defaultValue?, relation?: { path, labelKey?, params? }, fixedOptions?, fromKey?, toKey?, className? }]` | the filter bar; every value lives in the URL. A date range writes `from` / `to`. A choice with a `defaultValue` has no "all" of its own (give it an explicit option), is where the list starts, and is not counted as an applied filter — the caller puts the default in its list params. A relation's `fixedOptions` (`[{ value: 'none', label: 'Unassigned' }]`) are choices that are not records. An enum option's `group` lists consecutive options under that heading (the audit log's events). A `text` filter (a request id, an ip) is applied on Enter or blur, not per key |
| `expandable` → `{ render(row) }` | a disclosure button per row (`aria-expanded`, `aria-controls`); an open row shows `render(row)` across the table beneath it. Open rows close when the params change |
| `searchable` (default true) | false hides the search box — a short, complete list inside a page (duplicates, sites, a statement) |
| `trash` → `{ onRestore(row), onPurge?(row), canPurge? }` | a Trash toggle (`?deleted=true`); rows offer Restore, and Delete forever (confirmed) to `cms:purge` |
| `reorderDisabledReason` | when not `reorderable`, a disabled Reorder button with this reason beside it (list items: pick a list first) |
| `reorderable`, `onReorder(items)` | Reorder mode: drag handles plus Move up / Move down. `items` is `[{ id, sortOrder }]` offset by earlier pages — the `PATCH /reorder` body. Optimistic; a rejected promise puts the order back |
| `getRowId` (default `row.id`), `rowLabel(row, i)` | identity, and how a row is named to a screen reader |
| `enableColumnActions`, `enableColumnPinning`, `enableColumnOrdering`, `enableColumnResizing` | a **column actions menu** in every header: Sort ascending / descending / Clear, Pin to left / right / Unpin (pinned columns stick while the table scrolls sideways), Move left / right, Reset width, Hide column. Resize by dragging a header's edge (double-click resets) or focusing it and pressing ←/→ |
| `enableHiding`, `enableDensityToggle`, `enableFullScreenToggle` | toolbar: a **Columns** menu (show / hide, Show all, Hide all, Reset layout), row density (Normal → Comfortable → Compact) and full screen (Esc leaves). A column opts out of hiding with `hideable: false`, starts hidden with `hidden: true`; `label` names it when `header` is not text |
| — defaults | every `enable*` above is **on for a full list** (searchable, more than four columns) and off for a short in-page table; pass `true` / `false` to override |
| `storageKey` | remembers the viewer's layout — hidden, ordered, pinned and resized columns, density — in this browser (`table:<key>:layout`). Every admin list page sets one; CMS lists use `content:<resource>` |
| `enableRowNumbers` | a # column, counted across pages |
| `exportable`, `exportName` | an **Export** button: this page, or the selected rows, as CSV — each column's cell text as shown (money as `Rs. …`), or its `exportValue(row)`. UTF-8 with a BOM so Excel reads Nepali; fields starting `= + - @` are prefixed `'` (CSV injection). Server-wide exports (leads) stay on their own endpoints |
| `maxHeight` | the body scrolls under a sticky header (full screen does the same) |

### `common/EditableGrid/EditableGrid.jsx` — the one spreadsheet (Phase L3)

The kit's editable grid, on TanStack-style column specs and dnd-kit. **Pages never render it**: they reach it only
through ResourceForm field types — `lineItems` (a quotation's BOQ), `grid` (generic), `measurements` (a measurement
sheet), `recipe` (the rate library's) and, since Phase L4, `paymentSchedule` (a quotation's stages) — which is how CLAUDE.md rule 3 still holds (a test in `EditableGrid.test.jsx`
fails if a page or a registry entry imports it). The folder: `EditableGrid.jsx` (state, keyboard, clipboard, the visible
window), `GridRow.jsx` (one memoised row; a sortable shell only when the grid is editable), `GridCellEditor.jsx` (the one
editor on screen: text, number, money, length, a `select` list, or a column's own `renderEditor`), `gridKeys.js` (the
keyboard map as data, `resolveCellKey` / `resolveEditorKey`, `gridKeymap` for the legend) and `gridPaste.js` (the clipboard).

- **One cell edits at a time.** Every cell is a plain `gridcell` with a roving tab stop; only the cell being edited renders
  an input, so a keystroke re-renders that input, not the grid. It saves on Enter (and moves down), Tab (and moves across)
  and blur; Esc cancels. Rows are memoised by object, so an edit re-renders the row it changed.
- **The keyboard map** (shown under every grid by its **Keyboard** button):

  | Keys | Does |
  |---|---|
  | ↑ ↓ ← → · Home / End · Ctrl+Home / End | move between cells (a section's spanning title is one cell; moving down through it comes back to the same column) |
  | Enter / F2 | edit the cell — Enter again saves and moves down; Enter on a measured Qty opens its sheet, on the actions cell the menu |
  | typing | overwrites the cell (arrows then save and move, as in a spreadsheet; in Enter/F2 mode ← → move the caret) |
  | Tab / Shift+Tab | save and move to the next / previous editable cell; after the last cell Tab adds a row |
  | Esc | cancels an edit; Esc then Tab leaves the grid |
  | Delete · Space | clear the cell · tick a yes/no cell |
  | Ctrl+Enter · Ctrl+Shift+Enter | add a row · a section below |
  | Ctrl+D · Alt+↑ / Alt+↓ · Ctrl+Delete | duplicate · move (the drag handle's keyboard way) · remove the row |
  | Ctrl+Z | undo the last change made in the grid (a change from outside — a drawer, a reload — ends the history) |
  | `/` | open `search` (the BOQ's rate library) |
  | Shift+F10 | the row's actions menu (its own actions, then add / duplicate / move / remove with their shortcuts) |
  | Ctrl+M | (BOQ) the row's measurement sheet — a field's own `shortcuts` join the legend |

- **Paste** (`gridPaste.js`): a range copied from Excel or Sheets is TSV — `parseClipboard` reads quoted cells too.
  `readPastedRows(text, columns)` detects a **header row** (two or more cells naming columns by `aliases` — `Particulars`,
  `Qty.`, `Rate (Rs)`) and maps by it, ignoring columns it does not know (S.N., Amount); without one, cells go in order and a
  leading serial-number column (`1`, `A.1`) is dropped. Numbers go through `parseGridNumber`: **Indian grouping**
  (`1,23,456.50`), `Rs` / `Rs.` / `NPR` stripped; lengths through `helpers/measurements#parseLength`; an unreadable number
  stays as typed for the schema to name. `pastedBoqRows` turns a row with **text but no quantity and no rate into a
  SECTION**. Pasted rows go in after the selected row (in place of it when it is blank); one value pastes into the cell.
- **Numbering** is the caller's `numbers` (the BOQ's `A`, `A.1` from `helpers/boq.js#boqNumbers`, the API's rule).
- **Drag** by a row's handle (dnd-kit, pointer); every drag has the keyboard equivalent Alt+↑/↓ and the menu's Move up / down.
  A read-only grid has no handles and no dnd-kit context at all.
- **500 rows**: above 60 rows only the rows in view (plus a margin) render, from each row's known height; the selected
  row is scrolled to before it takes focus. The test renders 500.
- Column spec: `{ key, header, width | grow + minWidth, align, editor ('text'|'number'|'money'|'length'|'select'|'boolean'|
  'custom', or a function of the row), get/set, parse/toText, format(value, row, { meta, index, number }), editable(row),
  hidden(row), span(row), onActivate(row), options, suggestions (a datalist), renderEditor, label(row, i), placeholder }`.
  Grid props: `rows`, `onChange`, `getRowKey`, `numbers`, `rowKind`, `makeRow(kind)` + `kinds`, `duplicateRow`, `isBlankRow`,
  `paste`, `search`, `rowActions`, `shortcuts`, `rowMeta` (the server's figures per row), `rowErrors`, `rowHeight`,
  `readOnly`, `maxRows`, `focusRef` (react-hook-form's field ref: a failed save focuses the first bad cell), `apiRef`.

### `common/ResourceForm/ResourceForm.jsx` — a form described by data

`<ResourceForm schema fields defaultValues onSubmit submitLabel mode="page|sheet" />`, plus `onCancel`,
`open` / `onOpenChange` / `title` / `description` for a sheet, `guard`, `extraActions`, `readOnly` (every control
disabled, no Save — for a role that may read but not write) and `intro` (content above the fields, e.g. the
media sheet's preview).

- `defaultValues` is a record **as the API returns it** (money in paisa). `formValues.js` converts it for
  the form and back into a request body (money stays in rupees — requests send rupees).
- `onSubmit(body)` returns the mutation's `unwrap()`. A rejection's `error.details` lands on the named
  fields (`serverErrors.js` — both the `[{ path, message }]` and the `['field']` DUPLICATE shape); anything
  unplaced shows in an alert above the form, and the first failing field takes focus.
- After a save the form is clean: its baseline becomes the inputs' own values, not the schema's output (a
  transform such as "empty optional text → undefined" would otherwise leave it dirty and trip the leave guard).
- Controls are disabled while saving. Leaving with unsaved changes — a link, Back, closing the tab or
  the sheet — asks first (`hooks/useUnsavedChangesGuard`). One guard per page: `guard={false}` on any second form.
- Render it once the record has loaded, so a saved slug is known to be saved.
- A null value in a column the form has no field for is dropped from the form values (a schema's `.optional()` refuses
  null, and a hidden column must not block a save — a testimonial's `jobId`).
- `stickyActions` keeps Save in view at the bottom of a long page-mode form.
- A spec's **`hidden: true`** keeps the field — and its value, and its validation — without showing it (a group card's
  `hidden` does the same for the card): the quotation builder shows its BOQ and Payment & terms panels one at a time from
  one form. `formMode.js` tells the grid fields whether the form is read-only (`readOnly`, or a save in flight) — a
  `<fieldset disabled>` cannot disable grid cells.
- `onValuesChange(values)` is told the typed values on every change — a live preview beside the form (the message
  template editor). Pass a stable function (a state setter).
- **Fields that follow the values** (the outcome composer shows a time for "Call back at…", a lost category for "Not
  interested"): compute `fields` from what `onValuesChange` reports, and give `defaultValues` **every** field the form can
  show, blank. The form resets a clean form when its starting values change, and a starting point that grew with each
  field shown would wipe the pick that showed it (react-hook-form reports `isDirty` a render late). A value whose field
  is hidden stays in the form, so build the request from what the pick uses, not from everything (`activityBody`).

One file per field type under `fields/`. Every spec has `name`, `type`, `label`, and optionally
`description`, `placeholder`, `required`, `disabled`, `span: 'half'`, `defaultValue` — and, in a registry entry,
`lockedOnEdit` (editable on a new record, read-only once saved) and `capability` (shown only to a user holding it — a
technician's labour rate, the rate library's overhead %). Since Phase L2 a spec may also say:

- **`adapt(values)`** — the spec follows the form's values: it returns overrides (`{ disabled: true, description }`,
  `{ required: true }`), `{ hidden: true }` to leave the field out, or nothing. The rate library's Rate is read-only
  "Set from the recipe when you save." while the rate comes from the recipe. A hidden field keeps its value
  (`FieldRenderer.jsx#AdaptiveFieldCell`, which is the only cell that watches every value).
- **`nullable: true`** — an emptied value is **sent as null**, which is how the API clears a column (a material's pack size,
  a rate's overhead % back to the setting). Without it an empty value is left out, and an update keeps the old one.

`number` keeps what was typed, as `money` does: react-hook-form reports a field's starting value while it is `undefined`,
so a cleared input would otherwise show the saved number again.

| `type` | Value | Extra spec |
|---|---|---|
| `text` / `textarea` | string | `inputType`, `maxLength`, `rows`; a textarea's `lang: 'ne'` gives Nepali text the Devanagari face (the terms library's Nepali body) |
| `prose` (alias `markdown`) | plain text, blank line between paragraphs — **not** markdown, because the site renders `ProseBody` | `rows` |
| `number` | number | `min`, `max`, `step` |
| `money` | **rupees** (typed with grouping, `1,23,45,678.90`); the record's paisa converted on load | — |
| `switch` | boolean — a setting that is on or off | — |
| `checkbox` | boolean — a statement ticked on purpose (Phase L4: "I approve it below the minimum margin"); a schema's `refine(v => v)` makes it required | `tone: 'warning'` |
| `select` / `enum` | string; optional fields get "None" | `options` (values or `{ value, label }` — a plain value is title-cased, so pass `{ value, label }` for units and codes; a label may be JSX, as the icon picker's are), `noneLabel` |
| `relation` | id, or null to unlink | `relation: { path, labelKey?, valueKey?, params? }` |
| `date` | UTC ISO of the start of that day in Kathmandu | — |
| `datetime` | UTC ISO; shown and typed in Kathmandu time | `defaultTime` |
| `slug` | string; follows `source` on a new record until edited; a saved slug never moves on its own | `source`, `prefix` |
| `stringList` | `string[]`; blank lines dropped | `addLabel`, `maxItems` |
| `keyValue` | `{ [key]: string }` | `keyLabel`, `valueLabel`; or `keys` (fixed rows, e.g. `['label', 'url']`) with `keyLabels`, `placeholders` — the value then always has every key |
| `media` | media id | — |
| `mediaList` | ordered media ids; drag or move buttons | `maxItems`, `addLabel` |
| `weekdays` | sorted day numbers, 0 = Sunday … 6 = Saturday | — |
| `checklist` | `string[]` — several values ticked from `options: [{ value, label, description?, disabled? }]`, kept in the options' order; a ticked value no longer listed stays, named by `unknownLabel(value)` (the technicians on a job) | `options`, `emptyText`, `unknownLabel` |
| `lineItems` | a quotation's **bill of quantities** (Phase L3, on EditableGrid): ITEM / SECTION / NOTE rows — description (a section's title, a note's text), unit, qty (typed, or measured: a ruler and the sheet's quantity), waste %, rate in **rupees**, amount, optional. The record's rows (paisa) come in through `helpers/boq.js#toBoqRows` with a client `_key`; the schema (`quotation.schema#boqRowsSchema`) sends `boqRowBody` rows and never a cost. **Every amount, section subtotal and measured quantity is the server's** — `figures`, a Map of row key → the saved rows' or the live preview's figures (`stale` dims them while a newer preview is on its way). `/` searches the rate library, Excel paste adds rows, and a row's actions open its **measurement sheet** (Ctrl+M — a `measurements` form in a sheet), its frozen **recipe** (read-only; quantities per the recipe and for this row; cost only for `costCapability`) and its **details** (specification, kind, optional, provisional). The drawers are their own forms, and their events are stopped before the builder's form | `figures`, `stale`, `costCapability`, `gridLabel`, `search` (false to switch the library off), `maxItems` (500) |
| `grid` | an array of small objects edited as a spreadsheet — the generic EditableGrid field; a completely blank row is dropped | `columns` (EditableGrid column specs, a module constant), `makeRow`, `maxItems`, `addLabel`, `emptyText`, `footer(rows)` |
| `measurements` | a measurement sheet: rows of area, description, nos, L, B, H and deduct. Lengths take **feet-inches** (`12'6"` → 12.5, `12'` → 12, `6"` → 0.5 — `helpers/measurements#parseLength`) and show as the number they were read as; each row's value (nos × L × B × H over the dimensions it has, negative for a deduction) and the sheet's total are a **preview** — the saved quantity is the server's. Sent as numbers, blank rows dropped (`measurementSheetSchema`) | `unit` (named in the total) |
| `recipe` | a rate-library recipe (Phase L2; on EditableGrid since L3): the API's `components` — one row per line: **What** (a material from `materials.path` or a trade from `trades.path` in a record picker that opens on Enter — or the words, for equipment and other), Kind, quantity (the material's own unit, man-days), unit, wastage % (materials), cost per unit in **rupees** (equipment and other; the column only for `costCapability`). "Add material / labour / equipment or other cost" put a line at the end of its section and select it; Ctrl+Enter adds one below. A line names its material or trade from the record it carries (`RecordCombobox selectedLabel`), so a reader who may not list materials sees names, and "Bought as bag = 50 kg" under a material with a pack. `helpers/recipe.js` converts both ways | `materials`, `trades` (`{ path, params }`), `costCapability`, `per: { qty, unit }` (the "Quantities below make 10 sq.m" line) |
| `paymentSchedule` | a quotation's **payment schedule** (Phase L4, on EditableGrid): one row per stage — label, **share in %**, when it falls due (`PAYMENT_TRIGGER_LABELS`: on acceptance / at a milestone / on completion) — and an Amount column that shows only the server's figure (`figures`, matched by position; "—" when there is none). Presets **50 · 40 · 10**, **40 · 30 · 20 · 10** and **100 on completion** above the grid (`PAYMENT_SCHEDULE_PRESETS`; the matching one is pressed), a live "Adds up to 100%." / "90% — 10% short" line under it. The record's stages (basis points) come in through `helpers/paymentSchedule#toStageRows`; `quotation.schema#paymentScheduleSchema` refuses what the API refuses (not exactly 100 %, two advances, 0.01–100 %, two decimals, a stage unnamed, 1–10 stages) and sends `{ label, basisPoints, trigger }`; no stages sends nothing (the API keeps its schedule). **Never a money sum** — shares only | `figures`, `stale`, `maxItems` (10) |
| `preview` | **no value** — a panel worked out from the form's values; never loaded or sent (`DISPLAY_TYPES` in `formValues.js`), and the registry test does not look for it in the schema. `component` renders inside the form and reads the values with `useWatch()`. The rate library's Cost vs rate card, behind `capability: 'costs:read'` | `component` |
| `objectList` | an array of small objects, one row each (move up/down, remove); a completely empty row is dropped on save — give the schema a `z.preprocess` that drops blank rows too, since validation runs first | `itemFields: [{ name, label, type?: 'text' \| 'select', options?, placeholder?, maxLength?, className? }]`, `itemLabel`, `addLabel`, `maxItems` |
| `group` | collapsible section (e.g. SEO); opens itself on an error inside. `variant: 'card'` is an always-open titled card (the settings page) | `fields`, `defaultOpen`, `variant` |

### The rest of the kit

- **`common/LocaleTabs.jsx`** — `<LocaleTabs model recordId fields sourceValues>{English form}</LocaleTabs>`.
  The Nepali tab edits the `ne` translations of `fields` through `GET/PUT /admin/translations`
  (`api/translationsApi.js`), shows the English copy under each field, and saves on its own button. It is
  disabled until the record has an id. Both panels stay mounted; the Nepali one is `lang="ne"`, which gives it
  the Devanagari font stack. `extraTabs` (`[{ value, label, content, disabled }]`) adds panels after the languages —
  a project's Gallery; with no translatable `fields` there is no Nepali tab and the first tab reads "Details".
- **`common/MediaPicker/MediaPicker.jsx`** — `<MediaPicker open onOpenChange multiple selected onSelect(ids, rows)>`.
  Library tab: search, folder filter, 24 per page. Upload tab (`media:write` only): alt text is required per
  picture, one file per request; a finished upload is selected. `MediaThumb` shows the stored blurhash, then the
  400px variant. `MediaGrid` / `MediaPager` are the grid and pager the picker and the library screen share;
  `MediaUpload` also takes `incoming` (files dropped elsewhere on a page). Endpoints in `api/mediaApi.js`.
- **Overlays and toasts** — `ui/sheet.jsx` and `ui/dialog.jsx` ignore a press on a toast (`helpers/overlay.js`,
  `[data-toaster]` on the Toaster). Toasts sit bottom-right, over a sheet's Save button, and pressing one must not
  close the form underneath.
- **`common/ConfirmDialog.jsx` + `hooks/useConfirm.jsx`** — `const [confirm, confirmDialog] = useConfirm()`,
  then `await confirm({ title, description, confirmLabel, destructive })` → true / false. The caller renders
  `confirmDialog`; there is deliberately no app-wide provider, so alert-dialog stays out of the marketing bundle.
  `description` may be a block (the reprice preview's table) — it is then rendered in a `div`, not the description's `p`.
- **`common/RecordCombobox.jsx`** — picks one record from an admin list endpoint, searching `?q=` on the server.
  The relation filter and the relation field are both this. `api/lookupApi.js` holds its two resource-agnostic
  queries (`searchRecords`, `getRecord`). `fixedOptions` adds choices that are not records (listed first, never looked up).
  `selectedLabel` names the current value when the caller already has it, so it is not looked up (a recipe line).
- **`common/FormDialog.jsx`** — a short `<ResourceForm>` in a dialog (a reason, an owner): Cancel and a save close it,
  and it never holds the page's leave-guard. The lost-reason and assign dialogs are this.
- **`common/RecordHistory.jsx`** — `<RecordHistory endpoint="/admin/leads/:id/history" />`: a record's History tab.
  Newest first, one line per step — the event's words (`config/auditEvents.js`), a detail line, who (name · role, or
  "Customer (website or link)" / "System") and when (Kathmandu time), and "Show details" for the before/after table.
  `helpers/history.js#foldHistory` folds a request's plain row writes into that request's named event, so a status change
  reads once. Pages with the API's own paging. It takes any endpoint the API gives a history scope
  (`services/history.service.js`) — since Phase G, any model (the API's `routes/admin/historyRoute.js`); every
  registry edit page carries it automatically. Every detail page carries one (ADMIN-PLAN §7).

## The resource registry

### Which screen is which (final, Phase D2)

Every CMS resource the API mounts has a screen. `cms` means `cms:read` to open and `cms:write` to change.

| Resource | Screen | Address · capability (read / write) | Nav group | Public page it feeds |
|---|---|---|---|---|
| Home page | **bespoke** `pages/admin/HomeComposerPage` | `/admin/content/home` · cms | Content | `/` section order and visibility |
| Hero slides | registry `hero-slides` | `/admin/content/hero-slides` · cms | Content | home hero (the first active slide's words) |
| Services | registry `services` | `/admin/content/services` · cms | Content | `/services`, `/services/:slug`, home, `/pricing`, estimator |
| Service categories | registry `service-categories` | `/admin/content/service-categories` · cms | Content | header rail, home tiles, `/services` filter |
| Projects | registry `projects` + its **Gallery tab** (`tabs`) | `/admin/content/projects` · cms | Content | `/projects`, `/projects/:slug`, home "Recent work", a service page's related work |
| Offers | registry `offers` | `/admin/content/offers` · cms | Content | home "Current offers" (while live) |
| Pricing plans | registry `pricing-plans` | `/admin/content/pricing-plans` · cms | Content | home packages, `/pricing`, estimator |
| Testimonials | registry `testimonials`, Approve row action | `/admin/content/testimonials` · cms; approving needs `testimonials:moderate` | Content | home reviews (approved only), JSON-LD |
| FAQs | registry `faqs` | `/admin/content/faqs` · cms | Content | service pages |
| Gallery | registry `gallery` | `/admin/content/gallery` · cms | Content | home "From the field" |
| Media library | **bespoke** `pages/admin/MediaLibraryPage` | `/admin/content/media` · cms:read to open, media:write to change | Content | every image |
| Features | registry `features` | `/admin/content/features` · cms | Page blocks | home promises, construction, steel buildings, kitchens |
| List items | registry `list-items` (`reorderWithin: 'group'`) | `/admin/content/list-items` · cms | Page blocks | home renovation reasons, kitchen steps, seepage signs |
| Content blocks | registry `content-blocks` (key `lockedOnEdit`) | `/admin/content/content-blocks` · cms | Page blocks | home seepage and interiors bands |
| Process steps | registry `process-steps` | `/admin/content/process-steps` · cms | Page blocks | home "How it works" |
| Posts | registry `posts` | `/admin/content/posts` · cms | Blog & pages | `/blog`, `/blog/:slug`, the Blog nav item |
| Post categories | registry `post-categories` | `/admin/content/post-categories` · cms | Blog & pages | `/blog` category filter |
| Pages | registry `pages` | `/admin/content/pages` · cms | Blog & pages | `/:slug` (e.g. `/about`), CMS button links |
| Rate library (the rate card until L2) | registry `rate-card`, own `basePath`; the `recipe` field, a `preview` cost card, `bulkActions` "Update to derived rate", cost columns behind `costs:read` | `/admin/rate-card` · rates:read / rates:write; History rates:read (the API masks cost in it) | Catalog | quotation lines, survey pricing, `/pricing` rate table |
| Trades & wages | registry `trades`, own `basePath`; the day wage behind `costs:read` | `/admin/trades` · rates:read / rates:write | Catalog | — (a recipe's labour) |
| Terms library | registry `quotation-terms` (Phase L4), own `basePath`; the English body and the Nepali `bodyNe` as two textareas (a column of its own, not a translation — so no LocaleTabs); **Default** moves the flag (the API's rule) | `/admin/quotation-terms` · rates:read / rates:write (the API also lets `quotations:read` list it); History rates:read | Catalog | — (a new quotation starts with the default's text; the builder's terms picker) |
| Technicians | registry `technicians`, own `basePath`, switch = **availability** (`activeField: 'isAvailable'`) | `/admin/technicians` · technicians:read / technicians:write; the rate field and the History tab need technicians:write | Operations | — |
| Job templates | registry `job-templates`, own `basePath`; steps as an `objectList` | `/admin/job-templates` · jobs:read / jobs:write | Operations | — (a new job copies the steps) |
| Materials | registry `materials`, own `basePath`; pack size and name (`nullable`) since L2 | `/admin/materials` · materials:read / materials:write (the API also lets `rates:write` list and read them, for the recipe picker) | Operations | — (stock is the Stock page; a recipe's materials) |
| Material categories, Suppliers | registry `material-categories`, `suppliers`, own `basePath` | `/admin/material-categories`, `/admin/suppliers` · materials | Operations | — |
| Site settings | **bespoke** `pages/admin/SettingsPage` | `/admin/platform/settings` · settings:read to open; saving is ADMIN's (`settings:write`) | Platform | header, footer, contact, hero badges and counters, booking calendar, SEO defaults |

Why three are bespoke: the **home composer** edits a fixed set of 19 sections with no create or delete, saved
together in one `PUT /admin/home-sections` — a draft with Save / Discard, not a list of records. The **media
library** is a grid of files with folders, drag-and-drop upload and a details sheet, not rows and a form. Both
are listed in `BESPOKE_CONTENT` in `adminNav.js`, and the registry test checks they have no entry. Their static
routes outrank `/admin/content/:resource`. **Site settings** are a fixed set of keys saved together, not records:
`config/admin/settingsForm.js` builds a `ResourceForm` from the rows (one `variant: 'card'` group per `Setting.group`,
the input from the row's `type` and a few per-key rules — phones, emails, https links, number ranges, weekday
checkboxes, badge and counter rows) and `changes(body)` gives the PATCH body: only keys whose stored value would
change, compared with sorted object keys (jsonb reorders them). Setting keys contain dots, which react-hook-form reads
as nesting, so a field is named with `__` (`fieldNameOf`).

A project's **Gallery** is not a form field: each add, move and remove saves at once through
`POST/PATCH/DELETE /admin/projects/:id/images…`, so it is a tab beside the form (`tabs`), open once the project is saved.

### How a registry screen works

A CMS resource screen is **a config file, not a page**. `config/admin/resources/<resource>.jsx` describes the
resource; `config/admin/resourceRegistry.js` lists the entries; two generic pages render any of them:

| Route | Page | Does |
|---|---|---|
| `/admin/content` | `routes/AdminLanding` → `ContentHome` | redirects to the first built Content item the role can open |
| `/admin/content/:resource` | `pages/admin/ResourceListPage.jsx` | CustomTable: the entry's columns + an **On site** switch, its filters, search, Edit / View on site / Hide·Show / Delete, bulk Delete, Reorder (when `sortable`), Trash with Restore (and Delete forever for `cms:purge`) |
| `/admin/content/:resource/new`, `/:id` | `pages/admin/ResourceEditPage.jsx` | ResourceForm with the entry's fields and schema, inside LocaleTabs when `translatable` is set; View on site and Delete in the header. A created record opens its own edit page, where the Nepali tab is enabled |

The routes sit under `RequireAuth capability="cms:read"`. Each page also checks the entry's own `capability`
through `hooks/useResourceEntry.js` (`{ status: 'ok' | 'unknown' | 'forbidden', entry, canWrite }`); an unknown
resource renders `NotFoundPage`. The route table never imports the registry — only these lazy pages do, which
keeps every entry's columns, fields and schema out of the marketing bundle.

An entry holds:

| Key | |
|---|---|
| `resource` | the URL segment, the API segment (`/admin/<resource>`) and the Cms tag id |
| `path` | the API collection path, always `/admin/<resource>` (the registry test checks it is mounted in the API's `cms.routes.js`) |
| `model` | the Prisma client model name for `/admin/translations` — `faq`, `processStep` — the name the public site's `withLocale` reads |
| `label`, `labelPlural`, `description` | copy for titles, buttons, toasts and confirmations |
| `capability`, `writeCapability` | to see the screens (`cms:read`); to change anything (default `cms:write`) |
| `columns`, `filters` | CustomTable columns and filters (the On site column is added by the page). A column's `capability` shows it only to its holders (the rate library's Cost and Margin, a trade's Day wage — `costs:read`) |
| `fields`, `schema`, `defaultValues` | ResourceForm fields, the zod schema from `form/schemas/cms.schema.js`, and a new record in API shape. `schema` may be a function of `{ pageSlugs }` when a rule needs the live site — a CMS link may point at a live page (`linkIssue`). Read it through `schemaOf(entry, ctx)`; the edit page passes the pages from `useSiteSettings` |
| `sortable` | offers Reorder. `false` when the site orders by another column (process steps order by `stepNo`) |
| `translatable` | field names edited on the Nepali tab (text fields only) |
| `titleOf(record)`, `publicHref(record)` | names a record; where it shows on the site, or `null` when it shows nowhere |
| `searchPlaceholder`, `emptyTitle`, `emptyDescription` | list copy |
| `basePath` | the screen's own address when it is not content (`/admin/rate-card`). It needs fixed routes in `AppRoutes` that pass `resource` to the generic pages, is unknown under `/admin/content/…`, and has its nav item in its own group. `screenPathOf(entry)` answers either way |
| `notice` | a standing note above the list — what else reads this data |
| `activeCopy` | words for `isActive` when it does not mean "on the website" (the rate card: **In use** / Retire). `activeCopyOf(entry)` fills in the defaults |
| `defaultSort` | the list's first order when it is not the manual one (posts: `-publishedAt`) |
| `reorderWithin`, `reorderHint` | Reorder only while that filter is set, and the reason shown beside the disabled button (list items: positions are per list) |
| `intro(record)` | read-only facts above an existing record's form (a project's source job number) |
| `tabs` | `[{ value, label, component }]` — panels beside the form on an existing record, rendered with `{ record, canWrite }` (a project's Gallery). Disabled on a new record |
| `historyCapability` | who sees the edit page's **History** tab (default `capability`; the rate card's is `quotations:history`). Every saved record gets the tab — `RecordHistory` on `<path>/:id/history`, which the API's CRUD factory mounts. `historyCapabilityOf(entry)` answers |
| `activeField` | the boolean the list's switch and Hide/Show act on (default `isActive`) — the API's `toggle` flips the same column. Technicians use `isAvailable` with their own `activeCopy`. `activeFieldOf(entry)` answers |
| `bulkActions` | extra actions on the selected rows: `[{ label, icon?, capability?, run(rows, { dispatch, confirm }) }]`. `run` may ask first and resolves the toast (`{ title, description?, variant? }`), or null when the answer was no; a rejection toasts the API's message. Not offered in Trash. The rate library's "Update to derived rate" is one |
| `rowActions(row)` | extra list actions: `[{ label, icon?, capability?, endpoint, arg, done }]` — `endpoint` is a `cmsApi` mutation (`approveTestimonial`), dispatched with `arg`; `done` is the success toast. Hidden without `capability`. The registry test checks each endpoint exists |

A role with `capability` but not `writeCapability` (SALES and ACCOUNTANT on the rate library) sees the list with disabled
switches and no New, and the edit page read-only (`ResourceForm readOnly`); `…/new` sends it back to the list.

Icons are picked, not typed: `resources/iconOptions.jsx` offers exactly `DataIcon`'s `ICON_NAMES`, each drawn.

### Worked example: adding a resource

`process-steps` was the second entry, added in one sitting with no page code:

1. **The schema** — make sure `form/schemas/cms.schema.js` has the resource's schema, mirroring the API's
   `shared/schemas/cms.js` (every CMS schema is already mirrored there).
2. **The entry** — `config/admin/resources/processSteps.jsx`:

   ```jsx
   export const processSteps = {
     resource: 'process-steps', path: '/admin/process-steps', model: 'processStep',
     label: 'Process step', labelPlural: 'Process steps',
     capability: 'cms:read', writeCapability: 'cms:write',
     schema: processStepSchema,
     sortable: false,                      // the site orders by stepNo
     translatable: ['title', 'description'],
     titleOf: (r) => r.title,
     publicHref: () => '/',
     columns: [{ key: 'stepNo', header: 'Step', sortable: true, cell: (r) => … }, …],
     fields: [
       { name: 'stepNo', type: 'number', label: 'Step number', required: true, min: 1, max: 50, span: 'half' },
       { name: 'title', type: 'text', label: 'Title', required: true },
       …
     ],
     defaultValues: { isActive: true },
   };
   ```
3. **Register it** — add it to the array in `config/admin/resourceRegistry.js`.
4. **Give it a nav item** — `{ to: '/admin/content/process-steps', label: 'Process steps', icon, capability: 'cms:read' }`
   in the Content group of `config/admin/adminNav.js` (or turn a `soon` item into a built one).
5. `npm test` — `resourceRegistry.test.js` fails until the path is mounted in the API, every field is in the schema,
   every translatable field is a text field, the nav item and the entry agree on the capability, a filter's
   `defaultValue` is one of its options, `reorderWithin` names a filter, and every `rowActions` endpoint is a `cmsApi`
   mutation. The test reads the resources the API mounts through `mountResource` in `cms.routes.js` and
   `ops.routes.js` (Phase H1; the mounter is `routes/admin/mountResource.js`) and `crm.routes.js` (Phase L2: the rate
   library and trades). Nothing is mounted by hand any more. Every field and column `capability` must be a real one, a
   `preview` field has a `component` and is not in the schema, and every `bulkActions` entry has a `run`.
6. When another screen reads the same data through its own endpoint, add its tag to `ALSO_READ_AS` in
   `api/cmsApi.js` (the rate card also invalidates the quotation builder's `RateCard` list; materials and trades refresh
   the rate library's out-of-date flags).

Check before step 2 how the **public site** reads the model: its order column (`sortable`), where a record shows
(`publicHref`), and whether the public query overlays translations (`withLocale`) — a Nepali tab the site never
reads is a trap for an editor.

## Quotations (Phase F2)

| Route | Page | Does |
|---|---|---|
| `/admin/quotations` | `QuotationsPage` | CustomTable under the API's `?stage=` tabs — Drafts · Needs approval · Ready to send · With customer · Customer asked for changes · Won · Declined/Expired · All. An approver opens on **Needs approval**; the count on that tab is theirs (`countCapability`), everyone else sees the tab without a number. A row's menu offers exactly what its state allows |
| `/admin/quotations/:id` | `QuotationBuilderPage/` | one version: the form (a draft only), the action bar, the notices, the totals, the customer link and its messages, the trail, and the History tab |
| `/quotation/:token` | `pages/public/QuotationPublicPage/` | the customer's page: the document, then **Accept · Ask for changes · Decline** (L4: decline offers reason chips) |
| `/admin/quotations/:id/print` | `pages/admin/QuotationPrintPage` (Phase L4) | the document on an A4 sheet, no app chrome — see "Quotations — terms and the customer document (Phase L4)" |

- **`helpers/quotationActions.js`** is the single table of what may be done: `quotationActions(quotation, { can, userId })`
  returns `[{ key, label, primary?, note?, disabledReason? }]`, and `waitingFor()` is the line under the title.
  Self-approval (`quotation.makerChecker`, sent by the API on the record) disables Approve and says why. The list,
  the builder and their tests all read this, and a unit test holds every action to `QUOTATION_TRANSITIONS`.
  `validityWarning()` flags a quotation the customer can still answer within `EXPIRY_WARN_DAYS` of its date (or past
  it), and `sentAge()` is the "Sent 5 days ago" follow-up cue — the list and the builder's notices both show them.
- **`hooks/useQuotationActions.jsx`** runs one: `const [runAction, actionDialogs] = useQuotationActions()`. Send back
  and pull back ask for a note (`FormDialog`), approve takes an optional remark, sending, revising and converting
  confirm first, and a revision opens its new version. A refusal toasts the API's reason.
- The builder is `ResourceForm` with a **`lineItems`** field (see the kit table; a BOQ since Phase L3 — see "Quotations — the
  BOQ builder (Phase L3)") plus a card group for the terms.
  It is `readOnly` unless the quotation is a DRAFT and the reader holds `quotations:write`; `onDirtyChange` holds
  the action bar while there are unsaved edits, because those buttons act on the **saved** record.
- `sections/`: `QuotationActionBar` (buttons, with the reason a disabled one is disabled), `QuotationNotices` (the
  customer's change request, what a revision answers, a send-back reason, an automatic approval, the self-approval
  rule), `SendPanel` (the public link, Copy, Open, and each SMS/email with its delivery state) and `VersionSwitcher`.
- The customer's page keeps **every word in one object**, `quotationPageCopy.js` — since Phase L4 `{ en, ne }` with `pageCopy(locale)`, both complete (a test compares their keys) — and
  decides what to show with the pure `quotationPageState.js` (open · accepted · changes · declined · expired ·
  replaced · replacedPending · closed) — both beside the page, both unit-tested. Its three buttons each open one
  confirm step: Accept repeats the total, Ask for changes takes a message (5–1000 characters), Decline offers reason
  chips (L4) and an optional note. No login, no code, no typed name (D4). It is checked at 360px in the end-to-end run.
- `api/quotationsApi.js` has the queues (`getQuotations`, `getQuotationStageCount`), the record, the draft save and
  the moves (`submit · approve · sendBack · pullBack · send · revise · convertToJob`). Every move invalidates the
  quotation, the list, `Dashboard`, `History` and `Notification`.
- `config/constants.js` mirrors the API's `QUOTATION_STATUSES`, `QUOTATION_TRANSITIONS`, the stage tabs and the
  status labels (the office's words, not the enum's); `crmMirror.test.js` fails if any of them drift.

## Quotations — the BOQ builder (Phase L3)

A quotation is a **bill of quantities**: one ordered list of ITEM, SECTION and NOTE rows (L-D1…L-D4 in ADMIN-PLAN §4).
Numbering (A, A.1) and section subtotals are computed, never stored; optional rows are shown, never totalled; a row priced
from the rate library carries its recipe as frozen when first saved.

**The builder** (`pages/admin/QuotationBuilderPage/`) — tabs in the URL (`?tab=`; the old `?tab=quotation` opens BOQ):

| Tab | Shows |
|---|---|
| **BOQ** | the `lineItems` grid, the discount (one amount) with its **helpers** — "%" and "target total" (`sections/DiscountHelper`, a `preview` field) ask the server's preview for the discount and fill the field — and VAT. On a DRAFT, **Reprice from the library** (`sections/RepriceButton`): `apply: false` → the before/after in a confirmation → `apply: true`; held while the form has edits |
| **Take-off** | `sections/TakeoffTab` — the saved rows' materials in **buying units** (packs × pack label), stock on hand and the shortfall, equipment and other, and the rows without a recipe; a Cost column only for `costs:read` |
| **Labour** | `sections/LabourTab` — man-days per trade, and a **crew size** per trade that shows the duration (days ÷ crew — quantity maths only, `helpers/boq.js#crewDuration`) |
| **Payment & terms** | Phase L4: **Contract** (contract type with the sentence the customer reads, duration in days, exclusions), **Payment schedule** (a `paymentSchedule` field with the server's stage amounts) and **Terms** (valid until, the **terms picker** `sections/TermsPicker`, the terms, the internal note) — another panel of the **same form**: one Save, and the panel not shown keeps its edits (`hidden` groups; a refused save opens the panel with the first error — `FIELD_TAB`) |
| **Customer view** | the form's third panel since L4 — **What the customer sees**: `showMeasurements`, `summaryOnly` — and under it `sections/CustomerViewTab`: the saved quotation through `components/documents/QuotationDocument`, exactly as the link shows it (the two switches apply before a save), in English or नेपाली (starting in the customer's language) |
| **History** | `RecordHistory` (`quotations:history`) |

The right rail: **Totals** (`sections/TotalsCard` — the server's live preview while the BOQ has edits, dimmed and `aria-busy`
while a newer answer is on its way, the saved figures otherwise; section subtotals and the optional total under it),
**Margin** (`sections/MarginCard` — cost total and margin, **only for `costs:read`**; unknown, never guessed, while a row has
no cost), **Send** (`SendPanel`) and **Trail** (`sections/TrailCard`). The header (L4): **Print** (a new tab on the print route)
and **Excel** (the `.xlsx`).

- **`useBoqFigures`** (beside the page) is the one source of amounts, totals and margin: nothing edited → the saved
  quotation's; edits → `helpers/boq.js#previewRequest(values)` (rows that cannot be priced yet are left out and counted)
  debounced to `POST /admin/quotations/preview`, each answer matched back to its rows by key
  (`serverFiguresByKey`). **The client adds up no money** — no amount, subtotal, VAT, discount or margin.
- The action bar's Submit says why it is disabled when the draft has no row that counts toward the total.
- `helpers/boq.js` — `boqNumbers`, `toBoqRows` / `boqRowBody`, `blankBoqRow`, `duplicateBoqRow` (a copy has no id, so the
  server prices it fresh), `isBlankBoqRow`, `previewRequest`, `serverFiguresByKey`, `libraryRow` (`kindForCategory`:
  "Labour" → LABOUR, else SERVICE), `surveyQuotationRows`, `crewDuration`. `helpers/measurements.js` — `parseLength`
  (feet-inches), `measurementRowValue` / `measurementTotal` (the API's `measurementQty`, as a preview), `measurementsBody`,
  `formatQty`.
- Schemas (`form/schemas/quotation.schema.js`): `boqRowSchema` / `boqRowsSchema` (a blank row is allowed and dropped, so an
  error's index is the grid's row), `measurementSheetSchema`, `boqRowDetailsSchema`, `newQuotationSchema(ctx)`.

**The New quotation sheet** (`components/quotations/NewQuotationSheet`) — opened from the quotations list ("New quotation"),
a lead (its "New quotation" button, the outcome "Interested — quote without a visit" and a drop on Quoted, through
`useLeadFollowUp`) and a customer's page. **Blank** creates an empty draft for the customer and site (for a lead that is not a
customer yet, blank is L1's convert with a draft — "same person / different person" and the site); **From a survey** lists
the customer's submitted and in-review surveys and opens the one picked, whose review page builds it; **Copy** posts
`/copy` (rows with their recipes as frozen, terms, discount, VAT) for this customer. Without `onCreated` it opens the new
draft; the lead page shows a convert's result, or opens a draft made for an existing customer.

**Survey → quotation** — `SurveyPricingTable` sends every line (`surveyQuotationRows`): kind, rate-card item, material,
the surveyor's quantity (`rawQty` — the server adds the wastage), wastage %, the note as the row's spec, the rate (rupees);
a line left out of the total — an optional one, by default — becomes an **optional row**, no longer dropped. The server
groups them into sections. Its amounts and subtotal come from the preview.

**The customer's page** renders `QuotationDocument` in the site's language: sections as numbered headings, notes as text,
a specification under its row, optional rows "not included in the total", provisional ones marked.

Tests: `components/common/EditableGrid/*.test.*` (the keyboard map, type-to-overwrite, Tab adding a row, sections spanning,
duplicate / move / remove / undo, paste — Indian grouping, `Rs`, text rows → sections, header detection — the library `/`,
read-only, 500 rows, the kit rule), `helpers/measurements.test.js` (feet-inches), the L3 block of `ResourceForm.test.jsx`
(`measurements`, `grid`), `RateLibraryScreens.test.jsx` (the recipe on the grid), `pages/admin/QuotationBuilder.test.jsx`
(tabs, numbering and figures, the margin rail hidden for SALES and shown for MANAGER, the recipe drawer per role, take-off
and labour, Customer view, terms, `/`, keyboard sections and paste, the measurement drawer, the discount helper, reprice),
`QuotationScreens.test.jsx` (the builder's approval loop on the grid), `components/quotations/NewQuotationSheet.test.jsx`
(the three paths, and from a customer), `SurveyReviewPage.test.jsx`, the BOQ block of `QuotationPublicPage.test.jsx`
(sections, notes, optional; Nepali), and `e2e/boq-flow.spec.js`.

## Quotations — terms and the customer document (Phase L4)

What a contract needs around the BOQ (L-D2, L-D3, L-D4 in ADMIN-PLAN §4), and the customer's document on the link, in
print and in Excel. **The client computes no money**: stage amounts, totals, section subtotals, the words and the margin
are the server's; BS dates come from the server (`dates.*Bs`); no cost key ever reaches a customer-facing screen or the
print.

**The customer's document** — `components/documents/QuotationDocument`, rendered by `/quotation/:token`, the builder's
Customer view and the print route, in this order:

| Part | From the API | Component |
|---|---|---|
| Letterhead: logo, company, tagline, address, phones (call links), email, **PAN/VAT No.** | `letterhead` | `DocumentLetterhead` |
| Number, "For …", status (not in print), version, **Date** and **Valid until**, each AD with its BS twin — "26 Sept 2026 (2083-06-10 B.S.)" | `createdAt`, `validUntil`, `dates.createdAtBs`, `dates.validUntilBs` | `DocumentHeader` + `DocumentDates` |
| The BOQ — sections numbered with subtotals, notes, specs, optional rows "Optional — not included in the total" — or, with `summaryOnly`, the **section summary** | `items`, `boq.sections` | `LineItemsTable` / `SectionSummaryTable` |
| Totals, the optional total apart (not in a summary) | `subtotal`, `discount`, `vatAmount`, `total`, `boq.optionalTotal` | `TotalsList` |
| **Amount in words**, in the page's language | `totalInWords.en` / `.ne` | — |
| **How the final bill is worked out** (the contract type's sentence), **Estimated duration**, **Not included in this price** | `contractType`, `estimatedDays`, `exclusions` | `ContractTerms` |
| **Payment schedule**: stage, when it falls due, share, amount (incl. VAT), and the total | `paymentStages[]` (`total`, `vat`) | `PaymentScheduleTable` |
| Terms | `terms` | — |
| **Measurements annex** — each measured row's sheet (where, nos × L × B × H, deductions, the line's quantity — quantity maths only) and its quantity in the bill; collapsed on the page, open in print; never with `summaryOnly` or `showMeasurements: false` | `items[].measurements` | `MeasurementsAnnex` |

Every word is in `quotationDocumentCopy.js` (the document) and `pages/public/QuotationPublicPage/quotationPageCopy.js`
(the answers, the decline reasons) as `{ en, ne }`; `quotationPageState.test.js` holds the two languages to the same keys.
Numbers stay in Latin digits. Everything works at 360 px: tables scroll inside their own box (the test checks every table
sits in an `overflow-x-auto`; the end-to-end run checks the page never scrolls sideways) and the BOQ says so on a phone
("Swipe the table sideways…", the description kept at least 9rem wide), the schedule is three columns with the trigger under
the label (left out when the label already says it), the letterhead's email takes its own line, and `DocumentShell` keeps
~300 px for the sheet on a phone.

**Decline reasons** — the decline dialog offers chips (a single-choice `ToggleGroup`, optional; a second tap takes it back)
for `DECLINE_CATEGORIES` (`config/constants.js` — PRICE "Too expensive", COMPETITOR, POSTPONED, BUDGET, OWN_LABOUR, OTHER; a
friendly subset of `LOST_CATEGORIES`, mirror-tested), sent as the decision's `category`. The office sees it on the builder
("The customer declined — Price too high"), and the "Mark lost?" notification links to `?markLost=1&category=PRICE`, which
`LeadDetailPage` turns into `changeStatus(lead, 'LOST', { lostCategory })` — the dialog starts on it; a person confirms.

**The print route** — `/admin/quotations/:id/print` (`pages/admin/QuotationPrintPage`, lazy, `quotations:read`, outside the
admin shell): a toolbar (`print:hidden` — Back, English / नेपाली starting in the customer's language, **Print** →
`window.print()`) over an A4 sheet (`.print-sheet.theme-light`) with the document in its print layout (`print`: no status
badge, the annex open, figures with their symbol). `styles/globals.css` holds `@media print` (A4, margins, rows never split)
and **`.theme-light`** — the light palette re-declared on an element, so the sheet is paper even in dark mode. The tab's
title (`QT-… v2 — customer`) is what the print dialog suggests as a file name. **No cost, even for a manager** (a test renders
a manager's record, cost and all, and finds none of it). J2's PDFs render this route.

**The builder (Payment & terms, Customer view)** — see the tab table in Phase L3's section. The contract type's description
is the customer's own sentence (`documentCopy('en').contract`, through the field's `adapt`); the schedule's amounts come from
`useBoqFigures().stages` — the saved stages, or the preview's for the schedule on screen (`helpers/boq#previewRequest` sends
`paymentStages` only when `helpers/paymentSchedule#validScheduleBody` says it is whole; `stages` is null — "—" — until then).
The **terms picker** (`sections/TermsPicker`, a `preview` field) lists the library's entries in use: **Use these terms**
(replaces — asked first when the text differs), **Add below**, and for a customer whose language is Nepali **Use the Nepali
text** where an entry has one. The header's **Excel** downloads `export.xlsx` (the BOQ with live formulas, measurements, the
schedule; a Cost sheet only for `costs:read` — the API's rule) as `QT-….xlsx`.

**The send panel** (`sections/SendPanel`) — Copy, Open, **WhatsApp** (`helpers/contact#whatsappShareHref`: a chat with the
customer's mobile, else WhatsApp's picker) and **Viber** (`viberShareHref`: `viber://forward?text=`), both carrying a short
message with the link in the customer's language; and **"Opened 2×"** with "First opened …" in Kathmandu time (`viewCount`,
`firstViewedAt` — the public GET stamps them), or "Not opened yet".

**The margin gate** (L-D4) — `ApproveQuotationDialog`: the approver (`costs:read`) sees the margin (`helpers/quotationActions#
marginOf` — the record's `margin` / `costComplete` / `costTotal`, or L3's `boq.cost`); an unknown cost asks for the
acknowledgement (a `checkbox` field) up front; a known margin below `quotation.minMarginPct` is the API's to judge — its 422
`LOW_MARGIN` (`details: { marginPct, minMarginPct, costComplete }`) shows its message and brings the box up, and the approval
is sent again with `acknowledgeLowMargin: true`. The quotations list gains a **Margin** column (`costs:read` only — "10% ·
Rs. …", or "Unknown").

**Parts**: `helpers/paymentSchedule.js` (`parsePct`, `basisPointsOf`, `formatShare`, `toStageRows` — stable keys —,
`stageBody` / `scheduleBody`, `scheduleTotal`, `presetRows`, `matchingPreset`, `validScheduleBody`), `helpers/download.js`
(`arrayBufferToBase64`, `downloadBase64`, `saveBlob`), `helpers/contact.js` (the two share links), `config/constants.js`
(`CONTRACT_TYPES` / `_LABELS`, `PAYMENT_TRIGGERS` / `_LABELS`, `PAYMENT_SCHEDULE_PRESETS`, `DECLINE_CATEGORIES`),
`form/schemas/quotation.schema.js` (`paymentStageRowSchema`, `paymentScheduleSchema`, the contract fields on
`quotationFormSchema`, `approveQuotationSchema(acknowledge)`, `changeRequestSchema(messages)` / `declineSchema(messages)` —
the customer's messages in their language — and `quotationTermsSchema`), `config/auditEvents.js` (`export.xlsx` "Quotation
exported to Excel").

Tests: the Phase L4 block of `QuotationPublicPage.test.jsx` (en and ne at 360 px — letterhead, AD+BS dates, sections, optional
rows and total, words, contract, duration, exclusions, the schedule's amounts, the annex; `summaryOnly`; the decline chips
sending the category, in both languages), `quotationPageState.test.js` (en/ne parity, decline words),
`helpers/paymentSchedule.test.js`, the L4 block of `ResourceForm.test.jsx` (`paymentSchedule`: 100 %, presets, basis points,
server amounts; `checkbox`), the L4 block of `QuotationBuilder.test.jsx` (contract sentence, schedule amounts from the saved
record then the preview, a preset re-asking the preview, a schedule short of 100 % never sent and stopping the save,
duration and exclusions saved, the terms picker in English and Nepali, Customer view switches with no cost for a manager,
"Opened 2×", the share links, Print and Excel), the margin-gate block of `QuotationScreens.test.jsx` (LOW_MARGIN → the
acknowledgement → sent again; unknown cost up front; the Margin column for MANAGER and not for SALES; the decline reason),
`QuotationPrintPage.test.jsx` (no cost key, `window.print()`), the terms library in `RateLibraryScreens.test.jsx`, the
`&category=` block in `LeadFollowUp.test.jsx`, `crmMirror.test.js` (contract types, triggers, presets, decline categories,
`export.xlsx`), `adminNav.test.js` (Terms library), and `e2e/boq-flow.spec.js`.

## Platform (Phase G)

Every screen here is ADMIN only: the routes sit under `RequireAuth roles={['ADMIN']}`, the nav items need
capabilities only ADMIN's `*` holds (`users:admin`, `audit:read`, `messages:admin`), and the API refuses every other role.

| Route | Page | Does |
|---|---|---|
| `/admin/platform/users` | `UsersPage` | CustomTable: role, status, **Locked** badge, last sign-in; role and status filters; New user / Edit in `UserFormSheet` (name, email, phone, role, can sign in — a new person gets a 72-hour invite email); row actions Edit · Sessions · Send reset link (confirmed; the toast names the address) · Unlock (only when locked) · Activity (the audit log for that user) · Switch off / on · Remove. The admin's own row cannot be switched off or removed, and their own sheet locks role and status. `?open=<id>` opens a person's sheet |
| `/admin/platform/roles` | `RolesPage` | the role → capability matrix from `helpers/capabilityMatrix.js`, which reads `helpers/permissions.js` (held to the API's by the parity test), plus the ADMIN-only capabilities `*` stands for. A fixed matrix, so a plain table |
| `/admin/platform/login-activity` | `LoginActivityPage` | "Needs attention" (locked now, or failures in 24 h — each with Unlock), then every `auth.*` event: the account (or the address typed for an unknown one), the reason and attempt, ip, browser; filters account, event, ip, date; a row opens like an audit row |
| `/admin/platform/audit` | `AuditLogPage` | CustomTable over `GET /admin/audit-logs`: event (grouped by prefix, with "Every … event" = `prefix.*`), record type (`/audit-logs/models`), staff member, done by, record id, request id, date. A row expands into `AuditRowDetails`; "Show everything from this request" sets `requestId` and sorts oldest first. The record column links through `helpers/recordLinks.js` |
| `/admin/platform/messages` | `MessageLogsPage` | every SMS and email: masked address, template, status chip with the error, what it was about (linked), the body when expanded; **Send again** for a failure — disabled for a message whose one-time link was redacted |
| `/admin/platform/message-templates` | `MessageTemplatesPage` | one row per key (`/groups`): who gets it and when (`config/admin/messageKeys.js`), and a chip per version — in use, switched off, not written |
| `/admin/platform/message-templates/:key` | `MessageTemplateEditPage/` | tabs SMS · English, SMS · नेपाली, Email · English, Email · नेपाली; the open tab only is mounted (one leave-guard). `sections/VariantEditor` is a `ResourceForm` (subject for email, message, in use; a version not written is created on save; Delete) beside `sections/PreviewPanel`: placeholder chips (a press copies `{{name}}`; a Nepali version also shows the English one's), an input per placeholder prefilled from `SAMPLE_VARS`, the API's rendering of the **unsaved** text (debounced), the empty ones, and for SMS `sections/SmsCounter`. `new` is a form for any key |
| `/reset-password` | `pages/public/ResetPasswordPage/` | where a reset or invite link lands: choose a password twice (the API's rule, mirrored in `auth.schema.js`), then sign in. No token → "open the link from your email". It never sends links itself, and neither does the login screen |

- **`helpers/auditDiff.js`** — `diffEntries(before, after)`: one line per changed field, walking nested objects to
  the field that moved (`translations.name.en`) and arrays of objects by position; an array of plain values, a value
  replaced by an object, or an added object is one line. `DIFF_KIND_STYLES` are the marks.
- **`helpers/contact.js`** — `whatsappHref(phone)`: a `wa.me/977…` link for a Nepali mobile, null for a landline.
  Used by the SLA board and the customer page.
- **`helpers/sms.js`** — `smsSegments(text)`: GSM-7 (160 / 153 a part, extension characters count twice) or Unicode
  (70 / 67, astral characters twice); Devanagari is always Unicode. `nonGsm` says why.
- **`helpers/recordLinks.js`** — `recordHref(row)`: an audit or message row's page (lead, customer, quotation, survey,
  job, user, settings, any registry entry by its Prisma model); a child row (note, site, quotation line, project picture,
  a job's assignment, task, photo, material or time log, Nepali copy) links to its parent; invoices have no page yet → null.
- **`config/admin/messageKeys.js`** — `MESSAGE_KEYS` (every key the API sends — a test scans its services),
  `SAMPLE_VARS`, `placeholdersIn` (the API's pattern — a test checks the source), `nestVars`, `TEMPLATE_VARIANTS`,
  `templateHref`.
- `config/auditEvents.js` also has `AUDIT_EVENT_GROUPS`, `auditEventOptions()` and `AUTH_EVENT_NAMES`;
  `config/constants.js` has `ROLE_DESCRIPTIONS`, `MESSAGE_CHANNELS`, `MESSAGE_STATUSES` (mirror-tested).
- Schemas: `form/schemas/user.schema.js` (no password), `messageTemplate.schema.js`, and `resetPasswordSchema` in
  `auth.schema.js`.
- Tests: `pages/admin/PlatformScreens.test.jsx` (every screen above, with Devanagari names, a Nepali SMS and a
  `+977` phone), the three helpers' tests, `capabilityMatrix.test.js`, `messageKeys.test.js`, and the History tab in
  `ResourcePages.test.jsx`.

## Operations (Phase H1)

| Route | Page | Does |
|---|---|---|
| `/admin/jobs` | `JobsPage` | CustomTable: number and title, customer (tap to call, area), status in the office's words (`JOB_STATUS_LABELS`) and priority, when, technicians. Filters status, type, priority, technician, customer, "Nobody on it", invoiced, scheduled dates; URL presets from `config/admin/jobViews.js` — Today, Unassigned, On hold, Completed not verified, Not invoiced; New job (`JobFormSheet`); a row's Schedule… / Assign… / Verify… |
| `/admin/jobs/:id` | `JobDetailPage/` | the action bar and eight tabs (`?tab=`): **Overview** (customer and site with tap-to-call and Maps, where it came from — lead, quotation, survey, rework, case study — when and who, the work, Edit details), **Checklist** (tick, skip, add, edit, remove), **Photos** (grouped by kind; add from the library or upload under a chosen kind), **Materials** (issue from stock with quantity, billed rate and billable; reverse), **Time** (logs; the office adds time for a technician on the job; delete), **Costing** (`GET …/costing`: labour, materials at cost, expenses, total, invoiced, margin, and the lines each total is the sum of — **only for `costs:read`** since Phase L2: the tab is not there for anyone else, and `?tab=costing` falls back to Overview), **Events** (JobStatusEvent, with a Maps link where the field app sent a location), **History** (`jobs:history`) |
| `/admin/dispatch` | `DispatchBoardPage/` | technicians × the day's hours (08–18) or × seven days; date, Day/Week, who, skill and area in the URL; the unassigned queue (`/dispatch/unassigned`, paged, searchable) and "Assigned, no time yet" beside it |
| `/admin/stock` | `StockPage` | balances from movements, Low — reorder, value at cost; "Low stock only" filter and the header's low count; a row opens its movements (`StockMovementsSheet`, also `?open=<id>` — the low-stock notification's link); **Record movement** (purchase, return, adjustment with a sign, wastage) |
| `/admin/technicians`, `/admin/job-templates`, `/admin/materials`, `/admin/material-categories`, `/admin/suppliers` | registry entries | see "Which screen is which" |

- **`helpers/jobActions.js`** — `jobActions(job, { can })`: what a job's state allows, and why a button is disabled
  (Complete while `openTasks(job)` is not empty, "Mark on the way" with nobody on it); a unit test holds every move to
  `JOB_TRANSITIONS`. Also `jobWaitingFor(job)` (the line under the title) and `siteMapHref(site)`.
- **`hooks/useJobActions.jsx`** — `const [runAction, dialogs] = useJobActions({ onDeleted })`: schedule, assign and
  complete open their dialogs; hold and cancel ask why (required), reopen asks optionally; verify and delete confirm;
  "Publish case study" drafts the project (title, name the customer — off) and opens `/admin/content/projects/:id`.
  Status moves go through `PATCH /status`, `complete`, `verify`, `schedule` and `assign` only — never an edit.
- **`helpers/dispatchBoard.js`** — the board without a DOM: Kathmandu days (`ktmDay`, `addDaysTo`,
  `shiftBoardDate`), hour columns, `durationOf`, `windowAt`, **`dropWindow(job, { day, hour? })`** (an hour cell starts
  it there; a day cell keeps its time of day, or 10:00; the length is kept), **`dropTechnicians(job, lane, fromLane)`**
  (from the queue the lane's person leads and the rest stay; lane to lane swaps the person; within a lane nothing
  changes), `isSameDrop`, `jobsInCell` (early and late jobs sit in the first and last hour), and
  **`scheduleWarnings({ job, window, technicianIds, lanes, days })`** — overlaps, days past `dailyCapacity`,
  unavailable people, and `unchecked` for a day the board is not showing; `warningText(w)` words each one.
- **`hooks/useScheduleCommit.jsx`** — the one way a screen schedules: `const [commit, dialog] = useScheduleCommit({
  lanes, days })`, then `await commit(job, { scheduledStart, scheduledEnd, technicianIds })`. It asks "Schedule …
  anyway?" with the warnings **before** sending, and toasts any the API found that the board could not see.
- **The board** (`DispatchBoardPage/`): `DispatchGrid` (a `role="grid"`; each cell a dnd-kit droppable named
  "Hari KC, Fri 18 Sept, 10:00"; the lane header shows load against the daily limit, unavailable and clashes),
  `DispatchJobCard` (drag handle + **Schedule…**, the keyboard and screen-reader path; work under way is not
  draggable; "Clash" on overlapping cards) and `UnassignedQueue`. Pointer-within collision like the pipeline; the
  keyboard sensor still works; auto-scroll only at the very edges, so a job dragged in from the queue does not scroll
  the hours away. **Every drag has the dialog as its equivalent** — the rule for any board.
- `api/jobsApi.js` — jobs, their parts, schedule (`{ job, warnings }`), the board, the queue, costing, publish, and the
  technician picker (`getDispatchTechnicians`, never a rate). A move invalidates the job, the lists, `Dispatch`,
  `Dashboard`, `History` and `Notification`; issuing material also `Stock`; anything with a cost the job's
  `costing:<id>` tag. `api/stockApi.js` — stock, movements, record. Registry writes to materials and technicians
  invalidate `Stock` / `Dispatch` through `cmsApi`'s `ALSO_READ_AS`.
- Schemas: `form/schemas/job.schema.js` (create, details, schedule, assign, notes, complete, task, material, time
  log, case-study start) and `ops.schema.js` (technician, template, material, category, supplier, stock movement)
  mirror the API's `shared/schemas/ops.js`.
- `config/constants.js` has `JOB_TRANSITIONS`, `JOB_STATUS_LABELS`, `JOB_TYPE_LABELS`, `JOB_PHOTO_KINDS`,
  `STOCK_MOVEMENT_TYPES` / `_LABELS`, `MANUAL_STOCK_MOVEMENTS` (mirror-tested); `config/admin/jobViews.js` the presets,
  the customer / technician / template / material relations and `technicianOption`;
  `config/admin/resources/inUseCopy.js` the "In use / Retire" words the operations entries share.
- Links: the customer page's Jobs tab, audit rows (`Job` and its parts, technicians, materials) and the dashboard's
  job and `stockLow` cards now open these screens.
- Tests: `pages/admin/OperationsScreens.test.jsx` (jobs presets, job actions and tabs with Devanagari and rupees, the
  board's dialog path through the clash warning, stock and Record movement, technician availability and the hidden
  rate), `helpers/dispatchBoard.test.js`, `helpers/jobActions.test.js`, and `e2e/operations-flow.spec.js`.

## Leads and customers (Phase E)

| Route | Page | Does |
|---|---|---|
| `/admin/leads` | `LeadsPage` | CustomTable opening on **My leads** (D6) with a one-click **All leads**; filters next action, status, priority, source, service, owner (with Unassigned), response state, requested visit, date; URL-saved views (the follow-up ones first: **Due today · Overdue · No next action**); a **Next action** column (sortable, `?sort=nextActionAt`) and an **"Nd in stage"** chip; New lead sheet; bulk Assign (one `bulk-assign` request) and Export selected; Export (filtered) |
| `/admin/leads/board` | `LeadBoardPage/` | the pipeline: a column per status (the list endpoint, 20 per column, "+N more" to the table); drag by the handle or use a card's "Move to" menu; only `LEAD_TRANSITIONS` drops are open (others dim); a move with work behind it opens that work (**Visit booked** → the visit booking, **Quoted** without a quotation → the new-quotation sheet, **Lost** → why) and the card moves only when it completes; a refused move goes back with a toast; cards show "Nd in stage"; pointer collision; no layout animation under reduced motion |
| `/admin/leads/:id` | `LeadDetailPage` | Edit, Change status (the board's rules: the visit and quotation dialogs), Assign, Convert (book the visit / without a visit), Delete; the **NextActionCard** above the tabs; Overview (request, the outcome composer and the timeline with each outcome, qualification, where it got to), Duplicates (merge), History (`leads:history`). `?markLost=1` opens Mark lost on load, then leaves the address |
| `/admin/reports/lost` | `LostReportPage` | `reports:sales` (nav: Sales › Lost leads). Why leads are lost: the count per category, then a CustomTable of category × the stage it was lost at × service with its share; a "Lost between" range in the URL (the last 90 Kathmandu days to start); Export. Phase I10 folds it into `/admin/reports` |
| `/admin/customers` | `CustomersPage` | CustomTable: sites, open jobs, language, balance due for `invoices:read`; type filter, a tag chip filters by tag; New customer sheet |
| `/admin/customers/:id` | `CustomerDetailPage/` | Profile form (read-only without `customers:write`), Sites (one primary; "use map pin"), Timeline, the record tabs a role may read (quotations link to their page; the rest say Soon), Statement (`reports:finance`), History (`customers:history`) |

Both converts ask **"same person / different person"** whenever an existing customer has the lead's phone
(`CustomerMatchChoice`); Book / Convert waits for the answer, and the lead's email reaches an existing customer only when
"Also save … on this customer" is ticked. The public contact form and booking wizard send an optional email and the
site's language (`uiSlice.locale`) as `preferredLocale`.

### Lead follow-through (Phase L1)

Every open lead has a next action and a clock. The API holds the rules (`lead.service#addActivity`); the screens show
them and refuse what the API would.

- **`components/leads/NextActionCard`** — at the top of the lead page: what is next, when (Kathmandu words — "Today,
  14:30", "Tomorrow, 10:00", "Mon 21 Sept, 10:00"), overdue set apart on the destructive surface **and** labelled
  "Overdue" with how late; "Due today" otherwise; contact attempts and days in stage. **Done** clears it (`at: null`),
  **Reschedule** is a `FormDialog` (time, type, note); an open lead with nothing next says so and offers "Set next
  action". Nothing for a won or lost lead.
- **The outcome composer** (`components/leads/ActivityComposer`) — a `ResourceForm` whose fields follow the pick
  (`config/admin/crmForms.js#activityFieldsFor`): for a contact on an open lead, **What came of it** (`LEAD_OUTCOMES`), then
  what that outcome needs — a time for "Call back at…" / "Not now" (the type defaults to the outcome's suggestion,
  `OUTCOME_NEXT_TYPE`), the lost category (+ words for "Other") for "Not interested", "next action or close" for "Wrong
  number", and "Set a different next action" for the rest (off: the API's default, in words). The summary may stay empty
  (the outcome's words are sent). `activityFormSchema` refuses what the API would answer 422 `NEXT_ACTION_REQUIRED`;
  `activityBody(values)` builds the request. After the save it opens the step the answer's `dialog` names — the visit
  booking or the new-quotation sheet — and calls `onLogged(activity, followUp)` once that is done or cancelled, so the SLA
  board's dialog stays up for it. A note, or a won / lost lead, has no outcome.
- **`hooks/useLeadFollowUp`** — `const [openFollowUp, dialogs] = useLeadFollowUp()`, then `await openFollowUp(lead,
  'visit' | 'quotation')` → the convert's result (or, since L3's New quotation sheet, `{ quotation }` for a lead that is
  already a customer), or null on Cancel. The quotation path toasts "Draft QT-… created — The
  lead moves to Quoted when the quotation is sent" (QUOTED means *sent*; drafting never moves the lead). The composer,
  the board and the lead page's status menu use it.
- **Board drops** — `helpers/leadBoard.js#dropDialogFor(to, hasQuotation(lead))`: `visit` for Visit booked, `quotation` for
  Quoted without a quotation (the board reads the lead's record when the row does not say), `lost` for Lost, null for a
  plain `PATCH /status`. The drop, the keyboard sensor and the "Move to" menu all run one `move`; the card stays put while a
  dialog is open and shows wherever the server lists it afterwards.
- **`components/leads/QualificationCard`** — property, floors, building age, budget band (a label, never money), who
  decides (including "Owner abroad"): what is known, and "Missing: budget, decision maker…" (`helpers/leadFollowUp.js#
  qualificationSummary`; land is not asked for floors or age). Edit is a `FormDialog` saving `qualification` through
  `PUT /admin/leads/:id` (null when emptied).
- **`components/leads/StageAgeChip`** — "4d in stage" / "In stage today" from `stageEnteredAt` (whole days, rounded down;
  amber from 3 days), on list rows, board cards and the NextActionCard.
- **Views** — `config/admin/leadViews.js`: Due today · Overdue · No next action → `?nextAction=due_today|overdue|none`.
  They are `keepView` presets: they narrow My leads or All leads, whichever is on, rather than switching to All — the
  morning digest's link (`/admin/leads?nextAction=due_today`) lands on the salesperson's own. `clearPreset` switches one
  off. The Filters panel has the same **Next action** filter.
- **Lost** — `LostReasonDialog` asks a category (`LOST_CATEGORIES`, required) beside the words; `useLeadStatusChange`
  sends `{ status: 'LOST', lostCategory, lostReason? }`. A declined or expired quotation's notification links to
  `/admin/leads/:id?markLost=1`, which opens it — a person decides; nothing is lost automatically. Since Phase L4 a decline
  carries the customer's reason as `&category=PRICE`, and the dialog starts on that category
  (`changeStatus(lead, 'LOST', { lostCategory })` → `LostReasonDialog defaultCategory`).
- `helpers/leadFollowUp.js` — `nextActionState` (none · overdue · today · later, "today" by Kathmandu's calendar),
  `formatWhen`, `lateBy`, `daysInStage`, `stageAgeLabel`, `isClosedLead`, `qualificationSummary`.
- Tests: `pages/admin/LeadFollowUp.test.jsx` (the card, the composer, the lost dialog, the views, `?markLost=1`, the
  qualification card, the status menu, the lost report — with Devanagari names and notes), the board's Phase L1 block in
  `LeadScreens.test.jsx`, `helpers/leadFollowUp.test.js`, `form/schemas/lead.schema.test.js`, and `crmMirror.test.js` for
  the new lists.

## The rate library and the money wall (Phase L2)

The rate card became the **rate library**: a selling rate per unit of work, and the **recipe** behind it (L-D1) — what
`recipeQty` units need in materials (with wastage), labour man-days by trade, equipment and other costs — plus overhead %,
profit % and a round-up. It is still one registry entry (`config/admin/resources/rateCard.jsx`, `/admin/rate-card`,
nav **Catalog › Rate library**) rendered by `ResourceListPage` / `ResourceEditPage`; **Trades & wages**
(`resources/trades.jsx`, `/admin/trades`) sits beside it. Both read with `rates:read` (SALES, MANAGER, ACCOUNTANT) and
write with `rates:write` (MANAGER); SALES no longer writes rates, because a recipe carries cost.

- **Rate set by** — *Typed by hand* (`MANUAL`: the rate is typed; a recipe, if any, only costs it for the margin) or
  *Worked out from the recipe* (`DERIVED`: the server sets the rate from the recipe on save; the Rate field is read-only,
  via `adapt`). The recipe is the `recipe` field; overhead %, profit % and "Round up to" are `nullable` (blank = the
  setting) and `capability: 'costs:read'`.
- **Out of date** — a new purchase rate or day wage never moves a rate. The row's `outOfDate` / `derivedRate` (a selling
  rate, so every reader sees it) show as the **Price check** column ("Out of date — Recipe gives Rs. …") and, on the
  record, as `RateLibraryIntro`. A rate changes only by a save or by the bulk action **Update to derived rate**
  (`rates:write`): `POST /reprice { ids, apply: false }` → the before/after in a confirmation (`RepricePreview`) →
  `{ ids: <exactly those shown>, apply: true }`.
- **Cost vs rate** — the edit form's `preview` field (`components/rateLibrary/RateCostCard`), shown with `costs:read`:
  once every recipe line is complete it sends the recipe as typed (`helpers/recipe.js#deriveRequest`, debounced) to
  `POST /admin/rate-card/derive` and shows the server's material, labour, equipment, other, overhead and unit cost, the
  derived rate, and the margin at the rate now (and at the derived rate). A line with no price yet is named, and there is
  no derived rate until every line is priced.
- **Columns** — Code, Work, Rate, Set by, Price check; **Cost** and **Margin %** only with `costs:read` (column `capability`).

**The money wall on the client.** The API is the wall: it strips cost keys (`cost`, `unitCost`, `lineCost`,
`costBreakdown`, `margin`, `overheadPct`, `profitPct`, `purchaseRate`, `dayWage`, …) for anyone without `costs:read`,
masks them in History, and answers 403 to job costing and the job-margin report. The client follows two rules:

1. **Never compute cost or margin.** A recipe is priced by the server (`/derive`, and the rows it lists), and `/derive`
   also answers the margin at the form's rate and at the derived rate — for exactly the recipe on screen.
2. **Show cost only behind `costs:read`** — a column's or field's `capability`, the recipe field's `costCapability`, the
   job page's Costing tab. A screen never relies on a key simply being absent.

Parts: `helpers/recipe.js` (API components ⇄ form rows, `recipeBody`, `deriveRequest`), `api/rateLibraryApi.js`,
`form/schemas/rateCard.schema.js` (`rateCardItemSchema` — a typed rate needs its rate, a derived one its recipe —
`recipeComponentSchema`, `tradeSchema`), `config/constants.js` (`UNITS` with the metric and pack units, `RATE_MODES`,
`RECIPE_COMPONENT_KINDS`, each with labels), and `helpers/capabilityMatrix.js#CAPABILITY_DESCRIPTIONS` (the Roles &
permissions matrix words `costs:read`, `rates:read`, `rates:write` and `jobs:advance-override` in full). Materials gained
**pack size** and **pack** (`bag = 50 kg`), shown on the list and beside a recipe's material.

Tests: `pages/admin/RateLibraryScreens.test.jsx` (the list per role, the out-of-date badge, the bulk reprice — preview,
confirm, apply, decline, nothing to do — the form for MANAGER and for SALES, a recipe created end to end in rupees, the
rules, trades' wage, materials' pack), `helpers/recipe.test.js`, the L2 block in `ResourceForm.test.jsx` (`adapt`,
`nullable`, `preview`), the Costing tab per role in `OperationsScreens.test.jsx`, and `crmMirror.test.js` (units, rate
modes, recipe kinds, the permission map and who holds each new capability).

## The admin shell

`components/layout/AdminLayout/` renders `config/admin/adminNav.js`, which is pure data and pure functions (tested
without a DOM in `adminNav.test.js`):

- **`ADMIN_NAV`** — eleven groups, each in one of the sidebar's four **`NAV_TABS`**:
  **Home** (Overview · Sales · Operations · Finance · Aftercare — the daily work), **Helpers** (Catalog — rate card,
  job templates, materials, material categories, suppliers · Page blocks · Messaging — message templates),
  **Others** (Content · Blog & pages — the website) and **Settings** (Platform). The content groups all point under
  `/admin/content/…` and need `cms:read`; Page blocks holds the pieces the home page's bands are made of (features,
  list items, content blocks, process steps). Platform holds Users, Roles & permissions, Login activity, Audit log and
  Messages (ADMIN only — Phase G) and Settings (`/admin/platform/settings`, `settings:read`). A group moves tab by
  changing its `tab`. An item is `{ to, label, icon, capability?, end?, soon? }`; `soon` renders greyed with a "Soon" tag,
  never as a link.
- **`navTabsForRole(role)`** / **`activeNavTab(pathname)`** — the tabs a role sees (an empty one is dropped) and
  the tab a path belongs to; the sidebar follows the page, and clicking a tab only changes what it lists.
- **`navForRole(role)`** — the items the role's capabilities allow, empty groups dropped. The same map the API
  enforces (`helpers/permissions.js`); the nav only hides, the API refuses.
- **`landingPathFor(role)`** — where `/admin` sends a role. An EDITOR lands on Content (`/admin/content` →
  Home page), and the Dashboard item is hidden from a role that lands elsewhere. `routes/AdminLanding.jsx` does the redirect.
- **`contentHomeFor(role)`** — the first built Content screen the role can open.
- **`breadcrumbsFor(pathname)`** — group › screen › New / Edit / Details, from the nav (Edit for any screen under
  `/admin/content/`, Details elsewhere; an item's `editLabel` overrides the last word — the rate card says Edit although
  it is in Sales); `AdminBreadcrumb` shows it
  in the header, so no page sets its own.

- **`activeNavPath(pathname)`** — the item a path belongs to, by the same longest match as the breadcrumbs, so
  `/admin/leads/board` lights Pipeline and not Leads. The sidebar uses it instead of `NavLink`'s own matching.
- An item's **`badge`** names a live count (`slaBreached` on the SLA board: leads past their deadline). `hooks/useNavBadges`
  polls it at `SHELL_POLL_MS` (one minute), only for a role that can open the screen.

The shell around the nav:

- **Sidebar** (`AdminSidebar`) — an ink panel: brand, the four tabs as a segmented control (a red dot on a tab hides
  an SLA breach), "Find a screen" (matches across every tab), folding groups (remembered per browser) and the
  signed-in user. On desktop it folds to an icon rail (`uiSlice.sidebarOpen`, remembered per browser); on a phone it
  is the drawer (`uiSlice.mobileNavOpen`).
- **Top bar** — the breadcrumb (the screen's name on a phone), the search button, Kathmandu time, the bell, the
  theme toggle and the account menu.
- **Command palette** (`CommandPalette`, `hooks/usePaletteHotkey`) — Ctrl/⌘+K anywhere: every screen the role can
  open, your shortcuts, your notes, and shell actions (theme, sidebar, sign out). `uiSlice.commandOpen`.
- **Shortcuts strip** (`ShortcutBar`) — the user's pinned screens (up to 12), a star that pins the page on screen
  (name and icon from `config/admin/shortcuts.js`'s `suggestShortcut`, editable) or unpins it, and a manager to
  rename, re-icon, drag-reorder and remove them. Stored per user by the API (`/admin/me/shortcuts`, `api/meApi.js`),
  so they follow the user between devices; icons are stored by name from `SHORTCUT_ICONS`.
- **Notes** (`NotesSheet`) — private sticky notes (`/admin/me/notes`), five colours (`--note-*` tokens), pinned
  first, edited in place, searchable once there are a few. `uiSlice.notesOpen`.

The sidebar's brand comes from `useSiteSettings` (the company name in settings). The bell is `NotificationPanel`:
the unread count polls every `SHELL_POLL_MS` (the dashboard refreshes on the same beat); the list loads when the panel
opens; opening an item marks it read and navigates to `notificationHref(link)`; "Mark all as read" clears the badge.
Since Phase E the API writes every staff link as an `/admin/...` path (`/tech/...` for field staff);
`notificationHref` still reads the older `/leads/:id` and absolute forms, which remain in the database. A query string is
kept: Phase L1's reminders open `/admin/leads/:id?markLost=1` and `/admin/leads?nextAction=due_today|overdue`.

## three/

Both kinds of motion, in one place.

- `three/motion/motionKit.jsx` — Framer Motion primitives (`Reveal`, `Stagger`, `Tilt`, `Magnetic`,
  `Marquee`, `CountUp`, `WordReveal`, `ScrollStage`…). Every one of them respects
  `prefers-reduced-motion`; use `useMotionVariants` when you add another.
- `three/scenes/` — WebGL. `BlueprintScene` is ~120 kB gzipped of three.js, so scenes
  are **always** `lazy()`-imported at the call site and never re-exported through a
  barrel — that is what keeps them out of the initial bundle.

A scene becomes a folder on the same rule a page does. `SectionCutScene/` is split by
the question each file answers, which is what keeps a 1,000-line procedural model
readable:

```
SectionCutScene/
├── SectionCutScene.jsx  the browser end: renderer, camera rig, observers, caption
├── constants.js         the drawing, in metres
├── profiles.js          the turned profiles and the drilled cement board
├── model.js             builds it — geometry, materials, lights, the whole graph
├── palette.js           CSS variables → materials and lights, re-read on theme change
├── timeline.js          what the scene is doing at time t — pure, touches no graph
├── pose.js              applies a pose to the graph — the only writer
├── easing.js            the four curves the timeline is written with
└── rooms.js             the five fit-outs the model cycles through
```

`timeline.js` and `pose.js` are the split that matters: because a pose is a plain
object and only `applyPose` writes to three, the reduced-motion still frame is a
composition no moment on the timeline produces, and a resize or a theme change
re-applies the last pose instead of guessing a time. Everything but the entry file
runs without a DOM, so the model can be built and driven in a plain node script.

## pages/

`public/` (landing, services, pricing, projects, booking, the token-addressed
quotation/invoice/warranty views, **and login**), `admin/`, `tech/`. Every page is
`lazy()`-loaded from `routes/`, so the marketing site never downloads the back office.

`admin/` has two folder pages since Phase E: `LeadBoardPage/` (the page, `BoardColumn` — one status, its own query and
drop target — and `BoardCard` with its "Move to" menu) and `CustomerDetailPage/` (the page and `sections/`: sites,
timeline, the record tabs, statement).

A page is one file until it stops being readable as one. When it grows past that,
it becomes a **folder of the same name**, and the whole public site is now built
that way:

```
public/
├── HomePage/            hero, promise strip, and every CMS-driven band
├── ServicesPage/        the catalogue: toolbar + grid, sorting in servicesSort.js
├── ServiceDetailPage/   masthead, body, FAQs, related work, the enquiry panel
├── PricingPage/         the estimator column, the packages, the rate card
├── ProjectsPage/        filter + grid
├── ProjectDetailPage/   facts, the problem→work→result story, gallery, CTA
├── ContactPage/         the form, the direct lines, the map
├── BlogPage/            /blog: category chips (in the URL) + the post grid
├── BlogPostPage/        /blog/:slug: header, article, CTA; postSeo.js is its Article JSON-LD
├── GenericPage/         /:slug: an editor's page (About…); a 404 renders NotFoundPage
├── LoginPage/           the WebGL stage, the form, and useLoginFlow beside them
├── QuotationPublicPage/ }
├── InvoicePublicPage/   } token-addressed, all three built from components/documents/
├── WarrantyPublicPage/  }
└── BookingPage.jsx      still one file, because it still reads as one
```

Each folder holds the same four kinds of thing, and nothing else:

```
ServiceDetailPage/
├── ServiceDetailPage.jsx  the route target: fetch, the three states, the order
│                          of the bands — and no markup of its own
├── serviceSeo.js          pure logic this page needs (here, its JSON-LD)
├── useLoginFlow.js        …or a hook, where the behaviour is stateful (LoginPage)
└── sections/              one file per band, named for what it renders
```

The entry file repeats the folder name — `@/pages/public/HomePage/HomePage` — so the
editor tab says which page you are in. Everything in the folder is private to that
page; the moment a second page needs one of these components it moves to
`components/`, by the rule above. The chunk is named from the file, so the bundle
report stays legible without help from `vite.config.js`.

A section file renders one band and owns no fetching. If it needs data it takes a
prop, which is what keeps the page's own file a readable table of contents.

## routes/ and providers/

`routes/AppRoutes.jsx` is the whole route table; `routes/RequireAuth.jsx` gates by role or
capability. The router is a **data router** (`createBrowserRouter` in `AppProviders`, one splat route
around `<AppRoutes>`), because `useBlocker` — the unsaved-changes guard — only works in one. The
route table itself is still plain `<Routes>`. `routes/AdminLanding.jsx` holds the two redirects of the admin
shell (`/admin` per role, `/admin/content` to the first content screen). `providers/AppProviders` composes store → router → theme → tooltips →
scroll and session effects, so `main.jsx` stays a mount point.

Render errors are caught in `components/common/ErrorBoundary/` at three levels: `PageOutlet` wraps each page in a
`RouteErrorBoundary` (the shell stays up, and any navigation clears it); `RouterShell` wraps the route table in
another, and the splat route's `errorElement` (`RouterErrorElement`) replaces React Router's bare error screen; an
outer `ErrorBoundary` around the store and router catches the rest. The fallback shows the stack, the component stack,
a copy button and a Vite open-in-editor link in development only, and a "reload" prompt for a stale lazy chunk.
A query error is not a render error — that stays `ErrorState`'s job.

The public group ends with **`/:slug`** (`GenericPage`, an editor's page). Static routes outrank a dynamic one, so
`/login`, `/admin` and every fixed public page win; the page form refuses those addresses (`RESERVED_SLUGS`). The
catch-all `*` still handles deeper unknown paths.

`providers/SessionEffect` restores the session once per page load: the refresh token rotates on each use, and React's
StrictMode runs the effect twice in development, so the two runs share one in-flight request (a second request with
the same cookie is refused, and its 401 used to sign the user out).

### The theme

Colour mode is the one piece of UI state with a context of its own, because two
different values are wanted in two different places:

| | | |
|---|---|---|
| `mode` | `'light' \| 'dark' \| 'system'` | what the user chose. Persisted in `uiSlice`. |
| `theme` | `'light' \| 'dark'` | what that resolves to right now. Derived, never stored. |

A control that *changes* the palette needs `mode` — a three-way switch showing
"light" for a system preference that merely happens to be light today is wrong. An
icon or a WebGL palette that *reflects* it needs `theme`. Deriving both in every
consumer is how the header and the login screen drifted apart, so it is derived
once in `providers/ThemeProvider.jsx` and read through `hooks/useTheme.js`.

The provider is also the only thing that touches `document.documentElement` for
colour: the `dark` class, `color-scheme`, `data-theme`, `<meta name="theme-color">`,
one frame of suppressed transitions during a swap, and the `storage` listener that
keeps two open tabs agreeing. `config/theme.js` holds the vocabulary — the modes,
the storage key, the resolver, the two chrome colours.

The first paint happens before React exists, so `index.html` carries a small inline
script that answers the same question the same way. It and `config/theme.js` are a
deliberate copy of one rule; change them together.

## redux/

`store.js` is the store. `slices/` holds UI state only — **server state belongs in
`api/`**, never mirrored into a slice.

## form/

`schemas/fields.js` holds field-level building blocks (`nepaliPhone` — a mobile or a landline with its area code —
`optionalPhone`, `optionalEmail` — trimmed and lower-cased, as the API stores it — `preferredLocale`, `personName`,
`rupees`); the `*.schema.js` files compose them. `lead.schema.js` has the public form (with an optional email), the
staff lead (`adminLeadSchema`), the lost reason (category + words), the activity — `leadActivitySchema` (the API body)
and `activityFormSchema` (the composer's flat values), both checked by `leadOutcomeIssues`, the API's outcome rules —
`activityBody`, `nextActionSchema`, `qualificationSchema` and the convert site (`lead.schema.test.js`); `customer.schema.js` has the
customer and site and `parseMapPin`. `contactFields.test.js` covers mobile, landline and invalid numbers on every
contact form, email normalisation and Devanagari names. These mirror the backend's zod
schemas — when an API rule changes, change it here in the same commit. `cms.schema.js` mirrors the
whole of the API's `shared/schemas/cms.js`, one schema per CMS resource, for the registry entries, plus
`mediaUpdateSchema` and `mediaFolderSchema`; `rateCard.schema.js` mirrors `rateCardItemSchema`, `recipeComponent` and
`tradeSchema` from the API's `shared/schemas/crm.js` (Phase L2). `cms.schema.test.js` runs the API's own service cases
(`MaintainanceBackend/tests/fixtures/serviceSchemaCases.js`) against the mirror, and checks `UNITS` against the
API's `shared/enums.js` — the one test import that is a relative path, because the fixture is outside `src/`.
There is no `formKit.js`-style barrel for it: import the schema you need.

`useZodForm(schema, options)` is the only place `zodResolver` is imported.

## config/ vs helpers/

`config/` is data that describes the system: `constants.js` (enums mirroring the
backend — including `LEAD_TRANSITIONS`, the lead state machine the status menu and the board offer, the loggable
activity types, and Phase L1's `LEAD_OUTCOMES` / `REACHED_OUTCOMES`, `NEXT_ACTION_TYPES`, `LOST_CATEGORIES`,
`PROPERTY_TYPES`, `BUDGET_BANDS` and `DECISION_MAKERS`, each with its `*_LABELS`; `config/crmMirror.test.js` imports the
API's own files and fails when they drift or a value has no words — plus
`SHELL_POLL_MS` and status→Tailwind maps), `auditEvents.js` (every `AUDIT_EVENTS` name in words, for History; the same
test checks the list), `env.js` (the single place `import.meta.env` is read),
`locale.js` (timezone, currency, the Nepali phone rule), `theme.js` (the colour
modes and how one resolves), and `site/` — the storefront's own copy: `siteNav.js`
(the nav — `siteNavFor(nav)` adds Blog while `bootstrap.nav.blog` is true — the paths a CMS link is validated
against, and `RESERVED_SLUGS`, the first segments a generic page may not use), `promises.js` (free
inspection / 2-hour response / 1-month warranty, in one place), `company.js` (the
settings keys, and what the header shows before `/public/bootstrap` answers). `admin/` is the back
office's own: `adminNav.js` (the grouped nav, landing, breadcrumbs, `BESPOKE_CONTENT`), `resourceRegistry.js` and
`resources/` (one entry per CMS resource — see "The resource registry"), `crmForms.js` (the lead, customer, site,
activity, lost-reason, assign and convert forms as `ResourceForm` fields, and the assignee and service relations; since
Phase L1 `activityFieldsFor(pick)` — the outcome composer's fields for what is picked — `OUTCOME_DEFAULT_NEXT`,
`nextActionFormFields` and `qualificationFields`),
`leadViews.js` (My leads / All leads → the API's `assignedToId=me`, and the URL-saved presets: Due today, Overdue, No
next action (`keepView` — see "Lead follow-through (Phase L1)"), Breached, Unassigned,
Bookings this week — the Kathmandu week starts on Sunday), `customerTabs.jsx` (the customer page's record tabs: columns,
links, and which role may see each), `homeSections.js` (what each home
section shows, where its content is edited, which ones take a `limit`, and `toSectionItems`), and `settingsForm.js`
(the settings screen as data — see "Which screen is which").

`helpers/` is behaviour with no state (Phase L4 added `paymentSchedule.js` and `download.js` — see "Quotations — terms and
the customer document (Phase L4)"; Phase L3 added `boq.js` and `measurements.js` — see "Quotations — the BOQ builder
(Phase L3)"; Phase L2 added `recipe.js` — see "The rate library and the money wall"; Phase H1 added `jobActions.js` and `dispatchBoard.js` — see "Operations
(Phase H1)" — and `formatMinutes` in `format.js`; Phase G added `auditDiff.js`, `sms.js`, `recordLinks.js` and
`capabilityMatrix.js` — see "Platform (Phase G)"): `format.js` (money — `rupeesToPaisa`, `parseRupees`,
`formatRupees` — dates, Kathmandu time and `toKathmanduParts` / `fromKathmanduParts` for inputs),
`slug.js` (a copy of the API's `slugify` — change both together), `prose.js` (`splitParagraphs`),
`links.js` (`siteHref` — an editor's typo must not become a dead CTA; a live page counts when its slug is passed —
and `linkIssue`, the admin forms' check), `schedule.js` (`offerWindow` — live / scheduled / ended — and
`publishState` — draft / scheduled / published — worded by Kathmandu calendar day),
`permissions.js` (`can(role, capability)` — navigation only; the API is the authority; the parity test holds it to
the API's map), `leadBoard.js` (`nextStatuses`, `canDrop`, `dropDialogFor` and `hasQuotation` — which moves open a dialog —
`cardsForColumn`, `columnTableHref`, `responseResult` — "Responded in 34 min — within the promise"), `leadFollowUp.js`
(Phase L1: next action state, Kathmandu "when" words, days in stage, qualification summary), `history.js` (`describeHistoryEntry`, `diffRows`, `foldHistory`),
`customerMatch.js` (convert's customer decision: `initialChoice`, `choiceBody`, `emailDiffers`), `leadDisplay.js`
(`describeEstimate` — a website estimate as sentences — and `mergePreview`),
`utils.js` (`cn`), `offlineQueue.js` (IndexedDB queue for the field app), `mediaFolders.js`
(`flattenFolderTree`), `overlay.js` (`ignoreToastInteraction`). `format.js` also has `formatBytes`.

`config/`, `helpers/` and `hooks/` have no barrel files (`config.js`, `helpers.js` and `hooks.js` had no importers
and were removed in C2) — import the module itself.

`hooks/` also holds the admin kit's behaviour: `useJobActions` and `useScheduleCommit` (Phase H1), `useConfirm`, `useUnsavedChangesGuard`,
`useDebouncedValue`, `useListParams` (whose `defaults` are compared by value), `useLeadStatusChange` (the one way a
screen moves a lead: `const [changeStatus, dialog] = useLeadStatusChange()`; LOST asks why first — a category and the
words; resolves false when refused or cancelled, so the board can put a card back), `useLeadFollowUp` (Phase L1: opens the
visit booking or the new-quotation sheet and resolves with the result, or null on Cancel), `useNavBadges`, and `useResourceEntry`
(the registry entry behind `/admin/content/:resource` — or a fixed route's `resource` — with the capability check).

`hooks/useSiteSettings.js` sits between the two: it reads the cached bootstrap
query once and hands back the company's name, numbers and address with the
fallbacks already applied, so no component writes
`settings['contact.phonePrimary'] ?? '01-5407720'` a sixth time. It also hands back `nav` (the site nav for what the
site has now) and `pageSlugs` (the live generic pages), which `Cta` and the admin link checks use.

## Tests

`npm test` (Vitest, jsdom) and `npm run test:e2e` (Playwright — `e2e/`, see the README). A test sits **beside the file it tests** as `*.test.js(x)`; the end-to-end suite is the exception, because it drives both apps at once rather than one module. `src/test/` holds
only the harness: `setup.js` (jest-dom matchers, browser API stubs — `ResizeObserver`, `IntersectionObserver`,
`matchMedia`…), `renderWithProviders.jsx` (a fresh store and a memory data router, plus `signedInAs(role)`) and
`mockApi.js` (`mockApi(handler)` stubs `fetch` and returns the calls as `{ method, path, query, body }`; `json`,
`page`, `notFound` build responses — the screen tests since D2 use it). A toast is asserted in the store
(`store.getState().ui.toasts`), since no Toaster is rendered. Money, phone numbers and Devanagari are tested on
every new form.

## Rules

1. **Money is integer paisa.** Only `helpers/format.js` converts it for display.
2. **Server state is RTK Query.** No react-query, no Context for server data.
3. **Add shadcn components with the CLI**, never by hand-copying.
4. New admin screens are built from the admin kit — `CustomTable` and `ResourceForm`
   in `components/common/`. Do not hand-roll another table or form. A CMS resource screen is
   a **registry entry** in `config/admin/resources/`, never a page of its own — the exceptions are
   screens that are not a list and a form (the home composer, the media library, the site settings; see the table
   above) — and those are still built from the kit.
5. Colours come from the CSS variables in `styles/globals.css`. No hardcoded hex,
   and no raw Tailwind palette either — `bg-emerald-50 dark:bg-emerald-950` is a
   fourth palette that no theme switch can follow. Use the semantic tokens:
   `surface-success`, `surface-warning`, `surface-info`, `text-success`,
   `text-warning`, and `destructive` for danger.
6. Imports use the `@/` alias. No `../../..`.
7. **No file is called `index`.** Every module is named for what it holds —
   `apiCore.js`, `AppRoutes.jsx`, `store.js`, `HomePage.jsx`. A folder's entry file
   repeats the folder name rather than hiding behind `index`, so an editor tab and a
   stack trace both name the thing you are looking at. Import the file, not the
   folder: `@/redux/store`, never `@/redux`.
8. **Cost is the server's.** The client never works out a cost; it shows one only behind `costs:read` (a field's,
   column's or tab's capability), even though the API already strips it for everyone else. See "The rate library and the
   money wall (Phase L2)". Since Phase L3 the same holds for every amount on a quotation: totals, section subtotals,
   discounts from % or a target, and margins come from the server's preview; since Phase L4 also each payment stage's
   amount and the total in words. A customer-facing screen and the print never show a cost key, even to a manager.
9. **EditableGrid is reached only through ResourceForm field types** (`lineItems`, `grid`, `measurements`, `recipe`,
   `paymentSchedule`) —
   never imported by a page or a registry entry. Every drag has a keyboard equivalent.
