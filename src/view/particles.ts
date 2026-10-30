import type Phaser from 'phaser';
import { ATLAS } from './textures';

export interface ParticleSpec {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  /** 重力（px/s²） */
  gravity?: number;
  /** 每秒速度衰减比例（0–1） */
  drag?: number;
  /** 寿命（秒） */
  life: number;
  /** 按寿命依次播放的帧（例如大→中→小，像素风的"缩小消失"） */
  frames: string[];
  flipX?: boolean;
  /** 按固定帧率循环播放帧（例如旋转的碎片）；不写就按寿命播放一遍 */
  fps?: number;
  /** 最后 40% 寿命里淡出 */
  fade?: boolean;
  depth?: number;
}

interface Particle extends Required<Omit<ParticleSpec, 'flipX' | 'depth'>> {
  img: Phaser.GameObjects.Image;
  age: number;
  alive: boolean;
}

/** 简单的对象池粒子系统：帧动画代替缩放，颜色只来自调色板贴图 */
export class Particles {
  private pool: Particle[] = [];

  constructor(
    private scene: Phaser.Scene,
    private max = 256,
  ) {}

  spawn(spec: ParticleSpec): void {
    let p = this.pool.find((q) => !q.alive);
    if (!p) {
      if (this.pool.length >= this.max) return;
      const img = this.scene.add
        .image(0, 0, ATLAS, spec.frames[0])
        .setOrigin(0.5, 0.5)
        .setDepth(20);
      p = {
        img,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        gravity: 0,
        drag: 0,
        life: 1,
        frames: [],
        fps: 0,
        fade: false,
        age: 0,
        alive: false,
      };
      this.pool.push(p);
    }
    p.x = spec.x;
    p.y = spec.y;
    p.vx = spec.vx ?? 0;
    p.vy = spec.vy ?? 0;
    p.gravity = spec.gravity ?? 0;
    p.drag = spec.drag ?? 0;
    p.life = spec.life;
    p.frames = spec.frames;
    p.fps = spec.fps ?? 0;
    p.fade = spec.fade ?? false;
    p.age = 0;
    p.alive = true;
    p.img
      .setVisible(true)
      .setAlpha(1)
      .setDepth(spec.depth ?? 20)
      .setFrame(spec.frames[0]!)
      .setFlipX(spec.flipX ?? false);
  }

  update(dt: number, snap: boolean): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        p.img.setVisible(false);
        continue;
      }
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const idx = p.fps
        ? Math.floor(p.age * p.fps) % p.frames.length
        : Math.min(p.frames.length - 1, Math.floor((p.age / p.life) * p.frames.length));
      p.img.setFrame(p.frames[idx]!);
      if (p.fade) p.img.setAlpha(Math.min(1, (1 - p.age / p.life) / 0.4));
      p.img.setPosition(snap ? Math.round(p.x) : p.x, snap ? Math.round(p.y) : p.y);
    }
  }

  get activeCount(): number {
    return this.pool.filter((p) => p.alive).length;
  }
}
