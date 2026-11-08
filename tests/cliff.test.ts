import { describe, expect, it } from 'vitest';
import { TILE } from '../src/sim/constants';
import { T_EMPTY, T_SOLID } from '../src/sim/grid';
import type { EntityDef } from '../src/sim/level';
import { RULES } from '../src/sim/tuning';
import type { World } from '../src/sim/world';
import { BTN, Driver, eventsOf, makeLevelWorld } from './helpers';

/**
 * 第 3 关的地形和机关（docs/levels/1-3.md §3）：裂岩、回声石门、冰晶羊圈、回声铃、
 * NPC 按剧情标记出现、纵向镜头区域、结束状态里的咩铃。
 * 测试地图：地面顶在第 12 行，小满从第 4 列出发。
 */

const GROUND = 12;
const FLOOR = GROUND * TILE;

function map(cols: number, edit?: (put: (c: number, r: number, ch: string) => void) => void) {
  const g = Array.from({ length: 14 }, (_, r) =>
    new Array<string>(cols).fill(r >= GROUND ? '#' : '.'),
  );
  g[GROUND - 1]![4] = 'P';
  edit?.((c, r, ch) => (g[r]![c] = ch));
  return g.map((r) => r.join(''));
}

function world(rows: string[], entities: EntityDef[] = [], flags: string[] = []) {
  const w = makeLevelWorld(rows, { entities }, { flags });
  return { w, d: new Driver(w) };
}

/** 骑上第 8 列的咩铃 */
function ride(w: World, d: Driver): void {
  const g = w.goat!;
  d.run(3, 0);
  w.teleportFeet(g.body.centerX - 4, g.body.bottom);
  d.run(3, 0);
  d.step(BTN.up);
  d.step(0);
  expect(w.player.ride).not.toBeNull();
}

const goat: EntityDef = { type: 'goat', at: [8, GROUND - 1] };

describe('裂岩', () => {
  it('冲撞把相连的一整块裂岩一起撞碎，不减速、不弹回', () => {
    const rows = map(60, (put) => {
      for (let c = 13; c <= 14; c++) for (let r = GROUND - 3; r < GROUND; r++) put(c, r, 'R');
    });
    const { w, d } = world(rows, [goat], ['mieling']);
    ride(w, d);
    d.step(BTN.right);
    d.step(BTN.right | BTN.attack);
    const ev = d.collect(40, BTN.right);
    const br = eventsOf(ev, 'rockBreak');
    expect(br).toHaveLength(1);
    expect(br[0]!.cells).toHaveLength(6);
    expect(eventsOf(ev, 'chargeBonk')).toHaveLength(0);
    for (let r = GROUND - 3; r < GROUND; r++) expect(w.grid.get(13, r)).toBe(T_EMPTY);
    expect(w.player.body.x).toBeGreaterThan(15 * TILE);
  });

  it('徒步顶不碎、海星打不碎，只是普通的墙', () => {
    const rows = map(40, (put) => {
      put(10, GROUND - 1, 'R');
      put(6, GROUND - 4, 'R');
    });
    const { w, d } = world(rows, [], ['starfish']);
    // 从下面顶头顶上那块
    d.run(1, BTN.right);
    w.teleport(6 * TILE + 3, FLOOR - 14);
    const ev = d.collect(30, BTN.jump);
    expect(eventsOf(ev, 'bonk').length).toBeGreaterThan(0);
    expect(w.grid.get(6, GROUND - 4)).toBe(T_SOLID);
    // 海星直扔
    w.teleport(8 * TILE + 3, FLOOR - 14);
    d.run(3, BTN.right);
    d.run(5, 0);
    const ev2 = d.collect(1, BTN.attack);
    ev2.push(...d.collect(60, 0));
    expect(eventsOf(ev2, 'starfishBounce').length).toBeGreaterThan(0);
    expect(w.grid.get(10, GROUND - 1)).toBe(T_SOLID);
    // 走过去：被挡住
    d.run(60, BTN.right);
    expect(w.player.body.right).toBeLessThanOrEqual(10 * TILE);
  });
});

