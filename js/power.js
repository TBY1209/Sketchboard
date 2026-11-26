/* Power-user canvas features: groups, locking, frames, images, context menu,
   zoom to selection, camera animation, minimap, keeping the selection clear of the style panel. */

/* extra icons used by menus */
Object.assign(ICON, {
  group:
    '<rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke-dasharray="3 2.5"/><rect x="7" y="7" width="5" height="5" rx="1"/><rect x="12" y="12" width="5" height="5" rx="1"/>',
  ungroup:
    '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/><path d="M15 4h5v5M4 15v5h5" stroke-dasharray="2 2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.6-1.8"/>',
  zoomSel: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M8 10.5h5M10.5 8v5"/>',
  frame: '<path d="M7 3v18M17 3v18M3 7h18M3 17h18"/>',
  image:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
  cut: '<circle cx="6.5" cy="17.5" r="2.8"/><circle cx="17.5" cy="17.5" r="2.8"/><path d="M8.5 15.5L17 4M15.5 15.5L7 4"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V4.5h-11v11h4"/>',
  paste: '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3.5h6V5M9 11h6M9 15h4"/>',
  selAll:
    '<rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="3 2.6"/><path d="M8.5 12.2l2.4 2.4 4.6-5"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  export: '<path d="M12 15V4M7 9l5-5 5 5M5 14v6h14v-6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  minimap:
    '<rect x="3.5" y="5" width="17" height="14" rx="2"/><rect x="11" y="11" width="7" height="5" rx="1"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>'
});

/* ---------- groups ---------- */
function groupOf(id) {
  const e = byId(id);
  if (!e || !e.grp) return [id];
  return els.filter(x => x.grp === e.grp && !x.lk).map(x => x.id);
}
function expandGroups(set) {
  const g = new Set();
  for (const id of set) {
    const e = byId(id);
    if (e && e.grp) g.add(e.grp);
  }
  if (g.size) for (const e of els) if (e.grp && g.has(e.grp) && !e.lk) set.add(e.id);
  return set;
}
const selIsGroup = () => {
  const S = selEls();
  return S.length > 1 && !!S[0].grp && S.every(e => e.grp === S[0].grp);
};
const selHasGroup = () => selEls().some(e => e.grp);
function groupSel() {
  const S = selEls();
  if (S.length < 2) return toast('Select 2 or more things to group');
  begin();
  const g = uid();
  for (const e of S) e.grp = g;
  end();
  render();
  toast('Grouped — click any part to pick up the whole group');
}
function ungroupSel() {
  const S = selEls().filter(e => e.grp);
  if (!S.length) return;
  begin();
  for (const e of S) delete e.grp;
  end();
  render();
  toast('Ungrouped');
}

/* ---------- lock ---------- */
function lockSel() {
  const S = selEls();
  if (!S.length) return;
  begin();
  for (const e of S) e.lk = true;
  sel.clear();
  end();
  render();
  toast(S.length === 1 ? 'Locked — right-click or long-press it to unlock' : S.length + ' items locked');
}
function unlockIds(ids) {
  begin();
  for (const id of ids) {
    const e = byId(id);
    if (e) delete e.lk;
  }
  end();
  sel = new Set(ids.filter(byId));
  render();
}
const anyLocked = () => els.some(e => e.lk);
let hoverLock = null;

/* ---------- frames ---------- */
const isFrame = e => !!e && e.t === 'frame';
const FRAME_TITLE = { fs: 16, h: 30 };
function frameTitleW(e) {
  mctx.font = `700 ${FRAME_TITLE.fs}px ${FONTS.sans}`;
  return Math.max(60, mctx.measureText(e.text || 'Frame').width + 12);
}
/* things whose centre sits inside the frame move with it */
function frameKids(f) {
  const out = [];
  for (const e of els) {
    if (e === f || e.lk || isFrame(e)) continue;
    const b = bounds(e),
      cx = b.x + b.w / 2,
      cy = b.y + b.h / 2;
    if (cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h) out.push(e);
  }
  return out;
}
function moveSet() {
  const m = snapSel();
  for (const e of selEls())
    if (isFrame(e))
      for (const k of frameKids(e)) if (!m.has(k.id)) m.set(k.id, JSON.parse(JSON.stringify(k)));
  return m;
}
/* frames first so they sit underneath everything else */
const drawOrder = list => [...list.filter(isFrame), ...list.filter(e => !isFrame(e))];
function framesList() {
  return els.filter(isFrame);
}

