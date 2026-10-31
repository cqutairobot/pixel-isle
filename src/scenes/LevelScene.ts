import Phaser from 'phaser';
import { audio } from '../audio/engine';
import { CUTSCENES } from '../content/cutscenes/1-1';
import { END_STATES } from '../content/cutscenes/endStates';
import { ADOU_SOLVED, NPC_TALK } from '../content/dialog/1-1';
import type { Line } from '../content/dialog/line';
import { LEVELS } from '../content/levels';
import { HINTS, UI_TEXT } from '../content/text';
import { DebugOverlay } from '../debug/overlay';
import { currentLayout, VIEW_H, VIEW_W, type Layout } from '../platform/display';
import { InputDevices } from '../platform/input';
import {
  loadSave,
  recordClear,
  recordGlass,
  setFlag,
  writeSave,
  type SaveData,
} from '../platform/save';
import type { SimEvent } from '../sim/events';
import type { Player } from '../sim/player';
import { BTN, EMPTY_INPUT, type InputFrame } from '../sim/input';
import { parseLevel, standAt, type ParsedLevel } from '../sim/level';
import { cloneTuning, PRESETS } from '../sim/tuning';
import { World } from '../sim/world';
import { panelTexture } from '../ui/panel';
import { Tally, type TallySfx } from '../ui/tally';
import { PixelText } from '../ui/text/pixelText';
import { EntityViews } from '../view/entities';
import { HeroView } from '../view/heroView';
import { IslandBackground } from '../view/islandBackground';
import { Juice } from '../view/juice';
import { LevelView } from '../view/levelView';
import { Particles } from '../view/particles';
import { Shake } from '../view/shake';
import { Director, type DirectorHost } from './cutscene/director';
import { FixedStepLoop, fitCamera, lerp, SLOW_STEPS } from './play/loop';
import type { UIScene } from './UIScene';

export interface LevelSceneData {
  levelId?: string;
  /** 从第几个检查点开始（调试用） */
  checkpoint?: number;
  /** prologue：序章（同一张地图的夜晚，只播过场） */
  mode?: 'play' | 'prologue';
  /** 从头开始时播放开场过场（默认播放） */
  intro?: boolean;
}

const FADE: [number, number, number] = [26, 28, 44];
/** 长按多久跳过过场（秒） */
const SKIP_HOLD = 1;
/** 序章的夜色：整体压暗、偏蓝（4×5 颜色矩阵） */
const NIGHT_MATRIX = [
  0.42, 0.06, 0.06, 0, 0.0, 0.04, 0.5, 0.1, 0, 0.0, 0.08, 0.16, 0.74, 0, 0.04, 0, 0, 0, 1, 0,
];

/**
 * 正式关卡场景（第 1 关起）。固定 60Hz 逻辑步 + 渲染插值，sim 产生事件，
 * 动效层（Juice）、实体精灵（EntityViews）与界面场景（UIScene）分别响应。
 * 设计见 docs/levels/1-1.md。
 */
export class LevelScene extends Phaser.Scene {
  world!: World;
  private level!: ParsedLevel;
  private levelId = '1-1';
  private loop = new FixedStepLoop(() => this.simStep());
  private devices!: InputDevices;
  private hero!: HeroView;
  private particles!: Particles;
  private shake = new Shake();
  private juice!: Juice;
  private bg!: IslandBackground;
  private view!: LevelView;
  private ents!: EntityViews;
  private overlay!: DebugOverlay;
  private ui!: UIScene;
  private layout!: Layout;
  private save!: SaveData;
  private prev = { cx: 0, cy: 0 };
  private lastInput: InputFrame = EMPTY_INPUT;
  private hintsShown = new Set<string>();
  private bubbleAt: (() => { x: number; y: number } | null) | null = null;
  /** 排队等着显示的提示气泡（不打断游戏，一条一条来） */
  private sayQueue: Array<{ text: string; at: () => { x: number; y: number } | null; t: number }> =
    [];
  /** 正在进行的对话或过场 */
  private story: string | null = null;
  private director: Director | null = null;
  private mode: 'play' | 'prologue' = 'play';
  private skipHold = 0;
  private skipping = false;
  /** 对话、过场结束后镜头从原来的位置平滑地回到世界镜头 */
  private handoff: { x: number; y: number; t: number } | null = null;
  private lanternGlows: Phaser.GameObjects.Image[] = [];
  private keyDone = { moved: 0, jumps: 0 };
  private death: { t: number; x: number; y: number; vy: number; dy: number } | null = null;
  private clearT = -1;
  private gray: Phaser.Filters.ColorMatrix | null = null;
  private pause: { root: Phaser.GameObjects.Container; texts: PixelText[] } | null = null;
  private startX = 0;
  private lastHx = 0;
  private lastHy = 0;

