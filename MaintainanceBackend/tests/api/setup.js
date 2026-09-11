/**
 * Runs before every API test file, and before the app is imported — so the
 * values set here win over .env (dotenv never overrides a variable that is
 * already set).
 *
 * The suite writes freely, so it refuses to run against anything that is not
 * visibly a test database. Point it elsewhere with TEST_DATABASE_URL.
 */
const url = process.env.TEST_DATABASE_URL
  ?? 'postgresql://maintainance:maintainance@127.0.0.1:5432/maintainance_test?schema=public';

const dbName = new URL(url).pathname.slice(1);
if (!dbName.endsWith('_test')) {
  throw new Error(`Refusing to run the API suite against "${dbName}" — the database name must end in _test.`);
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: url,
  LOG_LEVEL: 'silent',
  REDIS_URL: '',
  SMTP_HOST: '',
  SMS_DRIVER: 'console',
  TURNSTILE_SECRET: '',
});

// Secrets for a checkout with no .env at all (CI). A developer's .env wins.
process.env.JWT_SECRET ||= 'api-test-jwt-secret-0123456789abcdef0123456789';
process.env.REFRESH_SECRET ||= 'api-test-refresh-secret-0123456789abcdef012345';
