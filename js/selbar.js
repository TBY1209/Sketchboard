/* Floating selection toolbar and align popover. */
const SB = (a, i, t, c = '') =>
  `<button data-sb="${a}"${c ? ` class="${c}"` : ''} title="${t}" aria-label="${t}">${ic(i)}</button>`;
function sbarUpdate() {
  const bar = $('#sbar'),
    S = selEls();
  if (!S.length || editing || op || tool !== 'select' || !$('#modal').hidden || !$('#ctx').hidden) {
    bar.hidden = true;
    sbKey = '';
    $('#alignpop').hidden = true;
    return;
  }
  const one = S.length === 1 ? S[0] : null,
    line = !!one && one.t === 'line',
    alignOK = S.filter(e => e.t !== 'line').length >= 2,
    key = line
      ? 'L' + one.route + one.head
      : one
        ? 'S' + one.t
        : 'M' + S.length + (alignOK ? 'a' : '') + (selIsGroup() ? 'g' : selHasGroup() ? 'h' : '');
  if (key !== sbKey) {
    sbKey = key;
    let h = '';
    if (line) {
      const r = one.route;
      h =
        SB('route:curve', 'curve', 'Curved arrow', r === 'curve' ? 'on' : '') +
        SB('route:elbow', 'elbow', 'Straight 90° elbow', r === 'elbow' ? 'on' : '') +
        SB('route:rounded', 'rounded', 'Rounded elbow', r === 'rounded' ? 'on' : '') +
        SB('route:straight', 'straight', 'Straight line', r === 'straight' ? 'on' : '') +
        '<span class="sep"></span>' +
        SB('head', one.head, 'Arrowheads: tap to change') +
        SB('rev', 'rev', 'Reverse direction') +
        SB('style', 'pal', 'Style', 'narrow sel-only') +
        SB('del', 'del', 'Delete', 'danger');
    } else if (one)
      h =
        (one.t === 'pen' || one.t === 'img'
          ? ''
          : SB('edit', 'edit', one.t === 'frame' ? 'Rename frame' : 'Edit text')) +
        SB('dup', 'dup', 'Duplicate') +
        SB('style', 'pal', 'Style', 'narrow sel-only') +
        '<span class="sep"></span>' +
        SB('del', 'del', 'Delete', 'danger');
    else
      h =
        `<span class="cnt">${S.length} selected</span>` +
        (alignOK ? SB('align', 'alignC', 'Align and space evenly') : '') +
        (selHasGroup()
          ? SB('ungroup', 'ungroup', 'Ungroup (' + keyLabel('Mod+Shift+G') + ')')
          : SB('group', 'group', 'Group (' + keyLabel('Mod+G') + ')')) +
        SB('dup', 'dup', 'Duplicate all') +
        '<span class="sep"></span>' +
        SB('del', 'del', 'Delete all', 'danger');
    bar.innerHTML = h;
  }
  bar.hidden = false;
  const z = cam.z,
    b = selBounds(),
    T = lastPT !== 'mouse',
    w = bar.offsetWidth,
    h = bar.offsetHeight,
    gap = one && isShape(one) ? (T ? 66 : 48) : 14,
    cx = (b.x + b.w / 2) * z + cam.x,
    top0 = b.y * z + cam.y,
    bot0 = (b.y + b.h) * z + cam.y,
    minX = narrow()
      ? document.body.classList.contains('panel-open')
        ? Math.min(184, innerWidth * 0.5) + 20
        : 8
      : 264,
    minY = 66,
    maxY = Math.max(minY, innerHeight - h - (narrow() ? 96 : 104));
  let x = Math.min(innerWidth - w - 8, Math.max(minX, cx - w / 2)),
    y = top0 - h - gap;
  if (y < minY) y = bot0 + gap;
  y = Math.max(minY, Math.min(maxY, y));
  bar.style.left = Math.round(x) + 'px';
  bar.style.top = Math.round(y) + 'px';
  placeAlign();
}
function placeAlign() {
  const pp = $('#alignpop');
  if (pp.hidden) return;
  const br = $('#sbar').getBoundingClientRect(),
    w = pp.offsetWidth,
    h = pp.offsetHeight;
  let x = Math.min(innerWidth - w - 8, Math.max(8, br.left + br.width / 2 - w / 2)),
    y = br.top - h - 8;
  if (y < 64) y = br.bottom + 8;
  pp.style.left = Math.round(x) + 'px';
  pp.style.top = Math.round(y) + 'px';
}
function reverse() {
  begin();
  for (const e of selEls()) if (e.t === 'line') [e.a, e.b] = [e.b, e.a];
  end();
  render();
}
$('#sbar').addEventListener('pointerdown', e => {
  if (e.target.closest('button')) e.preventDefault();
});
$('#sbar').addEventListener('touchend', () => setTimeout(focusEd, 60));
$('#sbar').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const a = b.dataset.sb,
    S = selEls();
  if (a === 'del') {
    const n = S.length;
    del();
    if (n > 1) toast('Deleted ' + n + ' items', { label: 'Undo', run: undo });
  } else if (a === 'dup') dup();
  else if (a === 'edit') {
    const id = [...sel][0];
    if (id) {
      startEdit(id);
      openPanel('text');
    }
  } else if (a === 'style') {
    if (document.body.classList.contains('panel-open')) document.body.classList.remove('panel-open');
    else openPanel();
  } else if (a === 'rev') reverse();
  else if (a === 'group') groupSel();
  else if (a === 'ungroup') ungroupSel();
  else if (a === 'align') {
    const pp = $('#alignpop');
    pp.hidden = !pp.hidden;
    placeAlign();
  } else if (a === 'head')
    apply('head', { end: 'both', both: 'none', none: 'end' }[S[0] && S[0].head] || 'end');
  else if (a && a.startsWith('route:')) apply('route', a.slice(6));
});
const ALN = [
  ['left', 'alignL', 'Align left edges'],
  ['center', 'alignC', 'Align centres (vertical line)'],
  ['right', 'alignR', 'Align right edges'],
  ['top', 'alignT', 'Align top edges'],
  ['middle', 'alignM', 'Align middles (horizontal line)'],
  ['bottom', 'alignB', 'Align bottom edges'],
  ['dh', 'distH', 'Space evenly, left to right'],
  ['dv', 'distV', 'Space evenly, top to bottom'],
  ['mw', 'matchW', 'Make the same width'],
  ['mh', 'matchH', 'Make the same height']
];
$('#alignpop').innerHTML = ALN.map(
  ([k, i, t]) => `<button data-al="${k}" title="${t}" aria-label="${t}">${ic(i)}</button>`
).join('');
$('#alignpop').addEventListener('pointerdown', e => {
  if (e.target.closest('button')) e.preventDefault();
});
$('#alignpop').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) alignSel(b.dataset.al);
});
function setSym(v, quiet) {
  sym = v;
  $('#symBtn').classList.toggle('on', v);
  $('#symChk').textContent = v ? '✓' : '';
  try {
    localStorage.setItem(LS + '.sym', v ? '1' : '0');
  } catch (_) {}
  if (!quiet) toast(v ? 'Symmetry on: snaps to centres, edges and equal gaps' : 'Symmetry off');
}
function setMulti(v, quiet) {
  multi = v;
  $('#multiBtn').classList.toggle('on', v);
  if (!quiet && v) toast('Tap shapes to add or remove them');
}
$('#multiBtn').addEventListener('click', () => setMulti(!multi));
