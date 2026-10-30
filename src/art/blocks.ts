import { grid, recolor, type PixelGrid, type Sheet } from './sprite';

/**
 * 方块（16×16）：铃砖（金色面板 + 浮雕铃铛，4 帧：正、右摆、正 + 闪光、左摆）、
 * 多次铃砖（橙色面板）、用过的暗色砖、沙岩砖；以及沙岩砖碎片（8×8，4 个角度）。
 */

// o 描边 · h 斜面高光 · s 斜面阴影 · Y 面板 · d 铆钉 · R 铃铛描边 · r 铃铛 · c 铃铛高光
const BELL_UP = grid(`
  oooooooooooooooo
  ohhhhhhhhhhhhhso
  ohdYYYYYYYYYYdso
  ohYYYYYRRYYYYYso
  ohYYYYRcrRYYYYso
  ohYYYRcrrrRYYYso
  ohYYYRcrrrRYYYso
  ohYYYRcrrrRYYYso
  ohYYRcrrrrrRYYso
  ohYRcrrrrrrrRYso
  ohYRRRRRRRRRRYso
  ohYYYYYRRYYYYYso
  ohYYYYYYYYYYYYso
  ohdYYYYYYYYYYdso
  osssssssssssssso
  oooooooooooooooo
`);

/** 把铃铛下半部分（第 8–11 行）整体左右挪一格，做出摇摆 */
function swing(g: PixelGrid, dir: number): PixelGrid {
  return g.map((row, y) => {
    if (y < 8 || y > 11) return row;
    const inner = row.slice(2, 14);
    const shifted = dir > 0 ? 'Y' + inner.slice(0, inner.length - 1) : inner.slice(1) + 'Y';
    return row.slice(0, 2) + shifted + row.slice(14);
  });
}

function sparkle(g: PixelGrid): PixelGrid {
  const out = [...g];
  const put = (x: number, y: number, c: string) => {
    out[y] = out[y]!.slice(0, x) + c + out[y]!.slice(x + 1);
  };
  put(3, 3, 'w');
  put(2, 3, 'h');
  put(4, 3, 'h');
  put(3, 2, 'h');
  put(3, 4, 'h');
  return out;
}

const BELL_FRAMES = [BELL_UP, swing(BELL_UP, 1), sparkle(BELL_UP), swing(BELL_UP, -1)];

const BRICK = grid(`
  oooooooooooooooo
  o3333333o333333o
  o2222222o222222o
  o2222222o222222o
  o1111111o111111o
  oooooooooooooooo
  o333o3333333o33o
  o222o2222222o22o
  o222o2222222o22o
  o111o1111111o11o
  oooooooooooooooo
  o3333333o333333o
  o2222222o222222o
  o2222222o222222o
  o1111111o111111o
  oooooooooooooooo
`);

const FRAG = [
  grid(`
  ........
  ..ooooo.
  ..o332o.
  ..o221o.
  ..ooooo.
  ........
  ........
  ........
  `),
  grid(`
  ........
  ...ooo..
  ...o3o..
  ...o2o..
  ...o2o..
  ...o1o..
  ...ooo..
  ........
  `),
  grid(`
  ........
  ........
  .ooooo..
  .o122o..
  .o233o..
  .ooooo..
  ........
  ........
  `),
  grid(`
  ........
  ..ooo...
  ..o1o...
  ..o2o...
  ..o2o...
  ..o3o...
  ..ooo...
  ........
  `),
];

const frames: Record<string, PixelGrid> = {};
BELL_FRAMES.forEach((g, i) => {
  frames[`bell_${i}`] = g;
  // 多次铃砖：橙色面板（用不同字符，换成另一组颜色）
  frames[`multi_${i}`] = recolor(g, { Y: 'O', h: 'H', s: 'S' });
});
frames.used = recolor(BELL_UP, { Y: 'u', h: 'U', s: 'q', r: 'q', c: 'U', R: 'q', d: 'q' });
frames.brick = BRICK;
FRAG.forEach((g, i) => (frames[`frag_${i}`] = g));

export const blockSheet: Sheet = {
  key: 'block',
  w: 16,
  h: 16,
  keys: {
    o: 'night',
    h: 'cream',
    s: 'straw',
    Y: 'gold',
    d: 'ochre',
    R: 'bark',
    r: 'ochre',
    c: 'cream',
    w: 'white',
    O: 'orange',
    H: 'gold',
    S: 'red2',
    u: 'sand1',
    U: 'sand2',
    q: 'ochre',
    '1': 'sand1',
    '2': 'sand2',
    '3': 'sand3',
  },
  frames,
};
