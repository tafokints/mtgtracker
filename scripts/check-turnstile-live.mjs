import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const interactive = process.env.TURNSTILE_INTERACTIVE === '1';
const browser = await chromium.launch({ channel: 'msedge', headless: !interactive });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 1000 } });
  await page.goto('https://mtgtrackers.com/trackers/one-ring/submit?serial=007');
  try {
    await page.locator('iframe[title*="security challenge"]').scrollIntoViewIfNeeded({ timeout: 30000 });
    await page.waitForFunction(() => {
      try { return Boolean(window.turnstile?.getResponse()); }
      catch { return false; }
    }, null, { timeout: interactive ? 180000 : 45000 });
  } catch {
    console.log('PENDING: No real challenge token obtained. A human/browser or widget-domain check is required; no bypass was attempted.');
    process.exitCode = 1;
  }
  if (!process.exitCode) {
    // Keep both the challenge and signed permission inside the browser. Never log them.
    const result = await page.evaluate(async () => {
      const token = window.turnstile.getResponse();
      const send = () => fetch('/api/trackers/one-ring/submission-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
        body: JSON.stringify({ cardId: 7, turnstileToken: token, consent: true }),
      });
      const first = await send();
      const data = await first.json();
      const permissionIssued = first.status === 200 && typeof data.token === 'string' && data.expiresAt > Date.now();
      if (!permissionIssued) return { first: first.status, permissionIssued, replay: null };
      const replay = await send();
      const replayData = await replay.json();
      return { first: first.status, permissionIssued, replay: replay.status, replayPermissionIssued: typeof replayData.token === 'string' };
    });
    console.log(JSON.stringify(result));
    assert.deepEqual(result, { first: 200, permissionIssued: true, replay: 403, replayPermissionIssued: false });
    await mkdir('node_modules/.cache', { recursive: true });
    await page.locator('iframe[title*="security challenge"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'node_modules/.cache/turnstile-live-390.png' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    console.log('PASS: Real Cloudflare challenge accepted once and replay rejected by the hosted handler. No upload/report/discovery was created.');
  }
} finally { await browser.close(); }
