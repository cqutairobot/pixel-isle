import Phaser from 'phaser';
import { buildTileset, GYM_THEME } from '../art/terrain';
import { audio } from '../audio/engine';
import { gym, GYM_STATIONS } from '../content/levels/gym';
import { DebugOverlay } from '../debug/overlay';
import { createTuningPanel } from '../debug/tuningPanel';
import { currentLayout, EMBEDDED, VIEW_H, VIEW_W, type Layout } from '../platform/display';
import { InputDevices } from '../platform/input';
import { FPS, TILE } from '../sim/constants';
import { BTN, EMPTY_INPUT, type InputFrame } from '../sim/input';
import { parseLevel, standAt } from '../sim/level';
import { cloneTuning, PRESETS, type PresetId } from '../sim/tuning';
import { World } from '../sim/world';
import { GymUI } from '../ui/dom/gymUI';
import { BackgroundView } from '../view/backgroundView';
import { HeroView } from '../view/heroView';
import { Juice } from '../view/juice';
import { Particles } from '../view/particles';
import { Shake } from '../view/shake';
import { ATLAS, buildTilesetTexture, TILE_MARGIN, TILE_SPACING } from '../view/textures';
import { FixedStepLoop, fitCamera, lerp, SLOW_STEPS } from './play/loop';

const SETTINGS_KEY = 'pixel-isle.gym';

interface GymSettings {
  preset: PresetId;
  autoRun: boolean;
  smooth: boolean;
}

function loadSettings(): GymSettings {
  const d: GymSettings = { preset: 'A', autoRun: false, smooth: true };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) Object.assign(d, JSON.parse(raw));
  } catch {
    // 忽略
  }
  const q = new URLSearchParams(location.search);
  const preset = q.get('preset')?.toUpperCase();
  if (preset === 'A' || preset === 'B' || preset === 'C') d.preset = preset;
  return d;
}

/**
 * 手感测试关。固定 60Hz 逻辑步 + 渲染插值；sim 产生事件，Juice 负责反馈。
 * 设计见 docs/levels/0-gym.md。
 */
export class GymScene extends Phaser.Scene {
  world!: World;
  private devices!: InputDevices;
  private ui!: GymUI;
  private hero!: HeroView;
  private particles!: Particles;
  private shake = new Shake();
  private juice!: Juice;
  private bg!: BackgroundView;
  private overlay!: DebugOverlay;
  private settings = loadSettings();
  private loop = new FixedStepLoop(() => this.simStep());
  private prev = { px: 0, py: 0, cx: 0, cy: 0 };
  private stationIndex = -1;
  private layout!: Layout;
  private lastInput: InputFrame = EMPTY_INPUT;
  private gui: { destroy(): void; domElement: HTMLElement } | null = null;
  private guiLoading = false;
  private padStartWas = false;

  constructor() {
    super('gym');
  }

