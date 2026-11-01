import Phaser from 'phaser';
import { clouds, seaBand, skyGradient } from '../art/background';
import { canopy, lightShafts, palmRow } from '../art/groveBackground';
import { VIEW_H, VIEW_W } from '../platform/display';
import type { ParsedLevel } from '../sim/level';
import { addImageTexture } from './textures';

interface Layer {
  obj: Phaser.GameObjects.TileSprite;
  fx: number;
  fy: number;
  baseY: number;
  drift: number;
}

/**
 * 第 2 关「椰影小径」的视差背景：
 * - 天空和云（只有往上爬的时候才看得到云）；
 * - 远处的海：藏在远景树林后面，往上爬时才从树梢上露出来；
 * - 三层椰树剪影，由远到近越来越深（远景发白、中景蓝灰、近景深蓝灰）；
 * - 画面上边垂下来的深绿树冠，往上爬时往上退出画面；
 * - 穿过树缝的斜光柱，叠加混合，亮度慢慢起伏。
 * 镜头在最低处（A–C 段）时 dy = 0；爬到树冠顶时 dy 最大，各层按 fy 往下移，露出天空。
 */
export class GroveBackground {
  private layers: Layer[] = [];
  private shafts: Phaser.GameObjects.TileSprite;
  private time = 0;
  private readonly maxCamY: number;

  constructor(scene: Phaser.Scene, level: ParsedLevel) {
    this.maxCamY = Math.max(0, level.grid.heightPx - VIEW_H);
    if (!scene.textures.exists('gb-sky')) {
      addImageTexture(
        scene,
        'gb-sky',
        skyGradient(VIEW_W, VIEW_H, [
          ['sky', 0],
          ['sky', 0.15],
          ['cloud', 0.42],
          ['cream', 0.62],
          ['cream', 1],
        ]),
      );
      addImageTexture(scene, 'gb-clouds', clouds(640, 60, 21, 'white', 'cloud'));
      addImageTexture(scene, 'gb-sea', seaBand(512, 28, 0));
      addImageTexture(
        scene,
        'gb-far',
        palmRow(640, 160, 3, 'mist', 'cloud', { count: 12, minH: 90, maxH: 140, bush: 100 }),
      );
      addImageTexture(
        scene,
        'gb-mid',
        palmRow(512, 200, 8, 'stone', 'mist', { count: 7, minH: 130, maxH: 185, bush: 86 }),
      );
      addImageTexture(
        scene,
        'gb-near',
        palmRow(768, 250, 14, 'slate', 'stone', { count: 3, minH: 190, maxH: 240, bush: 40 }),
      );
      addImageTexture(scene, 'gb-canopy', canopy(512, 44, 2));
      addImageTexture(scene, 'gb-shafts', lightShafts(512, VIEW_H, 5));
    }
    scene.add.image(0, 0, 'gb-sky').setOrigin(0, 0).setScrollFactor(0).setDepth(-100);
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
    tile('gb-clouds', 60, -70, 0.03, 0.4, -99, 3);
    tile('gb-sea', 28, 118, 0.06, 0.1, -98);
    tile('gb-far', 160, 56, 0.1, 0.15, -97);
    tile('gb-mid', 200, 16, 0.22, 0.3, -96);
    tile('gb-near', 250, -34, 0.4, 0.5, -95);
    tile('gb-canopy', 44, 0, 0.5, -0.35, -94);
    this.shafts = scene.add
      .tileSprite(0, 0, VIEW_W + 2, VIEW_H, 'gb-shafts')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-20)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.16);
  }

  update(dt: number, camX: number, camY: number): void {
    this.time += dt;
    const dy = this.maxCamY - camY;
    for (const l of this.layers) {
      l.obj.tilePositionX = camX * l.fx + this.time * l.drift;
      l.obj.y = Math.round(l.baseY + dy * l.fy);
    }
    // 光柱跟着镜头慢慢平移，亮度像云影掠过一样起伏
    this.shafts.tilePositionX = camX * 0.25 + this.time * 1.5;
    this.shafts.setAlpha(
      0.14 + Math.sin(this.time * 0.7) * 0.04 + Math.sin(this.time * 1.9) * 0.015,
    );
  }
}
