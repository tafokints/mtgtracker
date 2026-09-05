import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { backup, recoveryConfig, restore } from '../scripts/recovery.mjs';
import { createArchive, digest, encryptionKey, openArchive, seal, unseal } from '../scripts/lib/recovery-archive.mjs';

const key = encryptionKey('12'.repeat(32));
const id = '11111111-1111-4111-8111-111111111111';
const pathname = `quarantine/one-ring/${id}.webp`;
const assetKey = `evidence:v1:${id}`;
const bytes = Buffer.from('synthetic test evidence; not served as an image');

function fixtures() {
  const store = new Map<string, string | string[]>(), files = new Map<string, Buffer>();
  return { store, files,
    redis: {
      async eval(script: string, keys: string[], args: string[]) {
        if (script.includes('-- claim empty isolated restore target')) { if (store.size) return 0; store.set(keys[0], args[0]); return 1; }
        return keys.map((key) => store.get(key) ?? false);
      },
      async scan(_cursor: string, { match }: { match: string }) { return ['0', [...store.keys()].filter((key) => key.startsWith(match.replace('*', '')))]; },
      async dbsize() { return store.size; },
      async set(key: string, value: string, options?: { nx?: boolean }) { if (options?.nx && store.has(key)) return null; store.set(key, value); return 'OK'; },
      async sadd(key: string, ...values: string[]) { store.set(key, values); },
      async del(key: string) { store.delete(key); },
    },
    blobClient: {
      async list() { return { blobs: [...files].map(([pathname, value]) => ({ pathname, size: value.length, url: `https://fixture.private.blob.vercel-storage.com/${pathname}` })), hasMore: false }; },
      async get(name: string) { const value = files.get(name); return value ? { statusCode: 200, blob: { size: value.length }, stream: new Response(new Uint8Array(value)).body } : null; },
      async put(name: string, value: Buffer, options: { access: string; allowOverwrite: boolean }) {
        expect(options.access).toBe('private'); expect(options.allowOverwrite).toBe(false);
        if (files.has(name)) throw new Error('overwrite'); files.set(name, value);
      },
    },
  };
}

describe('encrypted disaster recovery', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'mtg-recovery-test-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  it('authenticates ciphertext, encryption keys and record identity', () => {
    const encrypted = seal(bytes, key, 'first');
    expect(encrypted.includes(bytes)).toBe(false); expect(unseal(encrypted, key, 'first')).toEqual(bytes);
    expect(() => unseal(encrypted, key, 'different')).toThrow();
    expect(() => unseal(encrypted, encryptionKey('34'.repeat(32)), 'first')).toThrow();
    encrypted[encrypted.length - 1] ^= 1; expect(() => unseal(encrypted, key, 'first')).toThrow();
    expect(() => encryptionKey('weak')).toThrow();
  });
  it('backs up shared records, history, metadata, images and archives; restores only to an empty separate target', async () => {
    const source = fixtures(), config = recoveryConfig(), directory = path.join(root, 'complete');
    source.store.set('one_ring_cards', JSON.stringify([{ id: 7, image: `/api/evidence/${id}`, history: [{ id: 'approval' }] }]));
    source.store.set('one_ring_submissions', JSON.stringify([{ id: 'report', status: 'approved', reviewHistory: [{ actorId: 'owner' }] }]));
    source.store.set('lotr_poster_cards', '[]'); source.store.set('lotr_poster_submissions', '[]');
    source.store.set(assetKey, JSON.stringify({ id, pathname, sha256: digest(bytes), size: bytes.length, scan: { status: 'clean' } }));
    source.store.set(`copy-reconciliation:v1:${id}`, JSON.stringify({ originals: ['preserved'] }));
    source.store.set('auth:session:v2:excluded', 'private-session'); source.store.set('rate-limit:excluded', 'private-ip');
    source.files.set(pathname, bytes);
    await backup({ ...source, token: 'source-token', directory, key, config, source: { redisOrigin: 'https://source.example', blobCredentialHash: digest('source-token') } });
    const opened = await openArchive(directory, key, config.allowedKey);
    expect(opened.manifest.parts.some((part: { name: string }) => part.name.startsWith('auth:') || part.name.startsWith('rate-limit:'))).toBe(false);
    expect((await readFile(path.join(directory, 'manifest.enc'))).includes(Buffer.from(pathname))).toBe(false);
    const target = fixtures();
    const args = { ...target, token: 'target-token', opened, config, targetOrigin: 'https://target.example', confirmTarget: 'https://target.example' };
    await expect(restore({ ...args, confirmTarget: '' })).rejects.toThrow('separate target');
    await expect(restore({ ...args, token: 'source-token' })).rejects.toThrow('separate target');
    await restore(args);
    expect(target.files.get(pathname)).toEqual(bytes);
    expect(target.store.get('one_ring_cards')).toBe(source.store.get('one_ring_cards'));
    expect(target.store.get(assetKey)).toBe(source.store.get(assetKey));
    expect(target.store.has('mtgtrackers:restore-in-progress')).toBe(false);
    await expect(restore(args)).rejects.toThrow('empty');
  });
  it('never completes a backup with missing referenced evidence', async () => {
    const source = fixtures(), directory = path.join(root, 'incomplete');
    source.store.set('one_ring_cards', JSON.stringify([{ image: `/api/evidence/${id}` }]));
    await expect(backup({ ...source, token: 'source', directory, key, source: {}, config: recoveryConfig() })).rejects.toThrow('missing');
    await expect(readFile(path.join(directory, 'manifest.enc'))).rejects.toThrow();
  });
  it('rejects altered parts and unexpected restore paths before any writes', async () => {
    const directory = path.join(root, 'bad'), config = recoveryConfig();
    const archive = await createArchive(directory, key, {});
    await archive.add('redis-string', 'one_ring_cards', Buffer.from('[]')); await archive.finish();
    const file = path.join(directory, '000000.enc'), content = await readFile(file); content[content.length - 1] ^= 1;
    await writeFile(file, content); await expect(openArchive(directory, key, config.allowedKey)).rejects.toThrow();
    const illegalDirectory = path.join(root, 'illegal'), illegal = await createArchive(illegalDirectory, key, {});
    await illegal.add('blob', '../outside.webp', bytes); await illegal.finish();
    await expect(openArchive(illegalDirectory, key, config.allowedKey)).rejects.toThrow('unexpected');
  });
});