  constructor() {
    super('level');
  }

  init(data: LevelSceneData): void {
    this.levelId = data.levelId && LEVELS[data.levelId] ? data.levelId : '1-1';
    this.hintsShown = new Set();
    this.sayQueue = [];
    this.story = null;
    this.director = null;
    this.mode = data.mode ?? 'play';
    this.skipHold = 0;
    this.skipping = false;
    this.handoff = null;
    this.lanternGlows = [];
    this.keyDone = { moved: 0, jumps: 0 };
    this.death = null;
    this.clearT = -1;
    this.pause = null;
    this.loop = new FixedStepLoop(() => this.simStep());
  }

  create(data: LevelSceneData): void {
    this.save = loadSave();
    this.level = parseLevel(LEVELS[this.levelId]!);
    this.world = new World(
      this.level,
      cloneTuning(PRESETS.A.tuning),
      { autoRun: false, foundGlass: this.save.levels[this.levelId]?.glass ?? [] },
      VIEW_W,
      VIEW_H,
    );
    const cp = data.checkpoint ? this.world.checkpoints[data.checkpoint - 1] : undefined;
    if (cp) {
      const pos = standAt(cp.col, cp.row);
      this.world.teleport(pos.x, pos.y);
    }
    this.startX = this.world.player.body.x;

    this.bg = new IslandBackground(this, this.level, this.mode === 'prologue');
    this.view = new LevelView(this, this.level);
    this.particles = new Particles(this);
    this.ents = new EntityViews(this, this.world, this.particles);
    this.overlay = new DebugOverlay(this);
    this.hero = new HeroView(this);
    this.hero.sprite.setDepth(10);
    this.hero.ribbon.gfx.setDepth(9);
    this.juice = new Juice(
      this.particles,
      this.shake,
      this.hero,
      audio,
      () => this.cameras.main.scrollX,
    );
    this.devices = new InputDevices();
    this.gray = this.cameras.main.filters.internal.addColorMatrix();
    this.gray.colorMatrix.grayscale(1);
    this.gray.setActive(false);

    this.ui = this.scene.get('ui') as UIScene;
    this.ui.setCover(0);
    this.ui.setLevelUI(this.mode === 'play');
    this.ui.hud.setMaxHearts(this.world.maxHearts, this.world.hearts);
    this.ui.hud.setShells(0, true);
    this.syncGlass();
    this.ui.bubble.onType = () =>
      audio.play('ui', { volume: 0.25, rate: 1.6 + Math.random() * 0.2 });

    this.applyLayout(currentLayout());
    this.game.events.on('layout', this.applyLayout, this);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('pointerdown', this.unlockAudio);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.once('shutdown', () => {
      this.game.events.off('layout', this.applyLayout, this);
      window.removeEventListener('keydown', this.onKey);
      window.removeEventListener('pointerdown', this.unlockAudio);
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.devices.destroy();
      this.ui.closeAll();
      this.ui.bubble.hide();
      this.ui.setLevelUI(false);
    });

    this.snapPrev();
    this.hero.resetRibbon(this.world.player.body.centerX, this.world.player.body.bottom);
    (window as unknown as { __level: unknown }).__level = this;
    if (this.mode === 'prologue') {
      audio.music.play('night', 2);
      audio.music.ambience('wind');
      this.setupNight();
      this.playCutscene('prologue', () => {
        setFlag(this.save, 'prologueSeen');
        writeSave(this.save);
        this.scene.restart({ levelId: this.levelId });
      });
      return;
    }
    this.cameras.main.fadeIn(500, ...FADE);
    audio.music.play(this.level.music ?? 'beach', 1.5);
    audio.music.ambience('sea');
    if (!cp && data.intro !== false && CUTSCENES.intro) {
      this.playCutscene('intro', () => {
        this.ui.cinema.banner(UI_TEXT.chapter, UI_TEXT.levelTitle);
        this.time.delayedCall(2600, () => this.ui.keyHint.show('move', this.scheme()));
      });
    } else this.time.delayedCall(700, () => this.ui.keyHint.show('move', this.scheme()));
  }

