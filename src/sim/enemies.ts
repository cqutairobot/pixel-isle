import { Body, type Rect } from './body';
import { DT, TILE } from './constants';
import type { Grid } from './grid';
import type { EnemyKind } from './level';
import { RULES } from './tuning';

export interface EnemySpec {
  w: number;
  h: number;
  /** 走路速度（px/s） */
  speed: number;
  /** 走到边缘回头（否则会掉下去） */
  turnAtEdges: boolean;
  /** 浑身是刺：踩上去会受伤 */
  spiky: boolean;
  /** 在空中飞，不受重力 */
  flying: boolean;
}

/** 每种敌人的尺寸与行为参数。见 docs/levels/1-1.md §3、docs/levels/1-2.md §3。 */
export const ENEMY_SPECS: Record<EnemyKind, EnemySpec> = {
  crab: { w: 12, h: 10, speed: 30, turnAtEdges: false, spiky: false, flying: false },
  blueClaw: { w: 12, h: 10, speed: 36, turnAtEdges: true, spiky: false, flying: false },
  urchin: { w: 12, h: 12, speed: RULES.urchinCrawl, turnAtEdges: true, spiky: true, flying: false },
  urchinHang: { w: 12, h: 12, speed: 0, turnAtEdges: true, spiky: true, flying: false },
  gull: { w: 16, h: 12, speed: RULES.gullSpeed, turnAtEdges: false, spiky: false, flying: true },
};

export type EnemyFate = 'water' | 'pit' | null;

/** 敌人在这一步要知道的外部情况：主角的位置、镜头看得到的范围 */
export interface EnemyContext {
  /** 主角碰撞盒中心 x、顶边、底边 */
  px: number;
  pTop: number;
  pBottom: number;
  camX: number;
  camY: number;
  viewW: number;
  viewH: number;
}

/**
 * 敌人的状态：
 * - 走路的（霜壳蟹、蓝钳、刺海胆）：walk
 * - 倒挂刺海胆：hang → shake（晃 24 帧）→ fall → walk（落地后不动）
 * - 冰喙鸥：cruise → alert（停下叫一声，30 帧）→ dive → climb → cruise
 */
export type EnemyMode = 'walk' | 'hang' | 'shake' | 'fall' | 'cruise' | 'alert' | 'dive' | 'climb';

/** 这一步里值得表现层知道的变化 */
export type EnemyCue = 'shake' | 'fall' | 'land' | 'alert' | 'dive' | null;

/** 敌人（被霜之力侵染的小动物）。整数坐标 + 亚像素余量，和主角用同一套 Body。 */
export class Enemy {
  readonly body: Body;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = -1;
  /** 进入镜头附近后才开始活动 */
  active = false;
  alive = true;
  onGround = false;
  /** 已经走过的距离（表现层用来选走路帧） */
  walked = 0;
  mode: EnemyMode;
  /** 当前状态已经持续的帧数 */
  modeFrames = 0;
  /** 冰喙鸥：俯冲后的冷却、巡航高度、俯冲目标高度 */
  cooldown = 0;
  private baseY: number;
  private diveTargetY = 0;
  /** 不爬（原地不动的刺海胆；倒挂刺海胆掉下来以后） */
  private still = false;
  private spawnX: number;
  private spawnY: number;
  private bobPhase = 0;

  constructor(
    readonly id: number,
    readonly kind: EnemyKind,
    col: number,
    row: number,
    /** 一直待在原地（只对走路的敌人有意义） */
    private readonly fixed = false,
  ) {
    const spec = ENEMY_SPECS[kind];
    this.spawnX = col * TILE + Math.floor((TILE - spec.w) / 2);
    // 倒挂的贴着这一格的顶（挂在上面那一格下面）；会飞的在这一格的中间；其他的站在这一格的底
    this.spawnY =
      kind === 'urchinHang'
        ? row * TILE
        : kind === 'gull'
          ? row * TILE + Math.floor((TILE - spec.h) / 2)
          : row * TILE + TILE - spec.h;
    this.body = new Body(this.spawnX, this.spawnY, spec.w, spec.h);
    this.baseY = this.spawnY;
    this.mode = this.initialMode();
    this.still = fixed;
  }

