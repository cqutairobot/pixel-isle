import { hexToRgb, PALETTE, type ColorName } from './palette';
import { BAYER4 } from './paint';
import { rng } from './rng';
import type { RGBAImage } from './sprite';

/** 程序化视差背景。所有颜色来自调色板，带种子，结果固定。 */

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

// —— 第一章：清晨的海岛 ——

/** 太阳：亮白的圆盘，外面两圈抖动的光晕（透明背景） */
export function sunDisc(r: number): RGBAImage {
  const size = r * 6;
  const img = newImage(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      const th = (BAYER4[(y % 4) * 4 + (x % 4)]! + 0.5) / 16;
      if (d <= r - 1) put(img, x, y, 'white');
      else if (d <= r) put(img, x, y, 'cream');
      else if (d <= r * 1.7 && (1 - (d - r) / (r * 0.7)) * 0.9 > th) put(img, x, y, 'cream');
      else if (d <= r * 2.4 && (1 - (d - r * 1.7) / (r * 0.7)) * 0.35 > th) put(img, x, y, 'skin2');
    }
  }
  return img;
}

/**
 * 海面：顶上一道亮色海平线，往下由青绿渐深；横向的波光短线按帧错开，
 * 太阳正下方有一条竖向的倒影光带。可横向平铺（倒影除外，倒影单独画）。
 */
export function seaBand(w: number, h: number, frame: number, seed = 5): RGBAImage {
  const img = newImage(w, h);
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    for (let x = 0; x < w; x++) {
      const th = (BAYER4[(y % 4) * 4 + (x % 4)]! + 0.5) / 16;
      let c: ColorName;
      if (y === 0) c = 'cloud';
      else if (t < 0.35) c = (t / 0.35) * 0.8 > th ? 'teal' : 'sky';
      else if (t < 0.75) c = ((t - 0.35) / 0.4) * 0.9 > th ? 'sea' : 'teal';
      else c = ((t - 0.75) / 0.25) * 0.7 > th ? 'deep' : 'sea';
      put(img, x, y, c);
    }
  }
  // 波光：每帧整体错开一点，近处（下方）的短线更长
  const rand = rng(seed);
  const count = Math.round((w * h) / 90);
  for (let i = 0; i < count; i++) {
    const y = 2 + Math.floor(rand() * (h - 3));
    const phase = rand() * 4;
    const len = 1 + Math.floor((y / h) * 4 * rand()) + (rand() < 0.3 ? 1 : 0);
    const x0 = Math.floor(rand() * w);
    // 4 帧里只亮其中 2–3 帧，形成闪烁
    if ((Math.floor(phase) + frame) % 4 === 3) continue;
    const dx = Math.round(Math.sin((frame + phase) * (Math.PI / 2)) * 1.5);
    const c: ColorName = y < h * 0.4 ? 'cloud' : rand() < 0.5 ? 'sky' : 'cloud';
    for (let k = 0; k < len; k++) put(img, (((x0 + dx + k) % w) + w) % w, y, c);
  }
  return img;
}

/** 太阳在海面上的倒影：一列宽窄不一、闪烁的亮色短线（透明背景） */
export function sunGlitter(w: number, h: number, frame: number): RGBAImage {
  const img = newImage(w, h);
  const rand = rng(77 + frame * 13);
  for (let y = 1; y < h; y += 2) {
    const half = Math.round((w / 2) * (0.35 + (y / h) * 0.65) * (0.6 + rand() * 0.4));
    const cx = w / 2 + Math.round((rand() - 0.5) * 3);
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      if (rand() < 0.55) put(img, x, y, rand() < 0.4 ? 'white' : 'cream');
    }
  }
  return img;
}

/** 远处的小岛：海平线上几座低矮的剪影（可横向平铺） */
export function islands(
  w: number,
  h: number,
  seed: number,
  body: ColorName,
  rim: ColorName,
): RGBAImage {
  const img = newImage(w, h);
  const rand = rng(seed);
  const n = Math.max(2, Math.round(w / 140));
  for (let i = 0; i < n; i++) {
    const cx = (i + 0.3 + rand() * 0.4) * (w / n);
    const half = 18 + rand() * 30;
    const peak = 6 + rand() * (h - 8);
    const lumps = 1 + Math.floor(rand() * 3);
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const u = (x - cx) / half;
      let v = Math.max(0, 1 - u * u);
      for (let k = 1; k <= lumps; k++)
        v += Math.max(0, 0.25 * Math.sin((u + k) * 5.3)) * (1 - Math.abs(u));
      const top = Math.round(h - v * peak);
      const xx = ((x % w) + w) % w;
      for (let y = Math.max(0, top); y < h; y++) put(img, xx, y, y === top ? rim : body);
    }
  }
  return img;
}

