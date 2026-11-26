/* Board operations: snapping, align, move, resize, delete, duplicate, paste, tools. */
const snapSel = () => new Map(selEls().map(e => [e.id, JSON.parse(JSON.stringify(e))]));
function smart(bb, dx, dy) {
  const th = 6 / cam.z;
  let bx = null,
    by = null;
  const X = [0, bb.w / 2, bb.w].map(o => bb.x + dx + o),
    Y = [0, bb.h / 2, bb.h].map(o => bb.y + dy + o);
  for (const e of els) {
    if (sel.has(e.id) || e.t === 'line') continue;
    const o = bounds(e),
      OX = [o.x, o.x + o.w / 2, o.x + o.w],
      OY = [o.y, o.y + o.h / 2, o.y + o.h];
    for (const a of X)
      for (const b of OX) {
        const d = b - a;
        if (Math.abs(d) < th && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, v: b, o };
      }
    for (const a of Y)
      for (const b of OY) {
        const d = b - a;
        if (Math.abs(d) < th && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, v: b, o };
      }
  }
  if (bx) dx += bx.d;
  if (by) dy += by.d;
  guides = [];
  if (bx)
    guides.push([
      bx.v,
      Math.min(bb.y + dy, bx.o.y) - 8,
      bx.v,
      Math.max(bb.y + dy + bb.h, bx.o.y + bx.o.h) + 8
    ]);
  if (by)
    guides.push([
      Math.min(bb.x + dx, by.o.x) - 8,
      by.v,
      Math.max(bb.x + dx + bb.w, by.o.x + by.o.w) + 8,
      by.v
    ]);
  return [dx, dy];
}
const GC = '#10b981';
function symPt(p, skip) {
  const th = (lastPT === 'mouse' ? 9 : 14) / cam.z;
  let bx = null,
    by = null;
  for (const e of els) {
    if (skip.has(e.id) || e.t === 'line') continue;
    const o = bounds(e);
    for (const v of [o.x, o.x + o.w / 2, o.x + o.w]) {
      const d = v - p.x;
      if (Math.abs(d) < th && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, v, o };
    }
    for (const v of [o.y, o.y + o.h / 2, o.y + o.h]) {
      const d = v - p.y;
      if (Math.abs(d) < th && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, v, o };
    }
  }
  const q = { x: bx ? bx.v : p.x, y: by ? by.v : p.y };
  guides = [];
  if (bx) guides.push([bx.v, Math.min(q.y, bx.o.y) - 8, bx.v, Math.max(q.y, bx.o.y + bx.o.h) + 8]);
  if (by) guides.push([Math.min(q.x, by.o.x) - 8, by.v, Math.max(q.x, by.o.x + by.o.w) + 8, by.v]);
  return q;
}
function smartSym(bb, dx, dy) {
  const th = (lastPT === 'mouse' ? 9 : 14) / cam.z,
    nx = bb.x + dx,
    ny = bb.y + dy,
    O = [];
  for (const e of els) {
    if (sel.has(e.id) || e.t === 'line') continue;
    const o = bounds(e);
    O.push({ x: o.x, y: o.y, w: o.w, h: o.h, sh: isShape(e) });
  }
  const X = [nx, nx + bb.w / 2, nx + bb.w],
    Y = [ny, ny + bb.h / 2, ny + bb.h];
  let bx = null,
    by = null;
  for (const o of O) {
    for (const a of X)
      for (const b of [o.x, o.x + o.w / 2, o.x + o.w]) {
        const d = b - a;
        if (Math.abs(d) < th && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, v: b, o };
      }
    for (const a of Y)
      for (const b of [o.y, o.y + o.h / 2, o.y + o.h]) {
        const d = b - a;
        if (Math.abs(d) < th && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, v: b, o };
      }
  }
  const cx = nx + bb.w / 2,
    cy = ny + bb.h / 2,
    near = O.filter(o => o.sh)
      .sort(
        (p, q) =>
          Math.hypot(p.x + p.w / 2 - cx, p.y + p.h / 2 - cy) -
          Math.hypot(q.x + q.w / 2 - cx, q.y + q.h / 2 - cy)
      )
      .slice(0, 24);
  const gap = ax => {
    const k = ax,
      sz = ax === 'x' ? 'w' : 'h',
      c = ax === 'x' ? 'y' : 'x',
      cs = ax === 'x' ? 'h' : 'w',
      n0 = ax === 'x' ? nx : ny,
      bs = bb[sz],
      c0 = ax === 'x' ? ny : nx,
      ccs = bb[cs];
    let best = null;
    const row = near.filter(o => o[c] < c0 + ccs && o[c] + o[cs] > c0);
    for (const A of row)
      for (const B of row) {
        if (A === B || A[k] + A[sz] > B[k]) continue;
        const g = B[k] - (A[k] + A[sz]),
          cand = [
            [B[k] + B[sz] + g, 'r'],
            [A[k] - g - bs, 'l']
          ];
        if (g > bs) cand.push([A[k] + A[sz] + (g - bs) / 2, 'm']);
        for (const [v, kind] of cand) {
          const d = v - n0;
          if (Math.abs(d) < th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, v, A, B, g, kind };
        }
      }
    return best;
  };
  let gx = gap('x'),
    gy = gap('y');
  if (gx && bx && Math.abs(bx.d) < Math.abs(gx.d) - 0.01) gx = null;
  else if (gx) bx = null;
  if (gy && by && Math.abs(by.d) < Math.abs(gy.d) - 0.01) gy = null;
  else if (gy) by = null;
  if (gx) dx += gx.d;
  else if (bx) dx += bx.d;
  if (gy) dy += gy.d;
  else if (by) dy += by.d;
  guides = [];
  const fx = bb.x + dx,
    fy = bb.y + dy;
  if (bx) guides.push([bx.v, Math.min(fy, bx.o.y) - 8, bx.v, Math.max(fy + bb.h, bx.o.y + bx.o.h) + 8]);
  if (by) guides.push([Math.min(fx, by.o.x) - 8, by.v, Math.max(fx + bb.w, by.o.x + by.o.w) + 8, by.v]);
  const seg = (ax, a, b, c) => {
    if (Math.abs(b - a) < 1) return;
    if (ax === 'x') guides.push([a, c, b, c, GC], [a, c - 6, a, c + 6, GC], [b, c - 6, b, c + 6, GC]);
    else guides.push([c, a, c, b, GC], [c - 6, a, c + 6, a, GC], [c - 6, b, c + 6, b, GC]);
  };
  for (const [G, ax] of [
    [gx, 'x'],
    [gy, 'y']
  ]) {
    if (!G) continue;
    const sz = ax === 'x' ? 'w' : 'h',
      k = ax,
      f = ax === 'x' ? fx : fy,
      bs = bb[sz],
      c = ax === 'x' ? fy + bb.h / 2 : fx + bb.w / 2;
    seg(ax, G.A[k] + G.A[sz], G.B[k], c);
    if (G.kind === 'r') seg(ax, G.B[k] + G.B[sz], f, c);
    else if (G.kind === 'l') seg(ax, f + bs, G.A[k], c);
    else {
      seg(ax, G.A[k] + G.A[sz], f, c);
      seg(ax, f + bs, G.B[k], c);
    }
  }
  return [dx, dy];
}
function alignSel(m) {
  const L = selEls().filter(e => e.t !== 'line');
  if (L.length < 2) return;
  const B = L.map(e => [e, bounds(e)]),
    x0 = Math.min(...B.map(([, b]) => b.x)),
    x1 = Math.max(...B.map(([, b]) => b.x + b.w)),
    y0 = Math.min(...B.map(([, b]) => b.y)),
    y1 = Math.max(...B.map(([, b]) => b.y + b.h));
  if ((m === 'dh' || m === 'dv') && L.length < 3) {
    toast('Pick 3 or more to space evenly');
    return;
  }
  begin();
  if (m === 'left') for (const [e, b] of B) e.x += x0 - b.x;
  else if (m === 'right') for (const [e, b] of B) e.x += x1 - (b.x + b.w);
  else if (m === 'center') for (const [e, b] of B) e.x += (x0 + x1) / 2 - (b.x + b.w / 2);
  else if (m === 'top') for (const [e, b] of B) e.y += y0 - b.y;
  else if (m === 'bottom') for (const [e, b] of B) e.y += y1 - (b.y + b.h);
  else if (m === 'middle') for (const [e, b] of B) e.y += (y0 + y1) / 2 - (b.y + b.h / 2);
  else if (m === 'dh' || m === 'dv') {
    const h = m === 'dh',
      k = h ? 'x' : 'y',
      z = h ? 'w' : 'h';
    B.sort((a, b) => a[1][k] - b[1][k]);
    const tot = B.reduce((a, [, b]) => a + b[z], 0),
      gp = ((h ? x1 - x0 : y1 - y0) - tot) / (B.length - 1);
    let cur = h ? x0 : y0;
    for (const [e, b] of B) {
      e[k] += cur - b[k];
      cur += b[z] + gp;
    }
  } else if (m === 'mw' || m === 'mh') {
    const z = m === 'mw' ? 'w' : 'h',
      k = m === 'mw' ? 'x' : 'y',
      S = B.filter(([e]) => isShape(e));
    if (S.length) {
      const t = Math.max(...S.map(([, b]) => b[z]));
      for (const [e, b] of S) {
        e[k] -= (t - b[z]) / 2;
        e[z] = t;
        fitText(e);
      }
    }
  }
  end();
  render();
}
function moveBy(orig, dx, dy) {
  for (const [id, o] of orig) {
    const e = byId(id);
    if (!e) continue;
    if (e.t === 'line') {
      for (const k of ['a', 'b'])
        if (!e[k].id) {
          e[k].x = o[k].x + dx;
          e[k].y = o[k].y + dy;
        }
    } else {
      e.x = o.x + dx;
      e.y = o.y + dy;
    }
  }
}
function resize(p, keep) {
  const bb = op.bb,
    h = op.h,
    q = sym ? symPt(p, new Set(op.orig.keys())) : snapP(p);
  let x0 = bb.x,
    y0 = bb.y,
    x1 = bb.x + bb.w,
    y1 = bb.y + bb.h;
  if (h.includes('w')) x0 = Math.min(q.x, x1 - MIN);
  if (h.includes('e')) x1 = Math.max(q.x, x0 + MIN);
  if (h.includes('n')) y0 = Math.min(q.y, y1 - MIN);
  if (h.includes('s')) y1 = Math.max(q.y, y0 + MIN);
  if (keep && bb.w && bb.h) {
    const ar = bb.w / bb.h;
    let w = x1 - x0,
      hh = y1 - y0;
    if (h.length === 2) {
      if (w / hh > ar) w = hh * ar;
      else hh = w / ar;
    } else if (h === 'e' || h === 'w') hh = w / ar;
    else w = hh * ar;
    if (h.includes('w')) x0 = x1 - w;
    else x1 = x0 + w;
    if (h.includes('n')) y0 = y1 - hh;
    else if (h.includes('s') || (h.length === 1 && (h === 'e' || h === 'w'))) y1 = y0 + hh;
    if (h === 'n' || h === 's') {
      x0 = bb.x + bb.w / 2 - w / 2;
      x1 = x0 + w;
    }
  }
  const sx = (x1 - x0) / (bb.w || 1),
    sy = (y1 - y0) / (bb.h || 1);
  for (const [id, o] of op.orig) {
    const e = byId(id);
    if (!e) continue;
    if (e.t === 'line') {
      for (const k of ['a', 'b'])
        if (!e[k].id) {
          e[k].x = x0 + (o[k].x - bb.x) * sx;
          e[k].y = y0 + (o[k].y - bb.y) * sy;
        }
    } else {
      e.x = x0 + (o.x - bb.x) * sx;
      e.y = y0 + (o.y - bb.y) * sy;
      e.w = Math.max(4, o.w * sx);
      e.h = Math.max(4, o.h * sy);
      if (e.t !== 'pen') e.fs = Math.max(6, Math.min(400, Math.round(o.fs * Math.min(sx, sy) * 2) / 2));
    }
  }
  renderSoon();
}
function freeze(l) {
  const g = lineGeo(l);
  for (const [k, p] of [
    ['a', g.pa],
    ['b', g.pb]
  ])
    l[k] = { ...(l[k].id ? { id: l[k].id } : {}), x: p.x, y: p.y };
}
function del() {
  if (!sel.size) return;
  begin();
  const gone = new Set(sel);
  for (const l of els)
    if (l.t === 'line' && !gone.has(l.id)) {
      const ids = ['a', 'b'].map(k => l[k].id).filter(Boolean);
      if (ids.some(i => gone.has(i)) && !ids.some(i => !gone.has(i) && byId(i))) gone.add(l.id);
    }
  for (const l of els)
    if (l.t === 'line' && !gone.has(l.id))
      for (const k of ['a', 'b'])
        if (l[k].id && gone.has(l[k].id)) {
          const g = lineGeo(l);
          l[k] = { x: k === 'a' ? g.pa.x : g.pb.x, y: k === 'a' ? g.pa.y : g.pb.y };
        }
  els = els.filter(e => !gone.has(e.id));
  sel.clear();
  end();
  render();
}
function cloneIn(list, dx, dy) {
  const map = new Map(list.map(e => [e.id, uid()])),
    gmap = new Map(),
    out = [];
  for (const o of list) {
    const e = JSON.parse(JSON.stringify(o));
    e.id = map.get(o.id);
    delete e.lk;
    if (e.grp) {
      if (!gmap.has(e.grp)) gmap.set(e.grp, uid());
      e.grp = gmap.get(e.grp);
    }
    if (e.t === 'line')
      for (const k of ['a', 'b']) {
        if (e[k].id && map.has(e[k].id)) e[k].id = map.get(e[k].id);
        else {
          delete e[k].id;
          e[k].x += dx;
          e[k].y += dy;
        }
      }
    else {
      e.x += dx;
      e.y += dy;
    }
    out.push(e);
  }
  els.push(...out);
  sel = new Set(out.map(e => e.id));
  return out;
}
const copyList = () =>
  [...moveSet().keys()]
    .map(byId)
    .filter(Boolean)
    .map(e => {
      const c = JSON.parse(JSON.stringify(e));
      if (c.t === 'line') {
        const g = lineGeo(e);
        c.a.x = g.pa.x;
        c.a.y = g.pa.y;
        c.b.x = g.pb.x;
        c.b.y = g.pb.y;
      }
      return c;
    });
