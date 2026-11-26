/* Style panel (left card). */
const ICON = {
  front:
    '<rect x="9" y="9" width="11" height="11" rx="2" fill="currentColor" fill-opacity=".25"/><path d="M5 15V5h10"/>',
  back: '<rect x="4" y="4" width="11" height="11" rx="2"/><path d="M9 19h11V9" stroke-opacity=".5"/>',
  dup: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V4.5h-11v11h4"/>',
  del: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  straight: '<path d="M5 19L19 5"/>',
  elbow: '<path d="M5 19h7V5h7"/>',
  curve: '<path d="M5 19C13 19 11 5 19 5"/>',
  none: '<path d="M4 12h16"/>',
  end: '<path d="M4 12h15M14 7l5 5-5 5"/>',
  both: '<path d="M5 12h14M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
  solid: '<path d="M4 12h16"/>',
  dash: '<path d="M4 12h4M10 12h4M16 12h4"/>',
  dot: '<path d="M4 12h.1M8 12h.1M12 12h.1M16 12h.1M20 12h.1" stroke-width="2.6"/>',
  rounded: '<path d="M5 19h3.5a4.5 4.5 0 004.5-4.5v-5A4.5 4.5 0 0117.5 5H19"/>',
  hTri: '<path d="M4 12h8"/><path d="M12 6.5l8 5.5-8 5.5z" fill="currentColor"/>',
  hOpen: '<path d="M4 12h15M13.5 6.5L19 12l-5.5 5.5"/>',
  hDot: '<path d="M4 12h9"/><circle cx="17" cy="12" r="3.6" fill="currentColor"/>',
  hDia: '<path d="M4 12h5"/><path d="M9 12l5.2-4.6 5.2 4.6-5.2 4.6z" fill="currentColor"/>',
  rev: '<path d="M7 4L3.5 7.5 7 11M3.5 7.5H16M17 13l3.5 3.5L17 20M20.5 16.5H8"/>',
  alignL:
    '<path d="M4 3v18"/><rect x="7" y="6" width="12" height="4" rx="1"/><rect x="7" y="14" width="7" height="4" rx="1"/>',
  alignC:
    '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
  alignR:
    '<path d="M20 3v18"/><rect x="5" y="6" width="12" height="4" rx="1"/><rect x="10" y="14" width="7" height="4" rx="1"/>',
  alignT:
    '<path d="M3 4h18"/><rect x="6" y="7" width="4" height="12" rx="1"/><rect x="14" y="7" width="4" height="7" rx="1"/>',
  alignM:
    '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  alignB:
    '<path d="M3 20h18"/><rect x="6" y="5" width="4" height="12" rx="1"/><rect x="14" y="10" width="4" height="7" rx="1"/>',
  distH: '<path d="M4 3v18M20 3v18"/><rect x="9.5" y="7" width="5" height="10" rx="1"/>',
  distV: '<path d="M3 4h18M3 20h18"/><rect x="7" y="9.5" width="10" height="5" rx="1"/>',
  matchW: '<path d="M3.5 5v14M20.5 5v14"/><path d="M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3"/>',
  matchH: '<path d="M5 3.5h14M5 20.5h14"/><path d="M12 7v10M9 10l3-3 3 3M9 14l3 3 3-3"/>',
  sym: '<path d="M12 3v18" stroke-dasharray="2.4 2.4"/><path d="M9.5 7L4 12l5.5 5z"/><path d="M14.5 7L20 12l-5.5 5z"/>',
  edit: '<path d="M4 19h6M7 19V6M3.5 6h7M14 19l3.5-9 3.5 9M15.2 16h4.6"/>',
  pal: '<path d="M12 3a9 9 0 100 18c1.2 0 1.6-1 1.1-2-.6-1.2.2-2.5 1.5-2.5H17a4 4 0 004-4c0-5-4-9.5-9-9.5z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15.5" cy="7.5" r="1.2"/>',
  multi:
    '<rect x="3.5" y="3.5" width="12" height="12" rx="2.5" stroke-dasharray="3 2.6"/><path d="M15.5 14v6.5M12.3 17.3h6.4"/>'
};
const ic = (k, w) =>
  `<svg class="ico" viewBox="0 0 24 24"${w ? ` style="stroke-width:${w}"` : ''}>${ICON[k]}</svg>`;
