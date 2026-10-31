import { describe, expect, it } from 'vitest';
import { TILE } from '../src/sim/constants';
import { RULES } from '../src/sim/tuning';
import { BTN, Driver, eventsOf, makeLevelWorld } from './helpers';

/** 40 列 × 12 行的平地，小满站在第 4 列；extra 是 [行, 列, 字符] 的改动 */
function room(extra: Array<[number, number, string]> = []): string[] {
  const rows: string[][] = [];
  for (let r = 0; r < 12; r++) {
    if (r >= 10) rows.push('#'.repeat(40).split(''));
    else rows.push('.'.repeat(40).split(''));
  }
  rows[9]![4] = 'P';
  for (const [r, c, ch] of extra) rows[r]![c] = ch;
  return rows.map((r) => r.join(''));
}

const withStarfish = { flags: ['starfish'] };

describe('回旋海星', () => {
  it('没有海星时按攻击键不会扔出', () => {
    const w = makeLevelWorld(room());
    const d = new Driver(w);
    const ev = d.collect(30, BTN.attack);
    expect(eventsOf(ev, 'throw')).toHaveLength(0);
    expect(w.starfish.out).toBe(false);
  });

  it('朝面向方向飞出约 5 格，然后折返，被小满接住', () => {
    const w = makeLevelWorld(room(), {}, withStarfish);
    const d = new Driver(w);
    d.step(0);
    const x0 = w.player.body.centerX;
    let far = 0;
    const ev = d.collect(1, BTN.attack);
    expect(eventsOf(ev, 'throw')).toHaveLength(1);
    let caught = false;
    for (let i = 0; i < 120 && !caught; i++) {
      d.step(0);
      far = Math.max(far, w.starfish.body.centerX - x0);
      caught = eventsOf(w.events, 'starfishCatch').length > 0;
    }
    expect(caught).toBe(true);
    // 从手前 4px 扔出，再飞约 80px
    expect(far).toBeGreaterThan(RULES.starfishRange - 2);
    expect(far).toBeLessThan(RULES.starfishRange + 10);
    expect(w.starfish.out).toBe(false);
  });

  it('按住 ↑ 斜着往上 45° 扔', () => {
    const w = makeLevelWorld(room(), {}, withStarfish);
    const d = new Driver(w);
    d.step(0);
    const x0 = w.player.body.centerX;
    const y0 = w.player.body.y + 5;
    d.step(BTN.up);
    d.step(BTN.up | BTN.attack);
    let best = { dx: 0, dy: 0 };
    for (let i = 0; i < 40; i++) {
      d.step(BTN.up);
      const b = w.starfish.body;
      if (w.starfish.state === 'out') best = { dx: b.centerX - x0, dy: y0 - b.centerY };
    }
    expect(best.dy).toBeGreaterThan(40);
    expect(Math.abs(best.dx - 4 - best.dy)).toBeLessThan(6);
  });

  it('同屏只有 1 个：海星还在外面时再按只有一声轻响；接住后要冷却一下', () => {
    const w = makeLevelWorld(room(), {}, withStarfish);
    const d = new Driver(w);
    d.step(0);
    const ev = [...d.collect(1, BTN.attack), ...d.collect(1, 0), ...d.collect(1, BTN.attack)];
    expect(eventsOf(ev, 'throw')).toHaveLength(1);
    expect(eventsOf(ev, 'starfishDud')).toHaveLength(1);
    // 等它回来，接住后马上再按：还在冷却
    for (let i = 0; i < 120 && w.starfish.out; i++) d.step(0);
    expect(w.starfish.out).toBe(false);
    const again = d.collect(1, BTN.attack);
    expect(eventsOf(again, 'throw')).toHaveLength(0);
    d.run(RULES.starfishCooldown + 1, 0);
    expect(eventsOf(d.collect(1, BTN.attack), 'throw')).toHaveLength(1);
  });

  it('去程撞墙立刻折返', () => {
    const w = makeLevelWorld(room([[9, 8, '#']]), {}, withStarfish);
    const d = new Driver(w);
    d.step(0);
    const ev = d.collect(40, BTN.attack);
    expect(eventsOf(ev, 'starfishBounce')).toHaveLength(1);
    expect(w.starfish.body.right).toBeLessThanOrEqual(8 * TILE);
  });

  it('回程穿过地形，一定能回到小满手里', () => {
    const w = makeLevelWorld(
      room([
        [6, 10, '#'],
        [7, 10, '#'],
        [8, 10, '#'],
        [9, 10, '#'],
      ]),
      {},
      withStarfish,
    );
    const d = new Driver(w);
    d.step(0);
    d.step(BTN.attack);
    // 海星飞出去以后，小满被挪到墙的另一边
    d.run(20, 0);
    w.teleport(14 * TILE + 3, 9 * TILE + 2);
    let caught = false;
    for (let i = 0; i < 180 && !caught; i++) {
      d.step(0);
      caught = eventsOf(w.events, 'starfishCatch').length > 0;
    }
    expect(caught).toBe(true);
  });

  it('穿透：一次扔出打倒排成一串的两只螃蟹', () => {
    const w = makeLevelWorld(
      room([
        [9, 7, 'k'],
        [9, 9, 'k'],
      ]),
      {},
      withStarfish,
    );
    const d = new Driver(w);
    d.step(0);
    const ev = d.collect(30, BTN.attack);
    const defeats = eventsOf(ev, 'enemyDefeat').filter((e) => e.cause === 'starfish');
    expect(defeats).toHaveLength(2);
    expect(eventsOf(ev, 'starfishHit')).toHaveLength(2);
  });

  it('捞道具：碰到的贝壳挂在海星上，接住时才算拾取', () => {
    const w = makeLevelWorld(room([[9, 8, 's']]), {}, withStarfish);
    const d = new Driver(w);
    d.step(0);
    const ev = d.collect(20, BTN.attack);
    expect(eventsOf(ev, 'starfishGrab')).toHaveLength(1);
    expect(w.stats.shells).toBe(0);
    for (let i = 0; i < 120 && w.starfish.out; i++) d.step(0);
    expect(w.stats.shells).toBe(1);
  });

  it('从侧面打响铃砖：吐出的道具挂在海星上带回来', () => {
    const w = makeLevelWorld(room([[9, 8, 'M']]), {}, withStarfish);
    const d = new Driver(w);
    d.step(0);
    const ev = d.collect(30, BTN.attack);
    const hit = eventsOf(ev, 'blockHit');
    expect(hit).toHaveLength(1);
    expect(hit[0]!.item).toBe('mango');
    expect(w.blocks.at(8, 9)!.bumpDir).toBe(1);
    expect(w.starfish.carried.map((it) => it.kind)).toEqual(['mango']);
    for (let i = 0; i < 120 && w.starfish.out; i++) d.step(0);
    // 满心时芒果换成贝壳
    expect(w.stats.shells).toBe(RULES.mangoFullShells);
  });

  it('打椰子树的树冠会掉椰子；椰子落地弹两下，碎开掉出 3 枚贝壳', () => {
    const w = makeLevelWorld(
      room(),
      { entities: [{ type: 'coconutTree', at: [8, 9] }] },
      withStarfish,
    );
    const d = new Driver(w);
    d.step(0);
    d.step(BTN.up);
    const ev = [...d.collect(1, BTN.up | BTN.attack), ...d.collect(200, 0)];
    expect(eventsOf(ev, 'coconutDrop')).toHaveLength(1);
    expect(eventsOf(ev, 'coconutBounce').length).toBeGreaterThanOrEqual(1);
    expect(eventsOf(ev, 'coconutBreak')).toHaveLength(1);
    expect(eventsOf(ev, 'itemSpawn').filter((e) => e.kind === 'shell')).toHaveLength(3);
  });

  it('掉海复活时海星直接回到手里', () => {
    const rows = room();
    rows[10] = '#'.repeat(10) + '~'.repeat(30);
    rows[11] = '#'.repeat(10) + '~'.repeat(30);
    const w = makeLevelWorld(rows, {}, withStarfish);
    const d = new Driver(w);
    d.step(0);
    d.step(BTN.attack);
    // 往右走进海里
    for (let i = 0; i < 200 && w.respawnTimer === 0; i++) d.step(BTN.right);
    for (let i = 0; i < 80 && w.respawnTimer > 0; i++) d.step(0);
    expect(w.starfish.out).toBe(false);
  });
});
