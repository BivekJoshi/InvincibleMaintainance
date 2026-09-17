/**
 * The end-to-end run's addresses and the API's environment, in one place for the config,
 * the global setup and the spec. Ports differ from `npm run dev` (4000 / 5400) on purpose.
 */
const apiPort = Number(process.env.E2E_API_PORT || 4010);
const webPort = Number(process.env.E2E_WEB_PORT || 5410);
const databaseUrl = process.env.E2E_DATABASE_URL
  || process.env.TEST_DATABASE_URL
  || 'postgresql://maintainance:maintainance@127.0.0.1:5432/maintainance_test?schema=public';

const dbName = new URL(databaseUrl).pathname.slice(1);
if (!dbName.endsWith('_test')) {
  throw new Error(`Refusing to run the end-to-end suite against "${dbName}" — the database name must end in _test.`);
}

const webUrl = `http://localhost:${webPort}`;

export const E2E = {
  apiPort,
  webPort,
  databaseUrl,
  webUrl,
  apiUrl: `http://localhost:${apiPort}`,
  apiBase: `http://localhost:${apiPort}/api/v1`,
  password: 'Password123',
  users: {
    ADMIN: 'admin@gharjatan.com.np',
    SALES: 'sales@gharjatan.com.np',
    MANAGER: 'manager@gharjatan.com.np',
    DISPATCHER: 'dispatch@gharjatan.com.np',
    SURVEYOR: 'survey@gharjatan.com.np',
  },
  /** The API's environment. Values already set (a developer's .env, CI) are kept for the secrets only. */
  apiEnv: {
    NODE_ENV: 'test',
    PORT: String(apiPort),
    DATABASE_URL: databaseUrl,
    PUBLIC_WEB_ORIGIN: webUrl,
    ADMIN_ORIGIN: webUrl,
    APP_URL: `http://localhost:${apiPort}`,
    COOKIE_SECURE: 'false',
    COOKIE_DOMAIN: 'localhost',
    REDIS_URL: '',
    SMTP_HOST: '',
    SMS_DRIVER: 'console',
    TURNSTILE_SECRET: '',
    LOG_LEVEL: 'warn',
    // The run books, logs in and answers from one address.
    LEAD_RATE_LIMIT_PER_HOUR: '1000',
    JWT_SECRET: process.env.JWT_SECRET || 'e2e-only-jwt-secret-0123456789abcdef0123456789',
    REFRESH_SECRET: process.env.REFRESH_SECRET || 'e2e-only-refresh-secret-0123456789abcdef012345',
  },
};