function dup() {
  if (!sel.size) return;
  begin();
  cloneIn(copyList(), 24, 24);
  end();
  render();
}
function order(front) {
  if (!sel.size) return;
  begin();
  const a = els.filter(e => sel.has(e.id)),
    b = els.filter(e => !sel.has(e.id));
  els = front ? [...b, ...a] : [...a, ...b];
  end();
  render();
}
function nudge(dx, dy) {
  begin();
  moveBy(moveSet(), dx, dy);
  end();
  render();
}
function pasteEls(list, at) {
  const L = loadEls(list);
  if (!L.length) return;
  begin();
  const b = unionB(L.filter(e => e.t !== 'line')) || unionB(L) || { x: 0, y: 0, w: 0, h: 0 };
  pasteN++;
  const v = view(),
    cx = at ? at.x : (v.w / 2 - cam.x) / cam.z,
    cy = at ? at.y : (v.h / 2 - cam.y) / cam.z,
    jig = at ? 0 : (pasteN % 5) * 16;
  cloneIn(L, cx - (b.x + b.w / 2) + jig, cy - (b.y + b.h / 2) + jig);
  end();
  render();
}
function addText(t, at) {
  begin();
  const e = mk('text', 0, 0, 280, 50);
  e.text = t.slice(0, 5000);
  const ls = wrap(e.text, fontStr(e), 2000);
  e.w = Math.min(520, Math.max(...ls.map(s => ((mctx.font = fontStr(e)), mctx.measureText(s).width))) + 24);
  e.h = 50;
  fitText(e);
  e.x = at.x - e.w / 2;
  e.y = at.y - e.h / 2;
  els.push(e);
  sel = new Set([e.id]);
  end();
  render();
}
function setTool(t) {
  tool = t;
  if (SHAPES.includes(t)) lastShape = t;
  const shapeLike = SHAPES.includes(t) || t === 'frame';
  svg.dataset.tool = shapeLike ? 'shape' : t;
  hoverId = null;
  for (const b of document.querySelectorAll('#tray [data-tool]'))
    b.classList.toggle('on', b.dataset.tool === t || (b.dataset.tool === 'shape' && shapeLike));
  $('#shapeBtn').innerHTML = shapeIcon(t === 'frame' ? 'frame' : lastShape, 24) + '<span class="car"></span>';
  for (const b of document.querySelectorAll('#shapes button'))
    b.classList.toggle('on', b.dataset.s === (t === 'frame' ? 'frame' : lastShape));
  renderUI();
}
function shapeIcon(t, s = 22) {
  if (t === 'frame')
    return `<svg class="ico" viewBox="0 0 24 24" style="width:${s}px;height:${s}px"><path d="M7 3v18M17 3v18M3 7h18M3 17h18"/></svg>`;
  const e = { t, w: 18, h: t === 'star' ? 17 : t === 'cyl' || t === 'sticky' ? 17 : t === 'tri' ? 15 : 13 };
  const d = shapeD(e);
  return `<svg class="ico" viewBox="0 0 24 24" style="width:${s}px;height:${s}px"><path transform="translate(${(24 - e.w) / 2} ${(24 - e.h) / 2})" d="${d}"/>${t === 'cyl' ? `<path transform="translate(3 3.5)" d="${rimD(e)}"/>` : ''}</svg>`;
}
