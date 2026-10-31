import Phaser from 'phaser';
import { audio } from '../audio/engine';
import { LEVELS } from '../content/levels';
import { CREDITS, MENU_TEXT } from '../content/text';
import { currentLayout, VIEW_H, VIEW_W, type Layout } from '../platform/display';
import { InputDevices } from '../platform/input';
import { emptySave, hasProgress, loadSave, writeSave, type SaveData } from '../platform/save';
import { parseLevel } from '../sim/level';
import { cloneTuning, PRESETS } from '../sim/tuning';
import { World } from '../sim/world';
import { Menu } from '../ui/menu';
import { panelTexture } from '../ui/panel';
import { ConfirmBox, InfoCard } from '../ui/panelModal';
import { SettingsPanel } from '../ui/settingsPanel';
import { GLYPH_TEX, glyphs } from '../ui/text/glyphs';
import { PixelText } from '../ui/text/pixelText';
import { EntityViews } from '../view/entities';
import { IslandBackground } from '../view/islandBackground';
import { LevelView } from '../view/levelView';
import { Particles } from '../view/particles';
import { ATLAS } from '../view/textures';
import { fitCamera } from './play/loop';
import type { UIScene } from './UIScene';

export interface TitleData {
  /** 刚打开页面：先放启动 Logo */
  boot?: boolean;
}

const LOGO_SCALE = 3;
const LOGO_Y = 36;

interface LogoChar {
  root: Phaser.GameObjects.Container;
  y0: number;
  vy: number;
  delay: number;
  landed: boolean;
}

/**
 * 标题画面：清晨的晨钟村在背后慢慢平移；《四时铃》三个字一个个落下、回弹、铃响；
 * 然后"按任意键开始"，再出现菜单：继续 / 新游戏 / 练习场 / 设置 / 制作人员。
 */
export class TitleScene extends Phaser.Scene {
  private ui!: UIScene;
  private devices!: InputDevices;
  private bg!: IslandBackground;
  private view!: LevelView;
  private ents!: EntityViews;
  private save!: SaveData;
  private stage: 'boot' | 'logo' | 'press' | 'menu' | 'leaving' = 'logo';
  private elapsed = 0;
  private camX = 60;
  private camDir = 1;
  private maxCamY = 0;
  private maxCamX = 0;
  private chars: LogoChar[] = [];
  private bell!: Phaser.GameObjects.Image;
  private sub!: PixelText;
  private press!: PixelText;
  private menu: Menu | null = null;
  private menuPanel: Phaser.GameObjects.Image | null = null;
  private bootObjs: Phaser.GameObjects.GameObject[] = [];
  private bootT = 0;
  private logoT = 0;
  /** 这一帧按过键盘上的任意键 */
  private anyKey = false;

  constructor() {
    super('title');
  }

  create(data: TitleData): void {
    this.ui = this.scene.get('ui') as UIScene;
    this.ui.setLevelUI(false);
    this.save = loadSave();
    this.elapsed = 0;
    this.chars = [];
    this.menu = null;
    this.menuPanel = null;
    // 背景：第 1 关的村庄（世界不运行，只拿来画 NPC 和风铃）
    const level = parseLevel(LEVELS['1-1']!);
    const world = new World(
      level,
      cloneTuning(PRESETS.A.tuning),
      { autoRun: false },
      VIEW_W,
      VIEW_H,
    );
    world.teleport(-200, 0);
    this.bg = new IslandBackground(this, level);
    this.view = new LevelView(this, level);
    this.ents = new EntityViews(this, world, new Particles(this));
    this.maxCamY = Math.max(0, level.grid.heightPx - VIEW_H);
    this.maxCamX = 78 * 16 - VIEW_W;
    this.applyLayout(currentLayout());
    this.game.events.on('layout', this.applyLayout, this);
    this.devices = new InputDevices();
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('pointerdown', this.onPointer);
    this.events.once('shutdown', () => {
      this.game.events.off('layout', this.applyLayout, this);
      window.removeEventListener('keydown', this.onKey);
      window.removeEventListener('pointerdown', this.onPointer);
      this.devices.destroy();
      this.menu?.destroy();
      for (const o of this.bootObjs) o.destroy();
      this.ui.closeAll();
    });
    this.buildLogo();
    audio.music.play('title', 1.2);
    audio.music.ambience('sea');
    audio.music.prefetch('beach', 'night');
    if (data.boot && !this.ui.transition.covered) this.startBoot();
    else {
      this.stage = 'logo';
      void this.ui.transition.reveal(0.7);
    }
    (window as unknown as { __title: unknown }).__title = this;
  }

  private applyLayout(L: Layout): void {
    fitCamera(this.cameras.main, L);
  }

  private onPointer = (): void => this.unlock();

  private unlock(): void {
    window.focus();
    if (!audio.unlocked) {
      audio.unlock();
      audio.warmUp();
    }
  }

