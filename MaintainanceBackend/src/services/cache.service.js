import { getRedis, hasRedis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

const memory = new Map();

/**
 * Tag-aware cache. Redis when configured, an in-process Map otherwise so
 * development needs no extra service.
 */
export async function cacheGet(key) {
  if (hasRedis()) {
    try {
      const raw = await getRedis().get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      logger.warn({ err: err.message }, 'cache read failed');
      return null;
    }
  }
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) { memory.delete(key); return null; }
  return hit.value;
}

export async function cacheSet(key, value, ttlSeconds = 60, tags = []) {
  if (hasRedis()) {
    try {
      const redis = getRedis();
      const pipe = redis.pipeline();
      pipe.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      for (const tag of tags) {
        pipe.sadd(`tag:${tag}`, key);
        pipe.expire(`tag:${tag}`, ttlSeconds + 60);
      }
      await pipe.exec();
    } catch (err) {
      logger.warn({ err: err.message }, 'cache write failed');
    }
    return;
  }
  memory.set(key, { value, expires: Date.now() + ttlSeconds * 1000, tags });
}

/** Busts every cached entry carrying any of these tags. */
export async function cacheInvalidate(...tags) {
  if (!tags.length) return;
  if (hasRedis()) {
    try {
      const redis = getRedis();
      for (const tag of tags) {
        const keys = await redis.smembers(`tag:${tag}`);
        if (keys.length) await redis.del(...keys);
        await redis.del(`tag:${tag}`);
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'cache invalidate failed');
    }
    return;
  }
  for (const [key, entry] of memory.entries()) {
    if (entry.tags?.some((t) => tags.includes(t))) memory.delete(key);
  }
}

/** Express middleware caching successful GET responses under a tag. */
export const cached = (ttlSeconds, tag) => async (req, res, next) => {
  const key = `public:${tag}:${req.originalUrl}`;
  const hit = await cacheGet(key);
  if (hit) {
    res.set('X-Cache', 'HIT');
    return res.json(hit);
  }
  res.set('X-Cache', 'MISS');
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      cacheSet(key, body, ttlSeconds, ['public', tag]).catch(() => {});
    }
    return json(body);
  };
  next();
};

export const invalidatePublic = () => cacheInvalidate('public');