/** 村庄远景：起伏的山坡上散落着平顶小屋和圆圆的树冠（可横向平铺） */
export function villageSilhouette(
  w: number,
  h: number,
  seed: number,
  body: ColorName,
  rim: ColorName,
): RGBAImage {
  const img = newImage(w, h);
  const rand = rng(seed);
  const ground = (x: number) =>
    Math.round(
      h -
        16 -
        6 * Math.sin((x / w) * Math.PI * 2 * 2 + 1.3) -
        4 * Math.sin((x / w) * Math.PI * 2 * 5),
    );
  // 树冠
  const trees = Math.round(w / 26);
  for (let i = 0; i < trees; i++) {
    const cx = Math.floor(rand() * w);
    const r = 5 + Math.floor(rand() * 5);
    const cy = ground(cx) - r + 3;
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r) put(img, (((cx + x) % w) + w) % w, cy + y, body);
  }
  // 平顶小屋
  const houses = Math.round(w / 60);
  for (let i = 0; i < houses; i++) {
    const x0 = Math.floor(rand() * w);
    const hw = 9 + Math.floor(rand() * 8);
    const hh = 7 + Math.floor(rand() * 6);
    const gy = ground(x0 + hw / 2) + 2;
    for (let y = gy - hh; y < h; y++) for (let x = 0; x < hw; x++) put(img, (x0 + x) % w, y, body);
    // 屋顶的檐口
    for (let x = -1; x <= hw; x++) put(img, (((x0 + x) % w) + w) % w, gy - hh, rim);
  }
  for (let x = 0; x < w; x++) for (let y = ground(x); y < h; y++) put(img, x, y, body);
  // 顶边亮色描线
  for (let x = 0; x < w; x++) {
    for (let y = 1; y < h; y++) {
      const i = (y * w + x) * 4;
      const above = ((y - 1) * w + x) * 4;
      if (img.data[i + 3] && !img.data[above + 3]) {
        put(img, x, y, rim);
        break;
      }
    }
  }
  return img;
}

/** 海边远景：礁石、海蚀柱和崖上的小灯塔（可横向平铺） */
export function coastSilhouette(
  w: number,
  h: number,
  seed: number,
  body: ColorName,
  rim: ColorName,
): RGBAImage {
  const img = newImage(w, h);
  const rand = rng(seed);
  const stacks = Math.round(w / 70);
  for (let i = 0; i < stacks; i++) {
    const cx = Math.floor((i + rand() * 0.6) * (w / stacks));
    const sw = 6 + Math.floor(rand() * 10);
    const sh = 10 + Math.floor(rand() * (h - 14));
    for (let y = h - sh; y < h; y++) {
      const narrow = Math.round(((y - (h - sh)) / sh) * 3 * (rand() * 0.2 + 0.9));
      for (let x = -sw / 2 - narrow; x <= sw / 2 + narrow; x++) {
        put(img, (((cx + Math.round(x)) % w) + w) % w, y, y === h - sh ? rim : body);
      }
    }
  }
  // 灯塔：崖顶一座白塔（只画一座，在图的中间）
  const lx = Math.floor(w * 0.5);
  const cliffTop = h - 18;
  for (let x = lx - 22; x <= lx + 22; x++) {
    const top = cliffTop + Math.round(Math.abs(x - lx) * 0.35);
    for (let y = top; y < h; y++) put(img, ((x % w) + w) % w, y, y === top ? rim : body);
  }
  for (let y = cliffTop - 16; y < cliffTop; y++) {
    const half = 2 + Math.round(((y - (cliffTop - 16)) / 16) * 1.5);
    for (let x = -half; x <= half; x++) put(img, lx + x, y, (y - cliffTop) % 5 === 0 ? body : rim);
  }
  put(img, lx, cliffTop - 18, rim);
  put(img, lx - 1, cliffTop - 17, rim);
  put(img, lx + 1, cliffTop - 17, rim);
  for (let x = -2; x <= 2; x++) put(img, lx + x, cliffTop - 16, body);
  return img;
}

