import { defineConfig, devices } from '@playwright/test';
import { E2E } from './e2e/support/e2eEnv.js';

/**
 * `npm run test:e2e` — the quotation loop in a real browser, against a real API and database.
 *
 * Playwright starts its own two servers, on ports that do not collide with `npm run dev`
 * (API :4010, Vite :5410), so the suite runs while you develop. The API talks to the
 * `*_test` database (`E2E_DATABASE_URL`, default `maintainance_test`), which
 * `e2e/global-setup.js` migrates and seeds first — see MaintainanceFrontend/README.md.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: E2E.webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-GB',
    timezoneId: 'Asia/Kathmandu',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'api',
      command: 'node src/server.js',
      cwd: '../MaintainanceBackend',
      url: `${E2E.apiUrl}/healthz`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: E2E.apiEnv,
    },
    {
      name: 'web',
      command: `npx vite --port ${E2E.webPort} --strictPort`,
      url: E2E.webUrl,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_PROXY_TARGET: E2E.apiUrl },
    },
  ],
});
