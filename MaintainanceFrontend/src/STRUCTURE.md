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

e2e/                The Playwright suite: the quotation loop end to end (Phase F2).
├── quotation-flow.spec.js
├── global-setup.js     migrates and seeds the *_test database
└── support/            e2eEnv.js (ports, database, the API's environment), api.js (HTTP + signIn)
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
Devanagari.

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
- `dashboardApi.js` also holds **`getBreachedLeadCount`** (the SLA nav badge): the shell loads that file, and a count must
  not pull `leadsApi` into the main bundle.

## components/

| Folder | Holds |
|---|---|
| `ui/` | shadcn primitives. Generated by `npx shadcn@latest add <name>`, then edited freely — they are our source, not a dependency. |
| `common/` | Cross-cutting app furniture: `PageHeader`, `EmptyState`, `ErrorState`, `SlaChip`, `Toaster`, `LocaleSwitch`, `StateBadge` (a record's state on the semantic surfaces — Live, Draft, Waiting) — and the **admin kit**: `DataTable/`, `ResourceForm/`, `MediaPicker/`, `LocaleTabs`, `ConfirmDialog`, `RecordCombobox`, `FormDialog`, `RecordHistory`. See "The admin kit" below. |
| `theme/` | The colour-mode controls: `ThemeToggle` (one button) and `ThemeModeSwitch` (all three modes). Both read the theme context; neither takes state as a prop. |
| `layout/` | The three shells — `SiteLayout`, `AdminLayout/`, `TechLayout` — plus what the public one is made of: `SiteHeader/`, `SiteFooter`, `MobileCallBar`. |
| `site/` | Marketing presentation, **one component per file**: `ServiceCard`, `ProjectCard`, `CategoryTile`, `PageHero`, `SectionShell`, `SectionHeading`, `Media`, `Breadcrumb`, `PromiseList`, `FaqList`, `FilterChip`, `PriceTag`, `Cta`, `Eyebrow`, `Stars`, `DataIcon`, `ProseBody` (long CMS copy — shared with the admin's prose preview). |
| `documents/` | The customer-facing sheet a token link opens: `DocumentShell`, `DocumentHeader`, `LineItemsTable`, `TotalsList`, `DocumentNotice`. Shared by the quotation, invoice and warranty pages. |
| `media/` | The media library screen's own parts: `MediaFolderTree` (folders as an indented tree) and `MediaDetailsSheet` (one file's facts, URL and alt/caption/folder form — a `ResourceForm` sheet) — and `MediaCell`, a list column's thumbnail of one media id (the gallery, features). |
| `projects/` | `ProjectGalleryTab` — the Gallery tab of a project's edit page (add from the library or upload, drag or Move earlier/later, remove; each change saves at once through the project image endpoints) — and `ProjectName`, a project's title from its id for a list column. |
| `homeComposer/` | `HomeSectionList` — the home page composer's sortable section rows (drag handle, Move up / down, visibility, item limit). |
| `leads/` | The lead screens' parts: `LeadFormSheet` (new / edit), `AssignLeadDialog` (one lead or a selection), `LostReasonDialog`, `LeadStatusMenu` (only the allowed moves), `ActivityComposer` (typed entries; shows the response result), `LeadRequestPanel` (contact, slot, estimate, UTM, language), `DuplicatesPanel` (merge with a preview), `CustomerMatchChoice` ("same person / different person", the email and language boxes), `ScheduleVisitDialog` and `ConvertLeadSheet` (the two converts, both with the choice), `ConvertResult` (what a convert made, with links). |
| `customers/` | `CustomerFormSheet` (new customer) and `MapPinInput` ("use map pin": pasted coordinates fill a site's latitude and longitude — it sits in the site form's `intro`, inside the form). |
| `public/`, `booking/`, `surveys/` | Domain components, named for the domain they serve. `booking/BookingWizard/` is a folder for the same reason a page is: the flow's state in `BookingWizard.jsx`, one file per step under `steps/`, and the Kathmandu date maths in `bookingDays.js`. |

A component used by exactly one page can live beside its domain here; a component
used by two pages **must**. Nothing imports upward from `pages/`.

There is no `siteBlocks.jsx` barrel any more — import the component, not a bundle
of fifteen: `import { ServiceCard } from '@/components/site/ServiceCard'`.

A layout becomes a folder on the same rule a page does. `SiteHeader/` is the
worked example: the bar and the state its panels share in `SiteHeader.jsx`, and
`MegaPanel`, `MobileDrawer`, `HeaderSearch` and `UtilityStrip` beside it.

`AdminLayout/` is the second: the shell and its grouped sidebar in `AdminLayout.jsx`, the header's
`AdminBreadcrumb` and `NotificationPanel` beside it, and `notificationLinks.js` — the one place a
notification's `link` (`/leads/:id`, `/admin/surveys/:id`, an absolute app URL) becomes an in-app path.
The nav itself is data, in `config/admin/adminNav.js` (see "The admin shell" below).

## The admin kit

Every admin list and every admin create/edit screen is built from these. A CMS resource screen is
not built from them by hand at all: it is a **registry entry** (see "The resource registry" below)
that the two generic pages render with this kit.

### `common/DataTable/DataTable.jsx` — the one table

Server-side paging, sorting and search over `?page&limit&sort&q`, with the params in the URL through
`hooks/useListParams`. The folder holds the table and its parts: `DataTableFilters`,
`DataTableRowActions`, `DataTablePagination`, `DataTableReorderBody`.

| Prop | Does |
|---|---|
| `columns`, `data` (the page's rows), `meta`, `params`, `onParamsChange` | the basics, unchanged from v1 |
| `onRowClick`, `toolbar`, `searchPlaceholder`, `empty*`, `isLoading`, `isFetching`, `error`, `refetch` | unchanged |
| `rowActions(row)` → `[{ label, icon?, onSelect(row), destructive?, disabled?, separator? }]` | a kebab menu per row |
| `bulkActions` → `[{ label, icon?, destructive?, onSelect(rows, clearSelection) }]` | checkbox column, select-all-on-page, an actions bar. Selection clears when the page or filters change |
| `pageSizes` (default `[10, 20, 50, 100]`) | "Rows per page", written to `limit` |
| `filters` → `[{ key, label, type: 'enum' \| 'boolean' \| 'relation' \| 'dateRange', options?, allLabel?, defaultValue?, relation?: { path, labelKey?, params? }, fixedOptions?, fromKey?, toKey?, className? }]` | the filter bar; every value lives in the URL. A date range writes `from` / `to`. A choice with a `defaultValue` has no "all" of its own (give it an explicit option), is where the list starts, and is not counted as an applied filter — the caller puts the default in its list params. A relation's `fixedOptions` (`[{ value: 'none', label: 'Unassigned' }]`) are choices that are not records |
| `searchable` (default true) | false hides the search box — a short, complete list inside a page (duplicates, sites, a statement) |
| `trash` → `{ onRestore(row), onPurge?(row), canPurge? }` | a Trash toggle (`?deleted=true`); rows offer Restore, and Delete forever (confirmed) to `cms:purge` |
| `reorderDisabledReason` | when not `reorderable`, a disabled Reorder button with this reason beside it (list items: pick a list first) |
| `reorderable`, `onReorder(items)` | Reorder mode: drag handles plus Move up / Move down. `items` is `[{ id, sortOrder }]` offset by earlier pages — the `PATCH /reorder` body. Optimistic; a rejected promise puts the order back |
| `getRowId` (default `row.id`), `rowLabel(row, i)` | identity, and how a row is named to a screen reader |

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

One file per field type under `fields/`. Every spec has `name`, `type`, `label`, and optionally
`description`, `placeholder`, `required`, `disabled`, `span: 'half'`, `defaultValue` — and, in a registry entry,
`lockedOnEdit` (editable on a new record, read-only once saved).

| `type` | Value | Extra spec |
|---|---|---|
| `text` / `textarea` | string | `inputType`, `maxLength`, `rows` |
| `prose` (alias `markdown`) | plain text, blank line between paragraphs — **not** markdown, because the site renders `ProseBody` | `rows` |
| `number` | number | `min`, `max`, `step` |
| `money` | **rupees** (typed with grouping, `1,23,45,678.90`); the record's paisa converted on load | — |
| `switch` | boolean | — |
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
| `lineItems` | a priced document's lines — description, rate-card item, unit, qty and a rate in **rupees** (the record's paisa are converted in); rows move and are removed, a blank row is dropped, and the amounts are a preview until the server saves | `rateCard` (the rate-card rows), `maxItems` |
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
- **`common/RecordCombobox.jsx`** — picks one record from an admin list endpoint, searching `?q=` on the server.
  The relation filter and the relation field are both this. `api/lookupApi.js` holds its two resource-agnostic
  queries (`searchRecords`, `getRecord`). `fixedOptions` adds choices that are not records (listed first, never looked up).
- **`common/FormDialog.jsx`** — a short `<ResourceForm>` in a dialog (a reason, an owner): Cancel and a save close it,
  and it never holds the page's leave-guard. The lost-reason and assign dialogs are this.
- **`common/RecordHistory.jsx`** — `<RecordHistory endpoint="/admin/leads/:id/history" />`: a record's History tab.
  Newest first, one line per step — the event's words (`config/auditEvents.js`), a detail line, who (name · role, or
  "Customer (website or link)" / "System") and when (Kathmandu time), and "Show details" for the before/after table.
  `helpers/history.js#foldHistory` folds a request's plain row writes into that request's named event, so a status change
  reads once. Pages with the API's own paging. It takes any endpoint the API gives a history scope
  (`services/history.service.js`); Phase G adds pages, not a new component. Every detail page carries one (ADMIN-PLAN §7).

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
| Rate card | registry `rate-card`, own `basePath` | `/admin/rate-card` · quotations:read / quotations:write | Sales | quotation lines, survey pricing, `/pricing` rate table |
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
| `/admin/content/:resource` | `pages/admin/ResourceListPage.jsx` | DataTable v2: the entry's columns + an **On site** switch, its filters, search, Edit / View on site / Hide·Show / Delete, bulk Delete, Reorder (when `sortable`), Trash with Restore (and Delete forever for `cms:purge`) |
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
| `columns`, `filters` | DataTable columns and filters (the On site column is added by the page) |
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
| `rowActions(row)` | extra list actions: `[{ label, icon?, capability?, endpoint, arg, done }]` — `endpoint` is a `cmsApi` mutation (`approveTestimonial`), dispatched with `arg`; `done` is the success toast. Hidden without `capability`. The registry test checks each endpoint exists |

A role with `capability` but not `writeCapability` (ACCOUNTANT on the rate card) sees the list with disabled
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
   mutation. A resource
   mounted by hand outside `cms.routes.js` (the rate card, in `crm.routes.js`) is listed in the test's
   `HAND_MOUNTED` and must mount all eight endpoints.
6. When another screen reads the same data through its own endpoint, add its tag to `ALSO_READ_AS` in
   `api/cmsApi.js` (the rate card also invalidates the quotation builder's `RateCard` list).

Check before step 2 how the **public site** reads the model: its order column (`sortable`), where a record shows
(`publicHref`), and whether the public query overlays translations (`withLocale`) — a Nepali tab the site never
reads is a trap for an editor.

## Quotations (Phase F2)

| Route | Page | Does |
|---|---|---|
| `/admin/quotations` | `QuotationsPage` | DataTable v2 under the API's `?stage=` tabs — Drafts · Needs approval · Ready to send · With customer · Customer asked for changes · Won · Declined/Expired · All. An approver opens on **Needs approval**; the count on that tab is theirs (`countCapability`), everyone else sees the tab without a number. A row's menu offers exactly what its state allows |
| `/admin/quotations/:id` | `QuotationBuilderPage/` | one version: the form (a draft only), the action bar, the notices, the totals, the customer link and its messages, the trail, and the History tab |
| `/quotation/:token` | `pages/public/QuotationPublicPage/` | the customer's page: the document, then **Accept · Ask for changes · Decline** |

- **`helpers/quotationActions.js`** is the single table of what may be done: `quotationActions(quotation, { can, userId })`
  returns `[{ key, label, primary?, note?, disabledReason? }]`, and `waitingFor()` is the line under the title.
  Self-approval (`quotation.makerChecker`, sent by the API on the record) disables Approve and says why. The list,
  the builder and their tests all read this, and a unit test holds every action to `QUOTATION_TRANSITIONS`.
- **`hooks/useQuotationActions.jsx`** runs one: `const [runAction, actionDialogs] = useQuotationActions()`. Send back
  and pull back ask for a note (`FormDialog`), approve takes an optional remark, sending, revising and converting
  confirm first, and a revision opens its new version. A refusal toasts the API's reason.
- The builder is `ResourceForm` with a **`lineItems`** field (see the kit table) plus a card group for the terms.
  It is `readOnly` unless the quotation is a DRAFT and the reader holds `quotations:write`; `onDirtyChange` holds
  the action bar while there are unsaved edits, because those buttons act on the **saved** record.
- `sections/`: `QuotationActionBar` (buttons, with the reason a disabled one is disabled), `QuotationNotices` (the
  customer's change request, what a revision answers, a send-back reason, an automatic approval, the self-approval
  rule), `SendPanel` (the public link, Copy, Open, and each SMS/email with its delivery state) and `VersionSwitcher`.
- The customer's page keeps **every word in one object**, `quotationPageCopy.js`, for Phase J1 to translate, and
  decides what to show with the pure `quotationPageState.js` (open · accepted · changes · declined · expired ·
  replaced · replacedPending · closed) — both beside the page, both unit-tested. Its three buttons each open one
  confirm step: Accept repeats the total, Ask for changes takes a message (5–1000 characters), Decline an optional
  reason. No login, no code, no typed name (D4). It is checked at 360px in the end-to-end run.
- `api/quotationsApi.js` has the queues (`getQuotations`, `getQuotationStageCount`), the record, the draft save and
  the moves (`submit · approve · sendBack · pullBack · send · revise · convertToJob`). Every move invalidates the
  quotation, the list, `Dashboard`, `History` and `Notification`.
- `config/constants.js` mirrors the API's `QUOTATION_STATUSES`, `QUOTATION_TRANSITIONS`, the stage tabs and the
  status labels (the office's words, not the enum's); `crmMirror.test.js` fails if any of them drift.

## Leads and customers (Phase E)

| Route | Page | Does |
|---|---|---|
| `/admin/leads` | `LeadsPage` | DataTable v2 opening on **My leads** (D6) with a one-click **All leads**; filters status, priority, source, service, owner (with Unassigned), response state, requested visit, date; URL-saved views; New lead sheet; bulk Assign (one `bulk-assign` request) and Export selected; Export (filtered) |
| `/admin/leads/board` | `LeadBoardPage/` | the pipeline: a column per status (the list endpoint, 20 per column, "+N more" to the table); drag by the handle or use a card's "Move to" menu; only `LEAD_TRANSITIONS` drops are open (others dim), LOST asks why, a refused move goes back with a toast; pointer collision; no layout animation under reduced motion |
| `/admin/leads/:id` | `LeadDetailPage` | Edit, Change status, Assign, Convert (book the visit / without a visit), Delete; Overview (request, activity composer and timeline, where it got to), Duplicates (merge), History (`leads:history`) |
| `/admin/customers` | `CustomersPage` | DataTable v2: sites, open jobs, language, balance due for `invoices:read`; type filter, a tag chip filters by tag; New customer sheet |
| `/admin/customers/:id` | `CustomerDetailPage/` | Profile form (read-only without `customers:write`), Sites (one primary; "use map pin"), Timeline, the record tabs a role may read (quotations link to their page; the rest say Soon), Statement (`reports:finance`), History (`customers:history`) |

Both converts ask **"same person / different person"** whenever an existing customer has the lead's phone
(`CustomerMatchChoice`); Book / Convert waits for the answer, and the lead's email reaches an existing customer only when
"Also save … on this customer" is ticked. The public contact form and booking wizard send an optional email and the
site's language (`uiSlice.locale`) as `preferredLocale`.

## The admin shell

`components/layout/AdminLayout/` renders `config/admin/adminNav.js`, which is pure data and pure functions (tested
without a DOM in `adminNav.test.js`):

- **`ADMIN_NAV`** — nine groups in business order: **Overview · Sales · Operations · Finance · Aftercare · Content ·
  Page blocks · Blog & pages · Platform**. The three content groups all point under `/admin/content/…` and need
  `cms:read`; Page blocks holds the pieces the home page's bands are made of (features, list items, content blocks,
  process steps). Settings (Platform) is `/admin/platform/settings` for `settings:read`. An item is `{ to, label, icon, capability?, end?, soon? }`; `soon` renders greyed with a "Soon" tag,
  never as a link.
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

The header's brand comes from `useSiteSettings` (the company name in settings). The bell is `NotificationPanel`:
the unread count polls every `SHELL_POLL_MS` (the dashboard refreshes on the same beat); the list loads when the panel
opens; opening an item marks it read and navigates to `notificationHref(link)`; "Mark all as read" clears the badge.
Since Phase E the API writes every staff link as an `/admin/...` path (`/tech/...` for field staff);
`notificationHref` still reads the older `/leads/:id` and absolute forms, which remain in the database.

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
staff lead (`adminLeadSchema`), the lost reason, the activity and the convert site; `customer.schema.js` has the
customer and site and `parseMapPin`. `contactFields.test.js` covers mobile, landline and invalid numbers on every
contact form, email normalisation and Devanagari names. These mirror the backend's zod
schemas — when an API rule changes, change it here in the same commit. `cms.schema.js` mirrors the
whole of the API's `shared/schemas/cms.js`, one schema per CMS resource, for the registry entries, plus
`mediaUpdateSchema` and `mediaFolderSchema`; `rateCard.schema.js` mirrors `rateCardItemSchema` from the API's
`shared/schemas/crm.js`. `cms.schema.test.js` runs the API's own service cases
(`MaintainanceBackend/tests/fixtures/serviceSchemaCases.js`) against the mirror, and checks `UNITS` against the
API's `shared/enums.js` — the one test import that is a relative path, because the fixture is outside `src/`.
There is no `formKit.js`-style barrel for it: import the schema you need.

`useZodForm(schema, options)` is the only place `zodResolver` is imported.

## config/ vs helpers/

`config/` is data that describes the system: `constants.js` (enums mirroring the
backend — including `LEAD_TRANSITIONS`, the lead state machine the status menu and the board offer, and the loggable
activity types; `config/crmMirror.test.js` imports the API's own files and fails when they drift — plus
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
activity, lost-reason, assign and convert forms as `ResourceForm` fields, and the assignee and service relations),
`leadViews.js` (My leads / All leads → the API's `assignedToId=me`, and the URL-saved presets: Breached, Unassigned,
Bookings this week — the Kathmandu week starts on Sunday), `customerTabs.jsx` (the customer page's record tabs: columns,
links, and which role may see each), `homeSections.js` (what each home
section shows, where its content is edited, which ones take a `limit`, and `toSectionItems`), and `settingsForm.js`
(the settings screen as data — see "Which screen is which").

`helpers/` is behaviour with no state: `format.js` (money — `rupeesToPaisa`, `parseRupees`,
`formatRupees` — dates, Kathmandu time and `toKathmanduParts` / `fromKathmanduParts` for inputs),
`slug.js` (a copy of the API's `slugify` — change both together), `prose.js` (`splitParagraphs`),
`links.js` (`siteHref` — an editor's typo must not become a dead CTA; a live page counts when its slug is passed —
and `linkIssue`, the admin forms' check), `schedule.js` (`offerWindow` — live / scheduled / ended — and
`publishState` — draft / scheduled / published — worded by Kathmandu calendar day),
`permissions.js` (`can(role, capability)` — navigation only; the API is the authority; the parity test holds it to
the API's map), `leadBoard.js` (`nextStatuses`, `canDrop`, `cardsForColumn`, `columnTableHref`, `responseResult` —
"Responded in 34 min — within the promise"), `history.js` (`describeHistoryEntry`, `diffRows`, `foldHistory`),
`customerMatch.js` (convert's customer decision: `initialChoice`, `choiceBody`, `emailDiffers`), `leadDisplay.js`
(`describeEstimate` — a website estimate as sentences — and `mergePreview`),
`utils.js` (`cn`), `offlineQueue.js` (IndexedDB queue for the field app), `mediaFolders.js`
(`flattenFolderTree`), `overlay.js` (`ignoreToastInteraction`). `format.js` also has `formatBytes`.

`config/`, `helpers/` and `hooks/` have no barrel files (`config.js`, `helpers.js` and `hooks.js` had no importers
and were removed in C2) — import the module itself.

`hooks/` also holds the admin kit's behaviour: `useConfirm`, `useUnsavedChangesGuard`,
`useDebouncedValue`, `useListParams` (whose `defaults` are compared by value), `useLeadStatusChange` (the one way a
screen moves a lead: `const [changeStatus, dialog] = useLeadStatusChange()`; LOST asks why first; resolves false when
refused or cancelled, so the board can put a card back), `useNavBadges`, and `useResourceEntry`
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
4. New admin screens are built from the admin kit — `DataTable` and `ResourceForm`
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