  /** 键盘上任何键都算"按任意键"（在 update 里统一处理，不会一次按键算两次） */
  private onKey = (e: KeyboardEvent): void => {
    this.unlock();
    if (!e.repeat) this.anyKey = true;
  };

  // —— 启动 Logo ——

  private startBoot(): void {
    this.stage = 'boot';
    this.bootT = 0;
    this.ui.setCover(1);
    const u = this.ui;
    const bell = u.add
      .image(VIEW_W / 2, VIEW_H / 2 - 14, ATLAS, 'ui/cursor')
      .setScale(4)
      .setDepth(29)
      .setAlpha(0);
    const t = new PixelText(u, 0, 0, 'PIXEL ISLE', { color: 'cream' });
    t.setPosition(Math.round((VIEW_W - t.width) / 2), VIEW_H / 2 + 6).setDepth(29);
    t.root.setAlpha(0);
    this.bootObjs = [bell, t.root];
    u.tweens.add({ targets: [bell, t.root], alpha: 1, duration: 400 });
    u.tweens.add({
      targets: bell,
      angle: { from: -14, to: 14 },
      duration: 380,
      yoyo: true,
      repeat: 2,
    });
    this.elapsed = 0;
  }

  private endBoot(): void {
    if (this.stage !== 'boot') return;
    this.stage = 'logo';
    const u = this.ui;
    u.tweens.add({
      targets: this.bootObjs,
      alpha: 0,
      duration: 250,
      onComplete: () => {
        for (const o of this.bootObjs) o.destroy();
        this.bootObjs = [];
      },
    });
    const c = { a: 1 };
    u.tweens.add({ targets: c, a: 0, duration: 600, onUpdate: () => u.setCover(c.a) });
    this.logoT = 0;
  }

  // —— 标题字 ——