/** 前景剪影（花丛、栅栏 / 海草、礁石），贴着画面底边，比主角滚动得快 */
export function foreground(
  w: number,
  h: number,
  seed: number,
  kind: 'village' | 'beach',
): RGBAImage {
  const img = newImage(w, h);
  const rand = rng(seed);
  const body: ColorName = kind === 'village' ? 'leaf1' : 'ochre';
  const dark: ColorName = kind === 'village' ? 'pine' : 'bark';
  let x = Math.floor(rand() * 40);
  while (x < w) {
    const r = 6 + Math.floor(rand() * 9);
    if (kind === 'village' && rand() < 0.35) {
      // 一段栅栏
      const len = 18 + Math.floor(rand() * 20);
      for (let i = 0; i < len; i++) {
        const xx = (x + i) % w;
        put(img, xx, h - 9, dark);
        put(img, xx, h - 5, dark);
        if (i % 6 === 0) for (let y = h - 13; y < h; y++) put(img, xx, y, dark);
      }
      x += len + 30 + Math.floor(rand() * 60);
      continue;
    }
    // 一丛灌木 / 海草：几个半圆叠起来，边缘带草叶
    for (let k = 0; k < 3; k++) {
      const cx = x + k * Math.round(r * 0.8);
      const rr = r - k * 2 + Math.floor(rand() * 3);
      for (let yy = -rr; yy <= 0; yy++) {
        for (let xx = -rr; xx <= rr; xx++) {
          if (xx * xx + yy * yy <= rr * rr)
            put(img, (((cx + xx) % w) + w) % w, h - 1 + yy, k === 1 ? dark : body);
        }
      }
      if (kind === 'beach') {
        for (let b = 0; b < 3; b++) {
          const bx = cx - rr + Math.floor(rand() * rr * 2);
          const len = 4 + Math.floor(rand() * 6);
          for (let i = 0; i < len; i++)
            put(img, (((bx + Math.round(i * 0.3)) % w) + w) % w, h - rr - i, body);
        }
      }
    }
    x += r * 3 + 40 + Math.floor(rand() * 90);
  }
  return img;
}

/** 夜空：深蓝渐变 + 星星（第 frame 帧，星星闪烁） */
export function nightSky(w: number, h: number, frame: number): RGBAImage {
  const img = skyGradient(w, h, [
    ['ink', 0],
    ['night', 0.45],
    ['deep', 0.75],
    ['violet', 1],
  ]);
  const rand = rng(91);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h * 0.7);
    const tw = rand() * 4;
    if ((Math.floor(tw) + frame) % 4 === 0) continue;
    put(img, x, y, rand() < 0.3 ? 'white' : 'mist');
    if (rand() < 0.12 && (Math.floor(tw) + frame) % 4 === 1) {
      put(img, x - 1, y, 'mist');
      put(img, x + 1, y, 'mist');
      put(img, x, y - 1, 'mist');
      put(img, x, y + 1, 'mist');
    }
  }
  return img;
}

/** 月亮：浅色圆盘、几个淡淡的环形山，外面一圈稀疏的光晕 */
export function moonDisc(r: number): RGBAImage {
  const size = Math.ceil(r * 4);
  const img = newImage(size, size);
  const c = size / 2;
  const craters: Array<[number, number, number]> = [
    [-0.35, -0.2, 0.28],
    [0.3, 0.25, 0.22],
    [0.1, -0.45, 0.15],
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const d = Math.hypot(dx, dy);
      const th = (BAYER4[(y % 4) * 4 + (x % 4)]! + 0.5) / 16;
      if (d <= r) {
        let col: ColorName = dx + dy < -r * 0.5 ? 'white' : 'cloud';
        for (const [cx, cy, cr] of craters)
          if (Math.hypot(dx / r - cx, dy / r - cy) < cr) col = 'mist';
        put(img, x, y, col);
      } else if (d <= r * 1.9 && (1 - (d - r) / (r * 0.9)) * 0.45 > th) put(img, x, y, 'slate');
    }
  }
  return img;
}

/** 按调色板颜色替换（例如把白天的远景换成夜里的颜色） */
export function recolor(img: RGBAImage, map: Partial<Record<ColorName, ColorName>>): RGBAImage {
  const out: RGBAImage = { w: img.w, h: img.h, data: new Uint8ClampedArray(img.data) };
  const lut = new Map<number, [number, number, number]>();
  for (const [from, to] of Object.entries(map) as Array<[ColorName, ColorName]>) {
    const [r, g, b] = hexToRgb(PALETTE[from]);
    lut.set((r << 16) | (g << 8) | b, hexToRgb(PALETTE[to]));
  }
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const c = lut.get((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
    if (c) {
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
    }
  }
  return out;
}
