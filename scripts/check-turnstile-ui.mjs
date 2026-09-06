import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const port = Number(process.env.TURNSTILE_UI_PORT || 3105);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
const sitekey = process.env.TURNSTILE_UI_SITE_KEY;
assert.ok(sitekey, 'Set TURNSTILE_UI_SITE_KEY to the public key used for the local build.');
const base = `http://127.0.0.1:${port}`;
await mkdir('node_modules/.cache', { recursive: true });

// Only this isolated browser receives a fake SDK/API. No cloud data or real tokens are used.
const widgetFixture = `
  window.challengeFixture = { renders: 0, resets: [], removed: [] };
  window.turnstile = {
    render(element, options) {
      window.challengeFixture.renders++;
      window.challengeFixture.options = options;
      element.textContent = 'Verification widget fixture';
      element.dataset.testid = 'challenge-fixture';
      return 'fixture-widget-id';
    },
    reset(id) { window.challengeFixture.resets.push(id); },
    remove(id) { window.challengeFixture.removed.push(id); }
  };
`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    const permissions = [];
    let reports = 0;
    let responseMode = 'abort';
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', (route) => route.fulfill({ contentType: 'application/javascript', body: widgetFixture }));
    await page.route(`${base}/api/**`, async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/submission-session')) {
        permissions.push(route.request().postDataJSON());
        if (responseMode === 'abort') return route.abort('connectionreset');
        if (responseMode === '503') return route.fulfill({ status: 503, json: { message: 'Verification is temporarily unavailable.' } });
        if (responseMode === 'json') return route.fulfill({ status: 200, body: 'malformed JSON' });
        return route.fulfill({ json: { token: 'fixture-report-permission', expiresAt: Date.now() + 3600000 } });
      }
      if (pathname.endsWith('/submit')) {
        assert.equal(route.request().headers()['x-submission-token'], 'fixture-report-permission');
        reports++;
        return route.fulfill({ status: 400, json: { message: 'Fixture: report retained for retry.' } });
      }
      return route.fulfill({ status: 204, body: '' });
    });
    await page.goto(`${base}/trackers/one-ring/submit?serial=007`);
    await page.getByTestId('challenge-fixture').waitFor();
    assert.deepEqual(await page.evaluate(() => {
      const { sitekey, action, size, 'response-field': field } = window.challengeFixture.options;
      return { sitekey, action, size, field };
    }), { sitekey, action: 'discovery', size: width === 320 ? 'compact' : 'flexible', field: false });
    await page.getByRole('checkbox', { name: /I have permission/ }).check();
    await page.getByLabel('Notes', { exact: true }).fill('Isolated browser fixture; no real report will be sent.');
    const submit = page.getByRole('button', { name: 'Submit', exact: true });
    const freshToken = (token) => page.evaluate((value) => window.challengeFixture.options.callback(value), token);
    const retryWithoutToken = async (expectedRequests) => {
      await submit.click();
      await page.getByText('Complete the verification check first.', { exact: true }).waitFor();
      assert.equal(permissions.length, expectedRequests);
    };
    for (const mode of ['abort', '503', 'json', 'ok']) {
      responseMode = mode;
      const count = permissions.length + 1;
      await freshToken(`fixture-${mode}`);
      await submit.click();
      await page.waitForFunction((n) => window.challengeFixture.resets.length === n, count);
      if (mode !== 'ok') {
        await retryWithoutToken(count);
        assert.equal(reports, 0);
      }
    }
    assert.equal(reports, 1);
    const retryResponse = page.waitForResponse((response) => response.url().endsWith('/submit'));
    await submit.click();
    await retryResponse;
    assert.equal(reports, 2);
    assert.equal(permissions.length, 4, 'A valid card-bound permission is reused after business-validation errors.');
    assert.deepEqual(permissions.map(({ cardId, turnstileToken, consent }) => ({ cardId, turnstileToken, consent })),
      ['abort', '503', 'json', 'ok'].map((mode) => ({ cardId: 7, turnstileToken: `fixture-${mode}`, consent: true })));

    // A changed serial cannot reuse the previous report permission.
    await page.locator('#serial').selectOption('8');
    for (const callback of ['expired-callback', 'timeout-callback', 'error-callback']) {
      await freshToken(`fixture-${callback}`);
      await page.evaluate((name) => window.challengeFixture.options[name](), callback);
      await retryWithoutToken(4);
    }
    await page.getByRole('alert').filter({ hasText: 'Verification could not load.' }).waitFor();
    await freshToken('fixture-recovered');
    await page.getByRole('alert').filter({ hasText: 'Verification could not load.' }).waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => ({ renders: window.challengeFixture.renders, resets: window.challengeFixture.resets, removed: window.challengeFixture.removed })),
      { renders: 1, resets: Array(4).fill('fixture-widget-id'), removed: [] });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}px`);
    await page.getByTestId('challenge-fixture').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `node_modules/.cache/turnstile-${width}.png` });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS: ${width}px widget lifecycle, token resets/retries, expiry/error recovery, card binding and no overflow (mocked SDK/APIs).`);
  }
} finally { await browser.close(); }
