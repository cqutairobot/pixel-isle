import { Body } from './body';
import { DT } from './constants';
import type { Grid } from './grid';
import type { Item } from './items';
import { RULES } from './tuning';

/** held：在小满手里；out：去程（匀减速，撞墙就折返）；back：回程（追向小满，穿过地形） */
export type StarfishState = 'held' | 'out' | 'back';

/** 去程撞到了什么（由 World 决定要不要从侧面打砖） */
export interface StarfishBump {
  /** 撞到的那一侧：横向撞墙时 dx = ±1，竖直撞到时 dy = ±1 */
  dx: number;
  dy: number;
}

/**
 * 回旋海星（docs/levels/1-2.md §3）。纯逻辑：位置、速度、去程与回程；
 * 打敌人、打砖、捞道具、接住由 World 处理（它知道敌人、砖和道具）。
 */
export class Starfish {
  state: StarfishState = 'held';
  readonly body: Body;
  /** 去程的方向（单位向量）与当前速度 */
  dirX = 1;
  dirY = 0;
  speed = 0;
  /** 回程速度 */
  private backSpeed = 0;
  /** 这一次扔出已经打中过的敌人（穿透：同一只只算一次） */
  readonly hitIds = new Set<number>();
  /** 这一次扔出已经打过的椰子树 */
  readonly treeIds = new Set<number>();
  /** 挂在海星上一起回来的道具 */
  readonly carried: Item[] = [];
  /** 接住后的冷却帧数 */
  cooldown = 0;
  /** 这一次扔出飞了多少帧 */
  frames = 0;

  constructor() {
    const s = RULES.starfishSize;
    this.body = new Body(0, 0, s, s);
  }

  get out(): boolean {
    return this.state !== 'held';
  }

  /** 去程匀减速：飞出 starfishRange 像素时正好停住 */
  private get decel(): number {
    return (RULES.starfishSpeed * RULES.starfishSpeed) / (2 * RULES.starfishRange);
  }

  /** 从 (x, y)（海星中心）朝 (dirX, dirY) 扔出 */
  throw(x: number, y: number, dirX: number, dirY: number): void {
    const s = RULES.starfishSize;
    this.body.place(Math.round(x - s / 2), Math.round(y - s / 2));
    this.dirX = dirX;
    this.dirY = dirY;
    this.speed = RULES.starfishSpeed;
    this.backSpeed = 0;
    this.state = 'out';
    this.frames = 0;
    this.hitIds.clear();
    this.treeIds.clear();
  }

  /** 收回手里（接住、或者主角掉海 / 倒下复活时） */
  stow(): void {
    this.state = 'held';
    this.speed = 0;
    this.backSpeed = 0;
    this.cooldown = RULES.starfishCooldown;
  }

  /**
   * 去程一步：按方向移动，碰到实心格就停在墙边并返回撞到的方向；速度减到 0 时自动折返。
   */
  stepOut(grid: Grid): StarfishBump | null {
    const b = this.body;
    this.frames++;
    this.speed = Math.max(0, this.speed - this.decel * DT);
    const solid = (x: number, y: number) => grid.solidAt(x, y, b.w, b.h);
    let bump: StarfishBump | null = null;
    if (b.moveX(this.dirX * this.speed * DT, solid)) bump = { dx: Math.sign(this.dirX), dy: 0 };
    if (!bump && b.moveY(this.dirY * this.speed * DT, solid))
      bump = { dx: 0, dy: Math.sign(this.dirY) };
    if (bump || this.speed <= 0) this.state = 'back';
    return bump;
  }

  /**
   * 回程一步：朝 (tx, ty) 加速追过去，穿过地形；离目标足够近就返回 true（接住）。
   * 速度方向每一步都直接对准目标，所以不会绕圈，一定能回来。
   */
  stepBack(tx: number, ty: number): boolean {
    const b = this.body;
    this.frames++;
    this.backSpeed = Math.min(
      RULES.starfishReturnMax,
      this.backSpeed + RULES.starfishReturnAccel * DT,
    );
    const dx = tx - b.centerX;
    const dy = ty - b.centerY;
    const d = Math.hypot(dx, dy);
    if (d <= RULES.starfishCatchRadius) return true;
    const step = Math.min(d, this.backSpeed * DT);
    const free = () => false;
    b.moveX((dx / d) * step, free);
    b.moveY((dy / d) * step, free);
    return Math.hypot(tx - b.centerX, ty - b.centerY) <= RULES.starfishCatchRadius;
  }
}
