import { T_ONEWAY, T_SOLID, type Grid } from '../sim/grid';
import {
  MAT_BARK,
  MAT_CRATE,
  MAT_GROUND,
  MAT_GROVE,
  MAT_LEAF,
  MAT_PLANK,
  MAT_SAND,
  MAT_VINE,
} from '../sim/level';
import { hexToRgb, PALETTE, type ColorName } from './palette';
import { hash2 } from './rng';
import type { RGBAImage } from './sprite';

/**
 * 地形自动拼接：按 8 邻居的连接情况，用规则逐像素生成 16×16 瓦片
 * （外露的边描边、顶面加高光、内角补角、内部瓦片之间留接缝）。
 * 每种地形只需要一组颜色规则，就能得到全部 47 种连接形状。
 */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
export const NE = 16;
export const SE = 32;
export const SW = 64;
export const NW = 128;

export interface GroundStyle {
  outline: ColorName;
  cap: ColorName;
  capLight: ColorName;
  fill: ColorName;
  light: ColorName;
  seam: ColorName;
  shadow: ColorName;
  speckles: ColorName[];
}

export interface PlankStyle {
  outline: ColorName;
  top: ColorName;
  mid: ColorName;
  low: ColorName;
}

export interface TerrainTheme {
  ground: GroundStyle;
  plank: PlankStyle;
}

/** 练习场：浅色石砖地面（每格之间有接缝，方便数格子）+ 木板单向平台 */
export const GYM_THEME: TerrainTheme = {
  ground: {
    outline: 'ink',
    cap: 'cloud',
    capLight: 'mist',
    fill: 'stone',
    light: 'mist',
    seam: 'slate',
    shadow: 'slate',
    speckles: ['mist', 'slate'],
  },
  plank: { outline: 'bark', top: 'sand3', mid: 'sand2', low: 'sand1' },
};

type Px = ColorName | null;

function image(pixels: Px[]): RGBAImage {
  const data = new Uint8ClampedArray(16 * 16 * 4);
  pixels.forEach((c, i) => {
    if (!c) return;
    const [r, g, b] = hexToRgb(PALETTE[c]);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  });
  return { w: 16, h: 16, data };
}

export function drawGroundTile(mask: number, st: GroundStyle, variant: number): RGBAImage {
  const n = (mask & N) !== 0;
  const e = (mask & E) !== 0;
  const s = (mask & S) !== 0;
  const w = (mask & W) !== 0;
  const px: Px[] = new Array(256).fill(st.fill);
  const set = (x: number, y: number, c: Px) => {
    px[y * 16 + x] = c;
  };
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      let c: Px = st.fill;
      // 内部接缝与每格的高光，形成"一格一格"的石砖
      if (n && y === 0 && x < 15) c = st.light;
      if (w && x === 0 && y < 15) c = st.light;
      if (e && x === 15) c = st.seam;
      if (s && y === 15) c = st.seam;
      // 外露的边
      if (!n) {
        if (y === 0) c = st.outline;
        else if (y === 1) c = st.cap;
        else if (y === 2) c = st.capLight;
      }
      if (!s) {
        if (y === 15) c = st.outline;
        else if (y === 14 && c === st.fill) c = st.shadow;
      }
      if (!w) {
        if (x === 0) c = st.outline;
        else if (x === 1 && y > 2 && c === st.fill) c = st.light;
      }
      if (!e) {
        if (x === 15) c = st.outline;
        else if (x === 14 && y > 2 && c !== st.outline) c = st.shadow;
      }
      set(x, y, c);
    }
  }
  // 外角削圆
  if (!n && !w) set(0, 0, null);
  if (!n && !e) set(15, 0, null);
  if (!s && !w) set(0, 15, null);
  if (!s && !e) set(15, 15, null);
  // 内角补一个描边像素
  if (n && w && !(mask & NW)) set(0, 0, st.outline);
  if (n && e && !(mask & NE)) set(15, 0, st.outline);
  if (s && w && !(mask & SW)) set(0, 15, st.outline);
  if (s && e && !(mask & SE)) set(15, 15, st.outline);
  // 斑点变体
  const count = variant % 3;
  for (let i = 0; i < count; i++) {
    const h = hash2(variant, i, 7);
    const x = 4 + (h % 8);
    const y = 5 + ((h >> 4) % 7);
    if (px[y * 16 + x] === st.fill) set(x, y, st.speckles[(h >> 8) % st.speckles.length]!);
  }
  return image(px);
}