/* ---------- images ---------- */
const imgCache = new Map(); // hash -> {state, url, img}
function imgEntry(hash) {
  let c = imgCache.get(hash);
  if (c) return c;
  c = { state: 'loading' };
  imgCache.set(hash, c);
  c.ready = Store.getBlob(hash)
    .then(
      blob =>
        new Promise(res => {
          if (!blob) {
            c.state = 'missing';
            return res();
          }
          c.blob = blob;
          c.url = URL.createObjectURL(blob);
          const im = new Image();
          im.onload = () => {
            c.state = 'ok';
            res();
          };
          im.onerror = () => {
            c.state = 'missing';
            res();
          };
          im.src = c.url;
          c.img = im;
        })
    )
    .catch(() => {
      c.state = 'missing';
    })
    .then(() => renderSoon());
  return c;
}
function ensureImages(list) {
  return Promise.all(list.filter(e => e.t === 'img').map(e => imgEntry(e.src).ready));
}
const blobToDataURL = b =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(b);
  });
async function imageFiles(list) {
  const out = {};
  for (const e of list)
    if (e.t === 'img' && !out[e.src]) {
      const c = imgEntry(e.src);
      await c.ready;
      if (c.blob) out[e.src] = await blobToDataURL(c.blob);
    }
  return out;
}
async function storeImageFiles(files) {
  if (!files || typeof files !== 'object') return;
  for (const [h, url] of Object.entries(files)) {
    if (
      !okHash(h) ||
      typeof url !== 'string' ||
      !/^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,/.test(url)
    )
      continue;
    try {
      const blob = await (await fetch(url)).blob();
      await Store.putBlob(h, blob);
      imgCache.delete(h);
    } catch (_) {}
  }
}
async function hashBlob(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (window.crypto && crypto.subtle) {
    try {
      const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
      return [...d.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {}
  }
  // FNV-1a fallback (file:// pages have no crypto.subtle)
  let h1 = 0x811c9dc5,
    h2 = 0x01000193 ^ buf.length;
  for (let i = 0; i < buf.length; i++) {
    h1 = Math.imul(h1 ^ buf[i], 16777619);
    h2 = Math.imul(h2 ^ buf[i], 2246822507);
  }
  return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')).repeat(2);
}
async function prepImage(file) {
  const load = () =>
    new Promise((res, rej) => {
      const i = new Image(),
        u = URL.createObjectURL(file);
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = u;
    });
  const im = await load();
  const w = im.naturalWidth || 400,
    h = im.naturalHeight || 300,
    M = 2048;
  if (file.type === 'image/svg+xml' || (Math.max(w, h) <= M && file.size < 3e6)) return { blob: file, w, h };
  const k = Math.min(1, M / Math.max(w, h)),
    c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
  let blob = await new Promise(r => c.toBlob(r, type, 0.88));
  if (!blob) blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return { blob, w: c.width, h: c.height };
}
async function addImageFiles(files, at) {
  const list = [...files].filter(f => /^image\/(png|jpeg|gif|webp|svg\+xml|avif|bmp)$/.test(f.type));
  if (!list.length) return false;
  if (route !== 'board' || readOnly) return true;
  const ready = [];
  for (const f of list) {
    try {
      const { blob, w, h } = await prepImage(f);
      const hash = await hashBlob(blob);
      await Store.putBlob(hash, blob);
      imgCache.delete(hash);
      ready.push({ hash, w, h });
    } catch (err) {
      console.warn(err);
      toast(
        Store.fallback
          ? 'Images need full browser storage, which is blocked here'
          : 'Couldn’t read that image'
      );
    }
  }
  if (!ready.length) return true;
  begin();
  const added = [];
  let x = at.x;
  for (const r of ready) {
    const s = Math.min(1, 520 / Math.max(r.w, r.h)) / Math.min(2, Math.max(1, devicePixelRatio || 1)) || 1,
      W = Math.max(40, Math.round(r.w * Math.max(s, 0.25))),
      H = Math.max(30, Math.round((W * r.h) / r.w));
    const e = Object.assign(mk('img', 0, 0, W, H), { src: r.hash });
    e.x = snapV(x - (ready.length === 1 ? W / 2 : 0));
    e.y = snapV(at.y - H / 2);
    x += W + 24;
    els.push(e);
    added.push(e.id);
  }
  sel = new Set(added);
  end();
  setTool('select');
  render();
  return true;
}
const okHash = v => typeof v === 'string' && /^[a-f0-9]{16,64}$/.test(v);

/* ---------- camera animation + zoom to selection ---------- */
let camAnim = 0;
function animateCam(to, ms = 280) {
  cancelAnimationFrame(camAnim);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) ms = 0;
  const from = { ...cam },
    t0 = performance.now();
  const step = t => {
    const k = ms ? Math.min(1, (t - t0) / ms) : 1,
      e = 1 - Math.pow(1 - k, 3);
    cam.x = from.x + (to.x - from.x) * e;
    cam.y = from.y + (to.y - from.y) * e;
    cam.z = from.z + (to.z - from.z) * e;
    renderCam();
    if (k < 1) camAnim = requestAnimationFrame(step);
    else saveCamSoon();
  };
  camAnim = requestAnimationFrame(step);
}
/* screen area not covered by the style panel (desktop) */
function freeView() {
  const v = view(),
    P = $('#panel');
  let left = 0;
  if (!narrow() && P.offsetParent && sel.size) left = P.getBoundingClientRect().right;
  return { left, w: v.w - left, h: v.h };
}
function zoomToBounds(b, maxZ = 2) {
  if (!b) return;
  const f = freeView(),
    padX = f.w > 600 ? 120 : 40;
  const z = clampZ(Math.min((f.w - padX) / (b.w || 1), (f.h - 220) / (b.h || 1), maxZ));
  animateCam({ z, x: f.left + f.w / 2 - (b.x + b.w / 2) * z, y: f.h / 2 + 10 - (b.y + b.h / 2) * z });
}
const zoomToSel = () => zoomToBounds(selBounds());
/* if the left style panel hides most of what was just selected, slide the board over */
function avoidPanel() {
  if (narrow() || !sel.size) return;
  const P = $('#panel');
  if (!P.offsetParent) return;
  const pr = P.getBoundingClientRect(),
    b = selBounds(),
    z = cam.z,
    sx = b.x * z + cam.x,
    sy = b.y * z + cam.y,
    sw = b.w * z,
    sh = b.h * z;
  const ox = Math.max(0, Math.min(sx + sw, pr.right) - Math.max(sx, pr.left)),
    oy = Math.max(0, Math.min(sy + sh, pr.bottom) - Math.max(sy, pr.top));
  if (ox * oy < 0.25 * Math.max(1, sw * sh)) return;
  const dx = Math.min(pr.right + 32 - sx, Math.max(0, innerWidth - 24 - (sx + sw)));
  if (dx > 4) animateCam({ x: cam.x + dx, y: cam.y, z: cam.z }, 240);
}

/* ---------- context menu ---------- */
let ctxAt = null,
  ctxLocked = null;
function closeCtx() {
  $('#ctx').hidden = true;
}
function ctxRow(id, label, opts = {}) {
  const a = ACT[id];
  const lab = label || (a && a.label) || id;
  const dis = a && a.when && !a.when();
  const keys = a && (a.keys || a.hint);
  return `<button data-ctx="${id}" role="menuitem"${dis ? ' disabled' : ''}${opts.danger ? ' class="danger"' : ''}>${
    opts.icon ? `<svg class="ico" viewBox="0 0 24 24">${opts.icon}</svg>` : '<span class="ci"></span>'
  }<span class="cl">${esc(lab)}</span>${keys ? `<kbd>${esc(keyLabel(keys[0]))}</kbd>` : ''}</button>`;
}
function openCtx(cx, cy, kind, lockedId) {
  if (route !== 'board' || readOnly) return;
  closePops();
  ctxAt = toW({ clientX: cx, clientY: cy });
  ctxLocked = lockedId || null;
  let h = '';
  const sep = '<hr>';
  if (kind === 'locked') {
    h =
      ctxRow('unlockOne', 'Unlock', { icon: ICON.unlock }) +
      (anyLocked() ? ctxRow('unlockAll', null, { icon: ICON.unlock }) : '');
  } else if (kind === 'sel') {
    const grouped = selHasGroup();
    h =
      ctxRow('cut', null, { icon: ICON.cut }) +
      ctxRow('copy', null, { icon: ICON.copy }) +
      ctxRow('paste', null, { icon: ICON.paste }) +
      ctxRow('dup', null, { icon: ICON.dup }) +
      sep +
      ctxRow('front', null, { icon: ICON.front }) +
      ctxRow('back', null, { icon: ICON.back }) +
      sep +
      (grouped
        ? ctxRow('ungroup', null, { icon: ICON.ungroup })
        : ctxRow('group', null, { icon: ICON.group })) +
      ctxRow('lockSel', null, { icon: ICON.lock }) +
      ctxRow('zoomSel', null, { icon: ICON.zoomSel }) +
      (ACT.copyPng
        ? sep +
          ctxRow('copyPng', null, { icon: ICON.image }) +
          ctxRow('exportSel', null, { icon: ICON.export })
        : '') +
      sep +
      ctxRow('del', null, { icon: ICON.del, danger: true });
  } else {
    h =
      ctxRow('paste', 'Paste here', { icon: ICON.paste }) +
      ctxRow('all', null, { icon: ICON.selAll }) +
      sep +
      ctxRow('addFrameHere', 'Add frame here', { icon: ICON.frame }) +
      ctxRow('insertImage', null, { icon: ICON.image }) +
      sep +
      ctxRow('fit', null, { icon: ICON.fit }) +
      (anyLocked() ? ctxRow('unlockAll', null, { icon: ICON.unlock }) : '');
  }
  const m = $('#ctx');
  m.innerHTML = h;
  m.hidden = false;
  const w = m.offsetWidth,
    hh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, cx)) + 'px';
  m.style.top = Math.max(8, Math.min(innerHeight - hh - 8, cy)) + 'px';
  sbarUpdate();
}
$('#ctx').addEventListener('pointerdown', e => {
  if (e.target.closest('button')) e.preventDefault();
});
$('#ctx').addEventListener('click', e => {
  const b = e.target.closest('[data-ctx]');
  if (!b || b.disabled) return;
  const id = b.dataset.ctx;
  closeCtx();
  if (id === 'unlockOne') {
    if (ctxLocked) unlockIds(groupOfLocked(ctxLocked));
    return;
  }
  if (id === 'paste') return pasteFromMenu(ctxAt);
  if (id === 'addFrameHere') return addFrameAt(ctxAt);
  runAction(id);
});
function groupOfLocked(id) {
  const e = byId(id);
  return e && e.grp ? els.filter(x => x.grp === e.grp).map(x => x.id) : [id];
}
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#ctx')) closeCtx();
});
svg.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (lastPT !== 'mouse' && e.pointerType !== 'mouse' && performance.now() - (window._lpT || 0) < 900) return;
  if (op) return;
  const hitEl = document.elementFromPoint(e.clientX, e.clientY) || e.target,
    t = hitEl.closest && hitEl.closest('#layer [data-id]'),
    el = t && byId(t.dataset.id);
  if (el && el.lk) return openCtx(e.clientX, e.clientY, 'locked', el.id);
  if (el) {
    if (!sel.has(el.id)) sel = new Set(groupOf(el.id));
    render();
    return openCtx(e.clientX, e.clientY, 'sel');
  }
  const p = toW(e),
    b = sel.size && selBounds();
  if (b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h)
    return openCtx(e.clientX, e.clientY, 'sel');
  sel.clear();
  render();
  openCtx(e.clientX, e.clientY, 'canvas');
});
function addFrameAt(p) {
  begin();
  const [w, h] = SIZE.frame,
    f = mk('frame', snapV(p.x - w / 2), snapV(p.y - h / 2), w, h);
  els.unshift(f);
  sel = new Set([f.id]);
  end();
  render();
}

