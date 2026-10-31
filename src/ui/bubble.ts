import type Phaser from 'phaser';
import { VIEW_W } from '../platform/display';
import { panelTexture } from './panel';
import { PixelText } from './text/pixelText';

const MAX_W = 150;

/**
 * 回回的提示气泡：跟着说话的人（世界坐标，由外部每帧换算成屏幕坐标），
 * 回弹弹出、逐字打出来，不打断游戏，过一会儿自动消失。
 */
export class Bubble {
  private root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Image | null = null;
  private tail: Phaser.GameObjects.Graphics;
  private text: PixelText;
  private timer = 0;
  private w = 0;
  private h = 0;
  active = false;
  onType?: () => void;

  /** 正在显示或正在收起（排队的下一条要等它） */
  get busy(): boolean {
    return this.active || this.root.visible;
  }

  constructor(private scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(15).setVisible(false);
    this.tail = scene.add.graphics();
    this.text = new PixelText(scene, 0, 0, '', { maxWidth: MAX_W, color: 'night' });
    this.text.onType = (c) => {
      if (c.ch !== ' ' && Math.random() < 0.6) this.onType?.();
    };
    this.root.add([this.tail, this.text.root]);
  }

  show(msg: string): void {
    this.text.setText(msg).type();
    this.w = this.text.width + 12;
    this.h = this.text.height + 8;
    this.bg?.destroy();
    this.bg = this.scene.add.image(0, 0, panelTexture(this.scene, this.w, this.h)).setOrigin(0, 0);
    this.root.addAt(this.bg, 0);
    this.root.setVisible(true).setScale(0.3);
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.add({ targets: this.root, scale: 1, duration: 180, ease: 'Back.Out' });
    this.timer = 2.2 + this.text.length * 0.06;
    this.active = true;
  }

  hide(): void {
    if (!this.active) return;
    this.active = false;
    this.scene.tweens.add({
      targets: this.root,
      scale: 0,
      duration: 120,
      ease: 'Cubic.In',
      onComplete: () => this.root.setVisible(false),
    });
  }

  /** (sx, sy)：说话的人头顶在屏幕上的位置 */
  update(dt: number, sx: number, sy: number): void {
    if (!this.root.visible) return;
    this.text.update(dt);
    if (this.active && this.text.done) {
      this.timer -= dt;
      if (this.timer <= 0) this.hide();
    }
    // 气泡放在头顶，左右不出屏幕；小尖角指向说话的人
    const x = Math.round(Math.max(4, Math.min(VIEW_W - this.w - 6, sx - this.w / 2)));
    const y = Math.round(Math.max(4, sy - this.h - 6));
    this.root.setPosition(x, y);
    this.bg?.setPosition(0, 0);
    this.text.setPosition(6, 4);
    const tx = Math.round(Math.max(6, Math.min(this.w - 8, sx - x)));
    const g = this.tail;
    g.clear();
    g.fillStyle(0x2b2f4f, 1);
    g.fillRect(tx - 3, this.h - 1, 7, 1);
    g.fillRect(tx - 2, this.h, 5, 1);
    g.fillRect(tx - 1, this.h + 1, 3, 1);
    g.fillRect(tx, this.h + 2, 1, 1);
    g.fillStyle(0xfff4d6, 1);
    g.fillRect(tx - 2, this.h - 2, 5, 1);
    g.fillRect(tx - 1, this.h - 1, 3, 1);
    g.fillRect(tx, this.h, 1, 1);
    this.root.setScale(this.root.scale);
  }
}
