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

async function offline(browser) {
  console.log('offline / install');
  const fs = require('fs'),
    path = require('path'),
    root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
  const swSrc = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const pre = JSON.parse(swSrc.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
  const want = [
    ...fs.readdirSync(path.join(root, 'js')).map(f => 'js/' + f),
    ...fs.readdirSync(path.join(root, 'css')).map(f => 'css/' + f),
    ...fs.readdirSync(path.join(root, 'fonts')).filter(f => f.endsWith('.woff2')).map(f => 'fonts/' + f)
  ];
  const missing = want.filter(f => !pre.includes(f)),
    stale = pre.filter(f => f !== './' && !fs.existsSync(path.join(root, f)));
  ok(!missing.length, 'sw.js precaches every app file' + (missing.length ? ': missing ' + missing.join(', ') : ''));
  ok(!stale.length, 'sw.js lists no deleted files' + (stale.length ? ': ' + stale.join(', ') : ''));
  const man = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  ok(man.icons.every(i => fs.existsSync(path.join(root, i.src))), 'manifest icons exist');

  const { ctx, page, errors } = await fresh(browser, { viewport: { width: 1280, height: 800 } });
  await page.goto(BASE);
  await page.waitForSelector('#layer > [data-id]');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  ok(true, 'service worker installed and controlling the page');
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('#layer > [data-id]');
  ok(await count(page) === 11, 'board loads with no network');
  await page.evaluate(() => document.fonts.load('20px Kalam'));
  ok(await page.evaluate(() => document.fonts.check('20px Kalam')), 'hand-drawn font available offline');
  await page.click('#homeBtn');
  await page.waitForSelector('#home .bcard');
  ok(true, 'home screen works offline');
  await ctx.setOffline(false);
  // the manifest's "New board" shortcut
  await page.goto(BASE + '#/new');
  await page.waitForFunction(() => document.body.dataset.route === 'board' && els.length === 0);
  ok((await page.textContent('#titleBtn')) === 'Untitled board', '#/new opens a fresh blank board');
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}

async function defaults(browser) {
  console.log('default shape styles');
  const { ctx, page, errors } = await fresh(browser, { viewport: { width: 1440, height: 900 } });
  await page.goto(BASE);
  await page.waitForSelector('#layer > [data-id]');
  await page.evaluate(() => newBoard('blank'));
  await page.waitForFunction(() => document.body.dataset.route === 'board' && els.length === 0);
  await page.evaluate(() => document.fonts.ready);

  // create every shape type with its tool and compare with the built-in table
  const types = await page.evaluate(() => Object.keys(TYPE_DEFAULTS));
  const made = {};
  for (const [i, t] of types.entries()) {
    await page.evaluate(t => setTool(t), t);
    await page.mouse.click(420 + (i % 5) * 190, 170 + Math.floor(i / 5) * 230); // clear of the style panel on the left
    made[t] = await page.evaluate(() => {
      const e = els[els.length - 1];
      return { t: e.t, fill: e.fill, fs: e.fs };
    });
    await page.keyboard.press('Escape'); // finishes text editing (empty text boxes are discarded)
  }
  const bad = await page.evaluate(m => Object.entries(m).filter(([t, e]) => e.t !== t || e.fill !== TYPE_DEFAULTS[t].fill || e.fs !== TYPE_DEFAULTS[t].fs).map(([t]) => t), made);
  ok(!bad.length, `all ${types.length} shape types get their built-in fill and font size` + (bad.length ? ': wrong ' + bad.join(', ') : ''));
  ok(made.rect.fill === '#d0ebff' && made.rect.fs === 20, 'rectangle: blue, 20px');
  ok(made.ellipse.fill === '#fff3a6' && made.diamond.fill === '#e5dbff' && made.diamond.fs === 18, 'ellipse yellow; diamond purple, 18px');
  ok(made.star.fs === 14 && made.text.fs === 24 && made.sticky.fs === 18, 'star 14px, text 24px, sticky 18px');

  // a short label fits every default-sized shape without the shape growing (the star's text area is only 32x30)
  const grow = await page.evaluate(() =>
    Object.keys(TYPE_DEFAULTS)
      .filter(t => t !== 'text')
      .filter(t => {
        const [w, h] = SIZE[t] || [160, 100];
        const e = mk(t, 0, 0, w, h, true);
        e.text = t === 'star' ? 'Idea' : 'Two words';
        fitText(e);
        return e.h !== h;
      })
  );
  ok(!grow.length, 'short labels fit every default shape' + (grow.length ? ': ' + grow.join(', ') : ''));

  // restyling one type is remembered for that type only
  await page.evaluate(() => { sel = new Set([els.find(e => e.t === 'rect').id]); apply('fill', '#ffc9c9'); stepFs(1); });
  const after = await page.evaluate(() => ({
    rect: defFor('rect'),
    ellipse: defFor('ellipse'),
    newRect: mk('rect', 0, 0, 10, 10)
  }));
  ok(after.rect.fill === '#ffc9c9' && after.rect.fs === 24, 'restyled rectangle: next rectangle follows (pink, 24px)');
  ok(after.newRect.fill === '#ffc9c9' && after.newRect.fs === 24, 'mk() uses the remembered style');
  ok(after.ellipse.fill === '#fff3a6' && after.ellipse.fs === 20, 'other shape types keep their built-in look');
  const pure = await page.evaluate(() => {
    const e = sample().find(e => e.t === 'round');
    return { fs: e.fs, ctrl: TEMPLATES.find(t => t.id === 'swot').build()[1].fs };
  });
  ok(pure.fs === 20 && pure.ctrl === 20, 'templates and the sample board ignore your recent restyling');

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}

async function mindmaps(browser) {
  console.log('mind maps');
  const { ctx, page, errors } = await fresh(browser, { viewport: { width: 1440, height: 900 } });
  await page.goto(BASE);
  await page.waitForSelector('#layer > [data-id]');
  const dom = () => page.$$eval('#layer > [data-id]', n => n.length);
  const idOf = text => page.evaluate(t => els.find(e => e.text === t).id, text);
  const centre = async id =>
    page.$eval(`#layer > [data-id="${id}"]`, n => {
      const r = n.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });

  await page.evaluate(() => newBoard('mind'));
  await page.waitForFunction(() => document.body.dataset.route === 'board' && els.some(e => e.mm));
  const total = await page.evaluate(() => els.length);
  ok(total === 17 && (await dom()) === 17, 'mind map template: root, 6 branches, 2 sub-branches (17 items)');
  ok(await page.evaluate(() => MIND.size === 9 && HIDDEN.size === 0), 'tree has 9 nodes, nothing hidden');
  const kidsBefore = await page.evaluate(() => {
    const p = els.find(e => e.text === 'Why it matters');
    return MIND.get(p.id).kids.map(k => ({ id: k, x: byId(k).x, y: byId(k).y }));
  });

  // collapse with the on-canvas button (visible once the node is selected)
  const l1 = await idOf('Why it matters');
  let c = await centre(l1);
  await page.mouse.click(c.x, c.y);
  ok(await page.isVisible('#ui [data-cl]'), 'selecting a node with children shows its − button');
  await page.click('#ui [data-cl]');
  ok((await dom()) === total - 4, 'collapsing hides the 2 sub-branches and their 2 connectors');
  ok((await page.textContent('#ui [data-cl] text')) === '+2', 'collapsed node shows a +2 badge');
  ok(await page.evaluate(id => byId(id).cl === true, l1), 'collapsed state is stored on the node');
  if (SHOTS) {
    await page.mouse.click(40, 500);
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOTS + '/mind-collapsed.png' });
  }

  // survives a reload
  await page.waitForTimeout(700);
  await page.reload();
  await page.waitForSelector('#layer > [data-id]');
  ok((await dom()) === total - 4 && (await page.textContent('#ui [data-cl] text')) === '+2', 'collapsed branches stay collapsed after reload');

  // expand with the badge
  await page.click('#ui [data-cl]');
  ok((await dom()) === total, 'clicking the badge expands the branch');

  // undo / redo
  await page.keyboard.press('Escape');
  await page.evaluate(id => toggleCollapse(id), l1);
  ok((await dom()) === total - 4, 'collapse via command');
  await page.keyboard.press('Control+z');
  ok((await dom()) === total, 'undo expands it again');
  await page.keyboard.press('Control+Shift+z');
  ok((await dom()) === total - 4, 'redo collapses it');

  // dragging a collapsed node carries its hidden branch
  await page.evaluate(id => { sel.clear(); render(); }, l1);
  c = await centre(l1);
  await page.waitForTimeout(500);
  await page.mouse.move(c.x, c.y); await page.mouse.down();
  await page.mouse.move(c.x + 90, c.y + 40, { steps: 8 }); await page.mouse.up();
  const dz = await page.evaluate(() => cam.z);
  await page.evaluate(id => toggleCollapse(id), l1);
  const moved = await page.evaluate(k => k.map(o => ({ dx: byId(o.id).x - o.x, dy: byId(o.id).y - o.y })), kidsBefore);
  ok(moved.every(m => Math.abs(m.dx - 90 / dz) < 4 && Math.abs(m.dy - 40 / dz) < 4), 'hidden sub-branches moved with their collapsed parent');

  // keyboard: Ctrl+/ toggles the selected branch
  await page.evaluate(id => { sel = new Set([id]); render(); }, l1);
  await page.keyboard.press('Control+/');
  ok((await dom()) === total - 4, 'Ctrl+/ collapses the selected branch');
  await page.keyboard.press('Control+/');
  ok((await dom()) === total, 'Ctrl+/ expands it again');

  // deleting a collapsed node removes its whole hidden branch; undo brings it all back
  await page.evaluate(id => toggleCollapse(id), l1);
  await page.evaluate(id => { sel = new Set([id]); render(); }, l1);
  const n0 = await page.evaluate(() => els.length);
  await page.keyboard.press('Delete');
  const n1 = await page.evaluate(() => els.length);
  ok(n0 - n1 === 5 && (await page.evaluate(() => !els.some(e => e.text === 'Saves time'))), 'deleting a collapsed node removes its 3 nodes and their 2 connectors');
  await page.keyboard.press('Control+z');
  ok((await page.evaluate(() => els.length)) === n0 && (await dom()) === total - 4, 'undo restores the branch, still collapsed');

  // copy: a collapsed branch pastes as its own, still collapsed, mind map
  await page.evaluate(id => { sel = new Set([id]); render(); copySel(false); pasteEls(JSON.parse(clip).els); }, l1);
  const pasted = await page.evaluate(() => { const n = els.filter(e => e.text === 'Why it matters'); return { n: n.length, mm: !!n[1].mm, cl: !!n[1].cl, kids: els.filter(e => e.text === 'Saves time').length }; });
  ok(pasted.n === 2 && pasted.mm && pasted.cl && pasted.kids === 2, 'copied collapsed branch keeps its hidden sub-branches');
  ok((await dom()) === total - 4 + 1, 'only the pasted node shows (its sub-branches stay folded)');
  await page.keyboard.press('Control+z');

  // select all and box-select ignore hidden items
  await page.evaluate(() => runAction('all'));
  ok((await page.evaluate(() => sel.size)) === (await dom()), 'Select all skips hidden items');

  // export: pictures show what you see, board files and share links keep everything
  const ex = await page.evaluate(() => ({ seen: exportList('board').length, all: exportList('board', true).length, file: JSON.parse(JSON.stringify(els)) }));
  ok(ex.all === total && ex.seen === total - 4, 'PNG/SVG/PDF export what is visible; files and share links keep every branch');
  const file = JSON.parse(await page.evaluate(() => boardFile('t', exportList('board', true))));
  const back = await page.evaluate(list => loadEls(list).map(e => [!!e.mm, !!e.cl]), file.els);
  ok(back.filter(b => b[0]).length === 1 && back.filter(b => b[1]).length === 1, 'board file round-trips root and collapsed flags');

  // share link opens read-only, collapsed; the viewer can expand it
  const { url } = await page.evaluate(() => makeShareLink(exportList('board', true)));
  const v = await ctx.newPage();
  v.on('pageerror', e => errors.push(e.message));
  await v.goto(url);
  await v.waitForFunction(() => document.body.dataset.route === 'share');
  ok((await v.$$eval('#layer > [data-id]', n => n.length)) === total - 4, 'shared view opens with the branch collapsed');
  await v.click('#ui [data-cl]');
  ok((await v.$$eval('#layer > [data-id]', n => n.length)) === total, 'viewer can expand the shared branch');
  await v.close();

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}

