import type Phaser from 'phaser';
import { portraitFrame } from '../art/portraits';
import { shopBackdrop } from '../art/shop';
import { audio } from '../audio/engine';
import type { Line } from '../content/dialog/line';
import { SHOP_LINES } from '../content/dialog/shop';
import { hasOutfit, OUTFITS, outfitOf, wear, type Outfit } from '../content/outfits';
import { buy, ownedCount, SHOP_ITEMS, type ShopItem } from '../content/shop';
import { SPEAKERS } from '../content/speakers';
import { MAP_TEXT, SHOP_TEXT } from '../content/text';
import { VIEW_H, VIEW_W } from '../platform/display';
import type { SaveData } from '../platform/save';
import type { Modal } from '../scenes/UIScene';
import { BTN } from '../sim/input';
import { addImageTexture, ATLAS } from '../view/textures';
import { panelTexture } from './panel';
import type { ModalHost } from './panelModal';
import { PixelText } from './text/pixelText';

export interface ShopOptions {
  /** 正在用的存档（买东西、换装直接改它） */
  save: SaveData;
  /** 存档改了以后写盘 */
  persist(): void;
  /** 只开换装那一页（地图菜单的"换装"）：没有冰沙摊和大暑 */
  outfitOnly?: boolean;
  /** 冰沙摊第一次开张后第一次进店 */
  first?: boolean;
  /** 关掉以后（服装可能换了） */
  onClose(): void;
}

type Tab = 'buy' | 'outfit';

const PANEL_W = 208;
const PANEL_H = 142;
const ROW_H = 17;
const LIST_Y = 38;
/** 冰沙摊各部件在画面上的位置（左上角） */
const STALL = { x: 14, y: 26 };

interface Row {
  objs: Phaser.GameObjects.GameObject[];
  texts: PixelText[];
}

/**
 * 大暑的冰沙摊（docs/levels/1-3.md §5）：铺满画面的模态界面。
 * - 左边：冰沙摊，大暑（头像半身像）站在柜台后面，说话时张嘴、讲冷笑话时挤眼；小满和回回站在摊子前；
 * - 右边：贝壳数、「买东西」「换装」两栏（← → 切换）、货架（↑ ↓ 选择、K 确定）；换装栏右边是放大的小满，转一圈给你看；
 * - 下面：对白条，大暑介绍商品、讲冷笑话，回回接话。
 * 地图菜单的"换装"只开换装那一页，放在画面中间。
 */
export class ShopScreen implements Modal {
  readonly hidesHud = true;
  private readonly scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Container;
  private panelX: number;
  private stall: Phaser.GameObjects.Container | null = null;
  private strip: Phaser.GameObjects.Container | null = null;
  private texts: PixelText[] = [];
  private rows: Row[] = [];
  tab: Tab;
  focus = 0;
  private time = 0;
  private closing = false;
  private shownShells: number;
  private shellText: PixelText;
  private shellIcon: Phaser.GameObjects.Image;
  private highlight: Phaser.GameObjects.Rectangle;
  private highlightY: number = LIST_Y;
  private tabTexts: PixelText[] = [];
  private tabLine: Phaser.GameObjects.Rectangle | null = null;
  private hint: PixelText;
  // 对白条
  private nameText: PixelText | null = null;
  private lineText: PixelText | null = null;
  private queue: Line[] = [];
  private holdT = 0;
  private daishuFace = 'normal';
  private portrait: Phaser.GameObjects.Image | null = null;
  private blinkT = 2.5;
  private blinking = 0;
  private mouthT = 0;
  private mouthOpen = false;
  private talking = false;
  // 小满
  private heroStand: Phaser.GameObjects.Image | null = null;
  private hui: Phaser.GameObjects.Image | null = null;
  private preview: Phaser.GameObjects.Image;
  private pedestal: Phaser.GameObjects.Image;
  private previewOutfit: Outfit;
  private spinT = -1;
  private spinQueued = false;
  private lastJoke = -1;
  private shellTick = 0;

