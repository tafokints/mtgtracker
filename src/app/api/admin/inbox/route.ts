import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getRedis } from '@/lib/redis';
import { InboxInputError, readAdminInbox } from '@/lib/admin-inbox';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) { Object.entries(headers).forEach(([key, value]) => denied.headers.set(key, value)); return denied; }
  try {
    return NextResponse.json(await readAdminInbox(getRedis(), new URL(request.url).searchParams), { headers });
  } catch (error) {
    return NextResponse.json({ message: error instanceof InboxInputError ? error.message : 'The inbox is temporarily unavailable. No reports have been changed.' },
      { status: error instanceof InboxInputError ? 400 : 503, headers });
  }
}
