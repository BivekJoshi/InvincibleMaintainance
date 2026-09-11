import { configDefaults, defineConfig } from 'vitest/config';

// `npm test` is the fast, database-free unit suite. The HTTP suite needs a live
// Postgres and runs on its own: `npm run test:api` (see vitest.api.config.js).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'tests/api/**'],
  },
});
