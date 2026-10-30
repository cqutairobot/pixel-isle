/**
 * 不开浏览器，直接把练习场的一段（地形 + 背景 + 牌子 + 主角）拼成一张图，检查配色与可读性。
 * 用法：npx tsx scripts/preview-scene.ts <输出.png> [起始列] [放大倍数]
 */
import { writeFileSync } from 'node:fs';
import { clouds, hills, skyGradient } from '../src/art/background';
import { heroSheet } from '../src/art/hero';
import { propSheet } from '../src/art/props';
import { rasterize, type RGBAImage } from '../src/art/sprite';
import { buildTileset, GYM_THEME } from '../src/art/terrain';
import { gym } from '../src/content/levels/gym';
import { parseLevel } from '../src/sim/level';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'scene.png';
const startCol = Number(process.argv[3] ?? 128);
const scale = Number(process.argv[4] ?? 3);
const VW = 384;
const VH = 216;
const level = parseLevel(gym);
const ts = buildTileset(level.grid, GYM_THEME);
const camX = startCol * 16;
const camY = level.grid.heightPx - VH;

const img = new Uint8ClampedArray(VW * VH * 4);
function blit(src: RGBAImage, dx: number, dy: number, wrapX = false) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      if (src.data[si + 3] === 0) continue;
      let tx = dx + x;
      const ty = dy + y;
      if (wrapX) tx = ((tx % VW) + VW) % VW;
      if (tx < 0 || ty < 0 || tx >= VW || ty >= VH) continue;
      const di = (ty * VW + tx) * 4;
      img.set(src.data.subarray(si, si + 4), di);
    }
  }
}
blit(
  skyGradient(VW, VH, [
    ['sky', 0],
    ['sky', 0.42],
    ['cloud', 0.62],
    ['cloud', 1],
  ]),
  0,
  0,
);
const cl = clouds(640, 64, 3, 'white', 'cloud');
for (let k = -1; k <= 1; k++) blit(cl, k * 640 - (Math.round(camX * 0.05) % 640), 18);
const far = hills(512, 90, 11, 'frost', 'cloud', 40, 18);
for (let k = -1; k <= 2; k++) blit(far, k * 512 - (Math.round(camX * 0.1) % 512), 92);
const near = hills(512, 80, 29, 'mist', 'cloud', 44, 14);
for (let k = -1; k <= 2; k++) blit(near, k * 512 - (Math.round(camX * 0.25) % 512), 128);
for (let r = 0; r < level.grid.rows; r++) {
  for (let c = 0; c < level.grid.cols; c++) {
    const t = ts.data[r]![c]!;
    if (t < 0) continue;
    const x = c * 16 - camX;
    const y = r * 16 - camY;
    if (x < -16 || x > VW || y < -16 || y > VH) continue;
    blit(ts.tiles[t]!, x, y);
  }
}
for (const m of level.markers) {
  const key = m.kind === 'sign' ? `sign_${m.data?.value}` : 'arrow_left';
  const g = propSheet.frames[key];
  if (!g) continue;
  blit(rasterize(g, propSheet.keys), m.col * 16 - camX, m.row * 16 - camY);
}
const hero = rasterize(heroSheet.frames.idle_0!, heroSheet.keys);
blit(hero, startCol * 16 + 40 - camX, 26 * 16 - 18 - camY);
const run = rasterize(heroSheet.frames.run_0!, heroSheet.keys);
blit(run, startCol * 16 + 120 - camX, 26 * 16 - 18 - camY);
const jump = rasterize(heroSheet.frames.apex!, heroSheet.keys);
blit(jump, startCol * 16 + 200 - camX, 26 * 16 - 18 - 60 - camY);

// 放大
const W = VW * scale;
const H = VH * scale;
const big = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const si = (Math.floor(y / scale) * VW + Math.floor(x / scale)) * 4;
    big.set(img.subarray(si, si + 4), (y * W + x) * 4);
  }
}
writeFileSync(out, encodePNG(W, H, big));
console.log(out, `瓦片种类 ${ts.tiles.length}`);
