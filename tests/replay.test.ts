import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { END_STATES } from '../src/content/cutscenes/endStates';
import { decodeInputs, playInputs, type Replay } from '../src/sim/replay';
import { newWorld } from './route/bot';

function load(name: string): Replay {
  return JSON.parse(readFileSync(`tests/replays/${name}.json`, 'utf8')) as Replay;
}

/**
 * 回放通关测试（PLAN §2.10）：只回放录好的输入，不带任何判断。
 * 改了关卡或手感导致失败时：要么修关卡，要么运行 npm run replays 重录，并在提交说明里写原因。
 */
describe('第 1 关回放', () => {
  it('通关路线能走到铃门', () => {
    const r = load('1-1-any');
    const w = newWorld(r.level);
    playInputs(w, decodeInputs(r.frames), END_STATES);
    expect(w.state).toBe('clear');
  });

  it('全收集路线拿到 3 枚海玻璃并通关', () => {
    const r = load('1-1-full');
    const w = newWorld(r.level);
    playInputs(w, decodeInputs(r.frames), END_STATES);
    expect(w.stats.glass).toEqual([true, true, true]);
    expect(w.flags.has('chimesSolved')).toBe(true);
    expect(w.state).toBe('clear');
  });
});

describe('第 2 关回放', () => {
  it('通关路线能走到铃门', () => {
    const r = load('1-2-any');
    const w = newWorld(r.level);
    playInputs(w, decodeInputs(r.frames), END_STATES);
    expect(w.flags.has('starfish')).toBe(true);
    expect(w.state).toBe('clear');
  });

  it('全收集路线拿到 3 枚海玻璃并通关', () => {
    const r = load('1-2-full');
    const w = newWorld(r.level);
    playInputs(w, decodeInputs(r.frames), END_STATES);
    expect(w.stats.glass).toEqual([true, true, true]);
    expect(w.state).toBe('clear');
  });
});