export function drawPlankTile(mask: number, st: PlankStyle, variant: number): RGBAImage {
  const w = (mask & W) !== 0;
  const e = (mask & E) !== 0;
  const px: Px[] = new Array(256).fill(null);
  const rows: ColorName[] = [st.outline, st.top, st.mid, st.mid, st.low, st.outline];
  rows.forEach((c, y) => {
    for (let x = 0; x < 16; x++) px[y * 16 + x] = c;
  });
  // 木纹
  const h = hash2(variant, 3, 11);
  for (let i = 0; i < 3; i++) {
    const gx = (h >> (i * 4)) % 14;
    px[3 * 16 + gx + 1] = st.low;
  }
  if (!w) {
    for (let y = 0; y < 6; y++) px[y * 16] = st.outline;
    // 支架
    for (const [x, y] of [
      [2, 6],
      [3, 6],
      [2, 7],
    ])
      px[y! * 16 + x!] = st.outline;
  }
  if (!e) {
    for (let y = 0; y < 6; y++) px[y * 16 + 15] = st.outline;
    for (const [x, y] of [
      [12, 6],
      [13, 6],
      [13, 7],
    ])
      px[y! * 16 + x!] = st.outline;
  }
  return image(px);
}

/** 关卡瓦片集：去重后的瓦片图像，以及每格对应的瓦片序号（-1 为空） */
export interface Tileset {
  tiles: RGBAImage[];
  data: number[][];
}

function maskFor(grid: Grid, c: number, r: number, type: number): number {
  const same = (dc: number, dr: number) => {
    const cc = c + dc;
    const rr = r + dr;
    // 越界当作同类，地图边缘不画描边
    if (cc < 0 || cc >= grid.cols || rr < 0 || rr >= grid.rows) return true;
    return grid.get(cc, rr) === type;
  };
  let m = 0;
  if (same(0, -1)) m |= N;
  if (same(1, 0)) m |= E;
  if (same(0, 1)) m |= S;
  if (same(-1, 0)) m |= W;
  if (same(1, -1)) m |= NE;
  if (same(1, 1)) m |= SE;
  if (same(-1, 1)) m |= SW;
  if (same(-1, -1)) m |= NW;
  return m;
}

export function buildTileset(grid: Grid, theme: TerrainTheme): Tileset {
  const index = new Map<string, number>();
  const tiles: RGBAImage[] = [];
  const data: number[][] = [];
  for (let r = 0; r < grid.rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < grid.cols; c++) {
      const t = grid.get(c, r);
      if (t !== T_SOLID && t !== T_ONEWAY) {
        row.push(-1);
        continue;
      }
      const mask = maskFor(grid, c, r, t);
      const variant = hash2(c, r) % 6;
      const key = `${t}:${mask}:${variant}`;
      let i = index.get(key);
      if (i === undefined) {
        i = tiles.length;
        tiles.push(
          t === T_SOLID
            ? drawGroundTile(mask, theme.ground, variant)
            : drawPlankTile(mask, theme.plank, variant),
        );
        index.set(key, i);
      }
      row.push(i);
    }
    data.push(row);
  }
  return { tiles, data };
}

// —— 正式关卡的地形（村庄草地、沙地、木箱、栈桥木板）——

/** 正式关卡里材质对应的瓦片画法 */
export type LevelTerrain = 'gym' | 'island';

const VILLAGE_PLANK: PlankStyle = { outline: 'night', top: 'sand3', mid: 'sand2', low: 'sand1' };

