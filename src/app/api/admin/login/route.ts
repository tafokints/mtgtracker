import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  createAdminSession,
  getAdminPassword,
  isAdminRequest,
} from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  return NextResponse.json({ authenticated: isAdminRequest(request) });
}

export async function POST(request: Request) {
  const configuredPassword = getAdminPassword();

  if (!configuredPassword) {
    return NextResponse.json({ message: 'Admin password is not configured' }, { status: 503 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const { password } = body.value as { password?: unknown };
  if (password !== configuredPassword) {
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
