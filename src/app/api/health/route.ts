import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const ok = await getRedis().ping() === 'PONG';
    return NextResponse.json({ ok }, { status: ok ? 200 : 503, headers: { 'Cache-Control': ok ? 'public, s-maxage=30, max-age=0' : 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
