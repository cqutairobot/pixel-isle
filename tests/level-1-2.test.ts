import { describe, expect, it } from 'vitest';
import { level12 } from '../src/content/levels/1-2';
import { TILE } from '../src/sim/constants';
import { T_ONEWAY, T_SOLID, T_WATER, type Grid } from '../src/sim/grid';
import { BTN } from '../src/sim/input';
import { parseLevel, standAt } from '../src/sim/level';
import { cloneTuning, PRESETS } from '../src/sim/tuning';
import { World } from '../src/sim/world';
import { Driver } from './helpers';

const level = parseLevel(level12);
const g = level.grid;
const world = new World(level, cloneTuning(PRESETS.A.tuning), { autoRun: false }, 384, 216);

/** (c, r) 的顶面能不能站：自己是实心或单向平台，上面一格不是实心 */
const standable = (grid: Grid, c: number, r: number) => {
  const t = grid.get(c, r);
  return (
    (t === T_SOLID || t === T_ONEWAY) && grid.get(c, r - 1) !== T_SOLID && c >= 0 && c < grid.cols
  );
};

interface Seg {
  row: number;
  a: number;
  b: number;
}

/** 每一行里连续可站的一段 */
function segments(grid: Grid): Seg[] {
  const out: Seg[] = [];
  for (let r = 1; r < grid.rows; r++) {
    let c = 0;
    while (c < grid.cols) {
      if (!standable(grid, c, r)) {
        c++;
        continue;
      }
      const a = c;
      while (c + 1 < grid.cols && standable(grid, c + 1, r)) c++;
      out.push({ row: r, a, b: c });
      c++;
    }
  }
  return out;
}

const segs = segments(g);
const segAt = (c: number, r: number) => segs.find((s) => s.row === r && s.a <= c && c <= s.b)!;

/**
 * 从 start 出发能走到哪些平台（保守的跳跃模型）：往上一级不超过 maxUp 格、横向缝隙不超过 maxGap 格；
 * 往下跳时掉得越深能飘得越远。敌人都当成能打倒的。
 */
function reachable(start: Seg, maxUp: number, maxGap: number): Set<Seg> {
  const seen = new Set<Seg>([start]);
  const queue = [start];
  while (queue.length) {
    const s = queue.shift()!;
    for (const t of segs) {
      if (seen.has(t)) continue;
      const dh = s.row - t.row;
      const gap = Math.max(0, t.a - s.b - 1, s.a - t.b - 1);
      const ok =
        dh > 0
          ? dh <= maxUp && gap <= maxGap
          : gap <= maxGap + (dh < 0 ? 1 + Math.floor(-dh / 2) : 0);
      if (!ok) continue;
      seen.add(t);
      queue.push(t);
    }
  }
  return seen;
}

/** 一个拿着海星、敌人都清掉了的世界，小满站在 (col, row) 这一格上，朝向 facing */
function sandbox(col: number, row: number, facing: 1 | -1): { w: World; d: Driver } {
  const w = new World(
    parseLevel(level12),
    cloneTuning(PRESETS.A.tuning),
    { autoRun: false, flags: ['starfish'] },
    384,
    216,
  );
  for (const e of w.enemies) e.alive = false;
  const pos = standAt(col, row);
  w.teleport(pos.x, pos.y);
  const d = new Driver(w);
  // 先朝要扔的方向转过来，再站稳
  d.run(2, facing > 0 ? BTN.right : BTN.left);
  w.teleport(pos.x, pos.y);
  d.run(8, 0);
  return { w, d };
}

const glassItem = (w: World, index: number) =>
  w.items.list.find((it) => it.kind === 'glass' && it.glass === index)!;

