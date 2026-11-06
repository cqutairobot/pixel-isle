import { MAP_NODES, MAP_PATHS, MAP_SHOP } from '../content/map';
import { Paint, ditherPick, type ImageSheet } from './paint';
import type { ColorName } from './palette';
import { rng } from './rng';
import type { RGBAImage } from './sprite';

/**
 * 章节地图的插画（docs/levels/1-2.md §5）：一屏大小的时令岛南岸，从高处斜着往下看。
 * 西边是晨钟村和沙滩，往东是椰林、高高的回声崖、结了冰的冻浪湾，最东边的海上小岛是潮汐神龛。
 * 节点的位置来自 src/content/map.ts，插画按这些位置留出空地；路上的小圆点由地图场景画。
 */

export const MAP_W = 384;
export const MAP_H = 216;

/** 海岸线：x 处陆地的最南端（比它大的 y 是海） */
const COAST: Array<[number, number]> = [
  [0, 174],
  [40, 170],
  [84, 166],
  [118, 160],
  [156, 158],
  [186, 152],
  [214, 146],
  [244, 150],
  [262, 132],
  [288, 112],
  [314, 122],
  [332, 146],
  [352, 140],
  [384, 134],
];

export function coastAt(x: number): number {
  let i = 0;
  while (i < COAST.length - 2 && x > COAST[i + 1]![0]) i++;
  const [x0, y0] = COAST[i]!;
  const [x1, y1] = COAST[i + 1]!;
  const t = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
  const k = 0.5 - Math.cos(t * Math.PI) / 2;
  return y0 + (y1 - y0) * k + Math.sin(x * 0.21) * 1.2 + Math.sin(x * 0.07 + 1) * 1.6;
}

/** 冻浪湾：海湾里结了冰的那一片 */
function inBay(x: number, y: number): boolean {
  const dx = (x - 292) / 40;
  const dy = (y - 140) / 30;
  return dx * dx + dy * dy < 1 && y > coastAt(x);
}

/** 回声崖：高出一截的台地（椭圆） */
function onCliff(x: number, y: number): boolean {
  const dx = (x - 216) / 38;
  const dy = (y - 92) / 30;
  return dx * dx + dy * dy < 1;
}

/** 离某个节点多近（插画在节点周围留出空地） */
function nearNode(x: number, y: number, r: number): boolean {
  return [...MAP_NODES, MAP_SHOP].some((n) => Math.hypot(n.x - x, n.y - y) < r);
}

function palmIcon(p: Paint, x: number, y: number, dark = false): void {
  // 弯弯的树干
  const trunk: ColorName = dark ? 'bark' : 'ochre';
  for (let k = 0; k < 9; k++) {
    const tx = x + Math.round(Math.sin(k * 0.25) * 1.5);
    p.set(tx, y - k, trunk);
    if (k % 3 === 0) p.set(tx + 1, y - k, 'bark');
  }
  const cx = x + 2;
  const cy = y - 9;
  // 五片往下垂的叶子
  const leaf: ColorName = dark ? 'leaf1' : 'leaf2';
  for (const [dx, dy] of [
    [-6, 3],
    [-4, -1],
    [0, -3],
    [4, -1],
    [6, 3],
  ] as Array<[number, number]>) {
    p.line(cx, cy + 1, cx + dx, cy + dy + 1, 'pine');
    p.line(cx, cy, cx + dx, cy + dy, dy < 0 ? 'leaf3' : leaf);
  }
  p.set(cx - 1, cy - 1, 'leaf3').set(cx + 1, cy - 1, 'leaf3');
  p.set(cx, cy + 1, 'bark').set(cx + 1, cy + 1, 'bark');
}

function treeIcon(p: Paint, x: number, y: number, r: () => number): void {
  const s = 2.5 + r() * 1.5;
  p.ellipse(x, y, s, s * 0.85, 'leaf1');
  p.ellipse(x - 0.8, y - 0.8, s * 0.55, s * 0.45, 'leaf2');
  p.set(x - 1, y - 2, 'leaf3');
  p.hline(Math.round(x - s + 1), Math.round(x + s - 1), Math.round(y + s * 0.85), 'pine');
}

