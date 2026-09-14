# Phase J3 — Security pass, backups & deploy

~2+ days · branch `admin/phase-j3-launch` · requires everything else

````text
You are working in the InvincibleMaintainance repo. This is Phase J (part 3 of 3) of
docs/ADMIN-PLAN.md and v1 docs/PLAN.md Phase 10: harden, back up, deploy, document. Nothing here
should change business behaviour; if a security fix does, stop and ask.

READ FIRST
- CLAUDE.md, docs/PLAN.md Phase 10, docs/ARCHITECTURE.md "Security", docs/ADMIN-PLAN.md §5 Phase J
- MaintainanceBackend: src/app.js (helmet, cors), src/middleware/rateLimit.js, upload.js,
  authenticate.js, src/services/auth.service.js, storage.service.js, src/config/env.js,
  .env.example, docker-compose.yml, package.json
- MaintainanceFrontend: vite.config.js, index.html (inline theme script — CSP impact), public/sw.js,
  package.json

RULES
- No secrets in the repo; everything through env with .env.example entries (CLAUDE.md rule 6).
- Anything destructive against a real database (restore drills, migrations on prod) is written as
  a documented script/runbook for a human to run — do not run it against anything but a throwaway
  local database.
- Post the plan first, with the OWASP checklist you will walk.

TASKS

J3.1 · Security review (write findings to docs/SECURITY-REVIEW.md with severity + fix commit)
- OWASP Top 10 walk over the API: authz on every admin route (script that lists mounted routes and
  their guards; fail CI if any admin route lacks one), IDOR on token and :id routes, mass assignment
  (strict zod on writes), SSRF (any URL fetch), injection (raw SQL usage), rate limits on every
  public POST and auth route, account lockout, refresh rotation reuse detection.
- `npm audit` both apps; upgrade or document accepted risks; pin exact versions.
- Upload: magic-byte check coverage for documents route, size limits, SVG refused or sanitised.
- Headers: CSP for the SPA (nonce or hash for the inline theme script in index.html — keep the
  no-flash behaviour), HSTS, frame-ancestors, referrer-policy; cookie flags in production.
- PII: phone/email masked in logs (Phase B) — verify; PII exports audited — verify; access to
  customer statements audited.
- Public token links: entropy, single purpose, expiry where applicable, no enumeration timing.

J3.2 · Backups
scripts/backup.sh: nightly pg_dump (custom format) + uploads directory sync to off-site storage
(S3-compatible, env-configured), retention (7 daily, 4 weekly, 6 monthly), checksum, failure
alert hook. scripts/restore.sh + a documented restore drill that restores into a throwaway
database and runs a smoke query set. Run the drill locally against a throwaway DB and paste the
result into docs/OPERATIONS.md.

J3.3 · Containers & deploy
Dockerfiles (multi-stage, non-root, healthcheck) for API and worker, static build of the frontend
served by nginx; docker-compose.prod.yml (api, worker, nginx, postgres, redis) with env files not
committed; nginx config: TLS via Let's Encrypt (certbot), gzip/brotli, long cache for hashed
assets, no cache for index.html and sw.js, SPA fallback, /api proxy, /uploads caching, request size
limits. `prisma migrate deploy` on release, never `migrate dev`. Staging + production env examples.

J3.4 · Observability
Sentry (Phase B) verified in a production build for API and frontend (frontend DSN via
config/env.js only); /healthz and /readyz (DB + Redis if configured) wired to container
healthchecks; uptime monitor instructions.

J3.5 · CI
Phase A created .github/workflows/ci.yml; C1 added frontend tests and F2 the end-to-end job. Extend
it: docker image builds for the API, worker and nginx frontend images; `npm audit --audit-level=high`
as a non-blocking report; document the branch-protection rule for DEVELOPMENT (required checks) in
docs/OPERATIONS.md.

J3.6 · Docs
docs/OPERATIONS.md runbook: deploy, rollback, migrations, rotating secrets, backups/restore, log
locations (Phase B LOG_FILE), common incidents (SMS provider down, queue backlog, disk full).
Admin user guide outline (English + Nepali) in docs/USER-GUIDE.md covering each role's daily flow.
STATUS.md final state.

VERIFY
All suites green locally and in CI; `docker compose -f docker-compose.prod.yml up` on a local
machine serves the site over HTTPS (self-signed acceptable locally) with the API healthy; the
restore drill result recorded; the route-guard script passes.

ACCEPTANCE (v1 Phase 10)
Security review documented with every High fixed; backups verified by an actual restore; deploy
reproducible from the repo plus env files; CI green; runbook and user guide written.

GIT
- Work on a local branch `admin/phase-j3-launch` created from DEVELOPMENT.
- ASK ME BEFORE EVERY COMMIT. When a logical chunk of work is ready, show `git status --short`,
  a one-line summary of the change, and the proposed message in the repo's style
  (`feat(api): …`, `fix(web): …`); commit only after I say yes. If I say no, keep working uncommitted.
- Before starting, check that Phase J2's work is present on DEVELOPMENT (its files and migrations
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
- Create docs/OPERATIONS.md, docs/SECURITY-REVIEW.md, docs/USER-GUIDE.md.
- docs/ARCHITECTURE.md "Environments" and "Security" as deployed.
- Both READMEs: production build/deploy sections; STATUS.md final state.
In the report, list every doc above with "updated" or "no change needed — <reason>".

REPORT
Findings table, fixes, accepted risks, drill result, CI link/status, remaining launch blockers.
````
