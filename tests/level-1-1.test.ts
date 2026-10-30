import { describe, expect, it } from 'vitest';
import { level11 } from '../src/content/levels/1-1';
import { TILE } from '../src/sim/constants';
import { T_HIDDEN, T_ONEWAY, T_SOLID, type Grid } from '../src/sim/grid';
import { parseLevel } from '../src/sim/level';
import { RULES } from '../src/sim/tuning';
import { World } from '../src/sim/world';
import { cloneTuning, PRESETS } from '../src/sim/tuning';
import { BTN, Driver, flatRows, makeWorld } from './helpers';

const level = parseLevel(level11);
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

describe('1-1 关卡校验', () => {
  it('尺寸、出生点、终点、检查点', () => {
    expect(g.cols).toBe(306);
    expect(g.rows).toBe(18);
    expect(level.markers.filter((m) => m.kind === 'goal')).toHaveLength(1);
    expect(world.checkpoints.map((c) => c.col)).toEqual([146, 221]);
    // 出生点站在地上
    expect(g.solidAt(level.spawn.x, level.spawn.y + 1, 10, 14)).toBe(true);
  });

  it('敌人、NPC、检查点、终点都站在能站的地方', () => {
    for (const m of level.markers.filter((m) => ['enemy', 'checkpoint', 'goal'].includes(m.kind)))
      expect(standable(g, m.col, m.row + 1), `${m.kind} @${m.col},${m.row}`).toBe(true);
    for (const n of world.npcs) {
      const c = Math.floor(n.x / TILE);
      const r = n.y / TILE;
      expect(standable(g, c, r), n.id).toBe(true);
    }
  });

  it('三枚海玻璃：编号 0、1、2 各一枚（风铃、隐藏铃砖、高台）', () => {
    const ids = [
      ...world.blocks.list.filter((b) => b.item === 'glass').map((b) => b.glass),
      ...world.items.list.filter((i) => i.kind === 'glass').map((i) => i.glass),
      world.chimes!.glass,
    ].sort();
    expect(ids).toEqual([0, 1, 2]);
    const hidden = world.blocks.list.find((b) => b.item === 'glass')!;
    expect(hidden.kind).toBe('hidden');
  });

  it('每块隐藏铃砖下方 3–4 格有能站的地方（跳起来撞得到）', () => {
    for (const b of world.blocks.list.filter((x) => x.kind === 'hidden')) {
      expect(g.get(b.col, b.row)).toBe(T_HIDDEN);
      const ok = [3, 4].some(
        (d) => standable(g, b.col, b.row + d + 1) || standable(g, b.col, b.row + d),
      );
      expect(ok, `隐藏铃砖 ${b.col},${b.row}`).toBe(true);
    }
  });

  it('缝隙：最宽 4 格；3 格以上的缝隙前至少有 6 格助跑（PLAN §4.4）', () => {
    const segs = segments(g);
    const wide: string[] = [];
    for (const s of segs) {
      if (s.b >= g.cols - 1) continue;
      // 往右能落脚的地方：高 3 格以内，或者更低
      let best = Infinity;
      for (const t of segs) {
        if (t === s || t.b <= s.b) continue;
        const dh = s.row - t.row;
        if (dh > 3) continue;
        const gap = Math.max(0, t.a - s.b - 1);
        best = Math.min(best, gap);
      }
      expect(best, `第 ${s.row} 行 ${s.a}–${s.b} 列之后`).toBeLessThanOrEqual(4);
      if (best >= 3) {
        expect(s.b - s.a + 1, `第 ${s.row} 行 ${s.a}–${s.b} 列：助跑不够`).toBeGreaterThanOrEqual(
          6,
        );
        wide.push(`${s.b + 1}-${s.b + best}`);
      }
    }
    // 只有两处需要助跑：栈桥尽头（3 格）和考验段（4 格）
    expect(wide.sort()).toEqual(['214-216', '277-280']);
  });

  it('高台（海玻璃 ③）：普通助跑跳够不到，按住跳跃键踩蓝钳够得到', () => {
    const ledge = level.markers.find((m) => m.kind === 'item' && m.data?.kind === 'glass')!;
    const islandTop = 13 * TILE;
    const ledgeTop = (ledge.row + 1) * TILE;
    const need = islandTop - ledgeTop;
    // 助跑跳的最高点（实测）
    const w = makeWorld(flatRows(80, 16, 4));
    const d = new Driver(w);
    d.run(90, BTN.right);
    const base = w.player.body.bottom;
    let top = base;
    d.run(1, BTN.right | BTN.jump);
    for (let i = 0; i < 80; i++) {
      d.step(BTN.right | BTN.jump);
      top = Math.min(top, w.player.body.bottom);
    }
    const runPeak = base - top;
    expect(runPeak + PRESETS.A.tuning.ledgeAssist).toBeLessThan(need);
    // 踩蓝钳弹起：从蟹背（离地 8px）按住跳跃，弹起速度 RULES.stompBounceHeld
    const gravity =
      (2 * PRESETS.A.tuning.jumpHeightTiles * TILE) / PRESETS.A.tuning.jumpTimeToApex ** 2;
    const bouncePeak = 8 + (RULES.stompBounceHeld * RULES.stompBounceHeld) / (2 * gravity);
    expect(bouncePeak).toBeGreaterThan(need);
  });
});
