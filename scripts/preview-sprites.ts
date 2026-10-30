/**
 * 把精灵帧按名字前缀渲染成放大的 PNG（帧尺寸可以不同），供自检与审阅。
 * 用法：npx tsx scripts/preview-sprites.ts <输出.png> <前缀，如 enemy/ 或 item/> [放大倍数]
 */
import { allFrames } from '../src/art/sheets';
import { Raster } from './lib/raster';

const out = process.argv[2] ?? 'sprites.png';
const prefixes = (process.argv[3] ?? '').split(',');
const scale = Number(process.argv[4] ?? 6);
const frames = allFrames().filter((f) => prefixes.some((p) => f.name.startsWith(p)));
const gap = 3;
const perRow = Math.max(1, Math.min(frames.length, 12));
const cellW = Math.max(...frames.map((f) => f.img.w)) + gap;
const cellH = Math.max(...frames.map((f) => f.img.h)) + gap;
const rows = Math.ceil(frames.length / perRow);
const W = perRow * cellW + gap;
const H = rows * cellH * 2 + gap;
const r = new Raster(W, H);
r.fill('sky', 0, 0, W, rows * cellH + gap);
r.fill('night', 0, rows * cellH + gap, W, rows * cellH);
frames.forEach((f, i) => {
  const cx = gap + (i % perRow) * cellW;
  const cy = gap + Math.floor(i / perRow) * cellH;
  r.blit(f.img, cx, cy);
  r.blit(f.img, cx, cy + rows * cellH);
});
r.save(out, scale);
console.log(out, frames.map((f) => `${f.name} ${f.img.w}×${f.img.h}`).join(', '));