const sec = (t, h) => `<div class="sec"><h4>${t}</h4>${h}</div>`;
const seg = (k, opts, cur) =>
  `<div class="seg">${opts.map(([v, l, ti]) => `<button data-k="${k}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}" title="${ti || ''}" aria-label="${ti || v}">${l}</button>`).join('')}</div>`;
const swatch = (k, list, cur) =>
  `<div class="sw">${list.map(c => `<button data-k="${k}" data-v="${c}" class="${c === cur ? 'on ' : ''}${c === 'transparent' ? 'none' : c === 'ink' ? 'inkc' : ''}" style="${c.startsWith('#') ? `background:${c}` : ''}" title="${c === 'transparent' ? 'None' : c === 'ink' ? 'Ink' : c}" aria-label="${c === 'transparent' ? 'None' : c === 'ink' ? 'Ink' : c}"></button>`).join('')}</div>`;
let pKey = '';
const TCOLS = [
  'auto',
  'ink',
  '#ffffff',
  '#e03131',
  '#f08c00',
  '#2f9e44',
  '#1971c2',
  '#7048e8',
  '#c2255c',
  '#868e96'
];
const AL = {
  left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  top: '<path d="M4 4h16M8 9h8M8 13h8"/>',
  middle: '<path d="M4 4h16M4 20h16M8 10h8M8 14h8"/>',
  bottom: '<path d="M4 20h16M8 11h8M8 15h8"/>'
};
const al = k => `<svg class="ico" viewBox="0 0 24 24">${AL[k]}</svg>`;
const swatchC = (k, list, cur) => {
  const L = [...list];
  if (cur && cur.startsWith('#') && !L.includes(cur))
    L.splice(L.length - (L.includes('transparent') ? 1 : 0), 0, cur);
  return `<div class="sw">${L.map(c => `<button data-k="${k}" data-v="${c}" class="${c === cur ? 'on ' : ''}${c === 'transparent' ? 'none' : c === 'ink' ? 'inkc' : c === 'auto' ? 'auto' : ''}" style="${c.startsWith('#') ? `background:${c}` : ''}" title="${c === 'transparent' ? 'None' : c === 'ink' ? 'Ink' : c === 'auto' ? 'Automatic' : c}" aria-label="${c === 'transparent' ? 'None' : c === 'ink' ? 'Ink' : c === 'auto' ? 'Automatic' : c}"></button>`).join('')}<button class="add" data-pick="${k}" title="Custom colour" aria-label="Custom colour"></button></div>`;
};
const connSecs = L => {
  const v = k => L[0][k];
  return (
    sec(
      'Connector',
      seg(
        'route',
        [
          ['curve', ic('curve'), 'Curved'],
          ['elbow', ic('elbow'), 'Straight 90° elbow'],
          ['rounded', ic('rounded'), 'Rounded elbow'],
          ['straight', ic('straight'), 'Straight line']
        ],
        v('route')
      )
    ) +
    sec(
      'Arrows',
      seg(
        'head',
        [
          ['end', ic('end'), 'Arrow at end'],
          ['both', ic('both'), 'Arrows both ends'],
          ['none', ic('none'), 'No arrows']
        ],
        v('head')
      )
    ) +
    sec(
      'Arrowhead',
      seg(
        'hk',
        [
          ['tri', ic('hTri'), 'Filled'],
          ['open', ic('hOpen'), 'Open'],
          ['dot', ic('hDot'), 'Dot'],
          ['dia', ic('hDia'), 'Diamond']
        ],
        v('hk') || 'tri'
      )
    )
  );
};
function arrangeSec() {
  return sec(
    'Arrange',
    `<div class="row"><button data-a="front" title="Bring to front (])" aria-label="Bring to front">${ic('front')}</button><button data-a="back" title="Send to back ([)" aria-label="Send to back">${ic('back')}</button><button data-a="dup" title="Duplicate (Ctrl+D)" aria-label="Duplicate">${ic('dup')}</button><button data-a="del" class="danger" title="Delete" aria-label="Delete">${ic('del')}</button></div>`
  );
}
function panel() {
  const S = selEls(),
    P = $('#panel');
  document.body.classList.toggle('has-sel', S.length > 0);
  const key =
    pTab +
    '|' +
    [...sel].join() +
    '|' +
    S.map(e =>
      [
        e.t,
        e.fill,
        e.stroke,
        e.sw,
        e.dash,
        e.font,
        e.fs,
        e.op,
        e.route,
        e.head,
        e.hk,
        e.tc,
        e.bold,
        e.it,
        e.ta,
        e.va,
        e.rad,
        e.sh
      ].join()
    ).join(';');
  if (key === pKey) return;
  pKey = key;
  if (!S.length) {
    P.innerHTML = '';
    document.body.classList.remove('panel-open');
    return;
  }
  if (S.every(e => e.t === 'frame' || e.t === 'img')) {
    const fr = S.filter(e => e.t === 'frame');
    let h = `<button class="pclose" data-a="close" aria-label="Close style menu" title="Close">×</button>`;
    if (fr.length) h += sec('Frame colour', swatchC('fill', FILLS, fr[0].fill));
    h += sec(
      'Opacity',
      seg(
        'op',
        [
          [1, '100%'],
          [0.75, '75%'],
          [0.5, '50%'],
          [0.25, '25%']
        ],
        S[0].op
      )
    );
    P.innerHTML = h + arrangeSec();
    return;
  }
  const shapes = S.filter(e => SHAPES.includes(e.t) || e.t === 'sticky'),
    fillable = S.filter(e => e.t !== 'line' && e.t !== 'pen' && e.t !== 'text' && e.t !== 'img'),
    lines = S.filter(e => e.t === 'line'),
    texty = S.filter(e => e.t !== 'pen' && e.t !== 'frame' && e.t !== 'img'),
    onlyText = S.every(e => e.t === 'text'),
    rounded = S.filter(e => ['rect', 'round', 'sticky'].includes(e.t)),
    boxes = S.filter(e => e.t !== 'line' && e.t !== 'pen' && e.t !== 'frame' && e.t !== 'img');
  let tab = pTab;
  if (onlyText) tab = 'text';
  if (!texty.length) tab = 'shape';
  const v = (k, l = S) => l[0] && l[0][k];
  let h = `<button class="pclose" data-a="close" aria-label="Close style menu" title="Close">×</button>`;
  if (!onlyText && texty.length)
    h += `<div class="tabs" role="tablist"><button data-tab="shape" role="tab" class="${tab === 'shape' ? 'on' : ''}">Shape</button><button data-tab="text" role="tab" class="${tab === 'text' ? 'on' : ''}">Text</button></div>`;
  if (tab === 'shape') {
    if (shapes.length === S.length)
      h += sec(
        'Shape',
        `<div class="grid6">${[...SHAPES, 'sticky'].map(t => `<button data-k="t" data-v="${t}" class="${v('t') === t ? 'on' : ''}" title="${NAMES[t]}" aria-label="${NAMES[t]}">${shapeIcon(t, 20)}</button>`).join('')}</div>`
      );
    if (fillable.length) h += sec('Fill', swatchC('fill', FILLS, v('fill', fillable)));
    const L0 = lines.length === S.length;
    if (lines.length) h += connSecs(lines);
    h += sec(L0 ? 'Colour' : 'Border', swatchC('stroke', STROKES, v('stroke')));
    h +=
      sec(
        L0 ? 'Thickness' : 'Border width',
        seg(
          'sw',
          [
            [1, ic('solid', 1), 'Thin'],
            [2, ic('solid', 2.4), 'Medium'],
            [4, ic('solid', 4.4), 'Bold'],
            [7, ic('solid', 7), 'Extra bold']
          ],
          v('sw')
        )
      ) +
      sec(
        L0 ? 'Line style' : 'Border style',
        seg(
          'dash',
          [
            ['solid', ic('solid'), 'Solid'],
            ['dash', ic('dash'), 'Dashed'],
            ['dot', ic('dot'), 'Dotted']
          ],
          v('dash')
        )
      );
    if (rounded.length)
      h += sec(
        'Corners',
        seg(
          'rad',
          [
            [0, 'Sharp', 'Sharp corners'],
            [8, 'Soft', 'Soft corners'],
            [18, 'Round', 'Round corners'],
            [999, 'Pill', 'Pill']
          ],
          v('rad', rounded)
        )
      );
    if (fillable.length)
      h += sec(
        'Shadow',
        seg(
          'sh',
          [
            [false, 'Off', 'No shadow'],
            [true, 'On', 'Drop shadow']
          ],
          !!v('sh', fillable)
        )
      );
    h += sec(
      'Opacity',
      seg(
        'op',
        [
          [1, '100%'],
          [0.75, '75%'],
          [0.5, '50%'],
          [0.25, '25%']
        ],
        v('op')
      )
    );
  } else {
    const T = texty;
    h += sec(
      'Font',
      `<div class="fgrid">${Object.keys(FONTS)
        .map(
          k =>
            `<button data-k="font" data-v="${k}" class="${v('font', T) === k ? 'on' : ''}" style="font-family:${FONTS[k]}" title="${FNAMES[k]}">${FNAMES[k]}</button>`
        )
        .join('')}</div>`
    );
    h += sec(
      'Size',
      `<div class="step"><button data-fs="-1" aria-label="Smaller text">−</button><b>${Math.round(v('fs', T))}</b><button data-fs="1" aria-label="Larger text">+</button></div>` +
        seg(
          'fs',
          [
            [14, 'S', 'Small'],
            [20, 'M', 'Medium'],
            [28, 'L', 'Large'],
            [40, 'XL', 'Extra large']
          ],
          v('fs', T)
        )
    );
    h += sec(
      'Style',
      `<div class="seg"><button data-k="bold" data-v="${!v('bold', T)}" class="${v('bold', T) ? 'on' : ''}" aria-label="Bold" title="Bold"><b style="font-size:17px">B</b></button><button data-k="it" data-v="${!v('it', T)}" class="${v('it', T) ? 'on' : ''}" aria-label="Italic" title="Italic"><i style="font-family:Georgia,serif;font-size:18px">I</i></button></div>`
    );
    h += sec(
      'Alignment',
      seg(
        'ta',
        [
          ['left', al('left'), 'Align left'],
          ['center', al('center'), 'Centre'],
          ['right', al('right'), 'Align right']
        ],
        v('ta', T)
      ) +
        (boxes.length
          ? seg(
              'va',
              [
                ['top', al('top'), 'Top'],
                ['middle', al('middle'), 'Middle'],
                ['bottom', al('bottom'), 'Bottom']
              ],
              v('va', boxes)
            )
          : '')
    );
    h += sec('Text colour', swatchC('tc', TCOLS, v('tc', T)));
  }
  h += arrangeSec();
  P.innerHTML = h;
}
function applyRaw(k, val) {
  for (const e of selEls()) {
    if (e.t === 'frame' && k !== 'fill' && k !== 'op') continue;
    if (e.t === 'img' && k !== 'op') continue;
    if (k === 'fill' && (e.t === 'line' || e.t === 'pen' || e.t === 'text')) continue;
    if ((k === 'route' || k === 'head' || k === 'hk') && e.t !== 'line') continue;
    if (['font', 'fs', 'tc', 'bold', 'it', 'ta', 'va'].includes(k) && e.t === 'pen') continue;
    if (k === 'va' && e.t === 'line') continue;
    if (k === 'rad' && !['rect', 'round', 'sticky'].includes(e.t)) continue;
    if (k === 'sh' && (e.t === 'line' || e.t === 'pen' || e.t === 'text')) continue;
    if (k === 't') {
      if (!(SHAPES.includes(e.t) || e.t === 'sticky')) continue;
      if (val === 'sticky') {
        e.stroke = 'transparent';
        if (e.fill === 'transparent') e.fill = '#fff3a6';
        e.dash = 'solid';
        e.sh = true;
      } else if (e.t === 'sticky' && e.stroke === 'transparent') {
        e.stroke = 'ink';
        e.sh = false;
      }
      if (val === 'round' && !e.rad) e.rad = 18;
    }
    if (k === 'stroke' && val === 'transparent' && (e.t === 'line' || e.t === 'pen')) continue;
    e[k] = val;
    if (k === 'route') e.k = 0.5;
    if (['fs', 'font', 't', 'bold', 'it'].includes(k)) fitText(e);
  }
  if (k !== 't' && selEls().some(e => e.t !== 'frame' && e.t !== 'img')) def[k] = val;
}
function apply(k, val) {
  begin();
  applyRaw(k, val);
  end();
  render();
}
function stepFs(dir) {
  begin();
  for (const e of selEls()) {
    if (e.t === 'pen') continue;
    const f = e.fs;
    let n = dir > 0 ? FSTEPS.find(x => x > f + 0.01) : [...FSTEPS].reverse().find(x => x < f - 0.01);
    e.fs = n || f;
    def.fs = e.fs;
    fitText(e);
  }
  end();
  render();
}
const NUMK = new Set(['sw', 'fs', 'rad', 'op']),
  BOOLK = new Set(['bold', 'it', 'sh']);
