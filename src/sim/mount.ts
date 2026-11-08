import { Body } from './body';
import { DT } from './constants';
import type { Grid } from './grid';
import { derive, PRESETS, RULES, type Derived, type Tuning } from './tuning';

/**
 * 坐骑咩铃（docs/levels/1-3.md §3）。
 *
 * 骑乘是小满的一个状态（Player.ride）：换一套手感参数和更高的碰撞盒，多了二段跳和冲撞。
 * 没人骑的时候，咩铃是关卡里一个单独的实体（Goat）：在原地等、受惊蹦开、走散了自己找回来。
 */

/** 骑乘手感：一走就是全速（小满跑速 150 的 1.1 倍），约 6 帧到全速；第一跳最高 4.5 格 */
export const MOUNT_TUNING: Tuning = {
  ...PRESETS.A.tuning,
  walkSpeed: 165,
  runSpeed: 165,
  runDelayFrames: 0,
  accelFramesToWalk: 6,
  accelFramesWalkToRun: 1,
  decelFramesFromWalk: 6,
  airAccelMul: 0.7,
  jumpHeightTiles: 4.5,
  jumpTimeToApex: 0.37,
  runJumpBonus: 0,
};

export const MOUNT_DERIVED: Derived = derive(MOUNT_TUNING);

/** 骑着咩铃时的状态 */
export interface RideState {
  /** 这次腾空还能二段跳几次（落地、踩到敌人后恢复） */
  airJumps: number;
  /** 冲撞蓄力还剩几帧（大于 0 时在蓄力：停下来低头刨地） */
  windup: number;
  /** 冲刺还剩几帧（地上或空中；大于 0 时速度固定、不能转身、能撞碎裂岩） */
  dash: number;
  dashDir: 1 | -1;
  /** 冲完以后的冷却 */
  cooldown: number;
}

export function newRide(): RideState {
  return { airJumps: RULES.rideAirJumps, windup: 0, dash: 0, dashDir: 1, cooldown: 0 };
}

/**
 * 咩铃没人骑时的样子：
 * - trapped：被冰晶冻在羊圈里（开场）
 * - idle：原地等着
 * - ridden：被骑着（位置跟着小满）
 * - flee：被撞下来时受惊蹦开，到崖边会回头，不会掉下去
 * - leap：从画面边上一个大跳蹦回小满身边（或者在空中被撞下来时跳回安全的地方），不碰地形
 * - home：结尾留在谷雨身边，能摸，不能骑
 */
export type GoatMode = 'trapped' | 'idle' | 'ridden' | 'flee' | 'leap' | 'home';

/** 这一步里值得表现层知道的变化 */
export type GoatCue = 'calm' | 'land' | null;

export class Goat {
  readonly body: Body;
  mode: GoatMode;
  facing: 1 | -1;
  vx = 0;
  vy = 0;
  onGround = false;
  /** 当前状态已经持续的帧数 */
  modeFrames = 0;
  /** 离开画面多少帧了（走散了自己找回来） */
  offscreen = 0;
  /** 下来、被撞下来以后，多少帧内落到背上不算骑上 */
  lock = 0;
  /** 被摸的动画还剩几帧（表现层用） */
  petTimer = 0;
  /** 走过的距离（表现层用来选跑步帧） */
  walked = 0;
  cue: GoatCue = null;
  private leapPath = { x0: 0, y0: 0, x1: 0, y1: 0, h: 0 };

  constructor(feetX: number, feetY: number, facing: 1 | -1, mode: GoatMode) {
    this.body = new Body(0, 0, RULES.goatW, RULES.goatH);
    this.facing = facing;
    this.mode = mode;
    this.placeFeet(feetX, feetY);
  }

  /** 把脚底中心放到 (x, y)，清空运动状态 */
  placeFeet(x: number, y: number): void {
    this.body.place(Math.round(x - this.body.w / 2), Math.round(y) - this.body.h);
    this.vx = 0;
    this.vy = 0;
  }

  /** 现在能不能骑上去 */
  get rideable(): boolean {
    return (this.mode === 'idle' || this.mode === 'flee') && this.lock === 0;
  }

  setMode(m: GoatMode): void {
    this.mode = m;
    this.modeFrames = 0;
  }

  /** 受惊：往 dir 方向蹦开 */
  flee(dir: 1 | -1): void {
    this.facing = dir;
    this.setMode('flee');
  }

  /** 从 (x0, y0) 跳到 (x1, y1)（都是脚底中心），中途最高比两端高出 h 像素 */
  leap(x0: number, y0: number, x1: number, y1: number, h = 40): void {
    this.leapPath = { x0, y0, x1, y1, h };
    this.facing = x1 >= x0 ? 1 : -1;
    this.placeFeet(x0, y0);
    this.onGround = false;
    this.setMode('leap');
  }

  step(grid: Grid): void {
    this.cue = null;
    this.modeFrames++;
    if (this.lock > 0) this.lock--;
    if (this.petTimer > 0) this.petTimer--;
    switch (this.mode) {
      case 'trapped':
      case 'ridden':
        return;
      case 'leap': {
        const p = this.leapPath;
        const t = Math.min(1, this.modeFrames / RULES.goatLeapFrames);
        const x = p.x0 + (p.x1 - p.x0) * t;
        const y = p.y0 + (p.y1 - p.y0) * t - p.h * 4 * t * (1 - t);
        const b = this.body;
        b.x = Math.round(x - b.w / 2);
        b.y = Math.round(y) - b.h;
        this.walked += Math.abs(p.x1 - p.x0) / RULES.goatLeapFrames;
        if (t >= 1) {
          this.onGround = true;
          this.setMode('idle');
          this.cue = 'land';
        }
        return;
      }
      default:
        this.stepGround(grid);
    }
  }

  /** 在地上：受惊时跑，平时站着；有重力，到崖边回头 */
  private stepGround(grid: Grid): void {
    const b = this.body;
    if (this.mode === 'flee') {
      if (this.onGround) {
        const probe = this.facing > 0 ? b.right : b.x - 1;
        if (!grid.standableAt(probe, b.bottom)) this.facing = this.facing > 0 ? -1 : 1;
      }
      this.vx = this.facing * RULES.goatFleeSpeed;
      if (this.modeFrames >= RULES.goatFleeFrames) {
        this.vx = 0;
        this.setMode('idle');
        this.cue = 'calm';
      }
    } else this.vx = 0;
    this.vy = Math.min(this.vy + RULES.enemyGravity * DT, RULES.enemyMaxFall);
    const x0 = b.x;
    if (b.moveX(this.vx * DT, (x, y) => grid.solidAt(x, y, b.w, b.h)))
      this.facing = this.facing > 0 ? -1 : 1;
    this.walked += Math.abs(b.x - x0);
    const hitY = b.moveY(this.vy * DT, (x, y, sign) => {
      if (grid.solidAt(x, y, b.w, b.h)) return true;
      return sign > 0 && grid.oneWayTopAt(x, y + b.h - 1, b.w);
    });
    if (hitY) this.vy = 0;
    this.onGround =
      this.vy >= 0 &&
      (grid.solidAt(b.x, b.y + 1, b.w, b.h) || grid.oneWayTopAt(b.x, b.bottom, b.w));
    if (this.onGround) {
      this.vy = 0;
      b.ry = 0;
    }
  }
}
