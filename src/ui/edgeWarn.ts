import type Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../platform/display';
import { ATLAS } from '../view/textures';

interface Mark {
  img: Phaser.GameObjects.Image;
  side: 1 | -1;
  /** 要飞过的高度（世界 y） */
  y: number;
  t: number;
  life: number;
}

/**
 * 崖燕警示（docs/levels/1-3.md §3）：一组崖燕出发前，在它们要飞进来的那一侧画面边上，
 * 对准每只要飞的高度闪出一个黄色三角"！"。贴着画面边缘，跟着镜头上下移动；
 * "减少闪烁"打开时不闪，常亮。
 */
export class EdgeWarn {
  private marks: Mark[] = [];
  private time = 0;

  constructor(private scene: Phaser.Scene) {}

  /** side：1 右边、-1 左边；ys：每只崖燕飞的高度（世界 y）；frames：警示多少逻辑帧 */
  show(side: 1 | -1, ys: number[], frames: number): void {
    // 同一高度的只留一个
    for (const y of new Set(ys.map((v) => Math.round(v)))) {
      const img = this.scene.add
        .image(0, 0, ATLAS, 'cliff/warn_0')
        .setOrigin(0.5, 0.5)
        .setDepth(18)
        .setScale(0);
      this.marks.push({ img, side, y, t: 0, life: frames / 60 + 0.15 });
    }
  }

  /** 每个渲染帧调用；camY 是镜头顶边（世界 y） */
  update(dt: number, camY: number, reduceFlash: boolean): void {
    this.time += dt;
    this.marks = this.marks.filter((m) => {
      m.t += dt;
      if (m.t >= m.life) {
        m.img.destroy();
        return false;
      }
      const pop = Math.min(1, m.t / 0.12);
      const out = Math.min(1, (m.life - m.t) / 0.12);
      const bounce = m.t < 0.2 ? 1 + Math.sin((m.t / 0.2) * Math.PI) * 0.3 : 1;
      const y = Math.max(12, Math.min(VIEW_H - 12, Math.round(m.y - camY)));
      const x = m.side > 0 ? VIEW_W - 12 : 12;
      const blink = !reduceFlash && Math.floor(this.time * 10) % 2 === 1;
      m.img
        .setFrame(blink ? 'cliff/warn_1' : 'cliff/warn_0')
        .setPosition(x + (reduceFlash ? 0 : Math.round(Math.sin(this.time * 30) * m.side)), y)
        .setScale(pop * out * bounce);
      return true;
    });
  }

  clear(): void {
    for (const m of this.marks) m.img.destroy();
    this.marks = [];
  }
}