$('#panel').addEventListener('pointerdown', e => {
  if (e.target.closest('button') && !e.target.closest('[data-pick]')) e.preventDefault();
});
$('#panel').addEventListener('mousedown', e => {
  if (e.target.closest('button') && !e.target.closest('[data-pick]')) e.preventDefault();
});
$('#panel').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.tab) {
    pTab = b.dataset.tab;
    pKey = '';
    panel();
    return;
  }
  if (b.dataset.fs) {
    stepFs(+b.dataset.fs);
    return;
  }
  if (b.dataset.pick) {
    const k = b.dataset.pick,
      c = $('#cpick'),
      cur = (selEls()[0] || {})[k];
    c.dataset.k = k;
    c.value = /^#[0-9a-f]{6}$/i.test(cur) ? cur : cur === 'ink' ? '#1e1e1e' : '#4c6ef5';
    c.click();
    return;
  }
  if (b.dataset.k) {
    const k = b.dataset.k,
      v = b.dataset.v;
    apply(k, NUMK.has(k) ? +v : BOOLK.has(k) ? v === 'true' : v);
    return;
  }
  const a = b.dataset.a;
  if (a === 'close') {
    document.body.classList.remove('panel-open');
    return;
  }
  if (a === 'front') order(true);
  else if (a === 'back') order(false);
  else if (a === 'dup') dup();
  else if (a === 'del') del();
});
$('#cpick').addEventListener('input', e => {
  begin();
  applyRaw(e.target.dataset.k, e.target.value.toLowerCase());
  render();
});
$('#cpick').addEventListener('change', () => end());
function narrow() {
  return innerWidth <= 600;
}
function openPanel(tab) {
  if (tab) pTab = tab;
  pKey = '';
  document.body.classList.add('panel-open');
  panel();
  ensureVisible(true);
}
function ensureVisible(force) {
  if (!narrow() || !sel.size || !document.body.classList.contains('panel-open')) return;
  const b = selBounds(),
    z = cam.z,
    pw = Math.min(184, innerWidth * 0.5) + 16,
    free = innerWidth - pw - 8,
    vh = window.visualViewport ? visualViewport.height : innerHeight,
    top = 68,
    bot = editing ? Math.min(vh, innerHeight * 0.56) : innerHeight - 84;
  if (editing) {
    const e = byId(editing);
    if (e) {
      const z2 = Math.min(
        Math.max(z, 15 / e.fs),
        (free - 24) / (b.w || 1),
        (bot - top - 16) / (b.h || 1),
        2.5
      );
      if (Math.abs(z2 - z) > 0.01 && z2 > z) cam.z = z2;
    }
  }
  const Z = cam.z,
    cx = (b.x + b.w / 2) * Z,
    cy = (b.y + b.h / 2) * Z,
    l = b.x * Z + cam.x,
    r = (b.x + b.w) * Z + cam.x,
    t = b.y * Z + cam.y,
    bt = (b.y + b.h) * Z + cam.y;
  if (force || Z !== z || l < pw + 8 || r > innerWidth - 8) cam.x = pw + free / 2 - cx;
  if (force || Z !== z || t < top || bt > bot - 8) cam.y = (top + bot) / 2 - cy;
  renderCam();
  saveCamSoon();
}
function fitPanel() {
  const vv = window.visualViewport,
    h = vv ? vv.height : innerHeight;
  document.documentElement.style.setProperty('--vvl', (vv ? Math.max(0, vv.offsetLeft) : 0) + 'px');
  document.documentElement.style.setProperty('--vvt', (vv ? Math.max(0, vv.offsetTop) : 0) + 'px');
  document.documentElement.style.setProperty(
    '--pmax',
    Math.max(180, Math.min(h - 74, innerHeight - 150)) + 'px'
  );
}
fitPanel();
addEventListener('resize', fitPanel);
addEventListener(
  'scroll',
  () => {
    if (scrollX || scrollY) scrollTo(0, 0);
  },
  { passive: true }
);
if (window.visualViewport) visualViewport.addEventListener('scroll', fitPanel);
if (window.visualViewport)
  visualViewport.addEventListener('resize', () => {
    fitPanel();
    if (editing) ensureVisible(true);
  });
