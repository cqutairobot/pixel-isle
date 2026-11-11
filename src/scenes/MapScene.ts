import Phaser from 'phaser';
import { mapBackground, MAP_H, MAP_W } from '../art/mapArt';
import { audio } from '../audio/engine';
import { MAP_CHATTER } from '../content/dialog/1-2';
import type { Line } from '../content/dialog/line';
import {
  mapNode,
  MAP_NODES,
  MAP_PATHS,
  MAP_SHOP,
  nodeState,
  pathsToReveal,
  SHOP_NODE,
  SHOP_PATH,
  shopOpen,
  stepNode,
  type NodeState,
} from '../content/map';
import { outfitOf } from '../content/outfits';
import { MAP_TEXT, MENU_TEXT } from '../content/text';
import { currentLayout, VIEW_H, VIEW_W, type Layout } from '../platform/display';
import { InputDevices } from '../platform/input';
import { emptySave, loadSave, remember, setFlag, writeSave, type SaveData } from '../platform/save';
import { BTN } from '../sim/input';
import { LevelCard } from '../ui/levelCard';
import { MapMenu } from '../ui/pauseMenu';
import { panelTexture } from '../ui/panel';
import { SettingsPanel } from '../ui/settingsPanel';
import { ShopScreen } from '../ui/shop';
import { PixelText } from '../ui/text/pixelText';
import { addImageTexture, ATLAS } from '../view/textures';
import { fitCamera } from './play/loop';
import type { UIScene } from './UIScene';

/** 小满站在节点旁边（铃铛的左边或右边），脚底比节点低一点 */
const STAND_DX = 9;
const STAND_DY = 4;
/** 每跳一个小圆点用的时间（秒） */
const HOP = 0.11;
/** 小满在冰沙摊前站的位置（脚底），小大暑站在冰沙车右边 */
const SHOP_STAND = { x: MAP_SHOP.x - 13, y: MAP_SHOP.y + 3 };
const SHOP_KEEPER = { x: MAP_SHOP.x + 14, y: MAP_SHOP.y + 3 };

interface Hop {
  pts: Array<[number, number]>;
  i: number;
  t: number;
  to: string;
  dir: 1 | -1;
}

/**
 * 章节地图（docs/levels/1-2.md §5）：时令岛南岸的插画，每关一个铃铛。
 * ← → 沿着路跳到相邻的节点，确认打开关卡卡片，再确认进关；Esc 打开地图菜单。
 * 刚通关回来时，通往下一关的小圆点一个一个"啵"地出现，下一关的铃铛亮起来。
 */
export class MapScene extends Phaser.Scene {
  private ui!: UIScene;
  private devices!: InputDevices;
  private save!: SaveData;
  private at = '1-1';
  private side: 1 | -1 = -1;
  private hero!: Phaser.GameObjects.Image;
  private hui!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private hx = 0;
  private hy = 0;
  private bells = new Map<string, Phaser.GameObjects.Image>();
  private dots = new Map<string, Phaser.GameObjects.Image[]>();
  private label!: PixelText;
  private labelBg!: Phaser.GameObjects.Image;
  private texts: PixelText[] = [];
  private sparkles: Array<{ img: Phaser.GameObjects.Image; t: number; x: number; y: number }> = [];
  private hop: Hop | null = null;
  /** 正在播放路径解锁动画（期间不能操作） */
  private revealing = false;
  /** 有路径要解锁、动画还没开始（地图刚打开的那一小会儿）：同样不能操作，免得在路亮出来之前就跳过去 */
  private revealQueued = false;
  private leaving = false;
  private time0 = 0;
  private chatter: Array<{ line: Line; t: number }> = [];
  private hint!: PixelText;
  private shopTag!: PixelText;
  private keeper!: Phaser.GameObjects.Image;

  constructor() {
    super('map');
  }

