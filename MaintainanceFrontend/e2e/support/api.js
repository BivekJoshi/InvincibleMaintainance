import { expect, request } from '@playwright/test';
import { E2E } from './e2eEnv.js';

/**
 * The set-up and assertion side of the end-to-end test: plain HTTP against the API it
 * started, signed in as a seeded user. The browser does the steps a person takes.
 */
export async function apiAs(role) {
  const ctx = await request.newContext({ baseURL: `${E2E.apiBase}/`, extraHTTPHeaders: { 'X-Forwarded-For': `10.99.0.${Math.floor(Math.random() * 200) + 1}` } });
  const login = await ctx.post('auth/login', { data: { email: E2E.users[role], password: E2E.password } });
  expect(login.status(), `login as ${role}`).toBe(200);
  const { accessToken, user } = (await login.json()).data;
  const headers = { Authorization: `Bearer ${accessToken}` };

  const call = async (method, path, data) => {
    const res = await ctx.fetch(path.replace(/^\//, ''), { method, headers, ...(data !== undefined ? { data } : {}) });
    const body = await res.json().catch(() => ({}));
    if (res.status() >= 400) throw new Error(`${method} ${path} as ${role} → ${res.status()} ${JSON.stringify(body)}`);
    return body;
  };

  return {
    user,
    get: (path) => call('GET', path).then((b) => b.data),
    list: (path) => call('GET', path),
    post: (path, data = {}) => call('POST', path, data).then((b) => b.data),
    put: (path, data = {}) => call('PUT', path, data).then((b) => b.data),
    patch: (path, data = {}) => call('PATCH', path, data).then((b) => b.data),
    dispose: () => ctx.dispose(),
  };
}

/** Signs a browser page in through the login screen. */
export async function signIn(page, role) {
  await page.goto('/login');
  // By id: the labels carry a required marker, so their accessible names are not exactly the words.
  await page.locator('#email').fill(E2E.users[role]);
  await page.locator('#password').fill(E2E.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}
