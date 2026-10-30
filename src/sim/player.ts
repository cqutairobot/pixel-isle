import { Body } from './body';
import { DT } from './constants';
import type { SimEvent } from './events';
import type { Grid } from './grid';
import { BTN, isHeld, isPressed, type InputFrame } from './input';
import { approach, clamp01 } from './math';
import type { Derived, Tuning } from './tuning';

export const PLAYER_W = 10;
export const PLAYER_H = 14;
/** 下落多少像素算重落地（6 格） */
export const HARD_LANDING_FALL = 96;

/** 主角每一步需要的外部环境 */
export interface PlayerEnv {
  grid: Grid;
  tuning: Tuning;
  derived: Derived;
  autoRun: boolean;
  emit(e: SimEvent): void;
}

/** 主角控制器。所有手感规则见 PLAN.md §6.2–6.4。 */
export class Player {
  readonly body: Body;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  onGround = false;
  /** 土狼时间剩余帧数 */
  coyote = 0;
  /** 跳跃缓冲剩余帧数 */
  buffer = 0;
  /** 正处于一次可以被"松开跳跃键"截断的上升中 */
  jumpCuttable = false;
  /** 下穿单向平台的剩余帧数 */
  dropTimer = 0;
  running = false;
  /** 连续按住同一方向的帧数（长按方向奔跑） */
  dirHeldFrames = 0;
  private lastDir = 0;
  skidding = false;
  crouching = false;
  lookingUp = false;
  crouchFrames = 0;
  lookUpFrames = 0;
  airFrames = 0;
  groundFrames = 0;
  /** 本次腾空到过的最高点（脚底 y），用来算下落距离 */
  peakBottom: number;
  /** 最近一次稳稳站着的位置，掉坑后回到这里 */
  lastSafeX: number;
  lastSafeY: number;

  constructor(x: number, y: number) {
    this.body = new Body(x, y, PLAYER_W, PLAYER_H);
    this.peakBottom = this.body.bottom;
    this.lastSafeX = x;
    this.lastSafeY = y;
  }

  /** 传送到 (x, y)，清空所有运动状态 */
  reset(x: number, y: number): void {
    const b = this.body;
    b.x = x;
    b.y = y;
    b.rx = 0;
    b.ry = 0;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.coyote = 0;
    this.buffer = 0;
    this.jumpCuttable = false;
    this.dropTimer = 0;
    this.skidding = false;
    this.dirHeldFrames = 0;
    this.lastDir = 0;
    this.airFrames = 0;
    this.groundFrames = 0;
    this.peakBottom = b.bottom;
  }

  /** 水平速度在走速与跑速之间的比例（0–1），镜头与动画会用到 */
  speedRatio(t: Tuning): number {
    return clamp01((Math.abs(this.vx) - t.walkSpeed) / Math.max(1, t.runSpeed - t.walkSpeed));
  }

