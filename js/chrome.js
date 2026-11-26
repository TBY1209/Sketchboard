/* Top bars, tool tray, menu, theme, toasts and modals. */
$('#shapes').innerHTML =
  SHAPES.map(
    t => `<button data-s="${t}" title="${NAMES[t]}" aria-label="${NAMES[t]}">${shapeIcon(t, 26)}</button>`
  ).join('') +
  `<button data-s="frame" title="Frame (F): a titled area that carries what's inside it" aria-label="Frame">${shapeIcon('frame', 26)}</button>`;
function closePops() {
  $('#shapes').hidden = true;
  $('#menu').hidden = true;
  $('#alignpop').hidden = true;
  if (typeof closeCtx === 'function') closeCtx();
}
$('#tray').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'lockBtn') return toggleLock();
  if (b.id === 'symBtn') return setSym(!sym);
  const t = b.dataset.tool;
  if (t === 'shape') {
    const open = $('#shapes').hidden;
    closePops();
    $('#shapes').hidden = !open;
    setTool(lastShape);
    return;
  }
  closePops();
  if (editing) commitEdit();
  setTool(t);
});
$('#shapes').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  setTool(b.dataset.s);
  closePops();
});
function toggleLock() {
  lock = !lock;
  $('#lockBtn').classList.toggle('on', lock);
  toast(lock ? 'Tool stays active after drawing' : 'Tool returns to select after drawing');
}
const MODEI = {
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16a8 8 0 000-16z" fill="currentColor"/>',
  light:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  dark: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>'
};
function setMode(m, quiet) {
  mode = m;
  if (m === 'auto') document.documentElement.removeAttribute('data-mode');
  else document.documentElement.setAttribute('data-mode', m);
  try {
    localStorage.setItem(LS + '.mode', m);
  } catch (_) {}
  const lbl = { auto: 'Match system', light: 'Light', dark: 'Dark' }[m];
  $('#themeBtn').innerHTML = `<svg class="ico" viewBox="0 0 24 24">${MODEI[m]}</svg>`;
  if (typeof syncThemeColor === 'function') requestAnimationFrame(syncThemeColor);
  $('#themeBtn').title = 'Appearance: ' + lbl;
  $('#modeChk').textContent = lbl;
  if (!quiet) toast('Appearance: ' + lbl);
}
const nextMode = () => setMode({ auto: 'light', light: 'dark', dark: 'auto' }[mode]);
$('#themeBtn').addEventListener('click', nextMode);
function toggleGrid() {
  grid = !grid;
  stage.classList.toggle('nogrid', !grid);
  $('#gridChk').textContent = grid ? '✓' : '';
}
$('#menuBtn').addEventListener('click', e => {
  e.stopPropagation();
  const open = $('#menu').hidden;
  closePops();
  $('#menu').hidden = !open;
  if (open)
    for (const b of $('#menu').querySelectorAll('[data-act]')) {
      const a = ACT[b.dataset.act];
      if (!a) continue;
      b.disabled = !!(a.when && !a.when());
      const c = b.querySelector('.chk');
      if (c && a.toggle && !c.id) c.textContent = a.toggle() ? '✓' : '';
    }
});
$('#menu').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const a = ACT[b.dataset.act];
  if (!a) return;
  if (!a.toggle && a.id !== 'theme') closePops(); // toggles keep the menu open so you can see the check
  runAction(a.id);
});
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('.pop,#menuBtn,#shapeBtn,#sbar')) closePops();
});
$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);
for (const b of document.querySelectorAll('[data-zoom]'))
  b.addEventListener('click', () => {
    const z = b.dataset.zoom;
    if (z === 'in') zoomC(1.2);
    else if (z === 'out') zoomC(1 / 1.2);
    else if (z === 'reset') zoomC(1 / cam.z);
    else fit();
  });
