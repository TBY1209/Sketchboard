/* Home screen: templates row, board grid, search, sort, per-board menu. */
let homeSort = 'recent',
  homeList = [];
const tplThumbs = {};
try {
  homeSort = localStorage.getItem(LS + '.sort') || 'recent';
} catch (_) {}

function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  if (s < 172800) return 'yesterday';
  const d = new Date(t);
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  });
}

async function showHome() {
  setRoute('home');
  board = null;
  readOnly = false;
  document.title = 'Sketchboard';
  homeList = await Store.listBoards();
  renderHome();
  hThemeIcon();
}

function renderHome() {
  // templates (thumbnails are generated once per session)
  const tp = $('#tpls');
  if (!tp.childElementCount)
    tp.innerHTML = TEMPLATES.map(t => {
      if (t.id !== 'blank' && !tplThumbs[t.id]) tplThumbs[t.id] = makeThumb(t.build(), 360, 220);
      const pic =
        t.id === 'blank'
          ? `<div class="tthumb tblank"><svg class="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></div>`
          : `<div class="tthumb"><img alt="" src="${tplThumbs[t.id]}"></div>`;
      return `<button class="tcard" data-tpl="${t.id}">${pic}<b>${esc(t.name)}</b><span>${esc(t.desc)}</span></button>`;
    }).join('');
  for (const b of $('#hsort').children) b.classList.toggle('on', b.dataset.sort === homeSort);

  const q = $('#hq').value.trim().toLowerCase();
  let list = homeList.filter(b => !q || b.name.toLowerCase().includes(q));
  list.sort(homeSort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.updated - a.updated);
  $('#bcount').textContent = homeList.length ? homeList.length : '';
  const g = $('#boards');
  if (!homeList.length) {
    g.innerHTML = `<div class="hempty"><b>No boards yet</b><span>Pick a template above to start your first one.</span></div>`;
  } else if (!list.length) {
    g.innerHTML = `<div class="hempty"><b>Nothing matches “${esc(q)}”</b><span>Try another word, or clear the search.</span></div>`;
  } else
    g.innerHTML = list
      .map(
        b => `<article class="bcard" data-id="${esc(b.id)}">
  <a class="bopen" href="#/b/${encodeURIComponent(b.id)}" aria-label="Open ${esc(b.name)}">
    <div class="bthumb">${b.thumb ? `<img alt="" loading="lazy" src="${b.thumb}">` : '<span class="bnone">Empty board</span>'}</div>
    <div class="bmeta"><b>${esc(b.name)}</b><span>Edited ${ago(b.updated)}${b.count ? ' · ' + b.count + (b.count === 1 ? ' item' : ' items') : ''}</span></div>
  </a>
  <button class="bmore" data-more="${esc(b.id)}" aria-label="Options for ${esc(b.name)}" title="Options"><svg class="ico" viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/></svg></button>
</article>`
      )
      .join('');
  storageFooter();
}
async function storageFooter() {
  const e = await Store.estimate(),
    f = $('#hfoot');
  let t = 'Boards are saved in this browser on this device. Download a board file to back one up or move it.';
  if (Store.fallback)
    t = 'This browser blocks full storage (private mode?), so boards may not survive closing it.';
  else if (e && e.quota) {
    const mb = n => (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
    t += ` Using ${mb(e.usage || 0)}.`;
  }
  f.textContent = t;
}

function hThemeIcon() {
  $('#hTheme').innerHTML = `<svg class="ico" viewBox="0 0 24 24">${MODEI[mode]}</svg>`;
}
$('#hTheme').addEventListener('click', () => {
  nextMode();
  hThemeIcon();
});
$('#hImport').addEventListener('click', () => $('#file').click());
$('#hq').addEventListener('input', renderHome);
$('#hsort').addEventListener('click', e => {
  const b = e.target.closest('[data-sort]');
  if (!b) return;
  homeSort = b.dataset.sort;
  try {
    localStorage.setItem(LS + '.sort', homeSort);
  } catch (_) {}
  renderHome();
});
$('#tpls').addEventListener('click', e => {
  const b = e.target.closest('[data-tpl]');
  if (b) newBoard(b.dataset.tpl);
});

/* per-board menu */
let bmenuId = null;
$('#boards').addEventListener('click', e => {
  const m = e.target.closest('[data-more]');
  if (!m) return;
  e.preventDefault();
  e.stopPropagation();
  openBoardMenu(m.dataset.more, m);
});
$('#boards').addEventListener('contextmenu', e => {
  const c = e.target.closest('.bcard');
  if (!c) return;
  e.preventDefault();
  openBoardMenu(c.dataset.id, {
    getBoundingClientRect: () => ({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY })
  });
});
function openBoardMenu(id, anchor) {
  bmenuId = id;
  const m = $('#bmenu');
  const I = p => `<svg class="ico" viewBox="0 0 24 24">${p}</svg>`;
  m.innerHTML = [
    ['open', I('<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>'), 'Open'],
    ['rename', I('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'), 'Rename'],
    ['dup', I(ICON.dup), 'Duplicate'],
    ['download', I('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'), 'Download board file'],
    ['del', I(ICON.del), 'Delete', 'danger']
  ]
    .map(
      ([a, i, t, c]) => `<button data-bm="${a}" role="menuitem"${c ? ` class="${c}"` : ''}>${i}${t}</button>`
    )
    .join('');
  m.hidden = false;
  const r = anchor.getBoundingClientRect(),
    w = m.offsetWidth,
    h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  m.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
}
const closeBoardMenu = () => ($('#bmenu').hidden = true);
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#bmenu,[data-more]')) closeBoardMenu();
});
$('#bmenu').addEventListener('click', async e => {
  const b = e.target.closest('[data-bm]');
  if (!b) return;
  const id = bmenuId,
    a = b.dataset.bm;
  closeBoardMenu();
  const meta = homeList.find(x => x.id === id);
  if (!meta) return;
  if (a === 'open') go('#/b/' + id);
  else if (a === 'rename') {
    const name = await askText('Rename board', meta.name, 'Rename');
    if (name != null) {
      await renameBoard(id, name);
      showHome();
    }
  } else if (a === 'dup') {
    await duplicateBoard(id);
    showHome();
    toast('Board duplicated');
  } else if (a === 'download') {
    const doc = await Store.getDoc(id);
    const s = JSON.stringify({ sketchboard: 1, name: meta.name, els: doc ? doc.els : [] });
    const prev = board;
    board = meta;
    deliver(fileBase() + '.json', s, () => {});
    board = prev;
  } else if (a === 'del') {
    const gone = await deleteBoard(id);
    showHome();
    toast(`Deleted “${meta.name}”`, {
      label: 'Undo',
      run: async () => {
        if (gone.meta) await Store.save(gone.meta, gone.doc || { id, els: [] });
        showHome();
      }
    });
  }
});

