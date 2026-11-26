/* Undo/redo, saving, and validation of loaded data (clean/loadEls). */
const begin = () => {
  if (before === null) before = JSON.stringify(els);
};
function end() {
  if (before === null) return;
  const now = JSON.stringify(els);
  if (now !== before) {
    undoS.push(before);
    let tot = 0;
    for (const x of undoS) tot += x.length;
    while (undoS.length > 1 && (undoS.length > 120 || tot > 12e6)) tot -= undoS.shift().length;
    redoS = [];
    save();
  }
  before = null;
}
function undo() {
  commitEdit();
  if (!undoS.length) return;
  redoS.push(JSON.stringify(els));
  els = JSON.parse(undoS.pop());
  prune();
  render();
  save();
}
function redo() {
  commitEdit();
  if (!redoS.length) return;
  undoS.push(JSON.stringify(els));
  els = JSON.parse(redoS.pop());
  prune();
  render();
  save();
}
const prune = () => {
  for (const id of [...sel]) if (!byId(id)) sel.delete(id);
};
const status = t => {
  $('#status').textContent = t;
};
let saveT = 0;
const saveNow = () => {
  clearTimeout(saveT);
  saveT = 0;
  return writeBoard(false);
};
const flushIfPending = () => {
  if (saveT) saveNow();
};
addEventListener('pagehide', flushIfPending);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushIfPending();
});
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(saveNow, 350);
  emptyHint();
}
const saveCam = () => saveMetaOnly();
const okC = c => typeof c === 'string' && /^(#[0-9a-fA-F]{3,8}|transparent|ink)$/.test(c);
const num = (v, d) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : d);
const okId = v => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);
function clean(o) {
  if (!o || !TYPES.has(o.t)) return null;
  const e = {
    id: okId(o.id) ? o.id : uid(),
    t: o.t,
    fill: okC(o.fill) ? o.fill : 'transparent',
    stroke: okC(o.stroke) ? o.stroke : 'ink',
    sw: Math.min(24, Math.max(0, num(o.sw, 2))),
    dash: ['solid', 'dash', 'dot'].includes(o.dash) ? o.dash : 'solid',
    font: FONTS[o.font] ? o.font : 'hand',
    fs: Math.min(200, Math.max(6, num(o.fs, 20))),
    op: Math.min(1, Math.max(0.05, num(o.op, 1))),
    text: typeof o.text === 'string' ? o.text.slice(0, 5000) : ''
  };
  e.tc = o.tc !== 'auto' && okC(o.tc) && o.tc !== 'transparent' ? o.tc : 'auto';
  e.bold = !!o.bold;
  e.it = !!o.it;
  e.ta = ['left', 'center', 'right'].includes(o.ta) ? o.ta : 'center';
  e.va = ['top', 'middle', 'bottom'].includes(o.va) ? o.va : 'middle';
  e.rad = Math.min(999, Math.max(0, num(o.rad, o.t === 'round' ? 18 : o.t === 'sticky' ? 4 : 0)));
  e.sh = o.sh === undefined ? o.t === 'sticky' : !!o.sh;
  if (okId(o.grp)) e.grp = o.grp;
  if (o.lk === true) e.lk = true;
  if (o.t === 'img') {
    if (!okHash(o.src)) return null;
    e.src = o.src;
  }
  if (o.t === 'line') {
    const pt = p =>
      Object.assign(p && okId(p.id) ? { id: p.id } : {}, { x: num(p && p.x, 0), y: num(p && p.y, 0) });
    e.a = pt(o.a);
    e.b = pt(o.b);
    e.route = ['straight', 'elbow', 'rounded', 'curve'].includes(o.route) ? o.route : 'curve';
    e.head = ['none', 'end', 'both'].includes(o.head) ? o.head : 'end';
    e.hk = ['tri', 'open', 'dot', 'dia'].includes(o.hk) ? o.hk : 'tri';
    e.k = Math.min(0.9, Math.max(0.1, num(o.k, 0.5)));
  } else {
    e.x = num(o.x, 0);
    e.y = num(o.y, 0);
    e.w = Math.max(1, num(o.w, 100));
    e.h = Math.max(1, num(o.h, 100));
    if (o.t === 'pen') {
      e.pts = (Array.isArray(o.pts) ? o.pts : [])
        .filter(Array.isArray)
        .slice(0, 6000)
        .map(q => [num(q[0], 0), num(q[1], 0)]);
      if (!e.pts.length) e.pts = [[0, 0]];
    }
  }
  return e;
}
function loadEls(arr) {
  const out = (Array.isArray(arr) ? arr : []).slice(0, 5000).map(clean).filter(Boolean),
    ids = new Set();
  for (const e of out) {
    if (ids.has(e.id)) e.id = uid();
    ids.add(e.id);
  }
  for (const e of out)
    if (e.t === 'line') for (const k of ['a', 'b']) if (e[k].id && !ids.has(e[k].id)) delete e[k].id;
  return out;
}