/** 离地表的深度（px）→ 底色：越深越暗，中间用抖动过渡 */
function depthColor(
  x: number,
  y: number,
  dpx: number,
  bands: Array<[number, ColorName]>,
): ColorName {
  for (let i = 0; i < bands.length - 1; i++) {
    const [d0, c0] = bands[i]!;
    const [d1, c1] = bands[i + 1]!;
    if (dpx < d1) return ditherPickT(x, y, (dpx - d0) / Math.max(1, d1 - d0), c0, c1);
  }
  return bands[bands.length - 1]![1];
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function ditherPickT(x: number, y: number, t: number, a: ColorName, b: ColorName): ColorName {
  // 过渡带只在中间一段抖动，两头是纯色
  const tt = Math.min(1, Math.max(0, (t - 0.5) * 1.6 + 0.5));
  return tt > (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16 ? b : a;
}

/**
 * 村庄地面：顶上一层草（垂下几根草叶），下面是暖色泥土，越深越暗，偶尔嵌着小石子。
 * depth：这一格上面还有几格同类地形（0 表示顶面露在外面）。
 */
export function drawEarthTile(
  mask: number,
  depth: number,
  variant: number,
  cap: 'grass' | 'sand',
): RGBAImage {
  const n = (mask & N) !== 0;
  const e = (mask & E) !== 0;
  const s = (mask & S) !== 0;
  const w = (mask & W) !== 0;
  const sand = cap === 'sand';
  const px: Px[] = new Array(256).fill(null);
  const set = (x: number, y: number, c: Px) => {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) px[y * 16 + x] = c;
  };
  const bands: Array<[number, ColorName]> = sand
    ? [
        [0, 'sand3'],
        [14, 'sand3'],
        [26, 'sand2'],
        [44, 'sand2'],
        [60, 'sand1'],
      ]
    : [
        [0, 'ochre'],
        [18, 'ochre'],
        [34, 'bark'],
        [60, 'bark'],
      ];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dpx = depth * 16 + y;
      set(x, y, depthColor(x + variant * 5, y, dpx, bands));
    }
  }
  // 小石子 / 贝壳碎
  const h0 = hash2(variant, depth, 31);
  for (let i = 0; i < 2 + (h0 % 2); i++) {
    const h = hash2(variant, i + depth * 7, 17);
    const x = 2 + (h % 12);
    const y = (n ? 6 : 1) + ((h >> 5) % (n ? 8 : 13));
    const dpx = depth * 16 + y;
    if (sand) {
      if (dpx < 26) set(x, y, (h >> 9) % 3 === 0 ? 'blush' : 'cream');
      else set(x, y, 'sand1');
    } else if (dpx < 30) {
      set(x, y, 'sand1');
      set(x + 1, y, 'sand1');
      set(x, y + 1, 'bark');
      set(x + 1, y + 1, 'bark');
    } else {
      set(x, y, 'ochre');
    }
  }
  const outline: ColorName = sand ? 'sand1' : 'night';
  const side: ColorName = sand ? 'ochre' : 'night';
  // 顶面
  if (!n) {
    if (sand) {
      for (let x = 0; x < 16; x++) {
        set(x, 0, 'sand1');
        set(x, 1, 'cream');
        set(x, 2, (hash2(variant, x, 3) & 3) === 0 ? 'cream' : 'sand3');
      }
    } else {
      for (let x = 0; x < 16; x++) {
        const hx = hash2(variant, x, 9);
        set(x, 0, 'pine');
        set(x, 1, (hx & 3) === 0 ? 'leaf2' : 'leaf3');
        set(x, 2, 'leaf2');
        set(x, 3, (hx >> 2) & 1 ? 'leaf1' : 'leaf2');
        // 垂下来的草叶，下面压一道暗色
        if ((hx >> 4) % 5 < 2) {
          set(x, 4, 'leaf1');
          set(x, 5, 'bark');
        } else {
          set(x, 4, 'bark');
        }
      }
    }
  }
  // 两侧与底部
  if (!w) {
    for (let y = 0; y < 16; y++) {
      const top = !n && y < (sand ? 3 : 4);
      set(0, y, top ? (sand ? 'sand1' : 'pine') : side);
      if (!top && y > 0) set(1, y, sand ? 'sand2' : 'bark');
    }
  }
  if (!e) {
    for (let y = 0; y < 16; y++) {
      const top = !n && y < (sand ? 3 : 4);
      set(15, y, top ? (sand ? 'sand1' : 'pine') : side);
      if (!top && y > 0) set(14, y, sand ? 'sand1' : 'bark');
    }
  }
  if (!s) {
    for (let x = 0; x < 16; x++) {
      set(x, 15, outline);
      if (px[14 * 16 + x] !== outline) set(x, 14, sand ? 'sand1' : 'bark');
    }
  }
  // 外角削圆、内角补描边
  if (!n && !w) set(0, 0, null);
  if (!n && !e) set(15, 0, null);
  if (!s && !w) set(0, 15, null);
  if (!s && !e) set(15, 15, null);
  if (n && w && !(mask & NW)) set(0, 0, side);
  if (n && e && !(mask & NE)) set(15, 0, side);
  if (s && w && !(mask & SW)) set(0, 15, side);
  if (s && e && !(mask & SE)) set(15, 15, side);
  return image(px);
}

