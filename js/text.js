/* Text measuring, wrapping and layout inside shapes. */
const mctx = document.createElement('canvas').getContext('2d'),
  wcache = new Map();
function wrap(text, font, max) {
  const key = font + '|' + Math.round(max) + '|' + text;
  if (wcache.has(key)) return wcache.get(key);
  if (wcache.size > 3000) wcache.clear();
  mctx.font = font;
  const W = s => mctx.measureText(s).width,
    out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/(\s+)/)) {
      if (!w) continue;
      const t = line + w;
      if (W(t) > max && line.trim()) {
        out.push(line.trimEnd());
        line = w.trimStart();
      } else line = t;
      while (W(line) > max && line.length > 1) {
        let i = line.length - 1;
        while (i > 1 && W(line.slice(0, i)) > max) i--;
        out.push(line.slice(0, i));
        line = line.slice(i);
      }
    }
    out.push(line.trimEnd());
  }
  wcache.set(key, out);
  return out;
}
function textLines(e, b, force) {
  const lh = e.fs * 1.25,
    ls = wrap(e.text, fontStr(e), b.w),
    n = ls.length,
    ta = force ? 'center' : e.ta,
    va = force ? 'middle' : e.va;
  const x = ta === 'left' ? b.x : ta === 'right' ? b.x + b.w : b.x + b.w / 2,
    c0 =
      va === 'top'
        ? b.y + lh / 2
        : va === 'bottom'
          ? b.y + b.h - n * lh + lh / 2
          : b.y + b.h / 2 - ((n - 1) * lh) / 2;
  return ls.map((s, i) => ({ s, x, y: c0 + i * lh + e.fs * 0.36 }));
}
const anchor = (e, force) => (force || e.ta === 'center' ? 'middle' : e.ta === 'left' ? 'start' : 'end');
function textSVG(e, b, color, halo, force) {
  const L = textLines(e, b, force);
  return `<text text-anchor="${anchor(e, force)}" style="font-family:${FONTS[e.font]};font-size:${e.fs}px;font-weight:${e.bold ? 700 : 400};font-style:${e.it ? 'italic' : 'normal'};fill:${color}${halo ? `;stroke:${halo};stroke-width:6px;stroke-linejoin:round;paint-order:stroke` : ''}">${L.map(l => `<tspan x="${r1(l.x)}" y="${r1(l.y)}">${esc(l.s) || ' '}</tspan>`).join('')}</text>`;
}
function fitText(e) {
  if (!e.text || e.t === 'line' || e.t === 'pen') return;
  const need = () => wrap(e.text, fontStr(e), tbox(e).w).length * e.fs * 1.25;
  let n = 0;
  while (tbox(e).h < need() && n++ < 40) e.h = Math.ceil(e.h * 1.08 + 2);
}
