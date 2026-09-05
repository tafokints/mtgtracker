import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { loadProjectModule } from './lib/load-project-module.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const base = 'http://127.0.0.1:3102';
const { getTracker } = loadProjectModule(path.resolve('src/lib/trackers.ts'));
const { createInitialTrackerCards } = loadProjectModule(path.resolve('src/lib/tracker-data.ts'));
const tracker = getTracker('one-ring');
const cards = createInitialTrackerCards(tracker);
cards[6] = { ...cards[6], found: true, verificationStatus: 'confirmed', foundBy: 'Fixture collector', dateFound: '2026-01-01', price: 1500, priceDate: '2026-07-01', priceHistory: [{ id: 'sale', price: 1500, date: '2026-07-01', kind: 'completed-sale', currency: 'USD' }, { id: 'listing', price: 3000, date: '2026-09-01', kind: 'asking-price', currency: 'EUR' }], gradingHistory: [{ id: 'psa', status: 'graded', grading: { service: 'PSA', grade: 9, certificateNumber: '12345' }, occurredOn: '2026-03-01', recordedAt: '2026-03-02T00:00:00Z' }, { id: 'raw', status: 'ungraded', occurredOn: '2026-06-01', recordedAt: '2026-06-02T00:00:00Z' }] };
const pending = { id: 'pending-fixture', cardId: 7, serialNumber: '007', cardTitle: tracker.title, serialTotal: 100, status: 'pending', submittedAt: '2026-09-05T00:00:00Z', kind: 'correction', sourceType: 'other', requestedVerificationStatus: 'source-linked', evidenceImages: [], notes: 'Correct the discovery date.', price: 3000, currency: 'EUR', priceKind: 'asking-price', priceDate: '2026-09-01', followUps: [{ id: 'reply', at: '2026-09-05T01:00:00Z', notes: 'Additional serial context.' }] };
await mkdir('node_modules/.cache', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    const reviewPosts = [];
    const metadataPosts = [];
    let replySaved = false;
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route(`${base}/api/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/cards')) return route.fulfill({ json: cards });
      if (/\/(update-grading|update-price|add-price-history)$/.test(url.pathname)) { metadataPosts.push({ path: url.pathname, body: route.request().postDataJSON() }); return route.fulfill({ json: { success: true } }); }
      if (url.pathname === '/api/admin/login') return route.fulfill({ json: { authenticated: true } });
      if (url.pathname === '/api/admin/affiliate-stats') return route.fulfill({ status: 503, json: { message: 'Isolated UI fixture' } });
      if (url.pathname.endsWith('/submissions')) {
        if (route.request().method() === 'POST') { reviewPosts.push(route.request().postDataJSON()); return route.fulfill({ json: { success: true } }); }
        return route.fulfill({ json: [pending, { ...pending, id: 'approved-fixture', status: 'approved', kind: 'discovery', reviewHistory: [{ id: 'review', actor: 'admin', action: 'approve', at: '2026-09-05T00:00:00Z' }] }] });
      }
      if (url.pathname.startsWith('/api/reports/')) {
        assert.equal(route.request().headers()['x-report-token'], 'fixture-access');
        if (route.request().method() === 'POST') { assert.equal(route.request().postDataJSON().notes, 'Additional evidence context.'); replySaved = true; }
        return route.fulfill({ json: { status: replySaved ? 'pending' : 'needs-more-info', cardTitle: tracker.title, serialNumber: '007', serialTotal: 100, request: replySaved ? undefined : 'Please provide the opening date.', followUps: [] } });
      }
      return route.fulfill({ status: 204, body: '' });
    });
    const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `Horizontal overflow at ${width}`);
    await page.goto(`${base}/trackers/one-ring/submit?serial=007`);
    await page.waitForLoadState('networkidle');
    await page.locator('#price').fill('1234.50');
    await page.getByRole('combobox', { name: /Price type/ }).selectOption('completed-sale');
    await page.getByLabel('Price date', { exact: true }).fill('2026-09-01');
    await page.getByText('Grading observation (optional)', { exact: true }).click();
    await page.getByLabel('Grading service', { exact: true }).fill('PSA');
    await page.getByLabel('Grade', { exact: true }).fill('9');
    await page.getByLabel('Certificate number', { exact: true }).fill('1234567890');
    await noOverflow();
    await page.screenshot({ path: `node_modules/.cache/workflow-submit-${width}.png`, fullPage: true });

    await page.goto(`${base}/trackers/one-ring`);
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+Alt+a');
    await page.getByText('Admin Panel', { exact: true }).waitFor();
    await page.getByText('Replace the supplied recorded facts with this correction', { exact: true }).waitFor();
    await page.getByRole('checkbox', { name: 'Replace the supplied recorded facts with this correction' }).check();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Approve:'));
    assert.equal(reviewPosts[0].applyCorrection, true);
    await page.getByRole('button', { name: 'Retract approval', exact: true }).waitFor();
    await noOverflow();
    await page.screenshot({ path: `node_modules/.cache/workflow-review-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Grading', exact: true }).click();
    await page.getByLabel('Select Card', { exact: true }).selectOption('7');
    await page.getByRole('combobox', { name: /Observed status/ }).selectOption('ungraded');
    await page.getByLabel('Observation date', { exact: true }).fill('2026-09-05');
    await page.getByRole('button', { name: 'Update Grading', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Grading updated'));
    assert.equal(metadataPosts[0].body.status, 'ungraded');
    assert.equal(metadataPosts[0].body.grading, undefined);
    await page.getByRole('button', { name: 'Price', exact: true }).click();
    await page.getByLabel('Select Card', { exact: true }).selectOption('7');
    await page.locator('input[type="number"]').fill('2000');
    await page.getByRole('combobox', { name: /Price type/ }).selectOption('completed-sale');
    await page.getByLabel('Observation date', { exact: true }).fill('2026-09-05');
    await page.getByRole('button', { name: 'Update Price', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Price updated'));
    assert.equal(metadataPosts[1].body.kind, 'completed-sale');
    assert.equal(metadataPosts[1].body.currency, 'USD');
    await noOverflow();

    await page.goto(`${base}/trackers/one-ring?serial=007`);
    await page.getByRole('heading', { name: 'Grading History', exact: true }).waitFor();
    await page.getByText('Observed ungraded', { exact: true }).waitFor();
    await page.getByText('EUR 3,000', { exact: true }).waitFor();
    await noOverflow();
    await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Grading History', exact: true }) }).screenshot({ path: `node_modules/.cache/workflow-grading-history-${width}.png` });

    await page.goto(`${base}/reports/one-ring/private-fixture#fixture-access`);
    await page.getByText('Please provide the opening date.', { exact: true }).waitFor();
    await page.getByLabel('Additional information', { exact: true }).fill('Additional evidence context.');
    await page.getByRole('button', { name: 'Send reply', exact: true }).click();
    await page.getByText('pending', { exact: true }).waitFor();
    await noOverflow();
    assert.equal(await page.locator('script[src*="insights"]').count(), 0);
    await page.screenshot({ path: `node_modules/.cache/workflow-receipt-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS: ${width}px report fields, correction review, private reply, no horizontal overflow or browser errors (mocked APIs).`);
  }
} finally { await browser.close(); }
