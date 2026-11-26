/* Action registry: every command lives here once. Keyboard shortcuts, the menu, the help sheet,
   the command palette and the context menu all read from ACTIONS.
   An action: {id, label, group, keys?: ['Mod+Z'], when?: () => bool, run: () => void,
               hidden?: true (not in palette), toggle?: () => bool (shows a check) } */
const ACTIONS = [];
const ACT = {};

function action(a) {
  ACTIONS.push(a);
  ACT[a.id] = a;
  return a;
}
function runAction(id) {
  const a = ACT[id];
  if (!a || (a.when && !a.when())) return false;
  a.run();
  return true;
}

/* 'Mod+Shift+Z' → {mod, shift, alt, key}. 'Mod++' means the plus key. */
function parseKey(spec) {
  let key;
  if (spec.endsWith('++')) {
    key = '+';
    spec = spec.slice(0, -2);
  } else {
    const i = spec.lastIndexOf('+');
    key = spec.slice(i + 1);
    spec = i > 0 ? spec.slice(0, i) : '';
  }
  const m = new Set(spec ? spec.split('+') : []);
  return { mod: m.has('Mod'), shift: m.has('Shift'), alt: m.has('Alt'), key };
}
function keyMatch(e, spec) {
  const p = parseKey(spec);
  if (p.mod !== (e.metaKey || e.ctrlKey) || p.alt !== e.altKey) return false;
  if (/^[0-9]$/.test(p.key)) return p.shift === e.shiftKey && e.code === 'Digit' + p.key;
  // symbols like + and ? already imply shift on most layouts, so only check shift for letters/named keys
  if (/^[a-z]$/i.test(p.key) || p.key.length > 1) {
    if (p.shift !== e.shiftKey) return false;
  }
  return e.key.toLowerCase() === p.key.toLowerCase();
}
function keyLabel(spec) {
  const p = parseKey(spec),
    out = [];
  if (p.mod) out.push(IS_MAC ? '⌘' : 'Ctrl');
  if (p.alt) out.push(IS_MAC ? '⌥' : 'Alt');
  if (p.shift) out.push(IS_MAC ? '⇧' : 'Shift');
  const names = { Delete: 'Del', Backspace: '⌫', Escape: 'Esc', Enter: 'Enter', ' ': 'Space' };
  out.push(names[p.key] || (p.key.length === 1 ? p.key.toUpperCase() : p.key));
  return out.join(IS_MAC ? '' : '+');
}
/* Find the action for a key event. Single printable keys come second so typing into an empty
   selected shape still works (see keyboard.js). */
function actionForKey(e, printable) {
  for (const a of ACTIONS) {
    if (!a.keys) continue;
    for (const k of a.keys) {
      const single = parseKey(k);
      const isPrintable = !single.mod && !single.alt && !single.shift && single.key.length === 1;
      if (isPrintable !== printable) continue;
      if (keyMatch(e, k) && (!a.when || a.when())) return a;
    }
  }
  return null;
}

const hasSel = () => sel.size > 0;

/* ---------- edit ---------- */
action({
  id: 'undo',
  label: 'Undo',
  group: 'Edit',
  keys: ['Mod+Z'],
  when: () => undoS.length > 0,
  run: undo
});
action({
  id: 'redo',
  label: 'Redo',
  group: 'Edit',
  keys: ['Mod+Shift+Z', 'Mod+Y'],
  when: () => redoS.length > 0,
  run: redo
});
action({ id: 'dup', label: 'Duplicate', group: 'Edit', keys: ['Mod+D'], when: hasSel, run: dup });
action({ id: 'del', label: 'Delete', group: 'Edit', keys: ['Delete', 'Backspace'], when: hasSel, run: del });
action({
  id: 'all',
  label: 'Select all',
  group: 'Edit',
  keys: ['Mod+A'],
  run: () => {
    closePops();
    sel = new Set(els.map(x => x.id));
    render();
    toast(sel.size ? sel.size + ' selected' : 'Nothing on the board');
  }
});
action({
  id: 'editText',
  label: 'Edit text',
  group: 'Edit',
  keys: ['Enter'],
  when: () => sel.size === 1 && (byId([...sel][0]) || {}).t !== 'pen',
  run: () => {
    startEdit([...sel][0]);
    openPanel('text');
  }
});
action({
  id: 'deselect',
  label: 'Deselect and return to Select tool',
  group: 'Edit',
  keys: ['Escape'],
  hidden: true,
  run: () => {
    closePops();
    setMulti(false, 1);
    sel.clear();
    setTool('select');
    render();
  }
});

