import { SAMPLE_RATE, type Rendered } from './sequencer';
import { Noise } from './synth';

export type AmbienceId = 'sea' | 'wind';

/**
 * 环境声循环：海浪（低沉的噪声随浪涌起伏，浪头上带一点沙沙声）、风（带通噪声，中心频率慢慢摆动）。
 * 调制的周期都能整除循环长度；多渲染一小段，交叉淡化进开头，循环接缝听不出来。
 */
export function renderAmbience(id: AmbienceId, sr = SAMPLE_RATE, seconds = 8): Rendered {
  const n = Math.round(seconds * sr);
  const extra = Math.round(0.3 * sr);
  const total = n + extra;
  const out = [new Float32Array(total), new Float32Array(total)];
  const TAU = Math.PI * 2;
  for (let ch = 0; ch < 2; ch++) {
    const noise = new Noise(11 + ch * 97);
    const buf = out[ch]!;
    if (id === 'sea') {
      let brown = 0;
      let lp = 0;
      let hp = 0;
      let prev = 0;
      const shift = ch * 1.3;
      for (let i = 0; i < total; i++) {
        const t = i / sr + shift;
        const w = noise.next();
        brown = brown * 0.995 + w * 0.06;
        lp += (brown - lp) * 0.08;
        hp = 0.7 * (hp + w - prev);
        prev = w;
        const swell = (0.5 - 0.5 * Math.cos((TAU * t) / 4)) ** 2;
        const slow = 0.75 + 0.25 * Math.sin((TAU * t) / 8);
        buf[i] = lp * (0.35 + 0.65 * swell) * slow * 1.6 + hp * swell ** 3 * 0.05;
      }
    } else {
      // 状态变量滤波器做带通
      let low = 0;
      let band = 0;
      const shift = ch * 0.9;
      for (let i = 0; i < total; i++) {
        const t = i / sr + shift;
        const fc = 420 + 260 * Math.sin((TAU * t) / 8) + 120 * Math.sin((TAU * t * 3) / 8 + ch);
        const f = 2 * Math.sin((Math.PI * fc) / sr);
        const q = 0.35;
        const w = noise.next();
        low += f * band;
        const high = w - low - q * band;
        band += f * high;
        const amp = 0.55 + 0.45 * Math.sin((TAU * t) / 4 + 0.6 * ch) ** 2;
        buf[i] = band * amp * 0.5;
      }
    }
    // 把多出来的一段交叉淡化进开头
    for (let i = 0; i < extra; i++) {
      const k = i / extra;
      buf[i] = buf[i]! * k + buf[n + i]! * (1 - k);
    }
  }
  const left = out[0]!.slice(0, n);
  const right = out[1]!.slice(0, n);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
  const g = peak > 0 ? 0.6 / peak : 1;
  for (let i = 0; i < n; i++) {
    left[i]! *= g;
    right[i]! *= g;
  }
  return { left, right, sr, loop: true, seconds };
}