function house(p: Paint, x: number, y: number, roof: ColorName): void {
  p.rect(x, y, 7, 4, 'cream');
  p.rect(x, y + 3, 7, 1, 'sand2');
  p.set(x + 3, y + 2, 'bark').set(x + 3, y + 3, 'bark');
  p.rect(x - 1, y - 2, 9, 2, roof);
  p.hline(x, x + 6, y - 3, roof);
  p.hline(x - 1, x + 7, y - 1, roof === 'teal' ? 'sea' : 'red1');
}

/** 整张地图的插画 */
export function mapBackground(): RGBAImage {
  const p = new Paint(MAP_W, MAP_H);
  const r = rng(11);
  // 海：近岸浅、远处深，零星的浪花
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const c = coastAt(x);
      if (y < c) continue;
      const d = y - c;
      const far = (y - 120) / 96 + (x > 330 ? 0.15 : 0);
      let col: ColorName =
        d < 3 ? 'cloud' : d < 9 ? ditherPick(x, y, (d - 3) / 6, 'teal', 'sea') : 'sea';
      if (d >= 9) col = ditherPick(x, y, Math.min(1, Math.max(0, far)), 'sea', 'deep');
      p.set(x, y, col);
    }
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(r() * MAP_W);
    const y = Math.floor(r() * MAP_H);
    if (y < coastAt(x) + 10 || inBay(x, y)) continue;
    p.hline(x, x + 2 + Math.floor(r() * 3), y, r() < 0.5 ? 'teal' : 'cloud');
  }
  // 陆地：草地，越往北（上）越暗，零星的深浅草斑
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (y >= coastAt(x)) continue;
      const t = Math.min(1, Math.max(0, (80 - y) / 80));
      p.set(x, y, ditherPick(x, y, t * 0.9, 'leaf2', 'leaf1'));
    }
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(r() * MAP_W);
    const y = Math.floor(r() * MAP_H);
    if (y >= coastAt(x) - 3) continue;
    p.set(x, y, r() < 0.5 ? 'leaf3' : 'leaf1');
  }
  // 沙滩（西边一段）：沿海岸一条沙带
  for (let x = 0; x < 186; x++) {
    const c = Math.floor(coastAt(x));
    const w = 5 + Math.round(Math.sin(x * 0.11) * 2);
    for (let y = c - w; y < c; y++) p.set(x, y, y > c - 3 ? 'sand3' : 'sand2');
  }
  // 北边：一片树林和远山（山顶结着霜）
  for (let x = 0; x < MAP_W; x++) {
    const h =
      26 + Math.sin(x * 0.045) * 8 + Math.sin(x * 0.13 + 2) * 4 + (x > 250 ? (x - 250) * 0.08 : 0);
    for (let y = 0; y < h; y++) {
      const snow = y < h - 14 && x > 240;
      p.set(x, y, snow ? (y % 3 === 0 ? 'mist' : 'cloud') : y < h - 3 ? 'stone' : 'slate');
    }
  }
  for (let i = 0; i < 120; i++) {
    const x = r() * MAP_W;
    const y = 30 + r() * 30;
    if (y >= coastAt(x) - 6 || onCliff(x, y) || nearNode(x, y, 14)) continue;
    treeIcon(p, x, y, r);
  }
  // 回声崖：高出一截的台地。顶上是浅一点的草，南边露出一道高高的岩壁
  const WALL = 11;
  for (let x = 170; x < 262; x++) {
    let bottom = -1;
    for (let y = 40; y < 140; y++) if (onCliff(x, y)) bottom = y;
    if (bottom < 0) continue;
    for (let y = 40; y <= bottom; y++) {
      if (!onCliff(x, y)) continue;
      p.set(x, y, ditherPick(x, y, 0.35, 'leaf2', 'leaf3'));
      if (!onCliff(x, y - 1)) p.set(x, y, 'leaf3');
    }
    // 岩壁：竖条纹，左边亮右边暗，底下一道阴影
    const left = x < 216;
    for (let k = 1; k <= WALL; k++) {
      const y = bottom + k;
      let c: ColorName = x % 4 === 0 ? 'slate' : left ? 'mist' : 'stone';
      if (k <= 2) c = 'leaf1';
      if (k === WALL) c = 'slate';
      if ((x * 7 + k * 3) % 11 === 0) c = 'cloud';
      p.set(x, y, c);
    }
  }
  // 台地上的几块石头
  for (const [x, y] of [
    [196, 84],
    [234, 80],
    [228, 104],
  ] as Array<[number, number]>) {
    p.ellipse(x, y, 2.5, 1.6, 'stone');
    p.set(x - 1, y - 1, 'mist');
  }
  // 冻浪湾：海湾里结了冰，冰面上有裂纹和冻住的浪尖
  for (let y = 100; y < 180; y++)
    for (let x = 248; x < 340; x++) {
      if (!inBay(x, y)) continue;
      p.set(x, y, ditherPick(x, y, (y - 110) / 80, 'cloud', 'frost'));
    }
  for (let i = 0; i < 14; i++) {
    let x = 262 + r() * 60;
    let y = 120 + r() * 40;
    for (let k = 0; k < 6; k++) {
      if (inBay(x, y)) p.set(x, y, 'mist');
      x += r() * 3 - 1;
      y += r() * 2 - 0.5;
    }
  }
  for (const [x, y] of [
    [270, 140],
    [296, 150],
    [316, 136],
  ] as Array<[number, number]>) {
    p.hline(x - 3, x + 3, y, 'white');
    p.set(x - 1, y - 1, 'white').set(x, y - 2, 'white');
  }
  // 潮汐神龛：海上的小岩岛，周围的海面也结了霜
  for (let y = 150; y < 200; y++)
    for (let x = 320; x < 380; x++) {
      const dx = (x - 348) / 22;
      const dy = (y - 176) / 12;
      if (dx * dx + dy * dy < 1 && y > coastAt(x) + 4)
        p.set(x, y, ditherPick(x, y, 0.5, 'sea', 'frost'));
    }
  p.ellipse(348, 176, 14, 6, 'stone');
  p.ellipse(346, 174, 10, 4, 'mist');
  p.hline(336, 360, 181, 'slate');
  // 村子：几间小屋和钟楼（节点在它们中间）
  house(p, 28, 128, 'red2');
  house(p, 40, 146, 'teal');
  house(p, 78, 150, 'red2');
  house(p, 86, 130, 'teal');
  p.rect(48, 112, 5, 16, 'sand2');
  p.rect(47, 110, 7, 3, 'red1');
  p.set(50, 115, 'gold').set(49, 116, 'gold').set(51, 116, 'gold');
  p.vline(52, 113, 127, 'sand1');
  // 沙滩边的椰子树、椰林（节点周围留出空地）
  palmIcon(p, 100, 156);
  palmIcon(p, 20, 160);
  // 椰林：一片深色的林地，上面密密地长着椰子树（避开节点和路）
  for (let y = 92; y < 156; y++)
    for (let x = 96; x < 182; x++) {
      const dx = (x - 138) / 40;
      const dy = (y - 124) / 26;
      const d = dx * dx + dy * dy + Math.sin(x * 0.3) * 0.08;
      if (d < 1 && y < coastAt(x) - 6 && !onCliff(x, y))
        p.set(x, y, ditherPick(x, y, 1 - d, 'leaf2', 'leaf1'));
    }
  const pathDots = MAP_PATHS.flatMap((q) => q.dots);
  const clear = (x: number, y: number) =>
    !nearNode(x, y, 12) && !pathDots.some(([px, py]) => Math.hypot(px - x, py - y + 5) < 6);
  for (let gy = 100; gy < 152; gy += 9)
    for (let gx = 100; gx < 180; gx += 10) {
      const x = gx + Math.floor(r() * 6) - 3 + ((gy / 9) % 2) * 5;
      const y = gy + Math.floor(r() * 4);
      const dx = (x - 138) / 40;
      const dy = (y - 124) / 26;
      if (dx * dx + dy * dy > 0.9 || y > coastAt(x) - 8 || onCliff(x, y - 9)) continue;
      if (clear(x, y)) palmIcon(p, x, y, (x + y) % 3 === 0);
    }
  // 冻浪湾外缘碎成一块块浮冰
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI;
    const x = Math.round(292 + Math.cos(a) * (40 + r() * 8));
    const y = Math.round(140 + Math.sin(a) * (30 + r() * 6));
    if (y <= coastAt(x) + 2 || inBay(x, y)) continue;
    p.rect(x, y, 2 + Math.floor(r() * 3), 1 + Math.floor(r() * 2), 'cloud');
    p.set(x, y + 1, 'mist');
  }
  // 海岸线上一条白色浪花
  for (let x = 0; x < MAP_W; x++) {
    const c = Math.floor(coastAt(x));
    if (!inBay(x, c + 1)) p.set(x, c, 'white');
  }
  return p.toImage();
}

