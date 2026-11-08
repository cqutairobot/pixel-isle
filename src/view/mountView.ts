import type Phaser from 'phaser';
import { RULES } from '../sim/tuning';
import type { World } from '../sim/world';
import type { Particles } from './particles';
import { ATLAS } from './textures';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 过场里由导演摆布的小满：骑没骑着咩铃 */
export interface MountPuppet {
  x: number;
  y: number;
  facing: 1 | -1;
  mounted: boolean;
  vx: number;
}

interface Ghost {
  goat: Phaser.GameObjects.Image;
  hero: Phaser.GameObjects.Image;
  t: number;
}

/** 骑着时小满画在咩铃背上：脚底比咩铃脚底高这么多，往身后挪这么多 */
export const SADDLE_DY = 7;
export const SADDLE_DX = 2;

/**
 * 咩铃的表现层（docs/levels/1-3.md §3）：
 * - 被骑着时画在小满脚下（小满由 HeroView 画在她背上），帧跟着小满的状态：跑、跳、蓄力、冲刺、晕；
 * - 没人骑时跟着 sim 里的 Goat：站着嚼草、受惊乱跑、蹦回来、在羊圈里跺脚、被摸时眯眼；
 * - 冲刺时身后留下几道残影；撞墙晕的时候头上转星星；
 * - 跑步时每落一次蹄子回调 onStep（铃铛叮当声跟着步伐）。
 * 精灵原点在脚底中心，默认朝右。
 */
export class MountView {
  readonly sprite: Phaser.GameObjects.Image;
  private ghosts: Ghost[] = [];
  private time = 0;
  private phase = 0;
  private lastStep = -1;
  private ghostT = 0;
  private starT = 0;
  private lastX = 0;
  /** 跑步时每落一次蹄子（x、y 是脚底，speed 是 0–1 的速度比例） */
  onStep?: (x: number, y: number, speed: number) => void;
  /** 过场里咩铃换成演出精灵时，把关卡里的这一只藏起来 */
  hidden = false;

  constructor(
    private scene: Phaser.Scene,
    private world: World,
    private particles: Particles,
    private hero: Phaser.GameObjects.Image,
  ) {
    this.sprite = scene.add
      .image(0, 0, ATLAS, 'goat/idle_0')
      .setOrigin(0.5, 1)
      .setDepth(8.5)
      .setVisible(!!world.goat);
  }

  /** 头顶（表情气泡、提示"↑"的位置） */
  get headPos(): { x: number; y: number } | null {
    if (!this.world.goat || !this.sprite.visible) return null;
    return { x: this.sprite.x + (this.sprite.flipX ? -6 : 6), y: this.sprite.y - 20 };
  }

  /**
   * 每个渲染帧调用。(hx, hy) 是小满插值后的脚底中心；heroVisible：小满这一帧画不画出来；
   * puppet：过场里小满由导演摆布时传进来。
   */
  update(
    dt: number,
    alpha: number,
    hx: number,
    hy: number,
    heroVisible: boolean,
    puppet: MountPuppet | null,
  ): void {
    this.time += dt;
    const w = this.world;
    const g = w.goat;
    const s = this.sprite;
    if (!g) {
      s.setVisible(false);
      return;
    }
    const p = w.player;
    const ridden = puppet ? puppet.mounted : !!p.ride;
    let x: number;
    let y: number;
    let facing: 1 | -1;
    let frame: string;
    if (ridden) {
      x = puppet ? puppet.x : hx;
      y = puppet ? puppet.y : hy;
      facing = puppet ? puppet.facing : p.facing;
      s.setVisible(puppet ? true : heroVisible);
      frame = puppet ? this.runFrame(puppet.vx, dt, x, y) : this.riddenFrame(dt, x, y);
    } else {
      const b = g.body;
      x = lerp(b.px + b.w / 2, b.centerX, alpha);
      y = lerp(b.py + b.h, b.bottom, alpha);
      facing = g.facing;
      s.setVisible(g.mode !== 'ridden');
      frame = this.freeFrame(dt, x, y);
    }
    s.setFrame(`goat/${frame}`)
      .setFlipX(facing < 0)
      .setPosition(Math.round(x), Math.round(y));
    if (this.hidden) s.setVisible(false);
    // 冲刺：身后留残影
    const r = p.ride;
    if (ridden && !puppet && r && r.dash > 0) {
      this.ghostT -= dt;
      if (this.ghostT <= 0) {
        this.ghostT = 0.05;
        this.addGhost();
      }
    }
    // 撞墙晕了：头上转星星
    if (ridden && !puppet && w.stun > 0 && r && r.cooldown > 0) {
      this.starT -= dt;
      if (this.starT <= 0) {
        this.starT = 0.1;
        const a = this.time * 9;
        this.particles.spawn({
          x: x + facing * 7 + Math.cos(a) * 6,
          y: y - 20 + Math.sin(a) * 2,
          life: 0.3,
          frames: ['fx2/sparkle_1', 'fx2/sparkle_0'],
          depth: 12,
        });
      }
    }
    this.updateGhosts(dt);
  }

