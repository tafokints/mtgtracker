import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getRedis } from '@/lib/redis';
import { checkRateLimit } from '@/lib/rate-limit';
import { readJsonBody } from '@/lib/request-json';
import { InventoryInputError, readStorageInventory } from '@/lib/storage-inventory';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Vary': 'Cookie' };

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) { Object.entries(headers).forEach(([key, value]) => denied.headers.set(key, value)); return denied; }
  const body = await readJsonBody(request, 16 * 1024);
  if (!body.ok) { Object.entries(headers).forEach(([key, value]) => body.response.headers.set(key, value)); return body.response; }
  if (Object.keys(body.value).some((key) => key !== 'cursor')) return NextResponse.json({ message: 'Only an inventory cursor is accepted' }, { status: 400, headers });
  try {
    const redis = getRedis();
    if (!(await checkRateLimit(redis, { key: 'rate-limit:admin:storage-inventory', limit: 120, windowSeconds: 3600 })).allowed) {
      return NextResponse.json({ message: 'Inventory request limit reached. Try again later.' }, { status: 429, headers: { ...headers, 'Retry-After': '3600' } });
    }
    return NextResponse.json(await readStorageInventory(redis, body.value.cursor), { headers });
  } catch (error) {
    return NextResponse.json({ message: error instanceof InventoryInputError ? error.message : 'Storage inventory is temporarily unavailable' }, { status: error instanceof InventoryInputError ? 400 : 503, headers });
  }
}