  /** 序章：夜色滤镜、点亮的灯笼、藏起白天才有的人和东西 */
  private setupNight(): void {
    const night = this.cameras.main.filters.internal.addColorMatrix();
    night.colorMatrix.set(NIGHT_MATRIX);
    this.ents.setNpcsVisible(false);
    for (const d of this.view.decos) {
      if (d.kind === 'statue') d.img.setVisible(false);
      // 霜降来之前，钟楼还没有结霜；圆窗里亮着灯
      if (d.kind === 'tower') {
        d.img.setFrame('deco/tower_clean');
        this.lanternGlows.push(
          this.add
            .image(d.img.x + 40, d.img.y - d.img.height + 92, 'atlas', 'npc/glow')
            .setBlendMode(1)
            .setDepth(-11)
            .setScale(1.3)
            .setAlpha(0.6),
        );
      }
      if (d.kind === 'lantern') {
        const g = this.add
          .image(d.img.x + 4, d.img.y - d.img.height + 9, 'atlas', 'npc/glow')
          .setBlendMode(1)
          .setDepth(-7)
          .setScale(1.6)
          .setAlpha(0.55);
        this.lanternGlows.push(g);
      }
    }
  }

  private applyLayout(L: Layout): void {
    this.layout = L;
    fitCamera(this.cameras.main, L);
  }

  private scheme(): 'wasd' | 'arrows' | 'pad' {
    return this.devices.lastDevice === 'gamepad' ? 'pad' : this.devices.arrows ? 'arrows' : 'wasd';
  }

  private unlockAudio = (): void => {
    window.focus();
    if (!audio.unlocked) {
      audio.unlock();
      audio.warmUp();
    }
  };

  private onVisibility = (): void => {
    if (document.hidden) {
      this.devices.releaseAll();
      if (!this.loop.paused && this.clearT < 0 && !this.story) this.setPaused(true);
    }
  };

  /** 开发用按键（PLAN §2.10；Mac 的 F 键是媒体键，所以主要用字母） */
  private onKey = (e: KeyboardEvent): void => {
    this.unlockAudio();
    if (e.repeat) return;
    if (this.pause && e.code === 'KeyR') {
      this.scene.restart({ levelId: this.levelId });
      return;
    }
    switch (e.code) {
      case 'Backquote':
      case 'F1':
        e.preventDefault();
        this.overlay.setVisible(!this.overlay.visible);
        break;
      case 'KeyG':
        this.loop.slow = (this.loop.slow + 1) % SLOW_STEPS.length;
        this.ui.toast.show(`慢放 ×${this.loop.scale}`);
        break;
      case 'KeyN':
        if (this.loop.paused) this.loop.stepOnce = true;
        break;
      case 'Digit1':
      case 'Digit2':
        if (e.shiftKey)
          this.scene.restart({ levelId: this.levelId, checkpoint: Number(e.code.slice(5)) });
        break;
    }
  };

