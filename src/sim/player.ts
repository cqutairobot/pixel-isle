import { Body } from './body';
import { DT, TILE } from './constants';
import type { SimEvent } from './events';
import type { Grid } from './grid';
import { BTN, isHeld, isPressed, type InputFrame } from './input';
import { approach, clamp01 } from './math';
import type { RideState } from './mount';
import { RULES, type Derived, type Tuning } from './tuning';

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
  /** 走速和跑速的倍数（太阳果期间大于 1），不写就是 1 */
  speedMul?: number;
  emit(e: SimEvent): void;
  /**
   * 骑着咩铃冲刺时撞上实心格子：能撞碎的（裂岩、沙岩砖）就撞碎并返回 true，
   * 移动接着往前；撞不碎的返回 false（由世界处理弹回）。
   */
  smash?(x: number, y: number, w: number, h: number): boolean;
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
  /** 最近一次稳稳站着的位置（脚底中心），掉坑后回到这里；换碰撞盒（骑上、下来）也不会错位 */
  safeFeetX: number;
  safeFeetY: number;
  /** 这一步头顶撞到了东西（向上速度够快），世界据此判断顶到了哪块砖 */
  headHit = false;
  /** 这一步开始时脚底的 y，用来判断是不是"从上面踩下来" */
  prevBottom: number;
  /** 骑着咩铃时的状态；徒步时为 null */
  ride: RideState | null = null;
  /** 这一步冲刺撞上了撞不碎的东西（撞的方向 ±1），世界据此弹回 */
  dashBonk = 0;

  constructor(x: number, y: number) {
    this.body = new Body(x, y, PLAYER_W, PLAYER_H);
    this.peakBottom = this.body.bottom;
    this.prevBottom = this.body.bottom;
    this.safeFeetX = this.body.centerX;
    this.safeFeetY = this.body.bottom;
  }

  /** 受伤判定（8×12，比碰撞盒小一圈） */
  hurtbox(): { x: number; y: number; w: number; h: number } {
    const b = this.body;
    return { x: b.x + 1, y: b.y + 2, w: b.w - 2, h: b.h - 2 };
  }

  /** 踩中敌人后弹起；按住跳跃键时可以中途松开截短（和普通跳一样）。骑着时二段跳也恢复 */
  bounce(vy: number, cuttable: boolean): void {
    this.vy = -vy;
    this.onGround = false;
    this.coyote = 0;
    this.jumpCuttable = cuttable;
    if (this.ride) this.ride.airJumps = RULES.rideAirJumps;
  }

  /**
   * 换碰撞盒（骑上、下来），脚底中心放到 (fx, fy)。新位置和实心格子重叠时不换，返回 false。
   * 不留插值痕迹（直接放过去）。
   */
  resize(w: number, h: number, fx: number, fy: number, grid: Grid): boolean {
    const x = Math.round(fx - w / 2);
    const y = Math.round(fy) - h;
    if (grid.solidAt(x, y, w, h)) return false;
    const b = this.body;
    b.w = w;
    b.h = h;
    b.place(x, y);
    this.prevBottom = b.bottom;
    this.peakBottom = b.bottom;
    return true;
  }

  /** 按脚底中心传送 */
  resetFeet(fx: number, fy: number): void {
    const b = this.body;
    this.reset(Math.round(fx - b.w / 2), Math.round(fy) - b.h);
  }

  /** 传送到 (x, y)，清空所有运动状态 */
  reset(x: number, y: number): void {
    const b = this.body;
    b.place(x, y);
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
    this.prevBottom = b.bottom;
    this.headHit = false;
    this.dashBonk = 0;
    const r = this.ride;
    if (r) {
      r.windup = 0;
      r.dash = 0;
      r.cooldown = 0;
      r.airJumps = RULES.rideAirJumps;
    }
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
    this.prevBottom = b.bottom;
    this.headHit = false;
    this.dashBonk = 0;
    const r = this.ride;
    // 冲撞：蓄力结束就开始冲刺（朝蓄力结束时的朝向），冲完进入冷却
    if (r) {
      if (r.windup > 0) {
        r.windup--;
        if (r.windup === 0) {
          r.dash = RULES.chargeFrames;
          r.dashDir = this.facing;
          env.emit({ type: 'dash', x: b.centerX, y: b.bottom, dir: r.dashDir });
        }
      } else if (r.dash > 0) {
        r.dash--;
        if (r.dash === 0) {
          r.cooldown = RULES.chargeCooldown;
          env.emit({ type: 'dashEnd', x: b.centerX, y: b.bottom });
        }
      } else if (r.cooldown > 0) r.cooldown--;
    }
    const dashing = !!r && r.dash > 0;

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

    // 地面姿态（骑着时不蹲）
    this.crouching = this.onGround && down && !r;
    this.lookingUp = this.onGround && up && !down && Math.abs(this.vx) < 10;
    this.crouchFrames = this.crouching ? this.crouchFrames + 1 : 0;
    this.lookUpFrames = this.lookingUp ? this.lookUpFrames + 1 : 0;
    // 冲刺中不能转身
    if (dir !== 0 && !dashing) this.facing = dir > 0 ? 1 : -1;
    const moveDir = this.crouching ? 0 : dir;

    // 起跳 / 下穿 / 二段跳。蓄力时先不跳：按下的跳跃留在缓冲里，冲刺一开始就跳（冲撞跳）
    let jumped = false;
    let dropped = false;
    if (r && r.windup > 0) {
      // 等蓄力结束
    } else if (r && !this.onGround && this.coyote === 0 && isPressed(input, BTN.jump)) {
      if (r.airJumps > 0) {
        this.doAirJump(env);
        jumped = true;
      }
    } else if (this.buffer > 0) {
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
      !(r && (r.windup > 0 || dashing)) &&
      this.onGround &&
      moveDir !== 0 &&
      vxOld !== 0 &&
      Math.sign(vxOld) !== moveDir &&
      Math.abs(vxOld) > t.skidThreshold;
    if (skidNow && !this.skidding)
      env.emit({ type: 'skid', x: b.centerX, y: b.bottom, dir: moveDir });
    this.skidding = skidNow;

    this.updateHorizontal(moveDir, t, d, env.speedMul ?? 1);

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

    const blockedX = (x: number, y: number) => {
      if (!g.solidAt(x, y, b.w, b.h)) return false;
      // 冲刺：能撞碎的撞碎，接着往前
      if (dashing && env.smash?.(x, y, b.w, b.h)) return g.solidAt(x, y, b.w, b.h);
      return true;
    };
    const hitX = b.moveX(dx, blockedX, (sign) => this.tryLedgeAssist(sign, env));
    if (hitX) {
      if (dashing && r) {
        this.dashBonk = r.dashDir;
      } else if (Math.abs(this.vx) > 60) {
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
      // 隐藏铃砖：只在头顶越过它底边的那一下挡住
      if (sign < 0) return g.hiddenBelowEdge(x, y + 1, b.w);
      return this.dropTimer === 0 && g.oneWayTopAt(x, y + b.h - 1, b.w);
    };
    const vyBeforeMove = this.vy;
    const hitY = b.moveY(dy, blockedY, (sign) => sign < 0 && this.tryCornerCorrection(env));
    if (hitY) {
      if (dy < 0) {
        if (vyBeforeMove < -30) {
          env.emit({ type: 'bonk', x: b.centerX, y: b.y });
          this.headHit = true;
        }
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
      if (r) r.airJumps = RULES.rideAirJumps;
      if (this.supportedBothSides(g)) {
        this.safeFeetX = b.centerX;
        this.safeFeetY = b.bottom;
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

  /** 骑着咩铃在空中再跳一次：从当时的位置再往上 airJumpTiles 格（可以松键截短） */
  private doAirJump(env: PlayerEnv): void {
    const r = this.ride!;
    r.airJumps--;
    this.vy = -Math.sqrt(2 * env.derived.gravity * RULES.airJumpTiles * TILE);
    this.jumpCuttable = true;
    this.buffer = 0;
    env.emit({ type: 'doubleJump', x: this.body.centerX, y: this.body.bottom });
  }

  private updateHorizontal(dir: number, t: Tuning, d: Derived, mul: number): void {
    const top = (this.running ? t.runSpeed : t.walkSpeed) * mul;
    const r = this.ride;
    if (r) {
      // 蓄力：停下来；冲刺：速度固定（空中也是，这就是冲撞跳）
      if (r.windup > 0) {
        this.vx = approach(this.vx, 0, d.groundDecel * 2 * DT);
        return;
      }
      if (r.dash > 0) {
        this.vx = r.dashDir * RULES.chargeSpeed * mul;
        return;
      }
      // 冲撞跳以后在空中超速：慢慢回落到正常速度
      if (!this.onGround && Math.abs(this.vx) > top)
        this.vx = approach(this.vx, Math.sign(this.vx) * top, RULES.chargeAirDecel * DT);
    }
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
        if (
          !g.solidAt(nx, b.y - 1, b.w, b.h) &&
          !g.solidAt(nx, b.y, b.w, b.h) &&
          !g.hiddenBelowEdge(nx, b.y, b.w)
        ) {
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