async function mindScope(browser) {
  console.log('mind map scope and depth styling');
  const { ctx, page, errors } = await fresh(browser, { viewport: { width: 1440, height: 900 } });
  await page.goto(BASE);
  await page.waitForSelector('#layer > [data-id]');
  // a flowchart has no root, so nothing is collapsible
  await page.evaluate(() => newBoard('flow'));
  await page.waitForFunction(() => document.body.dataset.route === 'board' && board && board.name === 'Flowchart');
  const a = await page.evaluate(() => els.find(e => e.text === 'New idea').id);
  const b = await page.evaluate(() => els.find(e => e.text === 'Sketch it out').id);
  await page.evaluate(a => { sel = new Set([a]); render(); }, a);
  ok(!(await page.$('#ui [data-cl]')), 'flowchart: no collapse button without a mind-map root');
  ok(!(await page.evaluate(() => ACT.collapse.when())), 'flowchart: collapse command unavailable');
  // mark the first step as a root: it and what hangs off it become collapsible
  await page.evaluate(() => runAction('mindRoot'));
  ok(await page.evaluate(id => byId(id).mm === true, a), 'Mind map root toggle marks the node');
  ok(await page.isVisible('#ui [data-cl]'), 'a root with connected children shows its − button');
  ok(await page.isVisible('#sbar [data-sb="mm"].on'), 'selection bar shows the root toggle as on');
  await page.evaluate(() => runAction('mindRoot'));
  ok(!(await page.evaluate(() => MIND.size)), 'toggling again removes the mind map');

  // depth styling with the blue + dots
  await page.evaluate(() => newBoard('blank'));
  await page.waitForFunction(() => document.body.dataset.route === 'board' && els.length === 0);
  await page.evaluate(() => setTool('ellipse'));
  await page.mouse.click(700, 330);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { sel = new Set([els[0].id]); render(); runAction('mindRoot'); });
  const addChild = async dot => {
    await page.click(`#ui [data-h="c-${dot}"]`);
    await page.keyboard.press('Escape'); // finish the new node's text editing
  };
  const rootId = await page.evaluate(() => els[0].id);
  await page.evaluate(id => { sel = new Set([id]); render(); }, rootId);
  await addChild('s');
  const c1 = await page.evaluate(() => { const e = els.filter(x => x.t !== 'line')[1]; return { id: e.id, t: e.t, fs: e.fs, fill: e.fill, mm: !!e.mm, cl: !!e.cl, w: e.w }; });
  ok(c1.fs === 20 && c1.t === 'round' && !c1.mm && !c1.cl, 'level-1 child: rounded, 20px, not a root');
  await page.evaluate(id => { sel = new Set([id]); render(); }, rootId);
  await addChild('w');
  const c1b = await page.evaluate(() => els.filter(x => x.t !== 'line')[2].fill);
  ok(c1b !== c1.fill, 'a second level-1 branch gets a different colour');
  await page.evaluate(id => { sel = new Set([id]); render(); }, c1.id);
  await addChild('s');
  const c2 = await page.evaluate(() => { const e = els.filter(x => x.t !== 'line')[3]; return { fs: e.fs, fill: e.fill, mm: !!e.mm, w: e.w }; });
  ok(c2.fs === 16 && c2.fill === c1.fill && !c2.mm && c2.w < c1.w, 'level-2 child: 16px, branch colour, smaller, not a root');
  await page.evaluate(() => { sel = new Set([els.filter(x => x.t !== 'line')[3].id]); render(); });
  await addChild('s');
  const c3 = await page.evaluate(() => els.filter(x => x.t !== 'line')[4].fs);
  ok(c3 === 14, 'level-3 child: 14px');
  // outside a mind map nothing changes: a "+" child still copies its parent
  await page.evaluate(() => newBoard('blank'));
  await page.waitForFunction(() => document.body.dataset.route === 'board' && els.length === 0);
  await page.evaluate(() => setTool('diamond'));
  await page.mouse.click(700, 330);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { sel = new Set([els[0].id]); render(); });
  await addChild('s');
  const plain = await page.evaluate(() => { const [p, ch] = els.filter(x => x.t !== 'line'); return p.t === ch.t && p.fs === ch.fs && p.w === ch.w; });
  ok(plain, 'outside a mind map a + child still copies its parent');

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
  await offline(browser);
  await defaults(browser);
  await mindmaps(browser);
  await mindScope(browser);
  await phone(browser);
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
