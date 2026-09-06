import assert from 'node:assert/strict';

export function assertPrivate(response, label) {
  assert.match(response.headers.get('cache-control') || '', /(?:^|[,\s])no-store(?:$|[,\s])/, `${label} must not be stored in caches`);
}

export async function checkOwnerBoundary(baseUrl, fetcher = fetch) {
  const results = [];
  async function request(path) {
    const response = await fetcher(`${baseUrl}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'MTGTrackers security smoke' } });
    assert.equal(response.status, path === '/admin' || path === '/api/admin/login' ? 200 : 401, `${path} unexpected status`);
    return response;
  }
  const page = await request('/admin');
  assertPrivate(page, '/admin');
  assert.match(page.headers.get('x-robots-tag') || '', /noindex/);
  assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
  const csp = page.headers.get('content-security-policy') || '';
  assert.match(csp, /frame-ancestors 'none'/);
  assert.ok(!csp.includes("'unsafe-eval'"), 'Production CSP must not permit unsafe-eval');
  results.push({ path: '/admin privacy headers', ok: true });
  const login = await request('/api/admin/login');
  assertPrivate(login, 'Owner session status');
  const session = await login.json();
  assert.equal(session.authenticated, false, 'Anonymous session must not be authenticated');
  assert.equal(session.principal, null, 'Anonymous session must not expose a principal');
  assert.equal(session.mfaRequired, true, 'Production owner login must require MFA');
  assert.deepEqual(Object.keys(session).sort(), ['authenticated', 'mfaRequired', 'principal']);
  results.push({ path: '/api/admin/login anonymous MFA status', ok: true });
  for (const path of ['/api/admin/inbox', '/api/admin/configuration', '/api/trackers/one-ring/submissions', '/api/trackers/one-ring/export', '/api/admin/reconcile-copies']) {
    const response = await request(path);
    if (path === '/api/admin/inbox' || path === '/api/admin/configuration') assertPrivate(response, path);
    assert.deepEqual(await response.json(), { message: 'Unauthorized' }, `${path} must return only an anonymous denial`);
    results.push({ path: `${path} anonymous denial`, ok: true });
  }
  return results;
}

export function assertMinimalHealth(health) {
  assert.deepEqual(health, { ok: true }, 'Public health must not expose configuration or provider diagnostics');
}
