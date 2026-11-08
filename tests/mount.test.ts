import { describe, expect, it } from 'vitest';
import { TILE } from '../src/sim/constants';
import type { EntityDef } from '../src/sim/level';
import { RULES } from '../src/sim/tuning';
import type { World } from '../src/sim/world';
import { BTN, Driver, eventsOf, makeLevelWorld } from './helpers';

/**
 * 坐骑咩铃（docs/levels/1-3.md §3）：骑上、下来、二段跳、冲撞、被撞下来、走散了自己找回来。
 * 测试地图：地面顶在第 12 行（y = 192），小满从第 4 列出发。
 */

const GROUND = 12;
const FLOOR = GROUND * TILE;

/** 一张 cols 列的平地，edit 可以再往上画东西 */
function map(cols: number, edit?: (put: (c: number, r: number, ch: string) => void) => void) {
  const g = Array.from({ length: 14 }, (_, r) =>
    new Array<string>(cols).fill(r >= GROUND ? '#' : '.'),
  );
  g[GROUND - 1]![4] = 'P';
  edit?.((c, r, ch) => (g[r]![c] = ch));
  return g.map((r) => r.join(''));
}

function goatWorld(rows: string[], goatCol = 8, extra: EntityDef[] = [], flags = ['mieling']) {
  const w = makeLevelWorld(
    rows,
    { entities: [{ type: 'goat', at: [goatCol, GROUND - 1] }, ...extra] },
    { flags },
  );
  return { w, d: new Driver(w) };
}

/** 把小满放到咩铃身边，按 ↑ 骑上 */
function rideNow(w: World, d: Driver): void {
  const g = w.goat!;
  d.run(3, 0);
  w.teleportFeet(g.body.centerX - 4, g.body.bottom);
  d.run(3, 0);
  d.step(BTN.up);
  d.step(0);
  expect(w.player.ride).not.toBeNull();
}

/** 按住 held 直到落地（最多 max 帧），返回期间的事件 */
function untilLanded(d: Driver, held: number, max = 200) {
  const w = d.world;
  const out = [];
  for (let i = 0; i < max; i++) {
    d.step(held);
    out.push(...w.events);
    if (w.player.onGround && i > 2) break;
  }
  return out;
}

describe('骑上和下来', () => {
  it('站在咩铃旁边按 ↑ 骑上：碰撞盒变成 14×24，脚底不动', () => {
    const { w, d } = goatWorld(map(40));
    const g = w.goat!;
    d.run(3, 0);
    w.teleportFeet(g.body.centerX - 6, g.body.bottom);
    d.run(2, 0);
    expect(w.mountTarget).toBe(true);
    const ev = d.collect(1, BTN.up);
    expect(eventsOf(ev, 'mount')[0]?.by).toBe('up');
    const b = w.player.body;
    expect([b.w, b.h, b.bottom]).toEqual([RULES.rideW, RULES.rideH, FLOOR]);
    expect(g.mode).toBe('ridden');
  });

  it('从上面落到她背上也能骑上', () => {
    const { w, d } = goatWorld(map(40));
    const g = w.goat!;
    d.run(3, 0);
    w.teleportFeet(g.body.centerX, g.body.bottom - 40);
    const ev = d.collect(40, 0);
    expect(eventsOf(ev, 'mount')[0]?.by).toBe('land');
  });

  it('还被冻在羊圈里的咩铃骑不了', () => {
    const { w, d } = goatWorld(map(40), 8, [], []);
    const g = w.goat!;
    expect(g.mode).toBe('trapped');
    w.teleportFeet(g.body.centerX - 4, g.body.bottom);
    d.run(3, 0);
    d.step(BTN.up);
    expect(w.player.ride).toBeNull();
  });

  it('按切换键下来：小满往后上方后翻，咩铃留在原地；20 帧内落回她背上不算骑上', () => {
    const { w, d } = goatWorld(map(40));
    rideNow(w, d);
    d.run(2, BTN.right);
    d.run(8, 0);
    const p = w.player;
    const fx = p.body.centerX;
    const ev = d.collect(1, BTN.special);
    expect(eventsOf(ev, 'dismount')).toHaveLength(1);
    expect(eventsOf(ev, 'equipSwitch')).toHaveLength(0);
    expect(p.ride).toBeNull();
    expect([p.body.w, p.body.h]).toEqual([10, 14]);
    expect(p.vy).toBeLessThan(0);
    expect(p.vx).toBeLessThan(0);
    expect(w.goat!.body.centerX).toBe(fx);
    expect(w.goat!.lock).toBeGreaterThan(0);
    // 后翻落在她身后，不会又骑上去
    untilLanded(d, 0);
    expect(p.ride).toBeNull();
    expect(w.goat!.body.x - p.body.right).toBeGreaterThan(0);
    // 过一会儿再跳到她背上：骑上
    d.run(30, 0);
    w.teleportFeet(w.goat!.body.centerX, w.goat!.body.bottom - 36);
    expect(eventsOf(d.collect(40, 0), 'mount')).toHaveLength(1);
  });

  it('徒步站在咩铃旁边按 ↓ 摸摸她', () => {
    const { w, d } = goatWorld(map(40));
    const g = w.goat!;
    d.run(3, 0);
    w.teleportFeet(g.body.centerX - 10, g.body.bottom);
    d.run(2, 0);
    const ev = d.collect(1, BTN.down);
    expect(eventsOf(ev, 'pet')).toHaveLength(1);
    expect(w.flags.has('petted')).toBe(true);
  });

  it('骑着时攻击键是冲撞（不扔海星），切换键是下来（不切装备）', () => {
    const { w, d } = goatWorld(map(40), 8, [], ['mieling', 'starfish']);
    rideNow(w, d);
    const ev = d.collect(1, BTN.attack);
    expect(eventsOf(ev, 'throw')).toHaveLength(0);
    expect(eventsOf(ev, 'chargeWindup')).toHaveLength(1);
    expect(w.starfish.out).toBe(false);
  });
});

