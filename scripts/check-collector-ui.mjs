import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { loadProjectModule } from './lib/load-project-module.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const sharp = require('sharp');
const base = process.env.COLLECTOR_UI_BASE_URL || 'http://127.0.0.1:3106';
assert.equal(new URL(base).hostname, '127.0.0.1', 'Collector fixtures must stay local');
const { getTracker } = loadProjectModule(path.resolve('src/lib/trackers.ts'));
const { createInitialTrackerCards } = loadProjectModule(path.resolve('src/lib/tracker-data.ts'));
const png = await sharp({ create: { width: 64, height: 90, channels: 3, background: '#48776c' } }).png().toBuffer();
await mkdir('node_modules/.cache', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    const posts = [];
    let unavailable = false;
    let failSubmit = true;
    let uploads = 0;
    const oneRing = createInitialTrackerCards(getTracker('one-ring'));
    oneRing[6] = { ...oneRing[6], found: true, verificationStatus: 'confirmed', pendingReports: 1 };
    oneRing[7] = { ...oneRing[7], pendingReports: 1 };
    const posters = createInitialTrackerCards(getTracker('lotr-poster-cards'));
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) => route.fulfill({ contentType: 'application/javascript', body: `
      (() => { const widgets = new Map(); let id = 0;
        window.turnstile = {
          render(element, options) { const key = String(++id); widgets.set(key, options); element.textContent = 'Isolated verification fixture'; setTimeout(() => { options.callback('fixture-token'); window.fixtureTokenReady = true; }, 50); return key; },
          reset(key) { setTimeout(() => widgets.get(key)?.callback('fixture-token'), 50); },
          remove(key) { widgets.delete(key); }
        };
      })();` }));
    await page.route(`${base}/api/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/cards')) return route.fulfill(unavailable ? { status: 503, json: {} } : { json: url.pathname.includes('lotr-poster-cards') ? posters : oneRing });
      if (url.pathname === '/api/admin/login') return route.fulfill({ json: { authenticated: false, mfaRequired: true } });
      if (url.pathname.endsWith('/submission-session')) return route.fulfill({ json: { token: 'fixture-session', expiresAt: Date.now() + 3600000 } });
      if (url.pathname.endsWith('/upload-image')) {
        assert.equal(route.request().headers()['x-submission-token'], 'fixture-session');
        uploads++;
        return route.fulfill({ json: { assetId: '11111111-1111-4111-8111-111111111111', safetyStatus: 'pending' } });
      }
      if (url.pathname.endsWith('/submit')) {
        posts.push(route.request().postDataJSON());
        if (failSubmit) return route.fulfill({ status: 503, json: { message: 'Fixture temporary failure' } });
        return route.fulfill({ json: { followUpPath: '/reports/one-ring/fixture-report#fixture-private-access' } });
      }
      if (url.pathname.startsWith('/reports/') || url.pathname.startsWith('/api/reports/')) {
        assert.equal(route.request().headers()['x-report-token'], 'fixture-private-access');
        return route.fulfill({ json: { status: 'pending', cardTitle: 'The One Ring', serialNumber: '007', serialTotal: 100, followUps: [] } });
      }
      return route.fulfill({ status: 204, body: '' });
    });
    const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}`);
    const collection = () => page.getByRole('region', { name: /serialized cards$/ });
    const topPages = () => page.getByRole('navigation', { name: 'Serial pages top' });
    const waitCards = async () => { await page.getByRole('heading', { name: 'Serials', exact: true }).waitFor(); await collection().locator('article').first().waitFor(); };

    for (const slug of ['one-ring', 'lotr-poster-cards']) {
      await page.goto(`${base}/trackers/${slug}?page=2`);
      await waitCards();
      assert.equal(await collection().locator('article').count(), 48);
      assert.equal(await topPages().getByRole('combobox').inputValue(), '2');
      assert.match(await collection().locator('article h3').first().innerText(), /049\/100/);
      await page.reload(); await waitCards();
      assert.equal(await topPages().getByRole('combobox').inputValue(), '2');
      await topPages().getByRole('button', { name: 'Next page' }).click();
      await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === '3');
      assert.match(await collection().locator('article h3').first().innerText(), /097\/100/);
      await topPages().getByRole('button', { name: 'Previous page' }).click();
      await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === '2');
      const details = collection().getByRole('button', { name: 'View Details', exact: true }).first();
      await details.click();
      await page.getByRole('dialog').waitFor();
      await page.getByRole('button', { name: 'Next serial', exact: true }).click();
      assert.match(await page.getByRole('dialog').getByRole('heading').first().innerText(), /050\/100/);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.equal(await details.evaluate((element) => element === document.activeElement), true);
      await details.click();
      await page.goBack();
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.equal(await topPages().getByRole('combobox').inputValue(), '2');
      await page.getByRole('searchbox', { name: 'Serial or card' }).fill('#007/100');
      await page.waitForFunction(() => !new URL(location.href).searchParams.has('page'));
      assert.equal(await collection().locator('article').count(), slug === 'one-ring' ? 1 : 20);
      if (slug === 'lotr-poster-cards') {
        await page.getByRole('combobox', { name: 'Card', exact: true }).selectOption('the-one-ring');
        assert.equal(await collection().locator('article').count(), 1);
        await collection().getByRole('button', { name: 'View Details' }).click();
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('searchbox').inputValue(), '#007/100');
        assert.equal(await page.getByRole('combobox', { name: 'Card', exact: true }).inputValue(), 'the-one-ring');
      }
      await noOverflow();
      await page.getByRole('heading', { name: 'Serials', exact: true }).evaluate((element) => element.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: `node_modules/.cache/collector-${slug}-${width}.png` });
    }

    await page.goto(`${base}/trackers/one-ring`); await waitCards();
    const disclosure = page.getByRole('note').first();
    await disclosure.waitFor();
    assert.match(await disclosure.innerText(), /As an eBay Partner Network Affiliate/);
    const firstAffiliate = page.getByRole('navigation', { name: 'Primary marketplace links' }).getByRole('link').first();
    assert.ok((await disclosure.boundingBox()).y + (await disclosure.boundingBox()).height <= (await firstAffiliate.boundingBox()).y);
    assert.match(await firstAffiliate.getAttribute('rel'), /sponsored/);
    await page.screenshot({ path: `node_modules/.cache/collector-top-${width}.png` });
    await page.getByRole('group', { name: 'Quick status filters' }).getByRole('button', { name: /Under review/ }).click();
    assert.equal(await collection().locator('article').count(), 2);
    await collection().getByText('1 update under review', { exact: true }).waitFor();
    await collection().getByText('Under Review', { exact: true }).waitFor();
    await collection().getByRole('link', { name: 'Report an Update' }).click();
    await page.getByRole('combobox', { name: 'Report type' }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Report type' }).inputValue(), 'sighting');
    await page.getByRole('checkbox', { name: /I have permission/ }).check();
    await page.getByText('Isolated verification fixture', { exact: true }).waitFor();
    await page.waitForFunction(() => window.fixtureTokenReady === true);
    await page.locator('input[type="file"]').setInputFiles({ name: 'serial-photo.png', mimeType: 'image/png', buffer: png });
    await page.getByText('Not sent yet', { exact: true }).waitFor();
    assert.equal(uploads, 0);
    await page.getByLabel('Notes', { exact: true }).fill('Fixture collector context');
    await page.getByRole('button', { name: 'Submit report', exact: true }).click();
    await page.getByText('Fixture temporary failure', { exact: true }).waitFor();
    assert.equal(uploads, 1);
    assert.equal(await page.getByLabel('Notes', { exact: true }).inputValue(), 'Fixture collector context');
    failSubmit = false;
    await page.getByRole('button', { name: 'Submit report', exact: true }).click();
    await page.getByRole('heading', { name: 'Report queued', exact: true }).waitFor();
    assert.equal(posts.length, 2);
    assert.equal(uploads, 1, 'A report retry must reuse successful uploads.');
    assert.deepEqual(posts[0], posts[1]);
    assert.equal(posts[1].kind, 'sighting');
    assert.deepEqual(posts[1].evidenceAssetIds, ['11111111-1111-4111-8111-111111111111']);
    assert.equal(await page.locator('form').count(), 0);
    await noOverflow();
    await page.screenshot({ path: `node_modules/.cache/collector-receipt-${width}.png` });
    await page.getByRole('link', { name: 'View private report status' }).click();
    await page.getByText('pending', { exact: true }).waitFor();
    assert.equal(await page.locator('script[src*="insights"]').count(), 0);
    unavailable = true;
    await page.goto(`${base}/trackers/one-ring`);
    await page.getByText('Tracker data is temporarily unavailable.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('group', { name: 'Quick status filters' }).count(), 0);
    await noOverflow();
    assert.deepEqual(errors, []);
    console.log(`PASS: ${width}px single/multi tracker pagination, URLs, filters, accessible details, upload, retry, receipt, privacy and outage (mocked APIs).`);
    await context.close();
  }
} finally { await browser.close(); }
