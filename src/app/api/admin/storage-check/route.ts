import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getRedis } from '@/lib/redis';
import { checkRateLimit } from '@/lib/rate-limit';
import { readJsonBody } from '@/lib/request-json';
import { checkPrivateStorage } from '@/lib/storage-check';
import { isBlobStorageConfigured } from '@/lib/blob-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) { Object.entries(headers).forEach(([key, value]) => denied.headers.set(key, value)); return denied; }
  const body = await readJsonBody(request, 1024);
  if (!body.ok) { Object.entries(headers).forEach(([key, value]) => body.response.headers.set(key, value)); return body.response; }
  if (Object.keys(body.value).length !== 1 || body.value.confirm !== 'TEST_PRIVATE_STORAGE') {
    return NextResponse.json({ message: 'Storage test confirmation is required' }, { status: 400, headers });
  }
  if (!isBlobStorageConfigured()) return NextResponse.json({ message: 'Private image storage is not configured' }, { status: 503, headers });
  try {
    if (!(await checkRateLimit(getRedis(), { key: 'rate-limit:admin:storage-check', limit: 3, windowSeconds: 900 })).allowed) {
      return NextResponse.json({ message: 'Storage test limit reached. Try again in 15 minutes.' }, { status: 429, headers: { ...headers, 'Retry-After': '900' } });
    }
    // Client disconnects must not cancel cleanup of the diagnostic file.
    const result = await checkPrivateStorage();
    return NextResponse.json(result, { status: result.ok ? 200 : 503, headers });
  } catch { return NextResponse.json({ message: 'Storage test is temporarily unavailable' }, { status: 503, headers }); }
}