  /** 被骑着：跟着小满的状态选帧 */
  private riddenFrame(dt: number, x: number, y: number): string {
    const w = this.world;
    const p = w.player;
    const r = p.ride!;
    if (w.stun > 0 && r.cooldown > 0) return 'dizzy';
    if (r.windup > 0) return Math.floor(this.time * 16) % 2 ? 'windup_1' : 'windup_0';
    if (r.dash > 0 && p.onGround) return Math.floor(this.time * 18) % 2 ? 'dash_1' : 'dash_0';
    if (!p.onGround) return p.vy < -40 ? 'jump' : r.dash > 0 ? 'dash_0' : 'fall';
    return this.runFrame(p.vx, dt, x, y);
  }

  /** 地上：速度够快就跑，否则站着（偶尔眨眼、低头嚼草） */
  private runFrame(vx: number, dt: number, x: number, y: number): string {
    const speed = Math.abs(vx);
    if (speed > 8) {
      // 一步跑 4 帧，按走过的距离推进，蹄子和速度同步
      this.phase += (speed * dt) / 9;
      const idx = Math.floor(this.phase) % 4;
      if (idx !== this.lastStep) {
        if (idx === 0 || idx === 2) this.onStep?.(x, y, Math.min(1, speed / 165));
        this.lastStep = idx;
      }
      return `run_${idx}`;
    }
    this.phase = 0;
    this.lastStep = -1;
    if (this.time % 3.7 < 0.12) return 'blink';
    return Math.floor(this.time * 1.3) % 2 ? 'idle_1' : 'idle_0';
  }

  /** 没人骑：按 sim 里咩铃的状态选帧 */
  private freeFrame(dt: number, x: number, y: number): string {
    const g = this.world.goat!;
    const dx = x - this.lastX;
    this.lastX = x;
    switch (g.mode) {
      case 'trapped':
        // 被冻在羊圈里：不服气地跺脚
        return Math.floor(this.time * 2.5) % 3 === 0 ? 'stamp_1' : 'stamp_0';
      case 'flee':
        return Math.floor(this.time * 14) % 2 ? 'flee_1' : 'flee_0';
      case 'leap':
        return g.modeFrames < RULES.goatLeapFrames / 2 ? 'jump' : 'fall';
      default:
        if (g.petTimer > 0) return 'happy';
        return this.runFrame(dx / Math.max(dt, 1e-3), dt, x, y);
    }
  }

  private addGhost(): void {
    const mk = (src: Phaser.GameObjects.Image) =>
      this.scene.add
        .image(src.x, src.y, ATLAS, src.frame.name)
        .setOrigin(src.originX, src.originY)
        .setFlipX(src.flipX)
        .setDepth(8)
        .setTint(0x9fb8ff)
        .setAlpha(0.45);
    this.ghosts.push({ goat: mk(this.sprite), hero: mk(this.hero), t: 0.2 });
  }

  private updateGhosts(dt: number): void {
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const gh = this.ghosts[i]!;
      gh.t -= dt;
      const a = Math.max(0, gh.t / 0.2) * 0.45;
      gh.goat.setAlpha(a);
      gh.hero.setAlpha(a);
      if (gh.t <= 0) {
        gh.goat.destroy();
        gh.hero.destroy();
        this.ghosts.splice(i, 1);
      }
    }
  }
}