  step(input: InputFrame, env: PlayerEnv): void {
    const t = env.tuning;
    const d = env.derived;
    const g = env.grid;
    const b = this.body;

    const left = isHeld(input, BTN.left);
    const right = isHeld(input, BTN.right);
    const up = isHeld(input, BTN.up);
    const down = isHeld(input, BTN.down);
    const jumpHeld = isHeld(input, BTN.jump);
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    this.dirHeldFrames =
      dir !== 0 && dir === this.lastDir ? this.dirHeldFrames + 1 : dir !== 0 ? 1 : 0;
    this.lastDir = dir;
    // 奔跑状态只在地面上更新，空中保持起跳时的状态，跳跃弧线才可预测
    if (this.onGround || env.autoRun)
      this.running = env.autoRun || this.dirHeldFrames > t.runDelayFrames;

    if (isPressed(input, BTN.jump)) this.buffer = t.bufferFrames;
    if (this.dropTimer > 0) this.dropTimer--;

    // 地面姿态
    this.crouching = this.onGround && down;
    this.lookingUp = this.onGround && up && !down && Math.abs(this.vx) < 10;
    this.crouchFrames = this.crouching ? this.crouchFrames + 1 : 0;
    this.lookUpFrames = this.lookingUp ? this.lookUpFrames + 1 : 0;
    if (dir !== 0) this.facing = dir > 0 ? 1 : -1;
    const moveDir = this.crouching ? 0 : dir;

    // 起跳 / 下穿
    let jumped = false;
    let dropped = false;
    if (this.buffer > 0) {
      if (this.onGround && down && this.onOneWayOnly(g)) {
        this.dropTimer = 12;
        this.buffer = 0;
        this.onGround = false;
        this.coyote = 0;
        b.y += 1;
        dropped = true;
        env.emit({ type: 'drop', x: b.centerX, y: b.bottom });
      } else if (this.onGround || this.coyote > 0) {
        this.doJump(env);
        jumped = true;
      }
    }

    // 可变跳跃：上升中松开跳跃键，上升速度打折（只发生一次）
    if (this.jumpCuttable && this.vy < 0 && !jumpHeld) {
      this.vy *= t.jumpCutMul;
      this.jumpCuttable = false;
    }
    if (this.vy >= 0) this.jumpCuttable = false;

    // 急停判定用进入这一步时的速度
    const vxOld = this.vx;
    const skidNow =
      this.onGround &&
      moveDir !== 0 &&
      vxOld !== 0 &&
      Math.sign(vxOld) !== moveDir &&
      Math.abs(vxOld) > t.skidThreshold;
    if (skidNow && !this.skidding)
      env.emit({ type: 'skid', x: b.centerX, y: b.bottom, dir: moveDir });
    this.skidding = skidNow;

    this.updateHorizontal(moveDir, t, d);

    // 重力：下落更重；顶点附近按住跳跃时更轻
    if (this.onGround && !jumped && this.vy > 0) this.vy = 0;
    const vyOld = this.vy;
    let grav = d.gravity;
    if (this.vy > 0) grav *= t.fallGravityMul;
    if (!this.onGround && jumpHeld && Math.abs(this.vy) < t.apexThreshold) grav *= t.apexGravityMul;
    const maxFall = down ? t.maxFall * t.fastFallMul : t.maxFall;
    this.vy = Math.min(this.vy + grav * DT, maxFall);

    // 梯形积分：匀加速下位移精确，跳跃高度与推导值一致
    const dx = ((vxOld + this.vx) / 2) * DT;
    const dy = ((vyOld + this.vy) / 2) * DT;

    const blockedX = (x: number, y: number) => g.solidAt(x, y, b.w, b.h);
    const hitX = b.moveX(dx, blockedX, (sign) => this.tryLedgeAssist(sign, env));
    if (hitX) {
      if (Math.abs(this.vx) > 60) {
        env.emit({
          type: 'wallBump',
          x: this.vx > 0 ? b.x + b.w : b.x,
          y: b.y + b.h / 2,
          dir: Math.sign(this.vx),
        });
      }
      this.vx = 0;
    }

    const blockedY = (x: number, y: number, sign: number) => {
      if (g.solidAt(x, y, b.w, b.h)) return true;
      return sign > 0 && this.dropTimer === 0 && g.oneWayTopAt(x, y + b.h - 1, b.w);
    };
    const vyBeforeMove = this.vy;
    const hitY = b.moveY(dy, blockedY, (sign) => sign < 0 && this.tryCornerCorrection(env));
    if (hitY) {
      if (dy < 0) {
        if (vyBeforeMove < -30) env.emit({ type: 'bonk', x: b.centerX, y: b.y });
        this.jumpCuttable = false;
      }
      this.vy = 0;
    }

    // 着地检测
    const wasGround = this.onGround;
    this.onGround = this.vy >= 0 && this.groundBelow(g);
    if (!wasGround && this.onGround) {
      const fall = b.bottom - this.peakBottom;
      // 重落地：下落超过 6 格（比最高跳还高），平地上正常跳跃不会触发
      env.emit({
        type: 'land',
        x: b.centerX,
        y: b.bottom,
        vy: vyBeforeMove,
        fall,
        hard: fall >= HARD_LANDING_FALL,
      });
      this.jumpCuttable = false;
      // 跳跃缓冲：落地这一帧就起跳
      if (this.buffer > 0) {
        this.doJump(env);
        jumped = true;
      }
    }

    // 土狼时间
    if (this.onGround) {
      this.coyote = 0;
    } else if (wasGround && !jumped && !dropped) {
      this.coyote = t.coyoteFrames;
      env.emit({ type: 'leaveGround', x: b.centerX, y: b.bottom });
    } else if (this.coyote > 0) {
      this.coyote--;
    }
    if (this.buffer > 0 && !jumped) this.buffer--;

    // 统计与记录
    if (this.onGround) {
      this.groundFrames++;
      this.airFrames = 0;
      this.peakBottom = b.bottom;
      if (this.supportedBothSides(g)) {
        this.lastSafeX = b.x;
        this.lastSafeY = b.y;
      }
    } else {
      this.airFrames++;
      this.groundFrames = 0;
      this.peakBottom = Math.min(this.peakBottom, b.bottom);
    }
  }

