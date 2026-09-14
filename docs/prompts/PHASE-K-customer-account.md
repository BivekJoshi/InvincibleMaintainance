# Phase K — Optional customer accounts (email signup, earlier history)

~6 days · branch `admin/phase-k-customer-accounts` · **after launch** (requires A–J3, and Phase E's
email capture) · decision D8 in docs/ADMIN-PLAN.md §4

````text
You are working in the InvincibleMaintainance repo. This is Phase K of docs/ADMIN-PLAN.md, built
after the system is live.

THE PRINCIPLE — do not break it
An account is NEVER required. Customers book a consultation, receive and accept quotations, get the
work done, and receive invoices and warranty certificates with their contact details only, using the
links we send them. That guest path must keep working exactly as it does today.

What this phase adds: a customer MAY sign up with their email address. Once that email is verified,
the account shows all of their history recorded under that email — including everything from before
they signed up — and everything created with that email afterwards. It is a convenience, not a gate.

DECISIONS
- D8 (decided): signup is by email. History is matched by email: Customer.email and Lead.email,
  compared trimmed and lower-cased. Nothing is shown until the email is verified; otherwise anyone
  could sign up with someone else's address and read their history.
- ASK ME FIRST, in plain language, before building auth: "Should customers sign in with a password,
  or with a one-time code emailed to them each time?" Recommended default: email + password, a
  verification email at signup, and "forgot password" — familiar, and costs no SMS.
- Records with no email or a different email are not matched automatically. Staff can link an
  account to a customer record by hand from the admin customer page; that is audited.
- Production needs working SMTP (docs/API.md + .env.example SMTP_*); development uses the console
  mail driver.
- Customer-facing strings go through the Phase J1 t() catalogue — English + Nepali from day one.
- Reuse, don't duplicate: quotation responses call the Phase F quotation.service functions, warranty
  claims call warranty.service, bookings call the existing public lead intake.

READ FIRST
- CLAUDE.md, MaintainanceFrontend/src/STRUCTURE.md (incl. the J1 i18n section), docs/ADMIN-PLAN.md
  §4 (D4, D8) and §5 Phase K, docs/API.md public + CRM + aftercare, docs/ARCHITECTURE.md security
- Backend: src/services/auth.service.js (argon2, lockout, reset — mirror its rules, do not share its
  tables), src/middleware/authenticate.js, rateLimit.js, src/utils/tokens.js, src/shared/schemas/
  common.js (optionalEmail), quotation.service.js, warranty.service.js, invoice.service.js,
  job.service.js, customer.service.js (timeline, findOrCreateByPhone), lead.service.js,
  notify.service.js, audit.service.js, src/routes/public.routes.js, src/routes/index.js,
  prisma/schema.prisma (Customer, Lead, Quotation, Job, Invoice, Warranty, AmcContract)
