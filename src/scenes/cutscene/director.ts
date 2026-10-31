import type Phaser from 'phaser';
import type { SfxId } from '../../audio/sfx';
import type { Line } from '../../content/dialog/line';
import { VIEW_H, VIEW_W } from '../../platform/display';
import type { DialogBox, DialogHooks } from '../../ui/dialogBox';
import type { Particles, ParticleSpec } from '../../view/particles';
import { ATLAS } from '../../view/textures';
import type { UIScene } from '../UIScene';

export type Ease = (t: number) => number;

export const EASE = {
  linear: (t: number) => t,
  inOut: (t: number) => 0.5 - Math.cos(t * Math.PI) / 2,
  out: (t: number) => 1 - (1 - t) * (1 - t),
  in: (t: number) => t * t,
  back: (t: number) => {
    const c1 = 1.70158;
    return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
} satisfies Record<string, Ease>;

export type EmoteKind = 'bang' | 'q' | 'note' | 'dots';
type Point = { x: number; y: number };

/** 过场里由导演摆布的小满：位置是脚底中心（世界坐标） */
export interface Puppet {
  x: number;
  y: number;
  facing: 1 | -1;
  /** 走动的速度（只用来选跑步帧） */
  vx: number;
  /** 指定的姿势帧（hero/ 下的帧名）；null 按走动自动选 */
  pose: string | null;
  visible: boolean;
}

/** 导演需要关卡场景提供的东西 */
export interface DirectorHost {
  scene: Phaser.Scene;
  ui: UIScene;
  particles: Particles;
  /** 过场开始时小满的位置和朝向 */
  hero: { x: number; y: number; facing: 1 | -1 };
  /** 过场开始时镜头左上角 */
  camera: Point;
  /** 关卡尺寸（px），过场镜头不出界 */
  bounds: { w: number; h: number };
  /** NPC、回回等的头顶位置（世界坐标） */
  headOf(who: string): Point | null;
  emote(at: () => Point | null, kind: EmoteKind, life: number): void;
  sfx(id: SfxId, opts?: { volume?: number; rate?: number; pan?: number }): void;
  music(id: string | null): void;
  shake(amount: number): void;
  /** 关卡场景特有的演出（熄灯、冰霜蔓延……） */
  signal(name: string): void;
  toast(text: string): void;
  dialog: Pick<DialogHooks, 'voice' | 'sfx'>;
}

export interface SpawnOptions {
  depth?: number;
  origin?: [number, number];
  alpha?: number;
  scale?: number;
  flip?: boolean;
  /** 叠加发光 */
  add?: boolean;
  /** 头顶离图片原点多高（对话框、表情气泡的锚点） */
  head?: number;
  /** 循环播放的帧 */
  frames?: string[];
  fps?: number;
  /** 上下浮动的幅度（px） */
  bob?: number;
  /** 身后带一圈光晕（回回） */
  glow?: boolean;
  /** 说话时按表情换帧，例如 { happy: 'npc/huihui_happy' } */
  faces?: Record<string, string>;
}

interface Prop {
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image | null;
  head: number;
  /** 逻辑位置（移动指令改的是它，浮动在它上面叠加） */
  x: number;
  y: number;
  frames: string[] | null;
  fps: number;
  bob: number;
  faces: Record<string, string> | null;
  /** 当前表情帧；null 时播放循环帧 */
  face: string | null;
}

interface Tween {
  step(dt: number): boolean;
}

/**
 * 过场导演：过场脚本是一段 async 函数，按顺序 await 导演的指令
 * （说话、走路、镜头、淡入淡出、生成和移动演出用的精灵……），读起来就像分镜。
 *
 * 这里只管"演"：世界在过场期间不前进，过场结束后由关卡场景套用这段过场的结束状态
 * （src/content/cutscenes/endStates.ts），所以看完、跳过、回放三种情况结果完全一样。
 * 跳过：skip() 让所有等待立即结束，之后的指令都变成空操作，脚本一口气跑到结尾。
 */
export class Director {
  readonly hero: Puppet;
  /** 过场镜头（左上角，世界坐标）与权重：0 = 用世界镜头，1 = 完全用过场镜头 */
  readonly cam = { x: 0, y: 0, w: 0 };
  /** 允许镜头往关卡上方看（序章从夜空摇下来） */
  allowAbove = false;
  skipped = false;
  private props = new Map<string, Prop>();
  private tweens: Tween[] = [];
  private pending = new Set<() => void>();
  private box: DialogBox | null = null;
  private cover = 0;
  private time = 0;

  constructor(private host: DirectorHost) {
    this.hero = { ...host.hero, vx: 0, pose: null, visible: true };
    this.cam.x = host.camera.x;
    this.cam.y = host.camera.y;
  }

  get particles(): Particles {
    return this.host.particles;
  }

  /** 一个可以被跳过的等待 */
  private wait4(start: (done: () => void) => void): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return new Promise((resolve) => {
      const done = (): void => {
        if (this.pending.delete(done)) resolve();
      };
      this.pending.add(done);
      start(done);
    });
  }

  /** 把 obj 上的数值在 dur 秒内变到 to */
  private animate<T extends object>(
    obj: T,
    to: Partial<Record<keyof T, number>>,
    dur: number,
    ease: Ease = EASE.inOut,
    onUpdate?: () => void,
  ): Promise<void> {
    if (this.skipped) return Promise.resolve();
    const o = obj as Record<string, number>;
    const keys = Object.keys(to);
    const from = Object.fromEntries(keys.map((k) => [k, o[k]!]));
    return this.wait4((done) => {
      let t = 0;
      this.tweens.push({
        step: (dt) => {
          t = Math.min(dur, t + dt);
          const k = ease(dur > 0 ? t / dur : 1);
          for (const key of keys)
            o[key] = from[key]! + ((to as Record<string, number>)[key]! - from[key]!) * k;
          onUpdate?.();
          if (t >= dur) {
            done();
            return false;
          }
          return true;
        },
      });
    });
  }

  // —— 时间 ——

  wait(seconds: number): Promise<void> {
    return this.wait4((done) => {
      let t = 0;
      this.tweens.push({
        step: (dt) => {
          t += dt;
          if (t >= seconds) done();
          return t < seconds;
        },
      });
    });
  }

  /** 同时做几件事，全部做完再往下 */
  all(...steps: Array<Promise<void>>): Promise<void> {
    return Promise.all(steps).then(() => undefined);
  }

  // —— 对白 ——

  say(
    lines: readonly Line[],
    opts: { place?: DialogHooks['place']; onLine?: (index: number, line: Line) => void } = {},
  ): Promise<void> {
    return this.wait4((done) => {
      this.box = this.host.ui.dialog(lines, {
        ...this.host.dialog,
        place: opts.place ?? 'auto',
        anchor: (who) => this.screenOf(who),
        onLine: (i, line) => {
          // 演出精灵说话时换成对应的表情
          const p = this.props.get(line.who);
          if (p?.faces) p.face = p.faces[line.face ?? 'normal'] ?? null;
          opts.onLine?.(i, line);
        },
        onDone: () => {
          this.box = null;
          done();
        },
      });
    });
  }

  emote(who: string, kind: EmoteKind, life = 1.1): void {
    if (this.skipped) return;
    this.host.emote(() => this.anchorOf(who), kind, life);
    this.host.sfx('emote', { volume: 0.7 });
  }

  /** 某人头顶的世界坐标：小满（木偶）、演出精灵、NPC、回回 */
  anchorOf(who: string): Point | null {
    if (who === 'xiaoman' || who === 'hero') return { x: this.hero.x, y: this.hero.y - 19 };
    const p = this.props.get(who);
    if (p) return { x: p.x, y: p.y - p.head };
    return this.host.headOf(who);
  }

  private screenOf(who: string): Point | null {
    const a = this.anchorOf(who);
    if (!a) return null;
    const cam = this.host.scene.cameras.main;
    return { x: a.x - cam.scrollX, y: a.y - cam.scrollY };
  }

  // —— 小满 ——

  /** 走（或跑）到 x；朝向跟着方向走 */
  walk(x: number, speed = 60): Promise<void> {
    if (this.skipped) return Promise.resolve();
    const h = this.hero;
    const dir = x >= h.x ? 1 : -1;
    h.facing = dir;
    h.pose = null;
    return this.wait4((done) => {
      this.tweens.push({
        step: (dt) => {
          const left = (x - h.x) * dir;
          const v = Math.min(speed, left / Math.max(dt, 1e-3));
          h.x += v * dir * dt;
          h.vx = left > 0.5 ? speed * dir : 0;
          if ((x - h.x) * dir <= 0.5) {
            h.x = x;
            h.vx = 0;
            done();
            return false;
          }
          return true;
        },
      });
    });
  }

  face(dir: 1 | -1): void {
    if (!this.skipped) this.hero.facing = dir;
  }

  pose(frame: string | null): void {
    if (!this.skipped) this.hero.pose = frame;
  }

  showHero(on: boolean): void {
    if (!this.skipped) this.hero.visible = on;
  }

  // —— 镜头 ——

  private clampCam(x: number, y: number): Point {
    const b = this.host.bounds;
    return {
      x: Math.max(0, Math.min(b.w - VIEW_W, x)),
      y: Math.max(this.allowAbove ? -1000 : 0, Math.min(b.h - VIEW_H, y)),
    };
  }

  /** 镜头中心移到 (cx, cy) */
  camera(cx: number, cy: number, dur: number, ease: Ease = EASE.inOut): Promise<void> {
    if (this.skipped) return Promise.resolve();
    const to = this.clampCam(cx - VIEW_W / 2, cy - VIEW_H / 2);
    this.cam.w = 1;
    if (dur <= 0) {
      this.cam.x = to.x;
      this.cam.y = to.y;
      return Promise.resolve();
    }
    return this.animate(this.cam, { x: to.x, y: to.y }, dur, ease);
  }

  /** 把镜头还给世界（慢慢混回去） */
  release(dur = 0.6): Promise<void> {
    return this.animate(this.cam, { w: 0 }, dur, EASE.inOut);
  }

  shake(amount: number): void {
    if (!this.skipped) this.host.shake(amount);
  }

  // —— 画面 ——

  letterbox(on: boolean): void {
    if (!this.skipped) this.host.ui.letterbox(on);
  }

  /** 全屏盖一层深色（1 = 全黑） */
  fade(to: number, dur: number): Promise<void> {
    const state = { a: this.cover };
    return this.animate(state, { a: to }, dur, EASE.linear, () => {
      this.cover = state.a;
      this.host.ui.setCover(state.a);
    });
  }

  /** 画面中间的一行字幕（例如"第二天清晨——"） */
  async caption(text: string, seconds: number): Promise<void> {
    if (this.skipped) return;
    this.host.ui.caption(text);
    await this.wait(seconds);
    this.host.ui.caption(null);
    await this.wait(0.5);
  }

  // —— 演出用的精灵 ——

  spawn(id: string, frame: string, x: number, y: number, o: SpawnOptions = {}): void {
    if (this.skipped) return;
    this.remove(id);
    const scene = this.host.scene;
    const depth = o.depth ?? 8;
    const glow = o.glow
      ? scene.add
          .image(x, y, ATLAS, 'npc/glow')
          .setDepth(depth - 0.5)
          .setBlendMode(1)
          .setAlpha(0.3)
      : null;
    const img = scene.add
      .image(x, y, ATLAS, frame)
      .setOrigin(...(o.origin ?? [0.5, 1]))
      .setDepth(depth)
      .setAlpha(o.alpha ?? 1)
      .setScale(o.scale ?? 1)
      .setFlipX(!!o.flip);
    if (o.add) img.setBlendMode(1);
    this.props.set(id, {
      img,
      glow,
      head: o.head ?? img.height * (o.origin?.[1] ?? 1),
      x,
      y,
      frames: o.frames ?? null,
      fps: o.fps ?? 4,
      bob: o.bob ?? 0,
      faces: o.faces ?? null,
      face: null,
    });
  }

  prop(id: string): Phaser.GameObjects.Image | null {
    return this.props.get(id)?.img ?? null;
  }

  /** 演出精灵的逻辑位置 */
  where(id: string): Point | null {
    const p = this.props.get(id);
    return p ? { x: p.x, y: p.y } : null;
  }

  /** 换帧（同时停掉循环帧） */
  frame(id: string, frame: string): void {
    const p = this.props.get(id);
    if (!p || this.skipped) return;
    p.frames = null;
    p.face = null;
    p.img.setFrame(frame);
  }

  /** 循环播放几帧 */
  cycle(id: string, frames: string[], fps = 4): void {
    const p = this.props.get(id);
    if (!p || this.skipped) return;
    p.frames = frames;
    p.fps = fps;
    p.face = null;
  }

  flip(id: string, on: boolean): void {
    if (!this.skipped) this.prop(id)?.setFlipX(on);
  }

  remove(id: string): void {
    const p = this.props.get(id);
    p?.img.destroy();
    p?.glow?.destroy();
    this.props.delete(id);
  }

  /** 移动演出精灵（直线） */
  move(id: string, x: number, y: number, dur: number, ease: Ease = EASE.inOut): Promise<void> {
    const p = this.props.get(id);
    if (!p) return Promise.resolve();
    return this.animate(p, { x, y }, dur, ease);
  }

  /** 沿抛物线飞到 (x, y)，弧顶比两端连线高 height */
  arc(id: string, x: number, y: number, height: number, dur: number): Promise<void> {
    const p = this.props.get(id);
    if (!p || this.skipped) return Promise.resolve();
    const x0 = p.x;
    const y0 = p.y;
    const s = { t: 0 };
    return this.animate(s, { t: 1 }, dur, EASE.inOut, () => {
      p.x = x0 + (x - x0) * s.t;
      p.y = y0 + (y - y0) * s.t - 4 * height * s.t * (1 - s.t);
    });
  }

  tweenProp(
    id: string,
    to: { alpha?: number; scale?: number; angle?: number },
    dur: number,
    ease: Ease = EASE.inOut,
  ): Promise<void> {
    const img = this.prop(id);
    if (!img) return Promise.resolve();
    const s = { alpha: img.alpha, scale: img.scaleX, angle: img.angle };
    return this.animate(s, to, dur, ease, () => {
      img.setAlpha(s.alpha).setScale(s.scale).setAngle(s.angle);
    });
  }

  // —— 声音、粒子 ——

  sfx(id: SfxId, opts?: { volume?: number; rate?: number; pan?: number }): void {
    if (!this.skipped) this.host.sfx(id, opts);
  }

  music(id: string | null): void {
    if (!this.skipped) this.host.music(id);
  }

  burst(n: number, spec: (i: number) => ParticleSpec): void {
    if (this.skipped) return;
    for (let i = 0; i < n; i++) this.host.particles.spawn(spec(i));
  }

  /** 只在没被跳过时执行（不影响结果的小动作） */
  call(fn: () => void): void {
    if (!this.skipped) fn();
  }

  signal(name: string): void {
    if (!this.skipped) this.host.signal(name);
  }

  toast(text: string): void {
    if (!this.skipped) this.host.toast(text);
  }

  // —— 由关卡场景调用 ——

  update(dt: number): void {
    this.time += dt;
    this.tweens = this.tweens.filter((t) => t.step(dt));
    for (const p of this.props.values()) {
      const bob = p.bob ? Math.sin(this.time * 2.6) * p.bob : 0;
      p.img.setPosition(Math.round(p.x), Math.round(p.y + bob));
      if (p.face) p.img.setFrame(p.face);
      else if (p.frames) p.img.setFrame(p.frames[Math.floor(this.time * p.fps) % p.frames.length]!);
      p.glow
        ?.setPosition(Math.round(p.x), Math.round(p.y + bob))
        .setAlpha((0.28 + Math.sin(this.time * 3) * 0.08) * p.img.alpha)
        .setScale(p.img.scaleX);
    }
  }

  /** 跳过：关掉对话框，让所有等待立即结束 */
  skip(): void {
    if (this.skipped) return;
    this.skipped = true;
    if (this.box) {
      this.host.ui.closeModal(this.box);
      this.box = null;
    }
    for (const done of [...this.pending]) done();
    this.tweens = [];
  }

  /** 过场结束（看完或跳过）：收拾演出用的东西 */
  finish(): void {
    if (this.box) {
      this.host.ui.closeModal(this.box);
      this.box = null;
    }
    for (const id of [...this.props.keys()]) this.remove(id);
    this.tweens = [];
    this.pending.clear();
    this.host.ui.letterbox(false);
    this.host.ui.caption(null);
  }
}
