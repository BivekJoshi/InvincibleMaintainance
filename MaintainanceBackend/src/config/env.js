import 'dotenv/config';

/** Read a required env var, exiting the process if missing. */
const required = [];
function req(key, fallback) {
  const v = process.env[key] ?? fallback;
  if (v === undefined || v === '') required.push(key);
  return v;
}
const num = (key, d) => Number(process.env[key] ?? d);
const bool = (key, d = false) => {
  const v = process.env[key];
  if (v === undefined || v === '') return d;
  return v === 'true' || v === '1';
};
const list = (key, d = '') =>
  (process.env[key] ?? d).split(',').map((s) => s.trim()).filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: num('PORT', 4000),
  appName: process.env.APP_NAME ?? 'Maintenance System',
  appUrl: process.env.APP_URL ?? 'http://localhost:4000',

  databaseUrl: req('DATABASE_URL'),

  jwtSecret: req('JWT_SECRET'),
  refreshSecret: req('REFRESH_SECRET'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenTtlDays: num('REFRESH_TOKEN_TTL_DAYS', 30),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  cookieSecure: bool('COOKIE_SECURE', false),

  corsOrigins: [
    ...list('PUBLIC_WEB_ORIGIN', 'http://localhost:5400'),
    ...list('ADMIN_ORIGIN', 'http://localhost:5174'),
  ],

  redisUrl: process.env.REDIS_URL || null,

  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
    publicPath: process.env.PUBLIC_UPLOAD_PATH ?? '/uploads',
    s3: {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? 'us-east-1',
      bucket: process.env.S3_BUCKET,
      accessKey: process.env.S3_ACCESS_KEY,
      secretKey: process.env.S3_SECRET_KEY,
    },
  },

  mail: {
    host: process.env.SMTP_HOST || null,
    port: num('SMTP_PORT', 1025),
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from: process.env.MAIL_FROM ?? 'Maintenance System <no-reply@example.com>',
  },

  sms: {
    driver: process.env.SMS_DRIVER ?? 'console',
    sparrowToken: process.env.SPARROW_TOKEN,
    sparrowFrom: process.env.SPARROW_FROM ?? 'Demo',
    aakashToken: process.env.AAKASH_TOKEN,
  },

  turnstileSecret: process.env.TURNSTILE_SECRET || null,
  leadRateLimitPerHour: num('LEAD_RATE_LIMIT_PER_HOUR', 5),

  business: {
    vatRate: num('VAT_RATE', 13),
    slaLeadMinutes: num('SLA_LEAD_MINUTES', 120),
    slaWarnBeforeMinutes: num('SLA_WARN_BEFORE_MINUTES', 30),
    warrantyDefaultDays: num('WARRANTY_DEFAULT_DAYS', 30),
    currency: process.env.CURRENCY ?? 'NPR',
    timezone: process.env.TIMEZONE ?? 'Asia/Kathmandu',
  },

  logLevel: process.env.LOG_LEVEL ?? 'debug',
  sentryDsn: process.env.SENTRY_DSN || null,
};

if (required.length) {
  console.error(
    `\n[config] Missing required environment variables: ${required.join(', ')}\n` +
      `Copy .env.example to .env and fill them in.\n`,
  );
  process.exit(1);
}

if (env.isProd) {
  const weak = [];
  if (env.jwtSecret.length < 32) weak.push('JWT_SECRET');
  if (env.refreshSecret.length < 32) weak.push('REFRESH_SECRET');
  if (weak.length) {
    console.error(`[config] These secrets must be >= 32 chars in production: ${weak.join(', ')}`);
    process.exit(1);
  }
}
