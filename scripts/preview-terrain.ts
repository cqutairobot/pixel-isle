/**
 * 把一小段手写的地形（任意图例字符）拼成图，检查新地形瓦片的拼接效果。
 * 用法：npx tsx scripts/preview-terrain.ts <输出.png> [放大倍数] [背景色]
 */
import type { ColorName } from '../src/art/palette';
import { buildLevelTileset } from '../src/art/terrain';
import { MAT_VINE, parseLevel } from '../src/sim/level';
import { T_ONEWAY } from '../src/sim/grid';
import { Raster } from './lib/raster';

const out = process.argv[2] ?? 'terrain.png';
const scale = Number(process.argv[3] ?? 4);
const bg = (process.argv[4] ?? 'pine') as ColorName;
const rows = `
........................
..TTTT.........-------..
P.TTTT..................
..TTTT....===......TTTT.
............----...TTTT.
..TTT..............&&&..
..TTT..&&&...======&&&..
&&TTT&&&&&&&.......&&&&&
&&&&&&&&&&&&&&&&&&&&&&&&
&&&&&&&&&&&&&&&&&&&&&&&&
`;
const level = parseLevel({
  id: 'preview',
  name: 'preview',
  chunks: [rows],
  legend: { '=': { tile: T_ONEWAY, material: MAT_VINE } },
});
const g = level.grid;
const r = new Raster(g.widthPx, g.heightPx);
r.fill(bg);
const ts = buildLevelTileset(g, level.material, 'island');
for (let y = 0; y < g.rows; y++)
  for (let x = 0; x < g.cols; x++) {
    const t = ts.data[y]![x]!;
    if (t >= 0) r.blit(ts.tiles[t]!, x * 16, y * 16);
  }
r.save(out, scale);
console.log(out, `${ts.tiles.length} 种瓦片`);
