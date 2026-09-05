import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_COOKIE_NAME,
  createAdminSession,
  getAdminSessionFromRequest,
  requireAdmin,
  verifyAdminSession,
} from '@/lib/admin-auth';

const originalPassword = process.env.ADMIN_PASSWORD;
const originalSecret = process.env.ADMIN_SESSION_SECRET;

describe('admin auth helpers', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'test-admin-password';
    process.env.ADMIN_SESSION_SECRET = 'test-admin-secret';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalPassword;
    if (originalSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = originalSecret;
  });

  it('creates and verifies signed admin sessions', () => {
    const session = createAdminSession();

    expect(verifyAdminSession(session)).toBe(true);
    expect(verifyAdminSession(`${session.slice(0, -1)}x`)).toBe(false);
  });

  it('extracts admin session cookies from requests', () => {
    const session = createAdminSession();
    const request = new Request('https://mtgtrackers.com/admin', {
      headers: {
        cookie: `other=value; ${ADMIN_COOKIE_NAME}=${session}`,
      },
    });

    expect(getAdminSessionFromRequest(request)).toBe(session);
  });

  it('rejects expired sessions and extra token segments', () => {
    vi.useFakeTimers();
    const session = createAdminSession();
    expect(verifyAdminSession(`${session}.extra`)).toBe(false);
    vi.advanceTimersByTime(8 * 60 * 60 * 1000);
    expect(verifyAdminSession(session)).toBe(false);
  });

  it.each(['ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET'] as const)('fails closed in production without %s', (name) => {
    const session = createAdminSession();
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env[name];
    expect(verifyAdminSession(session)).toBe(false);
    expect(() => createAdminSession()).toThrow('Admin authentication is not configured');
  });

  it('rejects sessions signed with the development fallback in production', () => {
    delete process.env.ADMIN_SESSION_SECRET;
    const session = createAdminSession();
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.ADMIN_PASSWORD;
    expect(verifyAdminSession(session)).toBe(false);
  });

  it('returns a 401 response for unauthenticated admin requests', async () => {
    const response = requireAdmin(new Request('https://mtgtrackers.com/admin'));

    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({ message: 'Unauthorized' });
  });
});
