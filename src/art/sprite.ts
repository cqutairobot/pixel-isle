import { hexToRgb, PALETTE, type ColorName } from './palette';

/** 字符网格：每个字符是一个像素，'.' 表示透明 */
export type PixelGrid = string[];

/** 字符到调色板颜色的映射 */
export type ColorKeys = Record<string, ColorName>;

/** 去掉模板字符串里的缩进与空行，得到网格 */
export function grid(text: string): PixelGrid {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function blank(w: number, h: number): PixelGrid {
  return Array.from({ length: h }, () => '.'.repeat(w));
}

/** 把多个部件按偏移叠到 w×h 的画布上，后面的盖住前面的（'.' 不覆盖） */
export function compose(
  w: number,
  h: number,
  layers: Array<[PixelGrid, number, number]>,
): PixelGrid {
  const out = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  for (const [part, ox, oy] of layers) {
    part.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x]!;
        const tx = ox + x;
        const ty = oy + y;
        if (ch !== '.' && tx >= 0 && tx < w && ty >= 0 && ty < h) out[ty]![tx] = ch;
      }
    });
  }
  return out.map((r) => r.join(''));
}

export function flipH(g: PixelGrid): PixelGrid {
  return g.map((r) => [...r].reverse().join(''));
}

/** 把字符替换成别的字符（例如眨眼时把眼睛换成皮肤色） */
export function recolor(g: PixelGrid, map: Record<string, string>): PixelGrid {
  return g.map((r) => [...r].map((c) => map[c] ?? c).join(''));
}

export interface RGBAImage {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** 网格 → RGBA 像素。未知字符会抛错，防止画错颜色。 */
export function rasterize(g: PixelGrid, keys: ColorKeys, name = '?'): RGBAImage {
  const h = g.length;
  const w = Math.max(...g.map((r) => r.length));
  const data = new Uint8ClampedArray(w * h * 4);
  const cache: Record<string, [number, number, number]> = {};
  g.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      const cname = keys[ch];
      if (!cname)
        throw new Error(`精灵 ${name}：第 ${y + 1} 行第 ${x + 1} 列的字符 "${ch}" 没有对应颜色`);
      const rgb = (cache[ch] ??= hexToRgb(PALETTE[cname]));
      const i = (y * w + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  });
  return { w, h, data };
}

/** 一组同尺寸的帧 */
export interface Sheet {
  /** 贴图键名前缀，例如 hero → hero/run_3 */
  key: string;
  w: number;
  h: number;
  keys: ColorKeys;
  frames: Record<string, PixelGrid>;
}
