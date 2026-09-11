/**
 * Resets the API test database to a freshly migrated, freshly seeded state.
 *
 *   npm run test:api:prepare
 *
 * The suite writes to the database it runs against, so run this before a clean
 * run. It refuses any database whose name does not end in _test.
 */
import { spawnSync } from 'node:child_process';

const url = process.env.TEST_DATABASE_URL
  ?? 'postgresql://maintainance:maintainance@127.0.0.1:5432/maintainance_test?schema=public';
const dbName = new URL(url).pathname.slice(1);
if (!dbName.endsWith('_test')) {
  console.error(`Refusing to reset "${dbName}" — the database name must end in _test.`);
  process.exit(1);
}

// `migrate reset` drops, re-applies every migration and then runs the seed.
const result = spawnSync('npx', ['prisma', 'migrate', 'reset', '--force'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(result.status ?? 1);
