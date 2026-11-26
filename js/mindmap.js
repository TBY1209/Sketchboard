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
      : 'Mind map started. Add branches with the blue + dots, then collapse them with the − button.'
  );
}

/* ---------- on-canvas collapse buttons (drawn in the UI layer) ---------- */
function mindButtons() {
  if (!MIND.size || editing || (op && op.k !== 'pinch')) return '';
  const z = cam.z,
    T = lastPT !== 'mouse';
  let s = '';
  for (const [id, m] of MIND) {
    if (!m.kids.length || HIDDEN.has(id)) continue;
    const e = byId(id);
    if (!e || !(e.cl || sel.has(id) || hoverId === id)) continue;
    const b = bounds(e),
      c = ctr(e);
    let dx = 0,
      dy = 0;
    for (const k of m.kids) {
      const kc = ctr(byId(k));
      dx += kc.x - c.x;
      dy += kc.y - c.y;
    }
    // sit on the edge that faces the branch (east when the branch is centred on the node)
    const R = T ? 15 : 11,
      out = (R * 0.55) / z; // pushed just outside the border so it never covers the label, yet still touches the node
    let px = b.x + b.w + out,
      py = b.y + b.h / 2;
    if (Math.abs(dx) * b.h >= Math.abs(dy) * b.w) {
      if (dx < 0) px = b.x - out;
    } else {
      px = b.x + b.w / 2;
      py = dy < 0 ? b.y - out : b.y + b.h + out;
    }
    if (e.cl) {
      const n = below(id).length,
        label = '+' + n,
        w = Math.max(R * 2, label.length * 8 + 14);
      s += `<g data-cl="${id}" transform="translate(${r1(px)} ${r1(py)}) scale(${1 / z})" style="cursor:pointer"><rect x="${-w / 2 - 4}" y="${-R - 4}" width="${w + 8}" height="${R * 2 + 8}" rx="${R + 4}" fill="transparent"/><rect x="${-w / 2}" y="${-R}" width="${w}" height="${R * 2}" rx="${R}" style="fill:var(--acc);stroke:#1d1b24;stroke-width:1.5px"/><text y="4.5" text-anchor="middle" style="font:800 12.5px Figtree,system-ui,sans-serif;fill:#1d1b24">${label}</text></g>`;
    } else {
      s += `<g data-cl="${id}" transform="translate(${r1(px)} ${r1(py)}) scale(${1 / z})" style="cursor:pointer"><circle r="${R + 5}" fill="transparent"/><circle r="${R}" style="fill:var(--card);stroke:var(--sel);stroke-width:1.5px"/><path d="M-4.5 0H4.5" style="stroke:var(--ink);stroke-width:2px" stroke-linecap="round"/></g>`;
    }
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
