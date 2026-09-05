import crypto from 'crypto';
import { NextResponse } from 'next/server';

export const ADMIN_COOKIE_NAME = 'mtg_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function getAdminSecret() {
  return process.env.ADMIN_SESSION_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'local-dev-admin-secret');
}

export function isAdminConfigured() {
  return Boolean(getAdminPassword() && getAdminSecret());
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? undefined : 'dev-admin');
}

function sign(payload: string) {
  const secret = getAdminSecret();
  if (!secret) throw new Error('Admin session secret is not configured');
  return base64Url(crypto.createHmac('sha256', secret).update(payload).digest());
}

export function verifyAdminPassword(value: unknown) {
  const configured = getAdminPassword();
  if (!configured || typeof value !== 'string') return false;
  return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(value).digest(),
    crypto.createHash('sha256').update(configured).digest(),
  );
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAdminSession() {
  if (!isAdminConfigured()) throw new Error('Admin authentication is not configured');
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(JSON.stringify({
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  }));

  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSession(session?: string) {
  if (!session || !isAdminConfigured()) return false;

  const [payload, signature, extra] = session.split('.');
  if (!payload || !signature || extra !== undefined || !safeEqual(signature, sign(payload))) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
    return Number.isSafeInteger(decoded.exp) && decoded.exp! > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function getAdminSessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const cookie = cookies.find((entry) => entry.startsWith(`${ADMIN_COOKIE_NAME}=`));

  return cookie?.slice(ADMIN_COOKIE_NAME.length + 1);
}

export function isAdminRequest(request: Request) {
  return verifyAdminSession(getAdminSessionFromRequest(request));
}

export function requireAdmin(request: Request) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(request.url).origin)) {
      return NextResponse.json({ message: 'Cross-origin admin requests are not allowed' }, { status: 403 });
    }
  }
  if (isAdminRequest(request)) return null;

  return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
