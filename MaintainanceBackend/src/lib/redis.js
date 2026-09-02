import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let client = null;

/** Returns a shared ioredis client, or null when REDIS_URL is not configured. */
export function getRedis() {
  if (!env.redisUrl) return null;
  if (client) return client;
  client = new Redis(env.redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });
  client.on('error', (err) => logger.warn({ err: err.message }, 'redis error'));
  return client;
}

export const hasRedis = () => Boolean(env.redisUrl);
