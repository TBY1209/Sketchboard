/* Pan and zoom. */
const view = () => ({ w: svg.clientWidth, h: svg.clientHeight });
const toW = e => {
  const r = svg.getBoundingClientRect();
  return { x: (e.clientX - r.left - cam.x) / cam.z, y: (e.clientY - r.top - cam.y) / cam.z };
};
const clampZ = z => Math.min(5, Math.max(0.1, z));
function zoomAt(cx, cy, k) {
  const r = svg.getBoundingClientRect(),
    wx = (cx - r.left - cam.x) / cam.z,
    wy = (cy - r.top - cam.y) / cam.z;
  cam.z = clampZ(cam.z * k);
  cam.x = cx - r.left - wx * cam.z;
  cam.y = cy - r.top - wy * cam.z;
  camSoon();
  saveCamSoon();
}
const zoomC = k => {
  const r = svg.getBoundingClientRect();
  zoomAt(r.left + r.width / 2, r.top + r.height / 2, k);
};
function fit() {
  const b = unionB(visible(els)),
    v = view();
  if (!b) {
    cam = { x: v.w / 2, y: v.h / 2, z: 1 };
    render();
    return;
  }
  const z = clampZ(Math.min((v.w - (v.w > 600 ? 160 : 40)) / (b.w || 1), (v.h - 200) / (b.h || 1), 1.4));
  cam.z = z;
  cam.x = v.w / 2 - (b.x + b.w / 2) * z;
  cam.y = v.h / 2 - (b.y + b.h / 2) * z;
  render();
  saveCamSoon();
}
let camT = 0;
const saveCamSoon = () => {
  clearTimeout(camT);
  camT = setTimeout(saveCam, 400);
};
