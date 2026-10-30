import type Phaser from 'phaser';
import { clouds, hills, skyGradient } from '../art/background';
import { VIEW_H, VIEW_W } from '../platform/display';
import { addImageTexture } from './textures';

interface Layer {
  obj: Phaser.GameObjects.TileSprite;
  fx: number;
  fy: number;
  baseY: number;
  drift: number;
}

/** 练习场的视差背景：天空固定，云、远山、近山按不同比例跟随镜头 */
export class BackgroundView {
  private layers: Layer[] = [];
  private time = 0;

  constructor(
    scene: Phaser.Scene,
    private maxCamY: number,
  ) {
    addImageTexture(
      scene,
      'bg-sky',
      skyGradient(VIEW_W, VIEW_H, [
        ['sky', 0],
        ['sky', 0.42],
        ['cloud', 0.62],
        ['cloud', 1],
      ]),
    );
    addImageTexture(scene, 'bg-clouds', clouds(640, 64, 3, 'white', 'cloud'));
    addImageTexture(scene, 'bg-far', hills(512, 90, 11, 'frost', 'cloud', 40, 18));
    addImageTexture(scene, 'bg-near', hills(512, 80, 29, 'mist', 'cloud', 44, 14));
    scene.add.image(0, 0, 'bg-sky').setOrigin(0, 0).setScrollFactor(0).setDepth(-100);
    const add = (
      key: string,
      w: number,
      h: number,
      baseY: number,
      fx: number,
      fy: number,
      drift = 0,
    ) => {
      const obj = scene.add
        .tileSprite(0, baseY, VIEW_W + 2, h, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(-90 + this.layers.length);
      this.layers.push({ obj, fx, fy, baseY, drift });
      void w;
    };
    add('bg-clouds', 640, 64, 18, 0.05, 0.03, 4);
    add('bg-far', 512, 90, 92, 0.1, 0.08);
    add('bg-near', 512, 80, 128, 0.25, 0.18);
  }

  update(dt: number, camX: number, camY: number): void {
    this.time += dt;
    for (const l of this.layers) {
      l.obj.tilePositionX = camX * l.fx + this.time * l.drift;
      l.obj.y = l.baseY + (this.maxCamY - camY) * l.fy;
    }
  }
}
