import { NextResponse } from 'next/server';
import { getRedis, getRedisEnvStatus } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const env = getRedisEnvStatus();
  const health = {
    ok: false,
    checkedAt: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    redis: {
      env,
      canWrite: false,
      canRead: false,
      canDelete: false,
    },
  };

  try {
    const redis = getRedis();
    const key = `mtgtrackers:health:${Date.now()}`;
    const expected = { ok: true, checkedAt: health.checkedAt };

    await redis.set(key, expected);
    health.redis.canWrite = true;

    const actual = await redis.get<typeof expected>(key);
    health.redis.canRead = actual?.ok === expected.ok && actual.checkedAt === expected.checkedAt;

    await redis.del(key);
    health.redis.canDelete = true;

    health.ok = health.redis.canWrite && health.redis.canRead && health.redis.canDelete;

    return NextResponse.json(health, { status: health.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown health check error';

    return NextResponse.json(
      {
        ...health,
        error: message,
      },
      { status: 500 }
    );
  }
}
