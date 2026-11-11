/**
 * 打印各手感预设的跳跃度量（PLAN.md §4.4 的跳跃度量表）。
 * 用法：npx tsx scripts/jump-metrics.ts
 */
import { TILE } from '../src/sim/constants';
import { BTN, type InputFrame } from '../src/sim/input';
import { parseLevel } from '../src/sim/level';
import { cloneTuning, PRESETS, type PresetId } from '../src/sim/tuning';
import { World } from '../src/sim/world';

function world(preset: PresetId): World {
  const cols = 400;
  const rows: string[] = [];
  for (let r = 0; r < 20; r++) {
    if (r >= 18) rows.push('#'.repeat(cols));
    else if (r === 17) rows.push('P' + '.'.repeat(cols - 1));
    else rows.push('.'.repeat(cols));
  }
  const level = parseLevel({ id: 'm', name: 'm', chunks: [rows.join('\n')] });
  return new World(level, cloneTuning(PRESETS[preset].tuning), { autoRun: false }, 384, 216);
}

function measure(preset: PresetId, run: boolean, holdFrames: number) {
  const w = world(preset);
  let prev = 0;
  const step = (held: number) => {
    const f: InputFrame = { held, pressed: held & ~prev, released: prev & ~held };
    prev = held;
    w.step(f);
  };
  // 走：只按住 12 帧就起跳（还没开始跑）；跑：长按 90 帧到满速再起跳
  const move = BTN.right;
  const walkHold = Math.min(12, w.tuning.runDelayFrames - 1);
  for (let i = 0; i < (run ? 90 : walkHold); i++) step(move);
  const p = w.player;
  const x0 = p.body.x;
  const base = p.body.bottom;
  let minBottom = base;
  let frames = 0;
  for (let i = 0; i < 200; i++) {
    step(move | (i < holdFrames ? BTN.jump : 0));
    minBottom = Math.min(minBottom, p.body.bottom);
    frames++;
    if (i > 2 && p.onGround) break;
  }
  return { height: (base - minBottom) / TILE, distance: (p.body.x - x0) / TILE, airtime: frames };
}

for (const id of Object.keys(PRESETS) as PresetId[]) {
  const walkHi = measure(id, false, 999);
  const runHi = measure(id, true, 999);
  const tap = measure(id, false, 1);
  console.log(
    `${id} ${PRESETS[id].name}: 最高跳 走 ${walkHi.height.toFixed(2)} 格 / 跑 ${runHi.height.toFixed(2)} 格；` +
      `轻点 ${tap.height.toFixed(2)} 格；最远平跳 走 ${walkHi.distance.toFixed(2)} 格 / 跑 ${runHi.distance.toFixed(2)} 格；` +
      `滞空 走 ${walkHi.airtime} 帧 / 跑 ${runHi.airtime} 帧`,
  );
}

// —— 坐骑咩铃（第 3 关）——
// 平地上骑着跑到满速再起跳。距离是从起跳到落回同一高度时碰撞盒走过的水平距离；
// 二段跳、冲撞跳的起跳时机在一串帧数里搜索，取最远（或最高）的那次。

function goatWorld(): World {
  const cols = 500;
  const rows: string[] = [];
  for (let r = 0; r < 24; r++) {
    if (r >= 22) rows.push('#'.repeat(cols));
    else if (r === 21) rows.push('P' + '.'.repeat(cols - 1));
    else rows.push('.'.repeat(cols));
  }
  const level = parseLevel({
    id: 'g',
    name: 'g',
    chunks: [rows.join('\n')],
    entities: [{ type: 'goat', at: [3, 21] }],
  });
  const w = new World(
    level,
    cloneTuning(PRESETS.A.tuning),
    { autoRun: false, flags: ['mieling'] },
    384,
    216,
  );
  return w;
}

interface Leap {
  height: number;
  distance: number;
}

/**
 * 骑上咩铃、往右跑到满速，然后：charge 时先冲撞，冲刺第 jumpAt 帧起跳，否则直接起跳；
 * second ≥ 0 时起跳后第 second 帧松开、再按住跳跃（二段跳）。
 */
function goatLeap(charge: boolean, jumpAt: number, second: number): Leap {
  const w = goatWorld();
  let prev = 0;
  const step = (held: number) => {
    const f: InputFrame = { held, pressed: held & ~prev, released: prev & ~held };
    prev = held;
    w.step(f);
  };
  const p = w.player;
  const g = w.goat!;
  for (let i = 0; i < 3; i++) step(0);
  w.teleportFeet(g.body.centerX - 4, g.body.bottom);
  for (let i = 0; i < 3; i++) step(0);
  step(BTN.up);
  step(0);
  if (!p.ride) throw new Error('骑不上咩铃');
  for (let i = 0; i < 30; i++) step(BTN.right);
  if (charge) {
    step(BTN.right | BTN.attack);
    for (let i = 0; i < 20 && p.ride.dash === 0; i++) step(BTN.right);
    for (let i = 0; i < jumpAt; i++) step(BTN.right);
  }
  const x0 = p.body.x;
  const base = p.body.bottom;
  let minBottom = base;
  for (let i = 0; i < 400; i++) {
    let held = BTN.right;
    if (second < 0 || i < second) held |= BTN.jump;
    else if (i > second) held |= BTN.jump;
    step(held);
    minBottom = Math.min(minBottom, p.body.bottom);
    if (i > 2 && p.onGround) break;
  }
  return { height: (base - minBottom) / TILE, distance: (p.body.x - x0) / TILE };
}

const best = (leaps: Leap[], key: keyof Leap) => leaps.reduce((a, b) => (b[key] > a[key] ? b : a));
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const single = goatLeap(false, 0, -1);
const doubles = range(8, 40).map((s) => goatLeap(false, 0, s));
const charges = range(0, 29).map((j) => goatLeap(true, j, -1));
const chargeDoubles = range(0, 29).flatMap((j) => range(12, 40).map((s) => goatLeap(true, j, s)));
const fmt = (l: Leap) => `高 ${l.height.toFixed(2)} 格、远 ${l.distance.toFixed(2)} 格`;
console.log(
  `咩铃：一跳 ${fmt(single)}；二段跳 最高 ${fmt(best(doubles, 'height'))} / 最远 ${fmt(best(doubles, 'distance'))}；` +
    `冲撞跳 最远 ${fmt(best(charges, 'distance'))}；冲撞跳接二段跳 最远 ${fmt(best(chargeDoubles, 'distance'))}`,
);
