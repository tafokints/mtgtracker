import { Redis } from '@upstash/redis';

interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();

  return (
    forwardedFor ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

export async function checkRateLimit(redis: Redis, options: RateLimitOptions) {
  const count = await redis.incr(options.key);

  if (count === 1) {
    await redis.expire(options.key, options.windowSeconds);
  }

  return {
    allowed: count <= options.limit,
    remaining: Math.max(options.limit - count, 0),
  };
}