  private initialMode(): EnemyMode {
    return this.kind === 'urchinHang' ? 'hang' : this.kind === 'gull' ? 'cruise' : 'walk';
  }

  get spec(): EnemySpec {
    return ENEMY_SPECS[this.kind];
  }

  /** 伤害判定（比碰撞盒小一圈） */
  hurtRect(): Rect {
    const b = this.body;
    return { x: b.x + 1, y: b.y + 2, w: b.w - 2, h: b.h - 2 };
  }

  /** 回到出生点，等再次进入镜头才活动（主角死亡后调用） */
  reset(): void {
    this.body.place(this.spawnX, this.spawnY);
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.active = false;
    this.onGround = false;
    this.mode = this.initialMode();
    this.modeFrames = 0;
    this.cooldown = 0;
    this.still = this.fixed;
    this.bobPhase = 0;
  }

  turn(): void {
    this.facing = this.facing > 0 ? -1 : 1;
  }

  private setMode(m: EnemyMode): void {
    this.mode = m;
    this.modeFrames = 0;
  }

  /** 在不在镜头看得到的范围里 */
  private onScreen(ctx: EnemyContext): boolean {
    const b = this.body;
    return (
      b.right > ctx.camX &&
      b.x < ctx.camX + ctx.viewW &&
      b.bottom > ctx.camY &&
      b.y < ctx.camY + ctx.viewH
    );
  }

  /** 推进一步。返回掉进水里或掉出地图（这只敌人没了）；cue 记下这一步的状态变化 */
  step(grid: Grid, ctx: EnemyContext): EnemyFate {
    this.cue = null;
    this.modeFrames++;
    switch (this.mode) {
      case 'hang':
        this.stepHang(ctx);
        return null;
      case 'shake':
        if (this.modeFrames >= RULES.hangShakeFrames) {
          this.setMode('fall');
          this.cue = 'fall';
        }
        return null;
      case 'cruise':
      case 'alert':
      case 'dive':
      case 'climb':
        this.stepGull(grid, ctx);
        return null;
      default:
        return this.stepWalk(grid);
    }
  }

  /** 这一步的状态变化（表现层：晃动的沙沙声、预警的"！"……） */
  cue: EnemyCue = null;

  private stepHang(ctx: EnemyContext): void {
    const b = this.body;
    const below = ctx.pTop - b.bottom;
    if (
      Math.abs(ctx.px - b.centerX) <= RULES.hangDetectX &&
      below >= 0 &&
      below <= RULES.hangDetectTiles * TILE &&
      this.onScreen(ctx)
    ) {
      this.setMode('shake');
      this.cue = 'shake';
    }
  }

  private stepWalk(grid: Grid): EnemyFate {
    const b = this.body;
    const spec = this.spec;
    const falling = this.mode === 'fall';
    // 会在边缘回头的敌人：前脚再走一步就悬空时转身
    if (!falling && spec.turnAtEdges && this.onGround) {
      const probe = this.facing > 0 ? b.x + b.w : b.x - 1;
      if (!grid.standableAt(probe, b.bottom)) this.turn();
    }
    this.vx = falling || this.still ? 0 : this.facing * spec.speed;
    this.vy = Math.min(this.vy + RULES.enemyGravity * DT, RULES.enemyMaxFall);
    const x0 = b.x;
    if (b.moveX(this.vx * DT, (x, y) => grid.solidAt(x, y, b.w, b.h))) this.turn();
    this.walked += Math.abs(b.x - x0);
    const hitY = b.moveY(this.vy * DT, (x, y, sign) => {
      if (grid.solidAt(x, y, b.w, b.h)) return true;
      return sign > 0 && grid.oneWayTopAt(x, y + b.h - 1, b.w);
    });
    if (hitY) this.vy = 0;
    // 站在地上时每步只往下"试"不到 1 像素，所以直接检测脚下
    this.onGround =
      this.vy >= 0 &&
      (grid.solidAt(b.x, b.y + 1, b.w, b.h) || grid.oneWayTopAt(b.x, b.bottom, b.w));
    if (this.onGround) {
      this.vy = 0;
      b.ry = 0;
      if (falling) {
        // 倒挂的刺海胆落地：变成不动的地面款
        this.setMode('walk');
        this.still = true;
        this.cue = 'land';
      }
    }
    if (grid.waterAt(b.centerX, b.bottom - 2)) return 'water';
    if (b.y > grid.heightPx + 16) return 'pit';
    return null;
  }

