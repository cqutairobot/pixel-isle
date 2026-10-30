import Phaser from 'phaser';
import { colorInt } from '../art/palette';

interface Pt {
  x: number;
  y: number;
  px: number;
  py: number;
}

/**
 * 帽带的两条飘带：每条 4 个节点的链（Verlet 积分 + 距离约束）。
 * 只在表现层使用，不影响玩法，所以不需要确定性。
 * 坐标在"飘带自己的局部空间"里计算，整条飘带跟随精灵位置平滑移动，形状量化到整像素。
 */
export class Ribbon {
  readonly gfx: Phaser.GameObjects.Graphics;
  private tails: Pt[][] = [];
  private lengths = [3, 2.6];
  private time = 0;
  private readonly colors = [colorInt('red1'), colorInt('red2')];

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics();
    for (let t = 0; t < 2; t++) {
      this.tails.push(Array.from({ length: 5 }, () => ({ x: 0, y: 0, px: 0, py: 0 })));
    }
  }

  /** 把所有节点放到锚点处（传送后调用，避免飘带被拉长） */
  reset(ax: number, ay: number): void {
    for (const tail of this.tails)
      for (const p of tail) Object.assign(p, { x: ax, y: ay, px: ax, py: ay });
  }

  /**
   * ax, ay：帽带结的世界坐标；facing：朝向；speed：水平速度（px/s）；dt：秒
   */
  update(ax: number, ay: number, facing: number, vx: number, vy: number, dt: number): void {
    this.time += dt;
    const h = Math.min(dt, 1 / 30);
    const wind = Math.sin(this.time * 2.3) * 0.6 + Math.sin(this.time * 5.1) * 0.25;
    this.tails.forEach((tail, ti) => {
      const head = tail[0]!;
      head.px = head.x;
      head.py = head.y;
      head.x = ax;
      head.y = ay + ti;
      const len = this.lengths[ti]!;
      for (let i = 1; i < tail.length; i++) {
        const p = tail[i]!;
        const dx = (p.x - p.px) * 0.86;
        const dy = (p.y - p.py) * 0.86;
        p.px = p.x;
        p.py = p.y;
        // 重力 + 往身后飘的"风"（跑得越快越平）
        const back = -facing * (8 + Math.min(Math.abs(vx), 160) * 0.25) + wind * 6;
        p.x += dx + back * h * h * 60;
        p.y +=
          dy + (60 - Math.min(Math.abs(vx), 160) * 0.2 - vy * 0.08) * h * h * 60 * (0.6 + ti * 0.3);
      }
      for (let it = 0; it < 3; it++) {
        for (let i = 1; i < tail.length; i++) {
          const a = tail[i - 1]!;
          const b = tail[i]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.0001;
          const diff = (d - len) / d;
          if (i === 1) {
            b.x -= dx * diff;
            b.y -= dy * diff;
          } else {
            a.x += dx * diff * 0.5;
            a.y += dy * diff * 0.5;
            b.x -= dx * diff * 0.5;
            b.y -= dy * diff * 0.5;
          }
        }
      }
    });
  }

  /** 以 (ox, oy) 为原点绘制；节点按整像素量化，保持像素风 */
  draw(ox: number, oy: number, visible: boolean): void {
    const g = this.gfx;
    g.clear();
    g.setVisible(visible);
    if (!visible) return;
    g.setPosition(ox, oy);
    this.tails.forEach((tail, ti) => {
      g.fillStyle(this.colors[ti]!, 1);
      for (let i = 1; i < tail.length; i++) {
        const a = tail[i - 1]!;
        const b = tail[i]!;
        let x0 = Math.round(a.x - ox);
        let y0 = Math.round(a.y - oy);
        const x1 = Math.round(b.x - ox);
        const y1 = Math.round(b.y - oy);
        // Bresenham 画线
        const dx = Math.abs(x1 - x0);
        const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
          g.fillRect(x0, y0, 1, 1);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) {
            err += dy;
            x0 += sx;
          }
          if (e2 <= dx) {
            err += dx;
            y0 += sy;
          }
        }
      }
    });
  }
}