  private setPaused(on: boolean): void {
    this.loop.paused = on;
    this.loop.reset();
    audio.music.setPaused(on);
    audio.play('open', { volume: 0.6, rate: on ? 1 : 0.85 });
    if (on && !this.pause) {
      const ui = this.ui;
      const root = ui.add.container(0, 0).setDepth(40);
      root.add(ui.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x1a1c2c, 0.45).setOrigin(0, 0));
      const w = 168;
      const h = 46;
      const x = (VIEW_W - w) / 2;
      const y = (VIEW_H - h) / 2 - 10;
      root.add(ui.add.image(x, y, panelTexture(ui, w, h)).setOrigin(0, 0));
      const t1 = new PixelText(ui, 0, y + 8, UI_TEXT.paused, { color: 'red1' });
      t1.setPosition(Math.round((VIEW_W - t1.width) / 2), y + 8);
      const t2 = new PixelText(ui, 0, y + 25, UI_TEXT.pauseHint, { color: 'night' });
      t2.setPosition(Math.round((VIEW_W - t2.width) / 2), y + 25);
      root.add([t1.root, t2.root]);
      root.y = -20;
      root.setAlpha(0);
      ui.tweens.add({ targets: root, y: 0, alpha: 1, duration: 180, ease: 'Back.Out' });
      this.pause = { root, texts: [t1, t2] };
    } else if (!on && this.pause) {
      const p = this.pause;
      this.pause = null;
      this.ui.tweens.add({
        targets: p.root,
        alpha: 0,
        duration: 120,
        onComplete: () => {
          for (const t of p.texts) t.destroy();
          p.root.destroy();
        },
      });
    }
  }

  private snapPrev(): void {
    const w = this.world;
    this.prev = { cx: w.camera.x, cy: w.camera.y };
  }

  // —— 逻辑步 ——

  private simStep(): void {
    const w = this.world;
    this.prev = { cx: w.camera.x, cy: w.camera.y };
    const input = this.devices.sample();
    this.lastInput = input;
    if (w.waiting && !this.story) this.beginStory();
    // 对话、过场期间世界不前进（这些帧也不记进回放）
    if (this.story) return;
    if (input.pressed & BTN.attack && w.state === 'play') this.hint('attack');
    w.step(input);
    this.juice.handle(w.events, w);
    this.ents.onEvents(w.events);
    this.overlay.onStep(w);
    this.handleEvents(w.events);
    // 按键提示：做到了就提前收起
    const p = w.player;
    if (Math.abs(p.body.x - this.startX) > 40) this.ui.keyHint.done('move');
    if (p.running) this.ui.keyHint.done('run');
  }

  /** 世界在等对话或过场：开始播放，播完再让世界继续（结果和跳过、回放一致） */
  private beginStory(): void {
    const w = this.world;
    if (w.pendingTalk) {
      const id = w.pendingTalk;
      this.story = `talk:${id}`;
      this.ui.keyHint.done('talk');
      const lines = this.talkLines(id);
      const done = () => this.endStory(() => w.resolveTalk());
      if (lines.length) this.playDialog(lines, done);
      else done();
    } else if (w.pendingTrigger) {
      const id = w.pendingTrigger;
      this.playCutscene(id, () => w.resolveTrigger(END_STATES[id] ?? {}));
    }
  }

  /**
   * 播放一段过场。世界在过场期间不前进；播完（或跳过）后调用 resolve 套用结束状态。
   * 没有分镜的阻塞触发直接套用结束状态。
   */
  private playCutscene(id: string, resolve: () => void): void {
    const script = CUTSCENES[id];
    this.story = id;
    if (!script) {
      this.endStory(resolve);
      return;
    }
    this.ents.storyMode = true;
    this.ui.bubble.hide();
    if (this.ui.keyHint.current) this.ui.keyHint.done(this.ui.keyHint.current);
    const w = this.world;
    const b = w.player.body;
    const cam = this.cameras.main;
    const host: DirectorHost = {
      scene: this,
      ui: this.ui,
      particles: this.particles,
      hero: { x: b.centerX, y: b.bottom, facing: w.player.facing },
      camera: { x: cam.scrollX - this.shake.x, y: cam.scrollY - this.shake.y },
      bounds: { w: this.level.grid.widthPx, h: this.level.grid.heightPx },
      headOf: (who) => this.ents.headOf(who),
      emote: (at, kind, life) => this.ents.emote(at, kind, life),
      sfx: (sid, opts) => audio.play(sid, opts),
      music: (mid) => this.playMusic(mid),
      shake: (a) => this.shake.add(a),
      signal: (name) => this.onSignal(name),
      toast: (text) => this.ui.toast.show(text, 2.4),
      dialog: this.dialogSounds(),
    };
    const d = new Director(host);
    this.director = d;
    this.ui.skip.hint(this.skipLabel());
    void script(d).then(() => {
      // 回回从演出精灵无缝换成跟着小满的那一个
      const hui = d.where('huihui');
      if (hui) this.ents.placeHuihui(hui.x, hui.y);
      d.finish();
      this.director = null;
      this.ents.heroAt = null;
      this.ui.skip.hide();
      this.endStory(resolve);
      if (this.skipping) {
        this.skipping = false;
        const c = { a: 1 };
        this.tweens.add({
          targets: c,
          a: 0,
          duration: 300,
          onUpdate: () => this.ui.setCover(c.a),
        });
      }
    });
  }

  private endStory(resolve: () => void): void {
    // 记下现在画面上的镜头位置，套用结束状态后从这里平滑地回到世界镜头
    const cam = this.cameras.main;
    const from = { x: cam.scrollX - this.shake.x, y: cam.scrollY - this.shake.y };
    resolve();
    this.snapPrev();
    this.handoff = { ...from, t: 0 };
    // 关掉对话框的那一下按键不能让小满跳起来
    this.devices.flush();
    this.story = null;
    this.ents.storyMode = false;
  }

  private skipLabel(): string {
    return this.devices.lastDevice === 'gamepad' ? UI_TEXT.skipPad : UI_TEXT.skipKey;
  }

  /** 长按 Esc / Start 跳过过场：快速变黑 → 跳到结尾 → 淡入 */
  private updateSkip(dt: number, held: number): void {
    const d = this.director;
    const holding = !!d && !this.skipping && (held & (BTN.start | BTN.cancel)) !== 0;
    this.skipHold = holding ? this.skipHold + dt : 0;
    this.ui.skip.update(dt, Math.min(1, this.skipHold / SKIP_HOLD), this.skipLabel());
    if (!d || this.skipHold < SKIP_HOLD) return;
    this.skipHold = 0;
    this.skipping = true;
    audio.play('confirm', { volume: 0.6 });
    const c = { a: this.ui.cinema.coverAlpha };
    this.tweens.add({
      targets: c,
      a: 1,
      duration: 160,
      onUpdate: () => this.ui.setCover(c.a),
      onComplete: () => d.skip(),
    });
  }

  /** 过场里关卡场景特有的演出 */
  private onSignal(name: string): void {
    if (name === 'lightsOut') {
      // 灯火闪两下就灭了
      for (const g of this.lanternGlows)
        this.tweens.chain({
          targets: g,
          tweens: [
            { alpha: 0.15, duration: 90 },
            { alpha: 0.5, duration: 70 },
            { alpha: 0.1, duration: 80 },
            { alpha: 0.35, duration: 60 },
            { alpha: 0, duration: 220 },
          ],
        });
    } else if (name === 'frost') {
      // 冰霜从钟楼往两边蔓延：钟楼一下子结满了霜
      for (const d of this.view.decos) if (d.kind === 'tower') d.img.setFrame('deco/tower');
      const x0 = 70 * 16 + 30;
      for (let i = 0; i < 26; i++) {
        const dir = i % 2 ? 1 : -1;
        const k = Math.floor(i / 2);
        this.time.delayedCall(k * 70, () =>
          this.particles.spawn({
            x: x0 + dir * k * 22,
            y: 12 * 16 - 2,
            vy: -18,
            life: 0.9,
            frames: ['fx2/snow_1', 'fx2/snow_0'],
            fade: true,
          }),
        );
      }
      this.shake.add(0.2);
    }
  }

  /** 过场里换音乐：音乐停下时只留风声 */
  private playMusic(id: string | null): void {
    audio.music.play(id, id ? 1.2 : 1.5);
    if (this.mode === 'play') audio.music.ambience(id ? 'sea' : 'wind');
  }

  private dialogSounds(): DirectorHost['dialog'] {
    return {
      voice: (pitch) => audio.play('voice', { rate: pitch, volume: 0.7 }),
      sfx: (s) =>
        s === 'page'
          ? audio.play('page', { volume: 0.7 })
          : audio.play('open', { volume: 0.5, rate: s === 'close' ? 0.8 : 1 }),
    };
  }

  /** 和 NPC 交谈：第一次说 first（记进存档），之后说 again；阿豆在风铃解开后说 after */
  private talkLines(id: string): readonly Line[] {
    const talk = NPC_TALK[id];
    if (!talk) return [];
    if (id === 'adou' && this.world.flags.has('chimesSolved') && talk.after) return talk.after;
    const flag = `talk:${id}`;
    if (talk.first.length && !this.save.flags.includes(flag)) {
      setFlag(this.save, flag);
      writeSave(this.save);
      return talk.first;
    }
    return talk.again;
  }

  private playDialog(lines: readonly Line[], onDone: () => void): void {
    this.ents.storyMode = true;
    this.ui.dialog(lines, {
      ...this.dialogSounds(),
      anchor: (who) => this.screenAnchor(who),
      onDone,
    });
  }

  /** 某人头顶在屏幕上的位置（对话框从这里弹出） */
  private screenAnchor(who: string): { x: number; y: number } | null {
    const at = this.ents.headOf(who);
    if (!at) return null;
    const cam = this.cameras.main;
    return { x: at.x - cam.scrollX, y: at.y - cam.scrollY };
  }

  /** 排队显示一个跟着某人走的提示气泡 */
  private say(text: string, at: () => { x: number; y: number } | null): void {
    this.sayQueue.push({ text, at, t: this.time.now });
  }

  /** 回回的提示（每条只出现一次）；回回还没出现时由小满头顶说 */
  private hint(id: string): void {
    if (this.hintsShown.has(id) || !HINTS[id]) return;
    this.hintsShown.add(id);
    this.say(
      HINTS[id]!,
      () =>
        this.ents.huihuiPos ?? {
          x: this.world.player.body.centerX,
          y: this.world.player.body.y - 4,
        },
    );
  }

  private handleEvents(events: readonly SimEvent[]): void {
    const w = this.world;
    const hud = this.ui.hud;
    for (const e of events) {
      switch (e.type) {
        case 'jump':
          if (++this.keyDone.jumps >= 2) this.ui.keyHint.done('jump');
          break;
        case 'drop':
          this.ui.keyHint.done('drop');
          break;
        case 'trigger':
          if (e.id.startsWith('key:')) this.ui.keyHint.show(e.id.slice(4) as 'talk', this.scheme());
          else if (e.id.startsWith('hint:')) this.hint(e.id.slice(5));
          break;
        case 'enemyActivate':
          if (w.flags.has('huihui')) this.hint('crab');
          break;
        case 'enemyDefeat':
          hud.setShells(w.stats.shells);
          if (e.cause === 'stomp') this.time.delayedCall(350, () => this.hint('firstStomp'));
          this.flyShells(e.x, e.y - 10, e.reward);
          break;
        case 'collect':
          hud.setShells(w.stats.shells);
          if (e.kind === 'glass' && e.glass !== undefined && e.glass >= 0) {
            if (!e.ghost) {
              audio.music.jingle('glass', 'duck');
              recordGlass(this.save, this.levelId, e.glass);
              writeSave(this.save);
              this.ui.toast.show(`${UI_TEXT.glassFound} ${'①②③'[e.glass]}`);
            } else this.ui.toast.show(UI_TEXT.glassAgain);
            this.syncGlass();
            hud.pulseGlass(e.glass);
            this.ents.mood('happy', 1);
          } else if (e.kind === 'sun') this.ui.toast.show(UI_TEXT.sunFruit);
          break;
        case 'itemSpawn':
          if (e.kind === 'sun') this.hint('sun');
          break;
        case 'hurt':
          hud.setHearts(w.hearts);
          break;
        case 'heal':
          hud.setHearts(e.hearts);
          break;
        case 'splash':
          if (e.big) {
            this.hint('water');
            this.time.delayedCall(260, () => this.cameras.main.fadeOut(160, ...FADE));
          }
          break;
        case 'fellOut':
          this.cameras.main.fadeOut(160, ...FADE);
          break;
        case 'sun':
          audio.music.play(e.on ? 'sun' : (this.level.music ?? 'beach'), e.on ? 0.3 : 0.9);
          break;
        case 'death':
          audio.music.jingle('death', 'interrupt');
          this.death = { t: 0, x: e.x, y: e.y, vy: -230, dy: 0 };
          this.gray?.setActive(true);
          break;
        case 'respawn':
          this.snapPrev();
          this.hero.resetRibbon(w.player.body.centerX, w.player.body.bottom);
          this.cameras.main.fadeIn(e.cause === 'death' ? 260 : 220, ...FADE);
          if (e.cause === 'death') {
            this.death = null;
            this.hero.override = null;
            this.gray?.setActive(false);
            hud.setHearts(w.hearts);
          }
          break;
        case 'checkpoint':
          audio.music.jingle('checkpoint', 'duck');
          this.ui.toast.show(UI_TEXT.checkpoint);
          if (e.index === 2) this.time.delayedCall(900, () => this.hint('cp2'));
          break;
        case 'chimeSolved':
          this.ents.emote('adou', 'note', 1.6);
          this.time.delayedCall(700, () => {
            for (const l of ADOU_SOLVED) this.say(l.text, () => this.ents.npcTop('adou'));
          });
          break;
        case 'clear':
          audio.music.jingle('clear', 'end');
          this.clearT = 0;
          this.ui.keyHint.done('move');
          this.hint('gate');
          break;
      }
    }
  }

  /** 敌人答谢的贝壳飞向 HUD */
  private flyShells(x: number, y: number, n: number): void {
    const cam = this.cameras.main;
    const ui = this.ui;
    const target = ui.hud.shellTarget;
    for (let i = 0; i < Math.min(5, n); i++) {
      const sx = x - cam.scrollX + (i - (n - 1) / 2) * 6;
      const sy = y - cam.scrollY;
      const img = ui.add.image(sx, sy, 'atlas', 'item/shell_0').setDepth(12).setScale(0.8);
      const mid = { x: (sx + target.x) / 2 + 20, y: Math.min(sy, target.y) - 30 };
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(sx, sy),
        new Phaser.Math.Vector2(mid.x, mid.y),
        new Phaser.Math.Vector2(target.x, target.y),
      );
      const prog = { t: 0 };
      ui.tweens.add({
        targets: prog,
        t: 1,
        delay: 120 + i * 70,
        duration: 480,
        ease: 'Cubic.In',
        onUpdate: () => {
          const pt = curve.getPoint(prog.t);
          img.setPosition(pt.x, pt.y).setScale(0.8 + prog.t * 0.2);
        },
        onComplete: () => {
          img.destroy();
          ui.hud.bumpShellIcon();
          audio.play('shell', { volume: 0.5, rate: 1.5 + i * 0.06 });
        },
      });
    }
  }

  private syncGlass(): void {
    const ghost = this.save.levels[this.levelId]?.glass ?? [];
    this.ui.hud.setGlass(this.world.stats.glass, ghost);
  }

  private openTally(): void {
    const w = this.world;
    const prev = this.save.levels[this.levelId]?.bestFrames ?? null;
    const noDamage = !w.stats.damaged;
    const newRecord = recordClear(
      this.save,
      this.levelId,
      w.stats.frames,
      w.stats.shells,
      noDamage,
    );
    writeSave(this.save);
    const tally = new Tally(
      this.ui,
      {
        title: UI_TEXT.tallyTitle,
        frames: w.stats.frames,
        bestFrames: prev,
        newRecord,
        shells: w.stats.shells,
        glass: w.stats.glass,
        ghost: this.save.levels[this.levelId]?.glass.map((g, i) => g && !w.stats.glass[i]) ?? [],
        noDamage,
      },
      [UI_TEXT.retry],
      () => {
        this.cameras.main.fadeOut(300, ...FADE);
        this.time.delayedCall(320, () => this.scene.restart({ levelId: this.levelId }));
      },
      (s: TallySfx) =>
        audio.play(s === 'pop' ? 'glass' : s === 'move' ? 'ui' : s, {
          volume: s === 'tick' ? 0.5 : 1,
        }),
    );
    this.ui.openModal(tally);
  }

  // —— 每个渲染帧 ——

  override update(_time: number, deltaMs: number): void {
    const uiIn = this.devices.sampleUI();
    this.updateSkip(Math.min(deltaMs, 100) / 1000, uiIn.held);
    if (this.ui.modal) {
      this.ui.modal.input(uiIn.pressed, uiIn.held);
    } else if (uiIn.pressed & BTN.start && this.clearT < 0 && !this.story) {
      this.setPaused(!this.loop.paused);
    } else if (this.pause && uiIn.pressed & BTN.cancel) {
      this.setPaused(false);
    }
    this.ui.keyHint.refresh(this.scheme());
    audio.music.setTalking(!!this.story);
    const { alpha, dt } = this.loop.advance(deltaMs);
    this.renderFrame(dt, alpha);
  }

  private renderFrame(dt: number, alpha: number): void {
    const w = this.world;
    const p = w.player;
    const b = p.body;
    this.shake.update(dt);
    const d = this.director;
    d?.update(dt);
    let bx = lerp(this.prev.cx, w.camera.x, alpha);
    let by = lerp(this.prev.cy, w.camera.y, alpha);
    // 过场镜头按权重混进来；过场、对话结束后从原来的位置平滑地回到世界镜头
    if (d && d.cam.w > 0) {
      bx = lerp(bx, d.cam.x, d.cam.w);
      by = lerp(by, d.cam.y, d.cam.w);
    } else if (this.handoff) {
      const h = this.handoff;
      h.t = Math.min(1, h.t + dt / 0.5);
      const k = 0.5 - Math.cos(h.t * Math.PI) / 2;
      bx = lerp(h.x, bx, k);
      by = lerp(h.y, by, k);
      if (h.t >= 1) this.handoff = null;
    }
    const cx = bx + this.shake.x;
    const cy = by + this.shake.y;
    this.cameras.main.setScroll(cx, cy);
    let hx = lerp(b.px, b.x, alpha) + b.w / 2;
    let hy = lerp(b.py, b.y, alpha) + b.h;

    // 主角的特殊姿势：受击硬直、死亡抛物线、通关欢呼
    let visible = w.respawnTimer === 0 && this.mode === 'play';
    const pup = d?.hero;
    if (pup) {
      // 过场：小满由导演摆布
      hx = pup.x;
      hy = pup.y;
      visible = pup.visible && this.mode === 'play';
      this.hero.override = pup.pose;
      this.ents.heroAt = { x: pup.x, y: pup.y, facing: pup.facing };
    } else if (this.death) {
      const d = this.death;
      d.t += dt;
      if (d.t < 0.2) this.hero.override = 'hurt';
      else {
        this.hero.override = 'ko';
        d.vy += 700 * dt;
        d.dy += d.vy * dt;
      }
      hy += d.dy;
      if (d.t > 0.82 && d.t - dt <= 0.82) this.cameras.main.fadeOut(150, ...FADE);
    } else if (this.clearT >= 0) {
      this.clearT += dt;
      if (p.onGround)
        this.hero.override = Math.floor(this.clearT * 4) % 2 ? 'victory_1' : 'victory_0';
      if (this.clearT > 1.7 && this.clearT - dt <= 1.7) this.openTally();
    } else {
      this.hero.override = w.stun > 0 ? 'hurt' : null;
      if (w.iframes > 0 && (w.iframes >> 2) % 2 === 1) visible = false;
    }
    // 主角一下子挪了很远（过场结束、传送）：帽带直接放到新位置，不要拉出长线
    if (Math.abs(hx - this.lastHx) > 24 || Math.abs(hy - this.lastHy) > 24)
      this.hero.resetRibbon(hx, hy);
    this.lastHx = hx;
    this.lastHy = hy;
    if (pup) {
      const puppet = {
        facing: pup.facing,
        onGround: true,
        vx: pup.vx,
        vy: 0,
        crouching: false,
        lookingUp: false,
        skidding: false,
      } as unknown as Player;
      this.hero.update(dt, puppet, w.tuning, hx, hy, visible);
    } else this.hero.update(dt, p, w.tuning, hx, hy, visible);
    this.ents.update(dt, alpha, cx);
    this.particles.update(dt, false);
    this.juice.tick(dt, w);
    this.bg.update(dt, cx, cy);
    this.view.update(dt);
    this.overlay.draw(dt, w, lerp(b.px, b.x, alpha), lerp(b.py, b.y, alpha), cx, cy, this.layout.k);
    // 提示气泡：一条一条显示，对话和过场期间先等着；等太久的就不显示了
    const q = this.sayQueue;
    while (q.length && this.time.now - q[0]!.t > 6000) q.shift();
    if (q.length && !this.story && !this.ui.modal && !this.ui.bubble.busy) {
      const next = q.shift()!;
      this.bubbleAt = next.at;
      this.ui.bubble.show(next.text);
    }
    // 气泡跟着说话的人
    const at = this.bubbleAt?.();
    this.ui.bubble.update(dt, (at?.x ?? hx) - cx, (at?.y ?? hy - 20) - cy);
  }
}
