import { describe, expect, it } from 'vitest';
import { TILE } from '../src/sim/constants';
import type { SimEvent } from '../src/sim/events';
import type { World } from '../src/sim/world';
import { BTN, Driver, eventsOf, makeLevelWorld } from './helpers';

/**
 * 背包道具在关卡里（docs/levels/1-3.md §5）：
 * - 椰子水：多一颗蓝心，受伤先扣它；芒果补不回蓝心；
 * - 护身海螺：下一次掉坑、掉进冷水时托回去，不扣心，只用一次；骑着的话回来还骑着。
 * 不带道具时一切照旧（回放不受影响）。
 * 测试地图：地面顶在第 12 行（y = 192），小满从第 4 列出发。
 */

const GROUND = 12;

/** cols 列的平地；edit 可以再往上画东西 */
function map(cols: number, edit?: (put: (c: number, r: number, ch: string) => void) => void) {
  const g = Array.from({ length: 14 }, (_, r) =>
    new Array<string>(cols).fill(r >= GROUND ? '#' : '.'),
  );
  g[GROUND - 1]![4] = 'P';
  edit?.((c, r, ch) => (g[r]![c] = ch));
  return g.map((r) => r.join(''));
}

/** 第 c0–c1 列挖成一直通到底的坑 */
const pit = (c0: number, c1: number) => (put: (c: number, r: number, ch: string) => void) => {
  for (let c = c0; c <= c1; c++) for (let r = GROUND; r < 14; r++) put(c, r, '.');
};

/** 一直按住 held，直到出现某种事件（最多 max 帧），返回那一帧的这种事件 */
function until<T extends SimEvent['type']>(
  d: Driver,
  held: number,
  type: T,
  max = 400,
): Array<Extract<SimEvent, { type: T }>> {
  for (let i = 0; i < max; i++) {
    d.step(held);
    const ev = eventsOf(d.world.events, type);
    if (ev.length) return ev;
  }
  throw new Error(`等不到 ${type}`);
}

/** 等到回到安全的地方、能动为止 */
function settle(d: Driver, w: World) {
  for (let i = 0; i < 200 && (w.respawnTimer > 0 || !w.player.onGround); i++) d.step(0);
}

describe('椰子水的蓝心', () => {
  it('螃蟹碰到：先扣蓝心，红心不变；无敌时间过后再碰到才扣红心', () => {
    const w = makeLevelWorld(
      map(40, (put) => put(12, GROUND - 1, 'k')),
      {},
      { blueHearts: 1 },
    );
    const d = new Driver(w);
    expect(w.blueHearts).toBe(1);
    const first = until(d, 0, 'hurt')[0]!;
    expect(first.blue).toBe(true);
    expect(w.blueHearts).toBe(0);
    expect(w.hearts).toBe(w.maxHearts);
    const second = until(d, 0, 'hurt', 900)[0]!;
    expect(second.blue).toBe(false);
    expect(w.hearts).toBe(w.maxHearts - 1);
  });

  it('掉坑：没有海螺时先扣蓝心', () => {
    const w = makeLevelWorld(map(40, pit(8, 12)), {}, { blueHearts: 1 });
    const d = new Driver(w);
    until(d, BTN.right, 'hurt');
    expect(w.blueHearts).toBe(0);
    expect(w.hearts).toBe(w.maxHearts);
  });

  it('芒果只补红心，补不回蓝心', () => {
    // 先被螃蟹扣掉蓝心和一颗红心，再去吃芒果
    const w = makeLevelWorld(
      map(60, (put) => {
        put(10, GROUND - 1, 'k');
        put(30, GROUND - 1, 'm');
      }),
      {},
      { blueHearts: 1 },
    );
    const d = new Driver(w);
    until(d, 0, 'hurt');
    until(d, 0, 'hurt', 900);
    expect(w.hearts).toBe(w.maxHearts - 1);
    expect(w.blueHearts).toBe(0);
    // 螃蟹早就走开了，往右走去吃芒果
    until(d, BTN.right, 'heal', 900);
    expect(w.hearts).toBe(w.maxHearts);
    expect(w.blueHearts).toBe(0);
  });
});

describe('护身海螺', () => {
  it('掉坑：画面不淡出（事件带 conch），泡泡托回去，不扣心；只救一次，第二次照扣', () => {
    const w = makeLevelWorld(map(40, pit(8, 12)), {}, { conch: true });
    const d = new Driver(w);
    const fell = until(d, BTN.right, 'fellOut')[0]!;
    expect(fell.conch).toBe(true);
    const conch = eventsOf(w.events, 'conch')[0]!;
    expect(conch.toY).toBe(GROUND * TILE);
    expect(conch.toX).toBeLessThan(8 * TILE);
    expect(eventsOf(w.events, 'hurt')).toHaveLength(0);
    expect(w.conch).toBe(false);
    expect(w.hearts).toBe(w.maxHearts);
    settle(d, w);
    expect(w.player.body.bottom).toBe(GROUND * TILE);
    expect(w.stats.damaged).toBe(false);
    // 第二次掉下去：海螺已经用掉了，扣一颗心
    const again = until(d, BTN.right, 'fellOut')[0]!;
    expect(again.conch).toBe(false);
    expect(w.hearts).toBe(w.maxHearts - 1);
  });

  it('掉进冷水也算：溅水事件带 conch，不扣心', () => {
    const w = makeLevelWorld(
      map(40, (put) => {
        for (let c = 8; c <= 12; c++) for (let r = GROUND; r < 14; r++) put(c, r, '~');
      }),
      {},
      { conch: true },
    );
    const d = new Driver(w);
    const splash = until(d, BTN.right, 'splash').find((e) => e.big)!;
    expect(splash.conch).toBe(true);
    expect(w.hearts).toBe(w.maxHearts);
    expect(w.conch).toBe(false);
  });

  it('骑着咩铃掉下去：海螺托回来，还骑着', () => {
    const w = makeLevelWorld(
      map(40, pit(14, 18)),
      { entities: [{ type: 'goat', at: [8, GROUND - 1] }] },
      { flags: ['mieling'], conch: true },
    );
    const d = new Driver(w);
    const g = w.goat!;
    d.run(3, 0);
    w.teleportFeet(g.body.centerX - 4, g.body.bottom);
    d.run(3, 0);
    d.step(BTN.up);
    d.step(0);
    expect(w.player.ride).not.toBeNull();
    until(d, BTN.right, 'conch');
    settle(d, w);
    expect(w.player.ride).not.toBeNull();
    expect(w.hearts).toBe(w.maxHearts);
  });
});

describe('不带道具', () => {
  it('和以前完全一样：受伤直接扣红心，掉坑扣一颗心，没有海螺事件', () => {
    const w = makeLevelWorld(map(40, pit(8, 12)));
    expect(w.blueHearts).toBe(0);
    expect(w.conch).toBe(false);
    const d = new Driver(w);
    const fell = until(d, BTN.right, 'fellOut')[0]!;
    expect(fell.conch).toBe(false);
    const hurt = eventsOf(w.events, 'hurt')[0]!;
    expect(hurt.blue).toBe(false);
    expect(w.hearts).toBe(w.maxHearts - 1);
    expect(eventsOf(w.events, 'conch')).toHaveLength(0);
  });
});
