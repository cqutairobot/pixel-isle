import Phaser from 'phaser';
import { clouds, seaBand, skyGradient } from '../art/background';
import { cloudBank, stacks, windStreak } from '../art/cliffBackground';
import { colorInt, type ColorName } from '../art/palette';
import { VIEW_H, VIEW_W } from '../platform/display';
import type { ParsedLevel } from '../sim/level';
import { addImageTexture } from './textures';

interface Layer {
  obj: Phaser.GameObjects.TileSprite;
  /** 云海层下面接着的一整块底色：镜头爬高、云海层往下沉时，底下不会露出天空 */
  under?: Phaser.GameObjects.Rectangle;
  h: number;
  fx: number;
  fy: number;
  baseY: number;
  drift: number;
}

interface Streak {
  img: Phaser.GameObjects.Image;
  vx: number;
  life: number;
}

/**
 * 第 3 关「回声崖」的视差背景：
 * - 晴朗的天空和高空的云；
 * - 远处的海平线（大半被云海盖住）；
 * - 两层从云海里冒出来的海蚀柱和远崖，由远到近越来越深；
 * - 两层慢慢往右涌的云海，近的那层更白、涌得更快；
 * - 风线：一根根细白线从左往右飞快地掠过（风只是画面效果，不会推人）。
 * 镜头在最低处时 dy = 0；爬到山脊上时 dy 最大，各层按 fy 往下移，好像人升到了云海上面。
 */
export class CliffBackground {
  private layers: Layer[] = [];
  private streaks: Streak[] = [];
  private spawnT = 0;
  private time = 0;
  private readonly maxCamY: number;

  constructor(
    private scene: Phaser.Scene,
    level: ParsedLevel,
  ) {
    this.maxCamY = Math.max(0, level.grid.heightPx - VIEW_H);
    if (!scene.textures.exists('cb-sky')) {
      addImageTexture(
        scene,
        'cb-sky',
        skyGradient(VIEW_W, VIEW_H, [
          ['sky', 0],
          ['sky', 0.5],
          ['cloud', 0.78],
          ['white', 1],
        ]),
      );
      addImageTexture(scene, 'cb-clouds', clouds(640, 60, 31, 'white', 'cloud'));
      addImageTexture(scene, 'cb-sea', seaBand(512, 24, 0, 9));
      addImageTexture(
        scene,
        'cb-far',
        stacks(640, 150, 4, 'mist', 'cloud', 'mist', {
          count: 7,
          minH: 40,
          maxH: 130,
          minW: 16,
          maxW: 44,
        }),
      );
      addImageTexture(
        scene,
        'cb-mid',
        stacks(768, 200, 9, 'stone', 'mist', 'leaf2', {
          count: 5,
          minH: 70,
          maxH: 190,
          minW: 26,
          maxW: 60,
        }),
      );
      addImageTexture(scene, 'cb-bank-far', cloudBank(512, 90, 2, 'cloud', 'white', 'mist'));
      addImageTexture(scene, 'cb-bank-near', cloudBank(640, 80, 7, 'white', 'white', 'cloud'));
      addImageTexture(scene, 'cb-wind', windStreak(12));
    }
    scene.add.image(0, 0, 'cb-sky').setOrigin(0, 0).setScrollFactor(0).setDepth(-100);
    const tile = (
      key: string,
      h: number,
      baseY: number,
      fx: number,
      fy: number,
      depth: number,
      drift = 0,
      under?: ColorName,
    ): void => {
      const obj = scene.add
        .tileSprite(0, baseY, VIEW_W + 2, h, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(depth);
      const rect = under
        ? scene.add
            .rectangle(0, baseY + h, VIEW_W + 2, VIEW_H, colorInt(under))
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(depth)
        : undefined;
      this.layers.push({ obj, under: rect, h, fx, fy, baseY, drift });
    };
    tile('cb-clouds', 60, -40, 0.03, 0.35, -99, 3);
    tile('cb-sea', 24, 124, 0.05, 0.12, -98);
    tile('cb-far', 150, 6, 0.08, 0.16, -97);
    tile('cb-bank-far', 90, 112, 0.12, 0.24, -96, 4, 'mist');
    tile('cb-mid', 200, -10, 0.2, 0.32, -95);
    tile('cb-bank-near', 80, 150, 0.3, 0.42, -94, 9, 'cloud');
  }

  update(dt: number, camX: number, camY: number): void {
    this.time += dt;
    const dy = this.maxCamY - camY;
    for (const l of this.layers) {
      l.obj.tilePositionX = camX * l.fx - this.time * l.drift;
      l.obj.y = Math.round(l.baseY + dy * l.fy);
      if (l.under) l.under.y = l.obj.y + l.h;
    }
    // 风线：每隔一会儿从左边飞进来一根
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.12 + Math.random() * 0.25;
      const img = this.scene.add
        .image(-14, 12 + Math.random() * (VIEW_H - 40), 'cb-wind')
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(-30)
        .setAlpha(0.35 + Math.random() * 0.3)
        .setScale(0.6 + Math.random() * 1.2, 1);
      this.streaks.push({ img, vx: 220 + Math.random() * 160, life: 2.5 });
    }
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const s = this.streaks[i]!;
      s.life -= dt;
      s.img.x += s.vx * dt;
      if (s.life <= 0 || s.img.x > VIEW_W + 4) {
        s.img.destroy();
        this.streaks.splice(i, 1);
      }
    }
  }
}
