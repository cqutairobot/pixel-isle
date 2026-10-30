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
  const move = BTN.right | (run ? BTN.action : 0);
  for (let i = 0; i < 90; i++) step(move);
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