  constructor(
    private host: ModalHost,
    private o: ShopOptions,
  ) {
    const scene = host.scene;
    this.scene = scene;
    this.tab = o.outfitOnly ? 'outfit' : 'buy';
    this.shownShells = o.save.shells;
    this.previewOutfit = outfitOf(o.save.outfit);
    this.root = scene.add.container(0, 0).setDepth(32).setAlpha(0);
    // 背景：地图上压暗（只开换装页时）或海崖下的沙滩
    if (o.outfitOnly) {
      this.root.add(scene.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x1a1c2c, 0.55).setOrigin(0, 0));
    } else {
      if (!scene.textures.exists('shop-bg'))
        addImageTexture(scene, 'shop-bg', shopBackdrop(VIEW_W, VIEW_H));
      this.root.add(scene.add.image(0, 0, 'shop-bg').setOrigin(0, 0));
      this.buildStall();
      this.buildStrip();
    }
    // 右边（或中间）的货架面板
    this.panelX = o.outfitOnly ? Math.round((VIEW_W - PANEL_W) / 2) : 168;
    const panelY = o.outfitOnly ? Math.round((VIEW_H - PANEL_H) / 2) : 8;
    this.panel = scene.add.container(this.panelX + 40, panelY);
    this.root.add(this.panel);
    this.panel.add(
      scene.add.image(0, 0, panelTexture(scene, PANEL_W, PANEL_H, 'paper')).setOrigin(0, 0),
    );
    this.panelText(o.outfitOnly ? MAP_TEXT.outfits : SHOP_TEXT.title, 8, 6, 'red1');
    this.shellIcon = scene.add.image(0, 11, ATLAS, 'ui/shell').setOrigin(0, 0.5);
    this.panel.add(this.shellIcon);
    this.shellText = this.panelText(String(this.shownShells), 0, 6, 'night');
    this.placeShells();
    if (!o.outfitOnly) {
      this.tabTexts = [
        this.panelText(SHOP_TEXT.tabBuy, 10, 22, 'red1'),
        this.panelText(SHOP_TEXT.tabOutfit, 62, 22, 'stone'),
      ];
      this.tabLine = scene.add.rectangle(10, 35, 10, 1, 0xc7354a).setOrigin(0, 0);
      this.panel.add(this.tabLine);
    }
    this.highlight = scene.add.rectangle(4, LIST_Y, PANEL_W - 8, ROW_H, 0xf6dca0).setOrigin(0, 0);
    this.panel.add(this.highlight);
    this.pedestal = scene.add.image(PANEL_W - 38, LIST_Y + 62, ATLAS, 'ui/glass_slot');
    this.pedestal.setScale(3, 1).setAlpha(0.5);
    this.preview = scene.add
      .image(PANEL_W - 38, LIST_Y + 62, ATLAS, `${this.previewOutfit.sheet}/idle_0`)
      .setOrigin(0.5, 1)
      .setScale(2);
    this.panel.add([this.pedestal, this.preview]);
    this.hint = this.panelText('', 8, PANEL_H - 15, 'stone');
    this.buildRows();
    // 入场：整体淡入，面板从右边滑进来，冰沙摊从左边、对白条从下面
    scene.tweens.add({ targets: this.root, alpha: 1, duration: 220 });
    scene.tweens.add({ targets: this.panel, x: this.panelX, duration: 320, ease: 'Back.Out' });
    if (this.stall) {
      this.stall.x = -50;
      scene.tweens.add({ targets: this.stall, x: 0, duration: 340, ease: 'Back.Out' });
    }
    if (this.strip) {
      this.strip.y = VIEW_H + 10;
      scene.tweens.add({ targets: this.strip, y: 154, duration: 300, ease: 'Cubic.Out' });
    }
    if (o.outfitOnly) host.sfx('open');
    else {
      audio.play('shopEnter', { volume: 0.8 });
      const hello = SHOP_LINES.hello[Math.floor(Math.random() * SHOP_LINES.hello.length)]!;
      this.say([o.first ? SHOP_LINES.first : hello]);
    }
    (window as unknown as { __shop?: ShopScreen }).__shop = this;
  }

  // —— 搭画面 ——

  private panelText(s: string, x: number, y: number, color: Parameters<PixelText['setColor']>[0]) {
    const t = new PixelText(this.scene, x, y, s, { color });
    this.panel.add(t.root);
    this.texts.push(t);
    return t;
  }

  private placeShells(): void {
    const w = this.shellText.width;
    this.shellText.setPosition(PANEL_W - 9 - w, 6);
    this.shellIcon.setPosition(PANEL_W - 13 - w - 10, 12);
  }

  /** 冰沙摊：伞和撑杆、大暑的半身像、柜台、刨冰机、冰沙、招牌；摊子前的小满和回回 */
  private buildStall(): void {
    const s = this.scene;
    const c = s.add.container(0, 0);
    const { x, y } = STALL;
    c.add(s.add.image(x, y, ATLAS, 'shop/stall_back').setOrigin(0, 0));
    this.portrait = s.add
      .image(x + 38, y + 30, ATLAS, portraitFrame('daishu', 'normal'))
      .setOrigin(0, 0);
    c.add(this.portrait);
    c.add(s.add.image(x, y + 56, ATLAS, 'shop/stall_front').setOrigin(0, 0));
    c.add(s.add.image(x + 78, y + 30, ATLAS, 'shop/machine').setOrigin(0, 0));
    c.add(s.add.image(x + 8, y + 44, ATLAS, 'shop/cups').setOrigin(0, 0));
    const sign = new PixelText(s, 0, 0, SHOP_TEXT.sign, { color: 'wine', shadow: 'sand3' });
    sign.setPosition(x + 56 - Math.round(sign.width / 2), y + 70);
    c.add(sign.root);
    this.texts.push(sign);
    this.heroStand = s.add
      .image(x + 138, y + 104, ATLAS, `${this.previewOutfit.sheet}/idle_0`)
      .setOrigin(0.5, 1)
      .setFlipX(true);
    this.hui = s.add.image(x + 150, y + 74, ATLAS, 'npc/huihui_idle_0');
    c.add([this.heroStand, this.hui]);
    this.stall = c;
    this.root.add(c);
  }

  /** 下面的对白条：名字 + 一句话（打字机） */
  private buildStrip(): void {
    const s = this.scene;
    const c = s.add.container(8, 154);
    c.add(s.add.image(0, 0, panelTexture(s, VIEW_W - 16, 54, 'paper')).setOrigin(0, 0));
    this.nameText = new PixelText(s, 10, 5, '', { color: 'orange' });
    this.lineText = new PixelText(s, 10, 21, '', { color: 'night', maxWidth: VIEW_W - 40 });
    this.lineText.onType = (ch, i) => {
      if (i % 2 === 0 && ch.ch.trim() && this.queueSpeaker)
        audio.play('voice', {
          rate: this.queueSpeaker * (0.94 + Math.random() * 0.12),
          volume: 0.6,
        });
    };
    c.add([this.nameText.root, this.lineText.root]);
    this.texts.push(this.nameText, this.lineText);
    this.strip = c;
    this.root.add(c);
  }

  private queueSpeaker = 0;

  /** 货架（或衣柜）的每一行 */
  private buildRows(): void {
    for (const r of this.rows) {
      for (const o of r.objs) o.destroy();
      for (const t of r.texts) {
        t.destroy();
        this.texts.splice(this.texts.indexOf(t), 1);
      }
    }
    this.rows = [];
    const s = this.scene;
    const save = this.o.save;
    const outfitTab = this.tab === 'outfit';
    this.preview.setVisible(outfitTab);
    this.pedestal.setVisible(outfitTab);
    // 换装栏右边站着放大的小满，选中行的底色不伸到她脚下
    this.highlight.setSize(outfitTab ? 150 : PANEL_W - 8, ROW_H);
    if (outfitTab) {
      OUTFITS.forEach((outfit, i) => {
        const y = LIST_Y + i * ROW_H;
        const icon =
          outfit.id === 'default'
            ? s.add.image(16, y + ROW_H, ATLAS, 'hero/idle_0').setOrigin(0.5, 1)
            : s.add.image(8, y + 1, ATLAS, `shop/fabric_${outfit.id}`).setOrigin(0, 0);
        const owned = hasOutfit(save, outfit.id);
        icon.setAlpha(owned ? 1 : 0.35);
        this.panel.add(icon);
        const name = this.panelText(outfit.name, 28, y + 3, owned ? 'night' : 'stone');
        const texts = [name];
        const status =
          save.outfit === outfit.id ? SHOP_TEXT.wearing : owned ? '' : SHOP_TEXT.locked;
        if (status)
          texts.push(
            this.panelText(status, 76, y + 3, status === SHOP_TEXT.wearing ? 'red1' : 'stone'),
          );
        this.rows.push({ objs: [icon], texts });
      });
      this.hint.setText(SHOP_TEXT.hintOutfit);
    } else {
      SHOP_ITEMS.forEach((item, i) => {
        const y = LIST_Y + i * ROW_H;
        const icon = s.add.image(8, y + 1, ATLAS, item.icon).setOrigin(0, 0);
        this.panel.add(icon);
        const count = ownedCount(save, item);
        const texts = [this.panelText(item.name, 28, y + 3, 'night')];
        const objs: Phaser.GameObjects.GameObject[] = [icon];
        if (item.kind === 'fabric' && count > 0) {
          const t = this.panelText(SHOP_TEXT.owned, 0, y + 3, 'leaf1');
          t.setPosition(PANEL_W - 10 - t.width, y + 3);
          texts.push(t);
        } else {
          const price = this.panelText(String(item.price), 0, y + 3, 'night');
          price.setPosition(PANEL_W - 22 - price.width, y + 3);
          const shell = s.add.image(PANEL_W - 19, y + 9, ATLAS, 'ui/shell').setOrigin(0, 0.5);
          this.panel.add(shell);
          objs.push(shell);
          texts.push(price);
          if (item.kind === 'bag' && count > 0)
            texts.push(this.panelText(`${SHOP_TEXT.have} ${count}`, 112, y + 3, 'sea'));
        }
        this.rows.push({ objs, texts });
      });
      this.hint.setText(SHOP_TEXT.hint);
    }
    this.focus = Math.min(this.focus, this.rows.length - 1);
    this.highlightY = LIST_Y + this.focus * ROW_H;
    this.highlight.y = this.highlightY;
    if (this.tabLine) {
      const t = this.tabTexts[outfitTab ? 1 : 0]!;
      this.tabLine.setPosition(t.root.x, 35).setSize(t.width, 1);
      this.tabTexts[0]!.setColor(outfitTab ? 'stone' : 'red1');
      this.tabTexts[1]!.setColor(outfitTab ? 'red1' : 'stone');
    }
  }

  // —— 对白 ——

  /** 换成这几句话（一句说完停一会儿再说下一句） */
  private say(lines: Line[]): void {
    if (!this.lineText || !lines.length) return;
    this.queue = lines.slice(1);
    this.startLine(lines[0]!);
  }

  private startLine(line: Line): void {
    const sp = SPEAKERS[line.who]!;
    this.nameText!.setText(sp.name).setColor(sp.color);
    this.lineText!.setText(line.text).type();
    this.queueSpeaker = sp.voice;
    this.holdT = 0;
    this.talking = line.who === 'daishu';
    if (line.who === 'daishu') this.daishuFace = line.face ?? 'normal';
  }

  // —— 操作 ——

  private get items(): readonly ShopItem[] {
    return SHOP_ITEMS;
  }

  input(pressed: number): void {
    if (this.closing || this.time < 0.25) return;
    const n = this.rows.length;
    if (pressed & (BTN.attack | BTN.cancel | BTN.start)) {
      this.host.sfx('back');
      this.close();
      return;
    }
    if (pressed & (BTN.up | BTN.down)) {
      this.focus = (this.focus + (pressed & BTN.up ? n - 1 : 1)) % n;
      audio.play('shopSelect', { volume: 0.6 });
      this.describe();
      return;
    }
    if (!this.o.outfitOnly && pressed & (BTN.left | BTN.right)) {
      this.tab = this.tab === 'buy' ? 'outfit' : 'buy';
      this.focus =
        this.tab === 'outfit' ? OUTFITS.findIndex((o) => o.id === this.o.save.outfit) : 0;
      this.host.sfx('change');
      this.buildRows();
      this.setPreview(this.tab === 'outfit' ? OUTFITS[this.focus]! : outfitOf(this.o.save.outfit));
      this.say([
        this.tab === 'outfit' ? SHOP_LINES.outfitHello : SHOP_LINES.items[this.items[0]!.id],
      ]);
      return;
    }
    if (pressed & (BTN.jump | BTN.confirm)) {
      if (this.tab === 'buy') this.buyFocused();
      else this.wearFocused();
    }
  }

  /** 选中一行时：大暑介绍商品；换装栏里小满换上这身转一圈 */
  private describe(): void {
    if (this.tab === 'buy') {
      this.say([SHOP_LINES.items[this.items[this.focus]!.id]]);
      return;
    }
    const outfit = OUTFITS[this.focus]!;
    this.setPreview(outfit);
    if (!hasOutfit(this.o.save, outfit.id)) this.say([SHOP_LINES.locked]);
    else this.say([SHOP_LINES.outfits[outfit.id]]);
  }

  private buyFocused(): void {
    const item = this.items[this.focus]!;
    const result = buy(this.o.save, item.id);
    if (result === 'ok') {
      this.o.persist();
      audio.play('shopBuy', { volume: 0.9 });
      audio.music.jingle('buy', 'duck');
      let k = Math.floor(Math.random() * SHOP_LINES.jokes.length);
      if (k === this.lastJoke) k = (k + 1) % SHOP_LINES.jokes.length;
      this.lastJoke = k;
      const lines = [SHOP_LINES.jokes[k]!, SHOP_LINES.cold, SHOP_LINES.awkward];
      if (item.kind === 'fabric') lines.push(SHOP_LINES.boughtFabric);
      this.say(lines);
      this.buildRows();
      this.bump(this.rows[this.focus]);
      return;
    }
    audio.play('shopPoor', { volume: result === 'poor' ? 0.9 : 0.5 });
    this.shakeRow(this.rows[this.focus]);
    this.say([
      result === 'poor' ? SHOP_LINES.poor : result === 'max' ? SHOP_LINES.max : SHOP_LINES.owned,
    ]);
  }

  private wearFocused(): void {
    const outfit = OUTFITS[this.focus]!;
    if (this.o.save.outfit === outfit.id) {
      this.say([SHOP_LINES.wearing]);
      return;
    }
    if (!wear(this.o.save, outfit.id)) {
      audio.play('shopPoor', { volume: 0.5 });
      this.shakeRow(this.rows[this.focus]);
      this.say([SHOP_LINES.locked]);
      return;
    }
    this.o.persist();
    audio.play('outfitSwap', { volume: 0.9 });
    this.setPreview(outfit, true);
    this.heroStand?.setFrame(`${outfit.sheet}/victory_0`);
    this.scene.time.delayedCall(500, () => this.heroStand?.setFrame(`${outfit.sheet}/idle_0`));
    this.buildRows();
    this.bump(this.rows[this.focus]);
    if (!this.o.outfitOnly) this.say([SHOP_LINES.worn]);
  }

  /** 换装栏右边的小满换一身衣服，转一圈 */
  private setPreview(outfit: Outfit, force = false): void {
    if (outfit.id === this.previewOutfit.id && !force) return;
    this.previewOutfit = outfit;
    this.spinT = 0;
    this.spinQueued = true;
  }

  private bump(row: Row | undefined): void {
    if (!row) return;
    for (const t of row.texts) {
      t.root.y -= 2;
      this.scene.tweens.add({ targets: t.root, y: t.root.y + 2, duration: 160, ease: 'Back.Out' });
    }
  }

  private shakeRow(row: Row | undefined): void {
    if (!row) return;
    for (const t of row.texts) {
      const x0 = t.root.x;
      this.scene.tweens.add({
        targets: t.root,
        x: x0 + 2,
        duration: 40,
        yoyo: true,
        repeat: 2,
        onComplete: () => (t.root.x = x0),
      });
    }
  }

  close(): void {
    if (this.closing) return;
    this.closing = true;
    if (!this.o.outfitOnly) this.say([SHOP_LINES.bye]);
    const s = this.scene;
    s.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: 220,
      delay: this.o.outfitOnly ? 0 : 150,
    });
    s.tweens.add({
      targets: this.panel,
      x: this.panelX + 40,
      duration: 220,
      delay: this.o.outfitOnly ? 0 : 150,
      ease: 'Cubic.In',
      onComplete: () => {
        this.host.close(this);
        this.o.onClose();
      },
    });
  }

  // —— 每帧 ——

  update(dt: number): void {
    this.time += dt;
    for (const t of this.texts) t.update(dt);
    // 选中行的底色滑过去
    const ty = LIST_Y + this.focus * ROW_H;
    this.highlightY += (ty - this.highlightY) * (1 - Math.exp(-dt * 20));
    this.highlight.y = Math.round(this.highlightY);
    // 贝壳数一个一个往下跳
    if (this.shownShells !== this.o.save.shells) {
      this.shellTick -= dt;
      if (this.shellTick <= 0) {
        this.shellTick = 0.03;
        this.shownShells += Math.sign(this.o.save.shells - this.shownShells);
        this.shellText.setText(String(this.shownShells));
        this.placeShells();
        if (this.shownShells % 3 === 0) audio.play('shopSelect', { volume: 0.25, rate: 1.4 });
      }
    }
    // 对白：说完停一会儿再说下一句
    if (this.lineText?.done && this.queue.length) {
      this.holdT += dt;
      if (this.holdT > 0.9) this.startLine(this.queue.shift()!);
    }
    // 大暑：说话时张嘴，时不时眨眼
    if (this.portrait) {
      this.blinkT -= dt;
      if (this.blinkT <= 0) {
        this.blinking = 0.12;
        this.blinkT = 2.2 + Math.random() * 2.2;
      }
      if (this.blinking > 0) this.blinking -= dt;
      const typing = this.talking && !!this.lineText && !this.lineText.done;
      this.mouthT -= dt;
      if (this.mouthT <= 0) {
        this.mouthOpen = !this.mouthOpen;
        this.mouthT = 0.09;
      }
      const variant = this.blinking > 0 ? 'blink' : typing && this.mouthOpen ? 'talk' : '';
      this.portrait.setFrame(portraitFrame('daishu', this.daishuFace, variant));
    }
    // 回回飘着，小满呼吸
    this.hui?.setY(STALL.y + 74 + Math.round(Math.sin(this.time * 2.6) * 2));
    this.hui?.setFrame(Math.floor(this.time * 2) % 2 ? 'npc/huihui_idle_1' : 'npc/huihui_idle_0');
    // 换装预览：转一圈（横向压扁、翻面、再展开），中间换衣服
    const sheet = this.previewOutfit.sheet;
    if (this.spinT >= 0) {
      this.spinT += dt;
      const k = Math.min(1, this.spinT / 0.5);
      const sx = Math.cos(k * Math.PI * 2);
      if (this.spinQueued && k >= 0.25) {
        this.spinQueued = false;
        this.preview.setFrame(`${sheet}/idle_0`);
      }
      this.preview.setScale(2 * Math.max(0.15, Math.abs(sx)), 2).setFlipX(sx < 0);
      if (k >= 1) {
        this.spinT = -1;
        this.preview.setScale(2).setFlipX(false);
      }
    } else {
      this.preview.setFrame(
        Math.floor(this.time * 1.6) % 2 ? `${sheet}/idle_1` : `${sheet}/idle_0`,
      );
    }
    if (this.heroStand && this.heroStand.frame.name.endsWith('idle_0'))
      this.heroStand.setFrame(`${outfitOf(this.o.save.outfit).sheet}/idle_0`);
  }

  destroy(): void {
    for (const t of this.texts) t.destroy();
    this.root.destroy();
    const w = window as unknown as { __shop?: ShopScreen };
    if (w.__shop === this) w.__shop = undefined;
  }
}