describe('骑乘手感', () => {
  it('一按方向就是 165 px/s（小满跑速的 1.1 倍），不用长按', () => {
    const { w, d } = goatWorld(map(60));
    rideNow(w, d);
    d.run(8, BTN.right);
    expect(w.player.vx).toBeCloseTo(165, 0);
    expect(165 / 150).toBeCloseTo(1.1, 5);
  });

  it('第一跳最高约 4.5 格；空中再按一次是二段跳，合起来最高约 8 格；每次腾空只有一次', () => {
    const { w, d } = goatWorld(map(40));
    rideNow(w, d);
    const p = w.player;
    // 只跳一次
    let top = FLOOR;
    for (let i = 0; i < 80; i++) {
      d.step(BTN.jump);
      top = Math.min(top, p.body.bottom);
    }
    untilLanded(d, 0);
    const single = (FLOOR - top) / TILE;
    expect(single).toBeGreaterThan(4.2);
    expect(single).toBeLessThan(4.8);
    // 起跳，到最高点附近再按一次
    d.run(5, 0);
    top = FLOOR;
    let jumps = 0;
    for (let i = 0; i < 160; i++) {
      const pressAgain = p.vy > -30 && jumps === 1;
      const held = pressAgain ? 0 : BTN.jump;
      d.step(held);
      if (pressAgain) {
        d.step(BTN.jump);
        jumps++;
      } else if (jumps === 0) jumps = 1;
      top = Math.min(top, p.body.bottom);
      if (p.onGround && i > 5) break;
    }
    const double = (FLOOR - top) / TILE;
    expect(double).toBeGreaterThan(7.3);
    expect(double).toBeLessThan(8.5);
  });

  it('二段跳在空中只能用一次，落地后恢复', () => {
    const { w, d } = goatWorld(map(40));
    rideNow(w, d);
    const p = w.player;
    d.run(6, BTN.jump);
    d.step(0);
    expect(eventsOf(d.collect(1, BTN.jump), 'doubleJump')).toHaveLength(1);
    d.step(0);
    expect(eventsOf(d.collect(1, BTN.jump), 'doubleJump')).toHaveLength(0);
    untilLanded(d, 0);
    expect(p.ride!.airJumps).toBe(RULES.rideAirJumps);
  });

  it('骑着钻不进 1 格高的洞，下来就能走过去', () => {
    const rows = map(60, (put) => {
      // 第 20–23 列：只有贴着地面的一格是空的
      for (let c = 20; c <= 23; c++) for (let r = 0; r < GROUND - 1; r++) put(c, r, '#');
    });
    const { w, d } = goatWorld(rows);
    rideNow(w, d);
    d.run(120, BTN.right);
    const p = w.player;
    expect(p.body.right).toBeLessThanOrEqual(20 * TILE);
    d.run(5, 0);
    d.step(BTN.special);
    untilLanded(d, 0);
    d.run(120, BTN.right);
    expect(p.body.x).toBeGreaterThan(24 * TILE);
  });
});

