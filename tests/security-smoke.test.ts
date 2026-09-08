import { describe, expect, it } from 'vitest';
import { assertMinimalHealth, checkOwnerBoundary } from '../scripts/lib/security-smoke.mjs';

function responder(overrides: Record<string, { status?: number; headers?: Record<string, string>; body?: unknown }> = {}) {
  const calls: Array<{ url: string; options: RequestInit }> = [];
  return { calls, fetch: async (url: string, options: RequestInit) => {
    calls.push({ url, options });
    const path = new URL(url).pathname;
    const override = overrides[path] || {};
    const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "frame-ancestors 'none'; script-src 'self'", ...override.headers };
    const status = override.status || (path === '/admin' || path === '/api/admin/login' ? 200 : path.startsWith('/api/reports/') ? 403 : 401);
    const body = override.body || (path === '/api/admin/login' ? { authenticated: false, principal: null, mfaRequired: true } : { message: path.startsWith('/api/reports/') ? 'Invalid or expired private report link' : 'Unauthorized' });
    return new Response(JSON.stringify(body), { status, headers });
  } };
}

describe('read-only deployment security smoke', () => {
  it('tests the deployed auth boundary without credentials, cookies, writes or redirects', async () => {
    const fixture = responder();
    expect(await checkOwnerBoundary('https://mtgtrackers.com', fixture.fetch)).toHaveLength(11);
    expect(fixture.calls).toHaveLength(11);
    for (const { url, options } of fixture.calls) {
      if (new URL(url).pathname === '/api/admin/storage-inventory' || new URL(url).pathname.endsWith('/source') || (new URL(url).pathname.startsWith('/api/reports/') && options.method === 'POST')) {
        expect(options.method).toBe('POST'); expect(options.body).toBe('{}');
      } else {
        expect([undefined, 'GET']).toContain(options.method); expect(options.body).toBeUndefined();
      }
      expect(options.redirect).toBe('manual'); expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(Object.keys(options.headers!)).toEqual(['User-Agent']);
    }
  });
  it('rejects an outdated or exposed admin deployment', async () => {
    for (const override of [
      { '/admin': { status: 404 } },
      { '/admin': { headers: { 'Cache-Control': 'public, max-age=600' } } },
      { '/admin': { headers: { 'Content-Security-Policy': "frame-ancestors 'none'; script-src 'unsafe-eval'" } } },
      { '/api/admin/inbox': { status: 200 } },
      { '/api/admin/configuration': { status: 302 } },
      { '/api/admin/login': { body: { authenticated: false } } },
      { '/api/admin/inbox': { body: { message: 'Unauthorized', rows: ['private data'] } } },
      { '/api/admin/storage-inventory': { status: 200 } },
      { '/api/admin/storage-inventory': { headers: { 'Cache-Control': 'public, max-age=600' } } },
      { '/api/admin/storage-inventory': { body: { message: 'Unauthorized', rows: ['private data'] } } },
      { '/api/trackers/one-ring/submissions/smoke-denied/source': { status: 200 } },
      { '/api/reports/one-ring/smoke-denied': { status: 200 } },
      { '/api/reports/one-ring/smoke-denied': { headers: { 'Cache-Control': 'public, max-age=600' } } },
      { '/api/reports/one-ring/smoke-denied': { body: { message: 'Invalid or expired private report link', followUps: [] } } },
    ]) await expect(checkOwnerBoundary('https://mtgtrackers.com', responder(override).fetch)).rejects.toThrow();
  });
  it('rejects health responses exposing internal configuration', () => {
    expect(() => assertMinimalHealth({ ok: true })).not.toThrow();
    expect(() => assertMinimalHealth({ ok: true, environment: 'production' })).toThrow();
    expect(() => assertMinimalHealth({ ok: false })).toThrow();
  });
});
