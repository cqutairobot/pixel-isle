/**
 * 把精灵表渲染成放大的 PNG，供自检与审阅。
 * 用法：npx tsx scripts/preview-art.ts [输出目录] [放大倍数]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hexToRgb, PALETTE, type ColorName } from '../src/art/palette';
import { rasterize, type Sheet } from '../src/art/sprite';
import { allSheets } from '../src/art/sheets';
import { encodePNG } from './png';

const outDir = process.argv[2] ?? 'docs/art';
const scale = Number(process.argv[3] ?? 8);
mkdirSync(outDir, { recursive: true });

function validate(sheet: Sheet): string[] {
  const errs: string[] = [];
  for (const [name, g] of Object.entries(sheet.frames)) {
    if (g.length !== sheet.h) errs.push(`${sheet.key}/${name}: 行数 ${g.length} ≠ ${sheet.h}`);
    g.forEach((row, i) => {
      if (row.length !== sheet.w)
        errs.push(`${sheet.key}/${name}: 第 ${i + 1} 行宽 ${row.length} ≠ ${sheet.w}`);
    });
  }
  return errs;
}

function renderSheet(sheet: Sheet, bgs: ColorName[]): Buffer {
  const names = Object.keys(sheet.frames);
  const gap = 2;
  const cellW = sheet.w + gap;
  const cellH = sheet.h + gap;
  const W = (names.length * cellW + gap) * scale;
  const H = (bgs.length * cellH + gap) * scale;
  const img = new Uint8ClampedArray(W * H * 4);
  bgs.forEach((bg, row) => {
    const [r, g, b] = hexToRgb(PALETTE[bg]);
    for (let y = row * cellH * scale; y < (row + 1) * cellH * scale + gap * scale && y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        img[i] = r;
        img[i + 1] = g;
        img[i + 2] = b;
        img[i + 3] = 255;
      }
    }
  });
  names.forEach((name, n) => {
    const im = rasterize(sheet.frames[name]!, sheet.keys, `${sheet.key}/${name}`);
    bgs.forEach((_, row) => {
      const ox = (gap + n * cellW) * scale;
      const oy = (gap + row * cellH) * scale;
      for (let y = 0; y < im.h; y++) {
        for (let x = 0; x < im.w; x++) {
          const si = (y * im.w + x) * 4;
          if (im.data[si + 3] === 0) continue;
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const di = ((oy + y * scale + dy) * W + ox + x * scale + dx) * 4;
              img[di] = im.data[si]!;
              img[di + 1] = im.data[si + 1]!;
              img[di + 2] = im.data[si + 2]!;
              img[di + 3] = 255;
            }
          }
        }
      }
    });
  });
  return encodePNG(W, H, img);
}

let failed = false;
for (const sheet of allSheets) {
  const errs = validate(sheet);
  if (errs.length) {
    failed = true;
    console.error(errs.join('\n'));
    continue;
  }
  const file = join(outDir, `${sheet.key}.png`);
  writeFileSync(file, renderSheet(sheet, ['sky', 'sand3', 'slate']));
  console.log(`${file}  帧：${Object.keys(sheet.frames).join(' ')}`);
}
if (failed) process.exit(1);
