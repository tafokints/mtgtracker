import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTurnstileConfig } from '@/lib/turnstile-config';
import { verifyTurnstile } from '@/lib/submission-session';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'fixture-secret');
  vi.stubEnv('TURNSTILE_ALLOWED_HOSTNAMES', 'mtgtrackers.com,www.mtgtrackers.com');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('environment-specific Turnstile configuration', () => {
  it.each(['', ' ', '*', '*.mtgtrackers.com', 'https://mtgtrackers.com', 'mtgtrackers.com/path',
    'mtgtrackers.com:443', 'user@mtgtrackers.com', 'mtgtrackers.com.', 'localhost', 'test.localhost',
    '127.0.0.1', '127.0.0.2', '[::1]', '2130706433', 'mtgtrackers.com,', 'mtgtrackers.com,localhost'])('fails closed for invalid production hosts: %s', async (hosts) => {
    vi.stubEnv('TURNSTILE_ALLOWED_HOSTNAMES', hosts);
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(getTurnstileConfig()).toBeUndefined();
    await expect(verifyTurnstile('fixture-token')).rejects.toMatchObject({ status: 503 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('normalizes configured DNS names and refuses an empty secret', () => {
    vi.stubEnv('TURNSTILE_ALLOWED_HOSTNAMES', ' MTGTrackers.com, www.mtgtrackers.com ');
    expect(getTurnstileConfig()?.hosts).toEqual(['mtgtrackers.com', 'www.mtgtrackers.com']);
    vi.stubEnv('TURNSTILE_SECRET_KEY', '  ');
    expect(getTurnstileConfig()).toBeUndefined();
  });

  it('allows explicit local hosts only outside deployed/production environments', () => {
    vi.stubEnv('TURNSTILE_ALLOWED_HOSTNAMES', 'localhost,127.0.0.1');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(getTurnstileConfig()).toBeUndefined();
    vi.stubEnv('VERCEL_ENV', '');
    expect(getTurnstileConfig()?.hosts).toEqual(['localhost', '127.0.0.1']);
    vi.stubEnv('NODE_ENV', 'production');
    expect(getTurnstileConfig()).toBeUndefined();
  });
});

describe('server-only Siteverify', () => {
  it.each([undefined, null, {}, 1, '', '   ', 'x'.repeat(2049)])('rejects missing, malformed or oversized tokens without contacting Cloudflare', async (token) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(verifyTurnstile(token)).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends the secret only to the fixed backend endpoint with bounded, uncached, nonredirecting requests', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true, action: 'discovery', hostname: 'mtgtrackers.com' }));
    vi.stubGlobal('fetch', fetcher);
    await expect(verifyTurnstile('fixture-token')).resolves.toBeUndefined();
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(options).toMatchObject({ method: 'POST', redirect: 'error', cache: 'no-store', signal: expect.any(AbortSignal) });
    expect(Object.fromEntries(options.body)).toEqual({ secret: 'fixture-secret', response: 'fixture-token' });
  });

  it.each([
    { success: false, 'error-codes': ['timeout-or-duplicate'] },
    { success: 'true', action: 'discovery', hostname: 'mtgtrackers.com' },
    { success: true, action: 'login', hostname: 'mtgtrackers.com' },
    { success: true, action: 'discovery', hostname: 'mtgtrackers.com.attacker.test' },
    { success: true, action: 'discovery', hostname: 'preview.vercel.app' },
    { success: true, action: 'discovery', hostname: 'localhost' },
    { success: true, action: 'discovery' },
  ])('rejects replay/expiry and mismatched responses', async (result) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(result)));
    await expect(verifyTurnstile('fixture-token')).rejects.toMatchObject({ status: 403 });
  });

  it.each(['network', 'http', 'json', 'null'])('fails closed on %s failures without leaking upstream details', async (failure) => {
    const fetcher = vi.fn(async () => {
      if (failure === 'network') throw new Error('private upstream details');
      if (failure === 'http') return new Response('private upstream details', { status: 500 });
      if (failure === 'json') return new Response('not JSON');
      return Response.json(null);
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(verifyTurnstile('fixture-token')).rejects.toMatchObject({
      status: 503, message: 'Verification is temporarily unavailable. Please try again later.',
    });
  });
});
