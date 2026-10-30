import { describe, expect, it } from 'vitest';
import { BlockSet } from '../src/sim/blocks';
import { Chimes, CHIME_SEQUENCE } from '../src/sim/chimes';
import { TILE } from '../src/sim/constants';
import { Grid, T_EMPTY, T_SOLID } from '../src/sim/grid';
import { RULES } from '../src/sim/tuning';
import { BTN, Driver, eventsOf, makeLevelWorld } from './helpers';

/** 12 行的小关卡：第 10–11 行是地面，body 是第 0–9 行 */
function rows(body: string[], width = 30): string[] {
  const pad = (s: string) => s.padEnd(width, '.');
  const out = body.map(pad);
  while (out.length < 10) out.unshift(pad(''));
  out.push('#'.repeat(width), '#'.repeat(width));
  return out;
}

describe('铃砖与沙岩砖', () => {
  it('从下面顶铃砖：吐出 1 枚贝壳，之后变成用过的砖，再顶只有闷响', () => {
    const w = makeLevelWorld(rows(['......B', '', '', '......P']));
    const d = new Driver(w);
    const ev = d.collect(40, BTN.jump);
    const hit = eventsOf(ev, 'blockHit');
    expect(hit).toHaveLength(1);
    expect(hit[0]).toMatchObject({ kind: 'bell', item: 'shell', used: true });
    expect(w.stats.shells).toBe(1);
    expect(eventsOf(ev, 'collect')[0]).toMatchObject({ kind: 'shell', fromBlock: true });
    d.run(20, 0);
    expect(eventsOf(d.collect(40, BTN.jump), 'blockEmpty')).toHaveLength(1);
    expect(w.stats.shells).toBe(1);
  });

  it('沙岩砖被顶碎，格子变空', () => {
    const w = makeLevelWorld(rows(['......b', '', '', '......P']));
    const ev = new Driver(w).collect(40, BTN.jump);
    expect(eventsOf(ev, 'blockBreak')).toHaveLength(1);
    expect(w.grid.get(6, 6)).toBe(T_EMPTY);
  });

  it('多次铃砖：时限内最多 8 枚；时限过后再顶一下就用完', () => {
    const g = new Grid(4, 4);
    g.set(1, 1, T_SOLID);
    const set = new BlockSet(g);
    const b = set.add(1, 1, 'multi', 'shell');
    for (let i = 0; i < 8; i++) expect(set.hit(1, 1)?.item).toBe('shell');
    expect(b.used).toBe(true);
    expect(set.hit(1, 1)?.empty).toBe(true);

    const g2 = new Grid(4, 4);
    const set2 = new BlockSet(g2);
    const b2 = set2.add(1, 1, 'multi', 'shell');
    set2.hit(1, 1);
    for (let i = 0; i < RULES.multiBlockFrames; i++) set2.step();
    expect(set2.hit(1, 1)?.item).toBe('shell');
    expect(b2.used).toBe(true);
    expect(b2.hits).toBe(2);
  });

  it('隐藏铃砖：横着走能穿过去；从下面跳起来撞到才现身并挡住', () => {
    const w = makeLevelWorld(rows(['......?', '', '', '..P.....?']));
    const d = new Driver(w);
    // 第 9 行那块隐藏砖挡不住横向移动
    d.run(60, BTN.right);
    expect(w.player.body.x).toBeGreaterThan(9 * TILE);
    w.teleport(6 * TILE + 3, 9 * TILE + 2);
    const ev = d.collect(40, BTN.jump);
    expect(eventsOf(ev, 'blockReveal')).toHaveLength(1);
    expect(eventsOf(ev, 'blockHit')).toHaveLength(1);
    expect(w.grid.get(6, 6)).toBe(T_SOLID);
    // 头顶被挡住：没有越过隐藏砖的底边
    expect(Math.min(...[w.player.body.y])).toBeGreaterThanOrEqual(7 * TILE);
  });

  it('芒果铃砖：芒果冒出来、落地；受伤时 +1 心，满心时换 3 枚贝壳', () => {
    for (const hurt of [true, false]) {
      const w = makeLevelWorld(rows(['......M', '', '', '......P']));
      const d = new Driver(w);
      const ev = d.collect(30, BTN.jump);
      expect(eventsOf(ev, 'itemSpawn')[0]).toMatchObject({ kind: 'mango' });
      d.run(90, 0);
      const mango = w.items.list.find((i) => i.kind === 'mango')!;
      expect(mango.onGround).toBe(true);
      if (hurt) w.hearts = 2;
      const got = d.collect(120, mango.body.centerX > w.player.body.centerX ? BTN.right : BTN.left);
      expect(eventsOf(got, 'collect').some((e) => e.kind === 'mango')).toBe(true);
      if (hurt) {
        expect(w.hearts).toBe(3);
        expect(eventsOf(got, 'heal')).toHaveLength(1);
      } else {
        expect(w.stats.shells).toBe(RULES.mangoFullShells);
      }
    }
  });

  it('顶砖时砖顶上的螃蟹被顶飞', () => {
    const w = makeLevelWorld(rows(['.......k', '....bbbbbb', '', '', '.......P']));
    const ev = new Driver(w).collect(30, BTN.jump);
    const def = eventsOf(ev, 'enemyDefeat');
    expect(def).toHaveLength(1);
    expect(def[0]!.cause).toBe('bump');
  });
});

