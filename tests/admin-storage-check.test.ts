import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/admin/storage-check/route';

const fixture = vi.hoisted(() => ({ auth: vi.fn(), rate: vi.fn(), check: vi.fn(), redis: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: fixture.auth }));
vi.mock('@/lib/redis', () => ({ getRedis: fixture.redis }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: fixture.rate }));
vi.mock('@/lib/storage-check', () => ({ checkPrivateStorage: fixture.check }));
const result = { ok: true, runId: 'fixture-run', checkedAt: '2026-09-05T10:00:00Z', checks: { upload: 'passed', read: 'passed', privacy: 'passed', cleanup: 'passed' } };
const request = (body: unknown = { confirm: 'TEST_PRIVATE_STORAGE' }) => new Request('https://mtgtrackers.com/api/admin/storage-check', {
  method: 'POST', headers: { origin: 'https://mtgtrackers.com', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('owner-only storage check endpoint', () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'fixture-only-private-token');
    vi.stubEnv('BLOB_STORE_ID', '');
    fixture.auth.mockResolvedValue(null); fixture.rate.mockResolvedValue({ allowed: true }); fixture.check.mockResolvedValue(result);
  });
  afterEach(() => { vi.unstubAllEnvs(); });
  it.each([401, 403, 503])('awaits the session/origin guard and stops on HTTP %s before contacting storage', async (status) => {
    fixture.auth.mockResolvedValue(NextResponse.json({ message: 'Denied' }, { status }));
    const response = await POST(request());
    expect(response.status).toBe(status); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(fixture.rate).not.toHaveBeenCalled(); expect(fixture.check).not.toHaveBeenCalled(); expect(fixture.redis).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { confirm: 'wrong' }, { confirm: 'TEST_PRIVATE_STORAGE', pathname: 'quarantine/real.webp' }, { confirm: 'x'.repeat(1025) }])('rejects invalid, oversized or caller-directed requests: %j', async (body) => {
    const response = await POST(request(body));
    expect([400, 413]).toContain(response.status); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(fixture.rate).not.toHaveBeenCalled(); expect(fixture.check).not.toHaveBeenCalled();
  });
  it('requires a configured token before provider calls', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    const response = await POST(request());
    expect(response.status).toBe(503); expect(fixture.check).not.toHaveBeenCalled(); expect(fixture.rate).not.toHaveBeenCalled();
  });
  it('limits tests across the site and never calls storage when rate limiting fails', async () => {
    fixture.rate.mockResolvedValue({ allowed: false });
    const response = await POST(request());
    expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('900');
    expect(fixture.rate).toHaveBeenCalledWith(undefined, { key: 'rate-limit:admin:storage-check', limit: 3, windowSeconds: 900 });
    expect(fixture.check).not.toHaveBeenCalled();
  });
  it('returns only safe per-run results and no cached configuration', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200); expect(await response.json()).toEqual(result);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(fixture.check).toHaveBeenCalledWith();
  });
  it('permits SDK-managed OIDC for a connected store without a static token', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', ''); vi.stubEnv('BLOB_STORE_ID', 'store_fixture');
    expect((await POST(request())).status).toBe(200);
    expect(fixture.check).toHaveBeenCalledOnce();
  });
  it('preserves partial diagnostic results without claiming a successful test', async () => {
    fixture.check.mockResolvedValue({ ...result, ok: false, checks: { ...result.checks, cleanup: 'failed' } });
    const response = await POST(request());
    expect(response.status).toBe(503); expect((await response.json()).checks.cleanup).toBe('failed');
  });
  it('fails closed and suppresses raw rate-limit/provider errors', async () => {
    fixture.rate.mockRejectedValue(new Error('redis credentials'));
    const response = await POST(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('redis credentials');
    expect(fixture.check).not.toHaveBeenCalled();
    fixture.rate.mockResolvedValue({ allowed: true }); fixture.check.mockRejectedValue(new Error('storage token'));
    expect(await (await POST(request())).text()).not.toContain('storage token');
  });
});
