import { Paint, ditherPick } from './paint';
import type { ColorName } from './palette';
import { rng } from './rng';
import type { RGBAImage } from './sprite';

/**
 * 回声崖的视差背景素材（都能横向无缝平铺）：从云海里冒出来的一根根海蚀柱和远崖、
 * 一层层蓬松的云海、风吹过的细线。颜色由远到近越来越深，背景不用深色描边。
 */

function wrapSet(p: Paint, x: number, y: number, c: ColorName): void {
  const xx = ((Math.round(x) % p.w) + p.w) % p.w;
  p.set(xx, y, c);
}

/**
 * 一排海蚀柱和远崖的剪影：竖直的石柱，顶上参差不齐，有几级小平台；
 * body 是主体色，rim 是迎光的一侧（左边）的亮边，top 是柱顶的草色。
 */
export function stacks(
  w: number,
  h: number,
  seed: number,
  body: ColorName,
  rim: ColorName,
  top: ColorName,
  opts: { count: number; minH: number; maxH: number; minW: number; maxW: number },
): RGBAImage {
  const p = new Paint(w, h);
  const r = rng(seed);
  for (let i = 0; i < opts.count; i++) {
    const cx = (i + 0.2 + r() * 0.6) * (w / opts.count);
    const sw = opts.minW + r() * (opts.maxW - opts.minW);
    const sh = opts.minH + r() * (opts.maxH - opts.minH);
    const y0 = h - sh;
    // 柱身：往上略收窄，边上有几处凹进去的层
    for (let y = Math.floor(y0); y < h; y++) {
      const t = (y - y0) / sh;
      const half = sw / 2 - (1 - t) * sw * 0.12 + (Math.floor(y / 7 + i) % 3 === 0 ? -1 : 0);
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++)
        wrapSet(p, x, y, x <= cx - half + 1.5 ? rim : body);
    }
    // 参差的顶
    for (let x = Math.round(cx - sw / 2); x <= Math.round(cx + sw / 2); x++) {
      const bump = Math.round(Math.abs(Math.sin(x * 0.9 + i)) * 3);
      for (let y = Math.floor(y0) - bump; y < y0 + 2; y++) wrapSet(p, x, y, top);
    }
  }
  return p.toImage();
}

/**
 * 一层云海：上沿是一个个鼓起来的云团（几段正弦叠加），下面是填满的云；
 * fill 主体色、light 顶上的亮边、shade 下半部分的阴影。
 */
export function cloudBank(
  w: number,
  h: number,
  seed: number,
  fill: ColorName,
  light: ColorName,
  shade: ColorName,
): RGBAImage {
  const p = new Paint(w, h);
  const r = rng(seed);
  const k1 = (Math.PI * 2 * (2 + Math.floor(r() * 3))) / w;
  const k2 = (Math.PI * 2 * (5 + Math.floor(r() * 4))) / w;
  const k3 = (Math.PI * 2 * (11 + Math.floor(r() * 5))) / w;
  const ph = r() * 6;
  for (let x = 0; x < w; x++) {
    const top =
      h * 0.35 +
      Math.sin(x * k1 + ph) * h * 0.12 +
      Math.abs(Math.sin(x * k2 + ph * 2)) * -h * 0.12 +
      Math.abs(Math.sin(x * k3)) * -h * 0.06;
    const t0 = Math.max(0, Math.round(top));
    for (let y = t0; y < h; y++) {
      const t = (y - t0) / Math.max(1, h - t0);
      p.set(
        x,
        y,
        y - t0 < 2 ? light : t < 0.55 ? fill : ditherPick(x, y, (t - 0.55) * 2.2, fill, shade),
      );
    }
  }
  return p.toImage();
}

/** 风线：一根横着的细白线（两头淡） */
export function windStreak(len: number): RGBAImage {
  const p = new Paint(len, 1);
  for (let x = 0; x < len; x++) p.set(x, 0, x < 2 || x > len - 3 ? 'cloud' : 'white');
  return p.toImage();
}
