import type Phaser from 'phaser';
import { colorInt } from '../art/palette';
import { VIEW_W } from '../platform/display';
import { PixelText } from './text/pixelText';

const DOTS = 8;
const R = 5;

/**
 * 右上角的"长按跳过"：8 个小点围成一圈，按住时一个个亮起来，满一圈就跳过。
 * 过场开始时先淡淡地提示一下，之后只在按住时出现。
 */
export class SkipHint {
  private root: Phaser.GameObjects.Container;
  private ring: Phaser.GameObjects.Graphics;
  private text: PixelText;
  private alpha = 0;
  private show = 0;
  private label = '';

  constructor(scene: Phaser.Scene) {
    this.root = scene.add.container(0, 6).setDepth(35).setAlpha(0);
    this.ring = scene.add.graphics();
    this.text = new PixelText(scene, 0, 0, '', { color: 'cream', shadow: 'ink' });
    this.root.add([this.ring, this.text.root]);
  }

  /** 先提示几秒 */
  hint(label: string, seconds = 2.5): void {
    this.setLabel(label);
    this.show = Math.max(this.show, seconds);
  }

  private setLabel(label: string): void {
    if (label === this.label) return;
    this.label = label;
    this.text.setText(label);
    const w = this.text.width + R * 2 + 8;
    this.root.x = VIEW_W - w - 8;
    this.text.setPosition(R * 2 + 6, 0);
  }

  /** progress：0–1；按住时调用，松开时传 0 */
  update(dt: number, progress: number, label: string): void {
    this.setLabel(label);
    if (this.show > 0) this.show -= dt;
    const target = progress > 0 ? 1 : this.show > 0 ? 0.75 : 0;
    this.alpha += (target - this.alpha) * (1 - Math.exp(-dt * 12));
    this.root.setAlpha(this.alpha);
    const g = this.ring;
    g.clear();
    if (this.alpha < 0.02) return;
    const lit = Math.floor(progress * DOTS + 1e-6);
    for (let i = 0; i < DOTS; i++) {
      const a = -Math.PI / 2 + (i / DOTS) * Math.PI * 2;
      const x = Math.round(R + Math.cos(a) * R) - 1;
      const y = Math.round(6 + Math.sin(a) * R) - 1;
      g.fillStyle(colorInt('ink'), 1).fillRect(x - 1, y - 1, 4, 4);
      g.fillStyle(colorInt(i < lit ? 'gold' : 'slate'), 1).fillRect(x, y, 2, 2);
    }
  }

  hide(): void {
    this.show = 0;
  }
}
