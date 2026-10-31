import { Body, type Rect } from './body';
import { DT, TILE } from './constants';
import type { Grid } from './grid';
import { RULES } from './tuning';

/** 椰子树：树冠是海星能打到的判定区；每打一下掉一个椰子 */
export interface CoconutTree {
  id: number;
  /** 树根所在格的底边中心（px） */
  x: number;
  y: number;
  /** 树冠判定区 */
  crown: Rect;
  coconuts: number;
  /** 最后一个椰子里装的是芒果 */
  mango: boolean;
}

export interface Coconut {
  id: number;
  treeId: number;
  body: Body;
  vx: number;
  vy: number;
  /** 已经弹了几下 */
  bounces: number;
  /** 碎开时掉出什么 */
  contents: 'shells' | 'mango';
  alive: boolean;
}

/** 椰子这一步发生的事 */
export interface CoconutCue {
  coconut: Coconut;
  kind: 'bounce' | 'break' | 'lost';
}

/** 椰子树的高度（格）：树冠在树根上方这么高的地方 */
export const TREE_HEIGHT = 5;

/** 关卡里的椰子树和掉下来的椰子 */
export class Props {
  readonly trees: CoconutTree[] = [];
  readonly coconuts: Coconut[] = [];
  private nextId = 1;

  addTree(col: number, row: number, coconuts = 2, mango = false): CoconutTree {
    const x = col * TILE + TILE / 2;
    const y = (row + 1) * TILE;
    const t: CoconutTree = {
      id: this.nextId++,
      x,
      y,
      crown: { x: x - 22, y: y - TREE_HEIGHT * TILE - 6, w: 44, h: 22 },
      coconuts,
      mango,
    };
    this.trees.push(t);
    return t;
  }

  /** 打一下树冠：还有椰子就掉一个，朝 dir 方向轻轻滚 */
  hitTree(t: CoconutTree, dir: number): Coconut | null {
    if (t.coconuts <= 0) return null;
    t.coconuts--;
    const body = new Body(Math.round(t.x - 5 + dir * 6), t.crown.y + t.crown.h - 6, 10, 10);
    const c: Coconut = {
      id: this.nextId++,
      treeId: t.id,
      body,
      vx: dir * 30,
      vy: 0,
      bounces: 0,
      contents: t.mango && t.coconuts === 0 ? 'mango' : 'shells',
      alive: true,
    };
    this.coconuts.push(c);
    return c;
  }

  /** 椰子下落、弹两下、滚一小段，停下来就碎开 */
  step(grid: Grid): CoconutCue[] {
    const cues: CoconutCue[] = [];
    for (const c of this.coconuts) {
      if (!c.alive) continue;
      const b = c.body;
      b.snapshot();
      c.vy = Math.min(c.vy + RULES.coconutGravity * DT, 320);
      if (b.moveX(c.vx * DT, (x, y) => grid.solidAt(x, y, b.w, b.h))) c.vx = -c.vx * 0.5;
      const falling = c.vy > 0;
      const hit = b.moveY(c.vy * DT, (x, y, sign) => {
        if (grid.solidAt(x, y, b.w, b.h)) return true;
        return sign > 0 && grid.oneWayTopAt(x, y + b.h - 1, b.w);
      });
      if (hit && falling) {
        if (c.bounces < RULES.coconutBounces && c.vy > 60) {
          c.bounces++;
          c.vy = -c.vy * RULES.coconutRestitution;
          cues.push({ coconut: c, kind: 'bounce' });
        } else {
          c.vy = 0;
          // 在地上滚，慢慢停下
          const v = Math.abs(c.vx) - RULES.coconutRollDecel * DT;
          c.vx = v > 0 ? Math.sign(c.vx) * v : 0;
          if (c.vx === 0) {
            c.alive = false;
            cues.push({ coconut: c, kind: 'break' });
          }
        }
      } else if (hit) c.vy = 0;
      if (c.alive && (grid.waterAt(b.centerX, b.bottom - 2) || b.y > grid.heightPx + 16)) {
        c.alive = false;
        cues.push({ coconut: c, kind: 'lost' });
      }
    }
    return cues;
  }
}