/* ---------- clipboard from menus ---------- */
function copySel(cut) {
  if (!sel.size) return;
  clip = JSON.stringify({ sketchboard: 1, els: copyList() });
  try {
    navigator.clipboard.writeText(clip).catch(() => {});
  } catch (_) {}
  if (cut) del();
  else toast('Copied');
}
async function pasteFromMenu(at) {
  try {
    if (navigator.clipboard && navigator.clipboard.read) {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const im = it.types.find(t => t.startsWith('image/'));
        if (im) {
          const b = await it.getType(im);
          return addImageFiles([new File([b], 'pasted', { type: im })], at || lastW);
        }
        if (it.types.includes('text/plain')) {
          const t = await (await it.getType('text/plain')).text();
          return pasteText(t, at);
        }
      }
    }
  } catch (_) {}
  if (clip) return pasteEls(JSON.parse(clip).els, at);
  toast((IS_MAC ? '⌘' : 'Ctrl') + '+V pastes from other apps');
}
function pasteText(t, at) {
  let data = null;
  try {
    const d = JSON.parse(t);
    if (d && d.sketchboard) {
      data = d.els;
      if (d.files) storeImageFiles(d.files).then(() => renderSoon());
    }
  } catch (_) {}
  if (data) return pasteEls(data, at);
  if (t.trim()) addText(t.trim(), at || lastW);
}