  create(): void {
    this.ui = this.scene.get('ui') as UIScene;
    this.ui.setLevelUI(false);
    this.save = loadSave();
    this.leaving = false;
    this.revealing = false;
    this.revealQueued = false;
    this.hop = null;
    this.time0 = 0;
    this.chatter = [];
    this.bells = new Map();
    this.dots = new Map();
    this.texts = [];
    this.sparkles = [];
    if (!this.textures.exists('map-bg')) addImageTexture(this, 'map-bg', mapBackground());
    this.add.image(0, 0, 'map-bg').setOrigin(0, 0).setDepth(-10);
    this.buildSea();
    // 路：已经通了的小圆点直接显示；刚通的先藏起来，等解锁动画
    const reveal = pathsToReveal(this.save);
    for (const p of MAP_PATHS) {
      const shown = nodeState(this.save, p.to) !== 'locked' && !reveal.includes(p.to);
      this.dots.set(
        p.to,
        p.dots.map(([x, y]) =>
          this.add.image(x, y, ATLAS, 'map/dot').setDepth(1).setVisible(shown),
        ),
      );
    }
    for (const n of MAP_NODES) {
      const st = reveal.includes(n.id) ? 'locked' : nodeState(this.save, n.id);
      this.bells.set(
        n.id,
        this.add
          .image(n.x, n.y + STAND_DY, ATLAS, `map/bell_${st}`)
          .setOrigin(0.5, 1)
          .setDepth(2),
      );
    }
    this.add
      .image(MAP_SHOP.x, MAP_SHOP.y + 3, ATLAS, 'map/shop')
      .setOrigin(0.5, 1)
      .setDepth(2);
    // 冰沙摊：1-2 通关后开张（第一次开张的动画在解锁动画之后播）；开张了，大暑站在车旁边
    const opened = shopOpen(this.save) && this.save.map.opened.includes(SHOP_NODE);
    this.shopTag = new PixelText(this, 0, 0, '', { color: 'cream', shadow: 'ink' });
    this.shopTag.root.setDepth(3);
    this.texts.push(this.shopTag);
    this.setShopTag(opened);
    this.keeper = this.add
      .image(SHOP_KEEPER.x, SHOP_KEEPER.y, ATLAS, 'shop/daishu_0')
      .setOrigin(0.5, 1)
      .setDepth(2.5)
      .setVisible(opened);
    // 冰沙摊的小路（开张以后显示）
    this.dots.set(
      SHOP_NODE,
      SHOP_PATH.map(([x, y]) =>
        this.add.image(x, y, ATLAS, 'map/dot').setDepth(1).setVisible(opened),
      ),
    );
    // 小满站在上次站的节点旁边（那个节点去不了的话回到第一关）；上次在冰沙摊就站在摊子前
    if (this.save.map.node === SHOP_NODE && opened) {
      this.at = SHOP_NODE;
      this.hx = SHOP_STAND.x;
      this.hy = SHOP_STAND.y;
      this.side = 1;
    } else {
      const start = mapNode(this.save.map.node);
      this.at = start && nodeState(this.save, start.id) !== 'locked' ? start.id : '1-1';
      const n = mapNode(this.at)!;
      this.hx = n.x - STAND_DX;
      this.hy = n.y + STAND_DY;
    }
    this.hero = this.add
      .image(this.hx, this.hy, ATLAS, this.heroFrame('idle_0'))
      .setOrigin(0.5, 1)
      .setDepth(5);
    this.glow = this.add.image(0, 0, ATLAS, 'npc/glow').setDepth(5.5).setBlendMode(1).setAlpha(0.3);
    this.hui = this.add.image(this.hx - 14, this.hy - 26, ATLAS, 'npc/huihui_idle_0').setDepth(6);
    // 标题、当前节点的名字、操作提示
    const title = new PixelText(this, 0, 0, MAP_TEXT.title, { color: 'cream', shadow: 'ink' });
    const tag = this.add
      .image(4, 4, panelTexture(this, title.width + 14, 17, 'night'))
      .setOrigin(0, 0)
      .setDepth(8);
    title.setPosition(11, 7);
    title.root.setDepth(9);
    this.hint = new PixelText(this, 0, 0, MAP_TEXT.hint, { color: 'cream', shadow: 'ink' });
    this.hint.root.setDepth(9).setAlpha(0.85);
    this.updateHint();
    this.texts.push(title, this.hint);
    void tag;
    this.labelBg = this.add.image(0, 0, panelTexture(this, 10, 15, 'night')).setDepth(8);
    this.label = new PixelText(this, 0, 0, '', { color: 'cream' });
    this.label.root.setDepth(9);
    this.texts.push(this.label);
    this.updateLabel();

    this.applyLayout(currentLayout());
    this.game.events.on('layout', this.applyLayout, this);
    this.devices = new InputDevices();
    window.addEventListener('pointerdown', this.unlockAudio);
    window.addEventListener('keydown', this.unlockAudio);
    this.events.once('shutdown', () => {
      this.game.events.off('layout', this.applyLayout, this);
      window.removeEventListener('pointerdown', this.unlockAudio);
      window.removeEventListener('keydown', this.unlockAudio);
      this.devices.destroy();
      for (const t of this.texts) t.destroy();
      this.ui.closeAll();
      this.ui.bubble.hide();
    });
    audio.music.play('map', 1.2);
    audio.music.ambience('sea');
    // 冰沙摊开张以后，先把商店曲渲染好
    if (shopOpen(this.save)) audio.music.prefetch('shop');
    if (this.ui.transition.covered) void this.ui.transition.reveal(0.7);
    else this.cameras.main.fadeIn(400, 26, 28, 44);
    if (reveal.length) {
      this.revealQueued = true;
      this.time.delayedCall(700, () => void this.revealPaths(reveal));
    } else this.afterReveal();
    (window as unknown as { __map: unknown }).__map = this;
  }