describe('道具', () => {
  it('连续拾取贝壳时序号递增（音高逐级升高）', () => {
    const w = makeLevelWorld(rows(['..P.sssss']));
    const ev = new Driver(w).collect(80, BTN.right);
    const chain = eventsOf(ev, 'collect').map((e) => e.chain);
    expect(chain).toEqual([0, 1, 2, 3, 4]);
    expect(w.stats.shells).toBe(5);
  });

  it('海玻璃：编号来自实体表；以前找到过的不重复计数', () => {
    const def = {
      entities: [{ type: 'glass' as const, at: [6, 9] as [number, number], index: 2 }],
    };
    const w = makeLevelWorld(rows(['..P...g']), def);
    let ev = new Driver(w).collect(60, BTN.right);
    expect(eventsOf(ev, 'collect')[0]).toMatchObject({ kind: 'glass', glass: 2, ghost: false });
    expect(w.stats.glass).toEqual([false, false, true]);

    const w2 = makeLevelWorld(rows(['..P...g']), def, { foundGlass: [false, false, true] });
    ev = new Driver(w2).collect(60, BTN.right);
    expect(eventsOf(ev, 'collect')[0]).toMatchObject({ glass: 2, ghost: true });
    expect(w2.stats.glass).toEqual([false, false, false]);
  });
});