$('#editBtn').addEventListener('click', () => {
  const id = [...sel][0];
  if (id) {
    startEdit(id);
    openPanel('text');
  }
});
$('#styleBtn').addEventListener('click', () => {
  if (document.body.classList.contains('panel-open')) document.body.classList.remove('panel-open');
  else openPanel();
});
let tT = 0;
/* toast('Text') or toast('Deleted', {label: 'Undo', run}) for an action button */
function toast(t, act) {
  const el = $('#toast');
  el.innerHTML = '';
  el.append(document.createTextNode(t));
  if (act) {
    const b = document.createElement('button');
    b.textContent = act.label;
    b.onclick = () => {
      el.classList.remove('show');
      act.run();
    };
    el.append(b);
  }
  el.classList.toggle('act', !!act);
  el.classList.add('show');
  clearTimeout(tT);
  tT = setTimeout(() => el.classList.remove('show'), act ? 6000 : 2200);
}
function modal(html) {
  $('#mcard').innerHTML = html;
  $('#modal').hidden = false;
}
function closeModal() {
  $('#modal').hidden = true;
  $('#mcard').innerHTML = '';
  $('#mcard').classList.remove('wide');
}
$('#modal').addEventListener('click', e => {
  if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal();
  const c = e.target.closest('[data-copy]');
  if (c) {
    const ta = $('#mcard textarea');
    navigator.clipboard.writeText(ta.value).then(
      () => toast('Copied'),
      () => {
        ta.select();
        toast('Select all and copy');
      }
    );
  }
  if (e.target.closest('[data-clear]')) {
    begin();
    els = [];
    sel.clear();
    end();
    closeModal();
    render();
    toast('Board cleared', { label: 'Undo', run: undo });
  }
});
function confirmClear() {
  modal(
    `<h3>Clear the whole board?</h3><p>Everything on it goes. Undo can still bring it back during this visit.</p><div class="mrow"><button class="btn" data-close>Keep it</button><button class="btn red" data-clear>Clear board</button></div>`
  );
}
const TIPS = [
  ['Tap a shape', 'Select it to move or resize'],
  ['Tap it again (phone) / double-click', 'Type inside it and open the style menu'],
  ['Blue + dots', 'Tap to add a connected shape, or drag onto another shape to connect'],
  ['Tap a connector', 'Switch curved, 90° elbow, rounded or straight; drag its blue dot to move the bend'],
  ['Align button (2+ selected)', 'Line shapes up, centre them, space them evenly, match sizes'],
  ['Select-several button (top right)', 'Phone: tap shapes to add them, drag to box-select'],
  ['Double-click empty canvas', 'Add text'],
  ['Drag a corner or edge', 'Resize (hold Shift to keep proportions)'],
  ['Alt + drag', 'Duplicate while moving'],
  ['Two fingers, Space + drag, or middle mouse', 'Pan'],
  ['Press and hold empty canvas (phone)', 'Box-select'],
  ['Pinch / Ctrl + scroll', 'Zoom'],
  ['Arrows (Shift for 20px)', 'Nudge'],
  ['Esc or Ctrl + Enter', 'Finish typing'],
  [(IS_MAC ? '⌘' : 'Ctrl') + ' C / X / V', 'Copy, cut, paste']
];
function help() {
  const groups = {};
  for (const a of ACTIONS) if (a.keys) (groups[a.group] = groups[a.group] || []).push(a);
  const keys = Object.entries(groups)
    .map(
      ([g, list]) =>
        `<h4 class="kh">${g}</h4><div class="keys">${list
          .map(
            a =>
              `<span class="kk">${a.keys.map(k => `<kbd>${esc(keyLabel(k))}</kbd>`).join('')}</span><span>${esc(a.label)}</span>`
          )
          .join('')}</div>`
    )
    .join('');
  modal(
    `<h3>Shortcuts and tips</h3><p>Connectors snap to whatever shape you start or end on and follow it around.</p>${keys}<h4 class="kh">Gestures</h4><div class="keys">${TIPS.map(([a, b]) => `<kbd>${a}</kbd><span>${b}</span>`).join('')}</div><div class="mrow"><button class="btn pri" data-close>Got it</button></div>`
  );
}
