# API Surface — `/api/v1`

Conventions: `{ data, meta }` on success · `{ error: { code, message, details } }` on failure ·
lists accept `?page&limit&sort&q` plus per-resource filters · all mutations audited ·
money in requests is **rupees**, in responses **integer paisa**.

**Request id.** Every response carries `X-Request-Id` (exposed to browsers through CORS). A client may
send its own `X-Request-Id`; it is kept only if it matches `^[A-Za-z0-9._-]{8,64}$`, otherwise a UUID
replaces it. The same id is on every log line of the request and on every `AuditLog` row it wrote.

**Origins.** A browser request from an origin outside `PUBLIC_WEB_ORIGIN` / `ADMIN_ORIGIN` answers
`403 FORBIDDEN_ORIGIN`. A 5xx always answers `INTERNAL_ERROR` / "Something went wrong" (the detail is
logged, and reported to Sentry when `SENTRY_DSN` is set); only `NODE_ENV=development` shows the real message.

Every route below is exercised over HTTP by `npm run test:api`
(`MaintainanceBackend/tests/api/`), against a database whose name ends in `_test`.

## Public (no auth, rate-limited, cached 60s where marked ⚡)

Content endpoints take `?locale=en|ne`.

```
GET  /public/bootstrap              ⚡ settings + nav + home sections + booking rules in one call
                                      nav: { categories, blog, pages } — `blog` is true while at least one
                                      post is published; `pages` is [{ slug, title }] of the live generic
                                      pages (title in the requested locale), which the site serves at /:slug
GET  /public/home                   ⚡ every visible home section, hydrated, in order; with ?locale=ne every
                                      section overlays its Nepali copy, the grouped ones too (kitchen cards and
                                      steps, seepage block and checkpoints, the interior block)
GET  /public/services               ⚡ ?category&featured
GET  /public/services/:slug         ⚡ + related projects, faqs (group = this slug or `general`; with
                                      ?locale=ne each FAQ carries its Nepali question/answer where one exists)
GET  /public/projects               ⚡ ?service=<slug>&category=<slug>   case studies
GET  /public/projects/:slug         ⚡
GET  /public/offers                   active window only, cached 30s
GET  /public/pricing                ⚡ pricing plans + rate card + priced services
GET  /public/gallery                ⚡
GET  /public/testimonials           ⚡ approved only
GET  /public/faqs                   ⚡ ?group&locale   -> { items }   Nepali overlaid like the service page
GET  /public/posts                  ⚡ ?category=<slug>&limit (default 24, max 100)&locale
                                      -> { items: [{ id, title, slug, excerpt, coverId, publishedAt,
                                      category }], categories: [{ id, name, slug }], media }
                                      newest first; only posts switched on, not deleted, with publishedAt
                                      in the past (a draft has none; a scheduled post's is in the future).
                                      `categories` are the live ones holding a published post
GET  /public/posts/:slug            ⚡ ?locale -> { post (with category), media }; 404 NOT_FOUND for a
                                      draft, scheduled, hidden, deleted or unknown post
GET  /public/pages/:slug            ⚡ ?locale -> { page }; 404 NOT_FOUND for a hidden, deleted or unknown page
POST /public/estimate                 { serviceId | pricingPlanId, qty } -> { min, max, breakdown }
GET  /public/availability             ?from&days  free survey capacity per day and slot
                                      demand = scheduled INSPECTION jobs + booking leads still
                                      NEW/CONTACTED (past that they have a Job and would double-count)
                                      cached 30s; a full slot is flagged, never rejected
POST /public/leads                    honeypot + timing + turnstile + rate limit -> creates Lead
                                      online booking adds { preferredAt, preferredSlot },
                                      which sets source=booking; a closed weekday is rejected
                                      { name, phone, email? (optional; stored trimmed, lower-case),
                                        preferredLocale? en|ne (the site's language — the acknowledgement
                                        SMS and every later message use it), address?, serviceId?, message?… }
GET  /public/quotations/:token        customer views a quotation — an allowlist, never the row:
                                      { number, version, status, validUntil, subtotal, discount,
                                        vatApplied, vatRate, vatAmount, total, terms, sentAt, decidedAt,
                                        decisionNote (their own answer), requestedChanges (the change
                                        request this version answers), createdAt, customer { name },
                                        site { label, address } | null, items[] { id, description, unit,
                                        qty, rate, amount, sortOrder },
                                        replaced: { token } of the newest version when it is SENT, else null,
                                        actions: ['approve','request_changes','reject'] while SENT, else [] }
                                      A SENT quotation past validUntil is moved to EXPIRED on open.
POST /public/quotations/:token/decide decisionLimiter (20 per IP per 15 min) · no login, no OTP (D4)
                                      { decision: approve | request_changes | reject, note? }
                                      note: request_changes 5–1000 chars (required); reject optional
                                      (≤1000); approve ignores it. IP and user agent are recorded.
                                      Only a SENT quotation within validUntil takes an answer:
                                        422 QUOTATION_EXPIRED   past validUntil (moved to EXPIRED here, whether
                                                                or not anyone opened the link first)
                                        422 QUOTATION_ANSWERED  already answered — a second tap or a replay
                                        422 QUOTATION_REPLACED  a newer version superseded it
                                        422 QUOTATION_NOT_OPEN  any other status
                                      -> 200 the public view above.
                                      approve — ONE transaction: SENT → APPROVED → CONVERTED, the lead → WON
                                        through the state machine (NEW via CONTACTED; the timeline entry reads
                                        "Customer accepted QT-… vN · NPR …"; a lead already WON or LOST keeps its
                                        status and gets a note — the lead never fails the acceptance), and one
                                        job: DRAFT, unscheduled, unassigned, type REPAIR, titled
                                        "<service> — <number>" (the survey's service, else the lead's, else the
                                        first line), the service's job-template checklist, priority from the
                                        survey's urgency. The answer is claimed with a guarded update, so a
                                        double tap creates exactly one job. Response adds job { id, number }.
                                        Then, once each: the customer (SMS quotation_accepted, and email when on
                                        file, in their preferredLocale), the lead's salesperson and the
                                        quotation's author (in-app + email), every active DISPATCHER (in-app +
                                        email, linking /admin/jobs/:id) and the approving manager (in-app;
                                        nobody when it was auto-approved). Notification type quotation_accepted.
                                      request_changes — SENT → CHANGES_REQUESTED, decisionNote = the message, a
                                        lead timeline note "Customer asked for changes to QT-… vN: …" (the lead
                                        keeps its status); the salesperson and author get in-app + email
                                        (quotation_changes_requested_staff, message included); the customer gets
                                        an SMS acknowledgement (quotation_changes_received) in their language.
                                      reject — SENT → REJECTED, decisionNote = the reason, a lead timeline note;
                                        the lead is NOT marked LOST (sales decides). Salesperson and author get
                                        in-app + email (type quotation_rejected).
                                      The three answers are quotation.service.js acceptQuotation /
                                      requestQuotationChanges / declineQuotation, so a customer account
                                      (Phase K) reuses them.
GET  /public/invoices/:token          customer views an invoice (read-only; paid offline)
                                      payments[] include voided ones with voidedAt set (shown struck
                                      through); paidAmount already excludes them
GET  /public/warranties/:token
POST /public/warranties/:token/claim  { description }   one open claim at a time — a second is 422
GET  /sitemap.xml   /robots.txt   /json-ld              ?origin=https://…
                                      the sitemap lists /blog (while it has a published post), every
                                      published post at /blog/:slug and every live page at /:slug
```

A CMS write (create, update, toggle, reorder, delete, restore) invalidates the public cache, so
the change is visible on the next request rather than after the TTL.