  private stepGull(grid: Grid, ctx: EnemyContext): void {
    const b = this.body;
    const solid = (x: number, y: number) => grid.solidAt(x, y, b.w, b.h);
    switch (this.mode) {
      case 'cruise': {
        if (this.cooldown > 0) this.cooldown--;
        // 来回巡航，上下正弦浮动
        if (b.x <= this.spawnX - RULES.gullPatrol) this.facing = 1;
        else if (b.x >= this.spawnX + RULES.gullPatrol) this.facing = -1;
        this.bobPhase = (this.bobPhase + 1) % RULES.gullBobFrames;
        const bob =
          Math.sin((this.bobPhase / RULES.gullBobFrames) * Math.PI * 2) * RULES.gullBobAmp;
        if (b.moveX(this.facing * RULES.gullSpeed * DT, solid)) this.turn();
        this.walked += RULES.gullSpeed * DT;
        b.moveY(this.baseY + bob - (b.y + b.ry), solid);
        // 小满在正下方：停下来叫一声
        const below = ctx.pTop - b.bottom;
        if (
          this.cooldown === 0 &&
          Math.abs(ctx.px - b.centerX) <= RULES.gullDetectX &&
          below >= TILE &&
          below <= RULES.gullDetectTiles * TILE &&
          this.onScreen(ctx)
        ) {
          this.setMode('alert');
          this.cue = 'alert';
          this.facing = ctx.px >= b.centerX ? 1 : -1;
        }
        break;
      }
      case 'alert':
        if (this.modeFrames >= RULES.gullTelegraphFrames) {
          // 朝预警结束时小满的位置俯冲
          const tx = ctx.px - b.centerX;
          const ty = (ctx.pTop + ctx.pBottom) / 2 - b.centerY;
          const d = Math.hypot(tx, ty) || 1;
          this.vx = (tx / d) * RULES.gullDiveSpeed;
          this.vy = (ty / d) * RULES.gullDiveSpeed;
          this.diveTargetY = b.centerY + ty;
          this.facing = tx >= 0 ? 1 : -1;
          this.setMode('dive');
          this.cue = 'dive';
        }
        break;
      case 'dive': {
        const hx = b.moveX(this.vx * DT, solid);
        const hy = b.moveY(this.vy * DT, solid);
        this.walked += Math.hypot(this.vx, this.vy) * DT;
        if (hx || hy || b.centerY >= this.diveTargetY || this.modeFrames > 90) {
          this.setMode('climb');
        }
        break;
      }
      case 'climb': {
        // 拉起，慢慢飞回巡航高度，顺着原来的方向往前一点
        if (b.moveX(this.facing * RULES.gullSpeed * 0.5 * DT, solid)) this.turn();
        const dy = this.baseY - (b.y + b.ry);
        const step = Math.max(-RULES.gullClimbSpeed * DT, Math.min(RULES.gullClimbSpeed * DT, dy));
        b.moveY(step, solid);
        this.walked += RULES.gullSpeed * DT;
        if (Math.abs(this.baseY - (b.y + b.ry)) < 0.5 || this.modeFrames > 240) {
          this.cooldown = RULES.gullCooldown;
          this.bobPhase = 0;
          this.setMode('cruise');
        }
        break;
      }
    }
  }
}
