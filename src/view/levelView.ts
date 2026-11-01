import type Phaser from 'phaser';
import { waterSheet } from '../art/water';
import { buildLevelTileset } from '../art/terrain';
import { TILE } from '../sim/constants';
import { T_ONEWAY, T_SOLID, T_WATER } from '../sim/grid';
import { themeAt, type EntityDef, type ParsedLevel } from '../sim/level';
import { addImageTexture, ATLAS, buildTilesetTexture, TILE_MARGIN, TILE_SPACING } from './textures';

/** 每种装饰用哪一帧、锚点在哪（默认左下角对齐格子左下角） */
export const DECO: Record<
  string,
  {
    frames: string[];
    fps?: number;
    ox?: number;
    /** 0：顶边对齐格子顶边（垂下来的东西）；默认 1：底边对齐格子底边 */
    oy?: number;
    depth?: number;
    dy?: number;
    /** 前景：画在最前面，有人走到后面时变透明 */
    front?: boolean;
  }
> = {
  house_home: { frames: ['deco/house_home'] },
  house_roof: { frames: ['deco/house_roof'] },
  stall: { frames: ['deco/stall'] },
  nets: { frames: ['deco/nets'] },
  lantern: { frames: ['deco/lantern_0', 'deco/lantern_1'], fps: 2.5 },
  flowers: { frames: ['deco/flowers'] },
  fence: { frames: ['deco/fence'] },
  bench: { frames: ['deco/bench'] },
  tower: { frames: ['deco/tower'], depth: -12 },
  statue: { frames: ['npc/grandpa_frozen'], ox: 0.5, depth: -4 },
  palm: { frames: ['deco/palm_0', 'deco/palm_1'], fps: 0.9, ox: 0.43, depth: -11 },
  palm_small: {
    frames: ['deco/palm_small_0', 'deco/palm_small_1'],
    fps: 1.1,
    ox: 0.43,
    depth: -11,
  },
  rock: { frames: ['deco/rock'], depth: -6, dy: 1 },
  starfish: { frames: ['deco/starfish'], ox: 0.5, depth: 1, dy: 2 },
  shells: { frames: ['deco/shells'], depth: 1, dy: 2 },
  rack: { frames: ['deco/rack'] },
  post: { frames: ['deco/post_gull'], ox: 0.5, depth: 29, dy: 12 },
  boat: { frames: ['deco/boat'], depth: 29, dy: 6 },
  // —— 第 2 关：椰林 ——
  fern: { frames: ['grove/fern'], ox: 0.5, depth: -5, dy: 1 },
  fern_b: { frames: ['grove/fern_b'], ox: 0.5, depth: -5, dy: 1 },
  mushrooms: { frames: ['grove/mushrooms'], depth: -5, dy: 1 },
  vine_s: { frames: ['grove/vine_s'], ox: 0.5, oy: 0, depth: -7 },
  vine_l: { frames: ['grove/vine_l'], ox: 0.5, oy: 0, depth: -7 },
  nest: { frames: ['grove/nest'], ox: 0.5, depth: -4, dy: 2 },
  hut: { frames: ['grove/hut'], depth: -10 },
  giant_trunk: { frames: ['grove/giant_trunk'], ox: 0.5, depth: -13 },
  giant_crown: { frames: ['grove/giant_crown'], ox: 0.5, oy: 0, depth: -12 },
  cart: { frames: ['grove/cart'], ox: 0.5, depth: -4 },
  front_hang: { frames: ['grove/front_hang'], oy: 0, depth: 42, front: true },
  front_rise: { frames: ['grove/front_rise'], depth: 42, front: true },
};

/** 前景遮挡：有人在后面时淡到这个透明度 */
const FRONT_FADE = 0.35;

interface Anim {
  img: Phaser.GameObjects.Image;
  frames: string[];
  fps: number;
  phase: number;
}

interface Bob {
  img: Phaser.GameObjects.Image;
  baseY: number;
  phase: number;
}

/**
 * 关卡里不动或只做循环小动画的部分：按材质拼好的瓦片、海水（水面 4 帧）、
 * 装饰（房子、钟楼、椰子树……）、冰霜脚印。
 */
export class LevelView {
  /** 所有装饰的精灵（过场里要用：序章藏起冰雕、给灯笼加光晕） */
  readonly decos: Array<{ kind: string; img: Phaser.GameObjects.Image }> = [];
  private surfaces: Array<{ ts: Phaser.GameObjects.TileSprite; pre: string }> = [];
  /** 前景遮挡的装饰（有人在后面时变透明） */
  private fronts: Phaser.GameObjects.Image[] = [];
  private anims: Anim[] = [];
  private bobs: Bob[] = [];
  private time = 0;
  private waterFrame = -1;

