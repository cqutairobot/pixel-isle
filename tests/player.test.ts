import { describe, expect, it } from 'vitest';
import { TILE } from '../src/sim/constants';
import { standAt } from '../src/sim/level';
import { RESPAWN_FRAMES } from '../src/sim/world';
import { BTN, Driver, flatRows, makeWorld } from './helpers';

/** 按住跳跃键 frames 帧，返回脚底上升的最大像素数 */
function measureJump(preset: 'A' | 'B' | 'C', holdFrames: number, runFirst = false): number {
  const w = makeWorld(flatRows(80, 16, 4), preset);
  const d = new Driver(w);
  const p = w.player;
  if (runFirst) d.run(90, BTN.right);
  const base = p.body.bottom;
  let minBottom = base;
  const held = (runFirst ? BTN.right : 0) | BTN.jump;
  for (let i = 0; i < 90; i++) {
    d.step(i < holdFrames ? held : runFirst ? BTN.right : 0);
    minBottom = Math.min(minBottom, p.body.bottom);
  }
  return base - minBottom;
}

describe('跳跃高度', () => {
  it('预设 A：按住跳最高约 4.25 格（68px）', () => {
    const h = measureJump('A', 60);
    expect(h).toBeGreaterThanOrEqual(66);
    expect(h).toBeLessThanOrEqual(71);
  });

  it('预设 B / C 的最高跳与参数一致', () => {
    expect(Math.abs(measureJump('B', 60) - 64)).toBeLessThanOrEqual(3);
    expect(Math.abs(measureJump('C', 60) - 72)).toBeLessThanOrEqual(3);
  });

  it('轻点跳约 1.4 格，明显低于按住', () => {
    const h = measureJump('A', 1);
    expect(h).toBeGreaterThanOrEqual(16);
    expect(h).toBeLessThanOrEqual(30);
  });

  it('满跑起跳比走路起跳更高（约 4.8 格）', () => {
    const h = measureJump('A', 60, true);
    expect(h).toBeGreaterThanOrEqual(74);
    expect(h).toBeLessThanOrEqual(81);
  });

  it('按下跳跃键的同一帧就离地', () => {
    const w = makeWorld(flatRows());
    const d = new Driver(w);
    const y0 = w.player.body.y;
    d.step(BTN.jump);
    expect(w.player.vy).toBeLessThan(0);
    expect(w.player.body.y).toBeLessThan(y0);
    expect(w.events.some((e) => e.type === 'jump')).toBe(true);
  });
});

describe('地面移动', () => {
  it('约 6 帧加速到走速；长按方向键约 0.3 秒后加速到跑速', () => {
    const w = makeWorld(flatRows(120));
    const d = new Driver(w);
    d.run(6, BTN.right);
    expect(w.player.vx).toBeGreaterThanOrEqual(88);
    d.run(40, BTN.right);
    expect(w.player.running).toBe(true);
    expect(w.player.vx).toBeCloseTo(150, 5);
  });

  it('短按方向键只走不跑', () => {
    const w = makeWorld(flatRows(120));
    const d = new Driver(w);
    d.run(15, BTN.right);
    expect(w.player.running).toBe(false);
    expect(w.player.vx).toBeLessThanOrEqual(90);
  });

  it('换方向后重新计时，先走再跑', () => {
    const w = makeWorld(flatRows(160, 12, 80));
    const d = new Driver(w);
    d.run(60, BTN.right);
    expect(w.player.running).toBe(true);
    d.run(5, BTN.left);
    expect(w.player.running).toBe(false);
  });

  it('松手约 5 帧从走速停下', () => {
    const w = makeWorld(flatRows(120));
    const d = new Driver(w);
    d.run(15, BTN.right);
    expect(w.player.running).toBe(false);
    d.run(5, 0);
    expect(w.player.vx).toBeLessThanOrEqual(1);
  });

  it('高速转身触发急停事件', () => {
    const w = makeWorld(flatRows(120));
    const d = new Driver(w);
    d.run(60, BTN.right);
    d.step(BTN.left);
    expect(w.events.some((e) => e.type === 'skid')).toBe(true);
    expect(w.player.skidding).toBe(true);
  });
});

