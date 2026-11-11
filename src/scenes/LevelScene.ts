import Phaser from 'phaser';
import { audio } from '../audio/engine';
import type { AmbienceId } from '../audio/music/ambience';
import { RIDE_VERSIONS } from '../audio/music/scores';
import { END_STATES } from '../content/cutscenes/endStates';
import { ADOU_SOLVED } from '../content/dialog/1-1';
import { ECHO_GAG } from '../content/dialog/1-3';
import { COMPANIONS, EQUIPMENT, EQUIPMENT_IDS } from '../content/equipment';
import { mapUnlocked } from '../content/map';
import { LEVEL_CONTENT, type LevelContent } from '../content/levelContent';
import type { Line } from '../content/dialog/line';
import { LEVELS } from '../content/levels';
import { HINTS, MAP_TEXT, MENU_TEXT, UI_TEXT } from '../content/text';
import { DebugOverlay } from '../debug/overlay';
import { currentLayout, VIEW_H, VIEW_W, type Layout } from '../platform/display';
import { InputDevices } from '../platform/input';
import {
  addEquipment,
  emptySave,
  loadSave,
  recordClear,
  recordGlass,
  setFlag,
  writeSave,
  type SaveData,
} from '../platform/save';
import { TILE } from '../sim/constants';
import type { SimEvent } from '../sim/events';
import type { Player } from '../sim/player';
import { BTN, EMPTY_INPUT, type InputFrame } from '../sim/input';
import { parseLevel, standAt, type ParsedLevel } from '../sim/level';
import { cloneTuning, PRESETS, RULES } from '../sim/tuning';
import { outfitOf } from '../content/outfits';
import { ConchBubble } from '../view/conchBubble';
import { World } from '../sim/world';
import { settings, SHAKE_INTENSITY } from '../platform/settings';
import { ConfirmBox } from '../ui/panelModal';
import { ItemGet } from '../ui/itemGet';
import { PauseMenu } from '../ui/pauseMenu';
import { SettingsPanel } from '../ui/settingsPanel';
import { Tally, type TallySfx } from '../ui/tally';
import { CliffBackground } from '../view/cliffBackground';
import { EntityViews } from '../view/entities';
import { HeroView } from '../view/heroView';
import { GroveBackground } from '../view/groveBackground';
import { IslandBackground } from '../view/islandBackground';
import { Juice } from '../view/juice';
import { LevelView } from '../view/levelView';
import { MountView } from '../view/mountView';
import { Particles } from '../view/particles';
import { Shake } from '../view/shake';
import { StarfishView } from '../view/starfishView';
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
  private content!: LevelContent;
  private loop = new FixedStepLoop(() => this.simStep());
  private devices!: InputDevices;
  private hero!: HeroView;
  private particles!: Particles;
  private shake = new Shake();
  private juice!: Juice;
  private bg!: IslandBackground | GroveBackground | CliffBackground;
  private mount!: MountView;
  private conchBubble!: ConchBubble;
  /** 洞（背墙）的范围，按格子：小满走进去时环境声换成回声洞 */
  private caves: Array<[number, number, number, number]> = [];
  private inCave = false;
  private caveTimer = 0;
  /** 过场把音乐停了（只剩风声）：这时不去换环境声 */
  private quiet = false;
  private starfishView!: StarfishView;
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
  /** "摸摸她"的按键提示：骑过咩铃以后，第一次徒步站在她旁边时出现一次 */
  private petHint = { rode: false, shown: false };
  /** "W 骑上"的按键提示还没出过（或者回回刚提醒过要骑上）：站到咩铃旁边时出现 */
  private rideKeyWanted = true;
  /** 只有咩铃上得去的崖坎前：徒步时回回的提醒，和徒步路过时先不说的二段跳提示 */
  private wallHelp = { t: 0, said: 0, doublePending: false, restomp: false };
  private death: { t: number; x: number; y: number; vy: number; dy: number } | null = null;
  private clearT = -1;
  private gray: Phaser.Filters.ColorMatrix | null = null;
  private pauseMenu: PauseMenu | null = null;
  private blur: Phaser.Filters.Blur | null = null;
  /** 正在离开这个场景（转场中） */
  private leaving = false;
  private startX = 0;
  private lastHx = 0;
  private lastHy = 0;

  constructor() {
    super('level');
  }

  init(data: LevelSceneData): void {
    this.levelId = data.levelId && LEVELS[data.levelId] ? data.levelId : '1-1';
    this.content = LEVEL_CONTENT[this.levelId] ?? LEVEL_CONTENT['1-1']!;
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
    this.petHint = { rode: false, shown: false };
    this.rideKeyWanted = true;
    this.wallHelp = { t: 0, said: 0, doublePending: false, restomp: false };
    this.death = null;
    this.clearT = -1;
    this.pauseMenu = null;
    this.leaving = false;
    this.loop = new FixedStepLoop(() => this.simStep());
  }

  create(data: LevelSceneData): void {
    this.save = loadSave();
    this.level = parseLevel(LEVELS[this.levelId]!);
    // 背包道具（docs/levels/1-3.md §5）：进关时喝掉椰子水（多一颗蓝心）；护身海螺带进去，用掉才从背包里拿走
    const bag = this.save.bag;
    const useBag = this.mode === 'play' && !this.level.practice;
    const drink = useBag && bag.coconut > 0;
    if (drink) {
      bag.coconut -= 1;
      writeSave(this.save);
    }
    this.world = new World(
      this.level,
      cloneTuning(PRESETS.A.tuning),
      {
        autoRun: settings.autoRun,
        assist: settings.assist,
        foundGlass: this.save.levels[this.levelId]?.glass ?? [],
        // 拿到过的装备（海星）一直带着；再玩 1-2 时不再重播开场；
        // 这一关记进存档的剧情标记（例如救出过咩铃）也带上，看过的开场、结尾不再播放
        flags: [
          ...this.save.equipment,
          ...(this.content.storyFlags ?? []).filter((f) => this.save.flags.includes(f)),
        ],
        blueHearts: drink ? 1 : 0,
        conch: useBag && bag.conch > 0,
      },
      VIEW_W,
      VIEW_H,
    );
    const cp = data.checkpoint ? this.world.checkpoints[data.checkpoint - 1] : undefined;
    if (cp) {
      const pos = standAt(cp.col, cp.row);
      this.world.teleport(pos.x, pos.y);
    }
    this.startX = this.world.player.body.x;

    const theme = this.level.themes[0]?.theme;
    this.bg =
      theme === 'grove'
        ? new GroveBackground(this, this.level)
        : theme === 'cliff'
          ? new CliffBackground(this, this.level)
          : new IslandBackground(this, this.level, this.mode === 'prologue');
    this.view = new LevelView(this, this.level);
    this.particles = new Particles(this);
    this.ents = new EntityViews(this, this.world, this.particles);
    this.starfishView = new StarfishView(this, this.world);
    this.overlay = new DebugOverlay(this);
    this.hero = new HeroView(this);
    this.hero.setOutfit(outfitOf(this.save.outfit));
    this.hero.sprite.setDepth(10);
    this.hero.ribbon.gfx.setDepth(9);
    this.juice = new Juice(
      this.particles,
      this.shake,
      this.hero,
      audio,
      () => this.cameras.main.scrollX,
    );
    this.mount = new MountView(this, this.world, this.particles, this.hero.sprite);
    this.conchBubble = new ConchBubble(this, this.particles);
    this.mount.onStep = (x, y, speed) => this.juice.goatStep(x, y, speed);
    this.devices = new InputDevices();
    this.gray = this.cameras.main.filters.internal.addColorMatrix();
    this.gray.colorMatrix.grayscale(1);
    this.gray.setActive(false);
    this.blur = this.cameras.main.filters.internal.addBlur(1, 1, 1, 1);
    this.blur.setActive(false);
    this.applySettings();

    this.ui = this.scene.get('ui') as UIScene;
    this.ui.setCover(0);
    this.ui.setLevelUI(this.mode === 'play');
    this.ui.hud.setMaxHearts(this.world.maxHearts, this.world.hearts);
    this.ui.hud.setConch(this.world.conch);
    // 椰子水：开场一会儿以后"咕嘟"一声，蓝心弹出来
    if (drink)
      this.time.delayedCall(900, () => {
        this.ui.hud.setBlueHearts(this.world.blueHearts);
        audio.play('coconutDrink', { volume: 0.9 });
      });
    this.ui.hud.setShells(0, true);
    this.ui.hud.setEquip(this.world.equipment.length > 0);
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
      this.ui.edgeWarn.clear();
      this.ui.hud.setMount(false);
      this.ui.setLevelUI(false);
    });

    this.snapPrev();
    this.hero.resetRibbon(this.world.player.body.centerX, this.world.player.body.bottom);
    (window as unknown as { __level: unknown }).__level = this;
    if (this.mode === 'prologue') {
      audio.music.play('night', 2);
      audio.music.ambience('wind');
      void this.ui.transition.reveal(0.4);
      this.setupNight();
      this.playCutscene('prologue', () => {
        setFlag(this.save, 'prologueSeen');
        writeSave(this.save);
        this.scene.restart({ levelId: this.levelId });
      });
      return;
    }
    if (this.ui.transition.covered) void this.ui.transition.reveal(0.7);
    else this.cameras.main.fadeIn(500, ...FADE);
    this.caves = this.level.entities.flatMap((e) =>
      e.type === 'backdrop' && e.kind === 'cave' ? [e.rect] : [],
    );
    this.inCave = this.caveAt();
    this.quiet = false;
    audio.music.play(this.levelMusic(), 1.5);
    audio.music.ambience(this.ambience());
    const ride = RIDE_VERSIONS[this.level.music ?? ''];
    if (ride) audio.music.prefetch(ride);
    const c = this.content;
    const startKey = c.startKey;
    if (!cp && data.intro !== false && c.intro && c.cutscenes[c.intro]) {
      this.playCutscene(c.intro, () => {
        setFlag(this.save, 'introSeen');
        writeSave(this.save);
        this.showTitleCard();
        if (startKey)
          this.time.delayedCall(2600, () => this.ui.keyHint.show(startKey, this.scheme()));
      });
    } else if (startKey)
      this.time.delayedCall(700, () => this.ui.keyHint.show(startKey, this.scheme()));
    else if (!cp) this.time.delayedCall(600, () => this.showTitleCard());
  }

  /** 环境声：椰林里是风吹树叶加远处的海浪，海崖上是大风和崖燕，洞里是滴水，其他地方是海浪 */
  private ambience(): AmbienceId {
    if (this.inCave) return 'cave';
    const theme = this.level.themes[0]?.theme;
    return theme === 'grove' ? 'grove' : theme === 'cliff' ? 'cliff' : 'sea';
  }

  /** 小满（脚下那一格）在不在洞里 */
  private caveAt(): boolean {
    const b = this.world.player.body;
    const col = Math.floor(b.centerX / TILE);
    const row = Math.floor((b.bottom - 1) / TILE);
    return this.caves.some(([c, r, w, h]) => col >= c && col < c + w && row >= r && row < r + h);
  }

  /** 走进、走出洞时换环境声；在洞口来回晃不会一直换 */
  private updateAmbience(dt: number): void {
    if (!this.caves.length || this.mode !== 'play') return;
    if (this.caveAt() === this.inCave) {
      this.caveTimer = 0;
      return;
    }
    this.caveTimer += dt;
    if (this.caveTimer < 0.35) return;
    this.caveTimer = 0;
    this.inCave = !this.inCave;
    if (!this.quiet) audio.music.ambience(this.ambience());
  }

  /** 本关的曲子；骑着咩铃时换成骑乘版（如果这首有） */
  private levelMusic(): string {
    const id = this.level.music ?? 'beach';
    return (this.world.player.ride && RIDE_VERSIONS[id]) || id;
  }

  /** 骑上、下来咩铃：正在放本关曲子的话，换成另一个版本，从同一个位置接着放 */
  private syncRideMusic(): void {
    const base = this.level.music ?? 'beach';
    const ride = RIDE_VERSIONS[base];
    const now = audio.music.wanted;
    if (!ride || (now !== base && now !== ride)) return;
    const next = this.levelMusic();
    if (next !== now) audio.music.swap(next);
  }

  /** 关卡开场标题卡：章节名、关卡名、本关找到过的海玻璃 */
  private showTitleCard(): void {
    const glass = this.save.levels[this.levelId]?.glass ?? [];
    this.ui.titleCard.show(UI_TEXT.chapter, this.content.banner, glass);
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
    if (this.pauseMenu && e.code === 'KeyR') {
      this.restartLevel();
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

  /** 设置面板改了：震屏强度、减少闪烁、自动奔跑立即生效（辅助模式下次进关生效） */
  private applySettings(): void {
    this.shake.intensity = SHAKE_INTENSITY[settings.shake];
    this.hero.reduceFlash = settings.reduceFlash;
    this.world.options.autoRun = settings.autoRun;
  }

  private setPaused(on: boolean): void {
    if (on === this.loop.paused) return;
    this.loop.paused = on;
    this.loop.reset();
    audio.music.setPaused(on);
    this.blur?.setActive(on);
    if (on && !this.pauseMenu) {
      this.devices.releaseAll();
      this.pauseMenu = new PauseMenu(this.ui.host, {
        resume: () => {
          this.pauseMenu = null;
          this.setPaused(false);
        },
        restart: () => {
          this.pauseMenu = null;
          this.restartLevel();
        },
        settings: () =>
          this.ui.openModal(
            new SettingsPanel(this.ui.host, {
              open: (m) => this.ui.openModal(m),
              changed: () => this.applySettings(),
              cleared: () => (this.save = emptySave()),
              toast: (t) => this.ui.toast.show(t),
            }),
          ),
        // 地图开放以后，暂停菜单的最后一项是"回到地图"（地图菜单里再回标题）
        leaveLabel: mapUnlocked(this.save) ? MAP_TEXT.toMap : undefined,
        toTitle: () =>
          mapUnlocked(this.save)
            ? this.ui.openModal(
                new ConfirmBox(this.ui.host, MENU_TEXT.toMapConfirm, () => this.gotoMap()),
              )
            : this.ui.openModal(
                new ConfirmBox(this.ui.host, MENU_TEXT.toTitleConfirm, () => this.gotoTitle()),
              ),
      });
      this.ui.openModal(this.pauseMenu);
    } else if (!on && this.pauseMenu) {
      const m = this.pauseMenu;
      this.pauseMenu = null;
      if (!m.isClosing) m.close();
    }
  }

  /** 重新开始本关（不再播放开场） */
  private restartLevel(): void {
    if (this.leaving) return;
    this.leaving = true;
    void this.ui.transition
      .run('fade', true, 0.3)
      .then(() => this.scene.restart({ levelId: this.levelId, intro: false }));
  }

  /** 回到章节地图（通关后会在地图上播放路径解锁） */
  private gotoMap(): void {
    if (this.leaving) return;
    this.leaving = true;
    void this.ui.transition.run('bell', true, 0.7).then(() => this.scene.start('map'));
  }

  private gotoTitle(): void {
    if (this.leaving) return;
    this.leaving = true;
    void this.ui.transition.run('bell', true, 0.7).then(() => this.scene.start('title'));
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
    if (input.pressed & BTN.attack && w.state === 'play' && !w.equipment.length)
      this.hint('attack');
    w.step(input);
    this.juice.handle(w.events, w);
    this.ents.onEvents(w.events);
    this.overlay.onStep(w);
    this.handleEvents(w.events);
    // 按键提示：做到了就提前收起
    const p = w.player;
    if (Math.abs(p.body.x - this.startX) > 40) this.ui.keyHint.done('move');
    if (p.running) this.ui.keyHint.done('run');
    // "W 骑上"排在"摸摸她"前面：回回提醒"骑上咩铃"以后，先告诉玩家怎么骑
    this.maybeRideHint();
    this.maybePetHint();
    this.updateGoatWall();
  }

  /**
   * "W 骑上"：站到咩铃旁边、而且还没提示过时出现（再玩这一关时没有"咩铃出圈"过场，
   * 也靠这个提示）；回回提醒过"骑上咩铃"以后再出现一次
   */
  private maybeRideHint(): void {
    const w = this.world;
    if (!this.rideKeyWanted || w.player.ride || !w.mountTarget || this.ui.keyHint.current) return;
    this.rideKeyWanted = false;
    this.ui.keyHint.show('ride', this.scheme(), 6);
  }

  /**
   * 只有骑着咩铃二段跳才上得去的崖坎前（LevelContent.goatWall）：
   * - 徒步站在下面（跳着也算）0.4 秒，回回提醒：咩铃还冻着就回去救她，救出来了就骑上她；
   *   一直在这里打转的话每 10 秒再提醒一次，最多 3 次。
   * - 提醒过"回去救她"以后，走回冰晶旁边时再提示一次"跳上去，踩冰晶"。
   * - 徒步路过时没说的二段跳提示，等骑着来到这里再说。
   */
  private updateGoatWall(): void {
    const zone = this.content.goatWall;
    if (!zone) return;
    const h = this.wallHelp;
    const w = this.world;
    const p = w.player;
    const b = p.body;
    const col = b.centerX / TILE;
    const below = b.bottom > (zone.feetRow - 6) * TILE;
    const inZone = col >= zone.cols[0] && col < zone.cols[1] && below && w.state === 'play';
    if (p.ride) {
      if (h.doublePending && inZone) {
        h.doublePending = false;
        this.hint('double');
        this.ui.keyHint.show('doubleJump', this.scheme());
      }
      return;
    }
    const crystal = w.crystal;
    if (h.restomp && crystal && p.onGround && !this.ui.keyHint.current) {
      if (Math.abs(b.centerX - (crystal.rect.x + crystal.rect.w / 2)) <= 5 * TILE) {
        h.restomp = false;
        this.ui.keyHint.show('stomp', this.scheme());
      }
    }
    if (!inZone || h.said >= 3) return;
    h.t += 1 / 60;
    const due = h.said === 0 ? 0.4 : 0.4 + 10 * h.said;
    if (h.t < due) return;
    h.said++;
    if (w.flags.has('mieling')) {
      this.hintAgain('needRide');
      // 咩铃不在身边的话 2 秒内会自己蹦回来；站到她旁边时再提示"W 骑上"
      this.rideKeyWanted = true;
    } else {
      this.hintAgain('freeGoat');
      h.restomp = true;
    }
  }

  /** 骑过咩铃、又第一次徒步站到她身边（多半是在石门前下来以后）：提示可以摸摸她 */
  private maybePetHint(): void {
    const h = this.petHint;
    const w = this.world;
    const p = w.player;
    const g = w.goat;
    if (h.shown || !g || p.ride) return;
    if (!h.rode || w.flags.has('petted') || this.ui.keyHint.current) return;
    if (!p.onGround || (g.mode !== 'idle' && g.mode !== 'home')) return;
    if (Math.abs(g.body.centerX - p.body.centerX) > RULES.petRange) return;
    if (Math.abs(g.body.bottom - p.body.bottom) > 4) return;
    h.shown = true;
    this.ui.keyHint.show('pet', this.scheme(), 5);
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
      this.playCutscene(id, () => {
        const hadEquip = w.equipment.length > 0;
        const end = END_STATES[id] ?? {};
        w.resolveTrigger(end);
        // 记进存档的剧情标记
        const story = (end.flags ?? []).filter((f) => this.content.storyFlags?.includes(f));
        if (story.length) {
          for (const f of story) setFlag(this.save, f);
          writeSave(this.save);
        }
        if (id === 'rescue') {
          this.rideKeyWanted = false;
          this.time.delayedCall(400, () => this.ui.keyHint.show('ride', this.scheme(), 6));
        }
        if (id === 'echo') this.time.delayedCall(700, () => this.hint('echoGlint'));
        // 拿到的装备记进存档
        const got = (end.flags ?? []).filter((f) => EQUIPMENT_IDS.includes(f));
        if (got.length) {
          for (const f of got) addEquipment(this.save, f);
          writeSave(this.save);
        }
        if (!hadEquip && w.equipment.length) {
          this.ui.hud.setEquip(true, true);
          this.time.delayedCall(500, () => this.ui.keyHint.show('throw', this.scheme(), 6));
        }
      });
    }
  }

  /**
   * 播放一段过场。世界在过场期间不前进；播完（或跳过）后调用 resolve 套用结束状态。
   * 没有分镜的阻塞触发直接套用结束状态。
   */
  private playCutscene(id: string, resolve: () => void): void {
    const script = this.content.cutscenes[id];
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
      hero: { x: b.centerX, y: b.bottom, facing: w.player.facing, mounted: !!w.player.ride },
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
      hasFlag: (name) => this.world.flags.has(name),
      itemGet: (eid, at, done) => {
        const companion = COMPANIONS[eid];
        const info = companion ?? EQUIPMENT[eid]!;
        const cam = this.cameras.main;
        audio.music.jingle(eid === 'mieling' ? 'newFriend' : 'itemGet', 'duck');
        const m = new ItemGet(this.ui.host, {
          name: info.name,
          head: companion?.head,
          usage: info.usage[this.scheme()],
          frame: info.bigFrame,
          at: { x: at.x - cam.scrollX, y: at.y - cam.scrollY },
          onClose: done,
        });
        this.ui.openModal(m);
        return m;
      },
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
      // 过场里换成演出精灵的 NPC 回到原位
      if (this.mode === 'play') this.ents.setNpcsVisible(true);
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
    // npc:<编号>:hide / show：过场里把关卡里的 NPC 换成演出精灵
    const npc = /^npc:(\w+):(hide|show)$/.exec(name);
    if (npc) {
      this.ents.setNpcVisible(npc[1]!, npc[2] === 'show');
      return;
    }
    if (name === 'echoReveal') {
      this.ents.echoReveal();
      return;
    }
    if (name === 'gate:open') {
      for (const cells of this.ents.openGates()) this.juice.gateFx(cells);
      return;
    }
    if (name === 'goat:hide' || name === 'goat:show') {
      this.mount.hidden = name === 'goat:hide';
      return;
    }
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

  /** 过场里换音乐：音乐停下时只留风声；换回本关的曲子时，骑着就是骑乘版 */
  private playMusic(id: string | null): void {
    const mid = id && id === (this.level.music ?? 'beach') ? this.levelMusic() : id;
    audio.music.play(mid, mid ? 1.2 : 1.5);
    this.quiet = !mid;
    if (this.mode === 'play') audio.music.ambience(mid ? this.ambience() : 'wind');
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
    const talk = this.content.talk[id];
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
  /** 同一条提示可以再说一次（只有咩铃上得去的崖坎前，玩家一直在打转时） */
  private hintAgain(id: string): void {
    this.hintsShown.delete(id);
    this.hint(id);
  }

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
          // 二段跳只有骑着才有：徒步路过时先不说（回回改说"先救咩铃"），骑着来到崖坎前再补上
          if ((e.id === 'hint:double' || e.id === 'key:doubleJump') && !w.player.ride)
            this.wallHelp.doublePending = true;
          else if (e.id.startsWith('key:'))
            this.ui.keyHint.show(e.id.slice(4) as 'talk', this.scheme());
          else if (e.id.startsWith('hint:')) this.hint(e.id.slice(5));
          else if (e.id === 'echo13') this.echoGag();
          break;
        case 'enemyActivate':
          if (!w.flags.has('huihui')) break;
          // 刺海胆的提示等拿到海星以后再说（开场前隧道里那只就已经在画面边上了）
          if (e.kind === 'urchin' || e.kind === 'urchinHang') {
            if (w.equipment.length) this.hint('urchin');
          } else if (e.kind === 'gull') this.hint('gull');
          else if (this.content.crabHint) this.hint('crab');
          break;
        case 'urchinShake':
          this.hint('hang');
          break;
        // —— 坐骑咩铃 ——
        case 'mount':
          hud.setMount(true);
          this.syncRideMusic();
          this.petHint.rode = true;
          this.rideKeyWanted = false;
          this.ui.keyHint.done('ride');
          this.time.delayedCall(250, () => this.hint('ride'));
          break;
        case 'dismount':
          hud.setMount(false);
          this.syncRideMusic();
          this.ui.keyHint.done('dismount');
          break;
        case 'knockOff':
          hud.setMount(false);
          this.syncRideMusic();
          this.time.delayedCall(400, () => this.hint('knocked'));
          break;
        case 'goatFlee':
          this.ents.emote(() => this.mount.headPos, 'bang', 0.9);
          break;
        case 'chargeWindup':
          hud.setEquipOut(true);
          break;
        case 'dashEnd':
          this.time.delayedCall(200, () => hud.setEquipOut(false));
          break;
        case 'chargeBonk':
          this.time.delayedCall(320, () => hud.setEquipOut(false));
          break;
        case 'doubleJump':
          this.ui.keyHint.done('doubleJump');
          break;
        case 'rockBreak':
          this.ui.keyHint.done('charge');
          break;
        case 'pet':
          this.ui.keyHint.done('pet');
          this.ents.emote(() => this.mount.headPos, 'note', 1.2);
          this.time.delayedCall(500, () => this.hint('pet'));
          break;
        case 'crystalHit':
          this.ui.keyHint.done('stomp');
          break;
        case 'swallowWarn':
          this.ui.edgeWarn.show(e.from, e.ys, e.frames);
          this.hint('swallow');
          break;
        case 'coconutBreak':
          this.time.delayedCall(300, () => this.hint('coconut'));
          break;
        case 'throw':
          this.ui.hud.setEquipOut(true);
          this.ui.keyHint.done('throw');
          if (e.dirY < 0) this.ui.keyHint.done('throwUp');
          break;
        case 'starfishCatch':
          this.ui.hud.setEquipOut(false);
          this.ui.hud.equipCatch();
          if (e.carried) hud.setShells(w.stats.shells);
          break;
        case 'equipSwitch':
          this.ui.hud.equipWiggle();
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
          hud.setBlueHearts(w.blueHearts);
          if (e.spike) this.time.delayedCall(250, () => this.hint('spike'));
          break;
        case 'heal':
          hud.setHearts(e.hearts);
          break;
        case 'splash':
          // 掉海扣光了心：不先淡出，完整播放倒下演出（和被敌人打倒一样）
          if (e.big && !e.conch && w.state !== 'dying') {
            this.hint('water');
            this.time.delayedCall(260, () => this.cameras.main.fadeOut(160, ...FADE));
          }
          break;
        case 'fellOut':
          if (!e.conch && w.state !== 'dying') this.cameras.main.fadeOut(160, ...FADE);
          break;
        case 'conch':
          // 护身海螺：用掉了，从背包里拿走；大泡泡把小满（骑着的话连咩铃）托回去
          this.save.bag.conch = Math.max(0, this.save.bag.conch - 1);
          writeSave(this.save);
          hud.setConch(false);
          audio.play('conchBubble', { volume: 0.9 });
          this.conchBubble.start(
            e.x,
            e.y,
            e.toX,
            e.toY,
            RULES.conchRespawnFrames / 60,
            this.hero.frameName,
            w.player.ride ? 'goat/jump' : null,
            w.player.facing,
          );
          this.hint('conch');
          break;
        case 'sun':
          audio.music.play(e.on ? 'sun' : this.levelMusic(), e.on ? 0.3 : 0.9);
          break;
        case 'death':
          audio.music.jingle('death', 'interrupt');
          this.death = { t: 0, x: e.x, y: e.y, vy: -230, dy: 0 };
          this.gray?.setActive(true);
          break;
        case 'respawn':
          this.snapPrev();
          this.syncRideMusic();
          hud.setEquipOut(false);
          this.hero.resetRibbon(w.player.body.centerX, w.player.body.bottom);
          if (e.cause === 'conch') {
            // 泡泡到了：啵地破开，画面没有淡出过，不用淡入
            this.conchBubble.pop();
            audio.play('cloudPuff', { volume: 0.5, rate: 1.6 });
          } else if (e.cause !== 'death') {
            this.cameras.main.fadeIn(220, ...FADE);
            // 兜底：界面层的转场不该在这时还盖着画面
            if (this.ui.transition.covered && !this.ui.transition.busy)
              void this.ui.transition.reveal(0.3);
          } else {
            hud.setMount(!!w.player.ride);
            this.ui.edgeWarn.clear();
            // 清掉镜头上残留的淡出、闪光（否则会一直黑屏），再从小满的位置张开
            this.cameras.main.resetFX();
            this.time.delayedCall(30, () => {
              const cam = this.cameras.main;
              void this.ui.transition.run('iris', false, 0.4, {
                x: w.player.body.centerX - cam.scrollX,
                y: w.player.body.y - cam.scrollY,
              });
            });
            this.death = null;
            this.hero.override = null;
            this.gray?.setActive(false);
            hud.setHearts(w.hearts);
          }
          break;
        case 'checkpoint':
          audio.music.jingle('checkpoint', 'duck');
          this.ui.toast.show(UI_TEXT.checkpoint);
          {
            const cpHint = this.content.checkpointHints?.[e.index];
            if (cpHint) this.time.delayedCall(900, () => this.hint(cpHint));
          }
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
          this.hint(this.content.clearHint);
          break;
      }
    }
  }

  /** 回声崖的小玩笑：回回冲着山谷喊，回声从画面右边传回来，一声比一声远 */
  private echoGag(): void {
    for (const l of ECHO_GAG) {
      if (l.who === 'huihui')
        this.say(
          l.text,
          () =>
            this.ents.huihuiPos ?? {
              x: this.world.player.body.centerX,
              y: this.world.player.body.y - 4,
            },
        );
      else {
        // 回声：贴着画面右边
        this.say(l.text, () => {
          const cam = this.cameras.main;
          return { x: cam.scrollX + VIEW_W - 64, y: cam.scrollY + 60 };
        });
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
        title: this.content.tallyTitle,
        frames: w.stats.frames,
        bestFrames: prev,
        newRecord,
        shells: w.stats.shells,
        glass: w.stats.glass,
        ghost: this.save.levels[this.levelId]?.glass.map((g, i) => g && !w.stats.glass[i]) ?? [],
        noDamage,
      },
      [UI_TEXT.next, UI_TEXT.retry],
      (choice) => {
        if (choice === 1) {
          this.ui.closeAll();
          this.restartLevel();
          return;
        }
        // 继续：回到章节地图，播放通往下一关的路径解锁
        this.ui.closeAll();
        this.gotoMap();
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
    } else if (uiIn.pressed & BTN.start && this.clearT < 0 && !this.story && !this.leaving) {
      this.setPaused(true);
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
      // 倒下：以小满为中心的圆形收拢
      if (d.t > 0.8 && d.t - dt <= 0.8)
        void this.ui.transition.run('iris', true, 0.17, {
          x: hx - this.cameras.main.scrollX,
          y: hy - 8 - this.cameras.main.scrollY,
        });
    } else if (this.clearT >= 0) {
      this.clearT += dt;
      if (p.onGround)
        this.hero.override = Math.floor(this.clearT * 4) % 2 ? 'victory_1' : 'victory_0';
      if (this.clearT > 1.7 && this.clearT - dt <= 1.7) this.openTally();
    } else {
      // 骑着撞墙晕了：晕的是咩铃，小满还坐着
      this.hero.override = w.stun > 0 && !p.ride ? 'hurt' : null;
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
        ride: pup.mounted ? { airJumps: 1, windup: 0, dash: 0, dashDir: 1, cooldown: 0 } : null,
      } as unknown as Player;
      this.hero.update(dt, puppet, w.tuning, hx, hy, visible);
    } else this.hero.update(dt, p, w.tuning, hx, hy, visible);
    this.mount.update(
      dt,
      alpha,
      hx,
      hy,
      visible,
      pup ? { x: pup.x, y: pup.y, facing: pup.facing, mounted: pup.mounted, vx: pup.vx } : null,
    );
    this.ents.update(dt, alpha, cx);
    this.starfishView.update(dt, alpha);
    this.ui.edgeWarn.update(dt, cy, settings.reduceFlash);
    // 前景叶子：小满或敌人走到后面时变透明
    const fronts = [{ x: hx - b.w / 2, y: hy - b.h, w: b.w, h: b.h }];
    for (const e of w.enemies) if (e.alive && e.active) fronts.push(e.body);
    this.view.updateFronts(dt, fronts);
    this.particles.update(dt, false);
    this.conchBubble.update(dt);
    this.updateAmbience(dt);
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
