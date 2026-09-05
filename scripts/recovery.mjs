import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Redis } from '@upstash/redis';
import { get, list, put } from '@vercel/blob';
import { loadProjectModule } from './lib/load-project-module.mjs';
import { createArchive, digest, encryptionKey, openArchive } from './lib/recovery-archive.mjs';

const ACTIVE_KEY = 'mtgtrackers:active-printing-trackers';
export const SNAPSHOT_KEYS = `return cjson.encode(redis.call('MGET', unpack(KEYS)))`;
export const CLAIM_RESTORE = `
-- claim empty isolated restore target
if redis.call('DBSIZE') ~= 0 then return 0 end
redis.call('SET', KEYS[1], ARGV[1])
return 1
`;
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const assetPattern = new RegExp(`^evidence:v1:${uuid}$`);
const archivePattern = new RegExp(`^copy-reconciliation:v1:${uuid}$`);

export function recoveryConfig() {
  const { allTrackers } = loadProjectModule(path.resolve('src/lib/trackers.ts'));
  const live = allTrackers.filter((tracker) => tracker.status === 'live');
  const groups = [], processed = new Set(), known = new Set();
  for (const tracker of live) {
    for (const key of [tracker.storage.cardsKey, tracker.storage.submissionsKey, ...(tracker.storage.legacyCardsKeys || [])]) known.add(key);
    if (processed.has(tracker.slug)) continue;
    const related = new Set([tracker.slug]);
    let previous;
    do {
      previous = related.size;
      for (const candidate of live) {
        const owners = (candidate.cardDefinitions || []).map((card) => card.canonicalTrackerSlug).filter(Boolean);
        if (related.has(candidate.slug) || owners.some((owner) => related.has(owner))) {
          related.add(candidate.slug); owners.forEach((owner) => related.add(owner));
        }
      }
    } while (previous !== related.size);
    related.forEach((slug) => processed.add(slug));
    groups.push(live.filter((item) => related.has(item.slug)).flatMap((item) => [item.storage.cardsKey, item.storage.submissionsKey, ...(item.storage.legacyCardsKeys || [])]));
  }
  return {
    groups,
    allowedKey: (key, kind) => kind === 'redis-set' ? key === ACTIVE_KEY : known.has(key) || assetPattern.test(key) || archivePattern.test(key),
    activeSlugs: (records) => live.filter((tracker) => tracker.catalogGenerated && (records.has(tracker.storage.cardsKey) || records.has(tracker.storage.submissionsKey))).map((tracker) => tracker.slug),
  };
}

async function scanKeys(redis, match) {
  let cursor = '0'; const keys = new Set();
  do {
    const result = await redis.scan(cursor, { match, count: 100 });
    cursor = String(result[0]); result[1].forEach((key) => keys.add(key));
    if (keys.size > 100000) throw new Error('Backup record limit reached');
  } while (cursor !== '0');
  return [...keys].sort();
}

export async function blobBytes(blobClient, pathname, token, maxSize = 4 * 1024 * 1024) {
  const result = await blobClient.get(pathname, { access: 'private', token, abortSignal: AbortSignal.timeout(30000) });
  if (result?.statusCode !== 200 || !result.stream || result.blob.size > maxSize) throw new Error('Private backup file unavailable or oversized');
  const reader = result.stream.getReader(), chunks = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.length; if (size > maxSize) throw new Error('Backup file exceeds size limit'); chunks.push(part.value);
    }
  } finally { await reader.cancel(); }
  if (size !== result.blob.size) throw new Error('Incomplete backup file');
  return Buffer.concat(chunks);
}

