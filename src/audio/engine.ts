import type { AmbienceId } from './music/ambience';
import { MusicPlayer, renderInBackground } from './music/player';
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
 * 音乐的门面：解锁音频之前的调用先记下来（想放哪首、环境声），解锁后再交给播放器。
 */
export class MusicControl {
  player: MusicPlayer | null = null;
  private want: string | null = null;
  private wantAmb: AmbienceId | null = null;
  private prefetched: string[] = [];

  attach(p: MusicPlayer): void {
    this.player = p;
    p.prefetch(...this.prefetched);
    if (this.want) p.play(this.want, 1.2);
    if (this.wantAmb) p.ambience(this.wantAmb);
  }

  play(id: string | null, fade?: number): void {
    this.want = id;
    // 还没解锁也先开始渲染，玩家按下第一个键时多半已经好了
    if (id && !this.player) void renderInBackground(id);
    this.player?.play(id, fade);
  }

  ambience(id: AmbienceId | null): void {
    this.wantAmb = id;
    if (id && !this.player) void renderInBackground(id);
    this.player?.ambience(id);
  }

  jingle(id: string, mode: 'duck' | 'interrupt' | 'end'): void {
    this.player?.jingle(id, mode);
  }

  setTalking(on: boolean): void {
    this.player?.setTalking(on);
  }

  setPaused(on: boolean): void {
    this.player?.setPaused(on);
  }

  prefetch(...ids: string[]): void {
    this.prefetched.push(...ids);
    for (const id of ids) void renderInBackground(id);
    this.player?.prefetch(...ids);
  }
}

/**
 * 音频引擎：一个 AudioContext、总音量、音效总线和音乐播放器。
 * 浏览器要求用户操作后才能出声，所以第一次按键时调用 unlock()。
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<string, number>();
  choices: Record<SfxId, number> = loadJSON(CHOICES_KEY, { ...DEFAULT_CHOICES });
  settings = loadJSON(SETTINGS_KEY, { muted: false, volume: 0.8, music: 0.7, sfx: 1 });
  readonly music = new MusicControl();

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
      this.music.attach(new MusicPlayer(this.ctx, this.master));
      this.applyVolume();
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  private applyVolume(): void {
    if (this.master) this.master.gain.value = this.settings.muted ? 0 : this.settings.volume;
    if (this.sfxBus) this.sfxBus.gain.value = this.settings.sfx;
    if (this.music.player) this.music.player.bus.gain.value = this.settings.music;
  }

  /** 总音量、音乐、音效（0–1） */
  setVolumes(v: { volume?: number; music?: number; sfx?: number }): void {
    Object.assign(this.settings, v);
    this.applyVolume();
    this.save(SETTINGS_KEY, this.settings);
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

// 调试与浏览器测试用
if (typeof window !== 'undefined') (window as unknown as { __audio: AudioEngine }).__audio = audio;
