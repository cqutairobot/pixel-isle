import { END_STATES } from '../../src/content/cutscenes/endStates';
import { LEVELS } from '../../src/content/levels';
import { TILE } from '../../src/sim/constants';
import { BTN, type InputFrame } from '../../src/sim/input';
import { parseLevel } from '../../src/sim/level';
import { resolveHeadless } from '../../src/sim/replay';
import { cloneTuning, PRESETS } from '../../src/sim/tuning';
import { World } from '../../src/sim/world';

export function newWorld(levelId: string): World {
  return new World(
    parseLevel(LEVELS[levelId]!),
    cloneTuning(PRESETS.A.tuning),
    { autoRun: false },
    384,
    216,
  );
}

/**
 * 回放用的"自动玩家"：在 sim 里按路线操作，产生输入序列。
 * 遇到台阶、木箱跳上去，遇到坑和海水跳过去，螃蟹靠近就跳（多半会踩中）。
 * 需要技巧的地方（风铃、隐藏铃砖、踩蟹弹高）由路线脚本单独处理，必要时在几个候选操作里搜索。
 */
export class Bot {
  world: World;
  readonly inputs: InputFrame[] = [];
  private prevHeld = 0;
  private jumpHold = 0;

  constructor(readonly levelId: string) {
    this.world = newWorld(levelId);
  }

  get p() {
    return this.world.player;
  }

  /** 主角中心所在的格子列 */
  get col(): number {
    return this.p.body.centerX / TILE;
  }

  step(held: number): void {
    const w = this.world;
    if (w.waiting) resolveHeadless(w, END_STATES);
    const f: InputFrame = { held, pressed: held & ~this.prevHeld, released: this.prevHeld & ~held };
    this.prevHeld = held;
    this.inputs.push(f);
    w.step(f);
  }

  /** 按住某些键 n 帧 */
  hold(held: number, n: number): void {
    for (let i = 0; i < n; i++) this.step(held);
  }

  /** 从头重放已经记录的输入，得到一个状态相同的新 Bot（用来试不同的操作） */
  fork(): Bot {
    const b = new Bot(this.levelId);
    for (const f of this.inputs) b.step(f.held);
    return b;
  }

  /** 等到条件成立（最多 max 帧），期间按住 held */
  waitUntil(pred: () => boolean, max = 600, held = 0): boolean {
    for (let i = 0; i < max; i++) {
      if (pred()) return true;
      this.step(held);
    }
    return pred();
  }

  /** 原地跳：按住跳跃 hold 帧（同时按住方向 dir），然后等落地 */
  jump(hold: number, dir = 0, max = 120): void {
    const d = dir > 0 ? BTN.right : dir < 0 ? BTN.left : 0;
    if (this.prevHeld & BTN.jump) this.step(d);
    this.hold(d | BTN.jump, hold);
    this.waitUntil(() => this.p.onGround, max, d);
  }

  /** 脚下前方 ahead 像素处，往下 maxDrop 格以内有没有能站的地方 */
  private groundAhead(ahead: number, maxDrop: number): boolean {
    const g = this.world.grid;
    const b = this.p.body;
    const x = this.p.facing > 0 ? b.right - 1 + ahead : b.x - ahead;
    for (let y = b.bottom; y <= b.bottom + maxDrop * TILE; y += 1) {
      if (g.waterAt(x, y)) return false;
      if (g.standableAt(x, y)) return true;
    }
    return false;
  }

  /** 往 col 列走（反应式：台阶跳上去、坑跳过去、螃蟹靠近就跳） */
  walkTo(col: number, max = 3000): boolean {
    const targetX = col * TILE + TILE / 2;
    for (let i = 0; i < max; i++) {
      const w = this.world;
      if (w.state === 'clear') return true;
      const b = this.p.body;
      const dx = targetX - b.centerX;
      if (Math.abs(dx) < 3 && this.p.onGround) return true;
      const dir = Math.sign(dx);
      let held = dir > 0 ? BTN.right : BTN.left;
      if (this.jumpHold > 0) {
        held |= BTN.jump;
        this.jumpHold--;
      } else if (
        this.p.onGround &&
        w.respawnTimer === 0 &&
        w.state === 'play' &&
        !(this.prevHeld & BTN.jump)
      ) {
        const h = this.decideJump(dir);
        if (h > 0) {
          held |= BTN.jump;
          this.jumpHold = h - 1;
        }
      }
      this.step(held);
    }
    return false;
  }

  /** 跳过前方缝隙要按住跳跃多少帧：找到落点（最多 6 格外），缝越宽、落点越高按得越久 */
  private gapHold(dir: number): number {
    const g = this.world.grid;
    const b = this.p.body;
    const front = dir > 0 ? b.right : b.x - 1;
    for (let d = 2; d <= 6 * TILE; d += 2) {
      const x = front + d * dir;
      for (let y = b.bottom - 3 * TILE; y <= b.bottom + 2 * TILE; y += TILE / 2) {
        const yy = Math.round(y / TILE) * TILE;
        if (g.standableAt(x, yy) && !g.solidAt(x, yy - 1, 1, 1)) {
          const up = Math.max(0, (b.bottom - yy) / TILE);
          return Math.min(22, Math.max(8, Math.round(6 + (d / TILE) * 2.5 + up * 4)));
        }
      }
    }
    return 22;
  }

  /** 要不要起跳；返回按住跳跃的帧数（0 表示不跳） */
  private decideJump(dir: number): number {
    const w = this.world;
    const g = w.grid;
    const b = this.p.body;
    const front = dir > 0 ? b.right : b.x - 5;
    // 前面有墙（木箱、台阶）：按高度决定按多久
    if (g.solidAt(front, b.y + 1, 5, b.h - 2)) {
      const c = Math.floor((dir > 0 ? b.right + 2 : b.x - 3) / TILE);
      let r = Math.floor((b.bottom - 1) / TILE);
      let h = 0;
      while (r >= 0 && g.get(c, r) === 1 && h < 6) {
        h++;
        r--;
      }
      return [0, 8, 12, 18, 30, 40][h] ?? 40;
    }
    // 前面没地了（坑、海水），而且掉下去 3 格以内也没地：按缝隙宽度和落点高低决定按多久
    if (!this.groundAhead(2, 3)) return this.gapHold(dir);
    // 螃蟹靠近
    for (const e of w.enemies) {
      if (!e.alive || !e.active) continue;
      const ex = e.body.centerX;
      const dist = (ex - (dir > 0 ? b.right : b.x)) * dir;
      if (dist > 0 && dist < 34 && Math.abs(e.body.bottom - b.bottom) < 20) return 14;
    }
    return 0;
  }
}
