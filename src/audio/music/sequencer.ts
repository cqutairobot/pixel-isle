import { DRUMS, midiToFreq, renderNote, tailOf, type Inst } from './synth';

/**
 * 乐谱与音序器。每条音轨是一串记号，用空格分开，"|" 只是小节线（便于阅读，不影响结果）：
 *   C5:4      音名 + 八度 : 长度（以 16 分音符为单位，不写就是 1）
 *   Bb3 F#4   升降号
 *   C4+E4+G4:8  和弦
 *   r:4       休止
 *   k s h x c 鼓：底鼓、军鼓、踩镲、沙锤、拍手（只在鼓的音轨里用）
 * 一小节 16 步（4/4 拍）。循环的乐曲把超出结尾的余音叠回循环开头，接缝听不出来。
 */

export interface Track {
  inst: Inst;
  /** 音量（0–1） */
  vol: number;
  /** 声像（-1 左 … 1 右） */
  pan?: number;
  /** 音符记号；也可以按小节写成数组 */
  notes: string | string[];
  /** 每个音的力度起伏（0–1），让重复的音不那么机械 */
  humanize?: number;
  /** 附点八分音符的回声（0–1） */
  echo?: number;
  /** 门限比例：音符实际按住的长度占记号长度的比例（断奏用小一点） */
  gate?: number;
}

export interface Score {
  id: string;
  /** 显示在试听板上的名字 */
  title: string;
  bpm: number;
  bars: number;
  /** 循环播放（乐句不循环） */
  loop: boolean;
  /** 总音量 */
  gain: number;
  tracks: Track[];
}

export interface ParsedNote {
  step: number;
  len: number;
  /** MIDI 音高；鼓为空 */
  pitches: number[];
  drum?: Inst;
}

const NOTE = /^([A-G])(#|b)?(-?\d)$/;
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function parsePitch(p: string): number {
  const m = NOTE.exec(p);
  if (!m) throw new Error(`看不懂的音名 "${p}"`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + SEMI[m[1]!]! + acc;
}

/** 解析一条音轨；返回音符和总步数 */
export function parseTrack(src: string | string[]): { notes: ParsedNote[]; steps: number } {
  const text = Array.isArray(src) ? src.join(' ') : src;
  const notes: ParsedNote[] = [];
  let step = 0;
  for (const tok of text.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const [head, lenStr] = tok.split(':');
    const len = lenStr ? Number(lenStr) : 1;
    if (!Number.isFinite(len) || len <= 0) throw new Error(`长度不对："${tok}"`);
    if (head === 'r') {
      step += len;
      continue;
    }
    const drum = DRUMS[head!];
    if (drum) notes.push({ step, len, pitches: [], drum });
    else notes.push({ step, len, pitches: head!.split('+').map(parsePitch) });
    step += len;
  }
  return { notes, steps: step };
}

export const SAMPLE_RATE = 32000;

export function stepSeconds(score: Score): number {
  return 60 / score.bpm / 4;
}

/** 乐曲（不含余音）的采样数 */
export function scoreLength(score: Score, sr = SAMPLE_RATE): number {
  return Math.round(score.bars * 16 * stepSeconds(score) * sr);
}

export interface Rendered {
  left: Float32Array;
  right: Float32Array;
  sr: number;
  /** 循环的乐曲：整段就是一个循环；乐句：长度包含余音 */
  loop: boolean;
  /** 乐曲本身的长度（秒，不含余音） */
  seconds: number;
}

/**
 * 渲染一首乐曲（生成器：每渲染一个音 yield 一次，浏览器里可以分帧渲染，不卡画面）。
 */
export function* renderScore(score: Score, sr = SAMPLE_RATE): Generator<void, Rendered> {
  const base = scoreLength(score, sr);
  const maxTail = Math.max(...score.tracks.map((t) => tailOf(t.inst)));
  const n = score.loop ? base : base + Math.ceil((maxTail + 0.3) * sr);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const stepS = stepSeconds(score);
  const scratch = new Float32Array(Math.ceil((16 * stepS * 4 + 2) * sr));
  const trackL = new Float32Array(n);
  const trackR = new Float32Array(n);
  let seed = 7;
  for (const track of score.tracks) {
    trackL.fill(0);
    trackR.fill(0);
    const { notes } = parseTrack(track.notes);
    const pan = track.pan ?? 0;
    const gl = Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2 * track.vol;
    const gr = Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2 * track.vol;
    const gate = track.gate ?? 0.92;
    for (const note of notes) {
      const start = Math.round(note.step * stepS * sr);
      const dur = note.len * stepS * gate;
      const hum = track.humanize ?? 0.08;
      const vel = 1 - hum + hum * ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const pitches = note.drum ? [0] : note.pitches;
      for (const m of pitches) {
        const len = renderNote(
          scratch,
          note.drum ?? track.inst,
          note.drum ? 0 : midiToFreq(m),
          dur,
          vel / Math.sqrt(pitches.length),
          sr,
          seed,
        );
        for (let i = 0; i < len; i++) {
          let j = start + i;
          if (j >= n) {
            if (!score.loop) break;
            j %= n;
          }
          const v = scratch[i]!;
          trackL[j]! += v * gl;
          trackR[j]! += v * gr;
        }
      }
      yield;
    }
    // 回声：附点八分音符的三次回响，左右交替（循环的乐曲从结尾绕回开头）
    if (track.echo) {
      const d = Math.round(stepS * 3 * sr);
      const taps = [0.35, 0.12, 0.04];
      for (let i = 0; i < n; i++) {
        let el = 0;
        let er = 0;
        for (let k = 0; k < taps.length; k++) {
          let j = i - d * (k + 1);
          if (j < 0) {
            if (!score.loop) continue;
            j = ((j % n) + n) % n;
          }
          const g = taps[k]! * track.echo;
          if (k % 2 === 0) {
            el += trackR[j]! * g;
            er += trackL[j]! * g;
          } else {
            el += trackL[j]! * g;
            er += trackR[j]! * g;
          }
        }
        left[i]! += el;
        right[i]! += er;
      }
    }
    for (let i = 0; i < n; i++) {
      left[i]! += trackL[i]!;
      right[i]! += trackR[i]!;
    }
    yield;
  }
  // 总音量，超出时整体压低（不削波）
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
  const g = score.gain * (peak * score.gain > 0.85 ? 0.85 / (peak * score.gain) : 1);
  for (let i = 0; i < n; i++) {
    left[i]! *= g;
    right[i]! *= g;
  }
  return { left, right, sr, loop: score.loop, seconds: base / sr };
}

/** 一口气渲染完（测试、离线分析用） */
export function renderNow(score: Score, sr = SAMPLE_RATE): Rendered {
  const gen = renderScore(score, sr);
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}
