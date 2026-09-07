import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { loadProjectModule } from './lib/load-project-module.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.COLLECTOR_UI_BASE_URL || 'http://127.0.0.1:3106';
assert.equal(new URL(base).hostname, '127.0.0.1', 'Quantity fixtures must stay local');
const { getTracker } = loadProjectModule(path.resolve('src/lib/trackers.ts'));
const { createInitialTrackerCards } = loadProjectModule(path.resolve('src/lib/tracker-data.ts'));
const { serializedPrintings, printingPath } = loadProjectModule(path.resolve('src/lib/serialized-printings.ts'));
await mkdir('node_modules/.cache', { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const ring = createInitialTrackerCards(getTracker('one-ring'));
    const posters = createInitialTrackerCards(getTracker('lotr-poster-cards')).map((card, index) => ({
      ...card, found: index < 200, verificationStatus: index < 200 ? 'confirmed' : 'unverified',
    }));
    await page.route(`${base}/api/**`, (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/cards')) return route.fulfill({ json: pathname.includes('lotr-poster-cards') ? posters : ring });
      if (pathname === '/api/admin/login') return route.fulfill({ json: { authenticated: false, mfaRequired: true } });
      return route.fulfill({ status: 204, body: '' });
    });
    const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}: ${page.url()}`);

    await page.goto(`${base}/trackers/one-ring`);
    await page.getByRole('heading', { name: 'Serials', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'The One Ring: Poster Edition /100', exact: true }).waitFor();
    await page.getByText('Borderless poster edition /100', { exact: true }).waitFor();
    const uniqueLink = page.getByRole('link', { name: /Unique 001\/001 One Ring \(different printing\)/ });
    assert.equal(await uniqueLink.getAttribute('href'), 'https://scryfall.com/card/ltr/0/the-one-ring');
    await noOverflow();
    await page.screenshot({ path: `node_modules/.cache/quantity-ring-${width}.png` });

    await page.goto(`${base}/trackers/one-ring/submit`);
    await page.getByText('The One Ring: Poster Edition /100', { exact: true }).waitFor();
    await page.getByText('Borderless poster edition /100', { exact: true }).waitFor();
    await noOverflow();
    await page.goto(`${base}/trackers`);
    await page.getByRole('heading', { name: 'The One Ring: Poster Edition /100', exact: true }).waitFor();
    await noOverflow();

    await page.goto(`${base}/verification-guide`);
    const guide = await page.locator('main').innerText();
    assert.match(guide, /supported source link or upload a clear photo/);
    assert.match(guide, /A new serial cannot become located until supporting evidence is available/);
    assert.doesNotMatch(guide, /upload or link a clear image|public image URLs/);
    await page.getByRole('heading', { name: 'Fastest Approval Path', exact: true }).scrollIntoViewIfNeeded();
    await noOverflow();
    await page.screenshot({ path: `node_modules/.cache/review-guide-${width}.png` });

    await page.goto(`${base}/trackers/lotr-poster-cards/stats`);
    const locatedStatistic = page.getByRole('heading', { name: 'Located', exact: true }).locator('..');
    await locatedStatistic.getByText('200/2000', { exact: true }).waitFor();
    await locatedStatistic.getByText('10.0% complete', { exact: true }).waitFor();
    await noOverflow();
    await locatedStatistic.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `node_modules/.cache/quantity-stats-${width}.png` });

    for (const [set, number, total] of [['LTR', '0', 1], ['LTR', '748z', 100], ['FIN', '551f', 77], ['WHO', '564z', 513], ['LTC', '410z', 900]]) {
      const printing = serializedPrintings.find((card) => card.setCode === set && card.collectorNumber === number);
      assert.ok(printing);
      await page.goto(`${base}${printingPath(printing)}`);
      assert.equal(await page.getByText('Numbered copies', { exact: true }).locator('..').locator('dd').innerText(), String(total));
      if (set === 'LTR' && number === '0') {
        assert.match(await page.locator('header').innerText(), /Black Speech/);
        await page.getByRole('heading', { name: 'The One Ring: Unique 001/001', exact: true }).waitFor();
        assert.equal(await page.getByRole('navigation', { name: 'Other printings of this card' }).getByRole('link', { name: 'The One Ring: Poster Edition /100', exact: true }).getAttribute('href'), '/serialized-mtg-catalog/lotr-poster-cards/the-one-ring-748z');
        assert.equal(await page.getByRole('link', { name: 'Report a Find', exact: true }).count(), 0);
      }
      if (set === 'LTR' && number === '748z') {
        await page.getByRole('heading', { name: 'The One Ring: Poster Edition /100', exact: true }).waitFor();
        assert.equal(await page.getByRole('navigation', { name: 'Other printings of this card' }).getByRole('link', { name: 'The One Ring: Unique 001/001', exact: true }).getAttribute('href'), '/serialized-mtg-catalog/lotr-one-ring-001/the-one-ring-0');
      }
      const artwork = page.getByRole('img', { name: /serialized reference printing/ });
      await artwork.evaluate((image) => image.decode());
      assert.ok(await artwork.evaluate((image) => image.naturalWidth > 0));
      await noOverflow();
      if (set === 'LTR' && number === '0') await page.screenshot({ path: `node_modules/.cache/quantity-unique-${width}.png` });
    }
    assert.deepEqual(errors, []);
    console.log(`Quantity labels, reference artwork, 200/2000 statistics and layout passed at ${width}px`);
    await context.close();
  }
} finally {
  await browser.close();
}
