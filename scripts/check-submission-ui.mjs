import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const sharp = require('sharp');
const base = process.env.COLLECTOR_UI_BASE_URL || 'http://127.0.0.1:3106';
assert.equal(new URL(base).hostname, '127.0.0.1', 'Submission fixtures must stay local');
const photo = await sharp({ create: { width: 64, height: 90, channels: 3, background: '#48776c' } }).png().toBuffer();
const file = (name) => ({ name, mimeType: 'image/png', buffer: photo });
await mkdir('node_modules/.cache', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const runtimeErrors = [];
    const permissions = [], uploads = [], reports = [];
    let failSecondUpload = true, failReport = true, abortReport = false, timeOffset = 0;
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) => route.fulfill({ contentType: 'application/javascript', body: `
      window.turnstile = {
        render(element, options) { element.textContent = 'Isolated verification fixture'; window.fixtureChallenge = options; setTimeout(() => options.callback('fixture-token'), 30); return 'fixture'; },
        reset() { setTimeout(() => window.fixtureChallenge.callback('fixture-token'), 30); }, remove() {}
      };` }));
    await page.route(`${base}/api/**`, async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/submission-session')) {
        const input = route.request().postDataJSON();
        assert.equal(input.consent, true);
        permissions.push(input);
        return route.fulfill({ json: { token: `fixture-${permissions.length}`, expiresAt: Date.now() + timeOffset + 3600000 } });
      }
      if (pathname.endsWith('/upload-image')) {
        uploads.push(route.request().headers()['x-submission-token']);
        assert.equal(uploads.at(-1), `fixture-${permissions.length}`);
        if (failSecondUpload && uploads.length === 2) return route.fulfill({ status: 503, json: { message: 'Fixture upload outage' } });
        return route.fulfill({ json: { assetId: `${String(uploads.length).padStart(8, '0')}-1111-4111-8111-111111111111`, safetyStatus: 'pending' } });
      }
      if (pathname.endsWith('/submit')) {
        assert.equal(route.request().headers()['x-submission-token'], `fixture-${permissions.length}`);
        reports.push(route.request().postDataJSON());
        if (abortReport) return route.abort('connectionreset');
        if (failReport) return route.fulfill({ status: 503, json: { message: 'Fixture report outage' } });
        return route.fulfill({ json: { followUpPath: '/reports/card-brr-98z/fixture#private-fixture' } });
      }
      return route.fulfill({ status: 204, body: '' });
    });
    const submit = () => page.getByRole('button', { name: 'Submit report', exact: true });
    const serial = () => page.getByLabel('Serial Number', { exact: true });
    const consent = () => page.getByRole('checkbox', { name: /I have permission/ });
    const picker = () => page.getByLabel('Photos', { exact: true });
    const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}`);
    const ready = async () => { await page.getByText('Isolated verification fixture', { exact: true }).waitFor(); };
    const expectReportError = async () => page.getByText('Fixture report outage', { exact: true }).waitFor();

    await page.goto(`${base}/trackers/card-brr-98z/submit?serial=500`);
    await ready();
    assert.equal(await serial().inputValue(), '500');
    assert.equal(await serial().getAttribute('inputmode'), 'numeric');
    assert.equal(await page.locator('details').getAttribute('open'), null);
    assert.equal(await page.getByText('Evidence Quality Checklist', { exact: true }).count(), 0);
    assert.equal(await page.locator('#verification').count(), 0);
    assert.ok((await picker().boundingBox()).y < (await page.locator('summary').boundingBox()).y);
    await picker().setInputFiles(file('first.png'));
    await page.getByRole('img', { name: 'Evidence photo 1' }).evaluate((image) => image.decode());
    assert.equal(permissions.length + uploads.length + reports.length, 0, 'Local selection must not send anything.');
    await submit().click();
    assert.equal(permissions.length, 0, 'Consent remains required.');
    await picker().setInputFiles({ name: 'oversized.png', mimeType: 'image/png', buffer: Buffer.alloc(4 * 1024 * 1024 + 1) });
    await page.getByRole('alert').filter({ hasText: '4 MB' }).waitFor();
    assert.equal(await page.getByRole('img', { name: /Evidence photo/ }).count(), 1);
    await page.getByRole('button', { name: 'Remove evidence 1 from report' }).click();
    assert.equal(await page.getByRole('img', { name: /Evidence photo/ }).count(), 0);
    assert.equal(uploads.length, 0, 'Removing a local selection needs no storage operation.');
    await picker().setInputFiles([file('first.png'), file('second.png')]);
    await consent().check();
    await submit().click();
    await page.getByRole('alert').filter({ hasText: 'Some photos could not upload' }).waitFor();
    assert.equal(uploads.length, 2);
    assert.equal(reports.length, 0, 'Partial uploads must not silently submit an incomplete report.');
    assert.equal(await page.getByText('Not sent yet', { exact: true }).count(), 1);
    assert.equal(await page.getByText('Awaiting safety checks', { exact: true }).count(), 1);
    assert.equal(await page.locator('form [role="alert"]').evaluate((node) => node === document.activeElement), true);
    failSecondUpload = false;
    await submit().click(); await expectReportError();
    assert.equal(uploads.length, 3, 'Retry only uploads the failed file.');
    assert.equal(permissions.length, 1);
    assert.equal(reports[0].cardId, 500);
    assert.equal(reports[0].verificationStatus, 'unverified');
    assert.equal(reports[0].sourceType, 'other');
    assert.equal(reports[0].foundBy, '');
    assert.equal(reports[0].dateFound, '');
    assert.equal(reports[0].price, '');
    assert.equal(reports[0].evidenceAssetIds.length, 2);
    abortReport = true;
    const lostResponse = page.waitForEvent('requestfailed', { predicate: (request) => request.url().endsWith('/submit') });
    await submit().click();
    await lostResponse;
    await page.locator('form [role="alert"]').waitFor();
    abortReport = false;
    failReport = false;
    await submit().click();
    await page.getByRole('heading', { name: 'Report queued', exact: true }).waitFor();
    assert.deepEqual(reports[0], reports[1]);
    assert.deepEqual(reports[1], reports[2]);
    assert.equal(uploads.length, 3, 'Lost report responses must not cause new uploads.');
    assert.equal(await page.getByRole('link', { name: 'View private report status' }).getAttribute('href'), '/reports/card-brr-98z/fixture#private-fixture');
    await noOverflow();

    // Changed card identity invalidates permission and uploaded IDs, but preserves local files.
    await page.goto(`${base}/trackers/lotr-poster-cards/submit?card=the-one-ring&serial=007&kind=correction`);
    await ready();
    assert.equal(await page.getByRole('combobox', { name: 'Card', exact: true }).inputValue(), 'the-one-ring');
    assert.equal(await serial().inputValue(), '7');
    assert.equal(await page.getByLabel('Report type').inputValue(), 'correction');
    await picker().setInputFiles(file('correction.png'));
    await consent().check();
    failReport = true;
    await submit().click(); await expectReportError();
    const previousAssets = reports.at(-1).evidenceAssetIds;
    const permissionCount = permissions.length;
    await serial().fill('008');
    await page.getByText('Not sent yet', { exact: true }).waitFor();
    assert.equal(permissions.length, permissionCount);
    await submit().click(); await expectReportError();
    assert.equal(permissions.length, permissionCount + 1);
    assert.notDeepEqual(reports.at(-1).evidenceAssetIds, previousAssets);
    assert.equal(reports.at(-1).cardId, reports.at(-2).cardId + 1);
    const lastAssets = reports.at(-1).evidenceAssetIds;
    timeOffset = 3600001;
    await page.evaluate((offset) => { const now = Date.now; Date.now = () => now() + offset; }, timeOffset);
    await submit().click(); await expectReportError();
    assert.equal(permissions.length, permissionCount + 2);
    assert.notDeepEqual(reports.at(-1).evidenceAssetIds, lastAssets, 'Expired permissions require new uploads.');
    timeOffset = 0;

    // Source-only and note-only reports require no identity, date, price or grading fields.
    await page.goto(`${base}/trackers/card-brr-98z/submit?serial=001`); await ready();
    const uploadsBefore = uploads.length;
    await page.getByLabel('Source Link', { exact: false }).fill('https://x.com/collector/status/12345678');
    await consent().check();
    await submit().click(); await expectReportError();
    assert.equal(reports.at(-1).sourceType, 'social');
    assert.equal(reports.at(-1).verificationStatus, 'source-linked');
    assert.deepEqual(reports.at(-1).evidenceAssetIds, []);
    await page.getByLabel('Source Link', { exact: false }).fill('https://evil.example/photo');
    const reportCount = reports.length;
    await submit().click();
    await page.getByRole('alert').filter({ hasText: 'direct HTTPS' }).waitFor();
    assert.equal(reports.length, reportCount);
    await page.getByLabel('Source Link', { exact: false }).fill('');
    await page.getByLabel('Notes', { exact: true }).fill('A collector showed me this stamped copy at an event.');
    await serial().fill('501');
    await submit().click();
    await page.getByRole('alert').filter({ hasText: 'Enter a serial from 1 to 500.' }).waitFor();
    assert.equal(reports.length, reportCount);
    await serial().fill('001');
    await submit().click(); await expectReportError();
    assert.equal(reports.at(-1).sourceType, 'other');
    assert.equal(reports.at(-1).verificationStatus, 'unverified');
    assert.equal(uploads.length, uploadsBefore);
    await page.locator('summary').click();
    await page.getByLabel('Price observation', { exact: true }).fill('0');
    await page.getByRole('combobox', { name: 'Price type', exact: true }).selectOption('asking-price');
    await page.locator('summary').click();
    const beforeInvalid = reports.length;
    await submit().click();
    assert.equal(await page.locator('details').evaluate((element) => element.open), true);
    assert.equal(reports.length, beforeInvalid, 'Invalid optional details must be revealed, not silently lost.');
    await page.getByLabel('Price date', { exact: true }).fill('2026-09-06');
    await page.getByLabel('Grading service', { exact: true }).fill('PSA');
    await page.getByLabel('Grade', { exact: true }).fill('9');
    await page.getByLabel('Certificate number', { exact: true }).fill('12345678');
    await noOverflow();
    await page.screenshot({ path: `node_modules/.cache/submission-optional-${width}.png`, fullPage: true });
    await submit().click(); await expectReportError();
    assert.equal(reports.at(-1).currency, 'USD');
    assert.equal(reports.at(-1).price, '0');
    assert.equal(reports.at(-1).grading.grade, 9);

    await page.goto(`${base}/trackers/card-brr-98z/submit?serial=007`); await ready();
    await noOverflow();
    await page.screenshot({ path: `node_modules/.cache/submission-simple-${width}.png`, fullPage: true });
    await picker().setInputFiles(Array.from({ length: 8 }, (_, index) => file(`photo-${index}.png`)));
    assert.equal(await picker().isDisabled(), true);
    await page.getByRole('button', { name: 'Remove evidence 1 from report' }).click();
    assert.equal(await picker().isEnabled(), true);
    assert.deepEqual(runtimeErrors, []);
    console.log(`PASS: ${width}px simple form, local-only photos, consent, partial/lost-response retries, copy/expiry binding, minimal reports, validation and layout (mocked APIs).`);
    await context.close();
  }
} finally { await browser.close(); }
