import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
    process.env.ADMIN_PASSWORD = originalPassword;
    process.env.ADMIN_SESSION_SECRET = originalSecret;
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

  it('returns a 401 response for unauthenticated admin requests', async () => {
    const response = requireAdmin(new Request('https://mtgtrackers.com/admin'));

    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({ message: 'Unauthorized' });
  });
});
