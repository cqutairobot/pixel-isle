import { describe, expect, it } from 'vitest';
import { TILE } from '../src/sim/constants';
import type { EntityDef } from '../src/sim/level';
import { RULES } from '../src/sim/tuning';
import { BTN, Driver, eventsOf, makeLevelWorld } from './helpers';

/**
 * 崖燕（docs/levels/1-3.md §3）：2–3 只一组。小满走进触发区，先在画面边上警示 45 帧，
 * 然后一只隔 16 帧，从画面边外出发，以 180 px/s 直线横着掠过画面。
 */

const GROUND = 12;
const FLOOR = GROUND * TILE;

function map(cols: number): string[] {
  const g = Array.from({ length: 14 }, (_, r) =>
    new Array<string>(cols).fill(r >= GROUND ? '#' : '.'),
  );
  g[GROUND - 1]![4] = 'P';
  return g.map((r) => r.join(''));
}

/** 一组两只：第 9 行（头顶上方）和第 11 行（小满身体的高度），从右边来 */
function flockWorld(rows = [9, 11], flags: string[] = [], extra: EntityDef[] = []) {
  const w = makeLevelWorld(
    map(120),
    {
      entities: [{ type: 'swallows', rect: [10, 0, 2, 14], rows, from: 1 }, ...extra],
    },
    { flags },
  );
  return { w, d: new Driver(w) };
}

const swallows = (w: ReturnType<typeof flockWorld>['w']) =>
  w.enemies.filter((e) => e.kind === 'swallow');

describe('崖燕', () => {
  it('载入时不显示、不活动；走进触发区先警示 45 帧，然后才从画面右边外出发', () => {
    const { w, d } = flockWorld();
    const list = swallows(w);
    expect(list).toHaveLength(2);
    d.run(60, 0);
    expect(list.every((e) => !e.active && e.mode === 'wait')).toBe(true);
    // 走进触发区
    let warnAt = -1;
    let enterAt = -1;
    const cam = w.camera;
    for (let i = 0; i < 400; i++) {
      d.step(i < 100 ? BTN.right : 0);
      const warn = eventsOf(w.events, 'swallowWarn')[0];
      if (warn) {
        warnAt = i;
        expect(warn.from).toBe(1);
        expect(warn.frames).toBe(RULES.swallowWarnFrames);
        expect(warn.ys).toHaveLength(2);
      }
      if (enterAt < 0 && list.some((e) => e.active && e.body.x < cam.x + cam.viewW)) enterAt = i;
    }
    expect(warnAt).toBeGreaterThanOrEqual(0);
    expect(enterAt - warnAt).toBeGreaterThanOrEqual(RULES.swallowWarnFrames);
  });

  it('直线横飞：高度不变、180 px/s；一只隔 16 帧；飞出画面左边就回到待命（不算打倒）', () => {
    const { w, d } = flockWorld([5, 6]);
    for (let i = 0; i < 100 && !eventsOf(w.events, 'swallowWarn').length; i++) d.step(BTN.right);
    d.run(RULES.swallowWarnFrames, 0);
    const [a, b] = swallows(w);
    expect(a!.active).toBe(true);
    const y0 = a!.body.y;
    const x0 = a!.body.x;
    d.run(10, 0);
    expect(a!.body.y).toBe(y0);
    expect(x0 - a!.body.x).toBe(30);
    expect(b!.active).toBe(false);
    d.run(RULES.swallowGap - 10, 0);
    expect(b!.active).toBe(true);
    d.run(200, 0);
    expect(a!.alive && b!.alive).toBe(true);
    expect([a!.mode, b!.mode]).toEqual(['wait', 'wait']);
    expect(w.stats.shells).toBe(0);
  });

  it('碰到小满会受伤；从上面踩它会弹起来', () => {
    const { w, d } = flockWorld([11]);
    const hearts = w.hearts;
    let hurt = false;
    for (let i = 0; i < 300 && !hurt; i++) {
      d.step(i < 100 ? BTN.right : 0);
      hurt = eventsOf(w.events, 'hurt').length > 0;
    }
    expect(hurt).toBe(true);
    expect(w.hearts).toBe(hearts - 1);
    // 踩：站着等头顶上方那一行的崖燕飞过来，在合适的时候起跳，落到它背上
    const stompWith = (dist: number, hold: number): boolean => {
      const s = flockWorld([9]);
      const e = swallows(s.w)[0]!;
      for (let i = 0; i < 100 && !e.active; i++) s.d.step(BTN.right);
      let jumped = 0;
      for (let i = 0; i < 200; i++) {
        const dx = e.body.x - s.w.player.body.right;
        const press = jumped < hold && (jumped > 0 || dx < dist);
        if (press) jumped++;
        s.d.step(press ? BTN.jump : 0);
        if (eventsOf(s.w.events, 'enemyDefeat').some((q) => q.cause === 'stomp')) return true;
      }
      return false;
    };
    let stomped = false;
    for (let dist = 20; dist <= 200 && !stomped; dist += 10)
      for (const hold of [8, 14, 20]) if (!stomped) stomped = stompWith(dist, hold);
    expect(stomped).toBe(true);
  });

  it('骑着咩铃冲撞能撞飞，被碰到只会被撞下来', () => {
    const goat: EntityDef = { type: 'goat', at: [8, GROUND - 1] };
    const { w, d } = flockWorld([11], ['mieling'], [goat]);
    const g = w.goat!;
    d.run(3, 0);
    w.teleportFeet(g.body.centerX - 4, g.body.bottom);
    d.run(3, 0);
    d.step(BTN.up);
    d.step(0);
    const e = swallows(w)[0]!;
    for (let i = 0; i < 100 && !e.active; i++) d.step(BTN.right);
    let charged = false;
    for (let i = 0; i < 200 && e.alive; i++) {
      const dx = e.body.x - w.player.body.right;
      if (!charged && dx < 70) {
        d.step(BTN.attack);
        charged = true;
      } else d.step(0);
    }
    expect(e.alive).toBe(false);
    const hearts = w.hearts;
    expect(w.player.ride).not.toBeNull();
    // 再来一组（死了以后重新待命也行），这次不冲撞：被撞下来，不扣心
    const t = flockWorld([11], ['mieling'], [goat]);
    t.d.run(3, 0);
    t.w.teleportFeet(t.w.goat!.body.centerX - 4, t.w.goat!.body.bottom);
    t.d.run(3, 0);
    t.d.step(BTN.up);
    t.d.step(0);
    let knocked = false;
    for (let i = 0; i < 300 && !knocked; i++) {
      t.d.step(i < 30 ? BTN.right : 0);
      knocked = eventsOf(t.w.events, 'knockOff').length > 0;
    }
    expect(knocked).toBe(true);
    expect(t.w.hearts).toBe(hearts);
  });

  it('死了以后整组重新待命；打倒过的那只不再出现', () => {
    const { w, d } = flockWorld([9, 11]);
    const [a, b] = swallows(w);
    for (let i = 0; i < 100 && !a!.active; i++) d.step(BTN.right);
    // 用海星以外的办法打倒第一只：直接标记为打倒（这里只关心复位规则）
    a!.alive = false;
    // 掉三次心：碰崖燕、等它们飞走……直接调用世界的死亡流程太绕，这里用掉坑代替
    w.hearts = 1;
    w.teleport(w.player.body.x, FLOOR + 100);
    d.run(150, 0);
    expect(w.stats.deaths).toBe(1);
    expect(w.flocks[0]!.state).toBe('wait');
    expect(b!.alive).toBe(true);
    expect(b!.mode).toBe('wait');
    expect(a!.alive).toBe(false);
  });
});
