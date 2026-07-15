export function sanitizeInternalPath(value: unknown, maxLength = 240) {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.slice(0, maxLength);

  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return undefined;
  }

  return trimmed;
}
