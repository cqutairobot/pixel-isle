import { describe, expect, it } from 'vitest';
import { renderAmbience } from '../src/audio/music/ambience';
import { JINGLES, SONGS } from '../src/audio/music/scores';
import {
  parseTrack,
  renderNow,
  scoreLength,
  stepSeconds,
  type Rendered,
} from '../src/audio/music/sequencer';

const SR = 16000;

function peakOf(r: Rendered): number {
  let p = 0;
  for (let i = 0; i < r.left.length; i++)
    p = Math.max(p, Math.abs(r.left[i]!), Math.abs(r.right[i]!));
  return p;
}

function rms(a: Float32Array, from: number, to: number): number {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i]! * a[i]!;
  return Math.sqrt(s / Math.max(1, to - from));
}

/** 循环接缝：结尾最后一个采样到开头第一个采样的跳变，不超过曲子里常见的相邻采样跳变 */
function seamOk(r: Rendered): { jump: number; typical: number } {
  const a = r.left;
  const diffs: number[] = [];
  for (let i = 1; i < a.length; i += 7) diffs.push(Math.abs(a[i]! - a[i - 1]!));
  diffs.sort((x, y) => x - y);
  const typical = diffs[Math.floor(diffs.length * 0.995)]!;
  const jump = Math.abs(a[0]! - a[a.length - 1]!);
  return { jump, typical };
}

describe('乐谱', () => {
  for (const s of [...Object.values(SONGS), ...Object.values(JINGLES)]) {
    it(`${s.title}：每条音轨的长度都等于 ${s.bars} 小节`, () => {
      for (const t of s.tracks) expect(parseTrack(t.notes).steps, t.inst).toBe(s.bars * 16);
    });
  }

  it('按小节写的音轨，每小节正好 16 步', () => {
    for (const s of Object.values(SONGS)) {
      for (const t of s.tracks) {
        if (!Array.isArray(t.notes)) continue;
        t.notes.forEach((bar, i) =>
          expect(parseTrack(bar).steps, `${s.id} ${t.inst} 第 ${i + 1} 小节`).toBe(16),
        );
      }
    }
  });
});

describe('渲染', () => {
  for (const s of Object.values(SONGS)) {
    it(`${s.title}：长度精确、没有削波、循环无缝`, () => {
      const r = renderNow(s, SR);
      expect(r.left.length).toBe(scoreLength(s, SR));
      expect(Number.isFinite(peakOf(r))).toBe(true);
      expect(peakOf(r)).toBeLessThanOrEqual(0.9);
      expect(peakOf(r)).toBeGreaterThan(0.3);
      const { jump, typical } = seamOk(r);
      expect(jump).toBeLessThanOrEqual(typical * 1.5 + 0.02);
      // 结尾的余音叠回了开头：第一拍之前的一小段不是一片死寂
      expect(rms(r.left, 0, Math.round(0.004 * SR))).toBeGreaterThan(0);
    });
  }

  it('乐句的长度：过关约 3 秒、倒下约 1.2 秒、检查点约 1 秒、海玻璃约 1.5 秒', () => {
    const want: Record<string, number> = { clear: 3, death: 1.25, checkpoint: 1, glass: 1.5 };
    for (const [id, sec] of Object.entries(want)) {
      const s = JINGLES[id]!;
      expect(s.bars * 16 * stepSeconds(s), id).toBeCloseTo(sec, 1);
      const r = renderNow(s, SR);
      expect(peakOf(r), id).toBeLessThanOrEqual(0.9);
      // 乐句后面带着余音，不会戛然而止
      expect(r.left.length).toBeGreaterThan(scoreLength(s, SR));
    }
  });

  it('环境声（海浪、风）循环无缝', () => {
    for (const id of ['sea', 'wind'] as const) {
      const r = renderAmbience(id, SR, 4);
      expect(r.left.length).toBe(4 * SR);
      expect(peakOf(r)).toBeLessThanOrEqual(0.61);
      const { jump, typical } = seamOk(r);
      expect(jump, id).toBeLessThanOrEqual(typical * 1.5 + 0.02);
    }
  });
});
