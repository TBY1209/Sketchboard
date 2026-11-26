// Sketchboard smoke test. Run: bash tests/serve.sh &  then  node tests/smoke.mjs
// Uses the preinstalled Playwright; no package.json needed.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const SHOTS = process.env.SHOTS || '';
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failed++; };
const count = p => p.$$eval('#layer > [data-id]', n => n.length);

async function fresh(browser, opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page, errors };
}

async function desktop(browser) {
  console.log('desktop');
  const { ctx, page, errors } = await fresh(browser, { viewport: { width: 1440, height: 900 } });
  await page.goto(BASE);
  await page.waitForSelector('#layer > [data-id]');
  await page.waitForTimeout(400);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/desktop.png' });
  const n0 = await count(page);
  ok(n0 === 11, `sample board renders 11 elements (got ${n0})`);

  // draw a rectangle on empty canvas
  await page.keyboard.press('r');
  await page.mouse.move(300, 700); await page.mouse.down();
  await page.mouse.move(380, 760, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(100);
  ok(await count(page) === n0 + 1, 'rectangle tool adds an element');

  await page.mouse.click(1400, 500); // deselect
  await page.keyboard.press('Control+z');
  ok(await count(page) === n0, 'undo removes it');
  await page.keyboard.press('Control+Shift+z');
  ok(await count(page) === n0 + 1, 'redo brings it back');

  // select the new rect and delete
  await page.mouse.click(340, 730);
  await page.keyboard.press('Delete');
  ok(await count(page) === n0, 'delete removes the selected element');

  // persistence
  await page.keyboard.press('r');
  await page.mouse.move(300, 700); await page.mouse.down();
  await page.mouse.move(380, 760, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(700);
  await page.reload();
  await page.waitForSelector('#layer > [data-id]');
  ok(await count(page) === n0 + 1, 'board persists across reload');

  // keyboard shortcuts via the action registry
  await page.mouse.click(340, 730);
  await page.keyboard.press('Control+d');
  ok(await count(page) === n0 + 2, 'Ctrl+D duplicates');
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  ok(await page.$eval('#stage', s => s.classList.contains('nogrid')), 'G toggles the grid');
  await page.keyboard.press('g');
  await page.keyboard.press('Shift+?');
  ok(await page.isVisible('#modal .keys'), '? opens shortcuts help');
  await page.keyboard.press('Escape');
  await page.click('#menuBtn');
  await page.click('#menu [data-act="all"]');
  ok(await page.$eval('#sbar .cnt', n => n.textContent.startsWith(String(13))), 'menu Select all selects everything');

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}

async function phone(browser) {
  console.log('phone');
  const { ctx, page, errors } = await fresh(browser, { ...devices['iPhone 13'] });
  await page.goto(BASE);
  await page.waitForSelector('#layer > [data-id]');
  await page.waitForTimeout(400);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/phone.png' });
  ok(await page.isVisible('#tray'), 'tool tray visible');
  const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  ok(!over, 'no horizontal overflow');
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}

const browser = await chromium.launch();
try {
  await desktop(browser);
  await phone(browser);
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
