import type Phaser from 'phaser';
import {
  clouds,
  coastSilhouette,
  foreground,
  islands,
  seaBand,
  skyGradient,
  sunDisc,
  sunGlitter,
  villageSilhouette,
} from '../art/background';
import { VIEW_H, VIEW_W } from '../platform/display';
import { TILE } from '../sim/constants';
import type { ParsedLevel } from '../sim/level';
import { addImageTexture } from './textures';

interface Layer {
  obj: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image;
  fx: number;
  fy: number;
  baseY: number;
  drift: number;
  baseX?: number;
}

/** 海平线在画面里的高度（镜头在最低处时） */
const HORIZON = 116;
const SEA_FRAMES = 4;

/**
 * 第 1 关的视差背景：清晨的天空、朝阳、两层暖色云、远处的小岛、闪着波光的海面和太阳倒影，
 * 中景是村庄或海岸的剪影（按镜头位置从村庄渐变到海边），最前面是贴着画面底边的前景剪影。
 */
export class IslandBackground {
  private layers: Layer[] = [];
  private sea: Phaser.GameObjects.TileSprite;
  private glitter: Phaser.GameObjects.Image;
  private sun: Phaser.GameObjects.Image;
  private village: Layer;
  private coast: Layer;
  private fgVillage: Phaser.GameObjects.TileSprite;
  private fgBeach: Phaser.GameObjects.TileSprite;
  private time = 0;
  private seaFrame = -1;
  private readonly maxCamY: number;
  /** 村庄 → 海边的交界（世界 x） */
  private readonly border: number;

  constructor(scene: Phaser.Scene, level: ParsedLevel) {
    this.maxCamY = Math.max(0, level.grid.heightPx - VIEW_H);
    this.border = (level.themes.find((t) => t.theme === 'beach')?.from ?? 0) * TILE;
    if (!scene.textures.exists('bg-dawn')) {
      addImageTexture(
        scene,
        'bg-dawn',
        skyGradient(VIEW_W, VIEW_H, [
          ['sky', 0],
          ['sky', 0.2],
          ['cloud', 0.4],
          ['cream', 0.5],
          ['skin2', 0.56],
          ['skin2', 1],
        ]),
      );
      addImageTexture(scene, 'bg-sun', sunDisc(9));
      addImageTexture(scene, 'bg-clouds-far', clouds(640, 60, 7, 'white', 'skin2'));
      addImageTexture(scene, 'bg-clouds-near', clouds(512, 50, 13, 'cream', 'skin1'));
      addImageTexture(scene, 'bg-islands', islands(640, 22, 5, 'mist', 'cloud'));
      for (let i = 0; i < SEA_FRAMES; i++) {
        addImageTexture(scene, `bg-sea-${i}`, seaBand(512, VIEW_H - HORIZON + 40, i));
        addImageTexture(scene, `bg-glitter-${i}`, sunGlitter(26, 46, i));
      }
      addImageTexture(scene, 'bg-village', villageSilhouette(512, 74, 9, 'mist', 'cloud'));
      addImageTexture(scene, 'bg-coast', coastSilhouette(640, 60, 4, 'mist', 'cloud'));
      addImageTexture(scene, 'fg-village', foreground(640, 26, 3, 'village'));
      addImageTexture(scene, 'fg-beach', foreground(640, 26, 8, 'beach'));
    }
    scene.add.image(0, 0, 'bg-dawn').setOrigin(0, 0).setScrollFactor(0).setDepth(-100);
    this.sun = scene.add.image(0, 0, 'bg-sun').setScrollFactor(0).setDepth(-99);
    const tile = (
      key: string,
      h: number,
      baseY: number,
      fx: number,
      fy: number,
      depth: number,
      drift = 0,
    ): Layer => {
      const obj = scene.add
        .tileSprite(0, baseY, VIEW_W + 2, h, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(depth);
      const l = { obj, fx, fy, baseY, drift };
      this.layers.push(l);
      return l;
    };
    tile('bg-clouds-far', 60, 6, 0.02, 0.03, -98, 2);
    tile('bg-clouds-near', 50, 40, 0.05, 0.05, -97, 5);
    this.sea = tile('bg-sea-0', VIEW_H - HORIZON + 40, HORIZON, 0.08, 0.1, -96)
      .obj as Phaser.GameObjects.TileSprite;
    this.glitter = scene.add
      .image(0, 0, 'bg-glitter-0')
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(-95);
    tile('bg-islands', 22, HORIZON - 21, 0.07, 0.1, -94);
    this.village = tile('bg-village', 74, HORIZON - 30, 0.22, 0.2, -93);
    this.coast = tile('bg-coast', 60, HORIZON - 34, 0.18, 0.18, -92);
    this.fgVillage = scene.add
      .tileSprite(0, VIEW_H - 26, VIEW_W + 2, 26, 'fg-village')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(40);
    this.fgBeach = scene.add
      .tileSprite(0, VIEW_H - 26, VIEW_W + 2, 26, 'fg-beach')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(40);
  }

  update(dt: number, camX: number, camY: number): void {
    this.time += dt;
    const dy = this.maxCamY - camY;
    for (const l of this.layers) {
      const ts = l.obj as Phaser.GameObjects.TileSprite;
      ts.tilePositionX = camX * l.fx + this.time * l.drift;
      ts.y = Math.round(l.baseY + dy * l.fy);
    }
    // 海面波光换帧
    const f = Math.floor(this.time / 0.22) % SEA_FRAMES;
    if (f !== this.seaFrame) {
      this.seaFrame = f;
      this.sea.setTexture(`bg-sea-${f}`);
      this.glitter.setTexture(`bg-glitter-${(f + 1) % SEA_FRAMES}`);
    }
    // 太阳几乎不动；倒影在太阳正下方
    const sunX = Math.round(296 - camX * 0.012);
    const horizon = Math.round(HORIZON + dy * 0.1);
    this.sun.setPosition(sunX, horizon - 16 + Math.round(dy * 0.02));
    this.glitter.setPosition(sunX, horizon + 2);
    // 村庄 → 海边：按镜头中心位置交叉淡化中景与前景
    const center = camX + VIEW_W / 2;
    const w = Math.min(1, Math.max(0, 0.5 - (center - this.border) / 360));
    this.village.obj.setAlpha(w);
    this.coast.obj.setAlpha(1 - w);
    this.fgVillage.setAlpha(w).tilePositionX = camX * 1.3;
    this.fgBeach.setAlpha(1 - w).tilePositionX = camX * 1.3;
  }
}