export async function backup({ redis, blobClient, token, directory, key, source, config }) {
  const archive = await createArchive(directory, key, source);
  const stored = new Set(), assets = new Map(), referenced = new Set(), files = new Set();
  const saveRecords = async (keys) => {
    if (!keys.length) return;
    const values = await redis.eval(SNAPSHOT_KEYS, keys, []);
    if (!Array.isArray(values) || values.length !== keys.length) throw new Error('Invalid database snapshot');
    for (let i = 0; i < keys.length; i++) {
      if (values[i] === false || values[i] === null) continue;
      if (typeof values[i] !== 'string' || !config.allowedKey(keys[i], 'redis-string')) throw new Error('Unexpected database record');
      await archive.add('redis-string', keys[i], Buffer.from(values[i])); stored.add(keys[i]);
      if (assetPattern.test(keys[i])) assets.set(keys[i], JSON.parse(values[i]));
      else for (const match of values[i].matchAll(/\/api\/evidence\/([a-f0-9-]{36})/g)) referenced.add(`evidence:v1:${match[1]}`);
    }
  };
  for (const group of config.groups) await saveRecords(group);
  for (const pattern of ['copy-reconciliation:v1:*', 'evidence:v1:*']) {
    const keys = await scanKeys(redis, pattern);
    for (let i = 0; i < keys.length; i += 20) await saveRecords(keys.slice(i, i + 20));
  }
  // Derive this index from the snapshots, not a later potentially inconsistent read.
  await archive.add('redis-set', ACTIVE_KEY, Buffer.from(JSON.stringify(config.activeSlugs(stored))));
  let cursor;
  do {
    const page = await blobClient.list({ prefix: 'quarantine/', cursor, limit: 100, token });
    for (const file of page.blobs) {
      if (files.has(file.pathname)) continue;
      if (!/^quarantine\/[a-z0-9-]+\/[a-f0-9-]{36}\.webp$/.test(file.pathname) || !file.url?.startsWith('https:') || !new URL(file.url).hostname.endsWith('.private.blob.vercel-storage.com')) throw new Error('Evidence must be in private Blob storage');
      const bytes = await blobBytes(blobClient, file.pathname, token);
      const id = file.pathname.split('/')[2].slice(0, -5);
      const asset = assets.get(`evidence:v1:${id}`);
      if (asset && (asset.pathname !== file.pathname || asset.sha256 !== digest(bytes) || asset.size !== bytes.length)) throw new Error('Evidence metadata and file disagree');
      await archive.add('blob', file.pathname, bytes); files.add(file.pathname);
    }
    if (page.hasMore && (!page.cursor || page.cursor === cursor)) throw new Error('Invalid Blob pagination');
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  for (const id of referenced) {
    const asset = assets.get(id);
    if (!asset || !files.has(asset.pathname)) throw new Error('Referenced evidence is missing; backup is incomplete');
  }
  return archive.finish();
}

export async function restore({ redis, blobClient, token, opened, targetOrigin, confirmTarget, config }) {
  if (confirmTarget !== targetOrigin || targetOrigin === opened.manifest.source.redisOrigin || digest(token) === opened.manifest.source.blobCredentialHash) throw new Error('Restore requires an explicitly confirmed separate target');
  if (await redis.dbsize() !== 0 || (await blobClient.list({ limit: 1, token })).blobs.length !== 0) throw new Error('Restore target must be empty');
  // Authentication and hashes were checked by openArchive before any target writes.
  if (await redis.eval(CLAIM_RESTORE, ['mtgtrackers:restore-in-progress'], [JSON.stringify({ backup: opened.manifest.id, startedAt: new Date().toISOString() })]) !== 1) throw new Error('Restore target is no longer empty');
  for (const part of opened.manifest.parts.filter((part) => part.kind === 'blob')) {
    const bytes = await opened.read(part);
    await blobClient.put(part.name, bytes, { token, access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'image/webp' });
    if (digest(await blobBytes(blobClient, part.name, token)) !== part.sha256) throw new Error('Restored evidence verification failed');
  }
  for (const part of opened.manifest.parts.filter((part) => part.kind !== 'blob')) {
    if (!config.allowedKey(part.name, part.kind)) throw new Error('Unexpected restore key');
    const bytes = await opened.read(part);
    if (part.kind === 'redis-set') {
      const values = JSON.parse(bytes); if (values.length) await redis.sadd(part.name, ...values);
    } else {
      if (!await redis.set(part.name, bytes.toString('utf8'), { nx: true })) throw new Error('Restore target changed concurrently');
      const raw = await redis.eval(SNAPSHOT_KEYS, [part.name], []);
      if (raw[0] !== bytes.toString('utf8')) throw new Error('Restored database verification failed');
    }
  }
  await redis.del('mtgtrackers:restore-in-progress');
  return { records: opened.manifest.parts.length };
}

async function main() {
  const [mode, directoryArgument] = process.argv.slice(2);
  if (!['backup', 'verify', 'restore'].includes(mode) || !directoryArgument) throw new Error('Usage: node scripts/recovery.mjs backup|verify|restore DIRECTORY');
  const directory = path.resolve(directoryArgument), key = encryptionKey(process.env.BACKUP_ENCRYPTION_KEY), config = recoveryConfig();
  const blobClient = { get, list, put };
  if (mode === 'backup') {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token || !process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Source Redis and private Blob credentials are required');
    const redis = new Redis({ url, token, enableAutoPipelining: false });
    await backup({ redis, blobClient, token: process.env.BLOB_READ_WRITE_TOKEN, directory, key, config,
      source: { redisOrigin: new URL(url).origin, blobCredentialHash: digest(process.env.BLOB_READ_WRITE_TOKEN), revision: process.env.GITHUB_SHA || 'local-unpublished' } });
  }
  const opened = await openArchive(directory, key, config.allowedKey);
  if (mode === 'restore') {
    const url = process.env.RESTORE_REDIS_REST_URL, token = process.env.RESTORE_REDIS_REST_TOKEN, blobToken = process.env.RESTORE_BLOB_READ_WRITE_TOKEN;
    if (!url || !token || !blobToken || process.env.RESTORE_ISOLATED !== 'true') throw new Error('Explicit isolated restore credentials are required');
    await restore({ redis: new Redis({ url, token }), blobClient, token: blobToken, opened, config, targetOrigin: new URL(url).origin, confirmTarget: process.env.RESTORE_CONFIRM_TARGET });
  }
  console.log(`${mode}: verified ${opened.manifest.parts.length} encrypted records. No credentials or evidence printed.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(() => {
  console.error('Recovery operation failed. No complete backup/restore should be assumed. Check configuration, storage integrity and target isolation.'); process.exitCode = 1;
});
