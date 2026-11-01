import { Paint, type ImageSheet } from './paint';
import type { RGBAImage } from './sprite';

/**
 * 装备的精灵：回旋海星（14×14）。五角星每转 72° 就和原来一样，所以 8 帧旋转帧铺满这 72°，
 * 转起来很顺；另有 HUD 装备格的框。
 */

const STAR = 14;

/** 点 (x, y) 在不在以 (cx, cy) 为中心、转了 a 弧度的五角星里 */
function inStar(
  x: number,
  y: number,
  cx: number,
  cy: number,
  ro: number,
  ri: number,
  a: number,
): boolean {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const t = a - Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  // 射线法
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function starfish(a: number, size = STAR): RGBAImage {
  const p = new Paint(size, size);
  const c = size / 2;
  const ro = size * 0.47;
  const ri = size * 0.21;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      if (!inStar(px, py, c, c, ro, ri, a)) continue;
      // 光从左上来：左上半边亮、右下半边暗
      const lit = px - c + (py - c) < -size * 0.08;
      const dark = px - c + (py - c) > size * 0.22;
      p.set(x, y, lit ? 'gold' : dark ? 'red2' : 'orange');
    }
  // 中心的小圆点和每条腕上的颗粒
  p.set(Math.floor(c) - 1, Math.floor(c) - 1, 'cream').set(
    Math.floor(c),
    Math.floor(c) - 1,
    'cream',
  );
  for (let i = 0; i < 5; i++) {
    const t = a - Math.PI / 2 + (i * 2 * Math.PI) / 5;
    p.set(c - 0.5 + Math.cos(t) * ro * 0.55, c - 0.5 + Math.sin(t) * ro * 0.55, 'cream');
  }
  p.outline('night');
  return p.toImage();
}

/** HUD 的装备格：深色圆角小框 */
function slot(): RGBAImage {
  const p = new Paint(18, 18);
  p.rect(1, 0, 16, 18, 'night').rect(0, 1, 18, 16, 'night');
  p.rect(1, 1, 16, 16, 'slate');
  p.rect(2, 2, 14, 14, 'night');
  p.hline(2, 15, 2, 'deep');
  p.set(1, 1, 'mist');
  return p.toImage();
}

const frames: Record<string, RGBAImage> = {};
for (let i = 0; i < 8; i++) frames[`star_${i}`] = starfish((i / 8) * ((Math.PI * 2) / 5));
frames.star_big = starfish(0, 24);
frames.slot = slot();

export const equipSheet: ImageSheet = { key: 'equip', frames };