/* ---------- drag and drop ---------- */
stage.addEventListener('dragover', e => {
  if (route !== 'board' || readOnly) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  stage.classList.add('drop');
});
stage.addEventListener('dragleave', e => {
  if (e.target === stage || !stage.contains(e.relatedTarget)) stage.classList.remove('drop');
});
stage.addEventListener('drop', async e => {
  stage.classList.remove('drop');
  if (route !== 'board' || readOnly) return;
  e.preventDefault();
  const p = toW(e),
    files = [...e.dataTransfer.files];
  if (await addImageFiles(files, p)) return;
  const json = files.find(f => /json$/i.test(f.type) || /\.json$/i.test(f.name));
  if (json) {
    try {
      const d = JSON.parse(await json.text());
      if (d.files) await storeImageFiles(d.files);
      pasteEls(Array.isArray(d) ? d : d.els, p);
    } catch (_) {
      toast('That file is not a Sketchboard board');
    }
    return;
  }
  const t = e.dataTransfer.getData('text/plain');
  if (t) pasteText(t, p);
});
$('#imgfile').addEventListener('change', async e => {
  const files = [...e.target.files];
  e.target.value = '';
  const v = view();
  await addImageFiles(files, ctxAt || { x: (v.w / 2 - cam.x) / cam.z, y: (v.h / 2 - cam.y) / cam.z });
  ctxAt = null;
});

