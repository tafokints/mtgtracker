import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  createAdminSession,
  isAdminConfigured,
  isAdminRequest,
  verifyAdminPassword,
} from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { getRedis } from '@/lib/redis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  return NextResponse.json({ authenticated: isAdminRequest(request) });
}

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ message: 'Admin authentication is not configured' }, { status: 503 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const { password } = body.value as { password?: unknown };

  try {
    const rateLimit = await checkRateLimit(getRedis(), {
      key: `rate-limit:admin:login:${getClientIp(request)}`,
      limit: 10,
      windowSeconds: 15 * 60,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json({ message: 'Too many login attempts. Please try again later.' }, {
        status: 429,
        headers: { 'Retry-After': '900' },
      });
    }
  } catch (error) {
    console.error('Admin login rate limit unavailable:', error);
    return NextResponse.json({ message: 'Admin login is temporarily unavailable' }, { status: 503 });
  }

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ message: 'Invalid password' }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(ADMIN_COOKIE_NAME, createAdminSession(), adminCookieOptions());

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    ...adminCookieOptions(),
    maxAge: 0,
  });

  return response;
}