describe('冲撞', () => {
  it('蓄力 9 帧（停下来），然后以 330 px/s 冲刺 30 帧，冲完 12 帧内不能再冲', () => {
    const { w, d } = goatWorld(map(90));
    rideNow(w, d);
    d.run(10, BTN.right);
    const p = w.player;
    expect(eventsOf(d.collect(1, BTN.right | BTN.attack), 'chargeWindup')).toHaveLength(1);
    let dashAt = -1;
    for (let i = 1; i <= 12; i++) {
      d.step(BTN.right);
      if (eventsOf(w.events, 'dash').length) {
        dashAt = i;
        break;
      }
    }
    expect(dashAt).toBe(RULES.chargeWindup);
    let frames = 1;
    for (let i = 0; i < 40; i++) {
      // 冲刺中按反方向也不会转身、减速
      d.step(BTN.left);
      if (eventsOf(w.events, 'dashEnd').length) break;
      expect(p.vx).toBe(RULES.chargeSpeed);
      frames++;
    }
    expect(frames).toBe(RULES.chargeFrames);
    expect(eventsOf(d.collect(1, BTN.attack), 'chargeWindup')).toHaveLength(0);
    d.run(RULES.chargeCooldown, 0);
    expect(eventsOf(d.collect(1, BTN.attack), 'chargeWindup')).toHaveLength(1);
  });

  it('蓄力时停下来', () => {
    const { w, d } = goatWorld(map(90));
    rideNow(w, d);
    d.run(10, BTN.right);
    d.step(BTN.right | BTN.attack);
    d.run(7, BTN.right);
    expect(Math.abs(w.player.vx)).toBeLessThan(5);
  });

  it('撞碎一整面沙岩砖墙，不减速', () => {
    const rows = map(60, (put) => {
      for (let r = GROUND - 2; r < GROUND; r++) put(14, r, 'b');
    });
    const { w, d } = goatWorld(rows);
    rideNow(w, d);
    d.step(BTN.right);
    d.step(BTN.right | BTN.attack);
    const ev = d.collect(40, BTN.right);
    expect(eventsOf(ev, 'blockBreak')).toHaveLength(2);
    expect(eventsOf(ev, 'chargeBonk')).toHaveLength(0);
    expect(w.player.body.x).toBeGreaterThan(15 * TILE);
  });

  it('撞到撞不碎的墙：弹回来，晕 18 帧（这期间不能操作）', () => {
    const rows = map(60, (put) => {
      for (let r = 0; r < GROUND; r++) put(16, r, '#');
    });
    const { w, d } = goatWorld(rows);
    rideNow(w, d);
    d.step(BTN.right);
    d.step(BTN.right | BTN.attack);
    const p = w.player;
    let bonk = false;
    for (let i = 0; i < 60 && !bonk; i++) {
      d.step(BTN.right);
      bonk = eventsOf(w.events, 'chargeBonk').length > 0;
    }
    expect(bonk).toBe(true);
    expect(p.vx).toBeLessThan(0);
    expect(w.stun).toBeGreaterThanOrEqual(RULES.chargeBonkStun - 1);
    expect(p.ride!.dash).toBe(0);
  });

  it('冲撞撞飞一排螃蟹，答谢 1、2、3、4 递增，不掉心、不会被撞下来', () => {
    const rows = map(80, (put) => {
      for (const c of [12, 14, 16, 18]) put(c, GROUND - 1, 'k');
    });
    const { w, d } = goatWorld(rows);
    rideNow(w, d);
    const hearts = w.hearts;
    d.step(BTN.right);
    d.step(BTN.right | BTN.attack);
    const ev = d.collect(45, BTN.right);
    const hits = eventsOf(ev, 'enemyDefeat').filter((e) => e.cause === 'charge');
    expect(hits.map((e) => e.reward)).toEqual([1, 2, 3, 4]);
    expect(w.hearts).toBe(hearts);
    expect(w.player.ride).not.toBeNull();
  });

  it('冲撞跳比普通的二段跳远得多', () => {
    const measure = (charge: boolean): number => {
      const { w, d } = goatWorld(map(160));
      rideNow(w, d);
      const p = w.player;
      d.run(10, BTN.right);
      if (charge) {
        d.step(BTN.right | BTN.attack);
        // 冲刺一开始就跳（跳跃键在蓄力的最后几帧按下，留在缓冲里）
        d.run(RULES.chargeWindup - 3, BTN.right);
        d.run(3, BTN.right | BTN.jump);
      } else d.run(1, BTN.right | BTN.jump);
      let x0 = -1;
      let doubled = false;
      for (let i = 0; i < 200; i++) {
        const apex = !doubled && p.vy > -30 && !p.onGround;
        d.step(BTN.right | (apex ? 0 : BTN.jump));
        if (apex) {
          d.step(BTN.right | BTN.jump);
          doubled = true;
        }
        if (x0 < 0 && !p.onGround) x0 = p.body.centerX;
        if (x0 >= 0 && p.onGround) break;
      }
      return (p.body.centerX - x0) / TILE;
    };
    const plain = measure(false);
    const charged = measure(true);
    expect(plain).toBeGreaterThan(9);
    expect(charged).toBeGreaterThan(plain + 3);
  });
});

