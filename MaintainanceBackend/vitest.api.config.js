import { defineConfig } from 'vitest/config';

/**
 * The HTTP suite: every route, over supertest, against a real database.
 *
 * One process, one file at a time. The files share a seeded database and the
 * app's in-memory rate-limit and cache stores, so running them in parallel
 * would make one file's writes another file's flake. `isolate: false` also lets
 * the login cache in helpers.js survive between files instead of re-hashing
 * eight argon2 passwords per file.
 */
export default defineConfig({
  test: {
    include: ['tests/api/**/*.test.js'],
    setupFiles: ['tests/api/setup.js'],
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    isolate: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
