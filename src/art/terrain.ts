import { T_ONEWAY, T_SOLID, type Grid } from '../sim/grid';
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
