/* Persistent storage for boards. IndexedDB with three stores:
     boards: {id, name, created, updated, thumb, template}   (small metadata, listed on the home screen)
     docs:   {id, els, cam}                                    (the board contents)
     blobs:  {hash, blob, type}                                (images, deduped by content hash)
   Falls back to localStorage if IndexedDB is unavailable (some private browsing modes). */
const Store = (() => {
  const NAME = 'sketchboard',
    VER = 1;
  let dbP = null;

  function open() {
    if (dbP) return dbP;
    dbP = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no indexedDB'));
      const r = indexedDB.open(NAME, VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('boards')) d.createObjectStore('boards', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('docs')) d.createObjectStore('docs', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs', { keyPath: 'hash' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('indexedDB blocked'));
    });
    return dbP;
  }
  const req = r =>
    new Promise((res, rej) => {
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  async function run(stores, mode, fn) {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(stores, mode);
      let out;
      Promise.resolve(fn(name => t.objectStore(name))).then(v => (out = v), rej);
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('aborted'));
    });
  }

  /* localStorage fallback: same API, one key per record */
  const LSP = 'sketchboard.db.';
  const ls = {
    get: (s, id) => {
      try {
        return JSON.parse(localStorage.getItem(LSP + s + '.' + id) || 'null');
      } catch (_) {
        return null;
      }
    },
    put: (s, id, v) => localStorage.setItem(LSP + s + '.' + id, JSON.stringify(v)),
    del: (s, id) => localStorage.removeItem(LSP + s + '.' + id),
    all: s => {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(LSP + s + '.')) out.push(ls.get(s, k.slice(LSP.length + s.length + 1)));
      }
      return out.filter(Boolean);
    }
  };
  let useLS = false;
  async function guard(idbFn, lsFn) {
    if (!useLS) {
      try {
        return await idbFn();
      } catch (err) {
        if (
          !dbP ||
          (err &&
            /no indexedDB|blocked|InvalidState|UnknownError|SecurityError/i.test(err.name + err.message))
        ) {
          useLS = true;
        } else throw err;
      }
    }
    return lsFn();
  }

  return {
    get fallback() {
      return useLS;
    },
    listBoards: () =>
      guard(
        () => run('boards', 'readonly', s => req(s('boards').getAll())),
        () => ls.all('boards')
      ),
    getBoard: id =>
      guard(
        () => run('boards', 'readonly', s => req(s('boards').get(id))),
        () => ls.get('boards', id)
      ),
    getDoc: id =>
      guard(
        () => run('docs', 'readonly', s => req(s('docs').get(id))),
        () => ls.get('docs', id)
      ),
    /* write metadata and (optionally) contents in one transaction */
    save: (meta, doc) =>
      guard(
        () =>
          run(['boards', 'docs'], 'readwrite', s => {
            s('boards').put(meta);
            if (doc) s('docs').put(doc);
          }),
        () => {
          ls.put('boards', meta.id, meta);
          if (doc) ls.put('docs', doc.id, doc);
        }
      ),
    putMeta: meta =>
      guard(
        () => run('boards', 'readwrite', s => s('boards').put(meta)),
        () => ls.put('boards', meta.id, meta)
      ),
    remove: id =>
      guard(
        () =>
          run(['boards', 'docs'], 'readwrite', s => {
            s('boards').delete(id);
            s('docs').delete(id);
          }),
        () => {
          ls.del('boards', id);
          ls.del('docs', id);
        }
      ),
    putBlob: (hash, blob) =>
      guard(
        () => run('blobs', 'readwrite', s => s('blobs').put({ hash, blob, type: blob.type })),
        () => {
          throw new Error('Images need IndexedDB');
        }
      ),
    getBlob: hash =>
      guard(
        () => run('blobs', 'readonly', s => req(s('blobs').get(hash))).then(r => (r ? r.blob : null)),
        () => null
      ),
    estimate: async () => {
      try {
        return navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
      } catch (_) {
        return null;
      }
    }
  };
})();
