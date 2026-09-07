const PREFIX = 'mtgtrackers:admin-save:v1:';
const pending = new Map<string, string>();
const inFlight = new Map<string, Promise<void>>();

async function send(path: string, body: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${path}\n${body}`));
  const key = PREFIX + Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  let id = pending.get(key);
  try { id ??= sessionStorage.getItem(key) || undefined; } catch { /* Retry protection still works in memory. */ }
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) id = crypto.randomUUID();
  pending.set(key, id);
  // Store only an opaque ID and payload digest, never private edit contents or credentials.
  try { sessionStorage.setItem(key, id); } catch { /* Storage may be disabled. */ }
  const response = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id }, body,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || data?.message || 'Save could not be confirmed. Retry the same edit.');
  }
  pending.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* No sensitive contents were stored. */ }
}

export function saveAdminMutation(path: string, payload: unknown): Promise<void> {
  const body = JSON.stringify(payload);
  const key = `${path}\n${body}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const operation = send(path, body).finally(() => inFlight.delete(key));
  inFlight.set(key, operation);
  return operation;
}
