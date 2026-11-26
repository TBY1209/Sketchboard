/* PNG / SVG / JSON export and board file import. */
let exportImgs = {}; // hash -> data URL while building an SVG export
function drawEl(x, e) {
  x.save();
  x.globalAlpha = e.op;
  x.lineCap = 'round';
  x.lineJoin = 'round';
  if (e.t === 'line') {
    const g = lineGeo(e),
      c = col(e.stroke, 1);
    x.strokeStyle = c;
    x.fillStyle = c;
    x.lineWidth = e.sw;
    x.setLineDash(dashArr(e));
    x.stroke(new Path2D(g.d));
    x.setLineDash([]);
    for (const h of g.H) {
      const p = new Path2D(h.d);
      if (h.f) {
        x.lineWidth = e.sw * 0.6;
        x.fill(p);
        x.stroke(p);
      } else {
        x.lineWidth = e.sw;
        x.stroke(p);
      }
    }
    if (e.text) ctext(x, e, { x: g.mid.x - 110, y: g.mid.y, w: 220, h: 0 }, tcol(e, 1), true, true);
  } else {
    x.translate(e.x, e.y);
    if (e.t === 'frame') {
      const p = new Path2D(rr(e.w, e.h, Math.min(14, e.w / 2, e.h / 2)));
      if (e.fill !== 'transparent') {
        x.fillStyle = e.fill;
        x.fill(p);
      }
      x.strokeStyle = '#d6cfbf';
      x.lineWidth = 1.5;
      x.stroke(p);
      x.font = `700 ${FRAME_TITLE.fs}px ${FONTS.sans}`;
      x.fillStyle = '#6c6657';
      x.textAlign = 'left';
      x.fillText(e.text || 'Frame', 4, -11);
    } else if (e.t === 'img') {
      const c = imgCache.get(e.src);
      if (c && c.state === 'ok') x.drawImage(c.img, 0, 0, e.w, e.h);
      else {
        x.fillStyle = '#f1f3f5';
        x.fillRect(0, 0, e.w, e.h);
      }
    } else if (e.t === 'pen') {
      x.strokeStyle = col(e.stroke, 1);
      x.lineWidth = e.sw;
      x.setLineDash(dashArr(e));
      x.stroke(new Path2D(penD(e)));
    } else {
      const p = new Path2D(shapeD(e));
      if (e.fill !== 'transparent') {
        if (e.sh) {
          x.shadowColor = 'rgba(0,0,0,.16)';
          x.shadowBlur = 10;
          x.shadowOffsetY = 4;
        }
        x.fillStyle = e.fill;
        x.fill(p);
        x.shadowColor = 'transparent';
      }
      const st = e.t === 'text' ? 'transparent' : col(e.stroke, 1);
      if (st !== 'transparent' && e.sw) {
        x.strokeStyle = st;
        x.lineWidth = e.sw;
        x.setLineDash(dashArr(e));
        x.stroke(p);
        if (e.t === 'cyl') x.stroke(new Path2D(rimD(e)));
      }
      if (e.text) ctext(x, e, tbox(e), tcol(e, 1));
    }
  }
  x.restore();
}
function ctext(x, e, b, color, halo, force) {
  x.setLineDash([]);
  x.font = fontStr(e);
  x.textAlign = force ? 'center' : e.ta;
  x.textBaseline = 'alphabetic';
  for (const l of textLines(e, b, force)) {
    if (halo) {
      x.strokeStyle = '#fff';
      x.lineWidth = 6;
      x.strokeText(l.s, l.x, l.y);
    }
    x.fillStyle = color;
    x.fillText(l.s, l.x, l.y);
  }
}
async function deliver(name, data, fallback) {
  try {
    const blob =
        data instanceof Blob
          ? data
          : new Blob([data], { type: name.endsWith('.svg') ? 'image/svg+xml' : 'application/json' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Saved ' + name);
  } catch (_) {
    fallback();
  }
}
/* ---------- export engine: works on any list of elements ---------- */
const BGS = { paper: '#f8f5ee', white: '#ffffff', none: null };
function exportList(scope) {
  if (scope === 'sel' && sel.size) return [...moveSet().keys()].map(byId).filter(Boolean);
  if (scope && scope.startsWith('frame:')) {
    const f = byId(scope.slice(6));
    if (f) return [f, ...frameKids(f)];
  }
  return els;
}
function exportBox(list, pad = 40) {
  const b = unionB(list) || { x: 0, y: 0, w: 1, h: 1 };
  return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
}
const pngScale = (box, scale) =>
  Math.max(0.1, Math.min(scale, 8192 / Math.max(box.w, box.h), Math.sqrt(40e6 / (box.w * box.h))));
async function renderCanvas(list, { scale = 2, bg = '#ffffff' } = {}) {
  try {
    await document.fonts.ready;
  } catch (_) {}
  await ensureImages(list);
  const B = exportBox(list),
    sc = pngScale(B, scale),
    c = document.createElement('canvas');
  c.width = Math.ceil(B.w * sc);
  c.height = Math.ceil(B.h * sc);
  const x = c.getContext('2d');
  x.scale(sc, sc);
  if (bg) {
    x.fillStyle = bg;
    x.fillRect(0, 0, B.w, B.h);
  }
  x.translate(-B.x, -B.y);
  for (const e of drawOrder(list)) drawEl(x, e);
  return c;
}
const canvasBlob = c => new Promise(r => c.toBlob(r, 'image/png'));

/* fonts embedded into SVG exports so text looks right anywhere (only families actually used) */
const FAMILY = {
  hand: 'Kalam',
  sans: 'Figtree',
  serif: 'Lora',
  mono: 'JetBrains Mono',
  marker: 'Permanent Marker',
  round: 'Nunito'
};
let fontFaceList = null;
const fontData = {};
async function fontFaces() {
  if (fontFaceList) return fontFaceList;
  try {
    const t = await (await fetch('css/fonts.css')).text();
    fontFaceList = [...t.matchAll(/@font-face \{([^}]*)\}/g)].map(m => {
      const b = m[1];
      return {
        fam: /font-family: '([^']+)'/.exec(b)[1],
        style: /font-style: (\w+)/.exec(b)[1],
        wt: /font-weight: ([\d ]+);/.exec(b)[1].trim(),
        url: /url\(([^)]+)\)/.exec(b)[1].replace('../', ''),
        ur: (/unicode-range: ([^;]+);/.exec(b) || [])[1] || '',
        ext: /latin-ext\.woff2/.test(b)
      };
    });
  } catch (_) {
    fontFaceList = [];
  }
  return fontFaceList;
}
async function embeddedFontCSS(list) {
  const fams = new Set();
  let ext = false;
  for (const e of list) {
    if (e.t === 'frame') fams.add('Figtree');
    else if (e.text) {
      fams.add(FAMILY[e.font]);
      if (/[^\u0000-\u00ff\u2000-\u206f]/.test(e.text)) ext = true;
    }
  }
  if (!fams.size) return '';
  const faces = (await fontFaces()).filter(f => fams.has(f.fam) && (!f.ext || ext));
  for (const f of faces)
    if (!fontData[f.url])
      try {
        fontData[f.url] = await blobToDataURL(await (await fetch(f.url)).blob());
      } catch (_) {}
  return faces
    .filter(f => fontData[f.url])
    .map(
      f =>
        `@font-face{font-family:'${f.fam}';font-style:${f.style};font-weight:${f.wt};src:url(${fontData[f.url]}) format('woff2');${f.ur ? `unicode-range:${f.ur};` : ''}}`
    )
    .join('');
}
async function svgFor(list, { bg = '#ffffff', fonts = true } = {}) {
  const B = exportBox(list);
  exportImgs = await imageFiles(list);
  const css = fonts ? await embeddedFontCSS(list) : '';
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${r1(B.w)}" height="${r1(B.h)}" viewBox="${r1(B.x)} ${r1(B.y)} ${r1(B.w)} ${r1(B.h)}"><defs>${css ? `<style>${css}</style>` : ''}<filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000" flood-opacity=".16"/></filter></defs>${
    bg ? `<rect x="${r1(B.x)}" y="${r1(B.y)}" width="${r1(B.w)}" height="${r1(B.h)}" fill="${bg}"/>` : ''
  }${drawOrder(list)
    .map(e => elSVG(e, true))
    .join('')}</svg>`;
  exportImgs = {};
  return s;
}

/* quick exports (menu / palette): whole board, white background, 2x */
async function exportPNG(scope) {
  const list = exportList(scope);
  if (!list.length) return toast('Nothing on the board yet');
  deliver(
    fileBase() + '.png',
    await canvasBlob(await renderCanvas(list, { scale: 2, bg: BGS.white })),
    () => {}
  );
}
async function exportSVG(scope) {
  const list = exportList(scope);
  if (!list.length) return toast('Nothing on the board yet');
  deliver(fileBase() + '.svg', await svgFor(list, { bg: BGS.white }), () => {});
}
async function copyPNG(scope) {
  const list = exportList(scope || (sel.size ? 'sel' : 'board'));
  if (!list.length) return toast('Nothing to copy');
  const blob = renderCanvas(list, { scale: 2, bg: BGS.white }).then(canvasBlob);
  try {
    if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write)
      throw new Error('no clipboard');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('Image copied — paste it anywhere');
  } catch (_) {
    deliver(fileBase() + '.png', await blob, () => {});
    toast('This browser can’t copy images, so it was downloaded instead');
  }
}

/* PDF via the browser's print dialog: one page per frame, or the whole thing on one page */
async function printPDF(pages) {
  const box = document.createElement('div');
  box.id = 'print';
  let wide = 0;
  for (const list of pages) {
    const B = exportBox(list);
    if (B.w > B.h) wide++;
    const sec = document.createElement('section');
    sec.className = 'ppage';
    sec.innerHTML = await svgFor(list, { bg: null, fonts: false });
    box.append(sec);
  }
  const st = document.createElement('style');
  st.textContent = `@page{size:${wide * 2 >= pages.length ? 'landscape' : 'portrait'};margin:12mm}`;
  box.append(st);
  document.body.append(box);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const done = () => {
    box.remove();
    removeEventListener('afterprint', done);
  };
  addEventListener('afterprint', done);
  window.print();
  setTimeout(() => box.isConnected && matchMedia('print').matches === false && done(), 1000);
}

async function boardFile(name, list) {
  const files = await imageFiles(list),
    d = { sketchboard: 1, name, els: list };
  if (Object.keys(files).length) d.files = files;
  return JSON.stringify(d);
}
async function exportJSON(scope) {
  const s = await boardFile(board ? board.name : 'Board', exportList(scope));
  deliver(fileBase() + '.json', s, () =>
    modal(
      `<h3>Board file</h3><p>Copy this and keep it somewhere safe. Open board file reads it back.</p><textarea readonly>${esc(s)}</textarea><div class="mrow"><button class="btn" data-close>Close</button><button class="btn pri" data-copy>Copy</button></div>`
    )
  );
}
$('#file').addEventListener('change', async e => {
  const files = [...e.target.files];
  e.target.value = '';
  let last = null,
    bad = 0;
  for (const file of files) {
    try {
      const d = JSON.parse(await file.text()),
        list = Array.isArray(d) ? d : d.els;
      if (!Array.isArray(list) || !loadEls(list).length) throw 0;
      if (d.files) await storeImageFiles(d.files);
      const name =
        (d && typeof d.name === 'string' && d.name) || file.name.replace(/\.json$/i, '') || 'Imported board';
      last = await createBoard(name, list, 'blank');
    } catch (_) {
      bad++;
    }
  }
  if (bad)
    toast(
      bad === 1 && files.length === 1
        ? 'That file is not a Sketchboard board'
        : bad + ' file(s) could not be read'
    );
  if (last) {
    if (files.length - bad > 1) {
      toast(files.length - bad + ' boards imported');
      if (route === 'home') renderHome();
    } else go('#/b/' + last.id);
  }
});
function fileBase() {
  const n = (board && board.name) || 'sketchboard';
  return (
    n
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60) || 'sketchboard'
  );
}
