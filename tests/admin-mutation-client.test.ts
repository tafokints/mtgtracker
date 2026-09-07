import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('admin browser save retries', () => {
  const storage = new Map<string, string>();
  beforeEach(() => {
    vi.resetModules(); storage.clear();
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('reuses a request ID after a lost response and reload, storing no private payload', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('connection lost')).mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const payload = { cardId: 7, entry: { soldBy: 'Private collector', price: 1200 } };
    await expect((await import('@/lib/admin-mutation-client')).saveAdminMutation('/api/edit', payload)).rejects.toThrow('connection lost');
    const firstId = fetch.mock.calls[0][1].headers['Idempotency-Key'];
    expect(storage.size).toBe(1);
    expect(JSON.stringify([...storage])).not.toMatch(/Private collector|1200|soldBy/);
    vi.resetModules();
    const { saveAdminMutation } = await import('@/lib/admin-mutation-client');
    await saveAdminMutation('/api/edit', payload);
    expect(fetch.mock.calls[1][1].headers['Idempotency-Key']).toBe(firstId);
    expect(storage.size).toBe(0);
    await saveAdminMutation('/api/edit', payload);
    expect(fetch.mock.calls[2][1].headers['Idempotency-Key']).not.toBe(firstId);
  });

  it('coalesces double-clicks and separates changed edits', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const { saveAdminMutation } = await import('@/lib/admin-mutation-client');
    await Promise.all([saveAdminMutation('/api/edit', { price: 1 }), saveAdminMutation('/api/edit', { price: 1 })]);
    expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockRejectedValueOnce(new Error('lost'));
    await expect(saveAdminMutation('/api/edit', { price: 2 })).rejects.toThrow();
    await saveAdminMutation('/api/edit', { price: 3 });
    expect(fetch.mock.calls[1][1].headers['Idempotency-Key']).not.toBe(fetch.mock.calls[2][1].headers['Idempotency-Key']);
  });

  it('retains the ID after a server failure when browser storage is disabled', async () => {
    vi.stubGlobal('sessionStorage', { getItem() { throw new Error(); }, setItem() { throw new Error(); }, removeItem() { throw new Error(); } });
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ message: 'Temporarily unavailable' }, { status: 503 })).mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const { saveAdminMutation } = await import('@/lib/admin-mutation-client');
    await expect(saveAdminMutation('/api/edit', { price: 1 })).rejects.toThrow('Temporarily unavailable');
    await saveAdminMutation('/api/edit', { price: 1 });
    expect(fetch.mock.calls[1][1].headers['Idempotency-Key']).toBe(fetch.mock.calls[0][1].headers['Idempotency-Key']);
  });
});