describe('回声石门和回声铃', () => {
  /** 第 20–21 列一面墙，石门在墙脚第 9–10 行，门下面留一格缝；回声铃在门后第 26 列 */
  const gateRows = () =>
    map(80, (put) => {
      for (let c = 20; c <= 21; c++) {
        for (let r = 0; r <= 8; r++) put(c, r, '#');
        put(c, 9, 'D');
        put(c, 10, 'D');
      }
    });
  const bell: EntityDef = { type: 'echoBell', at: [26, GROUND - 1] };

  it('石门底下 1 格高的缝：徒步走得过去，骑着过不去', () => {
    const { w, d } = world(gateRows(), [goat, bell], ['mieling']);
    ride(w, d);
    d.run(120, BTN.right);
    expect(w.player.body.right).toBeLessThanOrEqual(20 * TILE);
    d.run(5, 0);
    d.step(BTN.special);
    d.run(40, 0);
    d.run(120, BTN.right);
    expect(w.player.body.x).toBeGreaterThan(22 * TILE);
  });

  it('站在回声铃旁边按 ↑：触发"回声"；结束后石门打开；再敲只是响', () => {
    const { w, d } = world(gateRows(), [goat, bell], ['mieling']);
    w.teleport(25 * TILE + 3, FLOOR - 14);
    d.run(3, 0);
    expect(w.bellTarget).toBe(true);
    const ev = d.collect(1, BTN.up);
    expect(eventsOf(ev, 'echoRing')).toHaveLength(1);
    expect(w.pendingTrigger).toBe('echo');
    w.resolveTrigger({ flags: ['echo'] });
    expect(eventsOf(w.events, 'gateOpen')).toHaveLength(1);
    for (let c = 20; c <= 21; c++) for (const r of [9, 10]) expect(w.grid.get(c, r)).toBe(T_EMPTY);
    d.run(3, 0);
    const ev2 = d.collect(1, BTN.up);
    expect(eventsOf(ev2, 'echoRing')).toHaveLength(1);
    expect(w.pendingTrigger).toBeNull();
  });

  it('海星打到回声铃也能敲响', () => {
    const { w, d } = world(gateRows(), [bell], ['starfish']);
    w.teleport(23 * TILE + 3, FLOOR - 14);
    d.run(3, BTN.right);
    d.run(5, 0);
    d.step(BTN.attack);
    for (let i = 0; i < 60 && !w.pendingTrigger; i++) d.step(0);
    expect(w.pendingTrigger).toBe('echo');
  });

  it('石门关着时，咩铃不会"找"到门后面去；开了以后会', () => {
    const { w, d } = world(gateRows(), [goat, bell], ['mieling']);
    d.run(3, 0);
    // 小满钻到门后、走远，咩铃留在门前
    w.teleport(40 * TILE + 3, FLOOR - 14);
    const ev = d.collect(300, 0);
    expect(eventsOf(ev, 'goatReturn')).toHaveLength(0);
    w.resolveTrigger({ flags: ['echo'] });
    const ev2 = d.collect(300, 0);
    expect(eventsOf(ev2, 'goatReturn')).toHaveLength(1);
  });
});

