/* Export dialog, share links (#/s/<compressed board>) and the read-only shared view. */

/* ---------- export dialog ---------- */
const XO = { fmt: 'png', scope: 'board', scale: 2, bg: 'white' };
try {
  Object.assign(XO, JSON.parse(localStorage.getItem(LS + '.export') || '{}'), { scope: 'board' });
} catch (_) {}
const xSeg = (k, opts, cur) =>
  `<div class="seg" data-xk="${k}">${opts
    .map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`)
    .join('')}</div>`;

function openExport(scope) {
  if (route !== 'board' && route !== 'share') return;
  if (!els.length) return toast('Nothing on the board yet');
  closePops();
  XO.scope = scope || (sel.size ? 'sel' : 'board');
  if (XO.scope === 'sel' && !sel.size) XO.scope = 'board';
  modal(`<h3>Export</h3><div class="xgrid"><div class="xprev" id="xPrev"></div><div class="xopts" id="xOpts"></div></div>
<p class="xinfo" id="xInfo"></p>
<div class="mrow"><button class="btn" data-close>Cancel</button><button class="btn" id="xCopy" hidden></button><button class="btn pri" id="xGo">Download</button></div>`);
  $('#mcard').classList.add('xl');
  xRender();
}
function xRender() {
  const frames = framesList(),
    scopes = [['board', 'Whole board']];
  if (sel.size) scopes.push(['sel', 'Selection']);
  if (frames.length) scopes.push(['frame', 'A frame']);
  const isFrame = XO.scope.startsWith('frame:');
  if (XO.scope === 'frame' || (isFrame && !byId(XO.scope.slice(6))))
    XO.scope = frames.length ? 'frame:' + frames[0].id : 'board';
  let h =
    `<h4>Format</h4>` +
    xSeg(
      'fmt',
      [
        ['png', 'PNG'],
        ['svg', 'SVG'],
        ['pdf', 'PDF'],
        ['json', 'File']
      ],
      XO.fmt
    ) +
    `<h4>What</h4>` +
    xSeg('scope', scopes, XO.scope.startsWith('frame:') ? 'frame' : XO.scope);
  if (XO.scope.startsWith('frame:'))
    h += `<select id="xFrame" class="tin" aria-label="Frame">${frames
      .map(
        f =>
          `<option value="${f.id}"${'frame:' + f.id === XO.scope ? ' selected' : ''}>${esc(f.text || 'Frame')}</option>`
      )
      .join('')}</select>`;
  if (XO.fmt === 'png')
    h +=
      `<h4>Size</h4>` +
      xSeg(
        'scale',
        [
          [1, '1×'],
          [2, '2×'],
          [3, '3×']
        ],
        XO.scale
      );
  if (XO.fmt !== 'json')
    h +=
      `<h4>Background</h4>` +
      xSeg(
        'bg',
        [['white', 'White'], ['paper', 'Paper'], ...(XO.fmt === 'pdf' ? [] : [['none', 'None']])],
        XO.fmt === 'pdf' && XO.bg === 'none' ? 'white' : XO.bg
      );
  if (XO.fmt === 'pdf' && XO.scope === 'board' && frames.length)
    h += `<label class="xchk"><input type="checkbox" id="xPages"${XO.pages !== false ? ' checked' : ''}> One page per frame</label>`;
  $('#xOpts').innerHTML = h;

  const list = exportList(XO.scope),
    B = exportBox(list);
  // preview (inline so it uses the page's fonts)
  const bg = XO.fmt === 'pdf' && XO.bg === 'none' ? BGS.white : BGS[XO.bg];
  const pv = $('#xPrev');
  pv.classList.toggle('checker', !bg && XO.fmt !== 'json');
  exportImgs = {};
  const imgs = list.filter(e => e.t === 'img');
  const draw = () => {
    for (const e of imgs) {
      const c = imgCache.get(e.src);
      if (c && c.state === 'ok') exportImgs[e.src] = c.url;
    }
    pv.innerHTML = `<svg viewBox="${r1(B.x)} ${r1(B.y)} ${r1(B.w)} ${r1(B.h)}" preserveAspectRatio="xMidYMid meet">${
      bg ? `<rect x="${r1(B.x)}" y="${r1(B.y)}" width="${r1(B.w)}" height="${r1(B.h)}" fill="${bg}"/>` : ''
    }${drawOrder(list)
      .map(e => elSVG(e, true))
      .join('')}</svg>`;
    exportImgs = {};
  };
  draw();
  if (imgs.length) ensureImages(list).then(() => $('#xPrev') && draw());

  const n = list.length,
    sc = pngScale(B, XO.scale);
  const info = {
    png: `${Math.ceil(B.w * sc)} × ${Math.ceil(B.h * sc)} px`,
    svg: 'Vector, fonts and images embedded — opens in Figma, Illustrator, browsers',
    pdf: 'Opens your browser’s print dialog — choose “Save as PDF”',
    json: 'A Sketchboard file you can import later or send to someone'
  }[XO.fmt];
  $('#xInfo').textContent = `${n} item${n === 1 ? '' : 's'} · ${info}`;
  $('#xGo').textContent = XO.fmt === 'pdf' ? 'Print / save PDF' : 'Download';
  const cp = $('#xCopy'),
    canShareFiles = !!(
      navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] })
    );
  cp.hidden = XO.fmt !== 'png';
  cp.textContent = canShareFiles && narrow() ? 'Share…' : 'Copy image';
  cp.dataset.mode = canShareFiles && narrow() ? 'share' : 'copy';
  try {
    localStorage.setItem(
      LS + '.export',
      JSON.stringify({ fmt: XO.fmt, scale: XO.scale, bg: XO.bg, pages: XO.pages })
    );
  } catch (_) {}
}
$('#mcard').addEventListener('click', async e => {
  const sb = e.target.closest('[data-xk] button');
  if (sb) {
    const k = sb.parentElement.dataset.xk;
    let v = sb.dataset.v;
    if (k === 'scale') v = +v;
    if (k === 'scope' && v === 'frame') v = 'frame';
    XO[k] = v;
    return xRender();
  }
  if (e.target.id === 'xGo') return xGo();
  if (e.target.id === 'xCopy') {
    const list = exportList(XO.scope);
    if (e.target.dataset.mode === 'share') {
      const blob = await canvasBlob(await renderCanvas(list, { scale: XO.scale, bg: BGS[XO.bg] }));
      try {
        await navigator.share({
          files: [new File([blob], fileBase() + '.png', { type: 'image/png' })],
          title: board && board.name
        });
      } catch (_) {}
      return;
    }
    closeModal();
    return copyPNG(XO.scope);
  }
});
$('#mcard').addEventListener('change', e => {
  if (e.target.id === 'xFrame') {
    XO.scope = 'frame:' + e.target.value;
    xRender();
  } else if (e.target.id === 'xPages') {
    XO.pages = e.target.checked;
  }
});
async function xGo() {
  const list = exportList(XO.scope),
    bg = BGS[XO.bg],
    btn = $('#xGo');
  btn.disabled = true;
  btn.textContent = 'Working…';
  try {
    if (XO.fmt === 'png')
      deliver(
        fileBase() + '.png',
        await canvasBlob(await renderCanvas(list, { scale: XO.scale, bg })),
        () => {}
      );
    else if (XO.fmt === 'svg') deliver(fileBase() + '.svg', await svgFor(list, { bg }), () => {});
    else if (XO.fmt === 'json')
      deliver(fileBase() + '.json', await boardFile(board ? board.name : 'Board', list), () => {});
    else {
      const frames = framesList();
      const pages =
        XO.scope === 'board' && frames.length && XO.pages !== false
          ? [
              ...frames.map(f => [f, ...frameKids(f)]),
              ...(() => {
                const inF = new Set(frames.flatMap(f => [f, ...frameKids(f)]).map(e => e.id)),
                  rest = els.filter(e => !inF.has(e.id));
                return rest.length ? [rest] : [];
              })()
            ]
          : [list];
      closeModal();
      await printPDF(pages);
      return;
    }
  } finally {
    if ($('#xGo')) {
      btn.disabled = false;
      xRender();
    }
  }
  closeModal();
}

/* ---------- share links ---------- */
const b64url = bytes => {
  let s = '';
  const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = s => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
};
async function pack(str) {
  if (!window.CompressionStream) return 'j' + b64url(new TextEncoder().encode(str));
  const s = new Blob([str]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return 'z' + b64url(await new Response(s).arrayBuffer());
}
async function unpack(p) {
  const bytes = unb64url(p.slice(1));
  if (p[0] === 'z') {
    const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(s).text();
  }
  return new TextDecoder().decode(bytes);
}
/* drop fields that clean() would fill in anyway, and round numbers, to keep links short */
const DEFAULTS = {
  fill: 'transparent',
  stroke: 'ink',
  sw: 2,
  dash: 'solid',
  font: 'hand',
  fs: 20,
  op: 1,
  text: '',
  tc: 'auto',
  bold: false,
  it: false,
  ta: 'center',
  va: 'middle',
  route: 'curve',
  head: 'end',
  hk: 'tri',
  k: 0.5
};
function slim(e) {
  const o = {};
  for (const [k, v] of Object.entries(e)) {
    if (DEFAULTS[k] === v) continue;
    if (k === 'rad' && v === (e.t === 'round' ? 18 : e.t === 'sticky' ? 4 : 0)) continue;
    if (k === 'sh' && v === (e.t === 'sticky')) continue;
    o[k] =
      typeof v === 'number'
        ? Math.round(v * 10) / 10
        : k === 'a' || k === 'b'
          ? { ...v, x: Math.round(v.x), y: Math.round(v.y) }
          : v;
  }
  return o;
}
async function makeShareLink(list) {
  const kept = list.filter(e => e.t !== 'img'),
    dropped = list.length - kept.length;
  const p = await pack(JSON.stringify({ v: 1, n: board ? board.name : 'Board', e: kept.map(slim) }));
  return { url: location.href.split('#')[0] + '#/s/' + p, dropped };
}
async function openShare() {
  if (route !== 'board' || !els.length) return toast('Nothing on the board to share yet');
  const scope = sel.size ? 'sel' : 'board';
  const { url, dropped } = await makeShareLink(exportList(scope));
  const kb = (url.length / 1024).toFixed(1);
  const warn = [];
  if (scope === 'sel') warn.push('Only the selection is included.');
  if (dropped)
    warn.push(
      `${dropped} image${dropped === 1 ? '' : 's'} left out — links can’t carry images. Send a board file instead.`
    );
  if (url.length > 16000)
    warn.push(`This link is long (${kb} KB) and some chat apps cut long links. A board file is safer.`);
  modal(`<h3>Share a view-only link</h3>
