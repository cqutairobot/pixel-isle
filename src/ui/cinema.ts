import type Phaser from 'phaser';
import { colorInt } from '../art/palette';
import { VIEW_H, VIEW_W } from '../platform/display';
import { panelTexture } from './panel';
import { PixelText } from './text/pixelText';

const BAR = 20;
const INK = colorInt('ink');

/**
 * 过场用的画面元素（都在界面场景里，不受世界镜头影响）：
 * 上下黑边、全屏遮罩（淡入淡出）、居中字幕、关卡名横幅。
 */
export class Cinema {
  private top: Phaser.GameObjects.Rectangle;
  private bottom: Phaser.GameObjects.Rectangle;
  private cover: Phaser.GameObjects.Rectangle;
  private captionText: PixelText | null = null;
  private bars = 0;
  private barsTarget = 0;

  constructor(private scene: Phaser.Scene) {
    this.top = scene.add.rectangle(0, -BAR, VIEW_W, BAR, INK).setOrigin(0, 0).setDepth(25);
    this.bottom = scene.add.rectangle(0, VIEW_H, VIEW_W, BAR, INK).setOrigin(0, 0).setDepth(25);
    this.cover = scene.add
      .rectangle(0, 0, VIEW_W, VIEW_H, INK)
      .setOrigin(0, 0)
      .setDepth(28)
      .setAlpha(0)
      .setVisible(false);
  }

  get letterboxed(): boolean {
    return this.barsTarget > 0;
  }

  letterbox(on: boolean): void {
    this.barsTarget = on ? 1 : 0;
  }

  setCover(a: number): void {
    this.cover.setAlpha(a).setVisible(a > 0.001);
  }

  get coverAlpha(): number {
    return this.cover.visible ? this.cover.alpha : 0;
  }

  caption(text: string | null): void {
    const old = this.captionText;
    if (old) {
      this.captionText = null;
      this.scene.tweens.add({
        targets: old.root,
        alpha: 0,
        duration: 400,
        onComplete: () => old.destroy(),
      });
    }
    if (!text) return;
    const t = new PixelText(this.scene, 0, 0, text, { color: 'cream' });
    t.setPosition(Math.round((VIEW_W - t.width) / 2), Math.round(VIEW_H / 2 - 7)).setDepth(29);
    t.root.setAlpha(0);
    t.type();
    this.scene.tweens.add({ targets: t.root, alpha: 1, duration: 500 });
    this.captionText = t;
  }

  /** 关卡名横幅：一条深色的带子从左边滑进来，停一会儿再滑出去（不打断游戏） */
  banner(chapter: string, title: string): void {
    const s = this.scene;
    const h = 46;
    const y = 52;
    const root = s.add.container(-VIEW_W, y).setDepth(24);
    const bg = s.add.image(-8, 0, panelTexture(s, VIEW_W + 16, h, 'night')).setOrigin(0, 0);
    const c = new PixelText(s, 0, 6, chapter, { color: 'gold' });
    c.setPosition(Math.round((VIEW_W - c.width) / 2), 5);
    const t = new PixelText(s, 0, 0, title, { color: 'cream', shadow: 'ink' });
    t.root.setScale(2);
    t.setPosition(Math.round((VIEW_W - t.width * 2) / 2), 18);
    root.add([bg, c.root, t.root]);
    s.tweens.chain({
      targets: root,
      tweens: [
        { x: 0, duration: 420, ease: 'Cubic.Out' },
        { x: 0, duration: 2200 },
        { x: VIEW_W, duration: 380, ease: 'Cubic.In' },
      ],
      onComplete: () => {
        c.destroy();
        t.destroy();
        root.destroy();
      },
    });
  }

  update(dt: number): void {
    this.captionText?.update(dt);
    if (this.bars !== this.barsTarget) {
      const step = dt / 0.35;
      this.bars =
        this.barsTarget > this.bars
          ? Math.min(this.barsTarget, this.bars + step)
          : Math.max(this.barsTarget, this.bars - step);
      const k = 0.5 - Math.cos(this.bars * Math.PI) / 2;
      this.top.y = Math.round(-BAR + BAR * k);
      this.bottom.y = Math.round(VIEW_H - BAR * k);
    }
  }
}
