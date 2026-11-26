/* Mind maps: a tree in the connector graph, with collapsible branches.
   - A shape marked `mm: true` is a mind-map ROOT. Everything reachable from it along connectors
     (line.a.id -> line.b.id, parent to child) belongs to that map.
   - `cl: true` on a node in a map means its branch is collapsed: the nodes below it and their
     connectors are hidden (HIDDEN) but still exist, so moving, copying and deleting the node
     carries the whole branch with it.
   MIND/HIDDEN are recomputed on every render() by computeMind(). */
let MIND = new Map(); // node id -> {depth, branch, parent, root, kids: [ids]}

Object.assign(ICON, {
  mindmap:
    '<circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="5.5" r="2.2"/><circle cx="18" cy="12" r="2.2"/><circle cx="18" cy="18.5" r="2.2"/><path d="M8.6 12h7.2M8.2 10.6C11 8 13 6.4 15.8 5.8M8.2 13.4C11 16 13 17.6 15.8 18.2"/>',
  collapse: '<path d="M8 4.5l4 4 4-4M8 19.5l4-4 4 4"/>',
  expand: '<path d="M8 8.5l4-4 4 4M8 15.5l4 4 4-4"/>'
});

/* children come from connectors, in drawing order; each node is claimed by the first tree that reaches it */
function computeMind() {
  MIND = new Map();
  HIDDEN = new Set();
  if (!els.some(e => e.mm)) return;
  const nodes = new Map(),
    out = new Map();
  for (const e of els) if (e.t !== 'line') nodes.set(e.id, e);
  for (const l of els) {
    if (l.t !== 'line' || !l.a.id || !l.b.id || l.a.id === l.b.id) continue;
    if (!nodes.has(l.a.id) || !nodes.has(l.b.id)) continue;
    if (!out.has(l.a.id)) out.set(l.a.id, []);
    out.get(l.a.id).push(l.b.id);
  }
  for (const r of els) {
    if (!r.mm || r.t === 'line' || MIND.has(r.id)) continue;
    MIND.set(r.id, { depth: 0, branch: r.id, parent: null, root: r.id, kids: [] });
    const q = [r.id];
    while (q.length) {
      const id = q.shift(),
        info = MIND.get(id);
      for (const c of out.get(id) || []) {
        if (MIND.has(c)) continue; // cycle, or already part of another map
        MIND.set(c, {
          depth: info.depth + 1,
          branch: info.depth === 0 ? c : info.branch,
          parent: id,
          root: info.root,
          kids: []
        });
        info.kids.push(c);
        q.push(c);
      }
    }
  }
  for (const [id] of MIND) if (nodes.get(id).cl) for (const d of below(id)) HIDDEN.add(d);
  if (HIDDEN.size) {
    for (const l of els)
      if (l.t === 'line' && ((l.a.id && HIDDEN.has(l.a.id)) || (l.b.id && HIDDEN.has(l.b.id))))
        HIDDEN.add(l.id);
    for (const id of [...sel]) if (HIDDEN.has(id)) sel.delete(id);
  }
}
/* every node below `id` in its map (not including `id`) */
function below(id) {
  const out = [],
    stack = [...(MIND.get(id) || { kids: [] }).kids];
  while (stack.length) {
    const c = stack.pop();
    out.push(c);
    stack.push(...MIND.get(c).kids);
  }
  return out;
}
/* the branch under a collapsed node as elements: its nodes plus every connector between them and `id` */
function branchElements(id) {
  const ids = new Set([id, ...below(id)]),
    out = [];
  for (const e of els) {
    if (e.id !== id && ids.has(e.id)) out.push(e);
    else if (e.t === 'line' && e.a.id && e.b.id && ids.has(e.a.id) && ids.has(e.b.id)) out.push(e);
  }
  return out;
}
const visible = list => (HIDDEN.size ? list.filter(e => !HIDDEN.has(e.id)) : list);
const oneSel = () => (sel.size === 1 ? byId([...sel][0]) : null);
const mindEligible = e => !!e && isShape(e) && e.t !== 'img';
const canCollapse = () => {
  const e = oneSel(),
    m = e && MIND.get(e.id);
  return !!m && m.kids.length > 0;
};

/* ---------- actions ---------- */
function toggleCollapse(id) {
  const e = byId(id),
    m = MIND.get(id);
  if (!e || !m || !m.kids.length) return;
  begin();
  if (e.cl) delete e.cl;
  else e.cl = true;
  end();
  render();
}
function toggleMindRoot() {
  const e = oneSel();
  if (!mindEligible(e)) return;
  const was = !!e.mm,
    group = MIND.has(e.id) ? [e.id, ...below(e.id)] : [e.id];
  begin();
  if (was) {
    delete e.mm;
    for (const id of group) {
      const n = byId(id);
      if (n) delete n.cl; // nothing stays hidden once the map is gone
    }
  } else e.mm = true;
  end();
  render();
  toast(
    was
      ? 'Mind map removed — everything is visible again'
      : 'Mind map started. Add branches with the blue + dots, and fold them with the small arrow beside a node.'
  );
}

