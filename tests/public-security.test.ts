import { beforeEach, describe, expect, it, vi } from 'vitest';
import { boundedContext, incrementTelemetry, limitTelemetry, TELEMETRY_RETENTION_SECONDS } from '@/lib/telemetry-policy';
import { GET as health } from '@/app/api/health/route';
import { GET as evidence } from '@/app/api/evidence/[id]/route';
import { POST as affiliateClick } from '@/app/api/affiliate/click/route';

const fixture = vi.hoisted(() => ({ ping: vi.fn(), eval: vi.fn(), get: vi.fn(), incr: vi.fn(), set: vi.fn(), del: vi.fn() }));
vi.mock('@/lib/redis', () => ({ getRedis: () => fixture }));

describe('public endpoint cost and privacy protections', () => {
  beforeEach(() => { vi.clearAllMocks(); fixture.ping.mockResolvedValue('PONG'); fixture.eval.mockResolvedValue(1); });
  it('makes health checks read-only, cacheable and free of diagnostic details', async () => {
    const response = await health(); expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('cache-control')).toContain('s-maxage=30');
    expect(fixture.set).not.toHaveBeenCalled(); expect(fixture.del).not.toHaveBeenCalled();
    fixture.ping.mockRejectedValue(new Error('private credentials, hostname and internal error'));
    const failed = await health(); expect(failed.status).toBe(503); expect(await failed.json()).toEqual({ ok: false });
  });
  it('blocks repeated image reads before loading metadata or files', async () => {
    fixture.eval.mockResolvedValue(301);
    const response = await evidence(new Request('https://mtgtrackers.com/api/evidence/x'), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) });
    expect(response.status).toBe(429); expect(response.headers.get('cache-control')).toContain('no-store'); expect(fixture.get).not.toHaveBeenCalled();
  });
  it('drops arbitrary analytics dimensions but preserves supported card, catalog and serial context', () => {
    expect(boundedContext('one-ring', { filter: 'attacker-1', sort: 'attacker-2', card: 'attacker-3', serial: '999999', slot: '999999' })).toEqual({});
    expect(boundedContext('one-ring', { card: 'the-one-ring', serial: '7', slot: '7', filter: 'source-marketplace' })).toMatchObject({ card: 'the-one-ring', serial: '007', slot: '7', filter: 'source-marketplace' });
    expect(boundedContext('default', { card: 'aetherdrift-aetherspark' })).toEqual({ card: 'aetherdrift-aetherspark' });
    expect(boundedContext('default', { card: 'unknown' })).toEqual({});
  });
  it('gives daily counters expiration while retaining finite lifetime rollups', async () => {
    await incrementTelemetry(fixture as never, 'affiliate:clicks:2026-09-05:one-ring:ebay:tracker-marketplace');
    expect(fixture.eval).toHaveBeenCalledWith(expect.stringContaining('EXPIRE'), expect.any(Array), [TELEMETRY_RETENTION_SECONDS]);
    await incrementTelemetry(fixture as never, 'affiliate:clicks:total:one-ring:ebay:tracker-marketplace');
    expect(fixture.incr).toHaveBeenCalledOnce();
  });
  it('applies cross-endpoint IP and site telemetry budgets and rejects oversized bodies', async () => {
    fixture.eval.mockResolvedValueOnce(121);
    expect((await limitTelemetry(fixture as never, new Request('https://mtgtrackers.com')))?.status).toBe(429);
    fixture.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(20001);
    expect((await limitTelemetry(fixture as never, new Request('https://mtgtrackers.com')))?.status).toBe(429);
    expect((await affiliateClick(new Request('https://mtgtrackers.com/api/affiliate/click', { method: 'POST', body: JSON.stringify({ payload: 'x'.repeat(9000) }) }))).status).toBe(413);
  });
});
