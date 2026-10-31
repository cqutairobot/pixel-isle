/**
 * 音乐合成器（纯 TS，不依赖浏览器）：把一个音渲染成采样。
 * 音色：方波（12.5% / 25% / 50% 占空比，PolyBLEP 去锯齿）、三角波、钢鼓、马林巴、铃、
 * 柔和的垫音，以及噪声鼓组（底鼓、军鼓、踩镲、沙锤、拍手）。
 * 在 Node 里也能跑，tests/music.test.ts 用它检查循环接缝和峰值。
 */

export type Inst =
  | 'pulse12'
  | 'pulse25'
  | 'pulse50'
  | 'tri'
  | 'steel'
  | 'marimba'
  | 'bell'
  | 'pad'
  | 'kick'
  | 'snare'
  | 'hat'
  | 'shaker'
  | 'clap';

/** 乐谱里的鼓字母 → 音色 */
export const DRUMS: Record<string, Inst> = {
  k: 'kick',
  s: 'snare',
  h: 'hat',
  x: 'shaker',
  c: 'clap',
};

const TABLE = 4096;
const SIN = new Float32Array(TABLE + 1);
for (let i = 0; i <= TABLE; i++) SIN[i] = Math.sin((i / TABLE) * Math.PI * 2);

/** 查表正弦：phase 以"圈"为单位 */
function sinT(phase: number): number {
  const p = (phase - Math.floor(phase)) * TABLE;
  const i = p | 0;
  const f = p - i;
  return SIN[i]! + (SIN[i + 1]! - SIN[i]!) * f;
}

export function midiToFreq(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}

/** 可复现的噪声（线性同余） */
export class Noise {
  constructor(private s = 1) {}
  next(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return (this.s / 4294967296) * 2 - 1;
  }
}