/** 一块高台，右边是深坑；P 站在高台上 */
function ledgeRows(): string[] {
  const rows: string[] = [];
  for (let r = 0; r < 20; r++) {
    if (r === 9) rows.push('..P' + '.'.repeat(37));
    else if (r === 10 || r === 11) rows.push('#'.repeat(10) + '.'.repeat(30));
    else if (r >= 18) rows.push('#'.repeat(40));
    else rows.push('.'.repeat(40));
  }
  return rows;
}

/** 从高台往右走，返回离开地面的那一帧（从 0 开始计） */
function frameLeavingLedge(): number {
  const w = makeWorld(ledgeRows());
  const d = new Driver(w);
  for (let i = 0; i < 200; i++) {
    d.step(BTN.right);
    if (!w.player.onGround) return i;
  }
  throw new Error('没有离开高台');
}

describe('土狼时间', () => {
  const leave = frameLeavingLedge();

  function jumpAfterLeaving(k: number): boolean {
    const w = makeWorld(ledgeRows());
    const d = new Driver(w);
    for (let i = 0; i < leave + k; i++) d.step(BTN.right);
    d.step(BTN.right | BTN.jump);
    return w.events.some((e) => e.type === 'jump');
  }

  it('离开边缘后 6 帧内仍可起跳', () => {
    for (let k = 1; k <= 6; k++) expect(jumpAfterLeaving(k), `k=${k}`).toBe(true);
  });

  it('超过土狼时间就不能起跳', () => {
    expect(jumpAfterLeaving(8)).toBe(false);
  });
});

describe('跳跃缓冲', () => {
  const leave = frameLeavingLedge();
  const walk = (i: number) => (i <= leave ? BTN.right : 0);

  /** 从高台走下去，返回落地帧（从 0 开始计） */
  function landingFrame(): number {
    const w = makeWorld(ledgeRows());
    const d = new Driver(w);
    let left = false;
    for (let i = 0; i < 300; i++) {
      d.step(walk(i));
      if (!w.player.onGround) left = true;
      if (left && w.player.onGround) return i;
    }
    throw new Error('没有落地');
  }
  const land = landingFrame();

  function jumpsOnLanding(pressBefore: number): boolean {
    const w = makeWorld(ledgeRows());
    const d = new Driver(w);
    let jumped = false;
    for (let i = 0; i <= land; i++) {
      const press = i >= land - pressBefore ? BTN.jump : 0;
      d.step(walk(i) | press);
      if (i === land) jumped = w.events.some((e) => e.type === 'jump');
    }
    return jumped;
  }

  it('落地前 7 帧内（含落地帧）按下跳跃，落地那一帧就起跳', () => {
    for (let k = 0; k <= 6; k++) expect(jumpsOnLanding(k), `k=${k}`).toBe(true);
  });

  it('按得太早不会触发', () => {
    expect(jumpsOnLanding(9)).toBe(false);
  });
});

/** 天花板第 2 行在第 5 列有一个 1 格宽的洞，地面在第 7 行 */
function ceilingRows(): string[] {
  return [
    '..........',
    '..........',
    '#####.####',
    '..........',
    '..........',
    '..........',
    '.P........',
    '##########',
  ];
}

function passesHole(x: number): boolean {
  const w = makeWorld(ceilingRows());
  const d = new Driver(w);
  w.teleport(x, 7 * TILE - 14);
  let minY = Infinity;
  for (let i = 0; i < 40; i++) {
    d.step(BTN.jump);
    minY = Math.min(minY, w.player.body.y);
  }
  return minY < 2 * TILE;
}

describe('撞头修正', () => {
  it('对准洞口能直接穿过', () => {
    expect(passesHole(83)).toBe(true);
  });

  it('偏出洞口 4px 以内会被侧移让过去', () => {
    expect(passesHole(90)).toBe(true); // 右侧多出 4px
    expect(passesHole(76)).toBe(true); // 左侧多出 4px
  });

  it('偏出太多就会撞头', () => {
    expect(passesHole(92)).toBe(false);
  });
});