describe('敌人与战斗', () => {
  it('从上面踩中螃蟹：打倒、答谢 1 枚贝壳、弹起', () => {
    const w = makeLevelWorld(rows(['............P', '', '', '............k']));
    const ev = new Driver(w).collect(30, 0);
    expect(eventsOf(ev, 'enemyDefeat')[0]).toMatchObject({ cause: 'stomp', reward: 1 });
    expect(eventsOf(ev, 'stomp')).toHaveLength(1);
    expect(w.stats.shells).toBe(1);
    expect(w.hearts).toBe(3);
  });

  it('按住跳跃键踩中弹得更高（技巧海玻璃要用）', () => {
    const rise = (held: number) => {
      const w = makeLevelWorld(rows(['............P', '', '', '............k'], 30));
      const d = new Driver(w);
      let stompY = 0;
      let minY = Infinity;
      for (let i = 0; i < 90; i++) {
        d.step(held);
        if (w.events.some((e) => e.type === 'stomp')) stompY = w.player.body.bottom;
        if (stompY) minY = Math.min(minY, w.player.body.bottom);
      }
      return stompY - minY;
    };
    const low = rise(0);
    const high = rise(BTN.jump);
    expect(low).toBeGreaterThan(16);
    expect(low).toBeLessThan(40);
    expect(high).toBeGreaterThan(88);
  });

  it('同一步落在两只螃蟹身上：两只都算踩中，连踩答谢 1 + 2 枚', () => {
    const w = makeLevelWorld(rows(['............P', '', '', '............kk']));
    const ev = new Driver(w).collect(30, 0);
    const def = eventsOf(ev, 'enemyDefeat');
    expect(def.map((e) => e.reward)).toEqual([1, 2]);
    expect(w.stats.shells).toBe(3);
  });

  it('被螃蟹碰到：扣 1 心、击退、无敌期间不会再受伤', () => {
    const w = makeLevelWorld(rows(['....P...k']));
    const d = new Driver(w);
    const ev = d.collect(150, 0);
    const hurt = eventsOf(ev, 'hurt');
    expect(hurt).toHaveLength(1);
    expect(hurt[0]!.dir).toBe(-1);
    expect(w.hearts).toBe(2);
    expect(w.iframes).toBeGreaterThan(0);
  });

  it('蓝钳在平台边缘回头；普通霜壳蟹会走下去', () => {
    const plat = (ch: string) => [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      `.......${ch}`,
      '.....######.......######',
      '....................P',
    ];
    const make = (ch: string) => {
      const r = plat(ch).map((s) => s.padEnd(30, '.'));
      r.push('..................######......', '..................######......');
      return makeLevelWorld(r);
    };
    const w1 = make('K');
    new Driver(w1).run(600, 0);
    const k = w1.enemies[0]!;
    expect(k.alive).toBe(true);
    expect(k.body.x).toBeGreaterThanOrEqual(5 * TILE);
    expect(k.body.right).toBeLessThanOrEqual(11 * TILE);

    const w2 = make('k');
    const ev = new Driver(w2).collect(600, 0);
    expect(eventsOf(ev, 'enemyLost')).toHaveLength(1);
    expect(w2.enemies[0]!.alive).toBe(false);
  });

  it('太阳果期间碰到敌人直接净化，不受伤；跑速变快', () => {
    const w = makeLevelWorld(rows(['....P...k']));
    w.sunTimer = 200;
    expect(w.speedMul).toBeCloseTo(RULES.sunSpeedMul);
    const ev = new Driver(w).collect(150, 0);
    expect(eventsOf(ev, 'enemyDefeat')[0]).toMatchObject({ cause: 'sun' });
    expect(eventsOf(ev, 'hurt')).toHaveLength(0);
  });

  it('停顿期间按下的键不会丢', () => {
    const w = makeLevelWorld(rows(['............P', '', '', '............k']));
    const d = new Driver(w);
    let i = 0;
    while (!w.events.some((e) => e.type === 'stomp') && i++ < 40) d.step(0);
    expect(w.hitstop).toBeGreaterThan(0);
    d.step(BTN.jump);
    while (w.hitstop > 0) d.step(BTN.jump);
    d.step(BTN.jump);
    expect(w.player.buffer).toBeGreaterThan(0);
  });
});

describe('掉海、死亡与检查点', () => {
  const sea = () => {
    const r = rows(['..P...C'], 30);
    r[10] = '########~~~~##################';
    r[11] = '########~~~~##################';
    return r;
  };

  it('掉进海里：水花、扣 1 心、0.6 秒后回到岸上并有无敌帧', () => {
    const w = makeLevelWorld(sea());
    const d = new Driver(w);
    const ev = d.collect(90, BTN.right);
    expect(eventsOf(ev, 'splash')[0]?.big).toBe(true);
    expect(w.hearts).toBe(2);
    const after = d.collect(RULES.fallRespawnFrames + 2, 0);
    const back = eventsOf([...ev, ...after], 'respawn');
    expect(back[0]).toMatchObject({ cause: 'water' });
    expect(w.player.body.right).toBeLessThanOrEqual(8 * TILE);
    expect(w.iframes).toBeGreaterThan(0);
  });

  it('心归零：死亡演出后回到检查点，满心复活', () => {
    const w = makeLevelWorld(sea());
    w.hearts = 1;
    const d = new Driver(w);
    const ev = d.collect(90, BTN.right);
    expect(eventsOf(ev, 'checkpoint')).toHaveLength(1);
    expect(eventsOf(ev, 'death')).toHaveLength(1);
    expect(w.state).toBe('dying');
    const after = d.collect(RULES.deathFrames + 1, 0);
    expect(eventsOf(after, 'respawn')[0]).toMatchObject({ cause: 'death' });
    expect(w.state).toBe('play');
    expect(w.hearts).toBe(3);
    expect(Math.floor(w.player.body.centerX / TILE)).toBe(6);
    expect(w.stats.deaths).toBe(1);
  });

  it('检查点只往前更新；走进铃门就通关', () => {
    const w = makeLevelWorld(rows(['..P..C....C....G']));
    const d = new Driver(w);
    const ev = d.collect(200, BTN.right);
    expect(eventsOf(ev, 'checkpoint').map((e) => e.index)).toEqual([1, 2]);
    expect(w.checkpointIndex).toBe(2);
    expect(eventsOf(ev, 'clear')).toHaveLength(1);
    expect(w.state).toBe('clear');
  });
});

