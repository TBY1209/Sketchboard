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
async function exportPNG() {
  if (!els.length) return toast('Nothing on the board yet');
  try {
    await document.fonts.ready;
  } catch (_) {}
  await ensureImages(els);
  const b = unionB(els),
    pad = 40,
    W = b.w + pad * 2,
    H = b.h + pad * 2,
    sc = Math.min(2, 8000 / Math.max(W, H)),
    c = document.createElement('canvas');
  c.width = Math.ceil(W * sc);
  c.height = Math.ceil(H * sc);
  const x = c.getContext('2d');
  x.scale(sc, sc);
  x.fillStyle = '#fff';
  x.fillRect(0, 0, W, H);
  x.translate(pad - b.x, pad - b.y);
  for (const e of drawOrder(els)) drawEl(x, e);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  deliver(fileBase() + '.png', blob, () =>
    modal(
      `<h3>Your board as an image</h3><p>Long-press or right-click the picture to save it.</p><img alt="Exported board" src="${c.toDataURL('image/png')}"><div class="mrow"><button class="btn pri" data-close>Done</button></div>`
    )
  );
}
function svgString() {
  const b = unionB(els),
    pad = 40,
    W = r1(b.w + pad * 2),
    H = r1(b.h + pad * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${r1(b.x - pad)} ${r1(b.y - pad)} ${W} ${H}"><defs><style>@import url('https://fonts.googleapis.com/css2?family=Figtree&amp;family=Kalam&amp;family=JetBrains+Mono&amp;display=swap');</style><filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000" flood-opacity=".16"/></filter></defs><rect x="${r1(b.x - pad)}" y="${r1(b.y - pad)}" width="${W}" height="${H}" fill="#fff"/>${drawOrder(
    els
  )
    .map(e => elSVG(e, true))
    .join('')}</svg>`;
}
async function exportSVG() {
  if (!els.length) return toast('Nothing on the board yet');
  exportImgs = await imageFiles(els);
  const s = svgString();
  exportImgs = {};
  deliver(fileBase() + '.svg', s, () =>
    modal(
      `<h3>SVG code</h3><p>Copy this into a .svg file or straight into Figma.</p><textarea readonly>${esc(s)}</textarea><div class="mrow"><button class="btn" data-close>Close</button><button class="btn pri" data-copy>Copy</button></div>`
    )
  );
}
async function boardFile(name, list) {
  const files = await imageFiles(list),
    d = { sketchboard: 1, name, els: list };
  if (Object.keys(files).length) d.files = files;
  return JSON.stringify(d);
}
async function exportJSON() {
  const s = await boardFile(board ? board.name : 'Board', els);
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
