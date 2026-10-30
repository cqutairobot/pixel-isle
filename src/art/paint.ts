import { hexToRgb, PALETTE, type ColorName } from './palette';
import type { ColorKeys, PixelGrid, RGBAImage } from './sprite';

/** 4×4 有序抖动阈值（0–15） */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** 在 (x, y) 处按比例 t（0–1）在两色之间抖动取色 */
export function ditherPick(x: number, y: number, t: number, a: ColorName, b: ColorName): ColorName {
  const th = (BAYER4[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
  return t > th ? b : a;
}

/**
 * 调色板画布：每个像素存调色板颜色名（null 为透明）。
 * 用来画房子、钟楼、树这类大一些、不方便手写字符网格的东西。
 */
export class Paint {
  readonly px: Array<ColorName | null>;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Array(w * h).fill(null);
  }

  get(x: number, y: number): ColorName | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x]!;
  }

  set(x: number, y: number, c: ColorName | null): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.px[y * this.w + x] = c;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: ColorName | null): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  hline(x0: number, x1: number, y: number, c: ColorName): this {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c);
    return this;
  }

  vline(x: number, y0: number, y1: number, c: ColorName): this {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c);
    return this;
  }

  /** 两点之间的像素直线（Bresenham） */
  line(x0: number, y0: number, x1: number, y1: number, c: ColorName): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** 实心椭圆（像素中心判定） */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: ColorName | null): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
    return this;
  }

  disc(cx: number, cy: number, r: number, c: ColorName | null): this {
    return this.ellipse(cx, cy, r, r, c);
  }

  /** 在区域内按比例抖动两色（t 可以是随位置变化的函数） */
  dither(
    x: number,
    y: number,
    w: number,
    h: number,
    a: ColorName,
    b: ColorName,
    t: number | ((i: number, j: number) => number),
  ): this {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const tt = typeof t === 'number' ? t : t(i, j);
        this.set(x + i, y + j, ditherPick(x + i, y + j, tt, a, b));
      }
    }
    return this;
  }

  /** 只在已有颜色的像素上重新上色（例如给一块区域加阴影） */
  recolorWhere(pred: (x: number, y: number, c: ColorName) => boolean, c: ColorName): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const cur = this.get(x, y);
        if (cur && pred(x, y, cur)) this.set(x, y, c);
      }
    }
    return this;
  }

  /** 贴一张字符网格 */
  grid(g: PixelGrid, keys: ColorKeys, x: number, y: number): this {
    g.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]!;
        if (ch === '.') continue;
        const c = keys[ch];
        if (!c) throw new Error(`Paint.grid：字符 "${ch}" 没有对应颜色`);
        this.set(x + i, y + j, c);
      }
    });
    return this;
  }

  /** 贴另一张画布 */
  paste(p: Paint, x: number, y: number, flip = false): this {
    for (let j = 0; j < p.h; j++) {
      for (let i = 0; i < p.w; i++) {
        const c = p.get(flip ? p.w - 1 - i : i, j);
        if (c) this.set(x + i, y + j, c);
      }
    }
    return this;
  }

  /** 给所有不透明区域描一圈 1px 外边（只看上下左右四邻） */
  outline(c: ColorName): this {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1))
          add.push(y * this.w + x);
      }
    }
    for (const i of add) this.px[i] = c;
    return this;
  }

  flipped(): Paint {
    const p = new Paint(this.w, this.h);
    return p.paste(this, 0, 0, true);
  }

  toImage(): RGBAImage {
    const data = new Uint8ClampedArray(this.w * this.h * 4);
    const cache = new Map<ColorName, [number, number, number]>();
    this.px.forEach((c, i) => {
      if (!c) return;
      let rgb = cache.get(c);
      if (!rgb) {
        rgb = hexToRgb(PALETTE[c]);
        cache.set(c, rgb);
      }
      data[i * 4] = rgb[0];
      data[i * 4 + 1] = rgb[1];
      data[i * 4 + 2] = rgb[2];
      data[i * 4 + 3] = 255;
    });
    return { w: this.w, h: this.h, data };
  }
}

/** 一组同名前缀、用 Paint 或 RGBAImage 画出来的帧（不一定同尺寸） */
export interface ImageSheet {
  key: string;
  frames: Record<string, RGBAImage>;
}
