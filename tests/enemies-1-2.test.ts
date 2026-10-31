import { describe, expect, it } from 'vitest';
import { TILE } from '../src/sim/constants';
import { RULES } from '../src/sim/tuning';
import { BTN, Driver, eventsOf, makeLevelWorld } from './helpers';

function room(extra: Array<[number, number, string]> = [], pCol = 4): string[] {
  const rows: string[][] = [];
  for (let r = 0; r < 12; r++) {
    if (r >= 10) rows.push('#'.repeat(40).split(''));
    else rows.push('.'.repeat(40).split(''));
  }
  rows[9]![pCol] = 'P';
  for (const [r, c, ch] of extra) rows[r]![c] = ch;
  return rows.map((r) => r.join(''));
}

describe('刺海胆', () => {
  it('踩上去会受伤（刺海胆没事）', () => {
    // 小满从高处直接落在刺海胆身上
    const rows = room([[9, 6, 'u']]);
    const w = makeLevelWorld(rows);
    const e = w.enemies[0]!;
    const d = new Driver(w);
    d.run(2, 0);
    w.teleport(e.body.x, 4 * TILE);
    let hurt = 0;
    for (let i = 0; i < 60; i++) {
      d.step(0);
      for (const ev of eventsOf(w.events, 'hurt')) {
        hurt++;
        expect(ev.spike).toBe(true);
      }
    }
    expect(hurt).toBe(1);
    expect(w.hearts).toBe(RULES.hearts - 1);
    expect(e.alive).toBe(true);
  });

  it('回旋海星能打倒刺海胆', () => {
    const w = makeLevelWorld(room([[9, 9, 'u']]), {}, { flags: ['starfish'] });
    const d = new Driver(w);
    d.step(0);
    const ev = d.collect(30, BTN.attack);
    expect(eventsOf(ev, 'enemyDefeat').map((e) => e.cause)).toEqual(['starfish']);
  });

  it('倒挂的：小满走到正下方才晃，晃 24 帧后掉下来，落地后不再动', () => {
    const rows = room([
      [3, 12, '#'],
      [3, 13, '#'],
      [4, 12, 'U'],
    ]);
    const w = makeLevelWorld(rows);
    const e = w.enemies[0]!;
    const d = new Driver(w);
    // 站在远处：不会晃
    d.run(60, 0);
    expect(e.mode).toBe('hang');
    let shakeAt = -1;
    let fallAt = -1;
    let landAt = -1;
    for (let i = 0; i < 400 && landAt < 0; i++) {
      // 走到它下面就停住
      const under = Math.abs(w.player.body.centerX - e.body.centerX) < 6;
      d.step(under ? 0 : BTN.right);
      if (eventsOf(w.events, 'urchinShake').length) shakeAt = i;
      if (eventsOf(w.events, 'urchinFall').length) fallAt = i;
      if (eventsOf(w.events, 'urchinLand').length) landAt = i;
    }
    expect(shakeAt).toBeGreaterThan(0);
    expect(fallAt - shakeAt).toBe(RULES.hangShakeFrames);
    expect(landAt).toBeGreaterThan(fallAt);
    const x = e.body.x;
    d.run(60, 0);
    expect(e.body.x).toBe(x);
  });

  it('倒挂的：只在画面里才会掉（小满在下面但它在画面外不动）', () => {
    // 很高的关卡：刺海胆挂在第 3 行，小满在第 40 行（离得太远、也不在画面里）
    const rows: string[] = [];
    for (let r = 0; r < 44; r++) {
      if (r >= 42) rows.push('#'.repeat(40));
      else if (r === 2) rows.push('.'.repeat(12) + '##' + '.'.repeat(26));
      else if (r === 3) rows.push('.'.repeat(12) + 'U' + '.'.repeat(27));
      else if (r === 41) rows.push('.'.repeat(12) + 'P' + '.'.repeat(27));
      else rows.push('.'.repeat(40));
    }
    const w = makeLevelWorld(rows);
    const d = new Driver(w);
    d.run(120, 0);
    expect(w.enemies[0]!.mode).toBe('hang');
  });
});

describe('冰喙鸥', () => {
  it('飞到小满头顶先停下叫一声，至少 30 帧后才俯冲', () => {
    const w = makeLevelWorld(room([[3, 12, 'w']], 12));
    const d = new Driver(w);
    let alertAt = -1;
    let diveAt = -1;
    for (let i = 0; i < 600 && diveAt < 0; i++) {
      d.step(0);
      if (eventsOf(w.events, 'gullAlert').length) alertAt = i;
      if (eventsOf(w.events, 'gullDive').length) diveAt = i;
    }
    expect(alertAt).toBeGreaterThanOrEqual(0);
    expect(diveAt - alertAt).toBeGreaterThanOrEqual(RULES.gullTelegraphFrames);
  });

  it('俯冲冲着小满来；之后拉起回到原来的高度，冷却后才能再冲', () => {
    const w = makeLevelWorld(room([[3, 12, 'w']], 12), { practice: true });
    const g = w.enemies[0]!;
    const d = new Driver(w);
    const y0 = g.body.y;
    let lowest = y0;
    let dives = 0;
    let backAfterDive = false;
    let sawDive = false;
    for (let i = 0; i < 900; i++) {
      d.step(0);
      lowest = Math.max(lowest, g.body.bottom);
      dives += eventsOf(w.events, 'gullDive').length;
      if (g.mode === 'dive') sawDive = true;
      // 俯冲之后重新开始巡航时，已经回到原来的高度附近
      if (sawDive && g.mode === 'cruise' && g.modeFrames === 1) {
        backAfterDive = Math.abs(g.body.y - y0) < RULES.gullBobAmp + 2;
        sawDive = false;
      }
    }
    // 俯冲到小满的高度附近
    expect(lowest).toBeGreaterThan(w.player.body.y);
    expect(dives).toBeGreaterThanOrEqual(2);
    expect(backAfterDive).toBe(true);
  });
});
