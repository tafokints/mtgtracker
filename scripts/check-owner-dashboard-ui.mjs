import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.OWNER_UI_BASE_URL || 'http://127.0.0.1:3103';
assert.equal(new URL(base).hostname, '127.0.0.1', 'Owner fixtures must stay local');
await mkdir('node_modules/.cache', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = []; const requests = []; const actions = [];
    let authenticated = false; let failLogin = true; let failInbox = false; let failLogout = false;
    let storageConfigured = false; let failCleanup = true; let storageChecks = 0; let storageAuthExpired = false;
    let failInventory = true;
    const report = { id: 'fixture-report', cardId: 7, serialNumber: '007', serialTotal: 100, cardTitle: 'The One Ring', status: 'pending', kind: 'discovery', submittedAt: '2026-09-05T10:00:00.000Z', sourceType: 'other', requestedVerificationStatus: 'unverified', evidenceImages: [], notes: 'Private fixture collector note', reviewHistory: [] };
    const held = { ...report, id: 'held-report', cardId: 8, serialNumber: '008', evidenceImages: [{ url: '/api/evidence/11111111-1111-4111-8111-111111111111' }], evidenceSafety: [{ url: '/api/evidence/11111111-1111-4111-8111-111111111111', status: 'flagged', reason: 'sexual-content' }] };
    let support;
    const heldSupport = { ...held, id: 'held-support', cardId: 7, serialNumber: '007', link: 'https://www.ebay.com/itm/123456789013' };
    const row = (item) => ({ id: item.id, tracker: 'one-ring', trackerTitle: 'The One Ring', cardTitle: 'The One Ring', serial: `${item.serialNumber}/100`, status: item.status, kind: item.kind, submittedAt: item.submittedAt, imageCount: item.evidenceImages.length, hasSource: false });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => requests.push(request.url()));
    await page.route(`${base}/api/**`, (route) => {
      const url = new URL(route.request().url()); const method = route.request().method();
      if (url.pathname === '/api/admin/login') {
        if (method === 'POST') {
          assert.deepEqual(route.request().postDataJSON(), { password: 'fixture-only-password', code: '123456' });
          if (failLogin) return route.fulfill({ status: 401, json: { message: 'Invalid password or authenticator code' } });
          authenticated = true;
        }
        if (method === 'DELETE') { if (failLogout) return route.fulfill({ status: 503, json: {} }); authenticated = false; }
        return route.fulfill({ json: { authenticated, mfaRequired: true, principal: authenticated ? { id: 'fixture-owner', role: 'owner' } : null } });
      }
      if (!authenticated) return route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
      if (url.pathname === '/api/admin/configuration') return route.fulfill({ json: { services: [{ name: 'Malware scanner', configured: false }, { name: 'Redis', configured: true }, { name: 'Private image storage', configured: storageConfigured }] } });
      if (url.pathname === '/api/admin/storage-inventory') {
        assert.equal(method, 'POST');
        if (failInventory) return route.fulfill({ status: 503, json: { message: 'Inventory temporarily unavailable' } });
        const next = route.request().postDataJSON().cursor;
        return route.fulfill({ json: { rows: [{ id: '11111111-1111-4111-8111-111111111111', card: 'The One Ring 007/100', status: next ? 'unknown' : 'candidate', createdAt: '2026-08-01T00:00:00Z', bytes: 1024 }], nextCursor: next ? null : 'next-inventory', checkedAt: '2026-09-06T00:00:00Z' } });
      }
      if (url.pathname === '/api/admin/storage-check') {
        assert.equal(method, 'POST');
        assert.deepEqual(route.request().postDataJSON(), { confirm: 'TEST_PRIVATE_STORAGE' });
        storageChecks++;
        if (storageAuthExpired) { authenticated = false; return route.fulfill({ status: 401, json: { message: 'Unauthorized' } }); }
        return route.fulfill({ status: failCleanup ? 503 : 200, json: {
          ok: !failCleanup, runId: '11111111-1111-4111-8111-111111111111', checkedAt: '2026-09-05T10:00:00Z',
          checks: { upload: 'passed', read: 'passed', privacy: 'passed', cleanup: failCleanup ? 'failed' : 'passed' },
        } });
      }
      if (url.pathname === '/api/admin/inbox') {
        if (failInbox) return route.fulfill({ status: 503, json: { message: 'Inbox temporarily unavailable' } });
        const status = url.searchParams.get('status');
        return route.fulfill({ json: { rows: status === 'rejected' ? [] : [row(report), row(held)], nextCursor: null } });
      }
      if (url.pathname.endsWith('/cards')) return route.fulfill({ json: [7, 8].map((id) => ({ id, name: `The One Ring 00${id}/100`, cardTitle: 'The One Ring', serialNumber: `00${id}`, serialTotal: 100, found: false, verificationStatus: 'unverified', priceHistory: [] })) });
      if (url.pathname.endsWith('/submissions')) {
        if (method === 'POST') {
          const body = route.request().postDataJSON(); actions.push(body);
          assert.equal(body.submissionId, report.id); assert.equal(body.action, 'approve');
          assert.deepEqual(body.mergeSubmissionIds, ['support-report']);
          report.status = 'approved'; report.reviewedBy = 'fixture-owner'; report.reviewedAt = '2026-09-05T10:05:00.000Z';
          report.reviewHistory = [{ id: 'review', at: report.reviewedAt, actor: 'admin', actorId: 'fixture-owner', action: 'approve' }];
        }
        return route.fulfill({ json: [report, held, ...(support ? [support, heldSupport] : [])] });
      }
      return route.fulfill({ status: 503, json: { message: 'Unexpected fixture request' } });
    });
    const response = await page.goto(`${base}/admin`);
    assert.match(response.headers()['cache-control'], /no-store/);
    assert.equal(response.headers()['referrer-policy'], 'no-referrer');
    await page.getByRole('heading', { name: 'Owner sign-in' }).waitFor();
    assert.equal(requests.some((url) => url.includes('/api/admin/inbox')), false);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
    async function signIn() { await page.getByLabel('Owner password').fill('fixture-only-password'); await page.getByLabel('Authenticator code').fill('123456'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); }
    await signIn(); await page.getByRole('alert').filter({ hasText: 'Invalid password' }).waitFor();
    failLogin = false; await signIn();
    await page.getByRole('button', { name: /The One Ring 007\/100/ }).click();
    await page.getByText('Private fixture collector note', { exact: false }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('img[alt="Reference artwork"]')].every((image) => image.complete && image.naturalWidth > 0));
    await page.screenshot({ path: `node_modules/.cache/owner-dashboard-${width}.png`, fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.equal(await page.getByRole('button', { name: 'Approve', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Needs Info', exact: true }).isEnabled(), true);
    assert.equal(await page.getByLabel('Approved verification', { exact: true }).isDisabled(), true);
    await page.getByText(/A new discovery needs a supported source link or uploaded evidence/).waitFor();
    support = { ...report, id: 'support-report', link: 'https://www.ebay.com/itm/123456789012', notes: 'Supporting source' };
    await page.getByRole('button', { name: 'Close report review' }).click();
    await page.getByRole('button', { name: /The One Ring 007\/100/ }).click();
    assert.equal(await page.getByRole('button', { name: 'Approve', exact: true }).isDisabled(), true);
    await page.getByRole('checkbox', { name: /123456789012/ }).check();
    assert.equal(await page.getByRole('button', { name: 'Approve', exact: true }).isEnabled(), true);
    assert.equal(await page.getByLabel('Approved verification', { exact: true }).isEnabled(), true);
    await page.getByRole('checkbox', { name: /123456789013/ }).check();
    assert.equal(await page.getByRole('button', { name: 'Approve', exact: true }).isDisabled(), true);
    await page.getByText('All selected attachments must pass safety checks before approval.', { exact: true }).waitFor();
    await page.getByRole('checkbox', { name: /123456789013/ }).uncheck();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await page.getByRole('button', { name: 'Retract approval', exact: true }).waitFor();
    assert.equal(actions.length, 1);
    await page.getByRole('button', { name: 'Close report review' }).click();
    await page.getByRole('button', { name: /The One Ring 008\/100/ }).click();
    await page.getByText('Evidence held by safety checks').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Approve', exact: true }).isDisabled(), true);
    assert.equal(requests.some((url) => url.includes('/api/evidence/')), false);
    await page.getByRole('button', { name: 'Close report review' }).click();
    await page.getByLabel('Status', { exact: true }).selectOption('rejected');
    await page.getByRole('heading', { name: 'No matching reports' }).waitFor();
    failInbox = true; await page.getByRole('button', { name: 'Refresh inbox' }).click();
    await page.getByRole('alert').filter({ hasText: 'Inbox temporarily unavailable' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'No matching reports' }).count(), 0);
    await page.getByRole('button', { name: 'Service setup' }).click();
    await page.getByText('Missing configuration', { exact: true }).first().waitFor();
    await page.getByText('Not verified here', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Check inventory', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Inventory temporarily unavailable' }).waitFor();
    failInventory = false;
    await page.getByRole('button', { name: 'Check inventory', exact: true }).click();
    await page.getByText('Potentially abandoned', { exact: true }).waitFor();
    const inventory = page.getByRole('region', { name: 'Upload retention inventory' });
    assert.equal(await inventory.getByRole('button', { name: /delete/i }).count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await inventory.screenshot({ path: `node_modules/.cache/storage-inventory-${width}.png` });
    await page.getByRole('button', { name: 'Next inventory batch' }).click();
    await page.getByText('Needs investigation', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Next inventory batch' }).isDisabled(), true);
    await page.getByRole('button', { name: 'Previous inventory batch' }).click();
    await page.getByText('Potentially abandoned', { exact: true }).waitFor();
    assert.equal(storageChecks, 0);
    assert.equal(await page.getByRole('button', { name: 'Test storage', exact: true }).isDisabled(), true);
    storageConfigured = true;
    await page.getByRole('button', { name: 'Refresh configuration' }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent === 'Test storage' && !button.disabled));
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Test storage', exact: true }).click();
    assert.equal(storageChecks, 0);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Test storage', exact: true }).click();
    await page.getByText('Storage checks incomplete', { exact: true }).waitFor();
    await page.getByRole('alert').filter({ hasText: 'Cleanup needs review' }).waitFor();
    assert.equal(storageChecks, 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `node_modules/.cache/storage-check-${width}.png`, fullPage: true });
    failCleanup = false;
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Test storage', exact: true }).click();
    await page.getByText('Storage checks passed', { exact: true }).waitFor();
    assert.equal(await page.getByRole('alert').filter({ hasText: 'Cleanup needs review' }).count(), 0);
    assert.equal(storageChecks, 2);
    failLogout = true; await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('alert').filter({ hasText: 'Sign-out could not be confirmed' }).waitFor();
    failLogout = false; await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('heading', { name: 'Owner sign-in' }).waitFor();
    assert.equal(await page.getByText('Storage checks passed', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Potentially abandoned', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Private fixture collector note', { exact: false }).count(), 0);
    await signIn();
    await page.getByRole('button', { name: 'Test storage', exact: true }).waitFor();
    storageAuthExpired = true;
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Test storage', exact: true }).click();
    await page.getByRole('heading', { name: 'Owner sign-in' }).waitFor();
    assert.equal(requests.some((url) => /vercel-scripts|vercel-insights|_vercel\/insights|_vercel\/speed-insights/.test(url)), false);
    assert.deepEqual(errors, []);
    console.log(`PASS: ${width}px private dashboard login, review, held evidence, filtering, outage, storage checks, expired access and logout (mocked APIs)`);
    await page.close();
  }
} finally { await browser.close(); }