/** 木箱：深色外框、斜撑、钉子；每个木箱单独描边，不和旁边的连成一片 */
export function drawCrateTile(variant: number): RGBAImage {
  const px: Px[] = new Array(256).fill(null);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      let c: ColorName = 'sand1';
      if (y % 5 === 4) c = 'ochre';
      if (x < 3 || x > 12 || y < 3 || y > 12) c = 'bark';
      if (x === 0 || x === 15 || y === 0 || y === 15) c = 'night';
      px[y * 16 + x] = c;
    }
  }
  // 斜撑
  const flip = variant % 2 === 1;
  for (let i = 3; i <= 12; i++) {
    const x = flip ? 15 - i : i;
    px[i * 16 + x] = 'bark';
    px[i * 16 + (flip ? x - 1 : x + 1)] = 'ochre';
  }
  // 高光与钉子
  for (let x = 1; x < 15; x++) px[1 * 16 + x] = 'sand2';
  for (const [x, y] of [
    [1, 1],
    [14, 1],
    [1, 14],
    [14, 14],
  ])
    px[y! * 16 + x!] = 'mist';
  return image(px);
}

/**
 * 按材质层生成瓦片集。
 * - 地面和沙地互相连成一片（交界处不画描边）；木箱、木板各自成组。
 * - 记录每格上面还有几格同组地形，越深越暗。
 */
export function buildLevelTileset(
  grid: Grid,
  material: Uint8Array,
  terrain: LevelTerrain,
): Tileset {
  const group = (m: number) => (m === MAT_GROUND || m === MAT_SAND || m === MAT_GROVE ? 1 : m);
  const matAt = (c: number, r: number) => {
    if (c < 0 || c >= grid.cols || r < 0 || r >= grid.rows) return -1;
    return material[r * grid.cols + c]!;
  };
  const index = new Map<string, number>();
  const tiles: RGBAImage[] = [];
  const data: number[][] = [];
  for (let r = 0; r < grid.rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < grid.cols; c++) {
      const m = matAt(c, r);
      if (!DRAWN.has(m)) {
        row.push(-1);
        continue;
      }
      const gp = group(m);
      const same = (dc: number, dr: number) => {
        const mm = matAt(c + dc, r + dr);
        // 越界当作同类，地图边缘不画描边
        return mm === -1 || group(mm) === gp;
      };
      let mask = 0;
      if (same(0, -1)) mask |= N;
      if (same(1, 0)) mask |= E;
      if (same(0, 1)) mask |= S;
      if (same(-1, 0)) mask |= W;
      if (same(1, -1)) mask |= NE;
      if (same(1, 1)) mask |= SE;
      if (same(-1, 1)) mask |= SW;
      if (same(-1, -1)) mask |= NW;
      let depth = 0;
      while (depth < 4 && r - depth - 1 >= 0 && group(matAt(c, r - depth - 1)) === gp) depth++;
      const variant = hash2(c, r) % 6;
      // 树皮：横着的倒木和竖着的树桩纹理不一样，看这一块是横向长还是纵向长
      let along = 0;
      if (m === MAT_BARK) {
        const run = (dc: number, dr: number) => {
          let k = 1;
          while (k < 32 && matAt(c + dc * k, r + dr * k) === MAT_BARK) k++;
          return k - 1;
        };
        along = run(1, 0) + run(-1, 0) > run(0, 1) + run(0, -1) ? 1 : 2;
      }
      const key = `${terrain}:${m}:${mask}:${depth}:${variant}:${along}`;
      let i = index.get(key);
      if (i === undefined) {
        i = tiles.length;
        tiles.push(drawMaterial(terrain, m, mask, depth, variant, along === 1));
        index.set(key, i);
      }
      row.push(i);
    }
    data.push(row);
  }
  return { tiles, data };
}

