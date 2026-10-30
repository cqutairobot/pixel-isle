import { Paint, type ImageSheet } from './paint';
import type { ColorName } from './palette';
import type { RGBAImage } from './sprite';

/**
 * 第 1 关新增的粒子贴图：铃声光环、闪光、冰晶碎片、水滴、爱心、落叶彩带、炊烟、花瓣。
 * 都是小图，按帧播放（像素风的"缩放"用换帧代替）。
 */

/** 铃声光环：一圈逐渐扩大、变细的圆环 */
function ring(r: number, thick: number, c: ColorName): RGBAImage {
  const size = 34;
  const p = new Paint(size, size);
  const cx = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cx);
      if (d <= r && d > r - thick) p.set(x, y, c);
    }
  }
  return p.toImage();
}

/** 四角星闪光 */
function sparkle(size: number): RGBAImage {
  const p = new Paint(9, 9);
  p.set(4, 4, 'white');
  for (let i = 1; i <= size; i++) {
    const c: ColorName = i === size ? 'gold' : 'cream';
    p.set(4 - i, 4, c)
      .set(4 + i, 4, c)
      .set(4, 4 - i, c)
      .set(4, 4 + i, c);
  }
  if (size >= 3) p.set(3, 3, 'cream').set(5, 5, 'cream').set(3, 5, 'cream').set(5, 3, 'cream');
  return p.toImage();
}

function shard(kind: number): RGBAImage {
  const p = new Paint(6, 6);
  if (kind === 0)
    p.set(2, 0, 'white')
      .rect(1, 1, 3, 2, 'frost')
      .set(1, 1, 'white')
      .set(3, 3, 'violet')
      .set(2, 3, 'frost');
  else if (kind === 1) p.rect(1, 1, 2, 4, 'frost').set(1, 1, 'white').set(2, 4, 'violet');
  else p.set(1, 2, 'white').set(2, 2, 'frost').set(3, 2, 'frost').set(2, 3, 'violet');
  return p.toImage();
}

function drop(big: boolean): RGBAImage {
  const p = new Paint(4, 5);
  if (big) p.set(1, 0, 'cloud').rect(0, 1, 3, 2, 'sky').set(0, 1, 'white').set(1, 3, 'teal');
  else p.set(1, 1, 'white').set(1, 2, 'sky');
  return p.toImage();
}

function heart(): RGBAImage {
  const p = new Paint(7, 6);
  p.rect(1, 0, 2, 1, 'red2')
    .rect(4, 0, 2, 1, 'red2')
    .rect(0, 1, 7, 2, 'red2')
    .rect(1, 3, 5, 1, 'red2')
    .rect(2, 4, 3, 1, 'red2');
  p.set(3, 5, 'red2').set(1, 1, 'white').set(2, 1, 'blush');
  return p.toImage();
}

function leaf(c: ColorName, d: ColorName, frame: number): RGBAImage {
  const p = new Paint(5, 5);
  if (frame === 0) p.rect(1, 1, 3, 2, c).set(2, 3, d).set(1, 1, d);
  else if (frame === 1) p.rect(2, 0, 1, 4, c).set(2, 4, d);
  else p.rect(1, 2, 3, 1, d);
  return p.toImage();
}

function smoke(r: number): RGBAImage {
  const p = new Paint(9, 9);
  p.disc(4.5, 4.5, r, 'cloud');
  if (r > 2) p.disc(5, 5, r - 1.5, 'mist');
  return p.toImage();
}

function petal(frame: number): RGBAImage {
  const p = new Paint(4, 4);
  if (frame === 0) p.rect(1, 1, 2, 2, 'blush').set(1, 1, 'white');
  else p.rect(1, 1, 2, 1, 'blush');
  return p.toImage();
}

/** 被打倒时的一团白烟 */
function puff(r: number): RGBAImage {
  const p = new Paint(14, 14);
  for (const [dx, dy, rr] of [
    [0, 0, r],
    [-r * 0.6, r * 0.3, r * 0.7],
    [r * 0.6, r * 0.3, r * 0.7],
  ] as const)
    p.disc(7 + dx, 7 + dy, rr, 'white');
  if (r > 3) p.disc(7, 8, r - 2, 'cloud');
  p.outline('mist');
  return p.toImage();
}

const frames: Record<string, RGBAImage> = {};
[4, 8, 12, 16].forEach(
  (r, i) => (frames[`ring_${i}`] = ring(r, i < 2 ? 2 : 1, i < 2 ? 'cream' : 'gold')),
);
[1, 2, 3].forEach((s, i) => (frames[`sparkle_${i}`] = sparkle(s)));
for (let i = 0; i < 3; i++) frames[`shard_${i}`] = shard(i);
frames.drop_big = drop(true);
frames.drop = drop(false);
frames.heart = heart();
const leaves: Array<[string, ColorName, ColorName]> = [
  ['g', 'leaf3', 'leaf2'],
  ['y', 'gold', 'straw'],
  ['r', 'blush', 'red2'],
];
for (const [k, c, d] of leaves) for (let f = 0; f < 3; f++) frames[`leaf${k}_${f}`] = leaf(c, d, f);
[2, 3, 4].forEach((r, i) => (frames[`smoke_${i}`] = smoke(r)));
frames.petal_0 = petal(0);
frames.petal_1 = petal(1);
[2, 4, 5.5].forEach((r, i) => (frames[`puff_${i}`] = puff(r)));

export const fx2Sheet: ImageSheet = { key: 'fx2', frames };
