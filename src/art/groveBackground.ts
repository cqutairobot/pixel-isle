import { Paint, ditherPick } from './paint';
import type { ColorName } from './palette';
import { rng } from './rng';
import type { RGBAImage } from './sprite';

/**
 * 椰林的视差背景素材（都能横向无缝平铺）：一排排椰树剪影、林下的灌木、从画面上边垂下来的树冠、
 * 穿过树缝的斜光柱。颜色由远到近越来越深，背景不用深色描边。
 */

/** 在横向循环的画布上画：x 超出两边时绕回来 */
function wrapSet(p: Paint, x: number, y: number, c: ColorName): void {
  const xx = ((Math.round(x) % p.w) + p.w) % p.w;
  p.set(xx, y, c);
}

/**
 * 一排椰树剪影：弯弯的树干，顶上几片下垂的叶子；底部是一条起伏的灌木带，把树根盖住。
 * body 是主体色，rim 是迎光的一侧（左上）的亮边。
 */
export function palmRow(
  w: number,
  h: number,
  seed: number,
  body: ColorName,
  rim: ColorName,
  opts: { count: number; minH: number; maxH: number; bush: number },
): RGBAImage {
  const p = new Paint(w, h);
  const r = rng(seed);
  for (let i = 0; i < opts.count; i++) {
    const baseX = (i + 0.15 + r() * 0.7) * (w / opts.count);
    const th = opts.minH + r() * (opts.maxH - opts.minH);
    const lean = (r() - 0.5) * th * 0.35;
    const topX = baseX + lean;
    const topY = h - th;
    const thick = 1.4 + th / 70;
    // 树干
    for (let y = h - 1; y >= topY; y--) {
      const t = (h - 1 - y) / (h - 1 - topY);
      const cx = baseX + lean * Math.sin(t * Math.PI * 0.5);
      const half = thick * (1 - t * 0.35);
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++)
        wrapSet(p, x, y, x <= cx - half + 0.5 ? rim : body);
    }
    // 叶子：6 片，往两边垂
    const fl = 14 + th * 0.22;
    for (const a of [-2.9, -2.4, -1.95, -1.2, -0.7, -0.25]) {
      const len = fl * (0.8 + r() * 0.35);
      for (let k = 0; k < len; k++) {
        const t = k / len;
        const x = topX + Math.cos(a) * k;
        const y = topY + Math.sin(a) * k * 0.5 + t * t * len * 0.55;
        const th2 = Math.max(1, Math.round((1 - t) * 3));
        for (let j = 0; j < th2; j++) wrapSet(p, x, y + j, j === 0 && a < -1.57 ? rim : body);
        if (k % 2 === 0 && t > 0.2) wrapSet(p, x, y + th2 + 1, body);
      }
    }
    for (let j = -2; j <= 2; j++) wrapSet(p, topX + j, topY, body);
  }
  // 底部的灌木带
  if (opts.bush > 0) {
    const phase = r() * 10;
    for (let x = 0; x < w; x++) {
      const u = (x / w) * Math.PI * 2;
      const top =
        h -
        opts.bush +
        Math.round(
          Math.sin(u * 5 + phase) * 3 + Math.sin(u * 13 + phase * 2) * 2 + Math.sin(u * 29) * 1,
        );
      for (let y = Math.max(0, top); y < h; y++) p.set(x, y, y === top ? rim : body);
    }
  }
  return p.toImage();
}

/** 从画面上边垂下来的树冠：一团团深色的叶子，下缘是一排尖尖的叶尖（可横向平铺） */
export function canopy(w: number, h: number, seed: number): RGBAImage {
  const p = new Paint(w, h);
  const r = rng(seed);
  // 上半部分：起伏的叶团
  for (let x = 0; x < w; x++) {
    const u = (x / w) * Math.PI * 2;
    const bottom = Math.round(h * 0.45 + Math.sin(u * 3 + 1) * 6 + Math.sin(u * 7) * 4);
    for (let y = 0; y < bottom; y++) p.set(x, y, y > bottom - 3 ? 'leaf1' : 'pine');
  }
  // 垂下来的叶尖
  const tips = Math.round(w / 6);
  for (let i = 0; i < tips; i++) {
    const x0 = (i + r() * 0.8) * (w / tips);
    const u = (x0 / w) * Math.PI * 2;
    const y0 = h * 0.45 + Math.sin(u * 3 + 1) * 6 + Math.sin(u * 7) * 4 - 2;
    const len = 6 + r() * (h * 0.5 - 6);
    const slant = (r() - 0.5) * 0.6;
    for (let k = 0; k < len; k++) {
      const half = Math.max(0, (1 - k / len) * 2.2);
      for (let j = -Math.round(half); j <= Math.round(half); j++)
        wrapSet(
          p,
          x0 + slant * k + j,
          Math.round(y0 + k),
          j === -Math.round(half) ? 'leaf1' : 'pine',
        );
    }
  }
  return p.toImage();
}

/**
 * 斜光柱：几道从左上斜射下来的光，边缘抖动淡出。游戏里用叠加混合、低透明度画在中景前面。
 * 只有一种颜色（奶油色），亮度靠透明度控制。
 */
export function lightShafts(w: number, h: number, seed: number): RGBAImage {
  const p = new Paint(w, h);
  const r = rng(seed);
  const beams = 4;
  const slope = 0.55;
  for (let i = 0; i < beams; i++) {
    const x0 = (i + r() * 0.6) * (w / beams);
    const bw = 8 + r() * 22;
    for (let y = 0; y < h; y++) {
      // 越往下越淡
      const fade = 1 - (y / h) * 0.85;
      const cx = x0 + y * slope;
      for (let x = Math.floor(cx - bw); x <= Math.ceil(cx + bw); x++) {
        const d = Math.abs(x - cx) / bw;
        const t = (1 - d) * fade * 1.6;
        if (t <= 0) continue;
        if (ditherPick(x, y, Math.min(1, t), 'ink', 'cream') === 'cream') wrapSet(p, x, y, 'cream');
      }
    }
  }
  return p.toImage();
}
