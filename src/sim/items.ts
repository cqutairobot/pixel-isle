import { Body, rectsOverlap, type Rect } from './body';
import { TILE, DT } from './constants';
import type { Grid } from './grid';
import type { ItemKind } from './level';
import { RULES } from './tuning';

/** 道具碰撞盒尺寸 */
const SIZE: Record<ItemKind, [number, number]> = {
  shell: [10, 10],
  bigShell: [12, 12],
  mango: [12, 12],
  sun: [12, 12],
  glass: [10, 10],
};

/** 从砖里冒出来要几帧 */
export const EMERGE_FRAMES = 16;

export interface Item {
  id: number;
  kind: ItemKind;
  /** 海玻璃编号，其他道具为 -1 */
  glass: number;
  /** 以前已经找到过的海玻璃：半透明显示，拾取后不重复计数 */
  ghost: boolean;
  body: Body;
  vx: number;
  vy: number;
  /** 受重力影响（从砖里弹出来的道具） */
  physical: boolean;
  onGround: boolean;
  /** 从砖里冒出来的剩余帧数：期间缓缓上升，不能拾取 */
  emerge: number;
  /** 弹出后多少帧内不能拾取，免得一冒头就被吃掉 */
  delay: number;
  alive: boolean;
}

export interface ItemLost {
  item: Item;
  water: boolean;
}

/** 关卡里的全部道具：放在地图上的，以及从砖、风铃里弹出来的 */
export class ItemSet {
  readonly list: Item[] = [];
  private nextId = 1;

  constructor(private grid: Grid) {}

  /** 放在地图格子 (col, row) 正中的静止道具 */
  place(kind: ItemKind, col: number, row: number, glass = -1, ghost = false): Item {
    const [w, h] = SIZE[kind];
    const body = new Body(
      col * TILE + Math.floor((TILE - w) / 2),
      row * TILE + Math.floor((TILE - h) / 2),
      w,
      h,
    );
    return this.push({ kind, glass, ghost, body, physical: false, emerge: 0, delay: 0 });
  }

  /** 从砖 (col, row) 里冒出来，然后朝 dir 方向沿小弧线弹出 */
  emergeFrom(
    kind: ItemKind,
    col: number,
    row: number,
    dir: number,
    glass = -1,
    ghost = false,
  ): Item {
    const [w, h] = SIZE[kind];
    const body = new Body(col * TILE + Math.floor((TILE - w) / 2), row * TILE + TILE - h, w, h);
    const it = this.push({
      kind,
      glass,
      ghost,
      body,
      physical: true,
      emerge: EMERGE_FRAMES,
      delay: 0,
    });
    it.vx = dir * 50;
    return it;
  }

  /** 在 (x, y)（道具底边中心）直接弹出，例如从风铃架上掉下来 */
  popAt(
    kind: ItemKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    glass = -1,
    ghost = false,
  ): Item {
    const [w, h] = SIZE[kind];
    const body = new Body(Math.round(x - w / 2), Math.round(y - h), w, h);
    const it = this.push({ kind, glass, ghost, body, physical: true, emerge: 0, delay: 12 });
    it.vx = vx;
    it.vy = vy;
    return it;
  }

  private push(p: Omit<Item, 'id' | 'vx' | 'vy' | 'onGround' | 'alive'>): Item {
    const it: Item = { ...p, id: this.nextId++, vx: 0, vy: 0, onGround: false, alive: true };
    this.list.push(it);
    return it;
  }

  /** 推进弹出、下落；返回掉进海里或掉出地图的道具 */
  step(): ItemLost[] {
    const lost: ItemLost[] = [];
    const g = this.grid;
    for (const it of this.list) {
      if (!it.alive) continue;
      const b = it.body;
      b.snapshot();
      if (it.delay > 0) it.delay--;
      if (it.emerge > 0) {
        it.emerge--;
        b.y -= 1;
        if (it.emerge === 0) {
          it.vy = -160;
          it.delay = 8;
        }
        continue;
      }
      if (!it.physical || it.onGround) continue;
      it.vy = Math.min(it.vy + RULES.itemGravity * DT, RULES.itemMaxFall);
      const hitX = b.moveX(it.vx * DT, (x, y) => g.solidAt(x, y, b.w, b.h));
      if (hitX) it.vx = -it.vx * 0.5;
      const falling = it.vy > 0;
      const hitY = b.moveY(it.vy * DT, (x, y, sign) => {
        if (g.solidAt(x, y, b.w, b.h)) return true;
        return sign > 0 && g.oneWayTopAt(x, y + b.h - 1, b.w);
      });
      if (hitY) {
        if (falling) {
          // 落地：轻轻弹一下再停住
          if (it.vy > 120) {
            it.vy = -it.vy * 0.3;
          } else {
            it.vy = 0;
            it.vx = 0;
            it.onGround = true;
          }
        } else {
          it.vy = 0;
        }
      }
      if (g.waterAt(b.centerX, b.bottom - 2)) {
        it.alive = false;
        lost.push({ item: it, water: true });
      } else if (b.y > g.heightPx + 16) {
        it.alive = false;
        lost.push({ item: it, water: false });
      }
    }
    return lost;
  }

  /** 和矩形 r 重叠、可以拾取的道具 */
  touching(r: Rect): Item[] {
    return this.list.filter(
      (it) => it.alive && it.emerge === 0 && it.delay === 0 && it.body.overlaps(r),
    );
  }

  /** 正好放在砖 (col, row) 顶上的道具（砖被顶时一起顶起来） */
  onTopOf(col: number, row: number): Item[] {
    const top = row * TILE;
    return this.list.filter((it) => {
      if (!it.alive || it.emerge > 0) return false;
      const b = it.body;
      const resting = it.physical
        ? it.onGround && b.bottom === top
        : b.bottom > top - TILE && b.bottom <= top;
      return (
        resting &&
        rectsOverlap(b.x, b.y, b.w, b.h, { x: col * TILE, y: top - TILE, w: TILE, h: TILE })
      );
    });
  }
}
