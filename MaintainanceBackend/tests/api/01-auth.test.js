import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import {
  anon, as, withToken, getApp, expectStatus, tokenFor, USERS, PASSWORD, uid,
} from './helpers.js';

const refreshCookie = (res) =>
  (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('refresh_token='))?.split(';')[0];

/** Creates a throwaway account so lockout and password tests never touch a seeded one. */
async function throwawayUser(role = 'SALES') {
  const admin = await as('ADMIN');
  const email = `${uid('u')}@example.com`;
  const res = await admin.post('/admin/users').send({ name: 'Throwaway User', email, password: PASSWORD, role });
  return { ...expectStatus(res, 201).data, email };
}

describe('health', () => {
  it('GET /healthz is up', async () => {
    const res = await request(getApp()).get('/healthz');
    expect(expectStatus(res, 200).status).toBe('ok');
  });

  it('GET /readyz reaches the database', async () => {
    const res = await request(getApp()).get('/readyz');
    expect(expectStatus(res, 200).database).toBe('up');
  });

  it('unknown routes answer in the error envelope', async () => {
    const body = expectStatus(await anon().get('/does-not-exist'), 404);
    expect(body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('POST /auth/login', () => {
  it('signs in every seeded role', async () => {
    for (const role of Object.keys(USERS)) expect(await tokenFor(role)).toBeTruthy();
  });

  it('returns the user, an access token and an httpOnly refresh cookie', async () => {
    const res = await anon().post('/auth/login').send({ email: USERS.SALES, password: PASSWORD });
    const body = expectStatus(res, 200);
    expect(body.data.user.email).toBe(USERS.SALES);
    expect(body.data.user.passwordHash).toBeUndefined();
    expect(body.data.accessToken).toMatch(/^ey/);
    const cookie = (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('refresh_token='));
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('answers a wrong password and an unknown email identically', async () => {
    const wrong = await anon().post('/auth/login').send({ email: USERS.EDITOR, password: 'nope-nope-1' });
    const unknown = await anon().post('/auth/login').send({ email: 'nobody@example.com', password: 'nope-nope-1' });
    expect(wrong.status).toBe(unknown.status);
    expect(wrong.status).toBeGreaterThanOrEqual(400);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('rejects a malformed body with field details', async () => {
    const body = expectStatus(await anon().post('/auth/login').send({ email: 'not-an-email' }), 400);
    expect(body.error.details.map((d) => d.path)).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('locks an account after five failed attempts', async () => {
    const user = await throwawayUser();
    for (let i = 0; i < 5; i += 1) {
      await anon().post('/auth/login').send({ email: user.email, password: `wrong-${i}-Pass` });
    }
    const res = await anon().post('/auth/login').send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/failed attempts/i);
  });

  it('refuses a disabled account', async () => {
    const admin = await as('ADMIN');
    const user = await throwawayUser();
    expectStatus(await admin.patch(`/admin/users/${user.id}/toggle`), 200);
    const res = await anon().post('/auth/login').send({ email: user.email, password: PASSWORD });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('access tokens', () => {
  it('401 without a token', async () => {
    expect(expectStatus(await anon().get('/auth/me'), 401).error.code).toBe('UNAUTHORIZED');
  });

  it('401 with a forged token', async () => {
    expectStatus(await withToken('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad').get('/auth/me'), 401);
  });

  it('GET /auth/me returns the caller and never the hash', async () => {
    const body = expectStatus(await (await as('DISPATCHER')).get('/auth/me'), 200);
    expect(body.data.role).toBe('DISPATCHER');
    expect(body.data.passwordHash).toBeUndefined();
  });

  it('a disabled account is cut off on its next request', async () => {
    const admin = await as('ADMIN');
    const user = await throwawayUser();
    const login = await anon().post('/auth/login').send({ email: user.email, password: PASSWORD });
    const token = expectStatus(login, 200).data.accessToken;
    expectStatus(await admin.patch(`/admin/users/${user.id}/toggle`), 200);
    expectStatus(await withToken(token).get('/auth/me'), 403);
  });
});

describe('refresh tokens', () => {
  let cookie;

  beforeAll(async () => {
    const res = await anon().post('/auth/login').send({ email: USERS.ACCOUNTANT, password: PASSWORD });
    cookie = refreshCookie(res);
  });

  it('POST /auth/refresh rotates the cookie and issues a new access token', async () => {
    const res = await anon().post('/auth/refresh').set('Cookie', cookie);
    const body = expectStatus(res, 200);
    expect(body.data.accessToken).toMatch(/^ey/);
    const next = refreshCookie(res);
    expect(next).toBeTruthy();
    expect(next).not.toBe(cookie);
    const reused = await anon().post('/auth/refresh').set('Cookie', cookie);
    expect(reused.status).toBe(401);
    cookie = next;
  });

  it('POST /auth/refresh without a cookie is 401', async () => {
    expectStatus(await anon().post('/auth/refresh'), 401);
  });

  it('POST /auth/logout revokes the refresh token', async () => {
    expectStatus(await anon().post('/auth/logout').set('Cookie', cookie), 200);
    expectStatus(await anon().post('/auth/refresh').set('Cookie', cookie), 401);
  });
});

describe('passwords', () => {
  it('POST /auth/forgot-password answers the same for known and unknown emails', async () => {
    const known = expectStatus(await anon().post('/auth/forgot-password').send({ email: USERS.EDITOR }), 200);
    const unknown = expectStatus(await anon().post('/auth/forgot-password').send({ email: 'ghost@example.com' }), 200);
    expect(known.data.message).toBe(unknown.data.message);
  });

  it('POST /auth/reset-password rejects a token that was never issued', async () => {
    const res = await anon().post('/auth/reset-password').send({ token: 'x'.repeat(40), password: 'NewPassword1' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /auth/change-password needs the current password, then revokes old sessions', async () => {
    const user = await throwawayUser();
    const login = await anon().post('/auth/login').send({ email: user.email, password: PASSWORD });
    const token = expectStatus(login, 200).data.accessToken;
    const cookie = refreshCookie(login);

    const wrong = await withToken(token).post('/auth/change-password').send({ currentPassword: 'wrong', password: 'Changed123' });
    expect(wrong.status).toBeGreaterThanOrEqual(400);

    expectStatus(await withToken(token).post('/auth/change-password').send({ currentPassword: PASSWORD, password: 'Changed123' }), 200);
    expectStatus(await anon().post('/auth/refresh').set('Cookie', cookie), 401);
    expectStatus(await anon().post('/auth/login').send({ email: user.email, password: 'Changed123' }), 200);
  });

  it('rejects a weak new password', async () => {
    const user = await throwawayUser();
    const login = await anon().post('/auth/login').send({ email: user.email, password: PASSWORD });
    const token = expectStatus(login, 200).data.accessToken;
    expectStatus(await withToken(token).post('/auth/change-password').send({ currentPassword: PASSWORD, password: 'short' }), 400);
  });
});