/** 有瓦片图像的材质（水另外画） */
const DRAWN = new Set([
  MAT_GROUND,
  MAT_SAND,
  MAT_CRATE,
  MAT_PLANK,
  MAT_GROVE,
  MAT_LEAF,
  MAT_BARK,
  MAT_VINE,
]);

function drawMaterial(
  terrain: LevelTerrain,
  m: number,
  mask: number,
  depth: number,
  variant: number,
  horizontal: boolean,
): RGBAImage {
  if (terrain === 'gym') {
    return m === MAT_PLANK || m === MAT_LEAF || m === MAT_VINE
      ? drawPlankTile(mask, GYM_THEME.plank, variant)
      : drawGroundTile(mask, GYM_THEME.ground, variant);
  }
  switch (m) {
    case MAT_SAND:
      return drawEarthTile(mask, depth, variant, 'sand');
    case MAT_CRATE:
      return drawCrateTile(variant);
    case MAT_PLANK:
      return drawPlankTile(mask, VILLAGE_PLANK, variant);
    case MAT_GROVE:
      return drawGroveTile(mask, depth, variant);
    case MAT_LEAF:
      return drawLeafTile(mask, variant);
    case MAT_BARK:
      return drawBarkTile(mask, horizontal, variant);
    case MAT_VINE:
      return drawVineTile(mask, variant);
    default:
      return drawEarthTile(mask, depth, variant, 'grass');
  }
}

// —— 椰林（第 2 关）——

function canvas(): {
  px: Px[];
  set: (x: number, y: number, c: Px) => void;
  get: (x: number, y: number) => Px;
} {
  const px: Px[] = new Array(256).fill(null);
  return {
    px,
    set: (x, y, c) => {
      if (x >= 0 && x < 16 && y >= 0 && y < 16) px[y * 16 + x] = c;
    },
    get: (x, y) => (x >= 0 && x < 16 && y >= 0 && y < 16 ? px[y * 16 + x]! : null),
  };
}

/**
 * 椰林的林地：顶上一层背阴的深色草皮，草上落着几片黄叶；下面是深褐色的土，越深越暗、越偏蓝紫，
 * 偶尔穿过一条细树根。
 */