  private buildLogo(): void {
    const word = MENU_TEXT.gameTitle;
    const adv = glyphs.advance('四') * LOGO_SCALE + 6;
    const total = adv * word.length - 6;
    const x0 = Math.round((VIEW_W - total) / 2);
    [...word].forEach((ch, i) => {
      const frame = glyphs.frame(ch);
      const root = this.add
        .container(x0 + i * adv, -60)
        .setScale(LOGO_SCALE)
        .setDepth(50);
      root.setScrollFactor(0);
      // 描边（8 个方向各一份深色）、投影、金色字身、上半截的奶油色高光
      for (const [dx, dy] of [
        [-1, -1],
        [0, -1],
        [1, -1],
        [-1, 0],
        [1, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
        [1, 2],
        [0, 2],
      ] as const)
        root.add(
          this.add
            .image(dx, dy, GLYPH_TEX, frame)
            .setOrigin(0, 0)
            .setTint(dy === 2 ? 0x7d2347 : 0x1a1c2c),
        );
      root.add(this.add.image(0, 0, GLYPH_TEX, frame).setOrigin(0, 0).setTint(0xffc93c));
      const hi = this.add.image(0, 0, GLYPH_TEX, frame).setOrigin(0, 0).setTint(0xfff4d6);
      hi.setCrop(0, 0, 16, 5);
      root.add(hi);
      this.chars.push({ root, y0: LOGO_Y, vy: 0, delay: 0.25 + i * 0.22, landed: false });
    });
    this.bell = this.add
      .image(x0 + total + 14, LOGO_Y + 6, ATLAS, 'npc/bell_summer')
      .setOrigin(0.5, 0)
      .setScale(2)
      .setDepth(50)
      .setScrollFactor(0)
      .setAlpha(0);
    this.sub = new PixelText(this, 0, 0, MENU_TEXT.subtitle, { color: 'night', shadow: 'cream' });
    this.sub.setPosition(Math.round((VIEW_W - this.sub.width) / 2), LOGO_Y + 44).setDepth(50);
    this.sub.root.setScrollFactor(0).setAlpha(0);
    this.press = new PixelText(this, 0, 0, MENU_TEXT.pressAny, { color: 'cream', shadow: 'ink' });
    this.press.setPosition(Math.round((VIEW_W - this.press.width) / 2), VIEW_H - 44).setDepth(50);
    this.press.root.setScrollFactor(0).setAlpha(0);
  }

  /** 跳过标题字的入场动画 */
  private finishLogo(): void {
    for (const c of this.chars) {
      c.delay = 0;
      c.landed = true;
      c.root.y = c.y0;
    }
    this.logoT = 99;
  }

  private updateLogo(dt: number): void {
    this.logoT += dt;
    let all = true;
    this.chars.forEach((c, i) => {
      if (this.logoT < c.delay) {
        all = false;
        return;
      }
      if (!c.landed) {
        all = false;
        c.vy += 1400 * dt;
        c.root.y += c.vy * dt;
        if (c.root.y >= c.y0) {
          c.root.y = c.y0;
          if (c.vy > 120) {
            c.vy *= -0.38;
            if (c.vy < -100) audio.play('bell', { volume: 0.6, rate: 0.9 + i * 0.12 });
          } else {
            c.vy = 0;
            c.landed = true;
          }
        }
      }
    });
    if (all && this.stage === 'logo') {
      this.stage = 'press';
      this.tweens.add({ targets: [this.bell, this.sub.root], alpha: 1, duration: 500 });
    }
  }

  // —— 菜单 ——

  private openMenu(): void {
    if (this.stage !== 'press') return;
    this.stage = 'menu';
    this.ui.menuSfx('confirm');
    this.press.setVisible(false);
    this.buildMenu();
  }

  private buildMenu(): void {
    this.menu?.destroy();
    this.menuPanel?.destroy();
    const progress = hasProgress(this.save);
    const items = [
      { label: MENU_TEXT.continue, hidden: !progress, select: () => this.continueGame() },
      { label: MENU_TEXT.newGame, select: () => this.newGame() },
      { label: MENU_TEXT.gym, select: () => this.leave('gym') },
      {
        label: MENU_TEXT.settings,
        select: () =>
          this.ui.openModal(
            new SettingsPanel(this.ui.host, {
              open: (m) => this.ui.openModal(m),
              cleared: () => {
                this.save = emptySave();
                this.buildMenu();
              },
              toast: (t) => this.ui.toast.show(t),
            }),
          ),
      },
      {
        label: MENU_TEXT.credits,
        select: () =>
          this.ui.openModal(
            new InfoCard(this.ui.host, MENU_TEXT.credits, [
              ...CREDITS.map(([r, n]) => `${r}：${n}`),
              '',
              MENU_TEXT.thanks,
            ]),
          ),
      },
    ];
    const rows = items.filter((i) => !i.hidden).length;
    const w = 112;
    const h = rows * 16 + 10;
    const x = Math.round((VIEW_W - w) / 2);
    const y = VIEW_H - h - 18;
    this.menuPanel = this.add
      .image(x, y, panelTexture(this, w, h))
      .setOrigin(0, 0)
      .setDepth(50)
      .setScrollFactor(0)
      .setAlpha(0);
    this.tweens.add({ targets: this.menuPanel, alpha: 1, duration: 200 });
    this.menu = new Menu(this, x + 14, y + 6, items, { rowH: 16, sfx: (s) => this.ui.menuSfx(s) });
    this.menu.root.setDepth(51).setScrollFactor(0);
  }

  private continueGame(): void {
    this.leave('level', { levelId: '1-1', intro: !this.save.flags.includes('introSeen') });
  }

  private newGame(): void {
    const start = () => {
      this.save = emptySave();
      writeSave(this.save);
      this.leave('level', { levelId: '1-1', mode: 'prologue' });
    };
    if (hasProgress(this.save))
      this.ui.openModal(new ConfirmBox(this.ui.host, MENU_TEXT.newGameConfirm, start));
    else start();
  }

  private leave(key: string, data?: object): void {
    if (this.stage === 'leaving') return;
    this.stage = 'leaving';
    if (this.menu) this.menu.enabled = false;
    void this.ui.transition.run('bell', true, 0.7).then(() => this.scene.start(key, data));
  }

  // —— 每帧 ——

  override update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 100) / 1000;
    this.elapsed += dt;
    const uiIn = this.devices.sampleUI();
    if (uiIn.pressed) this.unlock();
    const any = this.anyKey || uiIn.pressed !== 0;
    this.anyKey = false;
    if (this.ui.modal) this.ui.modal.input(uiIn.pressed, uiIn.held);
    else if (this.stage === 'menu') {
      this.menu?.input(uiIn.pressed);
    } else if (any) {
      if (this.stage === 'boot') this.endBoot();
      else if (this.stage === 'logo') this.finishLogo();
      else if (this.stage === 'press') this.openMenu();
    }
    if (this.stage === 'boot') {
      this.bootT += dt;
      if (this.bootT > 1.8) this.endBoot();
    } else this.updateLogo(dt);
    // 背景慢慢来回平移
    this.camX += this.camDir * 9 * dt;
    if (this.camX > this.maxCamX) this.camDir = -1;
    if (this.camX < 0) this.camDir = 1;
    const cam = this.cameras.main;
    cam.setScroll(this.camX, this.maxCamY);
    this.bg.update(dt, cam.scrollX, cam.scrollY);
    this.view.update(dt);
    this.ents.update(dt, 1, cam.scrollX);
    // 小铃铛摆动、"按任意键开始"闪烁
    this.bell.setRotation(Math.sin(this.elapsed * 2.4) * 0.25);
    if (this.stage === 'press')
      this.press.root.setAlpha(0.55 + 0.45 * Math.abs(Math.sin(this.elapsed * 2.2)));
    this.sub.update(dt);
    this.press.update(dt);
    this.menu?.update(dt);
  }
}
