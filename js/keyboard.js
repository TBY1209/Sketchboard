/* Keyboard shortcuts and system clipboard. */
const isField = t => t && t.closest && t.closest('input,textarea,[contenteditable]');
addEventListener('keydown', e => {
  if (editing) {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      commitEdit();
    }
    return;
  }
  if (typeof keyOverlay === 'function' && keyOverlay(e)) return;
  if (!$('#modal').hidden) {
    if (e.key === 'Escape') closeModal();
    return;
  }
  if (isField(e.target)) return;
  if (route === 'share') {
    const a = actionForKey(e, false) || actionForKey(e, true);
    if (a && a.group === 'View') {
      e.preventDefault();
      a.run();
    }
    return;
  }
  if (route !== 'board') {
    if (e.key === '/' && route === 'home') {
      e.preventDefault();
      $('#hq').focus();
    }
    return;
  }
  if (e.key === ' ') {
    if (!spaceDown) {
      spaceDown = true;
      svg.classList.add('pan');
    }
    e.preventDefault();
    return;
  }
  const k = e.key.toLowerCase();
  if (k.startsWith('arrow') && sel.size && !(e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    const s = e.shiftKey ? G : 1;
    nudge(
      k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0,
      k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0
    );
    return;
  }
  // shortcuts with modifiers or named keys (Delete, Escape, Enter, Mod+Z…)
  let a = actionForKey(e, false);
  if (a) {
    e.preventDefault();
    a.run();
    return;
  }
  if (e.metaKey || e.ctrlKey) return;
  // typing with one empty shape selected starts editing it
  if (sel.size === 1 && e.key.length === 1 && !e.altKey) {
    const el = byId([...sel][0]);
    if (el && el.t !== 'pen' && el.t !== 'img' && !el.text) {
      e.preventDefault();
      startEdit(el.id, e.key);
      return;
    }
  }
  a = actionForKey(e, true);
  if (a) {
    e.preventDefault();
    a.run();
  }
});
addEventListener('keyup', e => {
  if (e.key === ' ') {
    spaceDown = false;
    svg.classList.remove('pan');
  }
});
document.addEventListener('copy', e => {
  if (route !== 'board' || readOnly || editing || isField(e.target) || !sel.size) return;
  clip = JSON.stringify({ sketchboard: 1, els: copyList() });
  e.clipboardData.setData('text/plain', clip);
  e.preventDefault();
  toast('Copied');
});
document.addEventListener('cut', e => {
  if (route !== 'board' || readOnly || editing || isField(e.target) || !sel.size) return;
  clip = JSON.stringify({ sketchboard: 1, els: copyList() });
  e.clipboardData.setData('text/plain', clip);
  e.preventDefault();
  del();
});
document.addEventListener('paste', e => {
  if (route !== 'board' || readOnly || editing || isField(e.target)) return;
  const files = [...(e.clipboardData.files || [])],
    t = e.clipboardData.getData('text/plain') || '';
  e.preventDefault();
  let isBoard = false;
  try {
    isBoard = !!JSON.parse(t).sketchboard;
  } catch (_) {}
  if (!isBoard && files.some(f => f.type.startsWith('image/'))) return addImageFiles(files, lastW);
  if (!t && clip) return pasteEls(JSON.parse(clip).els);
  pasteText(t);
});
