import type Phaser from 'phaser';
import { KEY_HINTS } from '../content/text';
import { VIEW_H, VIEW_W } from '../platform/display';
import { ATLAS } from '../view/textures';
import { DUR } from './motion';
import { panelTexture } from './panel';
import { PixelText } from './text/pixelText';

export type KeyHintId = keyof typeof KEY_HINTS;
export type Scheme = 'wasd' | 'arrows' | 'pad';

/** 每个提示要画的键帽：按键盘的两套键位和手柄分别给出 */
const KEYS: Record<KeyHintId, Record<Scheme, string[]>> = {
  move: { wasd: ['A', 'D'], arrows: ['←', '→'], pad: ['摇杆'] },
  jump: { wasd: ['K'], arrows: ['Z'], pad: ['A'] },
  run: { wasd: ['D'], arrows: ['→'], pad: ['→'] },
  talk: { wasd: ['W'], arrows: ['↑'], pad: ['↑'] },
  drop: { wasd: ['S', '+', 'K'], arrows: ['↓', '+', 'Z'], pad: ['↓', '+', 'A'] },
  throw: { wasd: ['J'], arrows: ['X'], pad: ['X'] },
  throwUp: { wasd: ['W', '+', 'J'], arrows: ['↑', '+', 'X'], pad: ['↑', '+', 'X'] },
};

/**
 * 屏幕下方的按键提示：键帽 + 说明，自动按最近用的设备切换键位。
 * 显示 4 秒，或者玩家做了对应动作就收起。
 */
export class KeyHint {
  private root: Phaser.GameObjects.Container;
  private items: Phaser.GameObjects.GameObject[] = [];
  private texts: PixelText[] = [];
  private timer = 0;
  current: KeyHintId | null = null;
  private scheme: Scheme = 'wasd';

  constructor(private scene: Phaser.Scene) {
    this.root = scene.add
      .container(VIEW_W / 2, VIEW_H + 20)
      .setDepth(20)
      .setVisible(false);
  }

  show(id: KeyHintId, scheme: Scheme, seconds = 4.5): void {
    this.clear();
    this.current = id;
    this.scheme = scheme;
    const keys = KEYS[id][scheme];
    let x = 6;
    const parts: Array<{ img?: Phaser.GameObjects.Image; t: PixelText; x: number; w: number }> = [];
    for (const k of keys) {
      if (k === '+') {
        const t = new PixelText(this.scene, 0, 0, '+', { color: 'cream' });
        parts.push({ t, x, w: t.width });
        x += t.width + 3;
        continue;
      }
      const t = new PixelText(this.scene, 0, 0, k, { color: 'night' });
      const capW = t.width > 12 ? 27 : t.width > 7 ? 19 : 13;
      const img = this.scene.add
        .image(0, 0, ATLAS, `ui/key_${capW === 27 ? 3 : capW === 19 ? 2 : 1}`)
        .setOrigin(0, 0);
      parts.push({ img, t, x, w: capW });
      x += capW + 3;
    }
    const label = new PixelText(this.scene, 0, 0, (id === 'run' ? '按住 ' : '') + KEY_HINTS[id], {
      color: 'cream',
      shadow: 'ink',
    });
    const total = x + 3 + label.width + 6;
    const bg = this.scene.add
      .image(-Math.round(total / 2), -2, panelTexture(this.scene, total, 18, 'night'))
      .setOrigin(0, 0)
      .setAlpha(0.92);
    this.root.add(bg);
    this.items.push(bg);
    const left = -Math.round(total / 2);
    for (const p of parts) {
      if (p.img) {
        p.img.setPosition(left + p.x, 1);
        this.root.add(p.img);
        this.items.push(p.img);
        p.t.setPosition(left + p.x + Math.round((p.w - p.t.width) / 2), 0);
      } else {
        p.t.setPosition(left + p.x, 1);
      }
      this.root.add(p.t.root);
      this.texts.push(p.t);
    }
    label.setPosition(left + x + 3, 1);
    this.root.add(label.root);
    this.texts.push(label);
    this.root.setVisible(true);
    this.scene.tweens.killTweensOf(this.root);
    this.root.y = VIEW_H + 4;
    this.scene.tweens.add({
      targets: this.root,
      y: VIEW_H - 26,
      duration: DUR.m,
      ease: 'Back.Out',
    });
    this.timer = seconds;
  }

  /** 设备变了就按新的键位重画 */
  refresh(scheme: Scheme): void {
    if (this.current && scheme !== this.scheme && this.timer > 0)
      this.show(this.current, scheme, this.timer);
  }

  /** 玩家做了提示里的动作：提前收起 */
  done(id: KeyHintId): void {
    if (this.current === id && this.timer > 0.6) this.timer = 0.6;
  }

  private clear(): void {
    for (const it of this.items) it.destroy();
    for (const t of this.texts) t.destroy();
    this.items = [];
    this.texts = [];
  }

  update(dt: number): void {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.current = null;
        this.scene.tweens.add({
          targets: this.root,
          y: VIEW_H + 4,
          duration: DUR.s,
          ease: 'Cubic.In',
          onComplete: () => {
            if (!this.current) this.root.setVisible(false);
          },
        });
      }
    }
  }
}
