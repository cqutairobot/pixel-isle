import type { InputFrame } from './input';
import type { EndState, World } from './world';

/**
 * 回放：只记录送进 World.step 的输入（过场、对话期间世界不前进，也不记录）。
 * 帧序列按 [按住, 本帧按下, 重复次数] 压缩；"松开"由前后两帧的"按住"推出来。
 */
export interface Replay {
  version: 1;
  level: string;
  /** 录制时用的手感预设 */
  preset: 'A' | 'B' | 'C';
  autoRun: boolean;
  /** 说明这条回放走的路线 */
  note: string;
  frames: Array<[number, number, number]>;
}

export function encodeInputs(inputs: readonly InputFrame[]): Replay['frames'] {
  const out: Replay['frames'] = [];
  for (const f of inputs) {
    const last = out[out.length - 1];
    if (last && last[0] === f.held && last[1] === f.pressed) last[2]++;
    else out.push([f.held, f.pressed, 1]);
  }
  return out;
}

export function decodeInputs(frames: Replay['frames']): InputFrame[] {
  const out: InputFrame[] = [];
  let prev = 0;
  for (const [held, pressed, n] of frames) {
    for (let i = 0; i < n; i++) {
      out.push({ held, pressed, released: prev & ~held });
      prev = held;
    }
  }
  return out;
}

/** 世界在等过场或对话时，按结束状态表直接处理（和游戏里跳过过场的结果一样） */
export function resolveHeadless(world: World, endStates: Record<string, EndState>): void {
  if (world.pendingTrigger) world.resolveTrigger(endStates[world.pendingTrigger] ?? {});
  if (world.pendingTalk) world.resolveTalk();
}

/** 回放一串输入；返回实际走了多少逻辑步 */
export function playInputs(
  world: World,
  inputs: readonly InputFrame[],
  endStates: Record<string, EndState>,
): number {
  let n = 0;
  for (const f of inputs) {
    if (world.waiting) resolveHeadless(world, endStates);
    world.step(f);
    n++;
  }
  return n;
}