**As the SPA consumes them:** `/blog` reads `GET /public/posts?locale&category` (the category is in the page's URL),
`/blog/:slug` reads `GET /public/posts/:slug?locale`, and `/:slug` — the last public route, so only an address no other
route claims — reads `GET /public/pages/:slug?locale`. A 404 from either renders the site's not-found page. The header,
drawer and footer show "Blog" while `bootstrap.nav.blog` is true, and a CMS button link to `/<slug>` is followed only
while that slug is in `bootstrap.nav.pages` (otherwise it goes to `/book`).

## Auth

```
POST /auth/login            -> { user, accessToken } + httpOnly refresh cookie
POST /auth/refresh          rotates the cookie; the previous one stops working
POST /auth/logout           revokes the refresh token
POST /auth/forgot-password  same answer for known and unknown emails; emails a 1-hour link to
                            <web origin>/reset-password?token=…
POST /auth/reset-password   { token, password } — the forgot-password link, an admin's reset link or a
                            new account's invite; revokes every existing session
POST /auth/change-password  revokes every existing session
GET  /auth/me
```

Five failed logins lock an account for 15 minutes; a disabled account is refused at login and
on its next authenticated request.

## Admin — CMS (`ADMIN`, `EDITOR`)

Every resource below gets the same eight endpoints from one factory: `GET /`, `GET /:id`,
`POST /`, `PUT /:id` (partial), `PATCH /:id/toggle`, `PATCH /reorder { items: [{ id, sortOrder }] }`,
`DELETE /:id` (soft) and `PATCH /:id/restore` — plus **`GET /:id/history`**, the record's audit trail
(see "Record history"), for `cms:read` only: SALES reads services through `services:read` but not their trail.

Reads need `cms:read`, writes `cms:write`. One exception: `GET /admin/services` and `GET /admin/services/:id`
also accept **`services:read`** (SALES, MANAGER, and since H1 DISPATCHER), so a salesperson can put a service on a lead and a
dispatcher on a job template; every services write
stays `cms:write` (403 for SALES).

`DELETE /:id?hard=true` removes the row for good and needs **`cms:purge`**, which only ADMIN holds;
anyone else gets 403 `FORBIDDEN` and nothing is deleted. It purges a live row or one already in Trash (the trash
view's "Delete forever"); an id that does not exist is 404. A plain `DELETE /:id` of a row already in Trash is 404. The same applies to `DELETE /admin/media/:id?hard=true`,
which also removes the stored file and its variants.

`GET /?deleted=true` is the **trash view**: only soft-deleted rows, paginated, sorted and searchable like the normal
list, with the same capability (`cms:read`). `?deleted=false` or no parameter lists live rows only. Any other value
is 400 `BAD_REQUEST` (`details: [{ path: 'deleted', … }]`). `PATCH /:id/restore` brings a row back.

A slug derived from a title (`slugFrom`) keeps Devanagari as-is, vowel signs and virama included:
`नेपाली सेवा` → `नेपाली-सेवा`, then `-2`, `-3`… if taken.

```
/admin/hero-slides
/admin/service-categories
/admin/services
/admin/projects                 + POST /:id/images { mediaId, caption?, sortOrder? } -> 201 the image,
                                  PATCH /:id/images/reorder { items: [{ id, sortOrder }] } -> 204,
                                  DELETE /:id/images/:imageId -> 204 (400 when the image is not this project's)
                                  ?categoryId&serviceId&status; every read carries `job: { id, number } | null`
                                  (the job a case study was published from) and `images` in order
/admin/offers
/admin/pricing-plans
/admin/features                 ?group=
/admin/list-items               ?group=   ordered by `position` — reorder stores sortOrder + 1 there, so
                                  the admin table's 0-based body numbers the list 1, 2, 3… (the number the site
                                  prints). Reorder one group at a time: positions are per group
/admin/content-blocks
/admin/process-steps
/admin/testimonials             ?approved=true|false (anything else: all)
                                  + PATCH /:id/approve { isApproved?: boolean = true }   (testimonials:moderate —
                                  ADMIN, EDITOR; 403 otherwise) -> the testimonial. Only approved ones are public
/admin/gallery
/admin/faqs
/admin/pages  /admin/posts  /admin/post-categories
                                  posts: ?categoryId; a post is public once `publishedAt` has passed — leave it
                                  empty for a draft

/admin/home-sections            GET, PUT { items: [{ key, sortOrder, isVisible, settings? }] }
/admin/translations             GET ?model&recordId, PUT { model, recordId, values }

/admin/settings                 GET (settings:read — ADMIN, EDITOR) -> { [group]: Setting[] } with
                                  { key, group, label, type, value, hint, sortOrder }, each group by sortOrder;
                                  `type` is string | number | boolean | richtext | media | json.
                                  PATCH { values: { [key]: value } } (ADMIN only; 403 otherwise) -> the flat key → value
                                  map. Values are stored as sent (JSON); an unknown key is created in group `custom`.
                                  One `settings.changed` audit event lists the keys whose value moved. The settings
                                  screen sends only changed keys and checks phones (Nepali rule), emails, https links,
                                  number ranges and `booking.closedWeekdays` (at least one open day) before it does
/admin/media                    GET ?folderId&q, POST (images, multipart `files`), GET /:id, PUT /:id,
                                DELETE /:id (soft; ?hard=true needs cms:purge)
/admin/media/documents          POST (PDFs and other files)
/admin/media/folders            GET, POST { name, parentId? }, DELETE /:id
```

**Services** (`POST` and `PUT /admin/services…`) — 400 `BAD_REQUEST` with `details[].path` naming the field when:
- `excerpt` (the card text) is missing, or shorter than **40** or longer than **200** characters after trimming;
- `excerpt` is the old site's template, `Professional … with expert tools and results.` (any case, full stop optional);
- `priceTo` < `priceFrom` (`path: 'priceTo'`). `PUT` is partial, so a body carrying only one of the two prices is
  checked against the stored other one; equal prices are allowed, and so is a `priceFrom` with no `priceTo`.

**SEO fields** — services take `metaTitle`, `metaDescription` and `ogImageId`. Projects, pages and posts take
`metaTitle` and `metaDescription` only: they have no sharing-image column, so an `ogImageId` sent to them is dropped
(it used to reach the database and answer 500).

**Home sections** — `key` is one of the 19 `HOME_SECTION_KEYS`; `settings.limit`, when sent, is an integer 1–50 (how
many items the services, projects, gallery and testimonials sections show); other `settings` keys are kept as sent.
Anything else is 400. The response is the full list in order; the public site's cache is cleared.

**Media** — `PUT /admin/media/:id { alt?, caption?, folderId? }`: `alt` can change but not be emptied (a blank or
whitespace `alt` is 400 `details: [{ path: 'alt' }]`); `folderId: null` moves the file out of its folder.
`POST /admin/media/folders`: `name` 1–80 characters (Devanagari kept), `parentId` must be an existing folder (400
otherwise). `DELETE /admin/media/folders/:id` is 404 for an unknown folder and 400 while the folder holds a live file
or any subfolder — only an empty folder is deleted.

## Admin — CRM (`ADMIN`, `SALES`, `MANAGER`)

Capabilities: leads — `leads:read` (SALES, DISPATCHER), `leads:write` (SALES); customers — `customers:read`
(SALES, DISPATCHER, ACCOUNTANT), `customers:write` (SALES); history — `leads:history` / `customers:history` /
`quotations:history` (SALES, MANAGER), `jobs:history` (DISPATCHER), `invoices:history` (ACCOUNTANT); quotations — `quotations:read` (SALES, ACCOUNTANT), `quotations:write` (SALES),
`quotations:approve` (MANAGER only). **MANAGER** holds every SALES capability plus `quotations:approve`, and can be
assigned leads. ADMIN holds all of them.

A lead and a customer carry `preferredLocale` (`en` | `ne`, default `en`): the language every SMS and email to
that person uses (a missing `ne` template falls back to the `en` one). `email` is stored trimmed and lower-case
wherever it is accepted.

```
GET    /admin/leads                 leads:read · ?status&priority&source&assignedToId&serviceId&slaRisk
                                     &requestedVisit=true|false&from&to&q&page&limit&sort
                                    assignedToId: a user id, `me` (the caller — the "My leads" view) or
                                    `none` (unassigned). requestedVisit: the lead names a visit day
                                    (preferredAt set — online bookings, and bookings folded onto an enquiry)
POST   /admin/leads                 leads:write · manual entry (call, walk-in, WhatsApp…)
                                    { name, phone, altPhone?, email?, address?, area?, serviceId?, message?,
                                      source (default call), priority, assignedToId? (default: the caller),
                                      estimatedAmount? (rupees), preferredLocale? (default en) }
GET    /admin/leads/sla-board       leads:read · at-risk + breached
GET    /admin/leads/export.csv      leads:read · the list filters (every page, up to 10,000 rows), or
                                    ?ids=a,b,c (≤100) for the rows picked in the table
POST   /admin/leads/merge           leads:write · { primaryId, duplicateIds }   duplicates move to LOST and are
                                    soft-deleted; 422 when a duplicate is WON — make that lead the primary instead
POST   /admin/leads/bulk-assign     leads:write · { ids (1–100), assignedToId | null, note? }
                                    -> { assigned, unchanged }. One transaction, all or nothing (an unknown
                                    id is 404 and nothing moves). Each lead gets its timeline entry and its
                                    lead.assigned event; the assignee gets ONE notification for the batch.
                                    Leads already with that owner are left alone
GET    /admin/leads/assignees       leads:read · ?q&limit — active SALES, MANAGER and ADMIN users { id, name, email, role }:
                                    who a lead can be assigned to (/admin/users is ADMIN's)
GET    /admin/leads/assignees/:id   leads:read · one of them; 404 for anyone else
GET    /admin/leads/:id
GET    /admin/leads/:id/duplicates  leads:read · other live leads sharing the phone / alt phone, or the email
                                    (any case). Each row adds `matchedOn` (phone | email), `sla` and
                                    `_count { notes, activities, quotations, jobs }` — what a merge would move
GET    /admin/leads/:id/customer-matches  leads:read · live customers with the lead's phone or alt phone:
                                    [{ id, name, phone, altPhone, email, type, preferredLocale, jobCount,
                                       lastVisitAt, primaryAddress, createdAt }]
GET    /admin/leads/:id/history     leads:history · see "Record history" below
PUT    /admin/leads/:id             leads:write · partial; leaving preferredLocale out keeps it
PATCH  /admin/leads/:id/status      validated transition; LOST needs lostReason; writes a status_change
                                    timeline entry; the status it already has is a no-op
PATCH  /admin/leads/:id/assign      leads:write · { assignedToId | null, note? } — the assignee must be an
                                    active SALES or ADMIN user (400 otherwise); notified unless unchanged
POST   /admin/leads/:id/notes
POST   /admin/leads/:id/activities  leads:write · { type: call|sms|whatsapp|email|visit|note, summary, meta? }
                                    (status_change and assignment are the system's — 400). Any type but
                                    note stamps firstResponseAt the first time. Writes lead.activity_logged.
                                    -> 201 { …activity, user, firstResponse: bool, sla: { state, … } }
POST   /admin/leads/:id/convert     leads:write · { customerId? | createNewCustomer?, confirmEmail? (false),
                                      preferredLocale?, site? { label, address, area },
                                      createQuotation, createInspectionJob, scheduledStart, scheduledEnd,
                                      surveyorId }
                                    -> 201 { customer, customerCreated, site, quotation?, job?, survey? }
                                    Which customer — a phone is shared and recycled, so it is never enough:
                                      · a lead already linked keeps its customer (a second convert adds a
                                        visit or a quotation);
                                      · customerId — "same person": link to it. confirmEmail also saves the
                                        lead's email on it (customer.email_confirmed, actor = the caller);
                                        without it the customer's email is untouched;
                                      · createNewCustomer — "different person": a new customer with this phone
                                        and the lead's email, even though another customer has the phone;
                                      · neither, and a customer has the phone (or alt phone): 409
                                        CUSTOMER_MATCH { details: { candidates: [ as customer-matches ] } },
                                        nothing written;
                                      · neither, and nobody has it: a new customer.
                                    Both customerId and createNewCustomer: 400.
                                    A new customer takes the lead's email and preferredLocale (or the one
                                    given); an existing customer keeps its language unless preferredLocale
                                    is given.
                                    Site: an address typed in `site` is used — an existing site of the
                                    customer with that address, else a new site (primary only if the customer
                                    has none). With no `site`: the primary site, or one made from the lead's
                                    address for a customer with no site.
                                    Assigning surveyorId schedules the visit and pre-creates its SiteSurvey.
                                    One transaction: any failure (e.g. an unknown surveyorId, 409) leaves no
                                    customer, site, quotation, job, survey or lead change behind.
                                    The quotation is priced like POST /admin/quotations (VAT included).
                                    The lead only moves forward, one timeline entry per step:
                                    NEW|LOST → CONTACTED → INSPECTION_SCHEDULED (job) → QUOTED (quotation)
DELETE /admin/leads/:id             soft delete; 404 for an unknown or deleted lead

GET    /admin/customers             customers:read · ?q (name, phone, alt phone, email, PAN)&type=individual|company
                                     &tag&page&limit&sort. Each row adds sites, siteCount, openJobs, invoiceCount,
                                    quotationCount — and balanceDue (paisa, unpaid invoices' total − paid) only
                                    for a caller with invoices:read (ACCOUNTANT, ADMIN)
POST   /admin/customers             customers:write · { type, name, phone, altPhone?, email?, panVatNo?, notes?,
                                      tags?: string[], preferredLocale? } — a phone another customer has is
                                    allowed (shared phones are real); the screen warns
GET    /admin/customers/:id         customers:read · with sites (primary first), contracts and _count
PUT    /admin/customers/:id         customers:write · partial. The one place staff change a customer's email;
                                    it is the audited model change (before → after)
DELETE /admin/customers/:id         customers:write · soft; 400 while the customer has open jobs
GET    /admin/customers/:id/timeline  customers:read · leads, quotations, jobs, invoices, warranties, newest first,
                                    plus kind `quotation_response` at decidedAt for each customer answer
                                    ("Customer accepted QT-… vN · NPR …", "…asked for changes to…", "…declined…")
GET    /admin/customers/:id/history customers:history · see "Record history" below
GET    /admin/customers/:id/sites   customers:read
POST   /admin/customers/:id/sites   customers:write · { label, address, area?, lat?, lng?, accessNotes?, isPrimary? }
PUT    /admin/customers/:id/sites/:siteId     partial; 404 when the site is not that customer's
DELETE /admin/customers/:id/sites/:siteId     soft; 400 while jobs use the site
                                    Exactly one primary site: the first site is primary whatever was sent; a site
                                    marked primary takes the flag from the others; unmarking the primary is 422
                                    (mark another instead); deleting the primary passes it to the oldest site left
/admin/rate-card                    GET (?q searches code, name, category; ?deleted=true is Trash), GET /:id,
                                    POST, PUT /:id (partial), PATCH /:id/toggle, PATCH /reorder { items },
                                    PATCH /:id/restore, DELETE /:id (soft) — read: quotations:read,
                                    write: quotations:write. The same eight endpoints as a CMS resource,
                                    plus GET /:id/history (quotations:history — not ACCOUNTANT).
                                    DELETE ?hard=true needs cms:purge (ADMIN); quotation and survey lines
                                    that used the item keep their copy and lose the link.
                                    Body { code, name, description?, category?, unit, rate (rupees), sortOrder?,
                                    isActive? }. `code` is letters, digits, - and _, stored upper-case and
                                    unique: `wp-1` after `WP-1` is 409 (a soft-deleted item still holds its code).
                                    Feeds quotation lines, survey pricing and the rate table on GET
                                    /public/pricing (active items). The estimator does not read it.
GET    /admin/quotations            quotations:read · ?stage&status&customerId&leadId&from&to&q&page&limit&sort
                                    stage: drafts (DRAFT) · approval (PENDING_APPROVAL) · ready
                                    (OFFICE_APPROVED) · with_customer (SENT) · changes_requested
                                    (CHANGES_REQUESTED) · won (APPROVED, CONVERTED) · lost (REJECTED,
                                    EXPIRED) · all (everything, SUPERSEDED included). No stage = all.
                                    status narrows within the stage. 400 on an unknown stage or status.
                                    Rows add submittedBy, approvedBy { id, name } and lead.assignedToId.
GET    /admin/quotations/:id        quotations:read · adds parent { id, number, version, status, decisionNote },
                                    supersededBy { id, number, version, status }, revisions[], and
                                    versions[] { id, number, version, status, total, createdAt } — the
                                    whole version chain, oldest first — plus, for the screens:
                                    survey { id, number, status } | null (the survey any version of it was
                                    priced from), messages[] { id, channel, templateKey, toAddress, status,
                                    error, createdAt } (the customer's SMS and email about it, newest first,
                                    max 20) and makerChecker (the setting, so the page can say why an
                                    author may not approve their own)
GET    /admin/quotations/:id/history  quotations:history (SALES, MANAGER, ADMIN) · ?page&limit
                                    the quotation's own audit rows and its lines', newest first — the same
                                    shape as the lead and customer history (no ip, no user agent)
POST   /admin/quotations            quotations:write · creates a DRAFT. Without `validUntil` it is valid to
                                    the end of the Kathmandu day `quotation.validDays` (default 15) away, so a
                                    quotation built from a survey or a convert can be submitted as it is
PUT    /admin/quotations/:id        quotations:write · DRAFT only. Any other status is 422 UNPROCESSABLE
                                    ("…cannot be edited. …") and nothing changes
DELETE /admin/quotations/:id        quotations:write · soft delete; CONVERTED is 400

Internal approval — no quotation is sent until it is approved (see ARCHITECTURE.md "State machines").
Every status move is guarded on the status just read: a same-moment second press is 409 CONFLICT; a move the
state machine does not allow (including to the status it already has) is 422 INVALID_TRANSITION.
POST   /admin/quotations/:id/submit     quotations:write · DRAFT → PENDING_APPROVAL
                                    422 QUOTATION_INCOMPLETE without a line, an active customer, or a
                                    validUntil in the future. When quotation.autoApproveBelow (paisa) > 0 and
                                    total < it, the same transaction goes on to OFFICE_APPROVED with
                                    autoApproved=true, approvedById null, event quotation.auto_approved
                                    (actorType system) — for every version, revisions included.
                                    Otherwise every active MANAGER and ADMIN except the submitter gets
                                    quotation_submitted (in-app + email). -> 200 the quotation (GET shape)
POST   /admin/quotations/:id/approve    quotations:approve · { note? ≤1000 } · PENDING_APPROVAL → OFFICE_APPROVED
                                    sets approvedById, approvedAt, approvalNote. 403 SELF_APPROVAL when
                                    quotation.makerChecker is on (default) and the caller created it.
                                    The creator gets quotation_office_approved (in-app).
POST   /admin/quotations/:id/send-back  quotations:approve · { note 3–1000 } · PENDING_APPROVAL → DRAFT
                                    sentBackReason = note; the creator gets quotation_sent_back (in-app)
POST   /admin/quotations/:id/pull-back  quotations:write · { note 3–1000 } · OFFICE_APPROVED → DRAFT
                                    before it is sent; sentBackReason = note; the approval is cleared
POST   /admin/quotations/:id/send       quotations:write · OFFICE_APPROVED → SENT only (a DRAFT or
                                    PENDING_APPROVAL is 422 INVALID_TRANSITION; a validUntil already past
                                    is 422 QUOTATION_EXPIRED). Issues publicToken, SMS + email
                                    quotation_sent in the customer's language.
POST   /admin/quotations/:id/revise     quotations:write · from SENT, CHANGES_REQUESTED, REJECTED or EXPIRED
                                    -> 201 a new DRAFT: version+1, parentId, lines and totals copied,
                                    requestedChanges = the parent's change request (when it was
                                    CHANGES_REQUESTED). The parent becomes SUPERSEDED with supersededById,
                                    which closes its link (its GET shows replaced once the new version is
                                    sent). Events quotation.revised (new) + quotation.superseded (parent).
                                    The new version is submitted and approved again.
POST   /admin/quotations/:id/convert-to-job      jobs:write · APPROVED only — quotations the customer
                                    approved before Phase F; since then acceptance creates the job itself.
                                    CONVERTED (a job exists) is 422 INVALID_TRANSITION, so it never makes a
                                    second job.
                                    { type?, title?, description?, priority?, scheduledStart?,
                                      scheduledEnd?, templateId?, technicianIds?, leadTechnicianId? }
                                    -> 201 job. Customer, site and lead come from the quotation, which
                                    becomes CONVERTED. SALES can win the work but not schedule it.
```

### Record history

```
GET /admin/leads/:id/history        leads:history
GET /admin/customers/:id/history    customers:history
GET /admin/quotations/:id/history   quotations:history
GET /admin/jobs/:id/history         jobs:history
GET /admin/invoices/:id/history     invoices:history
GET /admin/rate-card/:id/history    quotations:history
GET /admin/<cms resource>/:id/history   cms:read — every resource the CRUD factory mounts
GET /admin/materials|material-categories|suppliers/:id/history   materials:read
GET /admin/job-templates/:id/history    jobs:read
GET /admin/technicians/:id/history      technicians:write
GET /admin/users/:id/history        ADMIN
                                    ?page&limit (≤100) · newest first · 400 on a bad page/limit · 404 for an
                                    unknown or purged record (a soft-deleted record's history stays readable)
                                    row: { id, event, action, model, recordId, actorType, requestId,
                                           before, after, changes, createdAt,
                                           actor: { id, name, role } | null }
                                    — an AuditLog row without ip and userAgent (those stay in the audit log)
```

What belongs to a record: always its own rows and events (`model` + `recordId`) and the rows of its Nepali
copy (`Translation`). Some records also include their children, matched by the parent id in the child row's
before/after snapshot:

| Record | Children |
|---|---|
| Lead | `LeadNote` |
| Customer | `CustomerSite` |
| Quotation | `QuotationItem` |
| Job | `JobAssignment`, `JobTask`, `JobPhoto`, `TimeLog`, `JobMaterial` |
| Invoice | `InvoiceItem`, `Payment` (and `payment.voided`, whose invoice is in `changes`) |
| Project | `ProjectImage` |

Children written as part of their parent's create (a job's first assignments) are not audited row by row;
the parent's event lists them. Timeline entries (`LeadActivity`) are not audited row by row either;
staff-logged ones arrive as `lead.activity_logged`. Scopes live in `services/history.service.js`
(`HISTORY_SCOPES`); the route is `routes/admin/historyRoute.js`.

## Admin — Site surveys (`ADMIN`, `SALES`; `DISPATCHER` reads)

The surveyor reports quantities; the admin owns price. Note the split guard: reading a
survey is `surveys:read`, but seeing any money is `quotations:read` — that is the wall.

```
GET    /admin/surveys                ?status&surveyorId&customerId&from&to&q     surveys:read
GET    /admin/surveys/:id            readings + quantity items + job photos      surveys:read
GET    /admin/surveys/:id/pricing    priced preview (paisa) + missing[]          quotations:read
PATCH  /admin/surveys/:id/review     { status: IN_REVIEW|RETURNED, note }        surveys:write
                                     RETURNED requires a note and SMSes the surveyor
POST   /admin/surveys/:id/quotation  { items?, discount?, vatApplied?, validUntil?, terms? }
                                     -> 201 { survey, quotation }  rates in RUPEES   quotations:write
DELETE /admin/surveys/:id            soft delete, DRAFT only                     surveys:write
```

`GET /:id/pricing` resolves each quantity line against today's catalogue —
`LABOUR → rateCardItem.rate`, `MATERIAL → material.sellRate`, `SERVICE → service.priceFrom` —
and returns anything unpriceable in `missing[]` with a reason rather than pricing it at zero.

## Admin — Operations (`ADMIN`, `DISPATCHER`)

Reads need `jobs:read` (SALES, MANAGER and ACCOUNTANT read jobs too), writes `jobs:write`, and the dispatch
calls `jobs:dispatch` (DISPATCHER, ADMIN). A job's status moves only through `status`, `schedule`, `assign`,
`complete` and `verify` — `PUT /admin/jobs/:id` edits the details and never the status.

```
GET    /admin/jobs                  ?page&limit&q&status&type&priority&technicianId&customerId&quotationId
                                    &unassigned=true|false&invoiced=true|false&from&to&sort
                                    from / to: Kathmandu days (YYYY-MM-DD), inclusive, on scheduledStart
                                    invoiced=false: COMPLETED|VERIFIED, isBillable, no invoicedAt yet
                                    (a status filter narrows it further)
                                    sort: createdAt|scheduledStart|number|priority|status|updatedAt, "-" for desc
                                    anything else is 400 BAD_REQUEST
POST   /admin/jobs                  a quotationId must belong to the customer and be APPROVED
                                    (it becomes CONVERTED); a templateId pulls its checklist
GET    /admin/jobs/:id              + lead, quotation (with status), survey { id, number, status },
                                    project { id, title, isActive } (its case study), parentJob, childJobs,
                                    createdBy, tasks, photos, timeLogs, materials, events (newest first), warranty
GET    /admin/jobs/:id/history      jobs:history (DISPATCHER, ADMIN) · see "Record history"
PUT    /admin/jobs/:id              details only (type, site, title, description, priority, window, isBillable);
                                    422 once COMPLETED, VERIFIED or CANCELLED
DELETE /admin/jobs/:id              DRAFT or CANCELLED only (400 otherwise); soft
PATCH  /admin/jobs/:id/status       validated transition, writes JobStatusEvent;
                                    ON_HOLD and CANCELLED need a note
POST   /admin/jobs/:id/schedule     jobs:dispatch · see "Scheduling" below
POST   /admin/jobs/:id/assign       jobs:dispatch · { technicianIds, leadTechnicianId }
POST   /admin/jobs/:id/tasks        + PATCH /tasks/:taskId + DELETE /tasks/:taskId
POST   /admin/jobs/:id/photos       { mediaId, kind: BEFORE|DURING|AFTER|ISSUE|SIGNATURE, caption? }
                                    + DELETE /photos/:photoId
POST   /admin/jobs/:id/materials    { materialId, qty, rate? (rupees; default the sell rate), isBillable }
                                    issues stock (ISSUE_TO_JOB) · 422 on a closed job
DELETE /admin/jobs/:id/materials/:jobMaterialId   reverses it (a RETURN movement)
POST   /admin/jobs/:id/time-logs    { technicianId, startedAt, endedAt | minutes, note }
                                    labour the office records by hand — the timer was never started.
                                    The technician must be assigned to the job (422 otherwise).
DELETE /admin/jobs/:id/time-logs/:logId
POST   /admin/jobs/:id/complete     { note, signatureMediaId, customerRating, customerFeedback,
                                    warrantyDays, warrantyScope }
                                    checklist must be done (422 with the open items in details)
                                    -> creates Warranty, enables invoicing
POST   /admin/jobs/:id/verify       COMPLETED -> VERIFIED
GET    /admin/jobs/:id/costing      labour + materials + expenses vs invoiced (all paisa):
                                    { cost: { materials, labour, expenses, total }, labourMinutes,
                                      billable: { materials, invoiced }, margin, marginPct,
                                      breakdown: { materials[] { name, code, unit, qty, rate, amount (billed),
                                        cost (at purchase rate), isBillable }, labour[] { technician, startedAt,
                                        minutes, cost }, expenses[], invoices[] } }
                                    every total is the sum of its rounded lines, so the breakdown adds up
                                    to the paisa (materials without a purchase rate are costed at the billed rate)
POST   /admin/jobs/:id/publish-case-study   cms:write · COMPLETED|VERIFIED only · once (409)
                                    pre-fills problem/solution from the survey, duration from the
                                    job, images from its BEFORE/AFTER photos, and the cost as a
                                    +/-20% band. The customer's name is omitted unless opted in.
                                    Answers 201 with the new, unpublished Project.
```

The `:taskId`, `:photoId`, `:jobMaterialId` and `:logId` params are validated (400 on an empty one).

### Scheduling

`POST /admin/jobs/:id/schedule` (`jobs:dispatch`) is how the dispatch board's drop and its Schedule dialog
put a job on the calendar:

```
{ scheduledStart, scheduledEnd,            required; end after start, at most 14 days apart (400)
  technicianIds?: [id, …],                 1–20; replaces the assignment. Left out, the assignment stays
  leadTechnicianId?,                       must be one of technicianIds (400); default the first
  note?,                                   the status event's note (default "Scheduled for …" / "Rescheduled to …")
  notifyCustomer?: true }                  false skips the customer's SMS
→ 200 { data: job (as GET /admin/jobs/:id's list shape), meta: { warnings: [
    { kind: 'conflict', technicianId, technician, day, with: 'JOB-…' },
    { kind: 'capacity', technicianId, technician, day, load, capacity } ] } }
```

- **Status:** DRAFT and SCHEDULED become ASSIGNED once someone is on the job, else SCHEDULED; ON_HOLD returns to
  SCHEDULED (its hold reason is cleared); ASSIGNED keeps its status. EN_ROUTE, IN_PROGRESS and closed jobs are
  refused with 422 `UNPROCESSABLE`. A JobStatusEvent is written either way.
- **Warnings, never a refusal:** an overlapping window with another of the technician's jobs, and a Kathmandu day
  on which they would have more jobs than `dailyCapacity`. The board shows the same warnings before it sends.
- **Messages:** newly assigned technicians get `job_assigned` (in-app + SMS). When the window moved and
  `notifyCustomer` is not false, the customer gets **`job_scheduled`** by SMS in their `preferredLocale`
  (English fallback) — `{{customerName}} {{number}} {{date}} {{time}} {{appName}}`, times in Kathmandu.
- **Audit:** `job.scheduled` — status, window and technician ids before → after.

### Dispatch

```
GET    /admin/dispatch/board        jobs:dispatch · ?date=YYYY-MM-DD (Kathmandu; default today)
                                    &view=day|week (week = 7 days from date) &role &technicianId
GET    /admin/dispatch/unassigned   jobs:dispatch · ?page&limit&q&sort=priority|createdAt|-createdAt
                                    DRAFT or SCHEDULED jobs nobody is on; default most urgent first,
                                    then oldest. Paginated, rows in the card shape below
```

The board:

```
{ from, to, view,                    UTC instants of the Kathmandu day bounds
  days: ['2026-09-18', …],           1 or 7 Kathmandu dates
  hours: { start: 8, end: 18 },      the working day the board draws
  lanes: [{
    technician: { id, name, phone, role, employeeCode, skills[], serviceAreas[], rating,
                  dailyCapacity, isAvailable },     never hourlyRate
    jobs: [JobCard],                 scheduled in range, not CANCELLED, assigned to this technician
    loadByDay: { '2026-09-18': 2 },
    overCapacityDays: ['2026-09-18'],
    conflicts: [{ a: 'JOB-…', b: 'JOB-…', day }] }],
  unscheduledAssigned: [JobCard],    open jobs with people but no window (first 50)
  unassignedCount }                  the side list pages /dispatch/unassigned itself

JobCard = { id, number, title, type, status, priority, scheduledStart, scheduledEnd, quotationId,
            createdAt, customer: { id, name, phone }, site: { id, area, address } | null,
            assignments: [{ technicianId, isLead }] }
```

Lanes are the live technician profiles of active users (surveyors included; filter with `role`).
*Changed in H1:* the board used to embed the first 50 unassigned jobs as `unassigned`; it now says
`unassignedCount`, and `/dispatch/unassigned` is paginated (it was capped at 100).

### Technicians

Mounted like a registry resource (`technicians:read` to read, `technicians:write` to change):

```
GET    /admin/technicians           ?page&limit&q (name, employee code, phone)&role&available=true|false
                                    &skill&area (exact entries of the JSON lists)&deleted=true (Trash)
                                    &sort=employeeCode|name|rating|dailyCapacity|isAvailable|createdAt
                                    rows: the profile, user { id, name, email, phone, role, isActive },
                                    loadThisWeek (live jobs scheduled this Kathmandu week, Sunday–Saturday).
                                    Never hourlyRate, whoever asks.
GET    /admin/technicians/:id       + loadThisWeek; hourlyRate (paisa) only for technicians:write
GET    /admin/technicians/:id/history   technicians:write — the trail records rate changes
POST   /admin/technicians           { userId, employeeCode?, skills?, certifications?, serviceAreas?,
                                      hourlyRate? (rupees), dailyCapacity (1–20, default 4), isAvailable }
                                    404 unknown user · 409 CONFLICT when the person has a profile
                                    (details.technicianId; "restore it instead" when it is in Trash)
PUT    /admin/technicians/:id       partial; userId cannot change (dropped)
PATCH  /admin/technicians/:id/toggle    flips isAvailable (the registry's switch)
DELETE /admin/technicians/:id       soft (cms.deleted) · ?hard=true is 403 for everyone
PATCH  /admin/technicians/:id/restore   cms.restored
PATCH  /admin/technicians/reorder   204, no effect (profiles have no manual order)
GET    /admin/technicians/users     technicians:write · ?page&limit&q — active people with no live profile
                                    (a dispatcher cannot read /admin/users): { id, name, email, role, label }
GET    /admin/technicians/users/:id technicians:write · one of those, for a form's label
```

A TECHNICIAN or SURVEYOR account gets its profile when it is created (Phase G); `POST` is for older accounts
and office staff who also go out.

### Job templates, materials and stock

`/admin/job-templates` (`jobs:read` / `jobs:write`), `/admin/materials`, `/admin/material-categories` and
`/admin/suppliers` (`materials:read` / `materials:write`) answer the same nine calls as a CMS resource (see
"Admin — CMS": list, get, create, partial update, toggle, reorder, soft delete, restore, history), through the
same mounter (`routes/admin/mountResource.js`). *Changed in H1:* toggle, restore and history are new for these
four; the history needs the resource's read capability. `?hard=true` still needs `cms:purge`.

```
/admin/job-templates                { name, serviceId?, description?, tasks: [{ title, description? }] (1–100),
                                      isActive } · ?serviceId · rows carry service { id, name } · no manual order
/admin/materials                    { code, name, unit, categoryId?, supplierId?, purchaseRate, sellRate (rupees
                                      in, paisa out), reorderLevel, sortOrder, isActive } · ?categoryId&supplierId
/admin/material-categories          { name, sortOrder, isActive }
/admin/suppliers                    { name, phone?, email?, address?, notes?, isActive } · no manual order

GET  /admin/stock                   ?page&limit&q (name, code)&categoryId&lowOnly=true&includeInactive=true
                                    &sort=sortOrder|name|code|balance ("-" for desc)
                                    rows: the material + category, supplier, balance (derived from movements),
                                    stockValue (balance × purchaseRate, paisa), isLow (reorderLevel > 0 and
                                    balance ≤ it) · meta.lowCount: low rows among the filtered ones
GET  /admin/stock/low               every low material (unpaginated; the reorder list)
GET  /admin/stock/movements         ?page&limit&materialId&jobId&type&from&to (Kathmandu days) — newest first;
                                    rows + material { id, code, name, unit }, actor { id, name } | null,
                                    job { id, number } | null
POST /admin/stock/movements         materials:write · { materialId, type: PURCHASE|RETURN|ADJUSTMENT|WASTAGE,
                                      qty (≠ 0; signed for ADJUSTMENT, magnitude otherwise), rate? (rupees),
                                      jobId?, reference?, note? }
                                    ISSUE_TO_JOB is 400 here — issue from the job, which writes its material
                                    line in the same transaction
```

A movement that leaves a material at or below its reorder level notifies ADMIN and DISPATCHER in-app
(`stock_low`, linking to `/admin/stock?lowOnly=true&open=<materialId>`). The dashboard's `stockLow` card
(ADMIN, DISPATCHER) counts the low materials.

## Field app (`TECHNICIAN`, `SURVEYOR` — scoped to own assignments)

`ADMIN` and `DISPATCHER` may also call these; with `?technicianId=` they act on that
technician's queue, and without one they have an empty queue rather than an error.

```
GET   /tech/jobs/today
GET   /tech/jobs                    ?from&to
GET   /tech/jobs/:id
PATCH /tech/jobs/:id/status         EN_ROUTE | IN_PROGRESS | ON_HOLD | COMPLETED
PATCH /tech/jobs/:id/tasks/:taskId
POST  /tech/jobs/:id/photos         multipart `files` + `kind`
POST  /tech/jobs/:id/materials
POST  /tech/jobs/:id/time/start  |  /time/stop
POST  /tech/jobs/:id/complete       { note, signatureMediaId, customerRating? }
POST  /tech/sync                    offline mutation queue replay (idempotency keys)

GET   /tech/surveys                 ?status              own surveys
GET   /tech/surveys/:id
POST  /tech/jobs/:id/survey         create-or-return for this INSPECTION job (201, then 200)
PUT   /tech/surveys/:id             save draft — fields + readings + items, FULL REPLACE
POST  /tech/surveys/:id/submit      DRAFT|RETURNED -> SUBMITTED, closes the inspection job
POST  /tech/surveys/:id/photos      multipart -> JobPhoto{ kind: 'ISSUE' } on the parent job
GET   /tech/materials               offline reference — id, code, name, unit. NO rate.
GET   /tech/rate-card               offline reference — id, code, name, unit. NO rate.
```

`/tech` responses never carry money. `PUT /tech/surveys/:id` accepts quantities only; a
payload carrying `rate` or `amount` is rejected (400), not silently ignored.

`sync` gains the mutation kinds `survey_draft` and `survey_submit`, which address a
`surveyId` instead of a `jobId`. A replayed `survey_submit` on a survey that is still
`SUBMITTED` is a no-op: it comes back `applied`, and the survey is unchanged whatever payload
the replay carries. Once the office has moved the survey on (`IN_REVIEW`, `QUOTED`), a submit is
refused with 422 `INVALID_TRANSITION`, which the client treats as terminal and drops.

## Admin — Finance (`ADMIN`, `ACCOUNTANT`)

```
/admin/invoices                     GET ?status&customerId&overdueOnly&from&to&q, POST, GET /:id, PUT /:id
                                    no DELETE — an invoice is voided, never removed
GET    /admin/invoices/:id/history  invoices:history (ACCOUNTANT, ADMIN) · see "Record history"
POST   /admin/invoices/:id/send
POST   /admin/invoices/:id/void     { reason }
POST   /admin/invoices/from-job/:jobId          once per job — a second is 422
POST   /admin/invoices/:id/payments             payments:write · an overpayment is refused;
                                                status (PARTIAL / PAID) follows the paid total
POST   /admin/invoices/:id/payments/:paymentId/void   payments:write · { reason } (3–500 chars)
                                    -> 200 the payment, with voidedAt, voidReason, voidedById set.
                                    Payments are never deleted (the old DELETE is gone). paidAmount is
                                    recomputed from the payments not voided, and the status follows it
                                    back down: PAID → PARTIAL, or → SENT / OVERDUE (past due) when none
                                    are left. 400 no reason · 404 payment not on this invoice ·
                                    422 already voided
GET    /admin/payments              ?q&method&customerId&from&to    payments:read
                                    q matches the payment reference, invoice number or customer.
                                    Voided payments are listed, flagged by voidedAt — never hidden
/admin/expenses                     GET, GET /:id, POST, PUT /:id, DELETE /:id
GET  /admin/reports/aging
GET  /admin/reports/revenue         ?groupBy=service|month|technician
GET  /admin/reports/collections     ?from&to   payments received, summed by method (voided excluded)
GET  /admin/customers/:id/statement             ledger of invoices and payments (voided excluded)
```

## Admin — Aftercare (reads `ADMIN`, `DISPATCHER`, `SALES`, `MANAGER`; writes `ADMIN`, `DISPATCHER`)

```
/admin/warranties                   GET, GET /expiring ?days, GET /:id, PUT /:id
/admin/warranty-claims              GET, PATCH /:id { status: accepted|rejected|resolved,
                                                      rejectReason?, scheduledStart? }
                                    accepting creates the free WARRANTY job, linked to the original;
                                    rejecting needs a reason
/admin/amc-contracts                GET, GET /renewals-due ?days, POST, GET /:id, PUT /:id, DELETE /:id
                                    POST lays down the visit schedule; visits come back inside GET /:id,
                                    and a cron turns each into a scheduled job a week before it is due
/admin/service-reminders            GET, POST, PUT /:id (pending only — 422 once sent), DELETE /:id
```

## Admin — Platform

Everything here except notifications, the dashboard and the reports is **ADMIN only**: any other role gets 403.

```
GET    /admin/users                 ?q (name, email, phone) &role &isActive=true|false &page &limit
                                    &sort=name|email|role|lastLoginAt|createdAt (± for descending; default name)
                                    400 on an unknown role or sort
                                    row: { id, name, email, phone, role, isActive, lastLoginAt, failedLogins,
                                           lockedUntil (null once it has passed), isLocked, createdAt,
                                           technicianId, technician: { id, employeeCode } | null }
GET    /admin/users/:id             one row, same shape
POST   /admin/users                 { name, email, phone?, role, isActive?, password? } -> 201 row + invited
                                    Without a password (the admin screen) the account gets an unusable one and
                                    a 72-hour "choose your password" email (template account_invite); invited:
                                    true. A TECHNICIAN or SURVEYOR also gets a Technician profile (restored if
                                    the person had one). 409 on a taken email.
PUT    /admin/users/:id             { name?, email?, phone?, role?, isActive? } (partial)
                                    400 if the body has password ("send a reset link instead"); 400 if an
                                    admin disables themselves or changes their own role. A change to a field
                                    role creates or restores the Technician profile; one away from it keeps it.
                                    isActive=false also revokes every session.
PATCH  /admin/users/:id/toggle      enable ⇄ disable; disabling revokes every session; 400 on yourself
DELETE /admin/users/:id             soft delete; revokes every session; 400 on yourself
POST   /admin/users/:id/send-password-reset
                                    emails the normal 1-hour reset link -> { sent: true, email }
                                    The token is never in a response or a log. 422 USER_DISABLED for a
                                    disabled account.
POST   /admin/users/:id/unlock      clears failedLogins and lockedUntil -> the user row
GET    /admin/users/:id/sessions    live refresh tokens, newest first:
                                    [{ id, createdAt, expiresAt, ip, userAgent }] — never the token
DELETE /admin/users/:id/sessions    revokes them all -> { revoked: n }. No session can be refreshed; an access
                                    token already issued lives out its 15 minutes (disable the account to
                                    stop it at once).
GET    /admin/users/:id/history     see "Record history"
                                    404 on any unknown :id.
                                    events: user.created (meta.invited) · user.role_changed · user.disabled
                                    (toggle off, PUT isActive=false, DELETE; meta.sessionsRevoked, meta.deleted)
                                    · auth.password_reset_requested (meta.by=admin, meta.purpose=invite)
                                    · auth.unlocked · auth.sessions_revoked (meta.count)

GET    /admin/login-activity        the auth.* events, newest first
                                    ?userId &event (an auth.* name; anything else is 400) &ip &from &to
                                    &q (a user's name or email, or the address typed on a failed sign-in)
                                    &page &limit &sort=createdAt|-createdAt
                                    row: { id, event, createdAt, user: { id, name, email, role, isActive } | null,
                                           email, reason, attempt, actorType, actorId, ip, userAgent, requestId,
                                           before, after, changes }
                                    user is null for an address with no account; email is what was typed.
GET    /admin/login-activity/summary
                                    one row per account: { user, lastLoginAt, failures24h, lockedUntil, isLocked }
                                    ?attention=true (locked now, or a failure in the last 24 hours) &q &page &limit
                                    locked accounts first, then by name

GET    /admin/audit-logs            paginated, newest first
                                    ?event (a name, or prefix.* for every event of a prefix — auth.*)
                                     &actorType=user|public|system&requestId&model&recordId&actorId
                                     &action&from&to&q&page&limit&sort=createdAt|-createdAt
                                    q matches event/model/action (contains) or recordId/requestId (exact)
                                    400 on an unknown actorType or sort, or a malformed event
                                    row: { id, event, action, model, recordId, actorId, actorType,
                                           requestId, ip, userAgent, before, after, changes, createdAt,
                                           actor: { id, name, role } | null }
GET    /admin/audit-logs/models     every model the log has rows for, e.g. ['Customer', 'Lead', …] (the model filter)

GET    /admin/message-templates     ?key &channel=sms|email|inapp &locale=en|ne &q (key, subject, body)
                                    &sort=key|updatedAt (±) &page &limit
GET    /admin/message-templates/groups
                                    one row per key, a page of keys at a time:
                                    [{ key, variants: [{ id, channel, locale, subject, isActive, updatedAt }] }]
                                    ?q (key or body) &channel &page &limit
POST   /admin/message-templates     { key, channel, locale?, subject?, body, isActive? } — key is lower-case
                                    letters, digits and _; 409 on a taken key+channel+locale
GET    /admin/message-templates/:id
PUT    /admin/message-templates/:id (partial)
DELETE /admin/message-templates/:id removed for good (event cms.purged); the code falls back to its own text
POST   /admin/message-templates/:id/preview
                                    { vars?, subject?, body? } — subject/body are unsaved text that wins over
                                    the stored template
POST   /admin/message-templates/preview
                                    { vars?, subject?, body } — text not saved yet (body required, else 400)
                                    -> { subject | null, body, placeholders: ['name', 'quotation.number'],
                                         missing: ['link'] }
                                    Placeholders are {{name}} or {{ dotted.path }}; a missing or empty var
                                    renders as ''. 404 for an unknown :id.

GET    /admin/message-logs          newest first · ?channel=sms|email &status=queued|sent|failed &templateKey
                                    &relatedModel &relatedId &from &to &q (part of the address)
                                    &page &limit &sort=createdAt|-createdAt · 400 on anything else
                                    row: { id, channel, templateKey, toAddress (masked: a phone keeps its last
                                           four digits — ******4567; an email its first two letters and its
                                           domain — ra***@example.com), subject, body, provider, providerId,
                                           status, error, relatedModel, relatedId, createdAt }
                                    A one-time link's token is never shown: messages carrying one are logged
                                    with it replaced by [redacted], and older rows are scrubbed on the way out.
POST   /admin/message-logs/:id/retry
                                    sends a failed message again from its log -> the row, status sent or failed
                                    422 NOT_RETRYABLE unless status is failed, or when the log had a secret
                                    taken out (a password link — send a new one); 404 for an unknown id.
                                    event: message.retried (before { status, error } → after { status })

GET   /admin/notifications          own only · ?unreadOnly · meta.unread
                                    `link` is an SPA path the panel opens as it is: `/admin/...` for office
                                    staff (`/admin/leads/:id`, `/admin/quotations/:id`, `/admin/surveys/:id`,
                                    `/admin/jobs/:id`, `/admin/materials/:id`, `/admin/warranty-claims/:id`,
                                    `/admin/leads`, `/admin/invoices?overdueOnly=true`,
                                    `/admin/amc-contracts?renewals=true`), `/tech/...` for technicians and
                                    surveyors (`/tech/jobs/:id`, `/tech/surveys/:id`). A link in an SMS or
                                    email is absolute on the web origin (PUBLIC_WEB_ORIGIN), never APP_URL.
                                    Types include lead_new, lead_assigned, lead_sla_warn, lead_sla_breach,
                                    quotation_submitted, quotation_office_approved, quotation_sent_back,
                                    quotation_accepted, quotation_changes_requested, quotation_rejected,
                                    survey_submitted, job_completed… Quotation notifications go to named
                                    people, once each (a salesperson who also wrote the quotation gets one).
                                    quotation_approved (pre-Phase F rows) is no longer written.
PATCH /admin/notifications/:id/read  ·  PATCH /admin/notifications/read-all
GET   /admin/dashboard              every role · role-aware widget payload
                                    cards added in Phase F: quotationsPendingApproval,
                                    quotationsChangesRequested, quotationsAwaitingCustomer (SALES, MANAGER,
                                    ADMIN) and acceptedJobsUnscheduled — DRAFT jobs from a quotation with no
                                    scheduledStart (DISPATCHER, MANAGER, ADMIN). MANAGER also gets funnel and sla.
                                    added in Phase H1: stockLow — materials at or below their reorder level
                                    (DISPATCHER, ADMIN).
GET   /admin/reports/lead-sources | /funnel | /sla                  reports:sales
GET   /admin/reports/job-margin | /technicians | /warranty-claims   reports:ops
```

## Audit log

Two kinds of `AuditLog` row, both carrying `requestId`, `actorId`, `actorType`, `ip` and `userAgent`
from the request (or `<task>:<job id>` and `system` for background work):

- **Model change** — written automatically by the Prisma extension for `create`, `createMany`, `update`,
  `updateMany`, `upsert`, `delete`, `deleteMany` on every model except `AuditLog`, `RefreshToken`,
  `PasswordReset`, `MessageLog`, `Notification`, `JobStatusEvent`, `LeadActivity`, `Counter`.
  `event` is null, `action` is the operation without `Many`, `before`/`after` hold only the scalar
  columns that changed (redacted: anything named `*password*`, `*token*`, `*secret*`, `otp*`), one row
  per record for bulk writes (the first 500; past that a warning is logged). `changes` is null.
- **Domain event** — a named business moment. `action` is the part after the dot, `before`/`after`
  hold the fields that describe it, and `changes` holds extra detail (`meta`). Written in the same
  transaction as the change, so a rollback removes it too.

Rows written before Phase B have `changes` holding the sanitized write data, no `before`/`after`, and
`actorType` `user`.

| Event | Fires when | before → after · meta |
|---|---|---|
| `lead.created` | a lead is created from the public form (`public`) or by staff | → status, source, priority, serviceId, assignedToId |
| `lead.status_changed` | any lead status move (`transitionLead`: staff, convert, approval, survey quote, merge) | status → status · note |
| `lead.assigned` | `PATCH /admin/leads/:id/assign` | assignedToId → assignedToId · note |
| `lead.merged` | `POST /admin/leads/merge`, on the primary lead | · duplicateIds |
| `lead.converted` | `POST /admin/leads/:id/convert` | customerId → customerId · quotationId, jobId, surveyId |
| `lead.activity_logged` | `POST /admin/leads/:id/activities` | firstResponseAt null → the time, when this entry stopped the clock · activityId, type, summary |
| `customer.email_confirmed` | convert with `confirmEmail` puts the lead's email on an existing customer (actor = the staff member) | email → email · leadId |
| `quotation.created` | a quotation is created (admin, convert, survey quote) | → number, status, total, customerId, leadId |
| `quotation.submitted` | `POST /admin/quotations/:id/submit` | DRAFT → PENDING_APPROVAL, total |
| `quotation.auto_approved` | the same submit, when the total is below `quotation.autoApproveBelow` (actorType `system`, actorId null) | PENDING_APPROVAL → OFFICE_APPROVED · total, threshold |
| `quotation.office_approved` | `POST /admin/quotations/:id/approve` | PENDING_APPROVAL → OFFICE_APPROVED · note |
| `quotation.sent_back` | `POST /admin/quotations/:id/send-back` | PENDING_APPROVAL → DRAFT · note |
| `quotation.pulled_back` | `POST /admin/quotations/:id/pull-back` | OFFICE_APPROVED → DRAFT · note |
| `quotation.sent` | `POST /admin/quotations/:id/send` | OFFICE_APPROVED → SENT |
| `quotation.customer_approved` | the customer accepts by link (`public`); `job.created` and `lead.status_changed` follow in the same transaction | SENT → APPROVED · note |
| `quotation.customer_changes_requested` | the customer asks for changes by link (`public`) | SENT → CHANGES_REQUESTED · note |
| `quotation.customer_rejected` | the customer declines by link (`public`) | SENT → REJECTED · note |
| `quotation.expired` | a SENT quotation past `validUntil` is expired by the link or the `quotation:expire` task | SENT → EXPIRED |
| `quotation.revised` | `POST /admin/quotations/:id/revise`, on the new version | → number, version, status, total · parentId, version |
| `quotation.superseded` | the same revise, on the version it replaces | status → SUPERSEDED · supersededById, number, version |
| `job.created` | a job is created (admin, convert, quotation) | → number, type, status, customerId, quotationId, leadId, technicianIds |
| `job.status_changed` | `PATCH …/jobs/:id/status` (admin or field app), except completion | status → status · note |
| `job.assigned` | `POST /admin/jobs/:id/assign` | technicianIds, status → technicianIds, status |
| `job.scheduled` | `POST /admin/jobs/:id/schedule` (the dispatch board) | status, scheduledStart, scheduledEnd, technicianIds → the same |
| `job.completed` | a job is completed (admin, field app, survey submit) | status → COMPLETED · customerRating |
| `job.verified` | `POST /admin/jobs/:id/verify` | COMPLETED → VERIFIED |
| `invoice.created` | an invoice is created (admin or from a job) | → number, status, total, customerId, quotationId |
| `invoice.sent` | `POST /admin/invoices/:id/send` | status → SENT |
| `invoice.voided` | `POST /admin/invoices/:id/void` | status → VOID · reason |
| `payment.recorded` | `POST /admin/invoices/:id/payments` (model `Payment`) | → invoiceId, amount (paisa), method, reference · invoiceStatus, paidAmount |
| `payment.voided` | `POST …/payments/:paymentId/void` (model `Payment`) | voidedAt, amount → voidedAt, voidReason · invoiceId, invoiceStatus, paidAmount |
| `survey.submitted` | the surveyor submits (model `SiteSurvey`) | DRAFT/RETURNED → SUBMITTED · jobId, lines |
| `survey.returned` | `PATCH /admin/surveys/:id/review` with RETURNED | status → RETURNED · note |
| `survey.quoted` | `POST /admin/surveys/:id/quotation` | status → QUOTED · quotationId, quotationNumber |
| `auth.login` | a successful sign-in (actor = the user) | |
| `auth.login_failed` | a wrong password, a locked or disabled account, or an unknown email (`public`; recordId null, `meta.email` for the last) | · reason, attempt |
| `auth.locked` | the fifth consecutive failure locks the account | → lockedUntil · attempts |
| `auth.logout` | `POST /auth/logout` with a live refresh cookie (actor = the user) | |
| `auth.password_changed` | `POST /auth/change-password` or `POST /auth/reset-password` | · via: change_password \| reset_link |
| `auth.password_reset_requested` | `POST /auth/forgot-password` for an existing, active account (nothing is written for an unknown email); an admin's `send-password-reset` (actor = the admin); a new account's invite | · by: admin, purpose: invite |
| `auth.unlocked` | `POST /admin/users/:id/unlock` | failedLogins, lockedUntil → 0, null |
| `auth.sessions_revoked` | `DELETE /admin/users/:id/sessions` | · count |
| `settings.changed` | `PATCH /admin/settings`, once per save, only the keys whose value moved | { key: old } → { key: new } · keys |
| `export.csv` | `GET /admin/leads/export.csv` | · the filters used |
| `cms.deleted` | a soft delete through the CRUD factory (any resource it mounts — content, materials, job templates), a technician profile, or `DELETE /admin/media/:id` | |
| `cms.restored` | `PATCH …/:id/restore` | deletedAt → null |
| `cms.purged` | `?hard=true` (needs `cms:purge`), or a delete on a resource with no soft delete | the removed row's scalars → |
| `user.created` · `user.role_changed` · `user.disabled` | see `/admin/users` above | |
| `message.retried` | `POST /admin/message-logs/:id/retry` (model `MessageLog`) | status, error → status · channel, templateKey |

Every name above is emitted (Phase F1 implemented the ones that were reserved). The list lives in
`MaintainanceBackend/src/shared/enums.js` (`AUDIT_EVENTS`); `recordEvent` refuses any other name.

## Not implemented

- Quotation, invoice and payment-receipt PDFs. The public token pages render the document in
  HTML and print cleanly; add a headless-browser renderer if a PDF file is required.
