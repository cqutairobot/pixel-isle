import type Phaser from 'phaser';
import { HERO_H, HERO_HAT_DY, HERO_W, RIBBON_ANCHOR } from '../art/hero';
import type { SimEvent } from '../sim/events';
import { clamp01 } from '../sim/math';
import type { Player } from '../sim/player';
import type { Tuning } from '../sim/tuning';
import { Ribbon } from './ribbon';
import { Spring } from './spring';
import { ATLAS } from './textures';

/** 落地冲击（0.15–1）：下落 6 格及以上为 1 */
export function landImpact(fall: number): number {
  return Math.max(0.15, clamp01(fall / 96));
}

/**
 * 小满的表现层：根据 sim 状态选帧、做挤压拉伸、眨眼、跑步节奏与脚步同步、帽带飘动。
 * 精灵原点在脚底中心。
 */
export class HeroView {
  readonly sprite: Phaser.GameObjects.Image;
  readonly ribbon: Ribbon;
  private sx = new Spring(1, 650, 18);
  private sy = new Spring(1, 650, 18);
  private runPhase = 0;
  private lastRunFrame = -1;
  private idleTime = 0;
  private blinkTimer = 2.5;
  private blinkLeft = 0;
  private fallTime = 0;
  private landTimer = 0;
  private lastFacing = 1;
  private flicker = 0;
  private frame = 'idle_0';
  /** 跑步动画里脚着地的那一帧回调（播放脚步声、扬尘） */
  onFootstep?: (x: number, y: number, ratio: number) => void;

  constructor(scene: Phaser.Scene) {
    this.ribbon = new Ribbon(scene);
    this.sprite = scene.add.image(0, 0, ATLAS, 'hero/idle_0').setOrigin(0.5, 1);
  }

  get currentFrame(): string {
    return this.frame;
  }

  onEvent(e: SimEvent): void {
    switch (e.type) {
      case 'jump':
        this.sx.set(0.78);
        this.sy.set(1.24);
        break;
      case 'land': {
        // 挤压幅度按下落距离：小跳轻微、满跳明显、高处坠落最强
        const k = landImpact(e.fall);
        this.sx.set(1 + 0.25 * k);
        this.sy.set(1 - 0.22 * k);
        if (e.hard || k > 0.6) this.landTimer = e.hard ? 0.12 : 0.06;
        break;
      }
      case 'skid':
        this.sx.set(1.12);
        this.sy.set(0.9);
        break;
      case 'bonk':
        this.sx.set(1.14);
        this.sy.set(0.8);
        break;
      case 'respawn':
        this.flicker = 1;
        this.sx.set(0.6);
        this.sy.set(1.4);
        break;
    }
  }

  /** 每个渲染帧调用。(x, y) 是插值后的脚底中心坐标。 */
  update(dt: number, p: Player, t: Tuning, x: number, y: number, visible: boolean): void {
    if (p.facing !== this.lastFacing) {
      if (p.onGround) this.sx.set(0.72);
      this.lastFacing = p.facing;
    }
    this.frame = this.pickFrame(dt, p, t, x, y);
    const s = this.sprite;
    s.setFrame(`hero/${this.frame}`);
    s.setFlipX(p.facing < 0);
    const scaleX = this.sx.update(dt);
    const scaleY = this.sy.update(dt);
    s.setScale(scaleX, scaleY);
    s.setPosition(x, y);
    if (this.flicker > 0) this.flicker -= dt;
    const shown = visible && (this.flicker <= 0 || Math.floor(this.flicker * 15) % 2 === 0);
    s.setVisible(shown);

    // 帽带结的位置：随朝向镜像、随挤压拉伸缩放、随帽子上下
    const hatDy = HERO_HAT_DY[this.frame] ?? 0;
    const localX = p.facing > 0 ? RIBBON_ANCHOR.x + 0.5 : HERO_W - RIBBON_ANCHOR.x - 0.5;
    const ax = x + (localX - HERO_W / 2) * scaleX;
    const ay = y + (RIBBON_ANCHOR.y + hatDy + 0.5 - HERO_H) * scaleY;
    this.ribbon.update(ax, ay, p.facing, p.vx, p.vy, dt);
    this.ribbon.draw(Math.round(x), Math.round(y), shown);
  }

  resetRibbon(x: number, y: number): void {
    this.ribbon.reset(x, y - HERO_H + RIBBON_ANCHOR.y);
  }

  private pickFrame(dt: number, p: Player, t: Tuning, x: number, y: number): string {
    const speed = Math.abs(p.vx);
    if (!p.onGround) {
      this.fallTime += dt;
      this.idleTime = 0;
      if (p.vy < -60) return 'jump';
      if (p.vy < 60) return 'apex';
      return Math.floor(this.fallTime * 10) % 2 ? 'fall_1' : 'fall_0';
    }
    this.fallTime = 0;
    if (this.landTimer > 0) {
      this.landTimer -= dt;
      return 'land';
    }
    if (p.crouching) return 'crouch';
    if (p.lookingUp) return 'look_up';
    if (p.skidding) return 'skid';
    if (speed > 8) {
      this.idleTime = 0;
      const ratio = clamp01(speed / t.runSpeed);
      this.runPhase += dt * (6 + 10 * ratio);
      const idx = Math.floor(this.runPhase) % 6;
      if (idx !== this.lastRunFrame) {
        if (idx === 0 || idx === 3)
          this.onFootstep?.(
            x,
            y,
            clamp01((speed - t.walkSpeed * 0.5) / (t.runSpeed - t.walkSpeed * 0.5)),
          );
        this.lastRunFrame = idx;
      }
      return `run_${idx}`;
    }
    this.runPhase = 0;
    this.lastRunFrame = -1;
    this.idleTime += dt;
    const breath = Math.floor(this.idleTime * 1.6) % 2;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkLeft = 0.12;
      this.blinkTimer = 2 + Math.random() * 3;
    }
    if (this.blinkLeft > 0) {
      this.blinkLeft -= dt;
      if (breath === 0) return 'blink';
    }
    return breath ? 'idle_1' : 'idle_0';
  }
}
