/* Shared state, constants and small helpers. Every other script reads these globals. */
const $ = s => document.querySelector(s);
const svg = $('#svg'),
  layer = $('#layer'),
  ui = $('#ui'),
  world = $('#world'),
  stage = $('#stage'),
  edWrap = $('#editor'),
  edIn = $('#edin');
const G = 20,
  MIN = 12,
  LS = 'sketchboard.v1';
const FONTS = {
  hand: "Kalam, 'Segoe Print', 'Comic Sans MS', cursive",
  sans: 'Figtree, system-ui, sans-serif',
  serif: 'Lora, Georgia, serif',
  mono: "'JetBrains Mono', ui-monospace, monospace",
  marker: "'Permanent Marker', Kalam, cursive",
  round: 'Nunito, Figtree, sans-serif'
};
const FNAMES = {
  hand: 'Hand',
  sans: 'Sans',
  serif: 'Serif',
  mono: 'Mono',
  marker: 'Marker',
  round: 'Rounded'
};
const FSTEPS = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96, 128, 160, 200];
const FILLS = [
  'transparent',
  '#ffffff',
  '#fff3a6',
  '#ffd8a8',
  '#ffc9c9',
  '#fcc2d7',
  '#e5dbff',
  '#d0ebff',
  '#c5f6fa',
  '#d3f9d8',
  '#e9ecef',
  '#343a40'
];
const STROKES = [
  'ink',
  '#e03131',
  '#f08c00',
  '#2f9e44',
  '#1971c2',
  '#7048e8',
  '#c2255c',
  '#868e96',
  'transparent'
];
const SHAPES = [
  'rect',
  'round',
  'ellipse',
  'diamond',
  'tri',
  'hex',
  'para',
  'star',
  'cyl',
  'arrowR',
  'speech'
];
const NAMES = {
  rect: 'Rectangle',
  round: 'Rounded rectangle',
  ellipse: 'Ellipse',
  diamond: 'Diamond',
  tri: 'Triangle',
  hex: 'Hexagon',
  para: 'Parallelogram',
  star: 'Star',
  cyl: 'Database',
  arrowR: 'Block arrow',
  speech: 'Speech bubble',
  sticky: 'Sticky note',
  frame: 'Frame',
  img: 'Image'
};
const TYPES = new Set([...SHAPES, 'sticky', 'text', 'pen', 'line', 'frame', 'img']);
const SIZE = {
  frame: [480, 320],
  sticky: [200, 200],
  text: [220, 50],
  diamond: [180, 120],
  star: [130, 124],
  cyl: [130, 150],
  speech: [190, 120],
  arrowR: [180, 90],
  tri: [150, 124],
  hex: [170, 104],
  ellipse: [160, 100]
};
const HANDLES = [
  ['nw', 0, 0],
  ['n', 0.5, 0],
  ['ne', 1, 0],
  ['e', 1, 0.5],
  ['se', 1, 1],
  ['s', 0.5, 1],
  ['sw', 0, 1],
  ['w', 0, 0.5]
];
const def = {
  fill: '#d0ebff',
  stroke: 'ink',
  sw: 2,
  dash: 'solid',
  font: 'hand',
  fs: 20,
  op: 1,
  route: 'curve',
  head: 'end',
  hk: 'tri',
  tc: 'auto',
  bold: false,
  it: false,
  ta: 'center',
  va: 'middle',
  rad: 0,
  sh: false
};
const BASE_DEF = { ...def }; // untouched copy: templates and the sample board build from this, never from "last used"
/* Built-in look for each new shape: fill and font size, chosen so a short label fits the default size
   (font sizes follow each shape's inner text box, see tbox()). Colours echo the sample flowchart. */
const TYPE_DEFAULTS = {
  rect: { fill: '#d0ebff', fs: 20 },
  round: { fill: '#d0ebff', fs: 20 },
  ellipse: { fill: '#fff3a6', fs: 20 },
  diamond: { fill: '#e5dbff', fs: 18 },
  tri: { fill: '#ffd8a8', fs: 16 },
  hex: { fill: '#c5f6fa', fs: 18 },
  para: { fill: '#ffc9c9', fs: 18 },
  star: { fill: '#fff3a6', fs: 14 },
  cyl: { fill: '#d3f9d8', fs: 18 },
  arrowR: { fill: '#ffd8a8', fs: 18 },
  speech: { fill: '#fcc2d7', fs: 18 },
  sticky: { fill: '#fff3a6', fs: 18 },
  text: { fill: 'transparent', fs: 24 }
};
/* When you restyle a shape's fill or font size, later shapes of that same type follow (this session only).
   Other types keep their own built-in look. */
const typeMemory = {};
const defFor = (t, pristine) => ({
  ...(TYPE_DEFAULTS[t] || { fill: def.fill, fs: def.fs }),
  ...(pristine ? null : typeMemory[t])
});
const rememberStyle = (e, k, val) => {
  if (!TYPE_DEFAULTS[e.t]) return false;
  (typeMemory[e.t] = typeMemory[e.t] || {})[k] = val;
  return true;
};
let els = [],
  sel = new Set(),
  cam = { x: 0, y: 0, z: 1 },
  tool = 'select',
  lastShape = 'rect',
  lock = false,
  grid = true,
  snap = false;
let undoS = [],
  redoS = [],
  before = null,
  op = null,
  editing = null,
  hoverId = null,
  guides = [],
  spaceDown = false,
  lastTap = { t: 0 },
  clip = null,
  lastW = { x: 0, y: 0 },
  pasteN = 0;
let lastPT = 'mouse',
  pTab = 'shape',
  mode = 'auto',
  multi = false,
  sbKey = '',
  sym = false;
const ptrs = new Map();
let route = 'boot', // 'boot' | 'home' | 'board' | 'share'
  board = null, // metadata of the open board: {id, name, created, updated, thumb, template, cam, count}
  readOnly = false,
  hoverLock = null,
  HIDDEN = new Set(); // ids hidden inside collapsed mind-map branches (see mindmap.js)
const isFrame = e => !!e && e.t === 'frame';
/* frames first so they sit underneath everything else */
const drawOrder = list => [...list.filter(isFrame), ...list.filter(e => !isFrame(e))];
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s =>
  String(s).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const r1 = n => Math.round(n * 10) / 10,
  f = p => r1(p.x) + ' ' + r1(p.y);
const byId = id => (id ? els.find(e => e.id === id) : null);
const isShape = e => !!e && e.t !== 'line' && e.t !== 'pen' && e.t !== 'frame';
const col = (c, x) => (c === 'ink' ? (x ? '#1e1e1e' : 'var(--ink)') : c);
const tcol = (e, x) => {
  const ink = x ? '#1e1e1e' : 'var(--ink)';
  if (e.tc && e.tc !== 'auto') return col(e.tc, x);
  if (e.t === 'line') return ink;
  if (e.t === 'text') return e.stroke === 'transparent' ? ink : col(e.stroke, x);
  return e.fill === 'transparent' ? ink : e.fill === '#343a40' ? '#f8f9fa' : '#1e1e1e';
};
const nrm = (x, y) => {
  const L = Math.hypot(x, y);
  return L ? { x: x / L, y: y / L } : { x: 0, y: 0 };
};
const ctr = e => ({ x: e.x + e.w / 2, y: e.y + e.h / 2 });
const fontStr = e => `${e.it ? 'italic ' : ''}${e.bold ? 700 : 400} ${e.fs}px ${FONTS[e.font]}`;
