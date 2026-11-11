import { SAMPLE_RATE, type Rendered } from './sequencer';
import { Noise } from './synth';

export type AmbienceId = 'sea' | 'wind' | 'grove' | 'cliff' | 'cave';

/**
 * 环境声循环：海浪（低沉的噪声随浪涌起伏，浪头上带一点沙沙声）、风（带通噪声，中心频率慢慢摆动）、
 * 椰林（调低的风吹树叶 + 远处的海浪，隔一会儿有一声鸟叫）、
 * 海崖（比沙滩大的风，一阵呼啸，远处的海，两声崖燕）、回声洞（空空的低鸣，几滴水，每滴都有回声）。
 * 调制的周期都能整除循环长度；多渲染一小段，交叉淡化进开头，循环接缝听不出来。
 * 鸟叫、水滴这些"一下一下"的声音都放在 0.3 秒之后、循环结束之前，不会被接缝的淡化切掉。
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
    if (id === 'grove') {
      // 远处的海：只留低沉的部分，再小一点
      let brown = 0;
      let lp = 0;
      // 树叶：比风更高、更碎的带通噪声
      let low = 0;
      let band = 0;
      const shift = ch * 1.1;
      for (let i = 0; i < total; i++) {
        const t = i / sr + shift;
        const w = noise.next();
        brown = brown * 0.995 + w * 0.06;
        lp += (brown - lp) * 0.05;
        const swell = (0.5 - 0.5 * Math.cos((TAU * t) / 8)) ** 2;
        const fc = 1500 + 500 * Math.sin((TAU * t) / 4) + 250 * Math.sin((TAU * t * 3) / 8 + ch);
        const f = 2 * Math.sin((Math.PI * fc) / sr);
        low += f * band;
        const high = w - low - 0.5 * band;
        band += f * high;
        const rustle = 0.35 + 0.65 * Math.sin((TAU * t) / 2 + ch) ** 4;
        buf[i] = lp * (0.4 + 0.6 * swell) * 0.9 + band * rustle * 0.08;
      }
      // 鸟叫：每 8 秒一声"啾啾"（两下往上滑的短音），左右声道错开
      const chirp = (t0: number, f0: number) => {
        for (let k = 0; k < 2; k++) {
          const start = Math.round((t0 + k * 0.12) * sr);
          const dur = Math.round(0.07 * sr);
          let ph = 0;
          for (let i = 0; i < dur && start + i < total; i++) {
            const tt = i / sr;
            ph += (f0 + 900 * (tt / 0.07)) / sr;
            const env = Math.sin(Math.PI * (i / dur));
            buf[start + i]! += Math.sin(TAU * ph) * env * 0.05;
          }
        }
      };
      chirp(ch === 0 ? 2.3 : 5.9, ch === 0 ? 2600 : 2900);
    } else if (id === 'cliff') {
      // 风：比沙滩上的风更宽、更响；每 8 秒一阵呼啸（窄带、往上滑的哨音）
      let low = 0;
      let band = 0;
      let hLow = 0;
      let hBand = 0;
      // 远处的海：比沙滩小得多，只剩低沉的涌动
      let brown = 0;
      let lp = 0;
      const shift = ch * 0.7;
      for (let i = 0; i < total; i++) {
        const t = i / sr + shift;
        const w = noise.next();
        const fc = 520 + 300 * Math.sin((TAU * t) / 8) + 160 * Math.sin((TAU * t * 3) / 8 + ch);
        const f = 2 * Math.sin((Math.PI * fc) / sr);
        low += f * band;
        const high = w - low - 0.5 * band;
        band += f * high;
        const amp = 0.6 + 0.4 * Math.sin((TAU * t) / 4 + 0.6 * ch) ** 2;
        // 呼啸：一阵风在第 3 到第 6 秒之间起来又落下，中心频率从 700 滑到 1100 再回来
        const g = Math.max(0, Math.sin((TAU * (t - 3)) / 8)) ** 3;
        const hc = 700 + 400 * g;
        const hf = 2 * Math.sin((Math.PI * hc) / sr);
        hLow += hf * hBand;
        const hHigh = w - hLow - 0.08 * hBand;
        hBand += hf * hHigh;
        brown = brown * 0.995 + w * 0.06;
        lp += (brown - lp) * 0.05;
        const swell = (0.5 - 0.5 * Math.cos((TAU * t) / 8)) ** 2;
        buf[i] = band * amp * 0.55 + hBand * g * 0.06 + lp * (0.3 + 0.7 * swell) * 0.5;
      }
      // 崖燕："唧——唧"，往下滑的两声，一个声道一次
      const swallow = (t0: number, f0: number) => {
        for (let k = 0; k < 2; k++) {
          const start = Math.round((t0 + k * 0.16) * sr);
          const dur = Math.round(0.06 * sr);
          let ph = 0;
          for (let i = 0; i < dur && start + i < total; i++) {
            const tt = i / dur;
            ph += (f0 - 1100 * tt) / sr;
            const env = Math.sin(Math.PI * tt) ** 2;
            buf[start + i]! += Math.sin(TAU * ph) * env * 0.06;
          }
        }
      };
      swallow(ch === 0 ? 1.6 : 6.2, ch === 0 ? 4200 : 3900);
    } else if (id === 'cave') {
      // 空空的低鸣：很低的带通噪声，慢慢起伏，像洞里的空气
      let low = 0;
      let band = 0;
      let brown = 0;
      const shift = ch * 1.7;
      for (let i = 0; i < total; i++) {
        const t = i / sr + shift;
        const w = noise.next();
        const fc = 150 + 30 * Math.sin((TAU * t) / 8 + ch);
        const f = 2 * Math.sin((Math.PI * fc) / sr);
        low += f * band;
        const high = w - low - 0.12 * band;
        band += f * high;
        brown = brown * 0.996 + w * 0.05;
        const breathe = 0.7 + 0.3 * Math.sin((TAU * t) / 8 + 0.5 * ch);
        buf[i] = band * breathe * 0.22 + brown * 0.08;
      }
      // 水滴：一个很快往上滑的"叮"（水泡的声音），后面跟两下越来越轻的回声
      const drip = (t0: number, f0: number, vol: number) => {
        for (let echo = 0; echo < 3; echo++) {
          const start = Math.round((t0 + echo * 0.21) * sr);
          const dur = Math.round(0.09 * sr);
          const g = vol * 0.45 ** echo;
          let ph = 0;
          for (let i = 0; i < dur && start + i < total; i++) {
            const tt = i / sr;
            ph += (f0 * (1 + 1.6 * Math.min(1, tt / 0.025))) / sr;
            const env = Math.exp(-tt * 55) * Math.min(1, i / 24);
            buf[start + i]! += Math.sin(TAU * ph) * env * g;
          }
        }
      };
      // 左边、右边各自滴几滴，错开时间和音高；另一边的耳朵晚一点、轻一点也听得到
      const left: Array<[number, number, number]> = [
        [0.8, 900, 0.3],
        [3.3, 1250, 0.22],
        [5.9, 1050, 0.27],
      ];
      const right: Array<[number, number, number]> = [
        [1.9, 1150, 0.24],
        [4.6, 950, 0.3],
        [6.7, 1350, 0.18],
      ];
      const [near, far] = ch === 0 ? [left, right] : [right, left];
      for (const [t0, f0, v] of near) drip(t0, f0, v);
      for (const [t0, f0, v] of far) drip(t0 + 0.03, f0, v * 0.35);
    } else if (id === 'sea') {
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
