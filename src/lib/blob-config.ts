export function isBlobStorageConfigured() {
  // Store connections use SDK-managed Vercel OIDC; presence is not a service test.
  return Boolean(process.env.BLOB_STORE_ID?.trim() || process.env.BLOB_READ_WRITE_TOKEN?.trim());
}
