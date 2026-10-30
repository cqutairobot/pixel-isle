/**
 * 分析每个音效候选：时长、峰值、RMS、起止音高（过零率估算）。
 * Claude 听不到声音，用这些数字检查"跳是上扬的、落地是低沉短促的"等是否符合预期。
 * 用法：npx tsx scripts/analyze-sfx.ts
 */
import { SFX, SFX_IDS } from '../src/audio/sfx';
import { ZZFX_SAMPLE_RATE, zzfxSamples } from '../src/audio/zzfx';

function pitch(s: Float32Array, from: number, to: number): number {
  let zc = 0;
  for (let i = Math.max(1, from); i < Math.min(s.length, to); i++)
    if (s[i - 1]! <= 0 && s[i]! > 0) zc++;
  return (zc / Math.max(1, to - from)) * ZZFX_SAMPLE_RATE;
}

for (const id of SFX_IDS) {
  SFX[id].candidates.forEach((p, n) => {
    const s = zzfxSamples(p);
    let peak = 0;
    let sum = 0;
    for (const v of s) {
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
    }
    const rms = Math.sqrt(sum / Math.max(1, s.length));
    const w = Math.floor(s.length / 4);
    const p0 = pitch(s, 0, w);
    const p1 = pitch(s, w * 3, s.length);
    console.log(
      `${id.padEnd(9)} #${n}  ${((s.length / ZZFX_SAMPLE_RATE) * 1000).toFixed(0).padStart(4)}ms  ` +
        `峰值 ${peak.toFixed(2)}  RMS ${rms.toFixed(2)}  音高 ${p0.toFixed(0)}→${p1.toFixed(0)} Hz`,
    );
  });
}