- Frontend: src/pages/public/QuotationPublicPage/*, InvoicePublicPage/*, WarrantyPublicPage/*,
  src/components/documents/*, src/components/booking/BookingWizard/*, SiteHeader/*,
  src/api/publicApi.js, src/api/baseQuery.js, src/routes/AppRoutes.jsx, routeModules.js

RULES
- Follow CLAUDE.md. Customer auth is completely separate from staff auth: own tables, own
  middleware, own cookie scoped to /api/v1/customer. A staff token never works on /customer and
  vice versa.
- Every /customer endpoint is scoped server-side to the customer records linked to the session's
  account. Never trust an id from the client without checking that link.
- Customer responses never contain internal data: internal notes, approval notes, costs, margins,
  technician rates or phone numbers, other customers. Enforce with explicit select allowlists, and
  test them.
- Tests first; schema change → one named migration + DATA-MODEL + API docs. Post the plan first.

BACKEND

K1 · Models (migration `customer_accounts`)
CustomerAccount (email unique — stored trimmed lower-case, name, phone?, passwordHash? per the
auth decision, emailVerifiedAt, isBlocked, lastLoginAt, failedLogins, lockedUntil, timestamps,
deletedAt), CustomerAccountLink (accountId, customerId, source 'email'|'staff', linkedById?,
createdAt, @@unique[accountId, customerId]), CustomerSession, CustomerEmailToken (purpose
verify|reset|login_code, tokenHash, expiresAt, usedAt), QuotationMessage (quotationId, author
'customer'|'staff', userId?, accountId?, body, readAt, createdAt). Justify any other change.

K2 · Auth — /api/v1/customer/auth
  POST signup { name, email, password? }       always answers the same way (no enumeration);
                                               sends the verification email
  POST verify-email { token }                  single use, expires in 24h → runs K3 linking
  POST login / logout · POST forgot-password · POST reset-password   (or the emailed-code
                                               equivalents if that was the decision)
  GET  /api/v1/customer/me                     account + linked customers
Rate limits, lockout like staff auth, audit events customer.signup, customer.email_verified,
customer.login, customer.login_failed, customer.linked.

K3 · Linking earlier history — by email only, never by phone
On verification, and again on every login (idempotent): link every non-deleted Customer whose
normalised email equals the account email (source 'email'). Emails reach a customer record only when
the customer typed them in their own booking, staff explicitly confirmed them (Phase E
customer.email_confirmed), or staff edited the record — never because a phone number matched. NEVER
link through phone or altPhone: phones are shared by families and tenants, and recycled. Also surface
Leads with that email that have no customer yet as "your requests". Records created later with that
email appear automatically. If the account email changes: re-verify, drop only source 'email' links,
re-link; keep 'staff' links. Staff: POST/DELETE /admin/customers/:id/account-link (customers:write),
audited.

K4 · Customer API — /api/v1/customer/* (paginated, scoped; read-only unless stated)
  requests         GET — leads under this email not yet converted (status in plain words)
  quotations       GET list · GET :id · POST :id/respond { decision, note } (Phase F service) ·
                   GET/POST :id/messages
  jobs             GET list · GET :id — status, visit window, lead technician first name,
                   checklist progress, AFTER photos once completed
  invoices         GET list · GET :id — lines, payments, balance, how to pay
  warranties       GET list · GET :id · POST :id/claim
  amc              GET — contracts and upcoming visits
  sites            GET
  bookings         POST — a normal Lead with the account's email/phone and chosen site, so it
                   enters the SLA clock and pipeline exactly like a guest booking
Staff: POST /admin/quotations/:id/messages; a customer message notifies the salesperson + quotation
creator; a staff reply emails the customer (and SMSes them if they have a phone on file).

K5 · Links and admin
- Token pages keep working without login and show a small "Sign up with your email to see all your
  work in one place" prompt.
- Admin customer page: account status (none / pending verification / active / blocked), linked
  accounts, link/unlink, block/unblock, "Invite to create an account" email.

FRONTEND

K6 · /account under SiteLayout, lazy-loaded, guarded by the customer session:
- Sign up, verify-email landing, log in, forgot/reset — short forms with clear errors in both languages.
- Home: "needs your attention" (quotations awaiting a response, upcoming visits, unpaid invoices,
  active warranties) and a "your earlier work" list, so a new account immediately shows its history.
- Requests, Quotations (documents + the Phase F buttons + message thread), Jobs (timeline),
  Invoices, Warranties (certificate + claim), Maintenance visits, My sites.
- Book again: BookingWizard prefilled from the account, skipping the contact step.
- Language: the account's language switch also updates preferredLocale on the linked customers
  (Phase E), so SMS and email follow it.
- The guest booking flow and header stay as they are; the header adds "Sign in" / "My account".
K7 · src/api/customerApi.js with its own session handling. It must stay out of the admin bundle and
the marketing entry chunk — check the build output and report it.

TESTS
API:
- no email enumeration on signup / login / forgot;
- nothing linked or visible before verification; verification token single-use and expiring;
- a customer created BEFORE signup with the same email (different case, surrounding spaces) is
  linked after verification; a record with a different email is not;
- shared phone: customer A (email a@…) exists; B books later on the same phone with email b@… and
  staff convert as "same person" WITHOUT confirming the email → an account for b@… sees nothing of A;
- email change re-verifies and keeps staff links;
- IDOR for EVERY /customer endpoint (account A cannot read or act on B's requests, quotations,
  messages, jobs, invoices, warranties, AMC, sites);
- response field allowlist snapshots; staff token rejected on /customer and customer cookie on /admin;
- responding in the account and through the token link stay consistent (second response → 422);
- guest booking and every token link still work with no account (regression);
- account booking creates an SLA lead; staff reply notifies the customer.
vitest: auth form states; attention list; t() keys present in en and ne.

VERIFY
  cd MaintainanceBackend && npm test && npm run test:api && npm run lint
  cd MaintainanceFrontend && npm test && npm run lint && npm run build
Manual at 360px, in Nepali:
 1. as a guest, book a consultation with an email and complete a quotation acceptance via the link (no account)
 2. sign up with the same email typed in capitals → verify (console mail) → the booking, quotation
    and job from step 1 are already there
 3. message about a quotation → staff reply → email arrives
 4. raise a warranty claim; book again
 5. sign up as someone else with a different email → sees none of it

ACCEPTANCE (ADMIN-PLAN Phase K)
Guests can still do everything without an account. A customer who signs up and verifies their
email sees all earlier and later history under that email, can respond, message, claim and rebook
from a phone in Nepali or English, and can never see another customer's data. A security review of
the new surface (auth, linking, IDOR, enumeration) is written into docs/SECURITY-REVIEW.md.

GIT
- Work on a local branch `admin/phase-k-customer-accounts` created from DEVELOPMENT.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase J3's work is present and the system is live. If not, STOP and
  tell me — this phase comes after launch.
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
- docs/API.md: a "Customer accounts" section (/customer/auth/*, /customer/*), staff account-link and
  quotation message endpoints.
- docs/ARCHITECTURE.md: customer auth vs staff auth, the email-linking rule and why verification gates it.
- CLAUDE.md decisions table: "Accounts are optional — guests use contact details; email signup links
  earlier history after verification."
- STRUCTURE.md: /account pages, customerApi and the rule that it stays out of other bundles.
- docs/SECURITY-REVIEW.md: the Phase K section; docs/OPERATIONS.md: SMTP requirement.
- MaintainanceBackend/README.md: how to sign up as a customer in development (console mail driver).
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
The auth decision you were given, models, endpoints, linking rules and their tests, bundle check,
test counts, manual walk-through results, follow-ups.
````
