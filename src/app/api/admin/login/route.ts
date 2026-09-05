import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, adminCookieOptions, createAdminSession, getAdminPrincipal, isAdminConfigured,
  rejectCrossOrigin, revokeAdminSession, verifyAdminPassword, verifyAdminTotp } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { getRedis } from '@/lib/redis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  try {
    const principal = await getAdminPrincipal(request);
    return NextResponse.json({ authenticated: Boolean(principal), principal, mfaRequired: process.env.NODE_ENV === 'production' || Boolean(process.env.ADMIN_TOTP_SECRET) }, { headers });
  } catch { return NextResponse.json({ message: 'Admin authentication is temporarily unavailable' }, { status: 503, headers }); }
}

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request); if (crossOrigin) return crossOrigin;
  if (!isAdminConfigured()) return NextResponse.json({ message: 'Owner login is not configured' }, { status: 503, headers });
  const body = await readJsonBody(request, 4096); if (!body.ok) return body.response;
  try {
    const redis = getRedis();
    for (const [key, limit] of [[`rate-limit:admin:login:${getClientIp(request)}`, 10], ['rate-limit:admin:login:site', 100]] as const) {
      if (!(await checkRateLimit(redis, { key, limit, windowSeconds: 900 })).allowed) return NextResponse.json({ message: 'Too many login attempts. Please try later.' }, { status: 429, headers: { ...headers, 'Retry-After': '900' } });
    }
    if (!verifyAdminPassword(body.value.password) || !await verifyAdminTotp(body.value.code)) return NextResponse.json({ message: 'Invalid password or authenticator code' }, { status: 401, headers });
    await revokeAdminSession(request);
    const token = await createAdminSession();
    const response = NextResponse.json({ authenticated: true }, { headers });
    response.cookies.set(ADMIN_COOKIE_NAME, token, adminCookieOptions());
    return response;
  } catch { return NextResponse.json({ message: 'Admin authentication is temporarily unavailable' }, { status: 503, headers }); }
}

export async function DELETE(request: Request) {
  const crossOrigin = rejectCrossOrigin(request); if (crossOrigin) return crossOrigin;
  try {
    await revokeAdminSession(request);
    const response = NextResponse.json({ authenticated: false }, { headers });
    response.cookies.set(ADMIN_COOKIE_NAME, '', { ...adminCookieOptions(), maxAge: 0 });
    return response;
  } catch { return NextResponse.json({ message: 'Could not revoke session. Please retry logout.' }, { status: 503, headers }); }
}
