/* Inline text editor overlay. */
function edStyle() {
  const e = byId(editing);
  if (!e) return;
  let box;
  if (e.t === 'line') {
    const g = lineGeo(e);
    box = { x: g.mid.x - 120, y: g.mid.y - 40, w: 240, h: 80 };
  } else {
    const b = tbox(e);
    box = { x: e.x + b.x, y: e.y + b.y, w: b.w, h: b.h };
  }
  edWrap.classList.toggle('lbl', e.t === 'line');
  Object.assign(edWrap.style, {
    left: box.x * cam.z + cam.x + 'px',
    top: box.y * cam.z + cam.y + 'px',
    width: box.w * cam.z + 'px',
    height: box.h * cam.z + 'px',
    alignItems: e.t === 'line' || e.va === 'middle' ? 'center' : e.va === 'top' ? 'flex-start' : 'flex-end'
  });
  const rf = e.fs * cam.z,
    k = rf < 16 ? rf / 16 : 1;
  Object.assign(edIn.style, {
    width: e.t === 'line' ? 'auto' : 100 / k + '%',
    maxWidth: 100 / k + '%',
    transform: k < 1 ? `scale(${k})` : 'none',
    transformOrigin:
      (e.t === 'line' || e.va === 'middle' ? 'center' : e.va === 'top' ? 'top' : 'bottom') + ' center',
    fontFamily: FONTS[e.font],
    fontSize: Math.max(16, rf) + 'px',
    fontWeight: e.bold ? 700 : 400,
    fontStyle: e.it ? 'italic' : 'normal',
    color: tcol(e),
    textAlign: e.t === 'line' ? 'center' : e.ta
  });
}
function startEdit(id, initial) {
  const e = byId(id);
  if (!e || e.t === 'pen') return;
  commitEdit();
  editing = id;
  sel = new Set([id]);
  render();
  edStyle();
  edIn.textContent = initial != null ? initial : e.text || '';
  edWrap.hidden = false;
  edIn.focus({ preventScroll: true });
  const r = document.createRange();
  r.selectNodeContents(edIn);
  r.collapse(false);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}
function commitEdit() {
  if (!editing) return;
  const e = byId(editing),
    id = editing,
    txt = edIn.innerText.replace(/ /g, ' ').replace(/\n+$/, '');
  editing = null;
  edWrap.hidden = true;
  edIn.blur();
  if (e) {
    begin();
    e.text = txt;
    if (e.t === 'text' && !txt.trim()) {
      els = els.filter(x => x !== e);
      sel.delete(id);
    } else fitText(e);
    end();
  }
  render();
}
edIn.addEventListener('paste', ev => {
  ev.preventDefault();
  document.execCommand('insertText', false, ev.clipboardData.getData('text/plain'));
});
edIn.addEventListener('blur', () =>
  setTimeout(() => {
    if (editing && document.activeElement !== edIn) commitEdit();
  }, 120)
);