describe('被撞下来、走散了', () => {
  it('骑着被螃蟹碰到：不扣心，小满被弹开（无敌），咩铃受惊蹦开，到崖边会回头', () => {
    const rows = map(60, (put) => {
      // 左边第 0–4 列是坑
      for (let c = 0; c <= 4; c++) for (let r = GROUND; r < 14; r++) put(c, r, '.');
      put(4, GROUND - 1, '.');
      put(30, GROUND - 1, 'P');
      put(13, GROUND - 1, 'k');
    });
    const { w, d } = goatWorld(rows, 8);
    rideNow(w, d);
    const hearts = w.hearts;
    let knocked = false;
    for (let i = 0; i < 400 && !knocked; i++) {
      d.step(0);
      knocked = eventsOf(w.events, 'knockOff').length > 0;
    }
    expect(knocked).toBe(true);
    expect(w.hearts).toBe(hearts);
    expect(w.player.ride).toBeNull();
    expect(w.iframes).toBeGreaterThan(0);
    const g = w.goat!;
    expect(g.mode).toBe('flee');
    for (let i = 0; i < 120; i++) {
      d.step(0);
      expect(g.body.x, '咩铃不会掉下崖').toBeGreaterThanOrEqual(5 * TILE - 1);
    }
    expect(g.mode).toBe('idle');
    expect(g.body.bottom).toBe(FLOOR);
  });

  it('骑着掉进坑：扣 1 心，回到安全的地方时还骑着', () => {
    const rows = map(60, (put) => {
      for (let c = 20; c <= 30; c++) for (let r = GROUND; r < 14; r++) put(c, r, '.');
    });
    const { w, d } = goatWorld(rows);
    rideNow(w, d);
    const hearts = w.hearts;
    d.run(120, BTN.right);
    d.run(120, 0);
    const p = w.player;
    expect(w.hearts).toBe(hearts - 1);
    expect(p.ride).not.toBeNull();
    expect(p.body.h).toBe(RULES.rideH);
    expect(p.onGround).toBe(true);
    expect(p.body.bottom).toBe(FLOOR);
  });

  it('下来以后走远了：咩铃离开画面 2 秒，就从画面边上蹦回小满身后 1–4 格', () => {
    const { w, d } = goatWorld(map(200));
    rideNow(w, d);
    d.step(BTN.special);
    untilLanded(d, 0);
    const g = w.goat!;
    const cam = w.camera;
    let returns = 0;
    let offscreen = 0;
    for (let i = 0; i < 700; i++) {
      d.step(i < 500 ? BTN.right : 0);
      const back = eventsOf(w.events, 'goatReturn');
      for (const e of back) {
        returns++;
        // 至少离开画面 2 秒才回来（这里的计数和 sim 差一帧镜头）
        expect(offscreen + 1).toBeGreaterThanOrEqual(RULES.goatReturnDelay - 1);
        const behind = (w.player.body.centerX - e.x) * w.player.facing;
        expect(behind).toBeGreaterThanOrEqual(TILE - 1);
        expect(behind).toBeLessThanOrEqual(4 * TILE + 1);
        // 从画面边外蹦进来
        expect(e.fromX < cam.x || e.fromX > cam.x + cam.viewW).toBe(true);
      }
      const gb = g.body;
      const seen = gb.right > cam.x && gb.x < cam.x + cam.viewW;
      offscreen = !back.length && g.mode === 'idle' && !seen ? offscreen + 1 : 0;
    }
    expect(returns).toBeGreaterThan(0);
    // 站定以后她在画面里，站在地上
    expect(g.mode).toBe('idle');
    expect(g.body.bottom).toBe(FLOOR);
    expect(g.body.right > cam.x && g.body.x < cam.x + cam.viewW).toBe(true);
  });

  it('死了以后咩铃在离复活点最近的羊圈里等', () => {
    const rows = map(60, (put) => {
      for (let c = 20; c <= 30; c++) for (let r = GROUND; r < 14; r++) put(c, r, '.');
    });
    const { w, d } = goatWorld(rows, 8, [{ type: 'pen', at: [6, GROUND - 1] }]);
    rideNow(w, d);
    // 连掉三次坑
    for (let k = 0; k < 3; k++) {
      d.run(120, BTN.right);
      d.run(130, 0);
    }
    expect(w.stats.deaths).toBe(1);
    const p = w.player;
    expect(p.ride).toBeNull();
    expect(w.goat!.body.centerX).toBe(6 * TILE + TILE / 2);
    expect(w.goat!.mode).toBe('idle');
  });
});
