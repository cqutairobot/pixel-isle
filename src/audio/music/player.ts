import { renderAmbience, type AmbienceId } from './ambience';
import { JINGLES, SONGS } from './scores';
import { renderScore, type Rendered, type Score } from './sequencer';

/** 每一小片渲染最多占用主线程多少毫秒 */
const SLICE_MS = 4;

const rendered = new Map<string, Promise<Rendered>>();

/**
 * 在后台渲染一首曲子（不需要 AudioContext，所以在玩家按下第一个键、音频解锁之前就可以开始）。
 * 渲染分成很多小片，穿插在游戏帧之间；同一首只渲染一次。
 */
export function renderInBackground(id: string): Promise<Rendered> {
  const hit = rendered.get(id);
  if (hit) return hit;
  const p = new Promise<Rendered>((resolve) => {
    if (id === 'sea' || id === 'wind') {
      setTimeout(() => resolve(renderAmbience(id)), 0);
      return;
    }
    const score: Score | undefined = SONGS[id] ?? JINGLES[id];
    if (!score) throw new Error(`没有这首曲子：${id}`);
    const gen = renderScore(score);
    const tick = (): void => {
      const t0 = performance.now();
      for (;;) {
        const r = gen.next();
        if (r.done) {
          resolve(r.value);
          return;
        }
        if (performance.now() - t0 > SLICE_MS) break;
      }
      setTimeout(tick, 0);
    };
    tick();
  });
  rendered.set(id, p);
  return p;
}

interface Playing {
  id: string;
  src: AudioBufferSourceNode;
  gain: GainNode;
  buffer: AudioBuffer;
  /** 这首曲子"第 0 秒"对应的 ctx 时间（用来算播放到哪儿了） */
  t0: number;
}

/**
 * 音乐播放器（浏览器）：乐曲在后台一小片一小片地渲染，不卡画面；
 * 切歌时交叉淡化；乐句（过关、倒下、检查点、海玻璃）可以压低或打断音乐，之后从原处淡入恢复；
 * 对话时音乐压低，暂停时加低通变闷；海浪、风的环境声单独一条循环。
 */
export class MusicPlayer {
  private cache = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer>>();
  private current: Playing | null = null;
  private amb: Playing | null = null;
  /** 想要播放的曲子（可能还在渲染） */
  private want: string | null = null;
  private wantAmb: AmbienceId | null = null;
  /** 被乐句打断时记下的位置（秒） */
  private resumeAt = new Map<string, number>();
  private resumeTimer = 0;
  private interrupted = false;
  private readonly duck: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly ambBus: GainNode;
  private talking = false;
  private jingleDuck = 1;
  /** 音乐总音量（设置里调） */
  readonly bus: GainNode;

  constructor(
    private ctx: AudioContext,
    dest: AudioNode,
  ) {
    this.bus = ctx.createGain();
    this.duck = ctx.createGain();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;
    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 0.32;
    this.duck.connect(this.filter);
    this.ambBus.connect(this.filter);
    this.filter.connect(this.bus);
    this.bus.connect(dest);
    // 先把乐句渲染好（都很短）
    for (const id of Object.keys(JINGLES)) void this.load(id);
  }

  private toBuffer(r: Rendered): AudioBuffer {
    const b = this.ctx.createBuffer(2, r.left.length, r.sr);
    b.getChannelData(0).set(r.left);
    b.getChannelData(1).set(r.right);
    return b;
  }

  /** 渲染（或取缓存）并转成 AudioBuffer */
  load(id: string): Promise<AudioBuffer> {
    const hit = this.cache.get(id);
    if (hit) return Promise.resolve(hit);
    const p = this.pending.get(id);
    if (p) return p;
    const promise = renderInBackground(id).then((r) => {
      const buf = this.toBuffer(r);
      this.cache.set(id, buf);
      this.pending.delete(id);
      return buf;
    });
    this.pending.set(id, promise);
    return promise;
  }

  /** 预先渲染（例如在标题画面时渲染第 1 关的曲子） */
  prefetch(...ids: string[]): void {
    for (const id of ids) void this.load(id);
  }

