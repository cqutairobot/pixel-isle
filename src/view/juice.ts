import type { AudioEngine } from '../audio/engine';
import { VIEW_W } from '../platform/display';
import type { SimEvent } from '../sim/events';
import type { World } from '../sim/world';
import { landImpact, type HeroView } from './heroView';
import type { Particles } from './particles';
import type { Shake } from './shake';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * "动效层"：把 sim 事件翻译成粒子、震屏、音效和主角的挤压拉伸。
 * 玩法代码只发事件，所有反馈都集中在这里，方便单独调整。
 */
export class Juice {
  private skidDust = 0;
  private stepAlt = false;

  constructor(
    private particles: Particles,
    private shake: Shake,
    private hero: HeroView,
    private sound: AudioEngine,
    private camX: () => number,
  ) {
    hero.onFootstep = (x, y, ratio) => this.footstep(x, y, ratio);
  }

  private pan(x: number): number {
    return ((x - (this.camX() + VIEW_W / 2)) / (VIEW_W / 2)) * 0.4;
  }

  private dust(
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: 's' | 'm' | 'l',
    life = 0.3,
  ): void {
    const frames =
      size === 'l'
        ? ['fx/dust_l', 'fx/dust_m', 'fx/dust_s']
        : size === 'm'
          ? ['fx/dust_m', 'fx/dust_s']
          : ['fx/dust_s'];
    this.particles.spawn({
      x,
      y,
      vx,
      vy,
      drag: 4,
      gravity: -20,
      life,
      frames,
      flipX: Math.random() < 0.5,
    });
  }

  handle(events: readonly SimEvent[], world: World): void {
    const p = world.player;
    for (const e of events) {
      this.hero.onEvent(e);
      switch (e.type) {
        case 'jump':
          this.sound.play('jump', {
            rate: rnd(0.97, 1.03) * (1 + e.run * 0.05),
            pan: this.pan(e.x),
          });
          this.dust(e.x - 4, e.y - 2, -40, -8, 'm', 0.25);
          this.dust(e.x + 4, e.y - 2, 40, -8, 'm', 0.25);
          break;
        case 'land': {
          const k = landImpact(e.fall);
          if (e.hard) {
            this.sound.play('landHard', { pan: this.pan(e.x) });
            this.shake.add(0.12 + 0.18 * k);
            for (let i = 0; i < 3; i++) {
              this.particles.spawn({
                x: e.x + rnd(-6, 6),
                y: e.y - 2,
                vx: rnd(-50, 50),
                vy: rnd(-90, -50),
                gravity: 400,
                life: 0.45,
                frames: ['fx/chip'],
              });
            }
          } else {
            this.sound.play('land', {
              volume: 0.5 + 0.5 * k,
              rate: rnd(0.95, 1.05),
              pan: this.pan(e.x),
            });
          }
          const n = 2 + Math.round(k * 4);
          for (let i = 0; i < n; i++) {
            const side = i % 2 ? 1 : -1;
            this.dust(
              e.x + side * rnd(2, 6),
              e.y - 2,
              side * rnd(30, 70) * (0.6 + k),
              rnd(-12, -4),
              k > 0.6 ? 'l' : 'm',
              0.3 + k * 0.15,
            );
          }
          break;
        }
        case 'skid':
          this.sound.play('skid', { rate: rnd(0.95, 1.05), pan: this.pan(e.x) });
          for (let i = 0; i < 3; i++)
            this.dust(e.x + e.dir * 4, e.y - 2, e.dir * rnd(20, 60), rnd(-20, -5), 'm');
          break;
        case 'bonk':
          this.sound.play('bonk', { rate: rnd(0.95, 1.05), pan: this.pan(e.x) });
          this.shake.add(0.06);
          this.particles.spawn({ x: e.x, y: e.y - 1, life: 0.12, frames: ['fx/spark'] });
          for (let i = 0; i < 2; i++) {
            this.particles.spawn({
              x: e.x + rnd(-4, 4),
              y: e.y - 1,
              vx: rnd(-30, 30),
              vy: rnd(10, 40),
              gravity: 500,
              life: 0.4,
              frames: ['fx/chip'],
            });
          }
          break;
        case 'wallBump':
          this.sound.play('bonk', { volume: 0.5, rate: 0.8, pan: this.pan(e.x) });
          this.particles.spawn({ x: e.x, y: e.y, life: 0.1, frames: ['fx/spark'] });
          break;
        case 'drop':
          this.sound.play('drop', { pan: this.pan(e.x) });
          this.dust(e.x - 3, e.y, -20, 10, 's');
          this.dust(e.x + 3, e.y, 20, 10, 's');
          break;
        case 'respawn':
          this.sound.play('respawn', { pan: this.pan(e.x) });
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            this.particles.spawn({
              x: e.x + Math.cos(a) * 4,
              y: e.y - 8 + Math.sin(a) * 4,
              vx: Math.cos(a) * 70,
              vy: Math.sin(a) * 70,
              drag: 5,
              life: 0.35,
              frames: ['fx/dot', 'fx/spark'],
            });
          }
          this.hero.resetRibbon(p.body.centerX, p.body.bottom);
          break;
        default:
          break;
      }
    }
  }

  /** 每个渲染帧调用：持续性的效果（急停时连续扬尘） */
  tick(dt: number, world: World): void {
    const p = world.player;
    if (p.skidding && p.onGround) {
      this.skidDust -= dt;
      if (this.skidDust <= 0) {
        this.skidDust = 0.05;
        this.dust(
          p.body.centerX - Math.sign(p.vx) * -4,
          p.body.bottom - 1,
          -p.vx * 0.2,
          rnd(-15, -5),
          's',
          0.25,
        );
      }
    } else {
      this.skidDust = 0;
    }
  }

  footstep(x: number, y: number, ratio: number): void {
    this.stepAlt = !this.stepAlt;
    this.sound.play('step', {
      volume: 0.45 + 0.55 * ratio,
      rate: (this.stepAlt ? 0.94 : 1.06) * rnd(0.98, 1.02),
      pan: this.pan(x),
    });
    if (ratio > 0.85) this.dust(x, y - 1, 0, -6, Math.random() < 0.5 ? 's' : 'm', 0.3);
  }
}
