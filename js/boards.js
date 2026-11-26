/* Board lifecycle (open, create, duplicate, delete), saving, thumbnails and the hash router.
   Routes:  #/          home (all boards)
            #/b/<id>    a board
            #/s/<data>  a shared read-only snapshot (see share.js) */
const LAST_KEY = LS + '.last';

const newId = () => uid() + uid().slice(0, 4);
function newMeta(name, template) {
  const t = Date.now();
  return {
    id: newId(),
    name: name || 'Untitled board',
    created: t,
    updated: t,
    thumb: '',
    template: template || 'blank',
    cam: null,
    count: 0
  };
}
const okCam = c =>
  c && Number.isFinite(+c.z) ? { x: num(c.x, 0), y: num(c.y, 0), z: clampZ(num(c.z, 1)) } : null;

/* ---------- thumbnails ---------- */
function makeThumb(list, W = 480, H = 300) {
  try {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    const b = unionB(list);
    if (!b) return '';
    const pad = 24,
      s = Math.min((W - pad * 2) / (b.w || 1), (H - pad * 2) / (b.h || 1), 1.2);
    x.translate(W / 2 - (b.x + b.w / 2) * s, H / 2 - (b.y + b.h / 2) * s);
    x.scale(s, s);
    for (const e of list) drawEl(x, e);
    const url = c.toDataURL('image/webp', 0.82);
    return url.startsWith('data:image/webp') ? url : c.toDataURL('image/png');
  } catch (_) {
    return '';
  }
}

/* ---------- saving ---------- */
let lastThumb = 0,
  savePromise = Promise.resolve(),
  saveFailed = false;
function writeBoard(forceThumb) {
  if (!board || readOnly) return Promise.resolve();
  const now = Date.now();
  board.updated = now;
  board.count = els.length;
  board.cam = { x: r1(cam.x), y: r1(cam.y), z: cam.z };
  if (forceThumb || now - lastThumb > 5000) {
    board.thumb = makeThumb(els);
    lastThumb = now;
  }
  const meta = { ...board },
    doc = { id: board.id, els: JSON.parse(JSON.stringify(els)) };
  status('Saving…');
  savePromise = Store.save(meta, doc).then(
    () => {
      saveFailed = false;
      status(Store.fallback ? 'Saved (limited storage)' : 'Saved');
    },
    err => {
      console.warn('save failed', err);
      status('Not saved');
      if (!saveFailed)
        toast('Couldn’t save — your browser storage may be full. Download a board file to keep a copy.');
      saveFailed = true;
    }
  );
  return savePromise;
}
function saveMetaOnly() {
  if (!board || readOnly) return;
  board.cam = { x: r1(cam.x), y: r1(cam.y), z: cam.z };
  Store.putMeta({ ...board }).catch(() => {});
}
async function flush() {
  if (!board || readOnly) return;
  clearTimeout(saveT);
  saveT = 0;
  await writeBoard(true);
}

/* ---------- open / create ---------- */
function resetBoardState() {
  commitEdit();
  closePops();
  if (typeof closeCtx === 'function') closeCtx();
  sel.clear();
  undoS = [];
  redoS = [];
  before = null;
  op = null;
  hoverId = null;
  guides = [];
  pasteN = 0;
  document.body.classList.remove('panel-open');
}
async function openBoard(id) {
  if (board && board.id === id && route === 'board') return;
  if (board && route === 'board') await flush();
  const meta = await Store.getBoard(id);
  const doc = meta ? await Store.getDoc(id) : null;
  if (!meta) {
    toast('That board doesn’t exist any more');
    return go('#/', true);
  }
  resetBoardState();
  if (readOnly || tool === 'hand') setTool('select');
  readOnly = false;
  board = meta;
  els = loadEls(doc ? doc.els : []);
  const c = okCam(meta.cam);
  setRoute('board');
  if (c) cam = c;
  setTitle();
  render();
  if (!c) fit();
  lastThumb = Date.now();
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch (_) {}
  emptyHint();
}
async function createBoard(name, list, template, opts = {}) {
  const meta = newMeta(name, template);
  const clean = loadEls(list || []);
  meta.count = clean.length;
  meta.thumb = makeThumb(clean);
  if (opts.cam) meta.cam = opts.cam;
  await Store.save(meta, { id: meta.id, els: clean });
  return meta;
}
async function newBoard(templateId) {
  const t = templateById(templateId);
  const meta = await createBoard(t.id === 'blank' ? 'Untitled board' : t.name, t.build(), t.id);
  go('#/b/' + meta.id);
}
async function duplicateBoard(id) {
  const meta = await Store.getBoard(id),
    doc = await Store.getDoc(id);
  if (!meta) return null;
  return createBoard(meta.name + ' (copy)', doc ? doc.els : [], meta.template, { cam: meta.cam });
}
async function renameBoard(id, name) {
  name =
    String(name || '')
      .trim()
      .slice(0, 80) || 'Untitled board';
  if (board && board.id === id) {
    board.name = name;
    setTitle();
    await Store.putMeta({ ...board });
    return;
  }
  const meta = await Store.getBoard(id);
  if (meta) await Store.putMeta({ ...meta, name });
}
async function deleteBoard(id) {
  const meta = await Store.getBoard(id),
    doc = await Store.getDoc(id);
  await Store.remove(id);
  if (board && board.id === id) board = null;
  return { meta, doc };
}

