import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { normalizeSourceUrl, evidenceIdFromUrl } from '@/lib/evidence-policy';
import { checkSourceReputation, scanEvidenceImage } from '@/lib/evidence-scanning';
import { createSubmissionSession, readSubmissionSession, verifyTurnstile } from '@/lib/submission-session';
import { readJsonBody } from '@/lib/request-json';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('source and attachment policy', () => {
  it.each([
    'javascript:alert(1)', 'http://www.ebay.com/itm/123456789012', 'https://user:pass@www.ebay.com/itm/123456789012',
    'https://www.ebay.com.evil.test/itm/123456789012', 'https://127.0.0.1/a', 'https://2130706433/a',
    'https://[::1]/a', 'https://169.254.169.254/latest/meta-data', 'https://localhost/a',
    'https://www.ebay.com:444/itm/123456789012', 'https://www.ebay.com/redirect?url=https://evil.test',
    'https://t.co/abc', 'https://adult.example/photo', 'https://www.reddit.com/r/test/comments/abc/%2f..',
    '//www.ebay.com/itm/123456789012', 'https://www.ebay.com\\@evil.test/itm/123456789012',
  ])('rejects unsupported or deceptive source %s', (url) => expect(normalizeSourceUrl(url)).toBeUndefined());

  it('strips tracking and redirect query values without following them', () => {
    expect(normalizeSourceUrl('https://www.ebay.com/itm/123456789012?next=https%3A%2F%2Fevil.test#fragment')).toBe('https://www.ebay.com/itm/123456789012');
  });
  it('allows direct social posts but not their redirect endpoints', () => {
    expect(normalizeSourceUrl('https://www.reddit.com/r/mtg/comments/abc123/serial_find/')).toBeDefined();
    expect(normalizeSourceUrl('https://x.com/collector/status/1234567890')).toBeDefined();
    expect(normalizeSourceUrl('https://www.reddit.com/redirect')).toBeUndefined();
  });
  it.each(['/api/evidence/../../admin', '/api/evidence/00000000-0000-4000-8000-000000000001?raw=1', 'https://evil.test/image.webp'])('rejects noncanonical evidence paths', (value) => {
    expect(evidenceIdFromUrl(value)).toBeUndefined();
  });
  it('bounds JSON streams even without Content-Length', async () => {
    const result = await readJsonBody(new Request('https://mtgtrackers.com', { method: 'POST', body: JSON.stringify({ notes: 'x'.repeat(100) }) }), 32);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });
});

describe('protected report sessions', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'test-secret-for-submissions');
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-turnstile-secret');
    vi.stubEnv('TURNSTILE_ALLOWED_HOSTNAMES', 'mtgtrackers.com');
  });
  const request = (token: string) => new Request('https://mtgtrackers.com', { headers: { 'x-submission-token': token } });
  it('binds permissions to a tracker and exact serial slot', () => {
    const { token } = createSubmissionSession('one-ring', 7);
    expect(readSubmissionSession(request(token), 'one-ring', 7).cardId).toBe(7);
    expect(() => readSubmissionSession(request(token), 'edgar-markov', 7)).toThrow();
    expect(() => readSubmissionSession(request(token), 'one-ring', 8)).toThrow();
    expect(() => readSubmissionSession(request(token + 'x'), 'one-ring')).toThrow();
    expect(() => readSubmissionSession(request(token + '.extra'), 'one-ring')).toThrow();
  });
  it('expires permissions and does not use a production fallback secret', () => {
    vi.useFakeTimers();
    const { token } = createSubmissionSession('one-ring', 7);
    vi.advanceTimersByTime(3600001);
    expect(() => readSubmissionSession(request(token), 'one-ring')).toThrow();
    vi.stubEnv('ADMIN_SESSION_SECRET', '');
    expect(() => createSubmissionSession('one-ring', 7)).toThrow();
  });
  it.each([
    { success: false }, { success: true, hostname: 'evil.test', action: 'discovery' },
    { success: true, hostname: 'mtgtrackers.com', action: 'login' }, { success: 'true', hostname: 'mtgtrackers.com', action: 'discovery' },
  ])('rejects failed, mismatched, or malformed challenge responses', async (result) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(result)));
    await expect(verifyTurnstile('token')).rejects.toThrow();
  });
  it('validates the challenge on the server with the expected action and hostname', async () => {
    const fetcher = vi.fn(async () => Response.json({ success: true, hostname: 'mtgtrackers.com', action: 'discovery' }));
    vi.stubGlobal('fetch', fetcher);
    await expect(verifyTurnstile('token')).resolves.toBeUndefined();
    expect(fetcher.mock.calls[0]).toBeDefined();
  });
});

