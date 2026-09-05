import { Redis } from '@upstash/redis';

interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
}

export const BOUNDED_RATE_LIMIT = `
  -- bounded rate limit: increment and expiry must commit together
  local count = redis.call('INCR', KEYS[1])
  if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return count
`;

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
  const count = await redis.eval<number[], number>(BOUNDED_RATE_LIMIT, [options.key], [options.windowSeconds]);

  return {
    allowed: count <= options.limit,
    remaining: Math.max(options.limit - count, 0),
  };
}