describe('触发区、交谈、风铃', () => {
  it('阻塞触发：世界停下等过场，结束状态生效后继续', () => {
    const w = makeLevelWorld(rows(['..P']), {
      entities: [{ type: 'trigger', id: 'scene', rect: [8, 0, 1, 12] }],
    });
    const d = new Driver(w);
    const ev = d.collect(80, BTN.right);
    expect(eventsOf(ev, 'trigger')[0]).toMatchObject({ id: 'scene', blocking: true });
    expect(w.pendingTrigger).toBe('scene');
    const f = w.frame;
    d.run(10, BTN.right);
    expect(w.frame).toBe(f);
    w.resolveTrigger({ player: [12, 9], facing: -1, flags: ['seen'] });
    expect(w.flags.has('seen')).toBe(true);
    expect(Math.floor(w.player.body.centerX / TILE)).toBe(12);
    expect(w.player.facing).toBe(-1);
    d.run(5, 0);
    expect(w.frame).toBeGreaterThan(f);
  });

  it('靠近 NPC 按 ↑ 交谈', () => {
    const w = makeLevelWorld(rows(['.....P']), {
      entities: [{ type: 'npc', id: 'aunt', at: [6, 9] }],
    });
    const d = new Driver(w);
    d.run(2, 0);
    expect(w.talkTarget?.id).toBe('aunt');
    const ev = d.collect(1, BTN.up);
    expect(eventsOf(ev, 'talk')[0]?.id).toBe('aunt');
    expect(w.pendingTalk).toBe('aunt');
    w.resolveTalk();
    expect(w.pendingTalk).toBeNull();
  });

  it('风铃按"大、小、中、大"碰响才解开', () => {
    const c = new Chimes(0, 0, 0);
    const touch = (i: number) => c.step(c.rects[i]!);
    const away = () => {
      for (let k = 0; k < 25; k++) c.step({ x: -100, y: -100, w: 1, h: 1 });
    };
    for (const i of [0, 1, 1, 0]) {
      touch(i);
      away();
    }
    expect(c.solved).toBe(false);
    let solved = false;
    for (const i of CHIME_SEQUENCE) {
      solved = touch(i).solvedNow;
      away();
    }
    expect(solved).toBe(true);
  });

  it('关卡里解开风铃：掉出海玻璃', () => {
    const w = makeLevelWorld(rows(['..P']), {
      entities: [{ type: 'chimes', at: [5, 2], glass: 0 }],
    });
    const d = new Driver(w);
    const ch = w.chimes!;
    let spawned = false;
    for (const i of CHIME_SEQUENCE) {
      const r = ch.rects[i]!;
      w.teleport(r.x - 2, r.y);
      d.step(0);
      spawned ||= w.events.some((e) => e.type === 'chimeSolved');
      w.teleport(2 * TILE, 9 * TILE + 2);
      d.run(25, 0);
    }
    expect(spawned).toBe(true);
    expect(w.items.list.some((i) => i.kind === 'glass' && i.glass === 0)).toBe(true);
  });
});