  create(): void {
    const level = parseLevel(gym);
    this.world = new World(
      level,
      cloneTuning(PRESETS[this.settings.preset].tuning),
      { autoRun: this.settings.autoRun },
      VIEW_W,
      VIEW_H,
    );

    // 背景、地形、牌子
    this.bg = new BackgroundView(this, level.grid.heightPx - VIEW_H);
    const ts = buildTileset(level.grid, GYM_THEME);
    buildTilesetTexture(this, 'tiles-gym', ts);
    const map = this.make.tilemap({ data: ts.data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('gym', 'tiles-gym', TILE, TILE, TILE_MARGIN, TILE_SPACING)!;
    // 相机原点设成左上角后，Phaser 的 worldView 仍按中心计算，瓦片剔除会算错范围，所以关掉剔除
    // （练习场约 4000 块瓦片，全部绘制也毫无压力）
    const layer = map.createLayer(0, tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;
    layer.setDepth(0).setSkipCull(true);
    for (const m of level.markers) {
      const frame = m.kind === 'sign' ? `prop/sign_${m.data?.value}` : 'prop/arrow_left';
      this.add
        .image(m.col * TILE, m.row * TILE, ATLAS, frame)
        .setOrigin(0, 0)
        .setDepth(-1);
    }

    this.overlay = new DebugOverlay(this);
    this.hero = new HeroView(this);
    this.hero.sprite.setDepth(10);
    this.hero.ribbon.gfx.setDepth(9);
    this.particles = new Particles(this);
    this.juice = new Juice(
      this.particles,
      this.shake,
      this.hero,
      audio,
      () => this.cameras.main.scrollX,
    );
    this.devices = new InputDevices();
    this.ui = new GymUI();

    this.applyLayout(currentLayout());
    this.game.events.on('layout', this.applyLayout, this);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('pointerdown', this.unlockAudio);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', this.onKey);
      window.removeEventListener('pointerdown', this.unlockAudio);
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.devices.destroy();
    });

    const station = Number(new URLSearchParams(location.search).get('station') ?? 0);
    if (station >= 1 && station <= GYM_STATIONS.length) this.teleportStation(station - 1);
    this.snapPrev();
    this.hero.resetRibbon(this.world.player.body.centerX, this.world.player.body.bottom);

    this.ui.setPreset(this.settings.preset, PRESETS[this.settings.preset].name, false);
    this.ui.setRunMode(this.settings.autoRun, false);
    this.ui.setSmooth(this.settings.smooth, false);
    const touchOnly =
      matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
    if (touchOnly) this.ui.toast('练习场需要键盘或手柄，请在电脑上打开', 12000);
    else
      this.ui.toast(
        EMBEDDED
          ? '先点一下画面，再按任意键开始 · H 查看操作说明'
          : '按任意键开始 · H 查看操作说明',
        5000,
      );
    this.cameras.main.fadeIn(400, 26, 28, 44);

    (window as unknown as { __gym: unknown }).__gym = this;
  }

  private applyLayout(L: Layout): void {
    this.layout = L;
    fitCamera(this.cameras.main, L);
    this.ui.setLayout(L);
  }

  private unlockAudio = (): void => {
    // 嵌在网页框里时，点一下画面才能收到键盘输入
    window.focus();
    if (!audio.unlocked) {
      audio.unlock();
      audio.warmUp();
    }
  };

  private onVisibility = (): void => {
    if (document.hidden) {
      this.devices.releaseAll();
      this.loop.reset();
    }
  };

  private saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // 忽略
    }
  }

  private onKey = (e: KeyboardEvent): void => {
    this.unlockAudio();
    if (
      e.code.startsWith('F') &&
      /^F\d+$/.test(e.code) &&
      ['F1', 'F2', 'F4', 'F5'].includes(e.code)
    )
      e.preventDefault();
    if (e.repeat) return;
    switch (e.code) {
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
        this.setPreset((['A', 'B', 'C'] as const)[Number(e.code.slice(5)) - 1]!);
        break;
      case 'Digit4':
        this.settings.autoRun = !this.settings.autoRun;
        this.world.options.autoRun = this.settings.autoRun;
        this.ui.setRunMode(this.settings.autoRun);
        this.ui.toast(
          this.settings.autoRun ? '自动奔跑：开（一动就是跑）' : '自动奔跑：关（长按方向键才跑）',
        );
        audio.play('ui');
        this.saveSettings();
        break;
      case 'Digit5':
        this.settings.smooth = !this.settings.smooth;
        this.ui.setSmooth(this.settings.smooth);
        this.ui.toast(
          this.settings.smooth ? '镜头亚像素平滑：开' : '镜头亚像素平滑：关（按整像素移动）',
        );
        audio.play('ui');
        this.saveSettings();
        break;
      case 'KeyQ':
        this.teleportStation(Math.max(0, this.currentStation() - 1));
        break;
      case 'KeyE':
        this.teleportStation(Math.min(GYM_STATIONS.length - 1, this.currentStation() + 1));
        break;
      case 'KeyR':
        this.teleportStation(0);
        break;
      case 'KeyH':
        this.ui.toggleHelp();
        audio.play('ui', { rate: 0.9 });
        break;
      case 'KeyY':
        location.hash = 'soundboard';
        break;
      case 'KeyM':
        audio.setMuted(!audio.settings.muted);
        this.ui.toast(audio.settings.muted ? '已静音' : '声音已打开');
        break;
      case 'Backquote':
      case 'F1':
        this.overlay.setVisible(!this.overlay.visible);
        this.ui.setDebugVisible(this.overlay.visible);
        break;
      case 'KeyT':
      case 'F2':
        void this.toggleTuning();
        break;
      case 'KeyG':
      case 'F4':
        this.loop.slow = (this.loop.slow + 1) % SLOW_STEPS.length;
        this.ui.toast(`慢放 ×${this.loop.scale}`);
        break;
      case 'KeyP':
      case 'Escape':
        this.togglePause();
        break;
      case 'KeyN':
      case 'F5':
        if (this.loop.paused) this.loop.stepOnce = true;
        break;
    }
  };

  private togglePause(): void {
    this.loop.paused = !this.loop.paused;
    this.loop.reset();
    this.ui.setPaused(this.loop.paused);
  }

  private setPreset(id: PresetId): void {
    this.settings.preset = id;
    this.world.setTuning(cloneTuning(PRESETS[id].tuning));
    this.ui.setPreset(id, PRESETS[id].name);
    this.ui.toast(`手感预设 ${id}：${PRESETS[id].name}`);
    audio.play('ui');
    this.saveSettings();
    if (this.gui) {
      this.gui.destroy();
      this.gui = null;
      void this.toggleTuning();
    }
  }

  private async toggleTuning(): Promise<void> {
    if (this.gui) {
      this.gui.destroy();
      this.gui = null;
      return;
    }
    if (this.guiLoading) return;
    this.guiLoading = true;
    this.gui = await createTuningPanel({
      tuning: this.world.tuning,
      camera: this.world.camera.t,
      shake: this.shake,
      onChange: () => this.world.setTuning(this.world.tuning),
      onExport: () => this.exportTuning(),
    });
    this.guiLoading = false;
  }

  private exportTuning(): void {
    const json = JSON.stringify(
      { preset: this.settings.preset, tuning: this.world.tuning, camera: this.world.camera.t },
      null,
      2,
    );
    console.log(json);
    navigator.clipboard?.writeText(json).then(
      () => this.ui.toast('参数已复制到剪贴板，可以直接粘贴给 Claude'),
      () => this.ui.toast('复制失败：参数已打印在浏览器控制台'),
    );
  }

  private currentStation(): number {
    const col = Math.floor(this.world.player.body.centerX / TILE);
    const i = GYM_STATIONS.findIndex((s) => col >= s.from && col <= s.to);
    return Math.max(0, i);
  }

  private teleportStation(i: number): void {
    const s = GYM_STATIONS[i]!;
    const pos = standAt(s.stand[0], s.stand[1]);
    this.world.teleport(pos.x, pos.y);
    this.snapPrev();
    this.hero.resetRibbon(this.world.player.body.centerX, this.world.player.body.bottom);
    this.cameras.main.fadeIn(180, 26, 28, 44);
  }

  private snapPrev(): void {
    const w = this.world;
    this.prev = { px: w.player.body.x, py: w.player.body.y, cx: w.camera.x, cy: w.camera.y };
  }

  private simStep(): void {
    const w = this.world;
    this.prev = { px: w.player.body.x, py: w.player.body.y, cx: w.camera.x, cy: w.camera.y };
    this.lastInput = this.devices.sample();
    if (this.lastInput.pressed & BTN.attack) {
      this.ui.toast('攻击键 J：第 2 关拿到回旋海星后就能用，现在先踩敌人');
      audio.play('ui', { rate: 0.8 });
    }
    w.step(this.lastInput);
    this.juice.handle(w.events, w);
    this.overlay.onStep(w);
    for (const e of w.events) {
      if (e.type === 'fellOut') this.cameras.main.fadeOut(200, 26, 28, 44);
      if (e.type === 'respawn') {
        this.snapPrev();
        this.cameras.main.fadeIn(260, 26, 28, 44);
      }
    }
  }

  override update(_time: number, deltaMs: number): void {
    const padStart = this.devices.padStart();
    if (padStart && !this.padStartWas) this.togglePause();
    this.padStartWas = padStart;
    const { alpha, dt } = this.loop.advance(deltaMs);
    this.renderFrame(dt, alpha);
  }

  private renderFrame(dt: number, alpha: number): void {
    const w = this.world;
    const p = w.player;
    const b = p.body;
    const smooth = this.settings.smooth;
    const bx = lerp(this.prev.px, b.x, alpha);
    const by = lerp(this.prev.py, b.y, alpha);
    this.shake.update(dt);
    let cx = lerp(this.prev.cx, w.camera.x, alpha) + this.shake.x;
    let cy = lerp(this.prev.cy, w.camera.y, alpha) + this.shake.y;
    let hx = bx + b.w / 2;
    let hy = by + b.h;
    if (!smooth) {
      cx = Math.round(cx);
      cy = Math.round(cy);
      hx = Math.round(hx);
      hy = Math.round(hy);
    }
    this.cameras.main.setScroll(cx, cy);
    this.hero.update(dt, p, w.tuning, hx, hy, w.respawnTimer === 0);
    this.particles.update(dt, !smooth);
    this.juice.tick(dt, w);
    this.bg.update(dt, cx, cy);
    this.overlay.draw(
      dt,
      w,
      smooth ? bx : Math.round(bx),
      smooth ? by : Math.round(by),
      cx,
      cy,
      this.layout.k,
    );

    const si = this.currentStation();
    if (si !== this.stationIndex && w.respawnTimer === 0) {
      this.stationIndex = si;
      const s = GYM_STATIONS[si]!;
      this.ui.showStation(s.name, s.tip);
    }
    if (this.overlay.visible) this.updateDebugText();
  }

  private updateDebugText(): void {
    const w = this.world;
    const p = w.player;
    const t = w.tuning;
    const held = this.lastInput.held;
    this.ui.setKeys({
      left: (held & BTN.left) !== 0,
      right: (held & BTN.right) !== 0,
      up: (held & BTN.up) !== 0,
      down: (held & BTN.down) !== 0,
      jump: (held & BTN.jump) !== 0,
      attack: (held & BTN.attack) !== 0,
      run: w.player.running,
    });
    const bar = (v: number, max: number) =>
      `<span class="bar" style="width:calc(var(--px) * ${Math.round((v / Math.max(1, max)) * 24)})"></span>`;
    const state = !p.onGround
      ? p.vy < 0
        ? '上升'
        : '下落'
      : p.skidding
        ? '急停'
        : p.crouching
          ? '下蹲'
          : Math.abs(p.vx) > 1
            ? '跑动'
            : '站立';
    this.ui.setDebugText(
      [
        `${this.loop.fps.toFixed(0)} fps · ${this.loop.stepsThisFrame} 步/帧 · ×${this.layout.k} · dpr ${this.layout.dpr}`,
        `状态 ${state} · 帧 ${this.hero.currentFrame}`,
        `位置 ${p.body.x}, ${p.body.y}`,
        `速度 ${p.vx.toFixed(0)}, ${p.vy.toFixed(0)} px/s`,
        `土狼 ${p.coyote}/${t.coyoteFrames} ${bar(p.coyote, t.coyoteFrames)}`,
        `缓冲 ${p.buffer}/${t.bufferFrames} ${bar(p.buffer, t.bufferFrames)}`,
        `腾空 ${p.airFrames} 帧 · 粒子 ${this.particles.activeCount}`,
        `第 ${Math.floor(p.body.centerX / TILE)} 列 · 第 ${Math.floor((p.body.bottom - 1) / TILE)} 行`,
        `逻辑 ${FPS} Hz · 慢放 ×${this.loop.scale}`,
      ].join('\n'),
    );
  }
}
