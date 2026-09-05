import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const base = 'http://127.0.0.1:3103';
await mkdir('node_modules/.cache', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = []; let loginBody;
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route(`${base}/api/**`, (route) => {
      if (new URL(route.request().url()).pathname === '/api/admin/login') {
        if (route.request().method() === 'POST') { loginBody = route.request().postDataJSON(); return route.fulfill({ status: 401, json: { message: 'Invalid password or authenticator code' } }); }
        return route.fulfill({ json: { authenticated: false, mfaRequired: true } });
      }
      return route.fulfill({ status: 503, json: { message: 'Isolated browser fixture' } });
    });
    await page.goto(`${base}/trackers/one-ring`); await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+Alt+a');
    await page.locator('input[type="password"]').fill('fixture-only-password');
    await page.getByLabel('Authenticator code').fill('123456');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByText('Invalid password or authenticator code', { exact: true }).waitFor();
    assert.deepEqual(loginBody, { password: 'fixture-only-password', code: '123456' });
    assert.equal(await page.getByRole('button', { name: 'Login', exact: true }).isEnabled(), true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `node_modules/.cache/owner-login-${width}.png` });
    console.log(`PASS: ${width}px owner MFA login form, rejected login, no overflow/runtime errors (intercepted API)`);
    await page.close();
  }
} finally { await browser.close(); }
