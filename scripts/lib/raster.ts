import { writeFileSync } from 'node:fs';
import { hexToRgb, PALETTE, type ColorName } from '../../src/art/palette';
import type { RGBAImage } from '../../src/art/sprite';
import { encodePNG } from '../png';

/** 给 Node 预览脚本用的 RGBA 画布：贴图、填色、整数倍放大、存 PNG */
export class Raster {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  fill(c: ColorName, x = 0, y = 0, w = this.w, h = this.h, alpha = 1): void {
    const [r, g, b] = hexToRgb(PALETTE[c]);
    for (let j = Math.max(0, y); j < Math.min(this.h, y + h); j++) {
      for (let i = Math.max(0, x); i < Math.min(this.w, x + w); i++) {
        const k = (j * this.w + i) * 4;
        this.data[k] = this.data[k]! * (1 - alpha) + r * alpha;
        this.data[k + 1] = this.data[k + 1]! * (1 - alpha) + g * alpha;
        this.data[k + 2] = this.data[k + 2]! * (1 - alpha) + b * alpha;
        this.data[k + 3] = 255;
      }
    }
  }

  /** 贴图（透明像素跳过）；wrap 为 true 时横向平铺 */
  blit(
    src: RGBAImage,
    dx: number,
    dy: number,
    opts: { wrap?: boolean; flip?: boolean; alpha?: number } = {},
  ): void {
    dx = Math.round(dx);
    dy = Math.round(dy);
    const a = opts.alpha ?? 1;
    for (let y = 0; y < src.h; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < src.w; x++) {
        const sx = opts.flip ? src.w - 1 - x : x;
        const si = (y * src.w + sx) * 4;
        if (src.data[si + 3] === 0) continue;
        let tx = dx + x;
        if (opts.wrap) tx = ((tx % this.w) + this.w) % this.w;
        if (tx < 0 || tx >= this.w) continue;
        const di = (ty * this.w + tx) * 4;
        for (let k = 0; k < 3; k++)
          this.data[di + k] = this.data[di + k]! * (1 - a) + src.data[si + k]! * a;
        this.data[di + 3] = 255;
      }
    }
  }

  /** 横向平铺一张图（tile 宽度小于画布时重复） */
  tileX(src: RGBAImage, offsetX: number, y: number): void {
    const start = -(((Math.round(offsetX) % src.w) + src.w) % src.w);
    for (let x = start; x < this.w; x += src.w) this.blit(src, x, y);
  }

  save(path: string, scale = 1): void {
    const W = this.w * scale;
    const H = this.h * scale;
    const big = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const si = (Math.floor(y / scale) * this.w + Math.floor(x / scale)) * 4;
        big.set(this.data.subarray(si, si + 4), (y * W + x) * 4);
      }
    }
    writeFileSync(path, encodePNG(W, H, big));
  }
}
