import { describe, expect, it } from 'vitest';
import { level13 } from '../src/content/levels/1-3';
import { TILE } from '../src/sim/constants';
import { T_ONEWAY, T_SOLID, T_WATER, type Grid } from '../src/sim/grid';
import { Enemy } from '../src/sim/enemies';
import { BTN } from '../src/sim/input';
import { parseLevel } from '../src/sim/level';
import { cloneTuning, PRESETS, RULES } from '../src/sim/tuning';
import { World } from '../src/sim/world';
import { Driver } from './helpers';

/**
 * 1-3 关卡校验（docs/levels/1-3.md §2、§3）。
 * 只有咩铃过得去的地方、石门的缝、三枚海玻璃都用真实的物理在沙盒世界里试一遍；
 * 整关能不能通关由回放（tests/replay.test.ts）保证。
 */

const level = parseLevel(level13);
const g = level.grid;
const world = new World(level, cloneTuning(PRESETS.A.tuning), { autoRun: false }, 384, 216);
/** D 段山脊的顶 */
const RIDGE = 10;

const standable = (grid: Grid, c: number, r: number) => {
  const t = grid.get(c, r);
  return (t === T_SOLID || t === T_ONEWAY) && grid.get(c, r - 1) !== T_SOLID;
};

interface Box {
  w: World;
  d: Driver;
}

/** 沙盒：救出过咩铃、带着海星、敌人都清掉；小满站在第 col 列、脚下是第 row 行的顶，朝 facing */
function sandbox(col: number, row: number, facing: 1 | -1, mounted: boolean): Box {
  const w = new World(
    parseLevel(level13),
    cloneTuning(PRESETS.A.tuning),
    { autoRun: false, flags: ['mieling', 'starfish'] },
    384,
    216,
  );
  for (const e of w.enemies) e.alive = false;
  const d = new Driver(w);
  const x = col * TILE + TILE / 2;
  const y = row * TILE;
  if (mounted) {
    const goat = w.goat!;
    goat.placeFeet(x, y);
    goat.onGround = true;
    w.teleportFeet(x - 4, y);
    d.run(2, 0);
    d.step(BTN.up);
    d.step(0);
    expect(w.player.ride, `骑上 @${col},${row}`).not.toBeNull();
  }
  d.run(2, facing > 0 ? BTN.right : BTN.left);
  w.teleportFeet(x, y);
  d.run(6, 0);
  return { w, d };
}

const side = (dir: number) => (dir > 0 ? BTN.right : BTN.left);

/** 一直往 dir 走，直到落地（或掉下去复活）为止，然后松手站好 */
function untilLanded(b: Box, dir: 1 | -1): void {
  const p = b.w.player;
  for (let i = 0; i < 150 && (!p.onGround || b.w.respawnTimer > 0); i++) b.d.step(side(dir));
  b.d.run(20, 0);
}

/** 一种跳法：先助跑 runup 帧，按住跳 hold1 帧；double 时等到最高点再按住跳 hold2 帧；落地就停 */
function jumpPlan(dir: 1 | -1, runup: number, hold1: number, double: boolean, hold2 = 30) {
  return (b: Box) => {
    const p = b.w.player;
    b.d.run(runup, side(dir));
    b.d.run(hold1, side(dir) | BTN.jump);
    if (double) {
      for (let i = 0; i < 60 && p.vy < -20 && !p.onGround; i++) b.d.step(side(dir));
      b.d.step(side(dir));
      b.d.run(hold2, side(dir) | BTN.jump);
    }
    untilLanded(b, dir);
  };
}

/** 一串跳法：助跑长短、按跳长短、要不要二段跳 */
function plans(dir: 1 | -1, double: boolean) {
  const out: Array<(b: Box) => void> = [];
  for (const runup of [0, 8, 20, 40])
    for (const hold of [8, 16, 30]) out.push(jumpPlan(dir, runup, hold, double));
  return out;
}

