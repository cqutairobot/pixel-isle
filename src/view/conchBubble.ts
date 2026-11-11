import type Phaser from 'phaser';
import { colorInt } from '../art/palette';
import { ATLAS } from './textures';
import type { Particles } from './particles';

/**
 * 护身海螺的大泡泡（docs/levels/1-3.md §5）：掉下去的那一刻从坑底（水里）冒出一个大泡泡，
 * 把小满（骑着的话连咩铃）包在里面，晃晃悠悠飘回安全的地方，"啵"地破开。
 * 只是表现：什么时候回到地面由 sim 的 respawnTimer 决定，回来的那一刻（respawn 事件）泡泡破开。
 */
export class ConchBubble {
  private root: Phaser.GameObjects.Container | null = null;
  private t = 0;
  private dur = 1;
  private p0 = { x: 0, y: 0 };
  private p1 = { x: 0, y: 0 };
  private p2 = { x: 0, y: 0 };

  constructor(
    private scene: Phaser.Scene,
    private particles: Particles,
  ) {}

  get active(): boolean {
    return !!this.root;
  }

  /** 从 (x, y) 冒出来，dur 秒后飘到 (toX, toY)（脚底）；heroFrame / goatFrame 是泡泡里的人和羊 */
  start(
    x: number,
    y: number,
    toX: number,
    toY: number,
    dur: number,
    heroFrame: string,
    goatFrame: string | null,
    facing: number,
  ): void {
    this.pop(false);
    const s = this.scene;
    const r = goatFrame ? 20 : 14;
    const c = s.add.container(x, y).setDepth(12);
    const g = s.add.graphics();
    g.fillStyle(colorInt('sky'), 0.22).fillCircle(0, 0, r);
    g.lineStyle(1, colorInt('white'), 0.85).strokeCircle(0, 0, r);
    // 高光：左上一小段弧和一个小点
    g.lineStyle(2, colorInt('white'), 0.9).beginPath();
    g.arc(0, 0, r - 4, Math.PI * 1.1, Math.PI * 1.45).strokePath();
    g.fillStyle(colorInt('white'), 0.9).fillCircle(-r * 0.25, -r * 0.62, 1.2);
    if (goatFrame)
      c.add(
        s.add
          .image(0, r - 4, ATLAS, goatFrame)
          .setOrigin(0.5, 1)
          .setFlipX(facing < 0),
      );
    c.add(
      s.add
        .image(0, goatFrame ? r - 15 : r - 3, ATLAS, heroFrame)
        .setOrigin(0.5, 1)
        .setFlipX(facing < 0),
    );
    c.add(g);
    this.root = c;
    this.t = 0;
    this.dur = dur;
    // 先往上冒，再从高处慢慢飘到落脚的地方上方
    this.p0 = { x, y: y - r };
    this.p2 = { x: toX, y: toY - r };
    this.p1 = { x: (x + toX) / 2, y: Math.min(this.p0.y, this.p2.y) - 50 };
  }

  update(dt: number): void {
    const c = this.root;
    if (!c) return;
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const { p0, p1, p2 } = this;
    const x = (1 - e) * (1 - e) * p0.x + 2 * (1 - e) * e * p1.x + e * e * p2.x;
    const y = (1 - e) * (1 - e) * p0.y + 2 * (1 - e) * e * p1.y + e * e * p2.y;
    c.setPosition(Math.round(x), Math.round(y + Math.sin(this.t * 7) * 1.5));
    const wob = Math.sin(this.t * 9) * 0.05;
    c.setScale(1 + wob, 1 - wob);
  }

  /** 泡泡破开（回到地面的那一刻），飞出几颗小水珠 */
  pop(burst = true): void {
    const c = this.root;
    if (!c) return;
    this.root = null;
    if (burst)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        this.particles.spawn({
          x: c.x + Math.cos(a) * 12,
          y: c.y + Math.sin(a) * 12,
          vx: Math.cos(a) * 60,
          vy: Math.sin(a) * 60 - 20,
          frames: ['fx2/sparkle_1', 'fx2/sparkle_0'],
          life: 0.35,
          gravity: 120,
          depth: 12,
        });
      }
    c.destroy();
  }
}