/* ---------- title + chrome ---------- */
function setTitle() {
  const t = board ? board.name : 'Sketchboard';
  $('#titleBtn').textContent = t;
  $('#titleBtn').title = readOnly ? t : 'Rename board';
  document.title = (board ? t + ' · ' : '') + 'Sketchboard';
}
function emptyHint() {
  $('#empty').hidden = !(route === 'board' && els.length === 0 && !readOnly);
}

/* ---------- routing ---------- */
function setRoute(r) {
  route = r;
  document.body.dataset.route = r;
  if (r !== 'board') {
    resetBoardState();
    $('#empty').hidden = true;
  }
}
function go(hash, replace) {
  if (location.hash === hash) return routeNow();
  if (replace) {
    location.replace(hash);
    routeNow();
  } else location.hash = hash;
}
let routing = Promise.resolve();
function routeNow() {
  routing = routing.then(doRoute).catch(err => console.error(err));
  return routing;
}
async function doRoute() {
  const h = location.hash.slice(1);
  if (h.startsWith('/b/')) return openBoard(decodeURIComponent(h.slice(3)));
  if (h.startsWith('/s/') && typeof openShared === 'function') {
    if (board && route === 'board') await flush();
    return openShared(h.slice(3));
  }
  if (h === '/' || h === '/boards') {
    if (board && route === 'board') await flush();
    return showHome();
  }
  // no route: reopen the last board, or the home screen
  let last = null;
  try {
    last = localStorage.getItem(LAST_KEY);
  } catch (_) {}
  if (last && (await Store.getBoard(last))) return go('#/b/' + last, true);
  return go('#/', true);
}
addEventListener('hashchange', routeNow);

/* ---------- first run + migration from the single-board version ---------- */
async function bootBoards() {
  let migrated = '1',
    welcomed = '1';
  try {
    migrated = localStorage.getItem(LS + '.migrated');
    welcomed = localStorage.getItem(LS + '.welcomed');
  } catch (_) {}
  if (!migrated) {
    let old = null;
    try {
      old = JSON.parse(localStorage.getItem(LS) || 'null');
    } catch (_) {}
    if (old && Array.isArray(old.els) && old.els.length) {
      const meta = await createBoard('My first board', old.els, 'blank', { cam: okCam(old.cam) });
      try {
        localStorage.setItem(LAST_KEY, meta.id);
        localStorage.setItem(LS + '.welcomed', '1');
      } catch (_) {}
      welcomed = '1';
    }
    try {
      localStorage.setItem(LS + '.migrated', '1');
    } catch (_) {}
  }
  if (!welcomed) {
    const list = await Store.listBoards();
    if (!list.length) {
      const meta = await createBoard('Welcome to Sketchboard', sample(true), 'flow');
      try {
        localStorage.setItem(LAST_KEY, meta.id);
      } catch (_) {}
    }
    try {
      localStorage.setItem(LS + '.welcomed', '1');
    } catch (_) {}
  }
  await routeNow();
}
