import { afterEach, describe, expect, it, vi } from 'vitest';
import { isBlobStorageConfigured } from '@/lib/blob-config';

describe('Blob configuration presence', () => {
  afterEach(() => vi.unstubAllEnvs());
  it.each([
    ['', '', false], ['  ', '  ', false], ['store_fixture', '', true], ['', 'fixture-token', true], ['store_fixture', 'fixture-token', true],
  ])('recognizes a store connection or static token without authenticating (%s, %s)', (storeId, token, expected) => {
    vi.stubEnv('BLOB_STORE_ID', storeId); vi.stubEnv('BLOB_READ_WRITE_TOKEN', token);
    expect(isBlobStorageConfigured()).toBe(expected);
  });
});
