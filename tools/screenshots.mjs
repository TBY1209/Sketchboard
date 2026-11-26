// Regenerates the README screenshots in docs/. Run with the dev server up: bash tests/serve.sh & node tools/screenshots.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const out = new URL('../docs/', import.meta.url).pathname;
const shot = (p, name) => p.screenshot({ path: out + name + '.jpg', type: 'jpeg', quality: 84 });
const settle = p => p.waitForTimeout(900);

const browser = await chromium.launch();
async function seed(p) {
  await p.goto(BASE);
  await p.waitForSelector('#layer > [data-id]');
  for (const t of ['retro', 'mind', 'swot', 'kanban']) {
    await p.evaluate(t => newBoard(t), t);
    await p.waitForFunction(() => document.body.dataset.route === 'board' && els.length > 0);
  }
}
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
  const p = await ctx.newPage();
  await seed(p);
  await settle(p);
  await shot(p, `board-${scheme}`);
  if (scheme === 'light') {
    // a mind map with one branch folded away
    const id = await p.evaluate(async () => (await Store.listBoards()).find(b => b.name === 'Mind map').id);
    await p.evaluate(id => go('#/b/' + id), id);
    await p.waitForFunction(
      () => document.body.dataset.route === 'board' && board && board.name === 'Mind map'
    );
    await p.evaluate(() => {
      sel.clear();
      toggleCollapse(els.find(e => e.text === 'Why it matters').id);
    });
    await settle(p);
    await shot(p, 'mindmap');
    await p.evaluate(() => go('#/b/' + (board && board.id)));
    await p.keyboard.press('Control+k');
    await p.keyboard.type('frame');
    await settle(p);
    await shot(p, 'palette');
    await p.keyboard.press('Escape');
    await p.keyboard.press('Control+Shift+E');
    await settle(p);
    await shot(p, 'export');
    await p.keyboard.press('Escape');
  }
  await p.click('#homeBtn');
  await p.waitForSelector('#home .bcard');
  await settle(p);
  await shot(p, `home-${scheme}`);
  await ctx.close();
}
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage();
await seed(p);
await p.evaluate(() => go('#/'));
await p.waitForSelector('#home .bcard');
await settle(p);
await shot(p, 'phone-home');
await p.evaluate(() => go(document.querySelector('#home .bcard a').getAttribute('href')));
await p.waitForFunction(() => document.body.dataset.route === 'board');
await settle(p);
await shot(p, 'phone-board');
await browser.close();
console.log('screenshots written to', out);