describe('冰晶羊圈', () => {
  const crystal: EntityDef = { type: 'crystal', at: [12, GROUND - 3] };

  /** 站到冰晶左边，跳起来往右落到冰晶上 */
  function stompOnce(w: World, d: Driver) {
    w.teleport(12 * TILE + 3, FLOOR - 3 * TILE - 30);
    w.player.vy = 0;
    return d.collect(30, 0);
  }

  it('从上面踩 3 下才碎：前两下弹起来，第三下碎掉并触发"咩铃出圈"', () => {
    const { w, d } = world(map(40), [goat, crystal]);
    expect(w.goat!.mode).toBe('trapped');
    const e1 = stompOnce(w, d);
    expect(eventsOf(e1, 'crystalHit').map((e) => e.stage)).toEqual([1]);
    const e2 = stompOnce(w, d);
    expect(eventsOf(e2, 'crystalHit').map((e) => e.stage)).toEqual([2]);
    const e3 = stompOnce(w, d);
    expect(eventsOf(e3, 'crystalBreak')).toHaveLength(1);
    expect(w.pendingTrigger).toBe('rescue');
    expect(w.crystal).toBeNull();
    // 结束状态：咩铃自由了
    w.resolveTrigger({ flags: ['mieling'], goat: { at: [14, GROUND - 1] } });
    expect(w.goat!.mode).toBe('idle');
    expect(w.goat!.body.centerX).toBe(14 * TILE + 8);
  });

  it('海星打上去"叮"地弹开，冰晶不受伤', () => {
    const { w, d } = world(map(40), [goat, crystal], ['starfish']);
    w.teleport(10 * TILE + 3, FLOOR - 14);
    d.run(3, BTN.right);
    d.run(5, 0);
    d.step(BTN.up);
    const ev = d.collect(1, BTN.up | BTN.attack);
    ev.push(...d.collect(80, 0));
    expect(eventsOf(ev, 'crystalClink')).toHaveLength(1);
    expect(w.crystal!.hp).toBe(RULES.crystalHits);
  });

  it('已经救出过咩铃（再玩这一关）：羊圈上没有冰晶，咩铃在门口等', () => {
    const { w } = world(map(40), [goat, crystal], ['mieling']);
    expect(w.crystal).toBeNull();
    expect(w.goat!.mode).toBe('idle');
  });
});

describe('NPC、镜头区域、结束状态', () => {
  it('NPC 按剧情标记出现：unless 的在标记出现后离场，if 的在标记出现后才在场', () => {
    const { w, d } = world(map(40), [
      { type: 'npc', id: 'a', at: [5, GROUND - 1], unless: 'mieling' },
      { type: 'npc', id: 'b', at: [30, GROUND - 1], if: 'mieling' },
    ]);
    const [a, b] = w.npcs;
    expect([a!.hidden, b!.hidden]).toEqual([false, true]);
    d.run(3, 0);
    expect(w.talkTarget?.id).toBe('a');
    w.resolveTrigger({ flags: ['mieling'] });
    expect([a!.hidden, b!.hidden]).toEqual([true, false]);
    d.run(3, 0);
    expect(w.talkTarget).toBeNull();
  });

  it('纵向镜头区域：起跳时镜头马上跟着往上，不等落地', () => {
    const peak = (zone: boolean) => {
      const { w, d } = world(map(40), zone ? [{ type: 'cameraZone', rect: [0, 0, 40, 14] }] : []);
      d.run(20, 0);
      const y0 = w.camera.y;
      d.run(18, BTN.jump);
      return y0 - w.camera.y;
    };
    // 地图只有 14 行高，镜头往上还有空间（地图顶在镜头之上）
    expect(peak(true)).toBeGreaterThan(peak(false) + 4);
  });

  it('结束状态：mounted: false 让小满从咩铃身上下来，咩铃按 goat 摆好（home 不能骑）', () => {
    const { w, d } = world(map(40), [goat], ['mieling']);
    ride(w, d);
    w.resolveTrigger({
      mounted: false,
      player: [20, GROUND - 1],
      goat: { at: [24, GROUND - 1], facing: -1, mode: 'home' },
    });
    const p = w.player;
    expect(p.ride).toBeNull();
    expect([p.body.w, p.body.h, p.body.bottom]).toEqual([10, 14, FLOOR]);
    expect(p.body.centerX).toBe(20 * TILE + 8);
    const g = w.goat!;
    expect(g.mode).toBe('home');
    expect(g.rideable).toBe(false);
    // 站到她旁边按 ↑ 也骑不上，按 ↓ 能摸
    w.teleportFeet(g.body.centerX - 8, g.body.bottom);
    d.run(3, 0);
    d.step(BTN.up);
    expect(p.ride).toBeNull();
    d.step(0);
    expect(eventsOf(d.collect(1, BTN.down), 'pet')).toHaveLength(1);
  });
});
