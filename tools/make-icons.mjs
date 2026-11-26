// Regenerates icons/ from the logo. Run with the dev server up: bash tests/serve.sh & node tools/make-icons.mjs
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const out = new URL('../icons/', import.meta.url).pathname;

// the glyph from the logo, on a 24x24 grid
const GLYPH = `<circle cx="7" cy="16.5" r="2.3" fill="#1d1b24"/><path d="M8.7 14.8C11.2 9.6 13.2 12.6 15.4 8" fill="none" stroke="#1d1b24" stroke-width="1.8" stroke-linecap="round"/><path d="M13.4 6.4l3 1.4-1.4 3" fill="none" stroke="#1d1b24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="7.5" fill="#ffd23f"/>${GLYPH}</svg>`;
const fullBleed = k =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="#ffd23f"/><g transform="translate(12 12) scale(${k}) translate(-12 -12)">${GLYPH}</g></svg>`;
writeFileSync(out + 'icon.svg', rounded + '\n');

const browser = await chromium.launch();
const page = await browser.newPage();
async function png(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}</style>${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}`
  );
  await page.screenshot({ path: out + file, omitBackground: true });
}
await png(rounded, 192, 'icon-192.png');
await png(rounded, 512, 'icon-512.png');
await png(fullBleed(0.62), 512, 'icon-maskable-512.png');
await png(fullBleed(0.8), 180, 'apple-touch-icon.png');
await png(rounded, 32, 'favicon-32.png');

// social preview card 1200x630, using the app's own fonts
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(
  `<!doctype html><html><head><base href="${BASE}"><link rel="stylesheet" href="css/fonts.css"><style>
body{margin:0;width:1200px;height:630px;background:#f8f5ee;background-image:radial-gradient(circle,#d3cdbd 1.6px,transparent 2px);background-size:30px 30px;font-family:Figtree;display:flex;align-items:center;gap:70px;padding:0 90px;box-sizing:border-box;overflow:hidden}
.l{flex:1}.brand{display:flex;align-items:center;gap:22px;font:800 76px/1 'Bricolage Grotesque';letter-spacing:-.03em;color:#1d1b24}
.brand svg{width:96px;height:96px}p{font:500 34px/1.3 Figtree;color:#6c6657;margin:30px 0 0;max-width:560px}
.board{position:relative;width:420px;height:440px}
.s{position:absolute;display:grid;place-items:center;font:400 26px Kalam;color:#1e1e1e;box-sizing:border-box}
</style></head><body><div class="l"><div class="brand">${rounded}Sketchboard</div><p>Whiteboards and diagrams that live on your device and work offline.</p></div>
<div class="board">
<div class="s" style="left:0;top:30px;width:190px;height:110px;border:3px solid #1d1b24;border-radius:50%;background:#fff3a6">Idea</div>
<div class="s" style="left:230px;top:30px;width:190px;height:110px;border:3px solid #1d1b24;border-radius:18px;background:#d0ebff">Sketch</div>
<div class="s" style="left:115px;top:210px;width:190px;height:110px;border:3px solid #1d1b24;background:#d3f9d8">Ship it</div>
<div class="s" style="left:250px;top:300px;width:170px;height:140px;background:#fcc2d7;box-shadow:0 8px 18px rgba(0,0,0,.15);transform:rotate(3deg)">Tuesday!</div>
<svg style="position:absolute;inset:0" width="420" height="440"><path d="M190 85h36M320 140l-50 66" stroke="#1d1b24" stroke-width="3" fill="none" stroke-linecap="round"/></svg>
</div></body></html>`,
  { waitUntil: 'networkidle' }
);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out + 'og.png' });
await browser.close();
console.log('icons written to', out);
