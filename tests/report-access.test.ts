import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReportAccess, requireReportAccess } from '@/lib/report-access';

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('private report access', () => {
  it('binds access to the report and original tracker, not an admin session', () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'isolated-test-secret');
    const token = createReportAccess('one-ring', 'report-a', new Date().toISOString());
    const request = new Request('https://mtgtrackers.com/report', { headers: { 'x-report-token': token } });
    expect(() => requireReportAccess(request, 'one-ring', 'report-a')).not.toThrow();
    expect(() => requireReportAccess(request, 'one-ring', 'report-b')).toThrow();
    expect(() => requireReportAccess(request, 'lotr-poster-cards', 'report-a')).toThrow();
  });
  it('rejects expired, tampered and missing tokens', () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'isolated-test-secret');
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-05T00:00:00Z'));
    const token = createReportAccess('one-ring', 'report-a', '2026-01-01T00:00:00Z');
    for (const value of [token, `${token}changed`, '']) expect(() => requireReportAccess(new Request('https://mtgtrackers.com/report', { headers: { 'x-report-token': value } }), 'one-ring', 'report-a')).toThrow();
  });
  it('fails closed without a configured secret', () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', '');
    expect(() => createReportAccess('one-ring', 'report-a', new Date().toISOString())).toThrow();
  });
});
