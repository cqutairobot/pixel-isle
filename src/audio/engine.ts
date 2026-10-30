import { DEFAULT_CHOICES, SFX, SFX_IDS, type SfxId } from './sfx';
import { normalize, ZZFX_SAMPLE_RATE, zzfxSamples } from './zzfx';

const CHOICES_KEY = 'pixel-isle.sfx-choices';
const SETTINGS_KEY = 'pixel-isle.audio';
/** 归一化后的峰值，约 -6 dBFS */
const PEAK = 0.5;
/** 同一音效同时最多播放几个 */
const MAX_VOICES = 4;

export interface PlayOptions {
  volume?: number;
  /** 播放速率（同时改变音高），1 为原速 */
  rate?: number;
  pan?: number;
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}

/**
 * 音频引擎：一个 AudioContext、总音量与音效总线。
 * 浏览器要求用户操作后才能出声，所以第一次按键时调用 unlock()。
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<string, number>();
  choices: Record<SfxId, number> = loadJSON(CHOICES_KEY, { ...DEFAULT_CHOICES });
  settings = loadJSON(SETTINGS_KEY, { muted: false, volume: 0.8 });

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyVolume();
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  private applyVolume(): void {
    if (this.master) this.master.gain.value = this.settings.muted ? 0 : this.settings.volume;
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.applyVolume();
    this.save(SETTINGS_KEY, this.settings);
  }

  setChoice(id: SfxId, index: number): void {
    this.choices[id] = index;
    this.save(CHOICES_KEY, this.choices);
  }

  private save(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 隐私模式等情况下存不了，忽略
    }
  }

  private buffer(id: SfxId, candidate: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const key = `${id}#${candidate}`;
    let buf = this.buffers.get(key);
    if (!buf) {
      const slot = SFX[id];
      const params = slot.candidates[candidate] ?? slot.candidates[0]!;
      const samples = normalize(zzfxSamples(params), PEAK * slot.gain);
      buf = this.ctx.createBuffer(1, Math.max(1, samples.length), ZZFX_SAMPLE_RATE);
      buf.getChannelData(0).set(samples);
      this.buffers.set(key, buf);
    }
    return buf;
  }

  /** 预先合成当前选中的所有音效，避免第一次播放时卡顿 */
  warmUp(): void {
    for (const id of SFX_IDS) this.buffer(id, this.choices[id]);
  }

  play(id: SfxId, opts: PlayOptions = {}, candidate = this.choices[id]): void {
    if (!this.ctx || !this.sfxBus || this.ctx.state !== 'running') return;
    const voiceKey = id;
    const n = this.voices.get(voiceKey) ?? 0;
    if (n >= MAX_VOICES) return;
    const buf = this.buffer(id, candidate);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    const gain = this.ctx.createGain();
    gain.gain.value = opts.volume ?? 1;
    const pan = new StereoPannerNode(this.ctx, { pan: Math.max(-1, Math.min(1, opts.pan ?? 0)) });
    src.connect(pan).connect(gain).connect(this.sfxBus);
    this.voices.set(voiceKey, n + 1);
    src.onended = () =>
      this.voices.set(voiceKey, Math.max(0, (this.voices.get(voiceKey) ?? 1) - 1));
    src.start();
  }
}

export const audio = new AudioEngine();
