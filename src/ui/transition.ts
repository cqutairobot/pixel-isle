import type Phaser from 'phaser';
import { BAYER4 } from '../art/paint';
import { hexToRgb, PALETTE } from '../art/palette';
import { VIEW_H, VIEW_W } from '../platform/display';

export type TransitionKind = 'bell' | 'iris' | 'fade';

const TEX = 'transition';
const INK = hexToRgb(PALETTE.ink);
/** 盖满整个画面所需的"半径" */
const FULL = Math.hypot(VIEW_W, VIEW_H) * 0.75;

/** (dx, dy) 在不在一个"大小"为 s 的铃铛形状里（铃铛中心在原点） */
function inBell(dx: number, dy: number, s: number): boolean {
  if (s <= 0) return false;
  const x = dx / s;
  const y = dy / s;
  // 提环、圆顶、向下张开的铃身、铃口、铃舌
  if (x * x + (y + 1.02) * (y + 1.02) < 0.016) return true;
  if (y < -0.35) return x * x + (y + 0.35) * (y + 0.35) < 0.3;
  if (y < 0.42) return Math.abs(x) < 0.55 + ((y + 0.35) / 0.77) * 0.28;
  if (y < 0.56) return Math.abs(x) < 0.9;
  return x * x + (y - 0.7) * (y - 0.7) < 0.02;
}

/**
 * 转场（画在界面场景最上层，切换场景时不会断）：在 384×216 的画布上逐像素绘制，
 * 边缘带有序抖动，看起来也是像素风。
 * - bell：铃铛形状的窗口收拢 / 张开（标题 ↔ 游戏）
 * - iris：以某一点（主角）为中心的圆形收拢 / 张开（倒下）
 * - fade：抖动的淡入淡出（重新开始）
 */
export class Transition {
  private canvas: Phaser.Textures.CanvasTexture;
  private img: Phaser.GameObjects.Image;
  private data: ImageData;
  private anim: {
    kind: TransitionKind;
    out: boolean;
    t: number;
    dur: number;
    cx: number;
    cy: number;
    done: () => void;
  } | null = null;
  /** 现在画面是不是被完全盖住（场景切换后由新场景负责打开） */
  covered = false;
  private lastKind: TransitionKind = 'fade';
  private last = { cx: VIEW_W / 2, cy: VIEW_H / 2 };

  constructor(scene: Phaser.Scene) {
    if (scene.textures.exists(TEX)) scene.textures.remove(TEX);
    this.canvas = scene.textures.createCanvas(TEX, VIEW_W, VIEW_H)!;
    this.data = this.canvas.context.createImageData(VIEW_W, VIEW_H);
    this.img = scene.add.image(0, 0, TEX).setOrigin(0, 0).setDepth(60).setVisible(false);
  }

  get busy(): boolean {
    return this.anim !== null;
  }

  /** 盖住画面（out）或打开画面（in）；完成时 resolve */
  run(
    kind: TransitionKind,
    out: boolean,
    dur = 0.55,
    at: { x: number; y: number } = { x: VIEW_W / 2, y: VIEW_H / 2 },
  ): Promise<void> {
    this.anim?.done();
    this.lastKind = kind;
    this.last = { cx: at.x, cy: at.y };
    return new Promise((resolve) => {
      this.anim = { kind, out, t: 0, dur, cx: at.x, cy: at.y, done: resolve };
      this.img.setVisible(true);
      this.draw(0);
    });
  }

  /** 新场景开场：如果画面被盖着，就用盖上时的方式打开 */
  reveal(dur = 0.55, at?: { x: number; y: number }): Promise<void> {
    if (!this.covered) return Promise.resolve();
    return this.run(this.lastKind, false, dur, at ?? { x: this.last.cx, y: this.last.cy });
  }

  /** k：0 → 1 的进度 */
  private draw(k: number): void {
    const a = this.anim!;
    // cover：0 = 完全看得见，1 = 完全盖住
    const cover = a.out ? k : 1 - k;
    const d = this.data.data;
    if (a.kind === 'fade') {
      for (let y = 0; y < VIEW_H; y++)
        for (let x = 0; x < VIEW_W; x++) {
          const th = (BAYER4[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
          const i = (y * VIEW_W + x) * 4;
          d[i] = INK[0];
          d[i + 1] = INK[1];
          d[i + 2] = INK[2];
          d[i + 3] = cover > th ? 255 : 0;
        }
    } else {
      // 窗口大小随进度缩放（先快后慢）；边缘 3 像素的抖动带
      const e = 1 - cover;
      const r = FULL * e * e * (3 - 2 * e) * (a.kind === 'bell' ? 1.6 : 1);
      for (let y = 0; y < VIEW_H; y++)
        for (let x = 0; x < VIEW_W; x++) {
          const dx = x + 0.5 - a.cx;
          const dy = y + 0.5 - a.cy;
          let inside: boolean;
          if (a.kind === 'iris') {
            const dist = Math.hypot(dx, dy);
            const th = (BAYER4[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
            inside = dist < r - 3 || (dist < r && (r - dist) / 3 > th);
          } else inside = inBell(dx, dy, r);
          const i = (y * VIEW_W + x) * 4;
          d[i] = INK[0];
          d[i + 1] = INK[1];
          d[i + 2] = INK[2];
          d[i + 3] = inside ? 0 : 255;
        }
    }
    this.canvas.context.putImageData(this.data, 0, 0);
    this.canvas.refresh();
  }

  update(dt: number): void {
    const a = this.anim;
    if (!a) return;
    a.t = Math.min(a.dur, a.t + dt);
    const k = a.t / a.dur;
    this.draw(k);
    if (k >= 1) {
      this.anim = null;
      this.covered = a.out;
      this.img.setVisible(a.out);
      a.done();
    }
  }
}