  private applyLayout(L: Layout): void {
    fitCamera(this.cameras.main, L);
    this.cameras.main.setScroll(0, 0);
  }

  private unlockAudio = (): void => {
    window.focus();
    if (!audio.unlocked) {
      audio.unlock();
      audio.warmUp();
    }
  };

  /** 海面上零星的波光，一闪一闪 */
  private buildSea(): void {
    for (let i = 0; i < 14; i++) {
      const x = 20 + ((i * 97) % 340);
      const y = 180 + ((i * 37) % 30);
      const img = this.add.image(x, y, ATLAS, 'fx2/sparkle_0').setDepth(0).setAlpha(0);
      this.sparkles.push({ img, t: i * 0.37, x, y });
    }
  }

  /** 当前节点的名字（铃铛上方的小牌子） */
  private updateLabel(): void {
    const n =
      this.at === SHOP_NODE
        ? { id: '', name: MAP_TEXT.shop, x: MAP_SHOP.x, y: MAP_SHOP.y + 10 }
        : mapNode(this.at)!;
    const text = n.id ? `${n.id} ${n.name}` : n.name;
    this.label.setText(text);
    const w = this.label.width + 10;
    if (this.labelBg.width !== w) {
      this.labelBg.setTexture(panelTexture(this, w, 15, 'night'));
    }
    const x = Math.min(VIEW_W - w / 2 - 4, Math.max(w / 2 + 4, n.x));
    // 在回回头顶上方，不挡住小满和回回
    const y = n.y - 44;
    this.labelBg.setPosition(Math.round(x), y);
    this.label.setPosition(Math.round(x - this.label.width / 2), y - 5);
  }