/* ---------- arrange ---------- */
action({
  id: 'front',
  label: 'Bring to front',
  group: 'Arrange',
  keys: [']'],
  when: hasSel,
  run: () => order(true)
});
action({
  id: 'back',
  label: 'Send to back',
  group: 'Arrange',
  keys: ['['],
  when: hasSel,
  run: () => order(false)
});
for (const [k, , t] of [
  ['left', 0, 'Align left edges'],
  ['center', 0, 'Align centres'],
  ['right', 0, 'Align right edges'],
  ['top', 0, 'Align top edges'],
  ['middle', 0, 'Align middles'],
  ['bottom', 0, 'Align bottom edges'],
  ['dh', 0, 'Space evenly horizontally'],
  ['dv', 0, 'Space evenly vertically']
])
  action({
    id: 'align-' + k,
    label: t,
    group: 'Arrange',
    when: () => selEls().filter(e => e.t !== 'line').length >= 2,
    run: () => alignSel(k)
  });

/* ---------- view ---------- */
action({ id: 'zoomIn', label: 'Zoom in', group: 'View', keys: ['Mod+=', 'Mod++'], run: () => zoomC(1.2) });
action({ id: 'zoomOut', label: 'Zoom out', group: 'View', keys: ['Mod+-'], run: () => zoomC(1 / 1.2) });
action({ id: 'zoom100', label: 'Zoom to 100%', group: 'View', keys: ['Mod+0'], run: () => zoomC(1 / cam.z) });
action({ id: 'fit', label: 'Zoom to fit', group: 'View', keys: ['Shift+1'], run: () => fit() });
action({
  id: 'grid',
  label: 'Show dot grid',
  group: 'View',
  keys: ['G'],
  toggle: () => grid,
  run: () => toggleGrid()
});
action({
  id: 'theme',
  label: 'Appearance: cycle light / dark / system',
  group: 'View',
  run: () => nextMode()
});

/* ---------- tools ---------- */
for (const [id, label, key, t] of [
  ['tool-select', 'Select tool', 'V', 'select'],
  ['tool-hand', 'Hand tool (pan)', 'H', 'hand'],
  ['tool-rect', 'Rectangle', 'R', 'rect'],
  ['tool-ellipse', 'Ellipse', 'O', 'ellipse'],
  ['tool-diamond', 'Diamond', 'D', 'diamond'],
  ['tool-sticky', 'Sticky note', 'S', 'sticky'],
  ['tool-text', 'Text', 'T', 'text'],
  ['tool-line', 'Connector', 'A', 'line'],
  ['tool-pen', 'Marker', 'P', 'pen']
])
  action({ id, label, group: 'Tools', keys: id === 'tool-line' ? [key, 'L'] : [key], run: () => setTool(t) });
action({
  id: 'sym',
  label: 'Symmetry mode',
  group: 'Tools',
  keys: ['M'],
  toggle: () => sym,
  run: () => setSym(!sym)
});
action({
  id: 'snap',
  label: 'Snap to grid',
  group: 'Tools',
  toggle: () => snap,
  run: () => {
    snap = !snap;
    $('#snapChk').textContent = snap ? '✓' : '';
  }
});
action({
  id: 'lock',
  label: 'Keep tool active after drawing',
  group: 'Tools',
  keys: ['Q'],
  toggle: () => lock,
  run: () => toggleLock()
});

/* ---------- board ---------- */
action({ id: 'newBoard', label: 'New board', group: 'Board', run: () => newBoard('blank') });
action({ id: 'home', label: 'All boards', group: 'Board', run: () => go('#/') });
action({
  id: 'rename',
  label: 'Rename board',
  group: 'Board',
  when: () => !!board && !readOnly,
  run: () => $('#titleBtn').click()
});
action({
  id: 'dupBoard',
  label: 'Duplicate board',
  group: 'Board',
  when: () => !!board && !readOnly,
  run: async () => {
    await flush();
    const m = await duplicateBoard(board.id);
    if (m) {
      go('#/b/' + m.id);
      toast('Opened a copy');
    }
  }
});
action({ id: 'png', label: 'Export image (PNG)', group: 'Board', run: () => exportPNG() });
action({ id: 'svg', label: 'Export vector (SVG)', group: 'Board', run: () => exportSVG() });
action({ id: 'json', label: 'Save board file', group: 'Board', run: () => exportJSON() });
action({ id: 'open', label: 'Import board file', group: 'Board', run: () => $('#file').click() });
action({
  id: 'clear',
  label: 'Clear board',
  group: 'Board',
  when: () => els.length > 0,
  run: () => confirmClear()
});
action({ id: 'keys', label: 'Shortcuts and tips', group: 'Help', keys: ['?'], run: () => help() });
