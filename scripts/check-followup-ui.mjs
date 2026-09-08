import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { loadProjectModule } from './lib/load-project-module.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.COLLECTOR_UI_BASE_URL || 'http://127.0.0.1:3106';
assert.equal(new URL(base).hostname, '127.0.0.1', 'Follow-up fixtures must stay local');
const { getTracker } = loadProjectModule(path.resolve('src/lib/trackers.ts'));
const { createInitialTrackerCards } = loadProjectModule(path.resolve('src/lib/tracker-data.ts'));
await mkdir('node_modules/.cache', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [], posts = [], checks = [];
    const cards = createInitialTrackerCards(getTracker('one-ring'));
    const report = { id: 'followup-fixture', cardId: 7, serialNumber: '007', serialTotal: 100, cardTitle: 'The One Ring', status: 'needs-more-info', submittedAt: '2026-09-07T12:00:00Z', sourceType: 'other', requestedVerificationStatus: 'unverified', evidenceImages: [], notes: 'Original tip', followUps: [] };
    const source = 'https://www.ebay.com/itm/123456789013';
    let loseResponse = true, failSource = true, releaseReply;
    let replyStarted;
    const replyReady = new Promise((resolve) => { replyStarted = resolve; });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route(`${base}/api/**`, async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith('/api/reports/')) {
        assert.equal(request.headers()['x-report-token'], 'fixture-access');
        if (request.method() === 'POST') {
          const body = request.postDataJSON(); posts.push(body);
          assert.match(body.replyId, /^[a-f0-9-]{36}$/);
          const saved = report.followUps.find((reply) => reply.id === body.replyId);
          if (saved) assert.deepEqual(body, posts[0]);
          else report.followUps.push({ id: body.replyId, at: '2026-09-07T12:30:00Z', notes: body.notes, sourceUrl: body.sourceUrl, evidenceAssetIds: body.evidenceAssetIds });
          report.status = 'pending';
          if (loseResponse) {
            loseResponse = false;
            await new Promise((resolve) => { releaseReply = resolve; replyStarted(); });
            return route.fulfill({ status: 503, json: { message: 'Fixture response lost. Retry the same reply.' } });
          }
        }
        return route.fulfill({ json: { ...report, request: report.status === 'needs-more-info' ? 'Please add a direct source for this serial.' : undefined } });
      }
      if (pathname.endsWith('/source')) {
        checks.push(request.postDataJSON());
        assert.deepEqual(checks.at(-1), { replyId: report.followUps[0].id });
        return route.fulfill({ status: failSource ? 503 : 200, json: failSource ? { message: 'Link screening is unavailable. This report remains pending.' } : { url: source } });
      }
      if (pathname.endsWith('/cards')) return route.fulfill({ json: cards });
      if (pathname.endsWith('/submissions')) return route.fulfill({ json: [report] });
      if (pathname === '/api/admin/login') return route.fulfill({ json: { authenticated: true } });
      return route.fulfill({ status: 204, body: '' });
    });
    const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}: ${page.url()}`);
    await page.goto(`${base}/reports/one-ring/${report.id}#fixture-access`);
    await page.getByText('Please add a direct source for this serial.', { exact: true }).waitFor();
    const sourceInput = page.getByLabel('Source link (optional)', { exact: true });
    const notes = page.getByLabel('Additional information', { exact: true });
    const send = page.getByRole('button', { name: 'Send reply', exact: true });
    await send.click();
    await page.getByRole('status').filter({ hasText: 'Add a source link, notes or an attachment' }).waitFor();
    await sourceInput.fill('https://unsupported.example/card');
    await send.click();
    await page.getByRole('status').filter({ hasText: 'supported direct HTTPS' }).waitFor();
    assert.equal(posts.length, 0);
    await sourceInput.fill(`${source}?tracking=discard#discard`);
    await noOverflow();
    await page.screenshot({ path: `node_modules/.cache/followup-form-${width}.png`, fullPage: true });
    await send.click();
    await replyReady;
    assert.equal(await sourceInput.isDisabled(), true);
    assert.equal(await notes.isDisabled(), true);
    assert.equal(await send.isDisabled(), true);
    assert.equal(typeof releaseReply, 'function');
    releaseReply();
    await page.getByRole('status').filter({ hasText: 'Fixture response lost' }).waitFor();
    assert.equal(await sourceInput.inputValue(), `${source}?tracking=discard#discard`);
    await send.click();
    await page.getByText('pending', { exact: true }).waitFor();
    assert.equal(posts.length, 2); assert.deepEqual(posts[0], posts[1]);
    assert.equal(posts[0].sourceUrl, source); assert.equal(posts[0].notes, '');
    await page.getByText(`Source: ${source}`, { exact: true }).waitFor();
    assert.equal(await page.locator(`a[href="${source}"]`).count(), 0);
    assert.equal(await page.locator('script[src*="insights"]').count(), 0);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
    await noOverflow();
    await page.screenshot({ path: `node_modules/.cache/followup-saved-${width}.png`, fullPage: true });

    report.status = 'needs-more-info';
    await page.getByRole('button', { name: 'Refresh report status', exact: true }).click();
    await notes.fill('The serial is visible at the end of the post.');
    await send.click(); await page.getByText('pending', { exact: true }).waitFor();
    assert.equal(posts.length, 3); assert.notEqual(posts[2].replyId, posts[0].replyId);
    assert.equal(posts[2].sourceUrl, undefined);
    assert.equal(report.followUps.length, 2);

    await page.goto(`${base}/trackers/one-ring`);
    await page.getByRole('heading', { name: 'Serials', exact: true }).waitFor();
    await page.keyboard.press('Control+Alt+a');
    await page.getByText('Admin Panel', { exact: true }).waitFor();
    await page.getByText(source, { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Approve', exact: true }).isEnabled(), true);
    assert.equal(await page.getByRole('link', { name: /Open source:/ }).count(), 0);
    await page.getByRole('button', { name: 'Check source link', exact: true }).click();
    await page.getByText('Link screening is unavailable. This report remains pending.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: /Open source:/ }).count(), 0);
    failSource = false;
    await page.getByRole('button', { name: 'Check source link', exact: true }).click();
    const open = page.getByRole('link', { name: 'Open source: www.ebay.com', exact: true });
    await open.waitFor(); assert.equal(await open.getAttribute('href'), source);
    await noOverflow();
    await page.screenshot({ path: `node_modules/.cache/followup-review-${width}.png` });
    assert.equal(checks.length, 2); assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS: ${width}px link-only/notes-only replies, validation, lost-response retry, privacy and stored-source review (mocked APIs).`);
  }
} finally { await browser.close(); }