/* ---------- minimap ---------- */
let miniOn = false,
  miniRaf = 0,
  miniT = null;
try {
  miniOn = localStorage.getItem(LS + '.mini') === '1';
} catch (_) {}
function setMini(v) {
  miniOn = v;
  try {
    localStorage.setItem(LS + '.mini', v ? '1' : '0');
  } catch (_) {}
  $('#mini').hidden = !v;
  renderMini();
}
const miniSoon = () => {
  if (miniOn && !miniRaf)
    miniRaf = requestAnimationFrame(() => {
      miniRaf = 0;
      renderMini();
    });
};
function renderMini() {
  const box = $('#mini');
  box.hidden = !miniOn || route === 'home';
  if (box.hidden) return;
  const W = 200,
    H = 132,
    v = view(),
    vw = { x: -cam.x / cam.z, y: -cam.y / cam.z, w: v.w / cam.z, h: v.h / cam.z };
  const b = unionB(els) || vw,
    x0 = Math.min(b.x, vw.x),
    y0 = Math.min(b.y, vw.y),
    x1 = Math.max(b.x + b.w, vw.x + vw.w),
    y1 = Math.max(b.y + b.h, vw.y + vw.h);
  const s = Math.min((W - 16) / (x1 - x0 || 1), (H - 16) / (y1 - y0 || 1)),
    ox = (W - (x1 - x0) * s) / 2 - x0 * s,
    oy = (H - (y1 - y0) * s) / 2 - y0 * s;
  miniT = { s, ox, oy };
  const R = (x, y, w, h) =>
    `x="${r1(x * s + ox)}" y="${r1(y * s + oy)}" width="${r1(Math.max(1, w * s))}" height="${r1(Math.max(1, h * s))}"`;
  let out = '';
  for (const e of drawOrder(els)) {
    if (e.t === 'line') {
      const g = lineGeo(e);
      out += `<line x1="${r1(g.pa.x * s + ox)}" y1="${r1(g.pa.y * s + oy)}" x2="${r1(g.pb.x * s + ox)}" y2="${r1(g.pb.y * s + oy)}" class="ml"/>`;
      continue;
    }
    const f = isFrame(e) ? 'none' : e.t === 'img' ? '#a9b4c2' : e.fill === 'transparent' ? 'none' : e.fill;
    out += `<rect ${R(e.x, e.y, e.w, e.h)} rx="1.5" style="fill:${f}" class="${isFrame(e) ? 'mf' : f === 'none' ? 'mo' : 'me'}"/>`;
  }
  out += `<rect ${R(vw.x, vw.y, vw.w, vw.h)} rx="3" class="mv"/>`;
  $('#minisvg').innerHTML = out;
}
function miniPan(e) {
  if (!miniT) return;
  const r = $('#minisvg').getBoundingClientRect(),
    wx = (e.clientX - r.left - miniT.ox) / miniT.s,
    wy = (e.clientY - r.top - miniT.oy) / miniT.s,
    v = view();
  cam.x = v.w / 2 - wx * cam.z;
  cam.y = v.h / 2 - wy * cam.z;
  renderCam();
  saveCamSoon();
}
$('#minisvg').addEventListener('pointerdown', e => {
  e.preventDefault();
  try {
    e.target.setPointerCapture(e.pointerId);
  } catch (_) {}
  miniPan(e);
  const mv = ev => miniPan(ev),
    up = () => {
      removeEventListener('pointermove', mv);
      removeEventListener('pointerup', up);
    };
  addEventListener('pointermove', mv);
  addEventListener('pointerup', up);
});
