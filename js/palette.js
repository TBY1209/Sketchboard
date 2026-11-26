/* Command palette (Ctrl/⌘+K): fuzzy search over every action, your boards, this board's frames and templates. */
let palItems = [],
  palIdx = 0,
  palOpen = false,
  palBoards = [];

async function openPalette() {
  if (palOpen) return;
  closePops();
  if (typeof closeBoardMenu === 'function') closeBoardMenu();
  if (editing) commitEdit();
  palOpen = true;
  $('#pal').hidden = false;
  $('#palIn').value = '';
  $('#palIn').focus();
  palBuild();
  try {
    palBoards = await Store.listBoards();
    palBoards.sort((a, b) => b.updated - a.updated);
  } catch (_) {
    palBoards = [];
  }
  if (palOpen) palBuild();
}
function closePalette() {
  palOpen = false;
  $('#pal').hidden = true;
  $('#palIn').blur();
}
const HOME_OK = new Set(['newBoard', 'open', 'theme', 'keys']);
function palSource() {
  const out = [];
  for (const a of ACTIONS) {
    if (a.hidden) continue;
    if (route !== 'board' && !HOME_OK.has(a.id)) continue;
    if (route === 'board' && readOnly && a.group !== 'View' && a.id !== 'home' && a.id !== 'keys') continue;
    if (a.when && !a.when()) continue;
    out.push({
      label: a.label + (a.toggle ? (a.toggle() ? '  ✓' : '') : ''),
      group: a.group,
      keys: a.keys || a.hint,
      run: () => runAction(a.id)
    });
  }
  if (route === 'board')
    for (const f of framesList())
      out.push({
        label: 'Go to frame: ' + (f.text || 'Frame'),
        group: 'Frames',
        run: () => {
          sel = new Set([f.id]);
          render();
          zoomToBounds({ x: f.x, y: f.y - 36, w: f.w, h: f.h + 36 }, 1.5);
        }
      });
  for (const b of palBoards)
    if (!board || b.id !== board.id)
      out.push({ label: 'Open board: ' + b.name, group: 'Boards', run: () => go('#/b/' + b.id) });
  for (const t of TEMPLATES)
    out.push({ label: 'New board: ' + t.name, group: 'Templates', run: () => newBoard(t.id) });
  return out;
}
/* subsequence match; consecutive letters and word starts score higher */
function fuzzy(q, s) {
  q = q.toLowerCase();
  s = s.toLowerCase();
  if (!q) return 0;
  let i = 0,
    score = 0,
    last = -2;
  for (let j = 0; j < s.length && i < q.length; j++) {
    if (s[j] !== q[i]) continue;
    score += (j === last + 1 ? 3 : 1) + (j === 0 || /[\s:(]/.test(s[j - 1]) ? 4 : 0);
    last = j;
    i++;
  }
  return i === q.length ? score - s.length * 0.01 : -1;
}
function palBuild() {
  const q = $('#palIn').value.trim();
  let L = palSource()
    .map(it => ({ ...it, sc: fuzzy(q, it.label) }))
    .filter(it => it.sc >= 0);
  if (q) L.sort((a, b) => b.sc - a.sc);
  palItems = L.slice(0, 80);
  palIdx = 0;
  palRender();
}
function palRender() {
  $('#palList').innerHTML = palItems.length
    ? palItems
        .map(
          (it, i) =>
            `<button role="option" id="po${i}" data-i="${i}" class="${i === palIdx ? 'on' : ''}" aria-selected="${i === palIdx}"><span class="pl">${esc(it.label)}</span><span class="pg">${esc(it.group)}</span>${
              it.keys ? `<kbd>${esc(keyLabel(it.keys[0]))}</kbd>` : ''
            }</button>`
        )
        .join('')
    : `<div class="pnone">Nothing matches</div>`;
  $('#palIn').setAttribute('aria-activedescendant', palItems.length ? 'po' + palIdx : '');
  const on = $('#palList .on');
  if (on) on.scrollIntoView({ block: 'nearest' });
}
function palRun(i) {
  const it = palItems[i];
  if (!it) return;
  closePalette();
  it.run();
}
$('#palIn').addEventListener('input', palBuild);
$('#palList').addEventListener('click', e => {
  const b = e.target.closest('[data-i]');
  if (b) palRun(+b.dataset.i);
});
$('#palList').addEventListener('pointermove', e => {
  const b = e.target.closest('[data-i]');
  if (b && +b.dataset.i !== palIdx) {
    palIdx = +b.dataset.i;
    for (const x of $('#palList').children) x.classList.toggle('on', x === b);
  }
});
$('#pal').addEventListener('pointerdown', e => {
  if (e.target.id === 'pal') closePalette();
});
$('#palBtn').addEventListener('click', openPalette);

/* keyboard.js calls this first; return true to stop normal shortcut handling */
function keyOverlay(e) {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    palOpen ? closePalette() : openPalette();
    return true;
  }
  if (!$('#ctx').hidden && e.key === 'Escape') {
    closeCtx();
    return true;
  }
  if (!palOpen) return false;
  if (document.activeElement !== $('#palIn')) $('#palIn').focus();
  if (e.key === 'Escape') {
    e.preventDefault();
    closePalette();
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const n = palItems.length;
    if (n) palIdx = (palIdx + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
    palRender();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    palRun(palIdx);
  }
  return true;
}
