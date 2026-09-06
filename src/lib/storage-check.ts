import { BlobNotFoundError, del, get, head, put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { isBlobStorageConfigured } from './blob-config';

type CheckStatus = 'passed' | 'failed' | 'skipped';
export interface StorageCheckResult {
  ok: boolean;
  runId: string;
  checkedAt: string;
  checks: Record<'upload' | 'read' | 'privacy' | 'cleanup', CheckStatus>;
}

function privateProbeUrl(value: string, pathname: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash ||
    !/^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname) || url.pathname !== `/${pathname}`) {
    throw new Error('Unexpected storage destination');
  }
  return url;
}

export async function checkPrivateStorage(): Promise<StorageCheckResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!isBlobStorageConfigured()) throw new Error('Private storage is not configured');
  const runId = randomUUID();
  const pathname = `_diagnostics/storage/${runId}.txt`;
  const bytes = Buffer.from(`MTG Trackers private storage check\n${runId}\n`);
  const checks: StorageCheckResult['checks'] = { upload: 'skipped', read: 'skipped', privacy: 'skipped', cleanup: 'skipped' };
  const options = () => ({ token, abortSignal: AbortSignal.timeout(8000) });
  let stage: 'upload' | 'read' | 'privacy' = 'upload';
  try {
    const uploaded = await put(pathname, bytes, {
      ...options(), access: 'private', addRandomSuffix: false, allowOverwrite: false,
      contentType: 'text/plain', cacheControlMaxAge: 60,
    });
    if (uploaded.pathname !== pathname) throw new Error('Unexpected storage path');
    const url = privateProbeUrl(uploaded.url, pathname);
    checks.upload = 'passed';

    stage = 'read';
    const stored = await get(pathname, { ...options(), access: 'private' });
    if (stored?.statusCode !== 200 || !stored.stream) throw new Error('Private read unavailable');
    const reader = stored.stream.getReader();
    try {
      if (stored.blob.size !== bytes.length || stored.blob.pathname !== pathname) throw new Error('Unexpected file metadata');
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > bytes.length) throw new Error('Unexpected file size');
        chunks.push(part.value);
      }
      if (!Buffer.concat(chunks).equals(bytes)) throw new Error('File integrity mismatch');
    } finally { await reader.cancel(); }
    checks.read = 'passed';

    stage = 'privacy';
    // The only unauthenticated fetch targets this run's validated private Blob URL.
    const anonymous = await fetch(url, {
      method: 'GET', credentials: 'omit', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(8000),
    });
    await anonymous.body?.cancel();
    if (![401, 403].includes(anonymous.status)) throw new Error('Private access denial not confirmed');
    checks.privacy = 'passed';
  } catch { checks[stage] = 'failed'; }
  finally {
    // Never delete a supplied path or a provider-returned path, even after a failed upload.
    try {
      await del(pathname, options());
      try {
        await head(pathname, options());
        checks.cleanup = 'failed';
      } catch (error) {
        checks.cleanup = error instanceof BlobNotFoundError ? 'passed' : 'failed';
      }
    } catch { checks.cleanup = 'failed'; }
  }
  return { ok: Object.values(checks).every((status) => status === 'passed'), runId, checkedAt: new Date().toISOString(), checks };
}