export function drawGroveTile(mask: number, depth: number, variant: number): RGBAImage {
  const n = (mask & N) !== 0;
  const e = (mask & E) !== 0;
  const s = (mask & S) !== 0;
  const w = (mask & W) !== 0;
  const { px, set, get } = canvas();
  const bands: Array<[number, ColorName]> = [
    [0, 'bark'],
    [30, 'bark'],
    [62, 'night'],
  ];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) set(x, y, depthColor(x + variant * 5, y, depth * 16 + y, bands));
  // 土里的碎叶和小石子
  const h0 = hash2(variant, depth, 31);
  for (let i = 0; i < 2 + (h0 % 2); i++) {
    const h = hash2(variant, i + depth * 7, 17);
    const x = 2 + (h % 12);
    const y = (n ? 3 : 7) + ((h >> 5) % (n ? 12 : 8));
    const dpx = depth * 16 + y;
    if (dpx > 40) continue;
    set(x, y, 'ochre');
    if ((h >> 9) & 1) set(x + 1, y, 'sand1');
  }
  // 细树根：只在靠近地表的地方，弯弯曲曲往下
  if (depth === 0 && !n && variant === 1) {
    let x = 4 + (hash2(variant, depth, 41) % 8);
    for (let y = 5; y < 15; y++) {
      set(x, y, 'sand1');
      if (y % 3 === 0) x += (hash2(y, x, 5) & 1) * 2 - 1;
    }
  }
  // 顶面：深色草皮 + 落叶
  if (!n) {
    for (let x = 0; x < 16; x++) {
      const hx = hash2(variant, x, 9);
      set(x, 0, 'pine');
      set(x, 1, (hx & 3) === 0 ? 'leaf3' : 'leaf2');
      set(x, 2, (hx >> 2) & 1 ? 'leaf2' : 'leaf1');
      set(x, 3, 'leaf1');
      // 垂下来的草叶
      if ((hx >> 4) % 4 === 0) {
        set(x, 4, 'leaf1');
        set(x, 5, 'pine');
      } else set(x, 4, 'pine');
    }
    // 一两片落叶（黄、橙），每片 2 px
    const count = 1 + (variant % 2);
    for (let i = 0; i < count; i++) {
      const h = hash2(variant, i, 61);
      const x = 1 + (h % 13);
      const c: ColorName = (h >> 6) % 3 === 0 ? 'orange' : 'straw';
      set(x, 1, c);
      set(x + 1, 1 + ((h >> 9) & 1), c);
    }
  }
  const side: ColorName = 'night';
  if (!w)
    for (let y = 0; y < 16; y++) {
      const top = !n && y < 4;
      set(0, y, top ? 'pine' : side);
      if (!top && y > 0 && get(1, y) !== side) set(1, y, 'sand1');
    }
  if (!e)
    for (let y = 0; y < 16; y++) {
      const top = !n && y < 4;
      set(15, y, top ? 'pine' : side);
      if (!top && y > 0) set(14, y, depth * 16 + y > 40 ? side : 'wine');
    }
  if (!s)
    for (let x = 0; x < 16; x++) {
      set(x, 15, side);
      if (get(x, 14) !== side) set(x, 14, 'wine');
    }
  if (!n && !w) set(0, 0, null);
  if (!n && !e) set(15, 0, null);
  if (!s && !w) set(0, 15, null);
  if (!s && !e) set(15, 15, null);
  if (n && w && !(mask & NW)) set(0, 0, side);
  if (n && e && !(mask & NE)) set(15, 0, side);
  if (s && w && !(mask & SW)) set(0, 15, side);
  if (s && e && !(mask & SE)) set(15, 15, side);
  return image(px);
}

/**
 * 椰树叶（单向平台）：一片 5 px 厚的叶子，亮边在上、暗边在下，表面有一道道叶片的分缝；
 * 底下垂着一排斜斜的长条小叶。两端收成叶尖。
 */
export function drawLeafTile(mask: number, variant: number): RGBAImage {
  const e = (mask & E) !== 0;
  const w = (mask & W) !== 0;
  const { px, set, get } = canvas();
  // 叶尖：两端每一行往里收
  const tipR = [6, 3, 1, 0, 2];
  const tipL = [4, 2, 0, 0, 2];
  const inBody = (x: number, y: number) => {
    if (y < 0 || y > 4) return false;
    if (x < 0) return w;
    if (x > 15) return e;
    if (!e && x > 15 - tipR[y]!) return false;
    if (!w && x < tipL[y]!) return false;
    return true;
  };
  const ROW: ColorName[] = ['pine', 'leaf3', 'leaf3', 'leaf2', 'pine'];
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 16; x++) {
      if (!inBody(x, y)) continue;
      const edge = !inBody(x, y - 1) || !inBody(x, y + 1) || !inBody(x - 1, y) || !inBody(x + 1, y);
      set(x, y, edge ? 'pine' : ROW[y]!);
    }
  // 叶片的分缝：每 4 px 一道斜斜的暗线，让叶面看起来是一片片小叶排成的
  const off = variant % 4;
  for (let x = off; x < 16; x += 4) {
    if (get(x, 1) === 'leaf3') set(x, 1, 'leaf2');
    if (get(x - 1, 2) === 'leaf3') set(x - 1, 2, 'leaf2');
    if (get(x - 2, 3) === 'leaf2') set(x - 2, 3, 'leaf1');
  }
  // 垂下来的小叶：从叶子底边斜着往左下垂，2 px 宽，越往下越暗
  for (let x0 = 3 + ((off + 1) % 4); x0 < 17; x0 += 4) {
    if (!inBody(x0, 4) || !inBody(x0 - 3, 4)) continue;
    const len = 4 + (hash2(variant, x0, 13) % 5);
    for (let i = 0; i < len; i++) {
      const x = x0 - (i >> 1);
      const y = 5 + i;
      if (i === len - 1) {
        set(x, y, 'pine');
        continue;
      }
      set(x, y, i < 2 ? 'leaf2' : 'leaf1');
      set(x + 1, y, 'pine');
    }
  }
  return image(px);
}