  private start(
    id: string,
    buf: AudioBuffer,
    offset: number,
    fade: number,
    bus: AudioNode,
  ): Playing {
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + Math.max(0.01, fade));
    src.connect(gain).connect(bus);
    const off = offset % buf.duration;
    src.start(now, off);
    return { id, src, gain, buffer: buf, t0: now - off };
  }

  private stopPlaying(p: Playing, fade: number): void {
    const now = this.ctx.currentTime;
    p.gain.gain.cancelScheduledValues(now);
    p.gain.gain.setValueAtTime(p.gain.gain.value, now);
    p.gain.gain.linearRampToValueAtTime(0, now + Math.max(0.01, fade));
    p.src.stop(now + Math.max(0.01, fade) + 0.05);
  }

  private position(p: Playing): number {
    return (this.ctx.currentTime - p.t0) % p.buffer.duration;
  }

  /** 播放一首循环的曲子（null 停止）；已经在放就什么都不做 */
  play(id: string | null, fade = 0.8): void {
    this.want = id;
    this.interrupted = false;
    clearTimeout(this.resumeTimer);
    if (this.current && this.current.id === id) return;
    if (this.current) {
      this.resumeAt.set(this.current.id, this.position(this.current));
      this.stopPlaying(this.current, fade);
      this.current = null;
    }
    if (!id) return;
    void this.load(id).then((buf) => {
      if (this.want !== id || this.current?.id === id || this.interrupted) return;
      // 太阳果变奏和 1-1 曲子来回切换时从头开始；其他曲子接着上次的位置
      const offset = id === 'sun' ? 0 : (this.resumeAt.get(id) ?? 0);
      this.current = this.start(id, buf, offset, fade, this.duck);
    });
  }

  /**
   * 乐句。mode：duck 压低音乐（检查点、海玻璃）；interrupt 打断音乐，播完从原处淡入（倒下）；
   * end 打断音乐且不再恢复（过关）。
   */
  jingle(id: string, mode: 'duck' | 'interrupt' | 'end'): void {
    const buf = this.cache.get(id);
    if (!buf) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.filter);
    src.start(now + (mode === 'duck' ? 0 : 0.05));
    const len = JINGLES[id]!.bars * 16 * (60 / JINGLES[id]!.bpm / 4);
    if (mode === 'duck') {
      this.jingleDuck = 0.3;
      this.applyDuck(0.08);
      clearTimeout(this.resumeTimer);
      this.resumeTimer = window.setTimeout(() => {
        this.jingleDuck = 1;
        this.applyDuck(0.8);
      }, len * 1000);
      return;
    }
    const cur = this.current;
    if (cur) {
      this.resumeAt.set(cur.id, this.position(cur));
      this.stopPlaying(cur, 0.12);
      this.current = null;
    }
    this.interrupted = true;
    clearTimeout(this.resumeTimer);
    if (mode === 'interrupt' && cur) {
      const id2 = cur.id;
      this.resumeTimer = window.setTimeout(
        () => {
          this.interrupted = false;
          if (this.want === id2 && !this.current) {
            const b = this.cache.get(id2);
            if (b) this.current = this.start(id2, b, this.resumeAt.get(id2) ?? 0, 1.2, this.duck);
          }
        },
        (len + 0.4) * 1000,
      );
    }
  }

  /** 环境声循环（null 停止） */
  ambience(id: AmbienceId | null, fade = 1.5): void {
    this.wantAmb = id;
    if (this.amb?.id === id) return;
    if (this.amb) {
      this.stopPlaying(this.amb, fade);
      this.amb = null;
    }
    if (!id) return;
    void this.load(id).then((buf) => {
      if (this.wantAmb !== id || this.amb) return;
      this.amb = this.start(id, buf, Math.random() * buf.duration, fade, this.ambBus);
    });
  }

  private applyDuck(time: number): void {
    const v = (this.talking ? 0.7 : 1) * this.jingleDuck;
    const now = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setValueAtTime(this.duck.gain.value, now);
    this.duck.gain.linearRampToValueAtTime(v, now + time);
  }

  /** 对话时音乐压低 30% */
  setTalking(on: boolean): void {
    if (on === this.talking) return;
    this.talking = on;
    this.applyDuck(0.4);
  }

  /** 暂停时声音变闷 */
  setPaused(on: boolean): void {
    const now = this.ctx.currentTime;
    const f = this.filter.frequency;
    f.cancelScheduledValues(now);
    f.setValueAtTime(f.value, now);
    f.exponentialRampToValueAtTime(on ? 650 : 20000, now + 0.25);
  }

  get playing(): string | null {
    return this.current?.id ?? null;
  }
}
