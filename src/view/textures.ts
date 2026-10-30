import type Phaser from 'phaser';
import { allSheets } from '../art/sheets';
import { rasterize, type RGBAImage } from '../art/sprite';
import type { Tileset } from '../art/terrain';

/** 所有字符网格精灵打包进同一张图集，帧名形如 hero/run_3 */
export const ATLAS = 'atlas';

function canvasFrom(
  w: number,
  h: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d')! };
}

function putImage(ctx: CanvasRenderingContext2D, img: RGBAImage, x: number, y: number): void {
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.w, img.h), x, y);
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** 生成精灵图集。帧之间留 2px 透明间隔，避免平滑像素模式下相邻帧串色。 */
export function buildAtlas(scene: Phaser.Scene): void {
  const items: Array<{ name: string; img: RGBAImage }> = [];
  for (const sheet of allSheets) {
    for (const [frame, g] of Object.entries(sheet.frames)) {
      items.push({
        name: `${sheet.key}/${frame}`,
        img: rasterize(g, sheet.keys, `${sheet.key}/${frame}`),
      });
    }
  }
  items.sort((a, b) => b.img.h - a.img.h);
  const maxW = 512;
  const pad = 2;
  let x = pad;
  let y = pad;
  let rowH = 0;
  const pos: Array<[number, number]> = [];
  for (const it of items) {
    if (x + it.img.w + pad > maxW) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    pos.push([x, y]);
    x += it.img.w + pad;
    rowH = Math.max(rowH, it.img.h);
  }
  const { canvas, ctx } = canvasFrom(maxW, nextPow2(y + rowH + pad));
  items.forEach((it, i) => putImage(ctx, it.img, pos[i]![0], pos[i]![1]));
  const tex = scene.textures.addCanvas(ATLAS, canvas)!;
  items.forEach((it, i) => tex.add(it.name, 0, pos[i]![0], pos[i]![1], it.img.w, it.img.h));
}

export const TILE_MARGIN = 1;
export const TILE_SPACING = 2;

/** 生成瓦片集贴图：每块四周外扩 1px（复制边缘像素），防止缩放时瓦片之间出现缝。 */
export function buildTilesetTexture(scene: Phaser.Scene, key: string, ts: Tileset): void {
  const perRow = 16;
  const rows = Math.ceil(ts.tiles.length / perRow);
  const cell = 16 + TILE_SPACING;
  // Phaser 要求：宽 = 2×margin + n×16 + (n-1)×spacing
  const { canvas, ctx } = canvasFrom(
    TILE_MARGIN * 2 + perRow * cell - TILE_SPACING,
    TILE_MARGIN * 2 + rows * cell - TILE_SPACING,
  );
  ts.tiles.forEach((tile, i) => {
    const tx = TILE_MARGIN + (i % perRow) * cell;
    const ty = TILE_MARGIN + Math.floor(i / perRow) * cell;
    putImage(ctx, tile, tx, ty);
    // 外扩：上下左右各复制一行/列
    ctx.drawImage(canvas, tx, ty, 16, 1, tx, ty - 1, 16, 1);
    ctx.drawImage(canvas, tx, ty + 15, 16, 1, tx, ty + 16, 16, 1);
    ctx.drawImage(canvas, tx, ty - 1, 1, 18, tx - 1, ty - 1, 1, 18);
    ctx.drawImage(canvas, tx + 15, ty - 1, 1, 18, tx + 16, ty - 1, 1, 18);
  });
  scene.textures.addCanvas(key, canvas);
}

/** 把一张 RGBA 图注册成贴图 */
export function addImageTexture(scene: Phaser.Scene, key: string, img: RGBAImage): void {
  const { canvas, ctx } = canvasFrom(img.w, img.h);
  putImage(ctx, img, 0, 0);
  scene.textures.addCanvas(key, canvas);
}