/**
 * 树皮（实心）：横着的倒木是横向木纹，两头露出年轮切面，顶上长着青苔；
 * 竖着的树桩是竖向木纹，左亮右暗显出圆柱的体积，顶上是浅色的切面。
 */
export function drawBarkTile(mask: number, horizontal: boolean, variant: number): RGBAImage {
  const n = (mask & N) !== 0;
  const e = (mask & E) !== 0;
  const s = (mask & S) !== 0;
  const w = (mask & W) !== 0;
  const { px, set, get } = canvas();
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      // 木纹：沿着树干方向、长短不一的亮纹和裂纹
      const a = horizontal ? y : x;
      const b = horizontal ? x : y;
      const seg = Math.floor((b + a * 5 + variant * 3) / 6);
      const h = hash2(a, seg, 3);
      let c: ColorName = 'bark';
      if (a % 5 === 1 && (h & 3) !== 0) c = 'ochre';
      else if (a % 5 === 3 && (h & 7) < 3) c = 'night';
      set(x, y, c);
    }
  const side: ColorName = 'night';
  if (horizontal) {
    if (!n)
      for (let x = 0; x < 16; x++) {
        set(x, 0, side);
        set(x, 1, 'sand1');
        set(x, 2, get(x, 2) === side ? 'bark' : get(x, 2));
        // 青苔
        if ((hash2(x >> 2, variant, 71) & 1) === 0) {
          set(x, 1, (x + variant) % 3 === 0 ? 'leaf3' : 'leaf2');
          set(x, 2, 'leaf1');
        }
      }
    if (!s)
      for (let x = 0; x < 16; x++) {
        set(x, 15, side);
        set(x, 14, 'wine');
      }
    // 两头的年轮切面
    const face = (x0: number, dir: 1 | -1) => {
      for (let y = 0; y < 16; y++) {
        set(x0, y, side);
        set(x0 + dir, y, 'sand2');
        set(x0 + dir * 2, y, (y + variant) % 4 === 1 ? 'sand1' : 'sand3');
        set(x0 + dir * 3, y, 'sand2');
        set(x0 + dir * 4, y, side);
      }
      if (!n) {
        set(x0, 0, null);
        set(x0, 1, null);
        set(x0 + dir, 0, null);
        set(x0 + dir, 1, side);
        set(x0, 2, side);
        set(x0 + dir * 2, 0, side);
        set(x0 + dir * 3, 0, side);
      }
      if (!s) {
        set(x0, 15, null);
        set(x0, 14, null);
        set(x0 + dir, 15, null);
        set(x0 + dir, 14, side);
        set(x0, 13, side);
        set(x0 + dir * 2, 15, side);
        set(x0 + dir * 3, 15, side);
      }
    };
    if (!w) face(0, 1);
    if (!e) face(15, -1);
  } else {
    if (!w)
      for (let y = 0; y < 16; y++) {
        set(0, y, side);
        set(1, y, 'sand1');
        if (get(2, y) === 'bark') set(2, y, 'ochre');
      }
    if (!e)
      for (let y = 0; y < 16; y++) {
        set(15, y, side);
        set(14, y, 'wine');
        if (get(13, y) === 'ochre') set(13, y, 'bark');
      }
    if (!n) {
      // 顶上的切面（稍微从上往下看）
      for (let x = 0; x < 16; x++) {
        set(x, 0, side);
        set(x, 1, 'sand2');
        set(x, 2, (x + variant) % 5 === 0 ? 'sand1' : 'sand3');
        set(x, 3, 'sand2');
        set(x, 4, side);
      }
      if (!w) {
        set(0, 0, null);
        set(0, 1, null);
        set(1, 0, null);
        set(1, 1, side);
        set(0, 2, side);
      }
      if (!e) {
        set(15, 0, null);
        set(15, 1, null);
        set(14, 0, null);
        set(14, 1, side);
        set(15, 2, side);
      }
    }
    if (!s)
      for (let x = 0; x < 16; x++) {
        set(x, 15, side);
        if (get(x, 14) !== side) set(x, 14, 'wine');
      }
  }
  if (n && w && !(mask & NW)) set(0, 0, side);
  if (n && e && !(mask & NE)) set(15, 0, side);
  if (s && w && !(mask & SW)) set(0, 15, side);
  if (s && e && !(mask & SE)) set(15, 15, side);
  return image(px);
}

