import { BTN, type InputFrame } from '../src/sim/input';
import { parseLevel } from '../src/sim/level';
import { cloneTuning, PRESETS, type PresetId } from '../src/sim/tuning';
import { World } from '../src/sim/world';

export { BTN };

export function makeWorld(rows: string[], preset: PresetId = 'A', autoRun = false): World {
  const level = parseLevel({ id: 'test', name: 'test', chunks: [rows.join('\n')] });
  return new World(level, cloneTuning(PRESETS[preset].tuning), { autoRun }, 384, 216);
}

/** 逐帧驱动输入，自动计算按下/松开的边沿 */
export class Driver {
  private prev = 0;
  constructor(readonly world: World) {}

  step(held: number): void {
    const f: InputFrame = { held, pressed: held & ~this.prev, released: this.prev & ~held };
    this.prev = held;
    this.world.step(f);
  }

  run(frames: number, held: number, each?: (frame: number) => void): void {
    for (let i = 0; i < frames; i++) {
      this.step(held);
      each?.(i);
    }
  }
}

/** 一块足够大的平地，P 站在地上 */
export function flatRows(cols = 40, rows = 12, pCol = 4): string[] {
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    if (r >= rows - 2) out.push('#'.repeat(cols));
    else if (r === rows - 3) out.push('.'.repeat(pCol) + 'P' + '.'.repeat(cols - pCol - 1));
    else out.push('.'.repeat(cols));
  }
  return out;
}
