import { Redis } from '@upstash/redis';

export function getRedisEnvStatus() {
  return {
    hasUpstashUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    hasUpstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    hasKvUrl: Boolean(process.env.KV_REST_API_URL),
    hasKvToken: Boolean(process.env.KV_REST_API_TOKEN),
    hasKvReadOnlyToken: Boolean(process.env.KV_REST_API_READ_ONLY_TOKEN),
    provider:
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? 'upstash'
        : process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
          ? 'vercel-kv'
          : 'missing',
  };
}

export function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error('Missing Redis REST environment variables.');
  }

  return new Redis({ url, token });
}