/* ---------- on-canvas fold arrow (drawn in the UI layer) ---------- */
/* Which side of a node faces its branch: 'e' | 'w' | 'n' | 's' (east when the branch is centred, e.g. the root). */
function mindSide(id) {
  const m = MIND.get(id),
    e = byId(id);
  if (!m || !m.kids.length || !e) return null;
  const c = ctr(e);
  let dx = 0,
    dy = 0;
  for (const k of m.kids) {
    const kc = ctr(byId(k));
    dx += kc.x - c.x;
    dy += kc.y - c.y;
  }
  if (Math.abs(dx) * e.h >= Math.abs(dy) * e.w) return dx < 0 ? 'w' : 'e';
  return dy < 0 ? 'n' : 's';
}
/* unit vector out of the node, the rotation of a "›" drawn pointing east, and the opposite side */
const SIDES = {
  e: { ux: 1, uy: 0, rot: 0, opp: 'w' },
  s: { ux: 0, uy: 1, rot: 90, opp: 'n' },
  w: { ux: -1, uy: 0, rot: 180, opp: 'e' },
  n: { ux: 0, uy: -1, rot: 270, opp: 's' }
};
/* Folded: the arrow points out, toward where the branch will appear (press to expand).
   Expanded: it points back at the node (press to retract). A folded node also shows how many items are hidden. */
function mindButtons() {
  if (!MIND.size || editing || (op && op.k !== 'pinch')) return '';
  const z = cam.z,
    T = lastPT !== 'mouse',
    gap = 16, // screen px between the border and the arrow's centre
    hit = T ? 22 : 17,
    chevron = 'M-3.5 -7L3.5 0L-3.5 7';
  let s = '';
  for (const [id, m] of MIND) {
    if (!m.kids.length || HIDDEN.has(id)) continue;
    const e = byId(id),
      side = mindSide(id);
    if (!e || !side) continue;
    const S = SIDES[side],
      point = e.cl ? side : S.opp,
      lit = e.cl || sel.has(id) || hoverId === id,
      ex = side === 'e' ? e.x + e.w : side === 'w' ? e.x : e.x + e.w / 2,
      ey = side === 'n' ? e.y : side === 's' ? e.y + e.h : e.y + e.h / 2,
      px = ex + (S.ux * gap) / z,
      py = ey + (S.uy * gap) / z;
    let g = `<g data-cl="${id}" data-side="${side}" data-point="${point}" transform="translate(${r1(px)} ${r1(py)}) scale(${1 / z})" style="cursor:pointer;opacity:${lit ? 1 : 0.8}"><circle r="${hit}" fill="transparent"/>`;
    if (e.cl) {
      // the count sits just beyond the arrow; the extra hit area keeps it clickable too
      const n = below(id).length,
        tx = side === 'e' ? 12 : side === 'w' ? -12 : 0,
        ty = side === 'n' ? -11 : side === 's' ? 22 : 4.5,
        anchor = side === 'e' ? 'start' : side === 'w' ? 'end' : 'middle';
      g += `<circle cx="${S.ux * 18}" cy="${S.uy * 18}" r="${T ? 16 : 12}" fill="transparent"/><text x="${tx}" y="${ty}" text-anchor="${anchor}" style="font:800 12px Figtree,system-ui,sans-serif;fill:var(--ink);stroke:var(--bg);stroke-width:3.5px;paint-order:stroke;stroke-linejoin:round">${n}</text>`;
    }
    g += `<circle r="10.5" style="fill:var(--bg)"/><g transform="rotate(${SIDES[point].rot})"><path d="${chevron}" fill="none" style="stroke:var(--bg);stroke-width:8px" stroke-linecap="round" stroke-linejoin="round"/><path d="${chevron}" fill="none" style="stroke:var(--ink);stroke-width:2.8px" stroke-linecap="round" stroke-linejoin="round"/></g></g>`;
    s += g;
  }
  return s;
}

/* ---------- new branches are styled by depth ---------- */
const MIND_FS = [26, 20, 16, 14]; // root, level 1, level 2, level 3+
const MIND_SIZE = [null, [180, 80], [150, 60], [130, 50]];
const MIND_COLORS = ['#d0ebff', '#d3f9d8', '#ffc9c9', '#e5dbff', '#c5f6fa', '#ffd8a8', '#fcc2d7', '#fff3a6'];
/* `n` is a fresh copy of its parent `src`. Inside a mind map it becomes a smaller child: level 1 takes the next
   unused colour, deeper levels keep their branch's colour. Outside a mind map nothing changes. */
function styleMindChild(n, src) {
  const m = MIND.get(src.id);
  if (!m) return;
  const depth = m.depth + 1,
    lvl = Math.min(depth, 3);
  n.fs = MIND_FS[lvl];
  n.bold = false;
  n.sw = Math.min(n.sw, 2);
  if (n.t === 'ellipse' || n.t === 'diamond' || n.t === 'star' || n.t === 'tri' || n.t === 'hex')
    n.t = 'round';
  if (n.t === 'round') n.rad = 18;
  const [w, h] = MIND_SIZE[lvl];
  n.w = w;
  n.h = h;
  if (depth === 1) {
    const used = new Set(m.kids.map(k => (byId(k) || {}).fill));
    n.fill = MIND_COLORS.find(c => !used.has(c)) || MIND_COLORS[m.kids.length % MIND_COLORS.length];
  } else {
    const branch = byId(m.branch);
    if (branch) n.fill = branch.fill;
  }
}
