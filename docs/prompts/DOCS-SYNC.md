# Docs sync — reconcile documentation with the code

Run any time: after a phase, after ad-hoc changes, before a release. Docs only. ~1–2 hours.
Branch `docs/sync-<date>` created from `prabesh`.

````text
You are working in the InvincibleMaintainance repo. Your only job is to make the documentation
match the code as it is RIGHT NOW. You change documentation files only. When the code and a doc
disagree, the code is the truth — unless the code looks like a bug (it breaks a CLAUDE.md rule or a
documented decision), in which case you do NOT change either: you list it under "Conflicts" in the
report for a human to decide.

DOCUMENTS IN SCOPE
- CLAUDE.md
- STATUS.md
- docs/ADMIN-PLAN.md, docs/PLAN.md (historical — banner only), docs/ARCHITECTURE.md,
  docs/API.md, docs/DATA-MODEL.prisma, docs/prompts/*.md (paths and file names they reference)
- MaintainanceBackend/README.md, MaintainanceBackend/.env.example
- MaintainanceFrontend/README.md, MaintainanceFrontend/.env.example, MaintainanceFrontend/src/STRUCTURE.md

METHOD — gather facts from code first, then compare, then edit

1. Routes → docs/API.md
   Write a throwaway script in your scratchpad (not the repo) that imports the Express app from
   MaintainanceBackend/src/app.js and walks the router stack to print METHOD + full path for every
   mounted route, plus the capability/role guard where it can be read (or grep src/routes/** for
   `requires(`/`authorize(`). Diff that list against docs/API.md:
   - routes mounted but undocumented → document them (read the route + service for body, response,
     errors, capability);
   - documented but not mounted → remove them, or move them under "Not implemented";
   - capability/role differences → fix the doc.
   Check the conventions header (money in rupees in, paisa out; pagination params) is still true.

2. Schema → docs/DATA-MODEL.prisma
   Compare with MaintainanceBackend/prisma/schema.prisma. It must mirror it (models, fields, enums,
   relations, indexes). Keep only the explanatory header comment. List migrations in
   prisma/migrations/ that STATUS.md does not mention.

3. Environment → .env.example + READMEs
   Every variable read in MaintainanceBackend/src/config/env.js and MaintainanceFrontend/src/config/env.js
   appears in the matching .env.example with a comment and a safe placeholder (never a real secret);
   no .env.example variable is unused. README env/commands sections match package.json scripts.

4. Seed → README seeded logins and demo description
   Read prisma/seed.js + seed-data.js: users/roles/emails, counts of services/projects/etc., the
   demo pipeline. Fix the README tables and counts.

5. Permissions → README roles table, ADMIN-PLAN §4, docs
   Read src/shared/permissions.js and src/shared/stateMachines.js. Roles, capabilities and state
   diagrams in README.md, ARCHITECTURE.md and API.md must match.

6. Frontend tree → STRUCTURE.md
   List MaintainanceFrontend/src (folders, shared components in components/common, api files,
   routes in routes/AppRoutes.jsx, pages per audience). Fix STRUCTURE.md tables, folder lists and
   examples; every file path it names must exist. Check its rules still describe what the code does
   (e.g. no `index` files, env read only in config/env.js, zodResolver only in useZodForm) — a rule
   the code violates is a Conflict, not a doc edit.

7. Progress → STATUS.md and docs/ADMIN-PLAN.md
   Use `git log --oneline` and the code to decide which ADMIN-PLAN phases/tasks are really done.
   Mark §6 phases ✅ only when their acceptance criteria are met in code (spot-check, say how);
   tick §3 defects that are fixed (cite the file/line that fixes each); keep "Deviations" notes.
   STATUS.md "Done", "Next", "Verification" (run `npm test` in MaintainanceBackend and, if it has
   one, MaintainanceFrontend; run `npm run test:api` only if a *_test database is reachable —
   never create or reset databases) and "Known gaps" must be current.

8. CLAUDE.md
   Repo layout, commands, conventions and the decisions table must match reality. Do not change a
   decision — if the code contradicts one, that is a Conflict.

9. Prompts → docs/prompts/*.md
   File paths, script names, endpoints and seeded logins referenced by not-yet-run phase prompts
   still exist or are updated. Do not rewrite the prompts' intent.

RULES
- Edit documentation files only. No source, test, schema, seed or config changes.
- Preserve each document's voice and structure; fix facts, don't rewrite for style.
- Every factual change must be traceable to a file you read — cite it in the report.
- One commit per document, each only after I approve it (show the files and the message first). Do not push, open a pull request or merge — I review and handle git myself.

VERIFY
`git diff --stat` touches only the documents in scope. Re-run the route script and confirm zero
undocumented / phantom routes.

REPORT
1. Table: document → changes made (one line each) → evidence (file:line).
2. Conflicts: code vs rule/decision disagreements left for a human, with your recommendation.
3. Test results you gathered for STATUS.md.
4. Anything you could not verify and why.
````
