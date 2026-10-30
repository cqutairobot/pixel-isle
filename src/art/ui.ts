import { Paint, type ImageSheet } from './paint';
import type { RGBAImage } from './sprite';
import { grid, type PixelGrid } from './sprite';

/**
 * 界面用的小图：HUD 的心（满 / 空 / 碎裂 3 帧）、贝壳图标、6×8 数字、海玻璃空槽、
 * 交谈提示的"↑"、翻页箭头、按键帽、对话框的表情气泡。
 */

const HEART = grid(`
  .ooo.ooo...
  orrRorrRo..
  orwrrrrRo..
  orrrrrrRRo.
  .orrrrRRo..
  ..orrRRo...
  ...oRRo....
  ....oo.....
`);

function paintGrid(g: PixelGrid, keys: Record<string, Parameters<Paint['set']>[2]>): RGBAImage {
  const h = g.length;
  const w = Math.max(...g.map((r) => r.length));
  const p = new Paint(w, h);
  g.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch !== '.') p.set(x, y, keys[ch] ?? null);
    }
  });
  return p.toImage();
}

const heartKeys = { o: 'night', r: 'red2', R: 'red1', w: 'white' } as const;
const heartFull = paintGrid(HEART, heartKeys);
const heartEmpty = paintGrid(HEART, { o: 'night', r: 'slate', R: 'slate', w: 'stone' });
/** 碎裂：心从中间裂开，两半往两边错开 */
function heartBreak(gap: number): RGBAImage {
  const p = new Paint(11 + gap * 2, 8);
  HEART.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      const c = (heartKeys as Record<string, Parameters<Paint['set']>[2]>)[ch] ?? null;
      const left = x + (y % 2) <= 4;
      p.set(left ? x : x + gap * 2, y + (left ? 0 : gap > 1 ? 1 : 0), c);
    }
  });
  return p.toImage();
}

const SHELL_ICON = grid(`
  ...oooo...
  .ooccwcoo.
  ocpcpcpcpo
  ocpcpcpcpo
  .ocpcpcpo.
  ..odpdpo..
  ...oddo...
  ....oo....
`).map((row, y) =>
  y < 2 || y > 5
    ? row
    : row.replace(/[cp]/g, (_c, x: number) => (x % 2 === 0 && x > 1 && x < 9 ? 'p' : 'c')),
);

/** 6×8 像素数字（HUD 计数与结算面板用），描边是透明的，显示时另加阴影 */
const DIGITS: Record<string, string[]> = {
  '0': ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.', '......'],
  '1': ['..##..', '.###..', '..##..', '..##..', '..##..', '..##..', '.####.', '......'],
  '2': ['.####.', '##..##', '....##', '...##.', '..##..', '.##...', '######', '......'],
  '3': ['.####.', '##..##', '....##', '..###.', '....##', '##..##', '.####.', '......'],
  '4': ['...##.', '..###.', '.#.##.', '#..##.', '######', '...##.', '...##.', '......'],
  '5': ['######', '##....', '#####.', '....##', '....##', '##..##', '.####.', '......'],
  '6': ['.####.', '##....', '#####.', '##..##', '##..##', '##..##', '.####.', '......'],
  '7': ['######', '....##', '...##.', '..##..', '..##..', '..##..', '..##..', '......'],
  '8': ['.####.', '##..##', '##..##', '.####.', '##..##', '##..##', '.####.', '......'],
  '9': ['.####.', '##..##', '##..##', '.#####', '....##', '...##.', '.###..', '......'],
  x: ['......', '......', '##..##', '.####.', '..##..', '.####.', '##..##', '......'],
  ':': ['......', '..##..', '..##..', '......', '..##..', '..##..', '......', '......'],
  '.': ['......', '......', '......', '......', '......', '..##..', '..##..', '......'],
  '/': ['....##', '....##', '...##.', '..##..', '.##...', '##....', '##....', '......'],
};

/** 白色数字加一圈深蓝描边（8×10），亮背景上也看得清 */
function digit(rows: string[]): RGBAImage {
  const p = new Paint(8, 10);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') p.set(x + 1, y + 1, 'white');
  });
  p.outline('night');
  return p.toImage();
}