/**
 * 藤蔓吊桥（单向）：一排侧看的短木板，有的稍微歪一点，用藤蔓捆着，下面托着一道藤蔓、
 * 垂着几根卷须；两头各垂下一长条带叶子的藤蔓。
 */
export function drawVineTile(mask: number, variant: number): RGBAImage {
  const e = (mask & E) !== 0;
  const w = (mask & W) !== 0;
  const { px, set } = canvas();
  // 每块木板 4 px 宽，板与板之间空 1 px
  for (let k = 0; k < 4; k++) {
    const x0 = k * 4;
    const sag = hash2(variant, k, 47) % 4 === 0 ? 1 : 0;
    for (let i = 0; i < 3; i++) {
      const x = x0 + i;
      set(x, sag, 'night');
      set(x, sag + 1, i === 0 ? 'cream' : 'sand3');
      set(x, sag + 2, 'sand2');
      set(x, sag + 3, i === 2 ? 'bark' : 'sand1');
      set(x, sag + 4, 'night');
    }
    // 板缝里绕过去的藤
    const gx = x0 + 3;
    set(gx, 1, 'leaf2');
    set(gx, 2, 'leaf1');
    set(gx, 3, 'leaf1');
    set(gx, 4, 'pine');
  }
  // 下面托着的一道藤蔓，每隔几格长一片小叶
  for (let x = 0; x < 16; x++) {
    set(x, 5, (x + variant) % 6 === 0 ? 'leaf2' : 'leaf1');
    set(x, 6, 'pine');
  }
  const h = hash2(variant, 1, 29);
  const leafX = 3 + (h % 9);
  set(leafX, 7, 'leaf2');
  set(leafX + 1, 7, 'leaf1');
  set(leafX + 1, 8, 'pine');
  // 卷须
  if ((h >> 4) % 3 !== 0) {
    const x = 1 + ((h >> 7) % 12);
    const len = 3 + ((h >> 11) % 4);
    for (let i = 0; i < len; i++) set(x + (i > len - 3 ? 1 : 0), 7 + i, 'leaf1');
    set(x + 2, 7 + len - 2, 'leaf2');
  }
  // 两头垂下来的长藤（带叶子）
  const hang = (x: number, dir: 1 | -1) => {
    for (let y = 1; y < 16; y++) {
      set(x, y, y < 5 ? 'pine' : 'leaf1');
      if (y >= 5) set(x + dir, y, y % 3 === 0 ? 'leaf2' : null);
    }
    for (const y of [7, 11]) {
      set(x - dir, y, 'leaf2');
      set(x - dir * 2, y + 1, 'leaf2');
      set(x - dir, y + 1, 'leaf1');
    }
    set(x, 15, 'pine');
  };
  if (!w) {
    for (let y = 0; y < 7; y++) set(0, y, null);
    hang(2, 1);
  }
  if (!e) {
    for (let y = 0; y < 7; y++) set(15, y, null);
    hang(13, -1);
  }
  return image(px);
}
