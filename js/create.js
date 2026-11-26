/* Element factories and the sample board. */
function mk(t, x, y, w, h) {
  const st = t === 'sticky';
  if (t === 'frame')
    return Object.assign(mk('rect', x, y, w, h), {
      t,
      fill: 'transparent',
      stroke: 'ink',
      dash: 'solid',
      sw: 2,
      font: 'sans',
      fs: 16,
      bold: true,
      it: false,
      tc: 'auto',
      rad: 14,
      sh: false,
      text: 'Frame ' + (els.filter(e => e.t === 'frame').length + 1)
    });
  if (t === 'img')
    return Object.assign(mk('rect', x, y, w, h), {
      t,
      fill: 'transparent',
      stroke: 'transparent',
      sw: 0,
      rad: 0,
      sh: false
    });
  return {
    id: uid(),
    t,
    x,
    y,
    w,
    h,
    fill: st ? '#fff3a6' : t === 'text' ? 'transparent' : def.fill,
    stroke: st ? 'transparent' : t === 'text' ? 'ink' : def.stroke,
    sw: def.sw,
    dash: st ? 'solid' : def.dash,
    font: def.font,
    fs: st ? 18 : t === 'text' ? Math.max(def.fs, 20) : def.fs,
    op: def.op,
    text: '',
    tc: def.tc,
    bold: def.bold,
    it: def.it,
    ta: def.ta,
    va: def.va,
    rad: t === 'round' ? 18 : st ? 4 : t === 'rect' ? def.rad : 0,
    sh: st ? true : def.sh
  };
}
const mkLine = (a, b) => ({
  id: uid(),
  t: 'line',
  a,
  b,
  fill: 'transparent',
  stroke: def.stroke === 'transparent' ? 'ink' : def.stroke,
  sw: def.sw,
  dash: def.dash,
  font: def.font,
  fs: Math.min(def.fs, 18),
  op: def.op,
  route: def.route,
  head: def.head,
  hk: def.hk,
  k: 0.5,
  text: '',
  tc: 'auto',
  bold: false,
  it: false,
  ta: 'center',
  va: 'middle',
  rad: 0,
  sh: false
});
function sample(welcome) {
  const S = (t, x, y, w, h, text, fill, o = {}) =>
    Object.assign(mk(t, x, y, w, h), { text, fill, stroke: t === 'sticky' ? 'transparent' : 'ink' }, o);
  const a = S('ellipse', 0, 40, 170, 96, 'New idea', '#fff3a6'),
    b = S('round', 250, 40, 180, 96, 'Sketch it out', '#d0ebff'),
    c = S('diamond', 510, 18, 200, 140, 'Worth building?', '#e5dbff'),
    d = S('rect', 800, 40, 180, 96, 'Build it', '#d3f9d8'),
    e = S('para', 512, 250, 196, 90, 'Park it for later', '#ffc9c9', { dash: 'dash' }),
    t = S('text', 0, -60, 520, 52, welcome ? 'Product flow (sample board)' : 'Product flow', 'transparent', {
      fs: 32,
      stroke: 'ink'
    }),
    n = S(
      'sticky',
      800,
      220,
      210,
      190,
      'Tap a shape: a toolbar pops up with delete. Tap it again to type. Drag a blue dot to connect.',
      '#fff3a6',
      { fs: 18 }
    );
  const L = (x, y, text = '', route = 'curve') =>
    Object.assign(mkLine({ id: x.id, x: 0, y: 0 }, { id: y.id, x: 0, y: 0 }), { text, route, fs: 16 });
  return [
    t,
    a,
    b,
    c,
    d,
    e,
    ...(welcome ? [n] : []),
    L(a, b),
    L(b, c),
    L(c, d, 'yes', 'straight'),
    L(c, e, 'no', 'rounded')
  ];
}
