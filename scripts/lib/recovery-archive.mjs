import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';

const MAX_PART = 32 * 1024 * 1024;
const MAX_PARTS = 100000;
const MAGIC = Buffer.from('MTGBK01');
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function encryptionKey(value) {
  if (!/^[a-f0-9]{64}$/i.test(value || '')) throw new Error('BACKUP_ENCRYPTION_KEY must be an independently generated 32-byte hex key');
  return Buffer.from(value, 'hex');
}

export function seal(bytes, key, context) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

export function unseal(bytes, key, context) {
  if (bytes.length < 35 || bytes.length > MAX_PART + 35 || !bytes.subarray(0, 7).equals(MAGIC)) throw new Error('Invalid encrypted backup part');
  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(7, 19));
  decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(bytes.subarray(19, 35));
  return Buffer.concat([decipher.update(bytes.subarray(35)), decipher.final()]);
}

async function readPart(directory, name) {
  if (!/^(manifest|[0-9]{6})\.enc$/.test(name)) throw new Error('Invalid backup filename');
  const filename = path.join(directory, name);
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_PART + 35) throw new Error('Invalid backup file');
  return readFile(filename);
}

export async function createArchive(directory, key, source) {
  await mkdir(directory, { recursive: false, mode: 0o700 });
  const manifest = { schema: 1, id: randomUUID(), startedAt: new Date().toISOString(), source, consistency: 'atomic-related-tracker-groups; immutable-files; not-global-point-in-time', parts: [] };
  return {
    async add(kind, name, bytes) {
      if (!Buffer.isBuffer(bytes) || bytes.length > MAX_PART || manifest.parts.length >= MAX_PARTS) throw new Error('Backup size limit exceeded');
      const filename = `${String(manifest.parts.length).padStart(6, '0')}.enc`;
      const context = `${manifest.id}:${kind}:${name}`;
      await writeFile(path.join(directory, filename), seal(bytes, key, context), { flag: 'wx', mode: 0o600 });
      manifest.parts.push({ kind, name, filename, size: bytes.length, sha256: digest(bytes) });
    },
    async finish() {
      manifest.completedAt = new Date().toISOString();
      await writeFile(path.join(directory, 'manifest.enc'), seal(Buffer.from(JSON.stringify(manifest)), key, 'mtg-recovery-manifest-v1'), { flag: 'wx', mode: 0o600 });
      return manifest;
    },
  };
}

export async function openArchive(directory, key, allowedKey) {
  const manifest = JSON.parse(unseal(await readPart(directory, 'manifest.enc'), key, 'mtg-recovery-manifest-v1').toString('utf8'));
  if (manifest.schema !== 1 || !/^[a-f0-9-]{36}$/.test(manifest.id) || !manifest.completedAt || !manifest.source || !Array.isArray(manifest.parts) || manifest.parts.length > MAX_PARTS) throw new Error('Invalid backup manifest');
  const names = new Set(), filenames = new Set();
  const read = async (part) => {
    const bytes = unseal(await readPart(directory, part.filename), key, `${manifest.id}:${part.kind}:${part.name}`);
    if (bytes.length !== part.size || digest(bytes) !== part.sha256) throw new Error('Backup integrity check failed');
    return bytes;
  };
  for (const part of manifest.parts) {
    if (!['redis-string', 'redis-set', 'blob'].includes(part.kind) || typeof part.name !== 'string' || !Number.isSafeInteger(part.size) || part.size < 0 || part.size > MAX_PART) throw new Error('Invalid backup record');
    if (part.kind === 'blob' ? !/^quarantine\/[a-z0-9-]+\/[a-f0-9-]{36}\.webp$/.test(part.name) : !allowedKey(part.name, part.kind)) throw new Error('Backup contains an unexpected storage path');
    if (names.has(`${part.kind}:${part.name}`) || filenames.has(part.filename)) throw new Error('Duplicate backup record');
    names.add(`${part.kind}:${part.name}`); filenames.add(part.filename);
    const bytes = await read(part);
    if (part.kind === 'redis-set' && (!Array.isArray(JSON.parse(bytes)) || !JSON.parse(bytes).every((value) => typeof value === 'string'))) throw new Error('Invalid set record');
  }
  return { manifest, read };
}
