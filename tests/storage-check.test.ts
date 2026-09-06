import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlobNotFoundError } from '@vercel/blob';
import { checkPrivateStorage } from '@/lib/storage-check';

const fixture = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn(), del: vi.fn(), head: vi.fn(), anonymous: vi.fn() }));
vi.mock('@vercel/blob', async (original) => ({ ...await original<typeof import('@vercel/blob')>(), put: fixture.put, get: fixture.get, del: fixture.del, head: fixture.head }));
const privateUrl = (path: string) => `https://fixture-store.private.blob.vercel-storage.com/${path}`;
function stored(overrides: Record<string, unknown> = {}, content?: Buffer) {
  const [pathname, bytes] = fixture.put.mock.calls[0];
  return { statusCode: 200, blob: { size: bytes.length, pathname }, stream: new ReadableStream({ start(controller) { controller.enqueue(content || bytes); controller.close(); } }), ...overrides };
}

describe('isolated private storage diagnostic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'fixture-only-private-token');
    vi.stubEnv('BLOB_STORE_ID', '');
    vi.stubGlobal('fetch', fixture.anonymous);
    fixture.put.mockImplementation(async (pathname) => ({ pathname, url: privateUrl(pathname) }));
    fixture.get.mockImplementation(async () => stored());
    fixture.del.mockResolvedValue(undefined);
    fixture.head.mockRejectedValue(new BlobNotFoundError());
    fixture.anonymous.mockResolvedValue(new Response(null, { status: 403 }));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('verifies private upload, bounded read-back, anonymous denial and removal without exposing credentials or storage URLs', async () => {
    const result = await checkPrivateStorage();
    expect(result.ok).toBe(true);
    expect(result.checks).toEqual({ upload: 'passed', read: 'passed', privacy: 'passed', cleanup: 'passed' });
    const pathname = `_diagnostics/storage/${result.runId}.txt`;
    expect(result.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(fixture.put).toHaveBeenCalledWith(pathname, expect.any(Buffer), expect.objectContaining({ access: 'private', allowOverwrite: false, addRandomSuffix: false, abortSignal: expect.any(AbortSignal) }));
    expect(fixture.put.mock.calls[0][1].length).toBeLessThan(1024);
    expect(fixture.get).toHaveBeenCalledWith(pathname, expect.objectContaining({ access: 'private' }));
    expect(fixture.del).toHaveBeenCalledWith(pathname, expect.any(Object));
    expect(fixture.head).toHaveBeenCalledWith(pathname, expect.any(Object));
    const [url, options] = fixture.anonymous.mock.calls[0];
    expect(url.href).toBe(privateUrl(pathname));
    expect(options).toMatchObject({ credentials: 'omit', redirect: 'manual', cache: 'no-store' });
    expect(options.headers).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/fixture-only-private-token|vercel-storage|_diagnostics/);
    expect(Number.isNaN(Date.parse(result.checkedAt))).toBe(false);
  });
  it('does not contact providers without configuration', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    await expect(checkPrivateStorage()).rejects.toThrow('not configured');
    expect(fixture.put).not.toHaveBeenCalled(); expect(fixture.del).not.toHaveBeenCalled();
  });
  it('uses a fresh diagnostic-only path for each run', async () => {
    const first = await checkPrivateStorage(); const second = await checkPrivateStorage();
    expect(first.runId).not.toBe(second.runId);
    expect(fixture.put.mock.calls.every(([pathname]) => /^_diagnostics\/storage\/[0-9a-f-]+\.txt$/.test(pathname))).toBe(true);
  });
  it('allows a connected OIDC store and leaves identity-token handling to the SDK', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', ''); vi.stubEnv('BLOB_STORE_ID', 'store_fixture');
    expect((await checkPrivateStorage()).ok).toBe(true);
    for (const method of [fixture.put, fixture.get, fixture.del, fixture.head]) {
      const options = method.mock.calls[0].at(-1);
      expect(options.token).toBeFalsy(); expect(options.oidcToken).toBeUndefined();
    }
  });
  it('attempts cleanup even when the upload result is lost and suppresses raw provider errors', async () => {
    fixture.put.mockRejectedValue(new Error('private token https://secret-store.example'));
    const result = await checkPrivateStorage();
    expect(result.ok).toBe(false);
    expect(result.checks).toEqual({ upload: 'failed', read: 'skipped', privacy: 'skipped', cleanup: 'passed' });
    expect(fixture.get).not.toHaveBeenCalled(); expect(fixture.anonymous).not.toHaveBeenCalled();
    expect(fixture.del).toHaveBeenCalledWith(`_diagnostics/storage/${result.runId}.txt`, expect.any(Object));
    expect(JSON.stringify(result)).not.toMatch(/private token|secret-store/);
  });
  it.each([
    'https://attacker.example/PATH',
    'https://fixture-store.public.blob.vercel-storage.com/PATH',
    'https://fixture.private.blob.vercel-storage.com.attacker.example/PATH',
    'http://fixture.private.blob.vercel-storage.com/PATH',
    'https://user:password@fixture.private.blob.vercel-storage.com/PATH',
    'https://fixture.private.blob.vercel-storage.com:444/PATH',
    'https://fixture.private.blob.vercel-storage.com/PATH?token=secret',
    'https://fixture.private.blob.vercel-storage.com/PATH#fragment',
    'https://fixture.private.blob.vercel-storage.com/quarantine/existing-evidence.webp',
  ])('rejects unexpected provider destinations without fetching or deleting them: %s', async (url) => {
    fixture.put.mockImplementation(async (pathname) => ({ pathname, url: url.replace('PATH', pathname) }));
    const result = await checkPrivateStorage();
    expect(result.checks.upload).toBe('failed');
    expect(fixture.get).not.toHaveBeenCalled(); expect(fixture.anonymous).not.toHaveBeenCalled();
    expect(fixture.del).toHaveBeenCalledWith(`_diagnostics/storage/${result.runId}.txt`, expect.any(Object));
  });
  it('never follows a returned pathname into actual evidence', async () => {
    fixture.put.mockResolvedValue({ pathname: 'quarantine/real.webp', url: privateUrl('quarantine/real.webp') });
    const result = await checkPrivateStorage();
    expect(result.checks.upload).toBe('failed');
    expect(fixture.del.mock.calls[0][0]).not.toContain('quarantine');
  });
  it.each(['missing', 'not-modified', 'wrong-size', 'wrong-path', 'oversize', 'truncated', 'corrupt', 'outage'])('fails closed on %s private read and still cleans up', async (kind) => {
    fixture.get.mockImplementation(async () => {
      const [pathname, bytes] = fixture.put.mock.calls[0];
      if (kind === 'missing') return null;
      if (kind === 'not-modified') return { statusCode: 304, stream: null };
      if (kind === 'wrong-size') return stored({ blob: { size: 1000000, pathname } });
      if (kind === 'wrong-path') return stored({ blob: { size: bytes.length, pathname: 'quarantine/real.webp' } });
      if (kind === 'oversize') return stored({}, Buffer.alloc(bytes.length + 1));
      if (kind === 'truncated') return stored({}, Buffer.from('short'));
      if (kind === 'corrupt') return stored({}, Buffer.alloc(bytes.length));
      throw new Error('private provider details');
    });
    const result = await checkPrivateStorage();
    expect(result.checks).toEqual({ upload: 'passed', read: 'failed', privacy: 'skipped', cleanup: 'passed' });
    expect(result.ok).toBe(false); expect(fixture.anonymous).not.toHaveBeenCalled();
  });
  it.each([200, 302, 404, 429, 500])('does not count anonymous HTTP %s as proof of private access control', async (status) => {
    fixture.anonymous.mockResolvedValue(new Response(null, { status }));
    const result = await checkPrivateStorage();
    expect(result.checks.privacy).toBe('failed'); expect(result.checks.cleanup).toBe('passed'); expect(result.ok).toBe(false);
  });
  it('does not treat a privacy-check timeout as a pass', async () => {
    fixture.anonymous.mockRejectedValue(new Error('timed out'));
    expect((await checkPrivateStorage()).checks).toMatchObject({ privacy: 'failed', cleanup: 'passed' });
  });
  it.each(['delete-error', 'still-present', 'metadata-error'])('reports unconfirmed cleanup after %s instead of a false success', async (kind) => {
    if (kind === 'delete-error') fixture.del.mockRejectedValue(new Error('private provider details'));
    if (kind === 'still-present') fixture.head.mockResolvedValue({ size: 80 });
    if (kind === 'metadata-error') fixture.head.mockRejectedValue(new Error('not-found-like but not authoritative'));
    const result = await checkPrivateStorage();
    expect(result.ok).toBe(false); expect(result.checks.cleanup).toBe('failed');
    expect(JSON.stringify(result)).not.toContain('private provider details');
  });
});
