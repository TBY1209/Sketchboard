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

async function boards(browser) {
  console.log('boards');
  const { ctx, page, errors } = await fresh(browser, { viewport: { width: 1280, height: 860 } });
  await page.goto(BASE);
  await page.waitForSelector('#layer > [data-id]');
  ok((await page.evaluate(() => location.hash)).startsWith('#/b/'), 'first run opens a board route');
  ok((await page.textContent('#titleBtn')) === 'Welcome to Sketchboard', 'welcome board title shown');

  await page.click('#homeBtn');
  await page.waitForSelector('#home .bcard');
  ok(await page.$$eval('#home .bcard', n => n.length) === 1, 'home lists one board');
  ok(await page.$$eval('#tpls .tcard', n => n.length) === 6, 'home shows 6 templates');
  if (SHOTS) await page.screenshot({ path: SHOTS + '/home.png' });

  await page.click('[data-tpl="kanban"]');
  await page.waitForFunction(() => document.body.dataset.route === 'board' && document.querySelectorAll('#layer > [data-id]').length > 3);
  ok((await page.textContent('#titleBtn')) === 'Kanban', 'kanban template opens with its name');
  if (SHOTS) await page.screenshot({ path: SHOTS + '/kanban.png' });

  // rename from the title button
  await page.click('#titleBtn');
  await page.fill('#askIn', 'Launch plan');
  await page.keyboard.press('Enter');
  ok((await page.textContent('#titleBtn')) === 'Launch plan', 'rename via title');

  await page.goBack();
  await page.waitForSelector('#home .bcard');
  await page.waitForFunction(() => document.querySelectorAll('#home .bcard').length === 2);
  ok(await page.$eval('#home .bcard .bmeta b', n => n.textContent) === 'Launch plan', 'renamed board is first (recent)');

  // search
  await page.fill('#hq', 'welcome');
  ok(await page.$$eval('#home .bcard', n => n.length) === 1, 'search filters boards');
  await page.fill('#hq', '');

  // delete + undo
  await page.click('#home .bcard [data-more]');
  await page.click('#bmenu [data-bm="del"]');
  await page.waitForFunction(() => document.querySelectorAll('#home .bcard').length === 1);
  ok(true, 'delete removes the board');
  await page.click('#toast button');
  await page.waitForFunction(() => document.querySelectorAll('#home .bcard').length === 2);
  ok(true, 'undo restores it');

  // blank board shows the empty hint
  await page.click('[data-tpl="blank"]');
  await page.waitForFunction(() => document.body.dataset.route === 'board');
  ok(await page.isVisible('#empty'), 'blank board shows the empty-state hint');
  await page.keyboard.press('s');
  await page.mouse.click(640, 430);
  await page.keyboard.press('Escape');
  ok(!(await page.isVisible('#empty')), 'hint hides once something is added');

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();

  // migration from the single-board localStorage version
  const m = await fresh(browser, { viewport: { width: 1280, height: 860 } });
  await m.page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(
      'sketchboard.v1',
      JSON.stringify({
        els: [
          { id: 'a1', t: 'rect', x: 0, y: 0, w: 100, h: 80, text: 'Old A' },
          { id: 'b2', t: 'ellipse', x: 200, y: 0, w: 100, h: 80, text: 'Old B' },
          { id: 'c3', t: 'line', a: { id: 'a1', x: 0, y: 0 }, b: { id: 'b2', x: 0, y: 0 } }
        ],
        cam: { x: 100, y: 100, z: 1 },
        t: Date.now()
      })
    );
  });
  await m.page.goto(BASE);
  await m.page.waitForSelector('#layer > [data-id]');
  ok((await m.page.textContent('#titleBtn')) === 'My first board', 'old single board migrates as “My first board”');
  ok(await count(m.page) === 3, 'migrated board keeps its 3 elements');
  await m.page.click('#homeBtn');
  await m.page.waitForSelector('#home .bcard');
  ok(await m.page.$$eval('#home .bcard', n => n.length) === 1, 'no extra welcome board for existing users');
  ok(m.errors.length === 0, 'no console errors' + (m.errors.length ? ': ' + m.errors.join(' | ') : ''));
  await m.ctx.close();
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
  await boards(browser);
  await phone(browser);
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