  constructor(
    private scene: Phaser.Scene,
    private level: ParsedLevel,
  ) {
    const key = `tiles-${level.id}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const ts = buildLevelTileset(level.grid, level.material, level.practice ? 'gym' : 'island');
    buildTilesetTexture(scene, key, ts);
    const map = scene.make.tilemap({ data: ts.data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage(key, key, TILE, TILE, TILE_MARGIN, TILE_SPACING)!;
    // 相机原点在左上角时 Phaser 的瓦片剔除会算错范围，关掉剔除（几千块瓦片全画也没压力）
    const layer = map.createLayer(0, tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;
    layer.setDepth(0).setSkipCull(true);
    this.buildWater();
    for (const e of level.entities) if (e.type === 'deco') this.addDeco(e);
  }

  private buildWater(): void {
    const scene = this.scene;
    if (!scene.textures.exists('water-s0')) {
      for (let i = 0; i < 4; i++) {
        addImageTexture(scene, `water-s${i}`, waterSheet.frames[`surface_${i}`]!);
        addImageTexture(scene, `stream-s${i}`, waterSheet.frames[`stream_surface_${i}`]!);
      }
      addImageTexture(scene, 'water-b', waterSheet.frames.body!);
      addImageTexture(scene, 'stream-b', waterSheet.frames.stream_body!);
    }
    const g = this.level.grid;
    for (let r = 0; r < g.rows; r++) {
      let c = 0;
      while (c < g.cols) {
        if (g.get(c, r) !== T_WATER) {
          c++;
          continue;
        }
        const surface = g.get(c, r - 1) !== T_WATER;
        let end = c;
        while (
          end + 1 < g.cols &&
          g.get(end + 1, r) === T_WATER &&
          (g.get(end + 1, r - 1) !== T_WATER) === surface
        )
          end++;
        // 椰林里的小溪偏绿
        const pre = themeAt(this.level, c) === 'grove' ? 'stream' : 'water';
        const ts = scene.add
          .tileSprite(
            c * TILE,
            r * TILE,
            (end - c + 1) * TILE,
            TILE,
            surface ? `${pre}-s0` : `${pre}-b`,
          )
          .setOrigin(0, 0)
          .setDepth(30)
          .setAlpha(surface ? 0.88 : 0.92);
        if (surface) this.surfaces.push({ ts, pre });
        c = end + 1;
      }
    }
  }

  private addDeco(e: Extract<EntityDef, { type: 'deco' }>): void {
    if (e.kind === 'footprints') {
      this.addFootprints(e.at[0], e.at[1], 40);
      return;
    }
    const d = DECO[e.kind];
    if (!d) {
      console.warn(`未知的装饰 ${e.kind}`);
      return;
    }
    const frames = e.kind === 'flowers' && e.at[0] % 2 ? ['deco/flowers_b'] : d.frames;
    const oy = d.oy ?? 1;
    const x = e.at[0] * TILE + (d.ox !== undefined ? TILE / 2 : 0);
    const y = (e.at[1] + oy) * TILE + (d.dy ?? 0);
    const img = this.scene.add
      .image(x, y, ATLAS, frames[0])
      .setOrigin(d.ox ?? 0, oy)
      .setDepth(d.depth ?? -8)
      .setFlipX(!!e.flip);
    this.decos.push({ kind: e.kind, img });
    if (d.front || e.front) this.fronts.push(img.setDepth(42));
    if (frames.length > 1)
      this.anims.push({ img, frames, fps: d.fps ?? 2, phase: (e.at[0] * 0.37) % 1 });
    if (e.kind === 'boat' || e.kind === 'post')
      this.bobs.push({ img, baseY: y, phase: e.at[0] * 0.7 });
  }

  /** 从 col 开始往右 len 格，沿地面（从 row 往下找到的第一个能站的面）画一串冰霜脚印，越往后越淡 */
  private addFootprints(col: number, row: number, len: number): void {
    const g = this.level.grid;
    let left = true;
    for (let c = col; c < col + len && c < g.cols; c++) {
      let top = -1;
      for (let r = Math.max(0, row - 1); r < g.rows; r++) {
        const t = g.get(c, r);
        if (t === T_SOLID || t === T_ONEWAY) {
          top = r;
          break;
        }
        if (t === T_WATER) break;
      }
      if (top < 0) continue;
      const fade = 1 - (c - col) / len;
      for (const k of [0, 1]) {
        const x = c * TILE + 3 + k * 8;
        this.scene.add
          .image(x, top * TILE + 1 + (left ? 0 : 1), ATLAS, 'deco/print')
          .setOrigin(0, 0)
          .setDepth(1)
          .setAlpha(0.35 + 0.6 * fade);
        left = !left;
      }
    }
  }

  update(dt: number): void {
    this.time += dt;
    const f = Math.floor(this.time / 0.16) % 4;
    if (f !== this.waterFrame) {
      this.waterFrame = f;
      for (const s of this.surfaces) s.ts.setTexture(`${s.pre}-s${f}`);
    }
    for (const s of this.surfaces) s.ts.tilePositionX = this.time * 3;
    for (const a of this.anims)
      a.img.setFrame(
        a.frames[Math.floor(this.time * a.fps + a.phase * a.frames.length) % a.frames.length]!,
      );
    for (const b of this.bobs)
      b.img.y = b.baseY + Math.round(Math.sin(this.time * 1.8 + b.phase) * 1.2);
  }

  /**
   * 前景遮挡：主角或敌人（rects，世界坐标）走到前景叶子后面时，叶子渐渐变成 35% 透明，
   * 不会挡住危险；走开后再慢慢恢复。
   */
  updateFronts(
    dt: number,
    rects: ReadonlyArray<{ x: number; y: number; w: number; h: number }>,
  ): void {
    for (const img of this.fronts) {
      const b = img.getBounds();
      // 叶子的边缘稀疏，往里收一点再判断
      const x0 = b.x + 6;
      const y0 = b.y + 4;
      const x1 = b.right - 6;
      const y1 = b.bottom - 4;
      const behind = rects.some((r) => r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0);
      const target = behind ? FRONT_FADE : 1;
      const k = 1 - Math.exp(-dt * (behind ? 14 : 5));
      img.setAlpha(img.alpha + (target - img.alpha) * k);
    }
  }
}
