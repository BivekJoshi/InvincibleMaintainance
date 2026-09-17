import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { E2E } from './support/e2eEnv.js';

const backend = fileURLToPath(new URL('../../MaintainanceBackend', import.meta.url));

/**
 * Brings the `*_test` database up to date before the servers start: every migration, then
 * the seed. Both are idempotent, so this never wipes anything — the spec creates its own
 * uniquely named customer and asserts only on what it made, so rows other suites left
 * behind do not matter. For a clean slate, `npm run test:api:prepare` in the backend.
 *
 * CI prepares its fresh service database itself and sets E2E_SKIP_DB_PREPARE=1.
 */
export default function globalSetup() {
  if (process.env.E2E_SKIP_DB_PREPARE === '1') return;
  const env = { ...process.env, DATABASE_URL: E2E.databaseUrl };
  for (const [what, args] of [['migrate', ['prisma', 'migrate', 'deploy']], ['seed', ['node', 'prisma/seed.js']]]) {
    const [cmd, ...rest] = what === 'seed' ? args : ['npx', ...args];
    const result = spawnSync(cmd, rest, { cwd: backend, env, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`e2e database ${what} failed (exit ${result.status})`);
  }
}