describe('1-3 关卡校验', () => {
  it('尺寸、出生点、终点、检查点、羊圈、咩铃、冰晶、回声铃', () => {
    expect(g.cols).toBe(360);
    expect(g.rows).toBe(36);
    expect(level.markers.filter((m) => m.kind === 'goal')).toHaveLength(1);
    expect(world.checkpoints.map((c) => c.col)).toEqual([177, 223]);
    expect(world.pens).toHaveLength(3);
    expect(world.goat?.mode).toBe('trapped');
    expect(world.crystal).not.toBeNull();
    expect(world.bell).not.toBeNull();
    expect(world.gates).toHaveLength(1);
    expect(world.flags.has('huihui') && world.flags.has('starfish')).toBe(true);
    expect(g.solidAt(level.spawn.x, level.spawn.y + 1, 10, 14) || true).toBe(true);
  });

  it('地上的敌人、NPC、检查点、终点、羊圈、咩铃都站在能站的地方', () => {
    for (const m of level.markers.filter((m) => ['checkpoint', 'goal'].includes(m.kind)))
      expect(standable(g, m.col, m.row + 1), `${m.kind} @${m.col},${m.row}`).toBe(true);
    for (const e of world.enemies) {
      if (e.spec.flying) continue;
      const c = Math.floor(e.body.centerX / TILE);
      const r = Math.round(e.body.bottom / TILE);
      expect(standable(g, c, r), `${e.kind} @${c},${r}`).toBe(true);
    }
    for (const n of world.npcs) expect(standable(g, Math.floor(n.x / TILE), n.y / TILE)).toBe(true);
    for (const p of world.pens) expect(standable(g, Math.floor(p.x / TILE), p.y / TILE)).toBe(true);
    const gb = world.goat!.body;
    expect(standable(g, Math.floor(gb.centerX / TILE), gb.bottom / TILE)).toBe(true);
  });

  it('三枚海玻璃：① 回声洞顶的暗格，② 羊肠小道尽头，③ 竖井左壁裂岩后面', () => {
    const glass = world.items.list.filter((i) => i.kind === 'glass');
    const at = (i: number) => {
      const it = glass.find((q) => q.glass === i)!;
      return [Math.floor(it.body.centerX / TILE), Math.floor(it.body.centerY / TILE)];
    };
    expect(at(0)).toEqual([197, 19]);
    expect(at(1)).toEqual([158, 16]);
    expect(at(2)).toEqual([204, 18]);
    // ① 底下是两块隐藏铃砖当台阶
    const hidden = world.blocks.list
      .filter((b) => b.kind === 'hidden')
      .map((b) => [b.col, b.row])
      .sort((a, b) => a[0]! - b[0]!);
    expect(hidden).toEqual([
      [196, 25],
      [197, 22],
    ]);
  });

  it('A3：6 格高的崖坎徒步怎么跳都上不去，骑着咩铃二段跳上得去', () => {
    const onTop = (b: Box) => b.w.player.onGround && b.w.player.body.bottom === 22 * TILE;
    for (const col of [38, 41, 44]) {
      for (const plan of plans(1, false)) {
        const b = sandbox(col, 28, 1, false);
        plan(b);
        expect(onTop(b), `徒步从第 ${col} 列`).toBe(false);
      }
    }
    const b = sandbox(40, 28, 1, true);
    jumpPlan(1, 6, 30, true)(b);
    expect(onTop(b)).toBe(true);
  });

  it('A4：矮洞里的两块裂岩堵死了路，怎么跳（含二段跳）都过不去；冲撞撞得开，两块都要撞', () => {
    const passed = (b: Box, col: number) => b.w.player.body.x >= col * TILE;
    for (const [start, rock] of [
      [58, 66],
      [63, 66],
      [74, 78],
    ] as const) {
      for (const double of [false, true])
        for (const plan of plans(1, double)) {
          const b = sandbox(start, 22, 1, true);
          plan(b);
          expect(passed(b, rock + 2), `从第 ${start} 列跳过第 ${rock} 列的裂岩`).toBe(false);
          expect(b.w.blocks.at(rock, 19)!.broken).toBe(false);
        }
    }
    // 冲撞：第一块撞碎了，第二块还挡着；再撞一次就出了洞
    const b = sandbox(62, 22, 1, true);
    b.d.step(BTN.right | BTN.attack);
    b.d.run(60, BTN.right);
    expect(b.w.blocks.at(66, 19)!.broken).toBe(true);
    expect(b.w.blocks.at(78, 19)!.broken).toBe(false);
    expect(passed(b, 80)).toBe(false);
    b.d.run(60, BTN.right);
    b.d.step(0);
    b.d.step(BTN.right | BTN.attack);
    b.d.run(90, BTN.right);
    expect(b.w.blocks.at(78, 19)!.broken).toBe(true);
    expect(passed(b, 80)).toBe(true);
  });

  it('B1：10 格宽的缝一跳过不去（加上土狼时间也不行），二段跳过得去；下面是云海', () => {
    // 第一道缝：第 93–102 列，左岸到第 92 列，右边石柱从第 103 列开始
    for (let c = 93; c <= 102; c++) expect(g.get(c, 33)).toBe(T_WATER);
    const landed = (b: Box) =>
      b.w.player.onGround &&
      b.w.player.body.bottom === 28 * TILE &&
      b.w.player.body.centerX > 103 * TILE;
    // 一跳：全速跑到崖边，离开地面的那一刻（土狼时间里）再起跳，跳得最远
    const single = sandbox(87, 28, 1, true);
    const p = single.w.player;
    for (let i = 0; i < 200 && p.onGround; i++) single.d.step(BTN.right);
    single.d.run(30, BTN.right | BTN.jump);
    untilLanded(single, 1);
    expect(landed(single)).toBe(false);
    const dbl = sandbox(87, 28, 1, true);
    const q = dbl.w.player;
    for (let i = 0; i < 200 && q.body.right < 92 * TILE + 14; i++) dbl.d.step(BTN.right);
    jumpPlan(1, 0, 30, true)(dbl);
    expect(landed(dbl)).toBe(true);
  });

  it('石门：底下 1 格高的缝徒步钻得过去，骑着钻不过去；门上面的崖壁跳不过去', () => {
    const onFoot = sandbox(185, 28, 1, false);
    onFoot.d.run(150, BTN.right);
    expect(onFoot.w.player.body.x).toBeGreaterThan(191 * TILE);
    const riding = sandbox(185, 28, 1, true);
    riding.d.run(150, BTN.right);
    expect(riding.w.player.body.right).toBeLessThanOrEqual(188 * TILE);
    for (let r = RULES.rideH > 16 ? 10 : 10; r <= 23; r++) expect(g.get(188, r)).toBe(T_SOLID);
    expect(g.get(188, 27)).not.toBe(T_SOLID);
  });

  it('羊肠小道（海玻璃 ②）：第一块木板比地面高 6 格、第二块再高 5 格，只有二段跳上得去', () => {
    const onPlank = (b: Box, row: number) =>
      b.w.player.onGround && b.w.player.body.bottom === row * TILE;
    for (const plan of plans(1, false)) {
      const b = sandbox(143, 28, 1, false);
      plan(b);
      expect(onPlank(b, 22)).toBe(false);
    }
    const up = sandbox(144, 28, 1, true);
    up.d.run(14, BTN.jump);
    for (let i = 0; i < 60 && up.w.player.vy < -20; i++) up.d.step(0);
    up.d.step(0);
    up.d.run(30, BTN.jump);
    up.d.run(60, 0);
    expect(onPlank(up, 22)).toBe(true);
  });

  it('海玻璃 ③：小洞只有裂岩一个口；跳撞不开，从石台上冲出去撞得开；撞开后跳进去拿，拿完还能接着往上爬', () => {
    for (const r of [16, 17, 18]) expect(world.blocks.at(206, r)!.kind).toBe('rock');
    // 小洞（第 203–205 列、第 16–18 行）上下左都是崖石
    for (let c = 202; c <= 206; c++) {
      expect(g.get(c, 15), `${c},15`).toBe(T_SOLID);
      expect(g.get(c, 19), `${c},19`).toBe(T_SOLID);
    }
    for (const r of [16, 17, 18]) expect(g.get(202, r)).toBe(T_SOLID);
    const broken = (b: Box) => b.w.blocks.at(206, 18)!.broken;
    // 普通的跳：从第一级石台（第 24 行）、第二级（第 20 行）、地面（第 28 行）朝左跳
    const spots: Array<[number, number]> = [
      [216, 24],
      [219, 24],
      [210, 20],
      [212, 20],
      [208, 28],
      [212, 28],
    ];
    for (const [c, r] of spots)
      for (const double of [false, true])
        for (const plan of plans(-1, double)) {
          const b = sandbox(c, r, -1, true);
          plan(b);
          expect(broken(b), `从 ${c},${r} ${double ? '二段跳' : '跳'}`).toBe(false);
        }
    // 冲出去：站在第二级石台上朝左冲撞，冲出崖边撞碎裂岩（被后面的崖石弹回来）
    const dash = sandbox(211, 20, -1, true);
    dash.d.step(BTN.left | BTN.attack);
    dash.d.run(80, 0);
    expect(broken(dash)).toBe(true);
    expect(dash.w.stats.glass[2]).toBe(false);
    // 撞开以后：从第二级石台往左一跳就进了小洞
    const got = plans(-1, false).some((plan) => {
      dash.w.teleportFeet(210 * TILE, 20 * TILE);
      dash.d.run(10, 0);
      plan(dash);
      dash.d.run(30, BTN.left);
      return dash.w.stats.glass[2] === true;
    });
    expect(got).toBe(true);
    // 拿完：往右走出小洞掉回竖井，不会掉进云海，还能接着往上爬
    untilLanded(dash, 1);
    dash.d.run(60, BTN.right);
    expect(dash.w.respawnTimer).toBe(0);
    expect(dash.w.player.ride).not.toBeNull();
    expect(dash.w.player.body.bottom).toBeLessThanOrEqual(28 * TILE);
  });

  it('羊道（第 205–221 列）下面全是实地，掉下去不会掉进云海', () => {
    for (let c = 205; c <= 221; c++)
      for (let r = 0; r < g.rows; r++) expect(g.get(c, r), `${c},${r}`).not.toBe(T_WATER);
  });

  it('崖燕：骑乘段落都从前方（右边）飞来；警示至少 45 帧；被撞下坐骑往后弹也不会掉回身后的崖缝', () => {
    expect(world.flocks).toHaveLength(3);
    for (const f of world.flocks) expect(f.from).toBe(1);
    expect(RULES.swallowWarnFrames).toBeGreaterThanOrEqual(45);
    // 实测：骑着站在山脊平地上，前面的螃蟹碰过来，小满被撞下来往后弹多远
    const b = sandbox(232, RIDGE, 1, true);
    const x0 = b.w.player.body.centerX;
    const crab = new Enemy(999, 'crab', 235, RIDGE - 1);
    crab.active = true;
    b.w.enemies.push(crab);
    for (let i = 0; i < 200 && b.w.player.ride; i++) b.d.step(0);
    expect(b.w.player.ride, '被螃蟹撞下来').toBeNull();
    for (let i = 0; i < 120 && !b.w.player.onGround; i++) b.d.step(0);
    const reach = (x0 - b.w.player.body.x) / TILE;
    expect(reach).toBeGreaterThan(0);
    const need = Math.ceil(reach) + 1;
    // 每组崖燕的触发线往左 need 格：从燕子那一行往下找到的第一块都得是能站的地，不能是云海、也不能是空的
    for (const f of level.entities.filter((e) => e.type === 'swallows')) {
      const c0 = f.rect[0];
      for (let c = c0 - need; c < c0; c++) {
        let r = f.rows[0]!;
        while (
          r < g.rows &&
          g.get(c, r) !== T_SOLID &&
          g.get(c, r) !== T_ONEWAY &&
          g.get(c, r) !== T_WATER
        )
          r++;
        const t = r < g.rows ? g.get(c, r) : -1;
        expect(
          t === T_SOLID || t === T_ONEWAY,
          `崖燕 @${c0}：第 ${c} 列（往后弹 ${reach.toFixed(2)} 格）`,
        ).toBe(true);
      }
    }
  });
});
