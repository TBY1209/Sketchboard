/* Paper grain texture and app start-up. */
function grainTile(r, g, b, maxA) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d'),
      im = x.createImageData(128, 128);
    let seed = 7;
    for (let i = 0; i < im.data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const v = seed / 4294967296;
      im.data[i] = r;
      im.data[i + 1] = g;
      im.data[i + 2] = b;
      im.data[i + 3] = v > 0.55 ? Math.round(((v - 0.55) / 0.45) * maxA) : 0;
    }
    x.putImageData(im, 0, 0);
    return 'url(' + c.toDataURL('image/png') + ')';
  } catch (_) {
    return 'none';
  }
}
{
  const st = document.documentElement.style;
  st.setProperty('--noiseL', grainTile(122, 106, 64, 20));
  st.setProperty('--noiseD', grainTile(255, 255, 255, 9));
}

/* ---------- start ---------- */
$('#gridChk').textContent = '✓';
{
  let m = 'auto';
  try {
    m = localStorage.getItem(LS + '.mode') || 'auto';
  } catch (_) {}
  setMode(['auto', 'light', 'dark'].includes(m) ? m : 'auto', true);
}
{
  let y = '0';
  try {
    y = localStorage.getItem(LS + '.sym') || '0';
  } catch (_) {}
  setSym(y === '1', true);
}
setTool('select');
bootBoards();
addEventListener('resize', () => render());
const scrollOK = t => t && t.closest && t.closest('#panel,.mcard,#home,.pop');
document.addEventListener(
  'touchmove',
  e => {
    if (e.touches.length > 1 || !scrollOK(e.target)) e.preventDefault();
  },
  { passive: false }
);
for (const ev of ['gesturestart', 'gesturechange', 'gestureend'])
  document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener(
  'wheel',
  e => {
    if (e.ctrlKey && !e.target.closest('#svg')) e.preventDefault();
  },
  { passive: false }
);
if (document.fonts)
  document.fonts.ready.then(() => {
    wcache.clear();
    render();
  });
