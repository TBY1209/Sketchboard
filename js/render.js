/* Draws the board (elements) and the selection UI layer into the SVG. */
const dashAttr = e =>
  e.dash === 'dash'
    ? ` stroke-dasharray="${e.sw * 4} ${e.sw * 3}"`
    : e.dash === 'dot'
      ? ` stroke-dasharray="0 ${e.sw * 2.4}" stroke-linecap="round"`
      : '';
const dashArr = e => (e.dash === 'dash' ? [e.sw * 4, e.sw * 3] : e.dash === 'dot' ? [0.01, e.sw * 2.4] : []);
function elSVG(e, x) {
  const id = x ? '' : ` data-id="${e.id}"`,
    op = e.op < 1 ? ` opacity="${e.op}"` : '';
  if (e.t === 'line') {
    const g = lineGeo(e),
      c = col(e.stroke, x);
    let s = `<g${id}${op}>`;
    if (!x) s += `<path d="${g.d}" fill="none" stroke="transparent" stroke-width="${e.sw + 24}"/>`;
    if (e.stroke !== 'transparent') {
      s += `<path d="${g.d}" fill="none" style="stroke:${c};stroke-width:${e.sw}px" stroke-linecap="round" stroke-linejoin="round"${dashAttr(e)}/>`;
      for (const h of g.H)
        s += `<path d="${h.d}" style="${h.f ? `fill:${c};stroke:${c};stroke-width:${e.sw * 0.6}px` : `fill:none;stroke:${c};stroke-width:${e.sw}px`}" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    if (e.text && editing !== e.id)
      s += textSVG(
        e,
        { x: g.mid.x - 110, y: g.mid.y, w: 220, h: 0 },
        tcol(e, x),
        x ? '#ffffff' : 'var(--bg)',
        true
      );
    return s + '</g>';
  }
  let s = `<g${id} transform="translate(${r1(e.x)} ${r1(e.y)})"${op}>`;
  if (e.t === 'frame') {
    const fill = e.fill === 'transparent' ? 'none' : e.fill;
    s += `<rect width="${r1(e.w)}" height="${r1(e.h)}" rx="14" style="fill:${fill};stroke:${x ? '#d6cfbf' : 'var(--frame)'};stroke-width:1.5px" pointer-events="none"/>`;
    if (!x)
      s += `<rect width="${r1(e.w)}" height="${r1(e.h)}" rx="14" fill="none" stroke="transparent" stroke-width="14"/><rect x="0" y="${-FRAME_TITLE.h - 4}" width="${r1(frameTitleW(e))}" height="${FRAME_TITLE.h}" fill="transparent"/>`;
    if (editing !== e.id)
      s += `<text x="4" y="-11" style="font-family:${FONTS.sans};font-size:${FRAME_TITLE.fs}px;font-weight:700;fill:${x ? '#6c6657' : 'var(--muted)'}">${esc(e.text || 'Frame')}</text>`;
    return s + '</g>';
  }
  if (e.t === 'img') {
    const c = x ? null : imgEntry(e.src),
      href = x ? exportImgs[e.src] || '' : c.state === 'ok' ? c.url : '';
    if (href)
      s += `<image href="${href}" width="${r1(e.w)}" height="${r1(e.h)}" preserveAspectRatio="none"/>`;
    else {
      s += `<rect width="${r1(e.w)}" height="${r1(e.h)}" rx="8" style="fill:${x ? '#f1f3f5' : 'var(--hover)'};stroke:${x ? '#ced4da' : 'var(--line)'};stroke-width:1.5px" stroke-dasharray="6 5"/>`;
      if (!x)
        s += `<text x="${r1(e.w / 2)}" y="${r1(e.h / 2 + 5)}" text-anchor="middle" style="font:600 14px Figtree,sans-serif;fill:var(--muted)">${c.state === 'missing' ? 'Image not on this device' : 'Loading image…'}</text>`;
    }
    return s + '</g>';
  }
  if (e.t === 'pen') {
    const d = penD(e);
    if (!x)
      s += `<path d="${d}" fill="none" stroke="transparent" stroke-width="${e.sw + 14}" stroke-linecap="round"/>`;
    return (
      s +
      `<path d="${d}" fill="none" style="stroke:${col(e.stroke, x)};stroke-width:${e.sw}px" stroke-linecap="round" stroke-linejoin="round"${dashAttr(e)}/></g>`
    );
  }
  const st = e.t === 'text' ? 'transparent' : col(e.stroke, x),
    sw = st === 'transparent' ? 0 : e.sw;
  s += `<path d="${shapeD(e)}" style="fill:${e.fill};stroke:${st};stroke-width:${sw}px" stroke-linejoin="round"${sw ? dashAttr(e) : ''}${e.sh && e.fill !== 'transparent' ? ' filter="url(#shadow)"' : ''}/>`;
  if (e.t === 'cyl' && sw)
    s += `<path d="${rimD(e)}" fill="none" style="stroke:${st};stroke-width:${sw}px"${dashAttr(e)}/>`;
  if (e.text && editing !== e.id) s += textSVG(e, tbox(e), tcol(e, x));
  return s + '</g>';
}
let rsRaf = 0;
const renderSoon = () => {
  if (!rsRaf)
    rsRaf = requestAnimationFrame(() => {
      rsRaf = 0;
      render();
    });
};
function render() {
  if (rsRaf) {
    cancelAnimationFrame(rsRaf);
    rsRaf = 0;
  }
  computeMind();
  layer.innerHTML = drawOrder(visible(els))
    .map(e => elSVG(e))
    .join('');
  world.setAttribute('transform', `translate(${r1(cam.x)} ${r1(cam.y)}) scale(${cam.z})`);
  let step = G;
  while (step * cam.z < 14) step *= 2;
  const sz = step * cam.z;
  stage.style.backgroundSize = `${sz}px ${sz}px`;
  stage.style.backgroundPosition = `${cam.x - sz / 2}px ${cam.y - sz / 2}px`;
  $('#zl').textContent = Math.round(cam.z * 100) + '%';
  $('#undoBtn').disabled = !undoS.length;
  $('#redoBtn').disabled = !redoS.length;
  renderUI();
  panel();
  if (editing) edStyle();
  miniSoon();
}
function renderCam() {
  world.setAttribute('transform', `translate(${r1(cam.x)} ${r1(cam.y)}) scale(${cam.z})`);
  let step = G;
  while (step * cam.z < 14) step *= 2;
  const sz = step * cam.z;
  stage.style.backgroundSize = `${sz}px ${sz}px`;
  stage.style.backgroundPosition = `${cam.x - sz / 2}px ${cam.y - sz / 2}px`;
  $('#zl').textContent = Math.round(cam.z * 100) + '%';
  renderUI();
  if (editing) edStyle();
  miniSoon();
}
let raf = 0;
const camSoon = () => {
  if (!raf)
    raf = requestAnimationFrame(() => {
      raf = 0;
      renderCam();
    });
};
function outline(e, w) {
  if (e.t === 'line')
    return `<path d="${lineGeo(e).d}" fill="none" stroke="var(--sel)" stroke-width="${w}"/>`;
  if (e.t === 'pen' || e.t === 'text')
    return `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="none" stroke="var(--sel)" stroke-width="${w}"/>`;
  return `<path transform="translate(${e.x} ${e.y})" d="${shapeD(e)}" fill="none" stroke="var(--sel)" stroke-width="${w}"/>`;
}
function renderUI() {
  const z = cam.z,
    S = selEls(),
    T = lastPT !== 'mouse',
    HH = (T ? 44 : 28) / 2 / z,
    HV = (T ? 14 : 10) / 2 / z;
  let s = '';
  if (hoverId && !sel.has(hoverId)) {
    const h = byId(hoverId);
    if (h) s += outline(h, 2 / z);
  }
  if (hoverLock && !op) {
    const h = byId(hoverLock);
    if (h && h.lk) {
      const b = bounds(h);
      s += `<g transform="translate(${r1(b.x + b.w)} ${r1(b.y)}) scale(${1 / z})" pointer-events="none"><circle r="13" fill="#1d1b24" opacity=".85"/><path d="M-3.5 -1.5v-2.2a3.5 3.5 0 017 0v2.2M-5.5 -1.5h11v7.5h-11z" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/></g>`;
    }
  }
  if (S.length === 1 && S[0].t === 'line') {
    const g = lineGeo(S[0]);
    s += `<path d="${g.d}" fill="none" stroke="var(--sel)" stroke-width="${1.5 / z}" stroke-dasharray="${5 / z} ${4 / z}"/>`;
    if (!editing && S[0].route !== 'straight')
      s += `<g data-h="bend" style="cursor:move"><circle cx="${g.mid.x}" cy="${g.mid.y}" r="${(T ? 24 : 16) / z}" fill="transparent"/><circle cx="${g.mid.x}" cy="${g.mid.y}" r="${(T ? 8 : 6) / z}" fill="var(--sel)" stroke="#fff" stroke-width="${2 / z}"/></g>`;
    if (!editing)
      for (const [k, p] of [
        ['a', g.pa],
        ['b', g.pb]
      ])
        s += `<g data-h="${k}"><circle cx="${p.x}" cy="${p.y}" r="${(T ? 26 : 18) / z}" fill="transparent"/><circle cx="${p.x}" cy="${p.y}" r="${(T ? 8 : 6) / z}" fill="#fff" stroke="var(--sel)" stroke-width="${2 / z}"/></g>`;
  } else if (S.length) {
    const b = selBounds();
    if (S.length > 1) for (const e of S) s += outline(e, 1 / z);
    s += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="var(--sel)" stroke-width="${1.5 / z}"/>`;
    if (!editing && !(op && op.k === 'move')) {
      const small = b.w * z < (T ? 70 : 44) || b.h * z < (T ? 70 : 44);
      for (const [k, fx, fy] of HANDLES) {
        if (small && k.length === 1) continue;
        const x = b.x + b.w * fx,
          y = b.y + b.h * fy;
        s += `<g data-h="${k}"><rect x="${x - HH}" y="${y - HH}" width="${HH * 2}" height="${HH * 2}" fill="transparent"/><rect x="${x - HV}" y="${y - HV}" width="${HV * 2}" height="${HV * 2}" rx="${2.5 / z}" fill="#fff" stroke="var(--sel)" stroke-width="${1.5 / z}"/></g>`;
      }
    }
  }
  if (tool === 'select' && S.length === 1 && isShape(S[0]) && !editing && !op) {
    const e = S[0],
      o = (T ? 40 : 24) / z,
      hr = (T ? 18 : 12) / z,
      vr = (T ? 9 : 7) / z,
      c = ctr(e);
    for (const [k, x, y] of [
      ['c-n', c.x, e.y - o],
      ['c-e', e.x + e.w + o, c.y],
      ['c-s', c.x, e.y + e.h + o],
      ['c-w', e.x - o, c.y]
    ])
      s += `<g data-h="${k}" style="cursor:crosshair"><circle cx="${x}" cy="${y}" r="${hr}" fill="transparent"/><circle cx="${x}" cy="${y}" r="${vr}" fill="var(--sel)"/><path d="M${x - vr * 0.5} ${y}H${x + vr * 0.5}M${x} ${y - vr * 0.5}V${y + vr * 0.5}" stroke="#fff" stroke-width="${1.6 / z}" stroke-linecap="round"/></g>`;
  }
  for (const g of guides)
    s += `<line x1="${g[0]}" y1="${g[1]}" x2="${g[2]}" y2="${g[3]}" stroke="${g[4] || '#f03e3e'}" stroke-width="${(g[4] ? 1.6 : 1) / z}"${g[4] ? ' stroke-linecap="round"' : ` stroke-dasharray="${4 / z} ${3 / z}"`}/>`;
  if (op && op.k === 'marquee') {
    const r = rectFrom(op.start, op.cur);
    s += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="rgba(47,107,255,.08)" stroke="var(--sel)" stroke-width="${1 / z}"/>`;
  }
  if (op && op.k === 'pen')
    s += `<path d="${rawD(op.raw)}" fill="none" opacity="${def.op}" style="stroke:${col(def.stroke)};stroke-width:${def.sw}px" stroke-linecap="round" stroke-linejoin="round"/>`;
  ui.innerHTML = s + mindButtons();
  sbarUpdate();
}