  /** 路径解锁：小圆点一个一个"啵"地出现，音一个比一个高；最后终点的铃铛亮起来 */
  private async revealPaths(ids: string[]): Promise<void> {
    this.revealing = true;
    this.revealQueued = false;
    for (const to of ids) {
      const dots = this.dots.get(to) ?? [];
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i]!;
        d.setVisible(true).setScale(0);
        this.tweens.add({ targets: d, scale: 1, duration: 180, ease: 'Back.Out' });
        audio.play('mapDot', { rate: Math.pow(2, Math.min(i, 12) / 12), volume: 0.8 });
        await this.delay(110);
      }
      const bell = this.bells.get(to)!;
      const st: NodeState = nodeState(this.save, to);
      bell.setFrame(`map/bell_${st}`).setScale(0.2);
      this.tweens.add({ targets: bell, scale: 1, duration: 320, ease: 'Back.Out' });
      audio.music.jingle('unlock', 'duck');
      this.burst(bell.x, bell.y - 10);
      remember(this.save.map.opened, to);
      writeSave(this.save);
      await this.delay(500);
    }
    this.revealing = false;
    this.afterReveal();
  }

  /** 解锁动画放完以后：1-2 通关后第一次回到地图，回回会说一句 */
  private afterReveal(): void {
    if (this.save.levels['1-2']?.cleared) this.chat('after12');
    if (this.save.levels['1-3']?.cleared) this.chat('after13');
    // 冰沙摊第一次开张："即将开张"翻成"营业中"，大暑蹦出来挥手
    if (shopOpen(this.save) && !this.save.map.opened.includes(SHOP_NODE)) {
      this.revealing = true;
      this.time.delayedCall(400, () => void this.openShopSign());
    }
  }

  /** 冰沙摊开张：牌子翻过来，小路一个个点亮，大暑蹦出来挥手，喊一句"开张啦" */
  private async openShopSign(): Promise<void> {
    this.tweens.add({
      targets: this.shopTag.root,
      scaleY: 0,
      duration: 160,
      yoyo: true,
      onYoyo: () => this.setShopTag(true),
    });
    audio.play('shopEnter', { volume: 0.7 });
    await this.delay(320);
    const dots = this.dots.get(SHOP_NODE) ?? [];
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i]!;
      d.setVisible(true).setScale(0);
      this.tweens.add({ targets: d, scale: 1, duration: 180, ease: 'Back.Out' });
      audio.play('mapDot', { rate: Math.pow(2, i / 12), volume: 0.7 });
      await this.delay(100);
    }
    this.keeper.setVisible(true).setScale(0.2);
    this.tweens.add({ targets: this.keeper, scale: 1, duration: 320, ease: 'Back.Out' });
    this.burst(SHOP_KEEPER.x, SHOP_KEEPER.y - 8);
    remember(this.save.map.opened, SHOP_NODE);
    writeSave(this.save);
    await this.delay(400);
    this.revealing = false;
    this.chat('shopOpen');
    this.updateHint();
  }

  /** 冰沙摊的牌子："即将开张" / "营业中" */
  private setShopTag(open: boolean): void {
    this.shopTag.setText(open ? MAP_TEXT.shopOpen : MAP_TEXT.shopSoon);
    this.shopTag.setColor(open ? 'gold' : 'cream');
    this.shopTag.setPosition(MAP_SHOP.x - Math.round(this.shopTag.width / 2), MAP_SHOP.y + 4);
  }

  /** 底部的操作提示：站在回声崖、冰沙摊开张了时多一条"↓ 冰沙摊"；在冰沙摊前是"↑ 回去" */
  private updateHint(): void {
    const opened = shopOpen(this.save) && this.save.map.opened.includes(SHOP_NODE);
    const text =
      this.at === SHOP_NODE
        ? MAP_TEXT.hintAtShop
        : this.at === '1-3' && opened
          ? MAP_TEXT.hintShop
          : MAP_TEXT.hint;
    this.hint.setText(text);
    this.hint.setPosition(Math.round((VIEW_W - this.hint.width) / 2), VIEW_H - 14);
  }

  /** 小满现在穿的衣服对应的帧名 */
  private heroFrame(name: string): string {
    return `${outfitOf(this.save.outfit).sheet}/${name}`;
  }

  /** 沿小路在「回声崖」和冰沙摊之间跳 */
  private hopShop(toShop: boolean): void {
    const n = mapNode('1-3')!;
    const path = SHOP_PATH.map(([x, y]) => [x, y + 3] as [number, number]);
    const pts: Array<[number, number]> = toShop
      ? [[this.hx, this.hy], ...path, [SHOP_STAND.x, SHOP_STAND.y]]
      : [[this.hx, this.hy], ...path.reverse(), [n.x + STAND_DX, n.y + STAND_DY]];
    this.hop = { pts, i: 0, t: 0, to: toShop ? SHOP_NODE : '1-3', dir: toShop ? 1 : -1 };
    this.side = toShop ? -1 : 1;
    this.hero.setFlipX(!toShop);
    this.ui.bubble.hide();
  }

  /** 进冰沙摊 */
  private openShop(): void {
    const first = !this.save.flags.includes('shopVisited');
    setFlag(this.save, 'shopVisited');
    writeSave(this.save);
    this.devices.releaseAll();
    // 进店换成商店曲，出来接着放地图曲（从刚才的位置）
    audio.music.play('shop', 0.6);
    this.ui.openModal(
      new ShopScreen(this.ui.host, {
        save: this.save,
        persist: () => writeSave(this.save),
        first,
        onClose: () => {
          audio.music.play('map', 0.8);
          this.hero.setFrame(this.heroFrame('idle_0'));
        },
      }),
    );
  }

  /** 地图菜单的"换装"：只开换装那一页 */
  private openOutfits(): void {
    this.ui.openModal(
      new ShopScreen(this.ui.host, {
        save: this.save,
        persist: () => writeSave(this.save),
        outfitOnly: true,
        onClose: () => this.hero.setFrame(this.heroFrame('idle_0')),
      }),
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((res) => this.time.delayedCall(ms, res));
  }

  private burst(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const img = this.add.image(x, y, ATLAS, 'fx2/sparkle_2').setDepth(7);
      this.tweens.add({
        targets: img,
        x: x + Math.cos(a) * 18,
        y: y + Math.sin(a) * 12,
        alpha: 0,
        duration: 500,
        onComplete: () => img.destroy(),
      });
    }
  }

  /** 地图闲聊（每段只出现一次） */
  private chat(id: string): void {
    if (this.save.map.chatter.includes(id) || !MAP_CHATTER[id]) return;
    remember(this.save.map.chatter, id);
    writeSave(this.save);
    for (const line of MAP_CHATTER[id]!) this.chatter.push({ line, t: 0 });
  }

  /** 沿路跳到相邻的节点 */
  private move(dir: 1 | -1): void {
    const to = this.at === SHOP_NODE ? null : stepNode(this.save, this.at, dir);
    if (!to) {
      // 路还没通：原地小跳一下
      audio.play('bonk', { volume: 0.3, rate: 1.3 });
      this.tweens.add({ targets: this.hero, y: this.hy - 3, duration: 80, yoyo: true });
      return;
    }
    const path = MAP_PATHS.find((p) => (dir > 0 ? p.from === this.at : p.to === this.at))!;
    const dots = dir > 0 ? path.dots : [...path.dots].reverse();
    const dest = mapNode(to)!;
    const end: [number, number] = [dest.x - dir * STAND_DX, dest.y + STAND_DY];
    this.hop = {
      pts: [[this.hx, this.hy], ...dots.map(([x, y]) => [x, y + 3] as [number, number]), end],
      i: 0,
      t: 0,
      to,
      dir,
    };
    this.side = dir > 0 ? -1 : 1;
    this.hero.setFlipX(dir < 0);
    if (this.at === '1-1' && to === '1-2') this.chat('to12');
    if (this.at === '1-2' && to === '1-3') this.chat('to13');
    this.ui.bubble.hide();
  }

  private updateHop(dt: number): void {
    const h = this.hop!;
    h.t += dt;
    while (h.t >= HOP && h.i < h.pts.length - 1) {
      h.t -= HOP;
      h.i++;
      if (h.i < h.pts.length - 1)
        audio.play('mapHop', { volume: 0.45, rate: 0.95 + Math.random() * 0.1 });
    }
    if (h.i >= h.pts.length - 1) {
      const [x, y] = h.pts[h.pts.length - 1]!;
      this.hx = x;
      this.hy = y;
      this.at = h.to;
      this.hop = null;
      this.save.map.node = this.at;
      writeSave(this.save);
      this.hero.setFrame(this.heroFrame('land'));
      this.time.delayedCall(90, () => this.hero.setFrame(this.heroFrame('idle_0')));
      this.updateLabel();
      this.updateHint();
      return;
    }
    const [x0, y0] = h.pts[h.i]!;
    const [x1, y1] = h.pts[h.i + 1]!;
    const k = h.t / HOP;
    this.hx = x0 + (x1 - x0) * k;
    this.hy = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 4;
    this.hero.setFrame(this.heroFrame(k < 0.5 ? 'jump' : 'fall_0'));
  }

  /** 打开关卡卡片：可进的关确认后进关，还在做的关写"正在制作中" */
  private openCard(): void {
    const n = mapNode(this.at)!;
    const st = nodeState(this.save, n.id);
    audio.play('mapCard', { volume: 0.7 });
    this.ui.openModal(
      new LevelCard(
        this.ui.host,
        `${n.id} ${n.name}`,
        this.save.levels[n.id] ?? null,
        st === 'soon',
        () => this.enter(n.id),
        this.save.bag,
      ),
    );
  }

  private enter(id: string): void {
    if (this.leaving) return;
    this.leaving = true;
    this.save.map.node = id;
    writeSave(this.save);
    const intro = id === '1-1' ? !this.save.flags.includes('introSeen') : true;
    void this.ui.transition
      .run('bell', true, 0.7)
      .then(() => this.scene.start('level', { levelId: id, intro }));
  }

  private openMenu(): void {
    this.devices.releaseAll();
    this.ui.openModal(
      new MapMenu(this.ui.host, {
        resume: () => {},
        settings: () =>
          this.ui.openModal(
            new SettingsPanel(this.ui.host, {
              open: (m) => this.ui.openModal(m),
              changed: () => {},
              cleared: () => {
                this.save = emptySave();
                this.toTitle();
              },
              toast: (t) => this.ui.toast.show(t),
            }),
          ),
        toTitle: () => this.toTitle(),
        outfits:
          shopOpen(this.save) && this.save.map.opened.includes(SHOP_NODE)
            ? () => this.openOutfits()
            : undefined,
      }),
    );
  }

  private toTitle(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.ui.closeAll();
    void this.ui.transition.run('bell', true, 0.7).then(() => this.scene.start('title'));
  }

  override update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 100) / 1000;
    this.time0 += dt;
    const uiIn = this.devices.sampleUI();
    if (this.ui.modal) this.ui.modal.input(uiIn.pressed, uiIn.held);
    else if (!this.leaving && !this.revealing && !this.revealQueued && !this.hop) {
      const shopReady = shopOpen(this.save) && this.save.map.opened.includes(SHOP_NODE);
      if (this.at === '1-3' && shopReady && uiIn.pressed & BTN.down) this.hopShop(true);
      else if (this.at === SHOP_NODE && uiIn.pressed & BTN.up) this.hopShop(false);
      else if (uiIn.pressed & BTN.right) this.move(1);
      else if (uiIn.pressed & BTN.left) this.move(-1);
      else if (uiIn.pressed & (BTN.jump | BTN.confirm)) {
        if (this.at === SHOP_NODE) this.openShop();
        else this.openCard();
      } else if (uiIn.pressed & (BTN.start | BTN.cancel)) {
        void MENU_TEXT;
        this.openMenu();
      }
    }
    if (this.hop) this.updateHop(dt);
    else if (!this.ui.modal) {
      // 站着时轻轻呼吸，朝向路的那一边
      this.hero.setFrame(this.heroFrame(Math.floor(this.time0 * 1.6) % 2 ? 'idle_1' : 'idle_0'));
      this.hero.setFlipX(this.side > 0);
    }
    this.hero.setPosition(Math.round(this.hx), Math.round(this.hy));
    // 回回飘在小满身后上方
    const face = this.hero.flipX ? -1 : 1;
    const tx = this.hx - face * 13;
    const ty = this.hy - 26 + Math.sin(this.time0 * 2.6) * 2;
    const k = 1 - Math.exp(-dt * 6);
    const hx = this.hui.x + (tx - this.hui.x) * k;
    const hy = this.hui.y + (ty - this.hui.y) * k;
    this.hui
      .setPosition(hx, hy)
      .setFlipX(face < 0)
      .setFrame(Math.floor(this.time0 * 2) % 2 ? 'npc/huihui_idle_1' : 'npc/huihui_idle_0');
    this.glow
      .setPosition(Math.round(hx), Math.round(hy))
      .setAlpha(0.26 + Math.sin(this.time0 * 3) * 0.08);
    // 可进的铃铛轻轻摆动，提示可以去
    for (const [id, img] of this.bells) {
      const st = nodeState(this.save, id);
      img.setRotation(
        st === 'open' && img.scale >= 1 ? Math.sin(this.time0 * 3 + img.x) * 0.12 : 0,
      );
    }
    // 海面波光
    for (const s of this.sparkles) {
      s.t += dt;
      const ph = (s.t % 2.6) / 2.6;
      s.img
        .setAlpha(ph < 0.3 ? Math.sin((ph / 0.3) * Math.PI) : 0)
        .setFrame(ph < 0.15 ? 'fx2/sparkle_1' : 'fx2/sparkle_0');
    }
    // 名字小牌子：走动时藏起来
    const showLabel = !this.hop && !this.revealing;
    this.labelBg.setVisible(showLabel);
    this.label.root.setVisible(showLabel);
    for (const t of this.texts) t.update(dt);
    // 闲聊气泡：一句一句来
    if (this.chatter.length && !this.ui.bubble.busy && !this.ui.modal) {
      const next = this.chatter.shift()!;
      this.ui.bubble.show(next.line.text);
      this.bubbleWho = next.line.who;
    }
    // 冰沙摊的大暑隔一会儿挥挥手
    if (this.keeper.visible) {
      const ph = this.time0 % 4;
      this.keeper.setFrame(
        ph < 1.2 ? (Math.floor(ph * 6) % 2 ? 'shop/daishu_1' : 'shop/daishu_2') : 'shop/daishu_0',
      );
    }
    const at =
      this.bubbleWho === 'huihui'
        ? { x: hx, y: hy - 8 }
        : this.bubbleWho === 'daishu'
          ? { x: SHOP_KEEPER.x, y: SHOP_KEEPER.y - 18 }
          : { x: this.hx, y: this.hy - 24 };
    this.ui.bubble.update(dt, at.x, at.y);
  }

  private bubbleWho = 'xiaoman';
}
