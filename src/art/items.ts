import { grid, recolor, type PixelGrid, type Sheet } from './sprite';

/**
 * 道具：贝壳（12×12，4 帧闪光）、大贝壳（16×16，2 帧）、芒果（12×12）、
 * 太阳果（14×14，4 帧光芒）、海玻璃（10×10，水绿 / 草绿 / 琥珀三色，各 2 帧）。
 */

// o 描边 · c 奶油 · p 浅橘（纹路）· w 高光 · d 腮红色（底座）
const SHELL = grid(`
  ....oooo....
  ..oocccwoo..
  .occpcpcpco.
  ocpcpcpcpcco
  ocpcpcpcpcpo
  ocpcpcpcpcpo
  .ocpcpcpcpo.
  ..ocpcpcpo..
  ...odpcpdo..
  ....oddo....
  .....oo.....
  ............
`).map((row, y) =>
  // 纹路按列对齐（从底座放射出去），不要错位成棋盘格
  y < 2 || y > 8
    ? row
    : row.replace(/[cp]/g, (_ch, x: number) => (x % 2 === 0 && x > 1 && x < 10 ? 'p' : 'c')),
);

/** 一道高光从左扫到右：把第 row 行某个纹路像素换成白色 */
function glint(g: PixelGrid, points: Array<[number, number]>): PixelGrid {
  const out = [...g];
  for (const [x, y] of points) out[y] = out[y]!.slice(0, x) + 'w' + out[y]!.slice(x + 1);
  return out;
}

const SHELL_FRAMES = [
  SHELL,
  glint(SHELL, [
    [3, 3],
    [2, 4],
  ]),
  glint(SHELL, [
    [6, 4],
    [5, 5],
  ]),
  glint(SHELL, [
    [9, 4],
    [8, 5],
  ]),
];

const BIG_SHELL = grid(`
  ......oooo......
  ....ooccccoo....
  ...occpcpcwco...
  ..occpcpcpcpco..
  .occpcpcpcpcpco.
  .ocpcpcpcpcpcpo.
  ocpcpcpcpcpcpcpo
  ocpcpcpcpcpcpcpo
  ocpcpcpcpcpcpcpo
  .ocpcpcpcpcpcpo.
  .oocpcpcpcpcpoo.
  ...ocpcpcpcpo...
  ...oogggggoo....
  ....oggyggo.....
  .....oooo.......
  ................
`).map((row, y) =>
  y < 2 || y > 11
    ? row
    : row.replace(/[cp]/g, (_ch, x: number) => (x % 2 === 1 && x > 1 && x < 14 ? 'p' : 'c')),
);

const MANGO = grid(`
  .......ol...
  ......olLo..
  .....oboo...
  ...oooyoo...
  ..oyyyyyYo..
  .oyywyyyYYo.
  .oyyyyyyYYo.
  .oyyyyyYYOo.
  .opyyyyYYOo.
  ..opYYYYOo..
  ...ooooooo..
  ............
`);

// 太阳果：中间橙色果子，外圈 8 道光芒，4 帧轮流伸缩
const SUN_CORE = grid(`
  ..............
  ..............
  ..............
  .....oooo.....
  ....oyyyYo....
  ...oywyyyYo...
  ...oyyyyyYo...
  ...oyyyyYOo...
  ...opyyYYOo...
  ....oYYYOo....
  .....oooo.....
  ..............
  ..............
  ..............
`);

function sunFrame(phase: number): PixelGrid {
  const out = SUN_CORE.map((r) => r.split(''));
  const put = (x: number, y: number, c: string) => {
    if (out[y]![x] === '.') out[y]![x] = c;
  };
  const long = phase % 2 === 0;
  const rays: Array<[number, number, number, number]> = [
    [7, 2, 0, -1],
    [7, 11, 0, 1],
    [2, 7, -1, 0],
    [11, 7, 1, 0],
    [3, 3, -1, -1],
    [10, 3, 1, -1],
    [3, 10, -1, 1],
    [10, 10, 1, 1],
  ];
  rays.forEach(([x, y, dx, dy], i) => {
    const diag = i >= 4;
    const len = diag ? (long ? 1 : 2) : long ? 2 : 1;
    for (let k = 0; k < len; k++) put(x + dx * k, y + dy * k, k === 0 ? 'g' : 'G');
  });
  return out.map((r) => r.join(''));
}

// 海玻璃：t 主色 · T 暗色 · h 亮色 · w 高光
const GLASS = grid(`
  ...oooo...
  ..ohhwto..
  .ohhttTTo.
  ohttttTTTo
  otttttTTTo
  .otttTTTo.
  ..ottTTo..
  ...oooo...
  ..........
  ..........
`);
const GLASS_SPARK = glint(GLASS, [
  [3, 2],
  [2, 3],
]);

const frames: Record<string, PixelGrid> = {};
SHELL_FRAMES.forEach((g, i) => (frames[`shell_${i}`] = g));
frames.bigShell_0 = BIG_SHELL;
frames.bigShell_1 = glint(BIG_SHELL, [
  [4, 5],
  [5, 4],
  [3, 6],
]);
frames.mango = MANGO;
for (let i = 0; i < 4; i++) frames[`sun_${i}`] = sunFrame(i);
const glassColors: Array<[string, Record<string, string>]> = [
  ['aqua', {}],
  ['green', { t: 'e', T: 'E', h: 'H' }],
  ['amber', { t: 'a', T: 'A', h: 'H' }],
];
for (const [name, map] of glassColors) {
  frames[`glass_${name}_0`] = recolor(GLASS, map);
  frames[`glass_${name}_1`] = recolor(GLASS_SPARK, map);
}

/** 海玻璃编号 → 颜色名 */
export const GLASS_COLORS = ['aqua', 'green', 'amber'] as const;

export const itemSheet: Sheet = {
  key: 'item',
  w: 16,
  h: 16,
  keys: {
    o: 'night',
    c: 'cream',
    p: 'skin1',
    w: 'white',
    d: 'blush',
    g: 'gold',
    G: 'orange',
    y: 'gold',
    Y: 'orange',
    O: 'red2',
    l: 'leaf2',
    L: 'leaf1',
    b: 'bark',
    t: 'teal',
    T: 'sea',
    h: 'sky',
    e: 'leaf3',
    E: 'leaf2',
    a: 'gold',
    A: 'orange',
    H: 'cream',
  },
  frames,
};
