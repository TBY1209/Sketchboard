/* Shape outlines, connector routing, bounds and hit tests. */
const poly = p => 'M' + p.map(q => r1(q[0]) + ' ' + r1(q[1])).join('L') + 'Z';
const rr = (w, h, r) =>
  `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
const cylR = e => Math.min(e.h * 0.15, e.w * 0.25, 24);
function starPts(w, h) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      r = i % 2 ? 0.42 : 1;
    p.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const xs = p.map(q => q[0]),
    ys = p.map(q => q[1]),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  return p.map(q => [((q[0] - x0) / (x1 - x0)) * w, ((q[1] - y0) / (y1 - y0)) * h]);
}
function shapeD(e) {
  const w = e.w,
    h = e.h;
  switch (e.t) {
    case 'ellipse':
      return `M0 ${h / 2}A${w / 2} ${h / 2} 0 1 1 ${w} ${h / 2}A${w / 2} ${h / 2} 0 1 1 0 ${h / 2}Z`;
    case 'round':
      return rr(w, h, Math.min(e.rad ?? 18, w / 2, h / 2));
    case 'sticky':
      return rr(w, h, Math.min(e.rad ?? 4, w / 2, h / 2));
    case 'diamond':
      return poly([
        [w / 2, 0],
        [w, h / 2],
        [w / 2, h],
        [0, h / 2]
      ]);
    case 'tri':
      return poly([
        [w / 2, 0],
        [w, h],
        [0, h]
      ]);
    case 'hex':
      return poly([
        [w * 0.25, 0],
        [w * 0.75, 0],
        [w, h / 2],
        [w * 0.75, h],
        [w * 0.25, h],
        [0, h / 2]
      ]);
    case 'para':
      return poly([
        [w * 0.2, 0],
        [w, 0],
        [w * 0.8, h],
        [0, h]
      ]);
    case 'star':
      return poly(starPts(w, h));
    case 'arrowR':
      return poly([
        [0, h * 0.25],
        [w * 0.62, h * 0.25],
        [w * 0.62, 0],
        [w, h / 2],
        [w * 0.62, h],
        [w * 0.62, h * 0.75],
        [0, h * 0.75]
      ]);
    case 'speech': {
      const hb = h * 0.8,
        r = Math.min(14, w / 5, hb / 3);
      return `M${r} 0H${w - r}Q${w} 0 ${w} ${r}V${hb - r}Q${w} ${hb} ${w - r} ${hb}H${w * 0.42}L${w * 0.18} ${h}L${w * 0.24} ${hb}H${r}Q0 ${hb} 0 ${hb - r}V${r}Q0 0 ${r} 0Z`;
    }
    case 'cyl': {
      const ry = cylR(e);
      return `M0 ${ry}A${w / 2} ${ry} 0 0 1 ${w} ${ry}V${h - ry}A${w / 2} ${ry} 0 0 1 0 ${h - ry}Z`;
    }
    default:
      return e.rad > 0 ? rr(w, h, Math.min(e.rad, w / 2, h / 2)) : `M0 0H${w}V${h}H0Z`;
  }
}
const rimD = e => {
  const ry = cylR(e);
  return `M0 ${ry}A${e.w / 2} ${ry} 0 0 0 ${e.w} ${ry}`;
};
function tbox(e) {
  const w = e.w,
    h = e.h,
    P = e.t === 'text' ? 4 : 10;
  let a = 0,
    b = 0,
    c = 1,
    d = 1;
  switch (e.t) {
    case 'ellipse':
      a = b = 0.15;
      c = d = 0.85;
      break;
    case 'diamond':
      a = b = 0.22;
      c = d = 0.78;
      break;
    case 'tri':
      a = 0.22;
      b = 0.42;
      c = 0.78;
      d = 0.96;
      break;
    case 'hex':
      a = 0.14;
      c = 0.86;
      break;
    case 'star':
      a = 0.3;
      b = 0.36;
      c = 0.7;
      d = 0.76;
      break;
    case 'para':
      a = 0.17;
      c = 0.83;
      break;
    case 'arrowR':
      b = 0.25;
      c = 0.82;
      d = 0.75;
      break;
    case 'speech':
      d = 0.8;
      break;
    case 'cyl': {
      const ry = cylR(e);
      return { x: P, y: ry * 2 + 4, w: Math.max(4, w - 2 * P), h: Math.max(4, h - ry * 3 - 8) };
    }
  }
  return {
    x: a * w + P,
    y: b * h + P,
    w: Math.max(4, (c - a) * w - 2 * P),
    h: Math.max(4, (d - b) * h - 2 * P)
  };
}
const penC = new WeakMap();
function penD(e) {
  const c = penC.get(e.pts);
  if (c && c.w === e.w && c.h === e.h) return c.d;
  const d = penD0(e);
  penC.set(e.pts, { w: e.w, h: e.h, d });
  return d;
}
function penD0(e) {
  const p = e.pts.map(q => [q[0] * e.w, q[1] * e.h]);
  let d = `M${r1(p[0][0])} ${r1(p[0][1])}`;
  if (p.length < 2) return d + 'l.1 0';
  for (let i = 1; i < p.length - 1; i++)
    d += `Q${r1(p[i][0])} ${r1(p[i][1])} ${r1((p[i][0] + p[i + 1][0]) / 2)} ${r1((p[i][1] + p[i + 1][1]) / 2)}`;
  const l = p[p.length - 1];
  return d + `L${r1(l[0])} ${r1(l[1])}`;
}
const rawD = pts => (pts.length ? 'M' + pts.map(q => r1(q[0]) + ' ' + r1(q[1])).join('L') : '');
function edgePt(s, t) {
  const c = ctr(s),
    rx = s.w / 2,
    ry = s.h / 2,
    dx = t.x - c.x,
    dy = t.y - c.y;
  if (!dx && !dy) return c;
  let k;
  if (s.t === 'ellipse') k = 1 / Math.hypot(dx / rx, dy / ry);
  else if (s.t === 'diamond') k = 1 / (Math.abs(dx) / rx + Math.abs(dy) / ry);
  else k = 1 / Math.max(Math.abs(dx) / rx, Math.abs(dy) / ry);
  const u = nrm(dx, dy);
  return { x: c.x + dx * k + u.x * 6, y: c.y + dy * k + u.y * 6 };
}
const sidePt = (s, hz, sg) => {
  const c = ctr(s);
  return hz ? { x: c.x + sg * (s.w / 2 + 6), y: c.y } : { x: c.x, y: c.y + sg * (s.h / 2 + 6) };
};
const rpath = (P, r) => {
  let d = `M${f(P[0])}`;
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1],
      b = P[i],
      c = P[i + 1],
      la = Math.hypot(b.x - a.x, b.y - a.y),
      lc = Math.hypot(c.x - b.x, c.y - b.y),
      k = Math.min(r, la / 2, lc / 2);
    if (k < 0.5) {
      d += `L${f(b)}`;
      continue;
    }
    const u1 = nrm(a.x - b.x, a.y - b.y),
      u2 = nrm(c.x - b.x, c.y - b.y);
    d += `L${r1(b.x + u1.x * k)} ${r1(b.y + u1.y * k)}Q${f(b)} ${r1(b.x + u2.x * k)} ${r1(b.y + u2.y * k)}`;
  }
  return d + `L${f(P[P.length - 1])}`;
};
function lineGeo(l) {
  let A = byId(l.a.id),
    B = byId(l.b.id);
  if (!isShape(A)) A = null;
  if (!isShape(B)) B = null;
  const ra = A ? ctr(A) : l.a,
    rb = B ? ctr(B) : l.b,
    hz = Math.abs(rb.x - ra.x) >= Math.abs(rb.y - ra.y),
    K = Math.min(0.9, Math.max(0.1, num(l.k, 0.5))),
    str = l.route === 'straight';
  let pa, pb;
  if (str) {
    pa = A ? edgePt(A, rb) : { x: l.a.x, y: l.a.y };
    pb = B ? edgePt(B, ra) : { x: l.b.x, y: l.b.y };
  } else {
    const s = hz ? Math.sign(rb.x - ra.x) || 1 : Math.sign(rb.y - ra.y) || 1;
    pa = A ? sidePt(A, hz, s) : { x: l.a.x, y: l.a.y };
    pb = B ? sidePt(B, hz, -s) : { x: l.b.x, y: l.b.y };
  }
  const mx = hz ? pa.x + (pb.x - pa.x) * K : (pa.x + pb.x) / 2,
    my = hz ? (pa.y + pb.y) / 2 : pa.y + (pb.y - pa.y) * K;
  let ua, ub;
  if (str) {
    ub = nrm(pb.x - pa.x, pb.y - pa.y);
    ua = { x: -ub.x, y: -ub.y };
  } else if (hz) {
    ub = nrm(pb.x - mx, 0);
    ua = nrm(pa.x - mx, 0);
  } else {
    ub = nrm(0, pb.y - my);
    ua = nrm(0, pa.y - my);
  }
  if (!ub.x && !ub.y) {
    ub = nrm(pb.x - pa.x, pb.y - pa.y);
    ua = { x: -ub.x, y: -ub.y };
  }
  const hs = Math.max(10, l.sw * 3 + 7),
    hk = ['tri', 'open', 'dot', 'dia'].includes(l.hk) ? l.hk : 'tri',
    bk = hk === 'tri' ? 0.6 : hk === 'open' ? 0 : hk === 'dot' ? 0.4 : 1;
  const e1 = l.head === 'both' ? { x: pa.x - ua.x * hs * bk, y: pa.y - ua.y * hs * bk } : pa,
    e2 = l.head !== 'none' ? { x: pb.x - ub.x * hs * bk, y: pb.y - ub.y * hs * bk } : pb;
  let d;
  if (str) d = `M${f(e1)}L${f(e2)}`;
  else {
    const P = hz
      ? [e1, { x: mx, y: e1.y }, { x: mx, y: e2.y }, e2]
      : [e1, { x: e1.x, y: my }, { x: e2.x, y: my }, e2];
    if (l.route === 'elbow') d = `M${f(P[0])}L${f(P[1])}L${f(P[2])}L${f(P[3])}`;
    else if (l.route === 'rounded') d = rpath(P, 16);
    else
      d = hz
        ? `M${f(e1)}C${r1(mx)} ${r1(e1.y)} ${r1(mx)} ${r1(e2.y)} ${f(e2)}`
        : `M${f(e1)}C${r1(e1.x)} ${r1(my)} ${r1(e2.x)} ${r1(my)} ${f(e2)}`;
  }
  const head = (p, u) => {
    const n = { x: -u.y, y: u.x },
      at = (a, w) => `${r1(p.x - u.x * a + n.x * w)} ${r1(p.y - u.y * a + n.y * w)}`;
    if (hk === 'open') return { d: `M${at(hs * 0.9, hs * 0.5)}L${f(p)}L${at(hs * 0.9, -hs * 0.5)}`, f: 0 };
    if (hk === 'dot') {
      const r = hs * 0.4,
        c = { x: p.x - u.x * r, y: p.y - u.y * r };
      return {
        d: `M${r1(c.x - r)} ${r1(c.y)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(r * 2)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-r * 2)} 0Z`,
        f: 1
      };
    }
    if (hk === 'dia')
      return { d: `M${f(p)}L${at(hs * 0.5, hs * 0.4)}L${at(hs, 0)}L${at(hs * 0.5, -hs * 0.4)}Z`, f: 1 };
    return { d: `M${f(p)}L${at(hs, hs * 0.5)}L${at(hs, -hs * 0.5)}Z`, f: 1 };
  };
  const H = [];
  if (l.head !== 'none') H.push(head(pb, ub));
  if (l.head === 'both') H.push(head(pa, ua));
  return { d, H, mid: { x: mx, y: my }, pa, pb, hz };
}
function bounds(e) {
  if (e.t !== 'line') return { x: e.x, y: e.y, w: e.w, h: e.h };
  const g = lineGeo(e),
    xs = [g.pa.x, g.pb.x, g.mid.x],
    ys = [g.pa.y, g.pb.y, g.mid.y],
    x = Math.min(...xs),
    y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
function unionB(list) {
  if (!list.length) return null;
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const e of list) {
    const b = bounds(e);
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const selEls = () => [...sel].map(byId).filter(Boolean);
const selBounds = () => unionB(selEls());
const hit = (a, b) => a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
const rectFrom = (a, b) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x),
  h: Math.abs(a.y - b.y)
});
function shapeAt(p, skip, mm) {
  const m = (mm || 4) / cam.z;
  for (let i = els.length - 1; i >= 0; i--) {
    const e = els[i];
    if (!isShape(e) || e.id === skip) continue;
    if (p.x >= e.x - m && p.x <= e.x + e.w + m && p.y >= e.y - m && p.y <= e.y + e.h + m) return e;
  }
  return null;
}
const snapV = v => (snap ? Math.round(v / G) * G : v),
  snapP = p => ({ x: snapV(p.x), y: snapV(p.y) });