/* small text prompt in the app's modal */
function askText(title, value, ok) {
  return new Promise(res => {
    modal(
      `<h3>${esc(title)}</h3><input id="askIn" class="tin" maxlength="80" value="${esc(value || '')}" aria-label="${esc(title)}"><div class="mrow"><button class="btn" data-ask="0">Cancel</button><button class="btn pri" data-ask="1">${esc(ok || 'OK')}</button></div>`
    );
    const inp = $('#askIn');
    setTimeout(() => {
      inp.focus();
      inp.select();
    }, 30);
    const done = v => {
      $('#modal').removeEventListener('click', onClick);
      inp.removeEventListener('keydown', onKey);
      closeModal();
      res(v);
    };
    const onClick = e => {
      const b = e.target.closest('[data-ask]');
      if (b) done(b.dataset.ask === '1' ? inp.value : null);
      else if (e.target.id === 'modal') done(null);
    };
    const onKey = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        done(inp.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        done(null);
      }
    };
    $('#modal').addEventListener('click', onClick);
    inp.addEventListener('keydown', onKey);
  });
}

/* board top bar */
$('#homeBtn').addEventListener('click', () => go('#/'));
$('#titleBtn').addEventListener('click', async () => {
  if (!board || readOnly) return;
  const name = await askText('Rename board', board.name, 'Rename');
  if (name != null) renameBoard(board.id, name);
});