describe('image scanning providers', () => {
  let bytes: Buffer;
  beforeEach(async () => {
    vi.stubEnv('CLOUDMERSIVE_API_KEY', 'fixture-virus-key');
    vi.stubEnv('AZURE_CONTENT_SAFETY_ENDPOINT', 'https://fixture.cognitiveservices.azure.com');
    vi.stubEnv('AZURE_CONTENT_SAFETY_KEY', 'fixture-content-key');
    bytes = await sharp({ create: { width: 24, height: 32, channels: 3, background: '#008877' } }).webp().toBuffer();
  });
  it('requires both scanners to pass before marking the stored image clean', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ CleanResult: true, FoundViruses: [] }))
      .mockResolvedValueOnce(Response.json({ categoriesAnalysis: [{ category: 'Sexual', severity: 0 }] }));
    vi.stubGlobal('fetch', fetcher);
    expect(await scanEvidenceImage(bytes)).toMatchObject({ status: 'clean', policyVersion: 1 });
    const form = fetcher.mock.calls[0][1].body as FormData;
    expect(Buffer.from(await (form.get('inputFile') as Blob).arrayBuffer())).toEqual(bytes);
    const payload = JSON.parse(fetcher.mock.calls[1][1].body);
    expect((await sharp(Buffer.from(payload.image.content, 'base64')).metadata()).format).toBe('png');
    expect(fetcher.mock.calls[1][1].redirect).toBe('error');
  });
  it.each([2, 4, 6])('holds sexual-content flags at severity %s', async (severity) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ CleanResult: true }))
      .mockResolvedValueOnce(Response.json({ categoriesAnalysis: [{ category: 'Sexual', severity }] })));
    expect(await scanEvidenceImage(bytes)).toMatchObject({ status: 'flagged' });
  });
  it('holds malware flags without invoking the content provider', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ CleanResult: false }));
    vi.stubGlobal('fetch', fetcher);
    expect(await scanEvidenceImage(bytes)).toMatchObject({ status: 'flagged', reason: 'malware-detected' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([{}, { CleanResult: 'true' }, null])('does not treat malformed malware results as clean', async (result) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(result)));
    expect(await scanEvidenceImage(bytes)).toMatchObject({ status: 'error' });
  });
  it.each([{}, { categoriesAnalysis: [] }, { categoriesAnalysis: [{ category: 'Sexual', severity: '0' }] }])('holds malformed content results', async (result) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ CleanResult: true })).mockResolvedValueOnce(Response.json(result)));
    expect(await scanEvidenceImage(bytes)).toMatchObject({ status: 'error' });
  });
  it('keeps scans pending when configuration is missing or endpoint is unsafe', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('AZURE_CONTENT_SAFETY_ENDPOINT', 'https://127.0.0.1');
    expect(await scanEvidenceImage(bytes)).toMatchObject({ status: 'pending' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('holds timeouts and provider failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    expect(await scanEvidenceImage(bytes)).toMatchObject({ status: 'error' });
  });
});

describe('commercial URL reputation screening', () => {
  beforeEach(() => vi.stubEnv('GOOGLE_WEB_RISK_API_KEY', 'fixture-web-risk-key'));
  const url = 'https://www.ebay.com/itm/123456789012';
  it('accepts a successful empty threat response', async () => {
    const fetcher = vi.fn(async () => Response.json({}));
    vi.stubGlobal('fetch', fetcher);
    await expect(checkSourceReputation(url)).resolves.toBeUndefined();
  });
  it.each([{ threat: { threatTypes: ['MALWARE'] } }, null, [], { unexpected: true }])('holds threats and unexpected responses', async (result) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(result)));
    await expect(checkSourceReputation(url)).rejects.toThrow();
  });
  it('does not bypass screening when configuration is missing', async () => {
    vi.stubEnv('GOOGLE_WEB_RISK_API_KEY', '');
    await expect(checkSourceReputation(url)).rejects.toThrow('not configured');
  });
});