/** 关卡节点：石头底座上的一只铃铛（锁住是灰的，可进是金的，通关多一条红绸带） */
function bell(state: 'locked' | 'open' | 'cleared' | 'soon'): RGBAImage {
  const p = new Paint(18, 18);
  p.ellipse(9, 14.5, 7.5, 3, 'stone');
  p.hline(3, 15, 13, 'mist');
  p.hline(4, 14, 17, 'slate');
  const gray = state === 'locked' || state === 'soon';
  const body: ColorName = gray ? 'stone' : 'gold';
  const shade: ColorName = gray ? 'slate' : 'straw';
  const light: ColorName = gray ? 'mist' : 'cream';
  // 铃身：上窄下宽
  for (let y = 3; y <= 11; y++) {
    const half = 2 + Math.floor((y - 3) * 0.45);
    p.hline(9 - half, 9 + half - 1, y, body);
    p.set(9 + half - 1, y, shade);
  }
  p.hline(5, 12, 11, shade);
  p.set(7, 5, light).set(7, 6, light).set(6, 8, light);
  p.set(8, 2, body).set(9, 2, body);
  p.set(8, 12, gray ? 'slate' : 'ochre').set(9, 12, gray ? 'slate' : 'ochre');
  if (state === 'cleared') {
    p.line(11, 3, 14, 1, 'red1');
    p.line(11, 4, 15, 4, 'red2');
    p.set(15, 1, 'red2');
  }
  if (state === 'soon') {
    p.set(8, 6, 'cream').set(9, 5, 'cream').set(10, 6, 'cream').set(10, 7, 'cream');
    p.set(9, 8, 'cream').set(9, 10, 'cream');
  }
  p.outline('night');
  return p.toImage();
}

