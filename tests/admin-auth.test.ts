import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOTP } from 'otpauth';
import { ADMIN_COOKIE_NAME, adminCookieOptions, adminSessionKey, createAdminSession, getAdminSessionFromRequest, isAdminConfigured,
  requireAdmin, revokeAdminSession, verifyAdminSession, verifyAdminTotp } from '@/lib/admin-auth';

const fixture = vi.hoisted(() => ({ store: new Map<string, Record<string, unknown> | string>(), unavailable: false }));
vi.mock('@/lib/redis', () => ({ getRedis: () => ({
  async set(key: string, value: Record<string, unknown>, options: { nx?: boolean }) {
    if (fixture.unavailable) throw new Error('unavailable');
    if (options.nx && fixture.store.has(key)) return null;
    fixture.store.set(key, structuredClone(value)); return 'OK';
  },
  async del(key: string) { if (fixture.unavailable) throw new Error('unavailable'); fixture.store.delete(key); },
  async eval(_script: string, keys: string[], args: string[]) {
    if (fixture.unavailable) throw new Error('unavailable');
    const session = fixture.store.get(keys[0]) as Record<string, unknown> | undefined;
    const now = Number(args[0]);
    if (!session || session.fingerprint !== args[1] || Number(session.expiresAt) <= now || Number(session.lastSeenAt) + Number(args[2]) <= now) { fixture.store.delete(keys[0]); return ''; }
    session.lastSeenAt = now; return session.principal;
  },
}) }));

function request(token: string, method = 'GET', origin = 'https://mtgtrackers.com') {
  return new Request('https://mtgtrackers.com/admin', { method, headers: { cookie: `${ADMIN_COOKIE_NAME}=${token}`, origin } });
}

describe('revocable owner authentication', () => {
  beforeEach(() => {
    fixture.store.clear(); fixture.unavailable = false;
    vi.stubEnv('ADMIN_PASSWORD', 'fixture-owner-password-strong');
    vi.stubEnv('ADMIN_SESSION_SECRET', 'fixture-only-session-secret-32-characters');
    vi.stubEnv('ADMIN_OWNER_ID', 'fixture-owner');
    vi.stubEnv('ADMIN_TOTP_SECRET', 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

  it('stores only hashed opaque session tokens and derives the owner on the server', async () => {
    const token = await createAdminSession();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(fixture.store.has(adminSessionKey(token))).toBe(true);
    expect(JSON.stringify([...fixture.store])).not.toContain(token);
    expect(await verifyAdminSession(token)).toEqual({ id: 'fixture-owner', role: 'owner' });
    expect(await verifyAdminSession(`${token}.extra`)).toBeNull();
    expect(getAdminSessionFromRequest(request(token))).toBe(token);
  });
  it('revokes a copied cookie on logout', async () => {
    const token = await createAdminSession(); await revokeAdminSession(request(token, 'DELETE'));
    expect(await verifyAdminSession(token)).toBeNull();
  });
  it.each(['ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET', 'ADMIN_OWNER_ID', 'ADMIN_TOTP_SECRET'])('invalidates sessions when %s changes', async (name) => {
    const token = await createAdminSession(); vi.stubEnv(name, `${process.env[name]}A`);
    expect(await verifyAdminSession(token)).toBeNull();
  });
  it('enforces idle and absolute expiry despite repeated requests', async () => {
    vi.useFakeTimers(); const idle = await createAdminSession();
    vi.advanceTimersByTime(30 * 60000); expect(await verifyAdminSession(idle)).toBeNull();
    const active = await createAdminSession();
    for (let i = 0; i < 47; i++) { vi.advanceTimersByTime(10 * 60000); expect(await verifyAdminSession(active)).not.toBeNull(); }
    vi.advanceTimersByTime(10 * 60000); expect(await verifyAdminSession(active)).toBeNull();
  });
  it.each(['ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET', 'ADMIN_OWNER_ID', 'ADMIN_TOTP_SECRET'])('requires %s in production', async (name) => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv(name, ''); expect(isAdminConfigured()).toBe(false);
    await expect(createAdminSession()).rejects.toThrow('not configured');
  });
  it('rejects weak production credentials and has no development password fallback', () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('ADMIN_PASSWORD', 'short'); expect(isAdminConfigured()).toBe(false);
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('ADMIN_PASSWORD', ''); expect(isAdminConfigured()).toBe(false);
  });
  it('validates TOTP and rejects repeated and stale codes', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-05T12:00:00Z'));
    const code = new TOTP({ secret: process.env.ADMIN_TOTP_SECRET! }).generate();
    expect(await verifyAdminTotp('invalid')).toBe(false); expect(await verifyAdminTotp(code)).toBe(true);
    expect(await verifyAdminTotp(code)).toBe(false); vi.advanceTimersByTime(120000); expect(await verifyAdminTotp(code)).toBe(false);
  });
  it('fails closed during an outage and rejects cross-origin or originless changes', async () => {
    const token = await createAdminSession();
    expect((await requireAdmin(request(token, 'POST', 'https://attacker.example')))?.status).toBe(403);
    const missing = request(token, 'POST'); missing.headers.delete('origin'); expect((await requireAdmin(missing))?.status).toBe(403);
    fixture.unavailable = true; expect((await requireAdmin(request(token)))?.status).toBe(503);
    await expect(revokeAdminSession(request(token))).rejects.toThrow(); expect((await requireAdmin(request('invalid')))?.status).toBe(401);
  });
  it('sets secure, HTTP-only, strict same-site cookies in production', () => {
    vi.stubEnv('NODE_ENV', 'production'); expect(adminCookieOptions()).toMatchObject({ secure: true, httpOnly: true, sameSite: 'strict' });
  });
});