describe('边缘辅助', () => {
  it('空中横撞台角、脚底只低 2px 时被抬上台面', () => {
    const rows = [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '.....#####',
      '.P...#####',
      '##########',
    ];
    const w = makeWorld(rows);
    const d = new Driver(w);
    const p = w.player;
    // 碰撞盒右边贴着第 5 列（x=80），脚底比台面（y=80）低 2px，正在缓慢下落
    w.teleport(70, 80 + 2 - 14);
    p.onGround = false;
    p.vx = 90;
    p.vy = 10;
    d.run(20, BTN.right);
    expect(p.onGround).toBe(true);
    expect(p.body.bottom).toBe(80);
    expect(p.body.x).toBeGreaterThan(70);
  });
});

describe('单向平台', () => {
  const rows = [
    '..........',
    '..........',
    '..........',
    '..........',
    '..====....',
    '..........',
    '..........',
    '.P........',
    '##########',
  ];

  it('能从下方跳穿并站上去，↓ + 跳 能落下', () => {
    const w = makeWorld(rows);
    const d = new Driver(w);
    const p = w.player;
    w.teleport(...(Object.values(standAt(3, 7)) as [number, number]));
    d.run(30, BTN.jump);
    d.run(30, 0);
    expect(p.onGround).toBe(true);
    expect(p.body.bottom).toBe(4 * TILE);

    d.step(BTN.down | BTN.jump);
    expect(w.events.some((e) => e.type === 'drop')).toBe(true);
    d.run(30, 0);
    expect(p.onGround).toBe(true);
    expect(p.body.bottom).toBe(8 * TILE);
  });

  it('只按↓不会掉下去', () => {
    const w = makeWorld(rows);
    const d = new Driver(w);
    const p = w.player;
    w.teleport(...(Object.values(standAt(3, 3)) as [number, number]));
    d.run(30, BTN.down);
    expect(p.onGround).toBe(true);
    expect(p.body.bottom).toBe(4 * TILE);
    expect(p.crouching).toBe(true);
  });
});

describe('掉坑与复活', () => {
  it('掉出地图后回到最近的安全地面', () => {
    const rows = [
      '..............',
      '..............',
      '..............',
      '.P............',
      '#####....#####',
    ];
    const w = makeWorld(rows);
    const d = new Driver(w);
    const types: string[] = [];
    for (let i = 0; i < 200; i++) {
      d.step(i < 80 ? BTN.right : 0);
      types.push(...w.events.map((e) => e.type));
      if (types.includes('respawn')) break;
    }
    expect(types).toContain('fellOut');
    expect(types).toContain('respawn');
    expect(w.player.onGround).toBe(true);
    expect(w.player.body.x).toBeLessThan(5 * TILE);
    expect(RESPAWN_FRAMES).toBeGreaterThan(0);
  });
});

describe('确定性', () => {
  it('同样的输入序列得到完全相同的结果', () => {
    const script = (i: number) =>
      (i % 50 < 30 ? BTN.right : BTN.left) |
      (i % 37 < 10 ? BTN.jump : 0) |
      (i % 90 < 45 ? BTN.attack : 0);
    const run = () => {
      const w = makeWorld(flatRows(200, 20, 50));
      const d = new Driver(w);
      for (let i = 0; i < 600; i++) d.step(script(i));
      const p = w.player;
      return [p.body.x, p.body.y, p.vx, p.vy, w.camera.x, w.camera.y];
    };
    expect(run()).toEqual(run());
  });
});

describe('重落地', () => {
  it('平地上满跳落地不算重落地', () => {
    const w = makeWorld(flatRows());
    const d = new Driver(w);
    const lands: boolean[] = [];
    for (let i = 0; i < 90; i++) {
      d.step(i < 40 ? BTN.jump : 0);
      for (const e of w.events) if (e.type === 'land') lands.push(e.hard);
    }
    expect(lands).toEqual([false]);
  });

  it('从 8 格高处掉下来是重落地', () => {
    const rows = ['..........', '.P........', '###.......'];
    for (let i = 0; i < 8; i++) rows.push('..........');
    rows.push('##########');
    const w = makeWorld(rows);
    const d = new Driver(w);
    const lands: Array<{ hard: boolean; fall: number }> = [];
    for (let i = 0; i < 120; i++) {
      d.step(i < 30 ? BTN.right : 0);
      for (const e of w.events) if (e.type === 'land') lands.push({ hard: e.hard, fall: e.fall });
    }
    expect(lands.at(-1)?.hard).toBe(true);
    expect(lands.at(-1)!.fall).toBeGreaterThanOrEqual(8 * TILE);
  });
});
