import type Phaser from 'phaser';
import { VIEW_W } from '../platform/display';
import { DUR } from './motion';
import { panelTexture } from './panel';
import { PixelText } from './text/pixelText';

/** 屏幕上方的小提示条（"已记录"、"找到海玻璃 1/3"）：回弹落下，停一会儿再收起 */
export class Toast {
  private root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Image | null = null;
  private text: PixelText;
  private timer = 0;

  constructor(private scene: Phaser.Scene) {
    this.root = scene.add
      .container(VIEW_W / 2, -20)
      .setDepth(20)
      .setVisible(false);
    this.text = new PixelText(scene, 0, 0, '', { color: 'night' });
    this.root.add(this.text.root);
  }

  show(msg: string, seconds = 1.6): void {
    this.text.setText(msg);
    const w = this.text.width + 16;
    const h = 18;
    this.bg?.destroy();
    this.bg = this.scene.add.image(0, 0, panelTexture(this.scene, w, h)).setOrigin(0, 0);
    this.root.addAt(this.bg, 0);
    this.bg.setPosition(-Math.round(w / 2), 0);
    this.text.setPosition(-Math.round(w / 2) + 8, 2);
    this.root.setVisible(true);
    this.scene.tweens.killTweensOf(this.root);
    this.root.y = -h - 4;
    this.scene.tweens.add({ targets: this.root, y: 30, duration: DUR.m, ease: 'Back.Out' });
    this.timer = seconds;
  }

  update(dt: number): void {
    this.text.update(dt);
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0)
        this.scene.tweens.add({
          targets: this.root,
          y: -24,
          duration: DUR.s,
          ease: 'Cubic.In',
          onComplete: () => this.root.setVisible(false),
        });
    }
  }
}