  private doJump(env: PlayerEnv): void {
    const t = env.tuning;
    const run = this.speedRatio(t);
    this.vy = -(env.derived.jumpVelocity + t.runJumpBonus * run);
    this.onGround = false;
    this.coyote = 0;
    this.buffer = 0;
    this.jumpCuttable = true;
    this.peakBottom = this.body.bottom;
    env.emit({ type: 'jump', x: this.body.centerX, y: this.body.bottom, run });
  }

  private updateHorizontal(dir: number, t: Tuning, d: Derived): void {
    const top = this.running ? t.runSpeed : t.walkSpeed;
    let vx = this.vx;
    if (this.onGround) {
      if (dir !== 0) {
        if (vx !== 0 && Math.sign(vx) !== dir) {
          vx = approach(vx, 0, d.groundDecel * t.turnDecelMul * DT);
        } else {
          let s = Math.abs(vx);
          if (s < t.walkSpeed) s = Math.min(s + d.groundAccel * DT, top);
          else if (s < top) s = Math.min(s + d.runAccel * DT, top);
          else if (s > top) s = Math.max(s - d.groundDecel * 0.35 * DT, top);
          vx = dir * s;
        }
      } else {
        vx = approach(vx, 0, d.groundDecel * DT);
      }
    } else {
      const airAccel = d.groundAccel * t.airAccelMul;
      if (dir !== 0) {
        if (vx === 0 || Math.sign(vx) === dir) {
          // 已经超过上限时保持惯性，不主动减速
          if (Math.abs(vx) < top) vx = dir * Math.min(Math.abs(vx) + airAccel * DT, top);
        } else {
          vx = approach(vx, dir * top, airAccel * 1.5 * DT);
        }
      } else {
        vx = approach(vx, 0, t.airDrag * DT);
      }
    }
    this.vx = vx;
  }

  /** 撞头修正：上升时头顶擦到方块边缘，尝试左右挪开最多 cornerCorrection 像素 */
  private tryCornerCorrection(env: PlayerEnv): boolean {
    const b = this.body;
    const g = env.grid;
    const prefer = this.vx > 0 ? 1 : this.vx < 0 ? -1 : this.facing;
    for (let o = 1; o <= env.tuning.cornerCorrection; o++) {
      for (const s of [prefer, -prefer]) {
        const nx = b.x + s * o;
        if (!g.solidAt(nx, b.y - 1, b.w, b.h) && !g.solidAt(nx, b.y, b.w, b.h)) {
          b.x = nx;
          env.emit({ type: 'cornerCorrect', dx: s * o });
          return true;
        }
      }
    }
    return false;
  }

  /** 边缘辅助：空中横向撞上平台角、脚底只低一点点时，把人抬上去 */
  private tryLedgeAssist(sign: number, env: PlayerEnv): boolean {
    if (this.onGround || this.vy < -60) return false;
    const b = this.body;
    const g = env.grid;
    for (let o = 1; o <= env.tuning.ledgeAssist; o++) {
      if (!g.solidAt(b.x + sign, b.y - o, b.w, b.h) && !g.solidAt(b.x, b.y - o, b.w, b.h)) {
        b.y -= o;
        env.emit({ type: 'ledgeAssist', dy: o });
        return true;
      }
    }
    return false;
  }

  private groundBelow(g: Grid): boolean {
    const b = this.body;
    if (g.solidAt(b.x, b.y + 1, b.w, b.h)) return true;
    return this.dropTimer === 0 && g.oneWayTopAt(b.x, b.y + b.h, b.w);
  }

  private onOneWayOnly(g: Grid): boolean {
    const b = this.body;
    return !g.solidAt(b.x, b.y + 1, b.w, b.h) && g.oneWayTopAt(b.x, b.y + b.h, b.w);
  }

  private supportedBothSides(g: Grid): boolean {
    const b = this.body;
    const at = (x: number) => g.solidAt(x, b.bottom, 1, 1) || g.oneWayTopAt(x, b.bottom, 1);
    return at(b.x) && at(b.x + b.w - 1);
  }
}
