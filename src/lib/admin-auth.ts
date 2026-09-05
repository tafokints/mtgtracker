import crypto from 'node:crypto';
import { TOTP } from 'otpauth';
import { NextResponse } from 'next/server';
import { getRedis } from './redis';

export const ADMIN_COOKIE_NAME = 'mtg_admin_session';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const SESSION_IDLE_SECONDS = 30 * 60;
export interface AdminPrincipal { id: string; role: 'owner' }
interface AdminSession { principal: AdminPrincipal; issuedAt: number; expiresAt: number; lastSeenAt: number; fingerprint: string }
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const verifiedRequests = new WeakMap<Request, AdminPrincipal>();

export function ownerIdentity(): AdminPrincipal {
  return { id: process.env.ADMIN_OWNER_ID || 'owner', role: 'owner' };
}

export function isAdminConfigured() {
  const { ADMIN_PASSWORD: password, ADMIN_SESSION_SECRET: secret, ADMIN_TOTP_SECRET: otp } = process.env;
  const validOtp = Boolean(otp && /^[A-Z2-7]{32,128}$/.test(otp));
  return Boolean(password && secret && /^[a-zA-Z0-9._@-]{1,120}$/.test(ownerIdentity().id) &&
    (!otp || validOtp) && (process.env.NODE_ENV !== 'production' ||
      (password.length >= 16 && secret.length >= 32 && process.env.ADMIN_OWNER_ID && validOtp)));
}

export function verifyAdminPassword(value: unknown) {
  if (!isAdminConfigured() || typeof value !== 'string' || value.length > 1024) return false;
  return crypto.timingSafeEqual(crypto.createHash('sha256').update(value).digest(),
    crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD!).digest());
}

function fingerprint() {
  if (!isAdminConfigured()) throw new Error('Admin authentication is not configured');
  return crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET!).update(JSON.stringify([
    'owner-session-v2', ownerIdentity().id, process.env.ADMIN_PASSWORD, process.env.ADMIN_TOTP_SECRET || '',
  ])).digest('hex');
}

export function adminSessionKey(token: string) {
  return `auth:session:v2:${crypto.createHash('sha256').update(token).digest('hex')}`;
}

export async function verifyAdminTotp(value: unknown) {
  const secret = process.env.ADMIN_TOTP_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  if (!isAdminConfigured() || typeof value !== 'string' || !/^\d{6}$/.test(value)) return false;
  const otp = new TOTP({ secret, algorithm: 'SHA1', digits: 6, period: 30 });
  const delta = otp.validate({ token: value, window: 1 });
  if (delta === null) return false;
  const step = Math.floor(Date.now() / 30000) + delta;
  // One successful use per time step, including simultaneous login attempts.
  return Boolean(await getRedis().set(`auth:otp:v1:${fingerprint()}:${step}`, 'used', { nx: true, ex: 120 }));
}

export async function createAdminSession() {
  const now = Math.floor(Date.now() / 1000);
  const token = crypto.randomBytes(32).toString('base64url');
  const session: AdminSession = { principal: ownerIdentity(), issuedAt: now, expiresAt: now + SESSION_TTL_SECONDS, lastSeenAt: now, fingerprint: fingerprint() };
  if (!await getRedis().set(adminSessionKey(token), session, { nx: true, ex: SESSION_IDLE_SECONDS })) throw new Error('Session creation failed');
  return token;
}

export const CHECK_ADMIN_SESSION = `
-- validate and touch revocable owner session
local raw = redis.call('GET', KEYS[1])
if not raw then return '' end
local session = cjson.decode(raw)
local now = tonumber(ARGV[1])
if session.fingerprint ~= ARGV[2] or session.expiresAt <= now or session.lastSeenAt + tonumber(ARGV[3]) <= now then
  redis.call('DEL', KEYS[1])
  return ''
end
session.lastSeenAt = now
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', math.min(tonumber(ARGV[3]), session.expiresAt - now))
return cjson.encode(session.principal)
`;

export async function verifyAdminSession(token?: string): Promise<AdminPrincipal | null> {
  if (!token || !TOKEN.test(token) || !isAdminConfigured()) return null;
  const principal = await getRedis().eval<string[], AdminPrincipal | ''>(CHECK_ADMIN_SESSION, [adminSessionKey(token)], [
    String(Math.floor(Date.now() / 1000)), fingerprint(), String(SESSION_IDLE_SECONDS),
  ]);
  return principal && principal.id === ownerIdentity().id && principal.role === 'owner' ? principal : null;
}

export function getAdminSessionFromRequest(request: Request) {
  return (request.headers.get('cookie') || '').split(';').map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${ADMIN_COOKIE_NAME}=`))?.slice(ADMIN_COOKIE_NAME.length + 1);
}

export async function getAdminPrincipal(request: Request) {
  const cached = verifiedRequests.get(request);
  if (cached) return cached;
  const principal = await verifyAdminSession(getAdminSessionFromRequest(request));
  if (principal) verifiedRequests.set(request, principal);
  return principal;
}

export async function isAdminRequest(request: Request) {
  try { return Boolean(await getAdminPrincipal(request)); } catch { return false; }
}

export function rejectCrossOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site' ||
    (origin ? origin !== new URL(request.url).origin : request.headers.get('sec-fetch-site') !== 'same-origin')) {
    return NextResponse.json({ message: 'Same-origin request required' }, { status: 403 });
  }
  return null;
}

export async function requireAdmin(request: Request) {
  try {
    if (!await getAdminPrincipal(request)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (!['GET', 'HEAD'].includes(request.method)) return rejectCrossOrigin(request);
    return null;
  } catch { return NextResponse.json({ message: 'Admin authentication is temporarily unavailable' }, { status: 503 }); }
}

export async function revokeAdminSession(request: Request) {
  const token = getAdminSessionFromRequest(request);
  if (token && TOKEN.test(token)) await getRedis().del(adminSessionKey(token));
  verifiedRequests.delete(request);
}

export function adminCookieOptions() {
  return { httpOnly: true, sameSite: 'strict' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_TTL_SECONDS };
}
