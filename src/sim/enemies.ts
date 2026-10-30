import { Body, type Rect } from './body';
import { DT, TILE } from './constants';
import type { Grid } from './grid';
import type { EnemyKind } from './level';
import { RULES } from './tuning';

/** 每种敌人的尺寸与行为参数。见 docs/levels/1-1.md §3。 */
export const ENEMY_SPECS: Record<
  EnemyKind,
  { w: number; h: number; speed: number; turnAtEdges: boolean }
> = {
  crab: { w: 12, h: 10, speed: 30, turnAtEdges: false },
  blueClaw: { w: 12, h: 10, speed: 36, turnAtEdges: true },
};

export type EnemyFate = 'water' | 'pit' | null;

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
  private spawnX: number;
  private spawnY: number;

  constructor(
    readonly id: number,
    readonly kind: EnemyKind,
    col: number,
    row: number,
  ) {
    const spec = ENEMY_SPECS[kind];
    this.spawnX = col * TILE + Math.floor((TILE - spec.w) / 2);
    this.spawnY = row * TILE + TILE - spec.h;
    this.body = new Body(this.spawnX, this.spawnY, spec.w, spec.h);
  }

  get spec() {
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
  }

  turn(): void {
    this.facing = this.facing > 0 ? -1 : 1;
  }

  step(grid: Grid): EnemyFate {
    const b = this.body;
    const spec = this.spec;
    // 会在边缘回头的敌人：前脚再走一步就悬空时转身
    if (spec.turnAtEdges && this.onGround) {
      const probe = this.facing > 0 ? b.x + b.w : b.x - 1;
      if (!grid.standableAt(probe, b.bottom)) this.turn();
    }
    this.vx = this.facing * spec.speed;
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
    }
    if (grid.waterAt(b.centerX, b.bottom - 2)) return 'water';
    if (b.y > grid.heightPx + 16) return 'pit';
    return null;
  }
}