/** 海玻璃空槽：菱形虚线框 */
function glassSlot(): RGBAImage {
  const p = new Paint(10, 10);
  const pts = [
    [4, 0],
    [5, 0],
    [2, 2],
    [7, 2],
    [0, 4],
    [9, 4],
    [0, 5],
    [9, 5],
    [2, 7],
    [7, 7],
    [4, 9],
    [5, 9],
  ];
  for (const [x, y] of pts) p.set(x!, y!, 'mist');
  p.set(3, 1, 'stone').set(6, 1, 'stone').set(1, 3, 'stone').set(8, 3, 'stone');
  p.set(1, 6, 'stone').set(8, 6, 'stone').set(3, 8, 'stone').set(6, 8, 'stone');
  return p.toImage();
}

/** 交谈提示：跳动的"↑"，奶油色底、深蓝描边 */
function prompt(): RGBAImage {
  const p = new Paint(11, 12);
  p.rect(1, 1, 9, 9, 'cream');
  p.set(1, 1, null).set(9, 1, null).set(1, 9, null).set(9, 9, null);
  p.vline(5, 3, 8, 'night');
  p.hline(4, 6, 4, 'night');
  p.hline(3, 7, 5, 'night');
  p.set(5, 3, 'night');
  p.set(4, 10, 'cream').set(5, 10, 'cream').set(6, 10, 'cream').set(5, 11, 'cream');
  p.outline('night');
  return p.toImage();
}

/** 翻页箭头 ▼ */
function pageArrow(): RGBAImage {
  const p = new Paint(7, 4);
  p.hline(0, 6, 0, 'night').hline(1, 5, 1, 'night').hline(2, 4, 2, 'night').set(3, 3, 'night');
  return p.toImage();
}

/** 按键帽：奶油色键面，底部一道厚边，像真的键帽；字由文字层画上去 */
function keycap(w: number): RGBAImage {
  const p = new Paint(w, 13);
  p.rect(1, 0, w - 2, 12, 'cream');
  p.rect(1, 9, w - 2, 3, 'sand2');
  p.hline(2, w - 3, 0, 'white');
  p.outline('night');
  const q = new Paint(w + 2, 14);
  q.paste(p, 1, 0);
  return p.toImage();
}

/** 表情气泡：圆角白底，下面一个小尖角；内容另画 */
function bubble(): RGBAImage {
  const p = new Paint(13, 13);
  p.rect(1, 0, 11, 9, 'white');
  p.rect(0, 1, 13, 7, 'white');
  p.set(5, 9, 'white').set(6, 9, 'white').set(6, 10, 'white');
  p.outline('night');
  return p.toImage();
}

function emote(kind: '!' | '?' | 'note' | 'dots'): RGBAImage {
  const p = new Paint(13, 13);
  const base = bubble();
  for (let y = 0; y < 13; y++)
    for (let x = 0; x < 13; x++) {
      const i = (y * 13 + x) * 4;
      if (base.data[i + 3])
        p.set(x, y, base.data[i] === 255 && base.data[i + 1] === 255 ? 'white' : 'night');
    }
  if (kind === '!') p.vline(6, 2, 5, 'red2').set(6, 7, 'red2');
  else if (kind === '?')
    p.hline(5, 7, 2, 'sea').set(8, 3, 'sea').set(7, 4, 'sea').set(6, 5, 'sea').set(6, 7, 'sea');
  else if (kind === 'note')
    p.vline(7, 2, 6, 'red2').set(8, 2, 'red2').set(9, 3, 'red2').rect(5, 6, 2, 2, 'red2');
  else p.set(3, 5, 'night').set(6, 5, 'night').set(9, 5, 'night');
  return p.toImage();
}

const frames: Record<string, RGBAImage> = {
  heart_full: heartFull,
  heart_empty: heartEmpty,
  heart_break_0: heartBreak(1),
  heart_break_1: heartBreak(2),
  heart_break_2: heartBreak(3),
  shell: paintGrid(SHELL_ICON, { o: 'night', c: 'cream', p: 'skin1', w: 'white', d: 'blush' }),
  glass_slot: glassSlot(),
  prompt: prompt(),
  page: pageArrow(),
  key_1: keycap(13),
  key_2: keycap(19),
  key_3: keycap(27),
  emote_bang: emote('!'),
  emote_q: emote('?'),
  emote_note: emote('note'),
  emote_dots: emote('dots'),
};
for (const [k, rows] of Object.entries(DIGITS))
  frames[`d_${k === '.' ? 'dot' : k === ':' ? 'colon' : k === '/' ? 'slash' : k}`] = digit(rows);

export const uiSheet: ImageSheet = { key: 'ui', frames };