/** 路上的小圆点 */
function dot(): RGBAImage {
  const p = new Paint(5, 5);
  p.rect(1, 1, 3, 3, 'cream');
  p.set(1, 1, 'white');
  p.hline(1, 3, 4, 'sand1');
  return p.toImage();
}

/** 大暑的冰沙摊（地图上的小图标）：红白条纹的伞和小推车 */
function shop(): RGBAImage {
  const p = new Paint(20, 18);
  for (let x = 2; x <= 17; x++) {
    const d = Math.abs(x - 9.5) / 8;
    const top = 1 + Math.round(d * d * 4);
    for (let y = top; y <= 5; y++) p.set(x, y, Math.floor((x - 2) / 3) % 2 ? 'cream' : 'red2');
  }
  p.vline(9, 5, 10, 'bark');
  p.rect(3, 10, 14, 4, 'sand2');
  p.hline(3, 16, 10, 'sand3');
  p.rect(5, 8, 4, 2, 'frost');
  p.set(12, 9, 'red2').set(14, 9, 'gold');
  p.disc(6, 15, 1.6, 'night');
  p.disc(14, 15, 1.6, 'night');
  p.outline('night');
  return p.toImage();
}

export const mapSheet: ImageSheet = {
  key: 'map',
  frames: {
    bell_locked: bell('locked'),
    bell_open: bell('open'),
    bell_cleared: bell('cleared'),
    bell_soon: bell('soon'),
    dot: dot(),
    shop: shop(),
  },
};
