/* Mouse, pen and touch input on the canvas. */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  midp = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
function cancelOp() {
  if (op && op.k === 'tpan') clearTimeout(op.t);
  if (before !== null) {
    els = JSON.parse(before);
    before = null;
  }
  op = null;
  guides = [];
  prune();
  render();
}
svg.addEventListener('mousedown', e => e.preventDefault());
svg.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (editing) commitEdit();
  closePops();
  if (e.button === 2) return; // right-click: the context menu handles it
  try {
    svg.setPointerCapture(e.pointerId);
  } catch (_) {}
  if (e.pointerType === 'touch' && e.isPrimary) {
    ptrs.clear();
    if (op && op.k === 'pinch') op = null;
  }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) {
    if (op && op.t) clearTimeout(op.t);
    cancelOp();
    const [a, b] = [...ptrs.values()];
    op = { k: 'pinch', d: dist(a, b) || 1, m: midp(a, b) };
    return;
  }
  if (ptrs.size > 2) return;
  const p = toW(e);
  lastW = p;
  if (lastPT !== e.pointerType) {
    lastPT = e.pointerType;
    renderUI();
  }
  if (e.button === 1 || spaceDown || tool === 'hand') {
    op = { k: 'pan', sx: e.clientX, sy: e.clientY, cam: { ...cam } };
    svg.classList.add('pan');
    return;
  }
  if (e.button === 2) return;
  const tEl = e.target.closest('[data-id]');
  let tid = tEl ? tEl.dataset.id : null;
  if (tid && !byId(tid)) tid = null;
  let lockedId = null;
  if (tid && byId(tid).lk) {
    lockedId = tid;
    tid = null;
  }
  const now = performance.now();
  if (
    tool === 'select' &&
    e.pointerType === 'mouse' &&
    now - lastTap.t < 450 &&
    Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < (e.pointerType === 'touch' ? 30 : 14) &&
    (lastTap.id === tid || e.pointerType !== 'mouse')
  ) {
    lastTap = { t: 0 };
    if (lockedId) return;
    if (tid) {
      startEdit(tid);
      openPanel('text');
    } else addTextEdit(p);
    return;
  }
  lastTap = { t: now, x: e.clientX, y: e.clientY, id: tid };
  if (tool === 'select') {
    const h = sel.size ? e.target.closest('[data-h]') : null;
    if (h) {
      begin();
      const k = h.dataset.h;
      if (k.startsWith('c-')) {
        const src = byId([...sel][0]),
          l = mkLine({ id: src.id, x: p.x, y: p.y }, { x: p.x, y: p.y });
        els.push(l);
        op = {
          k: 'end',
          which: 'b',
          id: l.id,
          isNew: true,
          dot: k.slice(2),
          src: src.id,
          sx: e.clientX,
          sy: e.clientY,
          p
        };
        render();
        return;
      }
      if (k === 'bend') op = { k: 'bend', id: [...sel][0] };
      else if (k === 'a' || k === 'b')
        op = { k: 'end', which: k, id: [...sel][0], sx: e.clientX, sy: e.clientY };
      else op = { k: 'resize', h: k, bb: selBounds(), orig: snapSel() };
      return;
    }
    if (tid) {
      const sh = e.shiftKey || multi,
        was = sel.size === 1 && sel.has(tid);
      const ids = e.ctrlKey || e.metaKey ? [tid] : groupOf(tid);
      if (sh) {
        if (sel.has(tid)) {
          for (const i of ids) sel.delete(i);
          render();
          return;
        }
        for (const i of ids) sel.add(i);
      } else if (!sel.has(tid)) sel = new Set(ids);
      begin();
      if (e.altKey) cloneIn(copyList(), 0, 0);
      op = {
        k: 'move',
        start: p,
        orig: moveSet(),
        bb: selBounds(),
        moved: false,
        touch: e.pointerType !== 'mouse',
        tapEdit: was && e.pointerType !== 'mouse' && !sh,
        id: tid
      };
      if (e.pointerType !== 'mouse') {
        // long-press opens the context menu
        const o = op,
          cx = e.clientX,
          cy = e.clientY;
        o.lp = setTimeout(() => {
          if (op !== o || o.moved) return;
          op = null;
          end();
          window._lpT = performance.now();
          try {
            navigator.vibrate && navigator.vibrate(12);
          } catch (_) {}
          render();
          openCtx(cx, cy, 'sel');
        }, 520);
      }
      render();
      return;
    }
    if (e.pointerType === 'touch' && !multi) {
      sel.clear();
      const o = { k: 'tpan', sx: e.clientX, sy: e.clientY, cam: { ...cam }, moved: false };
      o.t = setTimeout(() => {
        if (op === o && !o.moved) {
          if (lockedId) {
            op = null;
            window._lpT = performance.now();
            openCtx(o.sx, o.sy, 'locked', lockedId);
            return;
          }
          op = { k: 'marquee', start: p, cur: p, base: new Set() };
          try {
            navigator.vibrate && navigator.vibrate(12);
          } catch (_) {}
          renderUI();
        }
      }, 450);
      op = o;
      render();
      return;
    }
    if (!e.shiftKey && !multi) sel.clear();
    op = { k: 'marquee', start: p, cur: p, base: new Set(sel) };
    render();
    return;
  }
  if (SHAPES.includes(tool) || tool === 'sticky' || tool === 'text' || tool === 'frame') {
    begin();
    const q = sym ? symPt(p, new Set()) : snapP(p),
      n = mk(tool, q.x, q.y, 0, 0);
    els.push(n);
    sel = new Set([n.id]);
    op = { k: 'create', id: n.id, start: q, sx: e.clientX, sy: e.clientY };
    render();
    return;
  }
  if (tool === 'line') {
    begin();
    const s = shapeAt(p, null, lastPT === 'mouse' ? 16 : 28),
      q = snapP(p),
      l = mkLine(s ? { id: s.id, x: q.x, y: q.y } : { x: q.x, y: q.y }, { x: q.x, y: q.y });
    els.push(l);
    sel = new Set([l.id]);
    op = { k: 'end', which: 'b', id: l.id, isNew: true, sx: e.clientX, sy: e.clientY };
    render();
    return;
  }
  if (tool === 'pen') {
    op = { k: 'pen', raw: [[p.x, p.y]] };
    renderUI();
  }
});
function pMove(e) {
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const p = toW(e);
  lastW = p;
  if (!op) {
    if (e.pointerType === 'mouse') {
      const t = e.target.closest('[data-id]');
      let h = null,
        lk = null;
      if (t && (tool === 'select' || tool === 'line')) {
        const el = byId(t.dataset.id);
        if (el && el.lk) lk = el.id;
        else if (tool === 'select' || isShape(el)) h = t.dataset.id;
      }
      if (h !== hoverId || lk !== hoverLock) {
        hoverId = h;
        hoverLock = lk;
        renderUI();
      }
    }
    return;
  }
  if (op.k === 'pinch') {
    if (ptrs.size < 2) return;
    const [a, b] = [...ptrs.values()],
      r = svg.getBoundingClientRect(),
      m = midp(a, b),
      d = dist(a, b) || 1;
    cam.x += m.x - op.m.x;
    cam.y += m.y - op.m.y;
    const wx = (m.x - r.left - cam.x) / cam.z,
      wy = (m.y - r.top - cam.y) / cam.z;
    cam.z = clampZ((cam.z * d) / op.d);
    cam.x = m.x - r.left - wx * cam.z;
    cam.y = m.y - r.top - wy * cam.z;
    op.m = m;
    op.d = d;
    camSoon();
    return;
  }
  if (op.k === 'pan' || op.k === 'tpan') {
    const dx = e.clientX - op.sx,
      dy = e.clientY - op.sy;
    if (op.k === 'tpan' && !op.moved) {
      if (Math.hypot(dx, dy) < 8) return;
      op.moved = true;
      clearTimeout(op.t);
    }
    cam.x = op.cam.x + dx;
    cam.y = op.cam.y + dy;
    camSoon();
    return;
  }
  if (op.k === 'move') {
    let dx = p.x - op.start.x,
      dy = p.y - op.start.y;
    if (!op.moved && Math.hypot(dx, dy) * cam.z < (op.touch ? 7 : 3)) return;
    op.moved = true;
    clearTimeout(op.lp);
    hoverId = null;
    if (sym) [dx, dy] = smartSym(op.bb, dx, dy);
    else if (snap) {
      dx = snapV(op.bb.x + dx) - op.bb.x;
      dy = snapV(op.bb.y + dy) - op.bb.y;
      guides = [];
    } else [dx, dy] = smart(op.bb, dx, dy);
    moveBy(op.orig, dx, dy);
    renderSoon();
    return;
  }
  if (op.k === 'bend') {
    const l = byId(op.id);
    if (l) {
      const g = lineGeo(l);
      let t = g.hz ? (p.x - g.pa.x) / (g.pb.x - g.pa.x || 1) : (p.y - g.pa.y) / (g.pb.y - g.pa.y || 1);
      if (Math.abs(t - 0.5) < 0.04) t = 0.5;
      l.k = Math.min(0.9, Math.max(0.1, t));
    }
    renderSoon();
    return;
  }
  if (op.k === 'resize') return resize(p, e.shiftKey);
  if (op.k === 'marquee') {
    op.cur = p;
    const r = rectFrom(op.start, p);
    sel = new Set(op.base);
    for (const el of els) {
      if (el.lk) continue;
      const b = bounds(el);
      // frames only when fully inside the box, so you can box-select things within a frame
      if (
        isFrame(el) ? b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h : hit(b, r)
      )
        sel.add(el.id);
    }
    expandGroups(sel);
    renderSoon();
    return;
  }
  if (op.k === 'create') {
    const q = sym ? symPt(p, new Set([op.id])) : snapP(p),
      n = byId(op.id);
    let w = q.x - op.start.x,
      h = q.y - op.start.y;
    if (e.shiftKey) {
      const m = Math.max(Math.abs(w), Math.abs(h));
      w = (Math.sign(w) || 1) * m;
      h = (Math.sign(h) || 1) * m;
    }
    n.x = Math.min(op.start.x, op.start.x + w);
    n.y = Math.min(op.start.y, op.start.y + h);
    n.w = Math.abs(w);
    n.h = Math.abs(h);
    renderSoon();
    return;
  }
  if (op.k === 'end') {
    const l = byId(op.id);
    if (!l) return;
    const other = l[op.which === 'a' ? 'b' : 'a'],
      s = shapeAt(p, other.id, lastPT === 'mouse' ? 18 : 30),
      q = snapP(p);
    l[op.which] = s ? { id: s.id, x: q.x, y: q.y } : { x: q.x, y: q.y };
    hoverId = s ? s.id : null;
    renderSoon();
    return;
  }
  if (op.k === 'pen') {
    const L = op.raw[op.raw.length - 1];
    if (Math.hypot(p.x - L[0], p.y - L[1]) * cam.z > 1.5) {
      op.raw.push([p.x, p.y]);
      renderUI();
    }
  }
}
function pUp(e) {
  ptrs.delete(e.pointerId);
  svg.classList.remove('pan');
  if (!op) return;
  if (op.k === 'pinch') {
    if (!ptrs.size) {
      op = null;
      saveCamSoon();
    }
    return;
  }
  if (op.k === 'pan' || op.k === 'tpan') {
    clearTimeout(op.t);
    op = null;
    saveCamSoon();
    return;
  }
  const k = op.k,
    o = op;
  clearTimeout(o.lp);
  op = null;
  guides = [];
  hoverId = null;
  if ((k === 'move' && !o.moved && !o.tapEdit) || k === 'marquee') setTimeout(avoidPanel, 40);
  if (k === 'move' && o.tapEdit && !o.moved) {
    end();
    const el = byId(o.id);
    if (el && el.t !== 'pen') {
      startEdit(o.id);
      openPanel('text');
    } else render();
    return;
  }
  if (k === 'end' && o.dot) {
    const l = byId(o.id),
      src = byId(o.src),
      dragged = Math.hypot(e.clientX - o.sx, e.clientY - o.sy) > 10;
    if (l && src && !(dragged && l.b.id)) {
      const n = JSON.parse(JSON.stringify(src));
      n.id = uid();
      n.text = '';
      const c = ctr(src),
        G2 = Math.max(90, Math.min(src.w, src.h) * 0.8);
      let cx, cy;
      if (dragged) {
        const q = toW(e);
        cx = q.x;
        cy = q.y;
      } else {
        cx = c.x + (o.dot === 'e' ? src.w + G2 : o.dot === 'w' ? -src.w - G2 : 0);
        cy = c.y + (o.dot === 's' ? src.h + G2 : o.dot === 'n' ? -src.h - G2 : 0);
      }
      n.x = snapV(cx - n.w / 2);
      n.y = snapV(cy - n.h / 2);
      if (!dragged) {
        const dx = o.dot === 'e' ? 1 : o.dot === 'w' ? -1 : 0,
          dy = o.dot === 's' ? 1 : o.dot === 'n' ? -1 : 0;
        for (let i = 0; i < 8; i++) {
          const R = { x: n.x - 16, y: n.y - 16, w: n.w + 32, h: n.h + 32 };
          if (!els.some(x => isShape(x) && x.id !== src.id && hit(bounds(x), R))) break;
          n.x += dx * (n.w + 40);
          n.y += dy * (n.h + 40);
        }
      }
      els.push(n);
      l.b = { id: n.id, x: cx, y: cy };
      if (!dragged) l.route = def.route;
      sel = new Set([n.id]);
      end();
      render();
      if (e.pointerType === 'mouse') startEdit(n.id);
      return;
    }
    end();
    render();
    return;
  }
  if (k === 'create') {
    const n = byId(o.id),
      dragged = Math.hypot(e.clientX - o.sx, e.clientY - o.sy) > 6;
    if (!dragged || n.w < MIN || n.h < MIN) {
      const [w, h] = SIZE[n.t] || [160, 100];
      n.w = w;
      n.h = h;
      n.x = snapV(o.start.x - w / 2);
      n.y = snapV(o.start.y - h / 2);
    }
    if (n.t === 'frame') {
      els = [n, ...els.filter(x => x !== n)];
      if (!dragged) {
        const v = view();
        const fit2 = Math.min(1, (v.w * 0.7) / cam.z / n.w, (v.h * 0.6) / cam.z / n.h);
        if (fit2 < 1) {
          n.w = Math.round(n.w * fit2);
          n.h = Math.round(n.h * fit2);
          n.x = snapV(o.start.x - n.w / 2);
          n.y = snapV(o.start.y - n.h / 2);
        }
      }
    }
    if (!lock) setTool('select');
    end();
    render();
    if (n.t === 'text' || n.t === 'sticky') startEdit(n.id);
    return;
  }
  if (k === 'end') {
    const l = byId(o.id);
    if (o.isNew && l && Math.hypot(e.clientX - o.sx, e.clientY - o.sy) < 10) {
      els = els.filter(x => x !== l);
      sel.clear();
    }
    if (o.isNew && !lock) setTool('select');
    end();
    render();
    return;
  }
  if (k === 'pen') {
    if (o.raw.length > 1) {
      begin();
      const xs = o.raw.map(q => q[0]),
        ys = o.raw.map(q => q[1]),
        x = Math.min(...xs),
        y = Math.min(...ys),
        w = Math.max(1, Math.max(...xs) - x),
        h = Math.max(1, Math.max(...ys) - y);
      els.push({
        id: uid(),
        t: 'pen',
        x,
        y,
        w,
        h,
        pts: o.raw.map(q => [
          Math.round(((q[0] - x) / w) * 1000) / 1000,
          Math.round(((q[1] - y) / h) * 1000) / 1000
        ]),
        fill: 'transparent',
        stroke: def.stroke === 'transparent' ? 'ink' : def.stroke,
        sw: def.sw,
        dash: def.dash,
        font: def.font,
        fs: def.fs,
        op: def.op,
        text: '',
        tc: 'auto',
        bold: false,
        it: false,
        ta: 'center',
        va: 'middle',
        rad: 0,
        sh: false
      });
      end();
    }
    render();
    return;
  }
  end();
  render();
}
function focusEd() {
  if (!editing || document.activeElement === edIn) return;
  edIn.focus({ preventScroll: true });
  const r = document.createRange();
  r.selectNodeContents(edIn);
  r.collapse(false);
  const g = getSelection();
  g.removeAllRanges();
  g.addRange(r);
}
svg.addEventListener('touchend', focusEd);
svg.addEventListener('click', focusEd);
$('#editBtn').addEventListener('touchend', () => setTimeout(focusEd, 0));
svg.addEventListener('pointermove', e => {
  try {
    pMove(e);
  } catch (err) {
    console.error(err);
    if (op && op.t) clearTimeout(op.t);
    op = null;
    before = null;
    guides = [];
    ptrs.clear();
    render();
  }
});
svg.addEventListener('pointerup', pUp);
function touchesDone(e) {
  if (e.touches.length) return;
  const t = e.changedTouches[0] || { clientX: 0, clientY: 0 },
    x = t.clientX,
    y = t.clientY;
  setTimeout(() => {
    if (op && op.k === 'pinch') {
      op = null;
      saveCamSoon();
    }
    ptrs.clear();
    if (op) pUp({ pointerId: -1, clientX: x, clientY: y });
  }, 60);
}
document.addEventListener('touchend', touchesDone, true);
document.addEventListener('touchcancel', touchesDone, true);
svg.addEventListener('pointercancel', pUp);
svg.addEventListener('pointerleave', e => {
  if (!op && (hoverId || hoverLock)) {
    hoverId = null;
    hoverLock = null;
    renderUI();
  }
});
document.addEventListener('contextmenu', e => {
  if (!e.target.closest('#edin,textarea,input')) e.preventDefault();
});
document.addEventListener('selectstart', e => {
  if (!e.target.closest || !e.target.closest('#edin,textarea,input')) e.preventDefault();
});
document.addEventListener(
  'pointerdown',
  e => {
    if (!editing && !e.target.closest('textarea,input')) {
      const g = getSelection();
      if (g && g.rangeCount && !g.isCollapsed) g.removeAllRanges();
    }
  },
  true
);
svg.addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    if (editing) commitEdit();
    if (e.ctrlKey || e.metaKey)
      zoomAt(
        e.clientX,
        e.clientY,
        Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0022) * (e.ctrlKey && Math.abs(e.deltaY) < 50 ? 4 : 1))
      );
    else {
      cam.x -= e.deltaX;
      cam.y -= e.deltaY;
      camSoon();
      saveCamSoon();
    }
  },
  { passive: false }
);
function addTextEdit(p) {
  begin();
  const n = mk('text', 0, 0, 220, 50);
  n.x = snapV(p.x - 110);
  n.y = snapV(p.y - 25);
  els.push(n);
  end();
  startEdit(n.id);
}
