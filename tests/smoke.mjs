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

async function power(browser) {
  console.log('power');
  const { ctx, page, errors } = await fresh(browser, { viewport: { width: 1440, height: 900 } });
  await page.goto(BASE);
  await page.waitForSelector('#layer > [data-id]');
  await page.evaluate(() => newBoard('blank'));
  await page.waitForFunction(() => document.body.dataset.route === 'board' && els.length === 0);
  const center = async id =>
    page.$eval(`#layer > [data-id="${id}"]`, n => {
      const r = n.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
  // two rectangles
  for (const [x, y] of [[500, 400], [800, 400]]) {
    await page.keyboard.press('Escape');
    await page.keyboard.press('r');
    await page.mouse.click(x, y);
  }
  await page.keyboard.press('Escape');
  const [a, b] = await page.evaluate(() => els.map(e => e.id));

  // group
  await page.evaluate(([a, b]) => { sel = new Set([a, b]); render(); }, [a, b]);
  await page.keyboard.press('Control+g');
  ok(await page.evaluate(() => els[0].grp && els[0].grp === els[1].grp), 'Ctrl+G groups');
  await page.keyboard.press('Escape');
  let p = await center(a);
  await page.mouse.click(p.x, p.y);
  ok(await page.evaluate(() => sel.size === 2), 'clicking one member selects the whole group');
  await page.keyboard.press('Control+Shift+g');
  ok(await page.evaluate(() => !els[0].grp && !els[1].grp), 'Ctrl+Shift+G ungroups');

  // lock
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500); // avoid a double-click
  await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Control+Shift+l');
  ok(await page.evaluate(id => byId(id).lk === true && sel.size === 0, a), 'Ctrl+Shift+L locks and deselects');
  const x0 = await page.evaluate(id => byId(id).x, a);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.mouse.move(p.x + 120, p.y + 60, { steps: 6 }); await page.mouse.up();
  ok(await page.evaluate(([id, x0]) => byId(id).x === x0, [a, x0]), 'locked element ignores drag');
  await page.mouse.click(p.x, p.y, { button: 'right' });
  ok(await page.isVisible('#ctx [data-ctx="unlockOne"]'), 'right-click on locked shows Unlock');
  await page.click('#ctx [data-ctx="unlockOne"]');
  ok(await page.evaluate(id => !byId(id).lk, a), 'Unlock works');

  // context menu on canvas
  await page.mouse.click(700, 700, { button: 'right' });
  ok(await page.isVisible('#ctx [data-ctx="addFrameHere"]'), 'right-click on canvas opens the canvas menu');
  await page.keyboard.press('Escape');
  ok(!(await page.isVisible('#ctx')), 'Esc closes the context menu');

  // frames carry their contents
  await page.keyboard.press('Escape');
  await page.keyboard.press('f');
  await page.mouse.move(380, 300); await page.mouse.down();
  await page.mouse.move(950, 560, { steps: 6 }); await page.mouse.up();
  const fid = await page.evaluate(() => els.find(e => e.t === 'frame').id);
  ok(await page.evaluate(() => els[0].t === 'frame'), 'frame tool creates a frame underneath everything');
  const bx0 = await page.evaluate(id => byId(id).x, b);
  const title = await page.$eval(`#layer > [data-id="${fid}"] text`, n => { const r = n.getBoundingClientRect(); return { x: r.x + 10, y: r.y + r.height / 2 }; });
  await page.mouse.click(1300, 820);
  await page.mouse.move(title.x, title.y); await page.mouse.down();
  await page.mouse.move(title.x + 60, title.y + 40, { steps: 6 }); await page.mouse.up();
  ok(await page.evaluate(([id, x]) => Math.abs(byId(id).x - x - 60 / cam.z) < 2, [b, bx0]), 'dragging a frame moves what is inside it');

  // image paste
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 120; c.height = 80;
    const x = c.getContext('2d'); x.fillStyle = '#e03131'; x.fillRect(0, 0, 120, 80);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'red.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  });
  await page.waitForFunction(() => els.some(e => e.t === 'img'), null, { timeout: 4000 });
  await page.waitForSelector('#layer image');
  ok(true, 'pasting an image adds it to the board');

  // command palette
  await page.keyboard.press('Control+k');
  ok(await page.isVisible('#pal'), 'Ctrl+K opens the palette');
  await page.keyboard.type('zoom to fit');
  const top = await page.textContent('#palList .on .pl');
  ok(top.startsWith('Zoom to fit'), 'palette fuzzy-matches (top: ' + top + ')');
  await page.keyboard.press('Enter');
  ok(!(await page.isVisible('#pal')), 'Enter runs and closes');

  // minimap + zoom to selection
  await page.keyboard.press('n');
  ok(await page.isVisible('#mini'), 'N toggles the minimap');
  ok(await page.$$eval('#minisvg rect', n => n.length) >= 4, 'minimap draws the board');
  await page.evaluate(id => { sel = new Set([id]); render(); }, a);
  const z0 = await page.evaluate(() => cam.z);
  await page.keyboard.press('Shift+@');
  await page.waitForTimeout(400);
  ok(await page.evaluate(z0 => Math.abs(cam.z - z0) > 0.01, z0), 'Shift+2 zooms to the selection');
  if (SHOTS) await page.screenshot({ path: SHOTS + '/power.png' });

  // board file round trip keeps the image
  const file = await page.evaluate(() => boardFile('t', els));
  const nf = Object.keys(JSON.parse(file).files || {}).length;
  ok(nf === 1, 'board file embeds images (' + nf + ')');

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}

async function shareExport(browser) {
  console.log('share & export');
  const { ctx, page, errors } = await fresh(browser, { viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await page.goto(BASE);
  await page.waitForSelector('#layer > [data-id]');
  await page.evaluate(() => newBoard('kanban'));
  await page.waitForFunction(() => document.body.dataset.route === 'board' && els.some(e => e.t === 'frame'));
  const n = await page.evaluate(() => els.length);

  // export dialog → SVG with embedded fonts
  await page.keyboard.press('Control+Shift+E');
  ok(await page.isVisible('#xPrev svg'), 'Ctrl+Shift+E opens the export dialog with a preview');
  if (SHOTS) await page.screenshot({ path: SHOTS + '/export.png' });
  await page.click('[data-xk="fmt"] [data-v="svg"]');
  let [dl] = await Promise.all([page.waitForEvent('download'), page.click('#xGo')]);
  ok(dl.suggestedFilename() === 'Kanban.svg', 'SVG download named after the board');
  const svgText = require('fs').readFileSync(await dl.path(), 'utf8');
  ok(svgText.startsWith('<svg') && svgText.includes('@font-face') && svgText.includes("font-family:'Kalam'"), 'SVG embeds the fonts it uses');

  // frame-scoped PNG
  await page.keyboard.press('Control+Shift+E');
  await page.click('[data-xk="fmt"] [data-v="png"]');
  await page.click('[data-xk="scope"] [data-v="frame"]');
  ok(await page.isVisible('#xFrame'), 'frame scope shows a frame picker');
  [dl] = await Promise.all([page.waitForEvent('download'), page.click('#xGo')]);
  ok(dl.suggestedFilename().endsWith('.png'), 'PNG download');

  // copy as image
  await page.evaluate(() => copyPNG());
  await page.waitForTimeout(500);
  const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap(i => i.types));
  ok(types.includes('image/png'), 'Copy as image puts a PNG on the clipboard');

  // PDF: one page per frame (+ one for things outside frames)
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed = document.querySelectorAll('#print .ppage').length; }; });
  await page.evaluate(() => runAction('print'));
  await page.click('#xGo');
  await page.waitForFunction(() => window.__printed > 0);
  ok(await page.evaluate(() => window.__printed) === 4, 'PDF has a page per frame plus the loose heading');

  // share link round trip
  await page.evaluate(() => { sel.clear(); render(); return openShare(); });
  const url = await page.inputValue('#shareUrl');
  ok(url.includes('#/s/z'), 'share link is compressed into the URL');
  const v = await ctx.newPage();
  v.on('pageerror', e => errors.push(e.message));
  await v.goto(url);
  await v.waitForFunction(() => document.body.dataset.route === 'share');
  ok(await v.evaluate(() => els.length) === n, 'shared view shows every element');
  ok(await v.isVisible('#shareBar') && !(await v.isVisible('#tray')), 'shared view is read-only (no tools)');
  if (SHOTS) await v.screenshot({ path: SHOTS + '/shared.png' });
  await v.click('#saveCopy');
  await v.waitForFunction(() => document.body.dataset.route === 'board');
  ok(await v.evaluate(n => els.length === n && board.name === 'Kanban', n), 'Save a copy creates an editable board');
  ok(await v.evaluate(() => Store.listBoards().then(l => l.length)) === 3, 'copy listed with the other boards');

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
  await boards(browser);
  await power(browser);
  await shareExport(browser);
  await phone(browser);
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