function polyblep(t: number, dt: number): number {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

/** 普通的 ADSR：门限 gate 秒之后进入释放 */
function adsr(t: number, gate: number, a: number, d: number, s: number, r: number): number {
  let v: number;
  const tt = Math.min(t, gate);
  if (tt < a) v = tt / a;
  else if (tt < a + d) v = 1 - ((1 - s) * (tt - a)) / d;
  else v = s;
  if (t > gate) v *= Math.max(0, 1 - (t - gate) / r);
  return v;
}

/** 每种音色在门限之后还会响多久（秒） */
export function tailOf(inst: Inst): number {
  switch (inst) {
    case 'bell':
      return 1.6;
    case 'steel':
      return 0.45;
    case 'marimba':
      return 0.35;
    case 'pad':
      return 0.5;
    case 'kick':
    case 'snare':
      return 0.3;
    case 'hat':
    case 'shaker':
    case 'clap':
      return 0.12;
    default:
      return 0.08;
  }
}

const BELL_PARTIALS: Array<[number, number, number]> = [
  // [频率倍数, 振幅, 衰减时间常数（秒）]
  [0.56, 0.5, 0.9],
  [0.92, 0.35, 0.75],
  [1, 0.6, 0.6],
  [1.19, 0.3, 0.45],
  [2, 0.4, 0.3],
  [2.74, 0.25, 0.22],
  [3.76, 0.15, 0.14],
];

/**
 * 把一个音渲染进 out（从下标 0 开始写，写之前先清零），返回写了多少个采样。
 * freq 对鼓无意义；vel 是力度（0–1）；dur 是门限长度（秒）；seed 让噪声每次略有不同。
 */
export function renderNote(
  out: Float32Array,
  inst: Inst,
  freq: number,
  dur: number,
  vel: number,
  sr: number,
  seed = 1,
): number {
  const len = Math.min(out.length, Math.ceil((dur + tailOf(inst)) * sr));
  out.fill(0, 0, len);
  const dt = freq / sr;
  const noise = new Noise(seed);
  switch (inst) {
    case 'pulse12':
    case 'pulse25':
    case 'pulse50': {
      const duty = inst === 'pulse12' ? 0.125 : inst === 'pulse25' ? 0.25 : 0.5;
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        // 长音带一点颤音
        const vib = t > 0.18 ? sinT(t * 5.5) * 0.004 : 0;
        const step = dt * (1 + vib);
        let v = ph < duty ? 1 : -1;
        v += polyblep(ph, step);
        v -= polyblep((ph + 1 - duty) % 1, step);
        out[i] = v * 0.42 * vel * adsr(t, dur, 0.004, 0.08, 0.6, 0.06);
        ph += step;
        if (ph >= 1) ph -= 1;
      }
      break;
    }
    case 'tri': {
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const v = 4 * Math.abs(ph - 0.5) - 1;
        out[i] = v * 0.8 * vel * adsr(t, dur, 0.003, 0.05, 0.85, 0.05);
        ph += dt;
        if (ph >= 1) ph -= 1;
      }
      break;
    }
    case 'steel': {
      // 钢鼓：1、2、3、4.2 倍的泛音，高的衰减得快；起音时音高略高再落回来
      const parts: Array<[number, number, number]> = [
        [1, 1, 3.2],
        [2, 0.5, 5],
        [3, 0.26, 7.5],
        [4.2, 0.12, 10],
      ];
      const env = parts.map(([, a]) => a);
      const k = parts.map(([, , d]) => Math.exp(-d / sr));
      const ph = parts.map(() => 0);
      let bend = 0.012;
      const bk = Math.exp(-40 / sr);
      const relK = Math.exp(-9 / sr);
      let rel = 1;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const att = Math.min(1, t / 0.003);
        if (t > dur) rel *= relK;
        let v = 0;
        for (let j = 0; j < parts.length; j++) {
          v += sinT(ph[j]!) * env[j]!;
          ph[j]! += (freq * parts[j]![0] * (1 + bend)) / sr;
          env[j]! *= k[j]!;
        }
        bend *= bk;
        out[i] = v * 0.42 * vel * att * rel;
      }
      break;
    }
    case 'marimba': {
      const parts: Array<[number, number, number]> = [
        [1, 1, 7],
        [4, 0.3, 18],
        [9.2, 0.08, 40],
      ];
      const env = parts.map(([, a]) => a);
      const k = parts.map(([, , d]) => Math.exp(-d / sr));
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const att = Math.min(1, t / 0.002);
        let v = 0;
        for (let j = 0; j < parts.length; j++) {
          v += sinT(freq * parts[j]![0] * t) * env[j]!;
          env[j]! *= k[j]!;
        }
        out[i] = v * 0.55 * vel * att;
      }
      break;
    }
    case 'bell': {
      const env = BELL_PARTIALS.map(([, a]) => a);
      const k = BELL_PARTIALS.map(([, , d]) => Math.exp(-1 / (d * sr)));
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const att = Math.min(1, t / 0.002);
        let v = 0;
        for (let j = 0; j < BELL_PARTIALS.length; j++) {
          v += sinT(freq * BELL_PARTIALS[j]![0] * t) * env[j]!;
          env[j]! *= k[j]!;
        }
        out[i] = v * 0.32 * vel * att;
      }
      break;
    }
    case 'pad': {
      // 三个略微走音的三角波，慢起慢收
      const det = [1, 1.004, 0.996];
      const ph = [0, 0.33, 0.66];
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        let v = 0;
        for (let k = 0; k < 3; k++) {
          v += 4 * Math.abs(ph[k]! - 0.5) - 1;
          ph[k]! += dt * det[k]!;
          if (ph[k]! >= 1) ph[k]! -= 1;
        }
        out[i] = (v / 3) * 0.5 * vel * adsr(t, dur, 0.25, 0.2, 0.8, 0.45);
      }
      break;
    }
    case 'kick': {
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const f = 45 + 110 * Math.exp(-t * 28);
        ph += f / sr;
        const click = t < 0.002 ? noise.next() * 0.4 : 0;
        out[i] = (sinT(ph) * Math.exp(-t * 13) + click) * 0.9 * vel;
      }
      break;
    }
    case 'snare': {
      let hp = 0;
      let prev = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const n = noise.next();
        hp = 0.85 * (hp + n - prev);
        prev = n;
        out[i] = (hp * 0.55 * Math.exp(-t * 20) + sinT(190 * t) * 0.35 * Math.exp(-t * 30)) * vel;
      }
      break;
    }
    case 'hat':
    case 'shaker':
    case 'clap': {
      let hp1 = 0;
      let hp2 = 0;
      let p1 = 0;
      let p2 = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const n = noise.next();
        hp1 = 0.8 * (hp1 + n - p1);
        p1 = n;
        hp2 = 0.8 * (hp2 + hp1 - p2);
        p2 = hp1;
        let env: number;
        if (inst === 'hat') env = Math.exp(-t * 55);
        else if (inst === 'shaker') env = t < 0.012 ? t / 0.012 : Math.exp(-(t - 0.012) * 45);
        else {
          // 拍手：三下很快的噪声，最后一下拖长
          const k = Math.floor(t / 0.011);
          env = k < 2 ? Math.exp(-(t - k * 0.011) * 120) : Math.exp(-(t - 0.022) * 25);
        }
        out[i] = (inst === 'clap' ? hp1 : hp2) * env * 0.5 * vel;
      }
      break;
    }
  }
  return len;
}
