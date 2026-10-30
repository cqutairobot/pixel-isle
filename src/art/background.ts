import { hexToRgb, PALETTE, type ColorName } from './palette';
import { rng } from './rng';
import type { RGBAImage } from './sprite';

/** 程序化视差背景。所有颜色来自调色板，带种子，结果固定。 */

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function newImage(w: number, h: number): RGBAImage {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

function put(img: RGBAImage, x: number, y: number, c: ColorName): void {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const [r, g, b] = hexToRgb(PALETTE[c]);
  const i = (y * img.w + x) * 4;
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = 255;
}

/** 竖直渐变：在相邻两色之间用 4×4 有序抖动过渡 */
export function skyGradient(w: number, h: number, stops: Array<[ColorName, number]>): RGBAImage {
  const img = newImage(w, h);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1]![1]) i++;
    const [c0, t0] = stops[i]!;
    const [c1, t1] = stops[i + 1]!;
    const f = Math.min(1, Math.max(0, (t - t0) / Math.max(0.0001, t1 - t0)));
    for (let x = 0; x < w; x++) {
      const threshold = (BAYER4[(y % 4) * 4 + (x % 4)]! + 0.5) / 16;
      put(img, x, y, f > threshold ? c1 : c0);
    }
  }
  return img;
}

/** 可横向无缝平铺的山丘剪影：几条不同周期正弦叠加，顶边一像素亮边 */
export function hills(
  w: number,
  h: number,
  seed: number,
  body: ColorName,
  rim: ColorName,
  base: number,
  amp: number,
): RGBAImage {
  const img = newImage(w, h);
  const rand = rng(seed);
  const waves = [1, 2, 3, 5].map((k) => ({
    k,
    a: (rand() * 0.6 + 0.4) / k,
    p: rand() * Math.PI * 2,
  }));
  for (let x = 0; x < w; x++) {
    let v = 0;
    for (const wv of waves) v += wv.a * Math.sin((x / w) * Math.PI * 2 * wv.k + wv.p);
    const top = Math.round(base - v * amp);
    for (let y = Math.max(0, top); y < h; y++) put(img, x, y, y === top ? rim : body);
  }
  return img;
}

/** 可横向平铺的云层：每朵云由几个圆叠成，底部一条阴影色 */
export function clouds(
  w: number,
  h: number,
  seed: number,
  light: ColorName,
  shade: ColorName,
): RGBAImage {
  const img = newImage(w, h);
  const rand = rng(seed);
  const count = Math.round(w / 110);
  for (let i = 0; i < count; i++) {
    const cx = Math.round((i + 0.2 + rand() * 0.6) * (w / count));
    const cy = Math.round(h * 0.35 + rand() * h * 0.35);
    const puffs = 3 + Math.floor(rand() * 3);
    const bottom = cy + 6;
    for (let p = 0; p < puffs; p++) {
      const px = cx + Math.round((p - (puffs - 1) / 2) * (8 + rand() * 4));
      const r = 5 + Math.round(rand() * 6);
      const py = bottom - r + Math.round(rand() * 2);
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y > r * r) continue;
          const yy = py + y;
          if (yy > bottom) continue;
          const xx = (((px + x) % w) + w) % w;
          put(img, xx, yy, yy >= bottom - 1 ? shade : light);
        }
      }
    }
  }
  return img;
}
