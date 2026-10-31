import type { AudioEngine } from '../audio/engine';
import { VIEW_W } from '../platform/display';
import { TILE } from '../sim/constants';
import type { SimEvent } from '../sim/events';
import type { World } from '../sim/world';
import { landImpact, type HeroView } from './heroView';
import type { Particles } from './particles';
import type { Shake } from './shake';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** 半音 → 播放速率 */
const semis = (n: number) => Math.pow(2, n / 12);
/** 风铃三个音高：G4、C5、E5（相对 C5） */
const CHIME_RATES = [semis(-5), 1, semis(4)];

/**
 * "动效层"：把 sim 事件翻译成粒子、震屏、音效和主角的挤压拉伸。
 * 玩法代码只发事件，所有反馈都集中在这里，方便单独调整。
 */
export class Juice {
  private skidDust = 0;
  private sunSpark = 0;
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
        case 'stomp':
          this.sound.play('stomp', {
            rate: semis(Math.min(e.combo - 1, 7) * 2),
            pan: this.pan(e.x),
          });
          this.shake.add(0.07);
          this.ring(e.x, e.y - 1, ['fx/dust_s'], 6, 60);
          break;
        case 'enemyDefeat': {
          this.sound.play('shatter', { rate: rnd(0.95, 1.08), pan: this.pan(e.x) });
          this.time(0.12, () =>
            this.sound.play('free', { rate: rnd(0.95, 1.1), pan: this.pan(e.x), volume: 0.8 }),
          );
          // 冰晶碎片四散
          for (let i = 0; i < 7; i++) {
            const a = -Math.PI / 2 + rnd(-1.3, 1.3);
            const sp = rnd(60, 130);
            this.particles.spawn({
              x: e.x + rnd(-3, 3),
              y: e.y - 9,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
              gravity: 520,
              life: rnd(0.45, 0.7),
              frames: [`fx2/shard_${i % 3}`],
              fade: true,
            });
          }
          this.particles.spawn({
            x: e.x,
            y: e.y - 7,
            life: 0.3,
            frames: ['fx2/puff_0', 'fx2/puff_1', 'fx2/puff_2'],
          });
          break;
        }
        case 'enemyLost':
          break;
        case 'hurt':
          this.sound.play('hurt', { pan: this.pan(e.x) });
          this.shake.add(e.dir === 0 ? 0.15 : 0.3);
          for (let i = 0; i < 4; i++)
            this.particles.spawn({
              x: e.x,
              y: e.y,
              vx: rnd(-80, 80),
              vy: rnd(-90, -30),
              gravity: 300,
              life: 0.35,
              frames: ['fx2/sparkle_2', 'fx2/sparkle_1', 'fx2/sparkle_0'],
            });
          break;
        case 'death':
          this.sound.play('death', { pan: this.pan(e.x) });
          this.shake.add(0.35);
          break;
        case 'splash': {
          if (e.big) this.sound.play('splash', { pan: this.pan(e.x) });
          else this.sound.play('splash', { pan: this.pan(e.x), volume: 0.45, rate: 1.4 });
          const n = e.big ? 12 : 5;
          for (let i = 0; i < n; i++) {
            this.particles.spawn({
              x: e.x + rnd(-5, 5),
              y: e.y - 1,
              vx: rnd(-70, 70) * (e.big ? 1 : 0.6),
              vy: rnd(-200, -90) * (e.big ? 1 : 0.6),
              gravity: 700,
              life: rnd(0.4, 0.7),
              frames: [i % 3 === 0 ? 'fx2/drop_big' : 'fx2/drop'],
              depth: 31,
            });
          }
          break;
        }
        case 'blockHit': {
          const x = e.col * TILE + TILE / 2;
          const y = e.row * TILE;
          this.sound.play('bell', { rate: rnd(0.97, 1.04), pan: this.pan(x) });
          this.particles.spawn({
            x,
            y: y - 2,
            life: 0.25,
            frames: ['fx2/sparkle_0', 'fx2/sparkle_2', 'fx2/sparkle_1'],
          });
          this.ring(x, y + 8, ['fx2/ring_0', 'fx2/ring_1', 'fx2/ring_2'], 1, 0, 0.3);
          if (e.item && e.item !== 'shell') this.sound.play('pop', { pan: this.pan(x) });
          break;
        }
        case 'blockEmpty':
          this.sound.play('bonk', { rate: 0.75, pan: this.pan(e.col * TILE) });
          break;
        case 'blockBreak': {
          const x = e.col * TILE + TILE / 2;
          const y = e.row * TILE + TILE / 2;
          this.sound.play('brick', { rate: rnd(0.95, 1.05), pan: this.pan(x) });
          this.shake.add(0.06);
          const dirs = [
            [-1, -1.3],
            [1, -1.3],
            [-1, -0.7],
            [1, -0.7],
          ];
          dirs.forEach(([dx, dy], i) => {
            this.particles.spawn({
              x: x + dx! * 4,
              y: y + (dy! < -1 ? -4 : 4),
              vx: dx! * rnd(50, 80),
              vy: dy! * rnd(150, 190),
              gravity: 800,
              life: 0.9,
              frames: ['block/frag_0', 'block/frag_1', 'block/frag_2', 'block/frag_3'],
              fps: 14 + i * 2,
              flipX: dx! < 0,
            });
          });
          for (let i = 0; i < 3; i++)
            this.dust(x + rnd(-6, 6), y + 6, rnd(-30, 30), rnd(-20, -5), 'm', 0.35);
          break;
        }
        case 'blockReveal': {
          const x = e.col * TILE + TILE / 2;
          const y = e.row * TILE + TILE / 2;
          this.sound.play('reveal', { pan: this.pan(x) });
          this.ring(x, y, ['fx2/ring_1', 'fx2/ring_2', 'fx2/ring_3'], 1, 0, 0.35);
          this.ring(x, y, ['fx2/sparkle_2', 'fx2/sparkle_1'], 6, 70);
          break;
        }
        case 'itemSpawn':
          break;
        case 'collect': {
          if (e.kind === 'shell') {
            this.sound.play('shell', {
              rate: semis(Math.min(e.chain, 12)),
              pan: this.pan(e.x),
              volume: 0.9,
            });
            if (e.fromBlock) {
              // 从砖里顶出来的贝壳：往上一跳再消失
              this.particles.spawn({
                x: e.x,
                y: e.y - 6,
                vy: -170,
                gravity: 520,
                life: 0.42,
                frames: ['item/shell_0', 'item/shell_1', 'item/shell_2', 'item/shell_3'],
                fps: 16,
                fade: true,
              });
            }
          } else if (e.kind === 'bigShell') this.sound.play('bigShell', { pan: this.pan(e.x) });
          else if (e.kind === 'mango')
            this.sound.play(e.shells ? 'shell' : 'heal', { pan: this.pan(e.x) });
          else if (e.kind === 'sun') this.sound.play('sun', { pan: this.pan(e.x) });
          else if (e.kind === 'glass') this.sound.play('glass', { pan: this.pan(e.x) });
          this.particles.spawn({
            x: e.x,
            y: e.y,
            life: 0.3,
            frames: ['fx2/sparkle_2', 'fx2/sparkle_1', 'fx2/sparkle_0'],
          });
          if (e.kind !== 'shell') this.ring(e.x, e.y, ['fx2/sparkle_1', 'fx2/sparkle_0'], 8, 80);
          break;
        }
        case 'heal':
          for (let i = 0; i < 5; i++)
            this.particles.spawn({
              x: p.body.centerX + rnd(-6, 6),
              y: p.body.y + rnd(0, 6),
              vy: rnd(-50, -30),
              vx: rnd(-10, 10),
              life: 0.7,
              frames: ['fx2/heart'],
              fade: true,
            });
          break;
        case 'checkpoint':
          this.sound.play('checkpoint', { pan: this.pan(e.x) });
          this.ring(
            e.x,
            e.y - 30,
            ['fx2/ring_0', 'fx2/ring_1', 'fx2/ring_2', 'fx2/ring_3'],
            1,
            0,
            0.4,
          );
          this.ring(e.x, e.y - 30, ['fx2/sparkle_2', 'fx2/sparkle_1', 'fx2/sparkle_0'], 8, 90);
          break;
        case 'chime':
          this.sound.play('chime', { rate: CHIME_RATES[e.index] ?? 1, pan: this.pan(e.x) });
          this.particles.spawn({
            x: e.x,
            y: e.y,
            life: 0.3,
            frames: ['fx2/sparkle_1', 'fx2/sparkle_0'],
          });
          // 飘起一个和风铃同色的音符
          this.particles.spawn({
            x: e.x + rnd(-3, 3),
            y: e.y - 6,
            vx: rnd(-12, 12),
            vy: -34,
            drag: 0.6,
            life: 0.9,
            frames: [`fx2/note_${e.index}`],
            fade: true,
            depth: 21,
          });
          break;
        case 'chimeSolved': {
          // 早安歌：把"大、小、中、大"再奏一遍，音符一个个飘起来
          const x = e.x;
          const y = e.y;
          [0, 2, 1, 0].forEach((k, i) =>
            this.time(0.18 + i * 0.16, () => {
              this.sound.play('chime', { rate: CHIME_RATES[k] ?? 1, pan: this.pan(x) });
              this.particles.spawn({
                x: x - 18 + i * 12,
                y: y - 2,
                vx: rnd(-6, 6),
                vy: -40,
                drag: 0.5,
                life: 1.2,
                frames: [`fx2/note_${k}`],
                fade: true,
                depth: 21,
              });
            }),
          );
          this.sound.play('pop', { pan: this.pan(x) });
          this.ring(x, y, ['fx2/sparkle_2', 'fx2/sparkle_1', 'fx2/sparkle_0'], 10, 100);
          break;
        }
        case 'clear':
          this.sound.play('clear');
          for (let i = 0; i < 26; i++) {
            const k = ['g', 'y', 'r'][i % 3]!;
            this.particles.spawn({
              x: p.body.centerX + rnd(-90, 90),
              y: p.body.y - rnd(60, 110),
              vx: rnd(-20, 20),
              vy: rnd(10, 50),
              gravity: 30,
              life: rnd(1.6, 2.4),
              frames: [`fx2/leaf${k}_0`, `fx2/leaf${k}_1`, `fx2/leaf${k}_2`, `fx2/leaf${k}_1`],
              fps: rnd(5, 9),
              fade: true,
            });
          }
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

  /** 一圈向外散开的粒子 */
  private ring(x: number, y: number, frames: string[], n: number, speed: number, life = 0.3): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.particles.spawn({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed * 0.6,
        drag: 4,
        life,
        frames,
      });
    }
  }

  private timers: Array<{ t: number; fn: () => void }> = [];
  /** 延迟一点再播（音效错开） */
  private time(t: number, fn: () => void): void {
    this.timers.push({ t, fn });
  }

  /** 每个渲染帧调用：持续性的效果（急停时连续扬尘、太阳果光环） */
  tick(dt: number, world: World): void {
    this.timers = this.timers.filter((tm) => {
      tm.t -= dt;
      if (tm.t > 0) return true;
      tm.fn();
      return false;
    });
    const p = world.player;
    if (world.sunTimer > 0) {
      this.sunSpark -= dt;
      if (this.sunSpark <= 0) {
        this.sunSpark = 0.06;
        this.particles.spawn({
          x: p.body.centerX + rnd(-7, 7),
          y: p.body.y + rnd(0, 14),
          vx: rnd(-10, 10),
          vy: rnd(-40, -15),
          life: 0.4,
          frames: ['fx2/sparkle_1', 'fx2/sparkle_0'],
          depth: 9,
        });
      }
    }
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