<p>Anyone with the link sees a copy of this board as it is right now and can save their own copy. Nothing is uploaded — the whole board is packed into the link.</p>
<input class="tin" id="shareUrl" readonly value="${esc(url)}" aria-label="Share link">
${warn.length ? `<p class="xwarn">${warn.map(esc).join('<br>')}</p>` : ''}
<div class="mrow"><button class="btn" data-close>Done</button>${navigator.share ? '<button class="btn" id="shareNative">Share…</button>' : ''}<button class="btn pri" id="shareCopy">Copy link</button></div>`);
  const inp = $('#shareUrl');
  inp.addEventListener('focus', () => inp.select());
  $('#shareCopy').onclick = () =>
    navigator.clipboard.writeText(url).then(
      () => toast('Link copied'),
      () => {
        inp.focus();
        inp.select();
        toast('Select the link and copy it');
      }
    );
  if ($('#shareNative'))
    $('#shareNative').onclick = () =>
      navigator.share({ title: board ? board.name : 'Sketchboard', url }).catch(() => {});
}

/* ---------- shared, read-only view ---------- */
async function openShared(payload) {
  let d;
  try {
    d = JSON.parse(await unpack(payload));
    if (!d || !Array.isArray(d.e)) throw 0;
  } catch (_) {
    toast('That share link is broken or incomplete');
    return go('#/', true);
  }
  resetBoardState();
  readOnly = true;
  board = { id: null, name: String(d.n || 'Shared board').slice(0, 80) };
  els = loadEls(d.e);
  setRoute('share');
  setTool('hand');
  setTitle();
  render();
  fit();
}
$('#saveCopy').addEventListener('click', async () => {
  const meta = await createBoard(board.name, els, 'blank');
  readOnly = false;
  go('#/b/' + meta.id, true);
  toast('Saved to your boards');
});
