/* Starter templates for new boards. Each build() returns a fresh element array. */
const T_ = (t, x, y, w, h, text, fill, o = {}) =>
  Object.assign(mk(t, x, y, w, h, true), { text, fill, stroke: t === 'sticky' ? 'transparent' : 'ink' }, o);
const TL_ = (a, b, o = {}) =>
  Object.assign(mkLine({ id: a.id, x: 0, y: 0 }, { id: b.id, x: 0, y: 0 }, true), { fs: 16 }, o);
const head_ = (x, y, w, text, o = {}) =>
  T_(
    'text',
    x,
    y,
    w,
    44,
    text,
    'transparent',
    Object.assign({ fs: 26, bold: true, ta: 'left', font: 'sans' }, o)
  );

function columns_(titles, colours, cards) {
  const out = [];
  titles.forEach((title, i) => {
    const x = i * 330;
    out.push(frameOr_(x, 0, 300, 620, title, colours[i]));
    (cards[i] || []).forEach((c, j) =>
      out.push(T_('sticky', x + 25, 70 + j * 170, 250, 150, c[0], c[1], { fs: 18 }))
    );
  });
  return out;
}
/* Frames arrive in a later step; until then a column is a soft rounded panel with a header. */
function frameOr_(x, y, w, h, title, fill) {
  if (typeof TYPES !== 'undefined' && TYPES.has('frame'))
    return Object.assign(mk('frame', x, y, w, h), { text: title, fill });
  return T_('round', x, y, w, h, title, fill, {
    stroke: 'transparent',
    rad: 18,
    va: 'top',
    ta: 'left',
    font: 'sans',
    bold: true,
    fs: 20,
    sh: false
  });
}

const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank board',
    desc: 'Start from nothing',
    build: () => []
  },
  {
    id: 'flow',
    name: 'Flowchart',
    desc: 'Steps, decisions, outcomes',
    build: () => sample()
  },
  {
    id: 'kanban',
    name: 'Kanban',
    desc: 'To do, doing, done',
    build: () => [
      head_(0, -100, 600, 'Project board'),
      ...columns_(
        ['To do', 'Doing', 'Done'],
        ['#e9ecef', '#d0ebff', '#d3f9d8'],
        [
          [
            ['Research competitors', '#fff3a6'],
            ['Draft the pitch', '#fff3a6'],
            ['Book user interviews', '#ffd8a8']
          ],
          [['Wireframes for v1', '#fcc2d7']],
          [['Pick a name', '#c5f6fa']]
        ]
      )
    ]
  },
  {
    id: 'mind',
    name: 'Mind map',
    desc: 'One idea, many branches',
    build: () => {
      const root = T_('ellipse', -120, -60, 240, 120, 'Central idea', '#ffd23f', {
        fs: 26,
        bold: true,
        sw: 3,
        mm: true
      });
      const out = [root];
      const labels = [
        'Why it matters',
        'Who it is for',
        'Risks',
        'Next steps',
        'Resources',
        'Open questions'
      ];
      const fills = ['#d0ebff', '#d3f9d8', '#ffc9c9', '#e5dbff', '#c5f6fa', '#ffd8a8'];
      const level1 = labels.map((t, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / labels.length,
          x = Math.cos(a) * 360,
          y = Math.sin(a) * 250;
        const n = T_('round', x - 90, y - 40, 180, 80, t, fills[i], { fs: 20 });
        out.push(n, TL_(root, n, { head: 'none' }));
        return n;
      });
      // two sub-branches, so there is something to fold away straight away
      [
        ['Saves time', -270],
        ['Fewer mistakes', 270]
      ].forEach(([t, dx]) => {
        const p = level1[0],
          n = T_('round', p.x + 90 + dx - 75, p.y - 50, 150, 60, t, fills[0], { fs: 16 });
        out.push(n, TL_(p, n, { head: 'none' }));
      });
      return out;
    }
  },
  {
    id: 'swot',
    name: 'SWOT',
    desc: 'Strengths, weaknesses, opportunities, threats',
    build: () => {
      const q = (x, y, t, fill) =>
        T_('rect', x, y, 380, 300, t + '\n\n• \n• \n• ', fill, {
          va: 'top',
          ta: 'left',
          fs: 20,
          rad: 12,
          sw: 2
        });
      return [
        head_(0, -70, 760, 'SWOT analysis'),
        q(0, 0, 'Strengths', '#d3f9d8'),
        q(400, 0, 'Weaknesses', '#ffc9c9'),
        q(0, 320, 'Opportunities', '#d0ebff'),
        q(400, 320, 'Threats', '#ffd8a8')
      ];
    }
  },
  {
    id: 'retro',
    name: 'Retro',
    desc: 'Went well, to improve, actions',
    build: () => [
      head_(0, -100, 600, 'Sprint retro'),
      ...columns_(
        ['Went well', 'To improve', 'Actions'],
        ['#d3f9d8', '#ffc9c9', '#e5dbff'],
        [
          [['Shipped on time', '#fff3a6']],
          [['Too many meetings', '#fff3a6']],
          [['Try no-meeting Wednesdays', '#fff3a6']]
        ]
      )
    ]
  }
];
const templateById = id => TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