describe('1-2 关卡校验', () => {
  it('尺寸、出生点、终点、检查点', () => {
    expect(g.cols).toBe(300);
    expect(g.rows).toBe(32);
    expect(level.markers.filter((m) => m.kind === 'goal')).toHaveLength(1);
    expect(world.checkpoints.map((c) => c.col)).toEqual([146, 218]);
    expect(g.solidAt(level.spawn.x, level.spawn.y + 1, 10, 14)).toBe(true);
    // 回回从一开始就跟着
    expect(world.flags.has('huihui')).toBe(true);
  });

  it('地上的敌人、NPC、检查点、终点都站在能站的地方；倒挂刺海胆头顶有东西可挂', () => {
    for (const m of level.markers.filter((m) => ['checkpoint', 'goal'].includes(m.kind)))
      expect(standable(g, m.col, m.row + 1), `${m.kind} @${m.col},${m.row}`).toBe(true);
    for (const e of world.enemies) {
      const c = Math.floor(e.body.centerX / TILE);
      if (e.kind === 'gull') continue;
      if (e.kind === 'urchinHang') {
        const r = Math.floor(e.body.y / TILE);
        expect([T_SOLID, T_ONEWAY], `倒挂刺海胆 @${c},${r}`).toContain(g.get(c, r - 1));
        continue;
      }
      const r = Math.round(e.body.bottom / TILE);
      expect(standable(g, c, r), `${e.kind} @${c},${r}`).toBe(true);
    }
    for (const n of world.npcs) expect(standable(g, Math.floor(n.x / TILE), n.y / TILE)).toBe(true);
  });

  it('三枚海玻璃：① 树桩缝里的铃砖，② 鸥巢，③ 树冠外侧', () => {
    const block = world.blocks.list.find((b) => b.item === 'glass')!;
    expect([block.col, block.row, block.glass]).toEqual([180, 27, 0]);
    const items = world.items.list.filter((i) => i.kind === 'glass').map((i) => i.glass);
    expect(items.sort()).toEqual([1, 2]);
  });

  it('主路线：往上一级不超过 3 格、缝隙不超过 2 格就能从出生点走到铃门', () => {
    const start = segAt(Math.floor(level.spawn.x / TILE), Math.round((level.spawn.y + 14) / TILE));
    const goal = level.markers.find((m) => m.kind === 'goal')!;
    const end = segAt(goal.col, goal.row + 1);
    expect(reachable(start, 3, 2).has(end)).toBe(true);
  });

  it('鸥巢（海玻璃 ②）是可选路线：最后一级要满跳 4 格', () => {
    const start = segAt(2, 28);
    const nest = segAt(90, 12);
    expect(reachable(start, 3, 2).has(nest)).toBe(false);
    expect(reachable(start, 4, 2).has(nest)).toBe(true);
  });

  it('倒木隧道只有一格高，刺海胆不动，跳不过去；开场触发区在隧道之前（先拿到海星）', () => {
    const urchin = world.enemies.find((e) => e.kind === 'urchin' && e.body.centerX < 30 * TILE)!;
    const c = Math.floor(urchin.body.centerX / TILE);
    expect(g.get(c, 26)).toBe(T_SOLID);
    expect(g.get(c, 27)).not.toBe(T_SOLID);
    // 倒木高 5 格，跳不上去，只能从隧道里过
    for (let r = 22; r <= 26; r++) expect(g.get(16, r)).toBe(T_SOLID);
    const trigger = level12.entities!.find((e) => e.type === 'trigger' && e.id === 'starfish')!;
    expect(trigger.type === 'trigger' && trigger.rect[0]).toBeLessThan(16);
    // 不动：过一会儿还在原地
    const { w, d } = sandbox(12, 27, 1);
    const tunnel = w.enemies.find((e) => e.id === urchin.id)!;
    tunnel.alive = true;
    const x0 = tunnel.body.x;
    d.run(240, 0);
    expect(tunnel.body.x).toBe(x0);
  });

  it('A4：站在岸边斜着往上扔，一次把吊桥底下的三枚贝壳都捞回来', () => {
    const { w, d } = sandbox(55, 27, 1);
    d.step(BTN.up);
    d.step(BTN.up | BTN.attack);
    for (let i = 0; i < 150 && w.starfish.out; i++) d.step(BTN.up);
    expect(w.stats.shells).toBe(3);
  });

  it('C2：站在树桩前直着扔，海星钻进缝里打响铃砖，把海玻璃 ① 带回来', () => {
    const { w, d } = sandbox(177, 27, 1);
    d.step(BTN.attack);
    for (let i = 0; i < 150 && w.starfish.out; i++) d.step(0);
    expect(w.stats.glass[0]).toBe(true);
  });

  it('海玻璃 ③：附近平台上怎么跳都碰不到，站着斜扔也够不到，起跳后斜扔能捞到', () => {
    const glass = glassItem(world, 2);
    const gc = Math.floor(glass.body.centerX / TILE);
    const gr = Math.floor(glass.body.centerY / TILE);
    // 附近（左右 16 格、上下 12 格）所有能站的格子
    const spots: Array<[number, number]> = [];
    for (const s of segs) {
      if (Math.abs(s.row - gr) > 12) continue;
      for (let c = s.a; c <= s.b; c += 2) if (Math.abs(c - gc) <= 16) spots.push([c, s.row - 1]);
      if (Math.abs(s.b - gc) <= 16) spots.push([s.b, s.row - 1]);
    }
    expect(spots.length).toBeGreaterThan(10);
    // ① 只靠跳：助跑 0 / 16 帧，按住跳 6 / 22 帧，空中往左 / 往右；也试试直接走下去、往下穿
    let touched: string | null = null;
    for (const [c, r] of spots) {
      for (const dir of [1, -1] as const) {
        const side = dir > 0 ? BTN.right : BTN.left;
        for (const runup of [0, 16]) {
          const plans: Array<(d: Driver) => void> = [
            ...[6, 22].flatMap((hold) =>
              [BTN.right, BTN.left].map((air) => (d: Driver) => {
                d.run(runup, side);
                d.run(hold, side | BTN.jump);
                d.run(110, air);
              }),
            ),
            (d) => d.run(runup + 110, side),
            (d) => {
              d.run(runup, side);
              d.step(BTN.down | BTN.jump);
              d.run(110, side);
            },
          ];
          for (const plan of plans) {
            const { w, d } = sandbox(c, r, dir);
            plan(d);
            if (w.stats.glass[2]) touched = `${c},${r} 朝 ${dir} 助跑 ${runup}`;
          }
        }
      }
    }
    expect(touched).toBeNull();
    // ② 站着斜扔：从每个能站的格子朝海玻璃那边扔
    for (const [c, r] of spots) {
      const dir = gc >= c ? 1 : -1;
      const { w, d } = sandbox(c, r, dir);
      d.step(BTN.up);
      d.step(BTN.up | BTN.attack);
      for (let i = 0; i < 150 && w.starfish.out; i++) d.step(BTN.up);
      expect(w.stats.glass[2], `站在 ${c},${r} 斜扔`).toBe(false);
    }
    // ③ 从树冠外侧那截短叶子上起跳，在最高点附近斜着往上扔
    let ok = false;
    search: for (let c = 252; c <= 256; c++) {
      for (const runup of [0, 4, 8]) {
        for (const hold of [10, 16, 22]) {
          for (let wait = 8; wait <= 26; wait += 2) {
            const { w, d } = sandbox(c, 16, 1);
            d.run(runup, BTN.right);
            d.run(Math.min(hold, wait), BTN.right | BTN.jump);
            d.run(Math.max(0, wait - hold), BTN.right);
            d.step(BTN.right | BTN.up);
            d.step(BTN.right | BTN.up | BTN.attack);
            for (let i = 0; i < 150 && w.starfish.out; i++) d.step(BTN.up);
            if (w.stats.glass[2]) {
              ok = true;
              break search;
            }
          }
        }
      }
    }
    expect(ok).toBe(true);
  });

  it('攀登段下面全是实地：掉下去只会落回叶子或地面，不会掉进水里', () => {
    for (let c = 222; c < g.cols; c++)
      for (let r = 0; r < g.rows; r++) expect(g.get(c, r), `${c},${r}`).not.toBe(T_WATER);
  });

  it('倒挂刺海胆掉下来之前，下面的人头顶至少还有 1 格空间（来得及躲）', () => {
    for (const e of world.enemies.filter((q) => q.kind === 'urchinHang')) {
      const c = Math.floor(e.body.centerX / TILE);
      let r = Math.floor(e.body.bottom / TILE);
      while (r < g.rows && !standable(g, c, r)) r++;
      const headroom = r * TILE - 14 - e.body.bottom;
      expect(headroom, `倒挂刺海胆 @${c}`).toBeGreaterThanOrEqual(16);
    }
  });
});
