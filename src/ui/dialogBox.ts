import type Phaser from 'phaser';
import { portraitFrame } from '../art/portraits';
import type { Line } from '../content/dialog/line';
import { SPEAKERS } from '../content/speakers';
import { VIEW_H, VIEW_W } from '../platform/display';
import { BTN } from '../sim/input';
import { ATLAS } from '../view/textures';
import { panelTexture } from './panel';
import { PixelText } from './text/pixelText';

/** 对话框里一行文字的宽度、最多几行（tests/glyphs.test.ts 用它检查对白会不会溢出） */
export const DIALOG_TEXT_W = 296;
export const NARRATOR_TEXT_W = 320;
export const DIALOG_MAX_LINES = 3;

const BOX_W = 360;
const BOX_H = 58;
const BOX_X = Math.round((VIEW_W - BOX_W) / 2);
const Y_BOTTOM = VIEW_H - BOX_H - 8;
const Y_TOP = 20;
const TEXT_X = 54;
const TEXT_Y = 8;
const PORTRAIT_X = 8;
const PORTRAIT_Y = 10;
/** 推进对话的键：跳、确认、攻击都可以 */
const ADVANCE = BTN.jump | BTN.confirm | BTN.attack;
const PUNCT = '，。、！？…—,.!?~：；「」『』（）() ';

export interface DialogHooks {
  /** 某人头顶在屏幕上的位置：对话框从这里弹出、收回 */
  anchor?: (who: string) => { x: number; y: number } | null;
  /** 放在画面上方还是下方；auto 按第一个说话人的位置决定（不挡住人） */
  place?: 'top' | 'bottom' | 'auto';
  /** 说话音（参数是音高倍数） */
  voice?: (pitch: number) => void;
  sfx?: (id: 'open' | 'page' | 'close') => void;
  onDone?: () => void;
}

type State = 'opening' | 'open' | 'closing' | 'closed';

const backOut = (t: number) => {
  const c1 = 1.70158;
  return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

/**
 * 对话框（模态）：从说话人头顶弹出，头像滑入（说话时张嘴、偶尔眨眼），名字条用说话人的颜色，
 * 打字机效果（标点处停顿）配说话音，一句打完出现跳动的 ▼。
 * 按跳 / 确认：还在打字就一下子显示全部，否则翻到下一句；最后一句后收回。
 */
export class DialogBox {
  readonly hidesHud = true;
  private root: Phaser.GameObjects.Container;
  private paper: Phaser.GameObjects.Image;
  private night: Phaser.GameObjects.Image;
  private frame: Phaser.GameObjects.Image | null = null;
  private portrait: Phaser.GameObjects.Image;
  private tag: Phaser.GameObjects.Container;
  private tagBg: Phaser.GameObjects.Image | null = null;
  private tagText: PixelText;
  private text: PixelText;
  private arrow: Phaser.GameObjects.Image;
  private index = -1;
  private state: State = 'opening';
  private t = 0;
  private time = 0;
  private lock = 0.25;
  private y: number;
  private who: string | null = null;
  private face = 'normal';
  private slide = 1;
  private tagPop = 1;
  private blinkT = 2.5;
  private blinking = 0;
  private mouthOpen = false;
  private mouthT = 0;
  private typed = 0;
  private from = { x: VIEW_W / 2, y: VIEW_H / 2 };

  constructor(
    private scene: Phaser.Scene,
    private lines: readonly Line[],
    private hooks: DialogHooks = {},
  ) {
    const first = lines[0];
    const a = first ? hooks.anchor?.(first.who) : null;
    const place =
      hooks.place === 'top' || hooks.place === 'bottom'
        ? hooks.place
        : a && a.y > VIEW_H * 0.58
          ? 'top'
          : 'bottom';
    this.y = place === 'top' ? Y_TOP : Y_BOTTOM;
    if (a) this.from = a;

    this.root = scene.add.container(BOX_X, this.y).setDepth(30);
    this.paper = scene.add.image(0, 0, panelTexture(scene, BOX_W, BOX_H)).setOrigin(0, 0);
    this.night = scene.add
      .image(0, 0, panelTexture(scene, BOX_W, BOX_H, 'night'))
      .setOrigin(0, 0)
      .setVisible(false);
    this.portrait = scene.add.image(0, 0, ATLAS, 'portrait/xiaoman_normal').setOrigin(0, 0);
    this.tag = scene.add.container(TEXT_X - 4, -9);
    this.tagText = new PixelText(scene, 6, 1, '', { color: 'white' });
    this.tag.add(this.tagText.root);
    this.text = new PixelText(scene, TEXT_X, TEXT_Y, '', {
      maxWidth: DIALOG_TEXT_W,
      color: 'night',
    });
    this.text.onType = (c) => this.onType(c.ch);
    this.arrow = scene.add.image(BOX_W - 12, BOX_H - 10, ATLAS, 'ui/page').setOrigin(0, 0);
    this.root.add([this.paper, this.night, this.portrait, this.tag, this.text.root, this.arrow]);
    this.layout(0);
    hooks.sfx?.('open');
    this.next();
  }

  /** 对话已经收回（或被跳过） */
  get closed(): boolean {
    return this.state === 'closed';
  }

  private onType(ch: string): void {
    if (PUNCT.includes(ch)) {
      this.mouthOpen = false;
      return;
    }
    this.typed++;
    this.mouthOpen = !this.mouthOpen;
    this.mouthT = 0.1;
    const sp = this.who ? SPEAKERS[this.who] : undefined;
    if (sp?.portrait && this.typed % 2 === 1)
      this.hooks.voice?.(sp.voice * (0.94 + Math.random() * 0.12));
  }

  private next(): void {
    this.index++;
    const line = this.lines[this.index];
    if (!line) {
      this.close();
      return;
    }
    if (this.index > 0) this.hooks.sfx?.('page');
    this.show(line);
  }

  private show(line: Line): void {
    const sp = SPEAKERS[line.who] ?? SPEAKERS.narrator!;
    const narrator = !sp.portrait;
    const changed = line.who !== this.who;
    this.who = line.who;
    this.typed = 0;
    this.paper.setVisible(!narrator);
    this.night.setVisible(narrator);
    // 头像框和底色
    if (changed) {
      this.frame?.destroy();
      this.frame = null;
      if (!narrator) {
        this.frame = this.scene.add
          .image(PORTRAIT_X - 3, PORTRAIT_Y - 3, panelTexture(this.scene, 38, 38, 'paper', sp.bg))
          .setOrigin(0, 0);
        this.root.addAt(this.frame, 2);
        this.slide = 0;
        this.tagPop = 0;
      }
      this.tagBg?.destroy();
      this.tagBg = null;
      if (sp.name) {
        this.tagText.setText(sp.name);
        this.tagBg = this.scene.add
          .image(0, 0, panelTexture(this.scene, this.tagText.width + 12, 15, 'tag', sp.color))
          .setOrigin(0, 0);
        this.tag.addAt(this.tagBg, 0);
      }
    }
    this.portrait.setVisible(!narrator);
    this.frame?.setVisible(!narrator);
    this.tag.setVisible(!!sp.name);
    this.face = line.face ?? 'normal';
    // 文字：旁白居中，用浅色字
    this.text.destroy();
    this.text = new PixelText(this.scene, 0, 0, line.text, {
      maxWidth: narrator ? NARRATOR_TEXT_W : DIALOG_TEXT_W,
      color: narrator ? 'cream' : 'night',
      align: narrator ? 'center' : 'left',
    });
    this.text.onType = (c) => this.onType(c.ch);
    this.root.addAt(this.text.root, this.root.length - 1);
    if (narrator)
      this.text.setPosition(
        Math.round((BOX_W - this.text.width) / 2),
        Math.round((BOX_H - this.text.height) / 2) - 1,
      );
    else this.text.setPosition(TEXT_X, TEXT_Y);
    this.text.type();
    this.mouthOpen = false;
  }

  private close(): void {
    if (this.state === 'closing' || this.state === 'closed') return;
    this.state = 'closing';
    this.t = 0;
    const a = this.who ? this.hooks.anchor?.(this.who) : null;
    if (a) this.from = a;
    this.hooks.sfx?.('close');
  }

  input(pressed: number): void {
    if (this.state !== 'open' || this.lock > 0) return;
    if (!(pressed & ADVANCE)) return;
    if (!this.text.done) this.text.finish();
    else this.next();
  }

  /** 进度 k（0–1）时的位置和缩放：从说话人头顶长到对话框的位置 */
  private layout(k: number): void {
    const s = 0.2 + 0.8 * k;
    const x0 = this.from.x - (BOX_W * 0.2) / 2;
    const y0 = this.from.y - (BOX_H * 0.2) / 2;
    this.root
      .setScale(s)
      .setPosition(x0 + (BOX_X - x0) * k, y0 + (this.y - y0) * k)
      .setAlpha(Math.min(1, k * 2.5));
  }

  update(dt: number): void {
    if (this.state === 'closed') return;
    this.time += dt;
    this.t += dt;
    if (this.lock > 0) this.lock -= dt;
    if (this.state === 'opening') {
      const k = Math.min(1, this.t / 0.22);
      this.layout(backOut(k));
      if (k >= 1) {
        this.state = 'open';
        this.layout(1);
      }
    } else if (this.state === 'closing') {
      const k = Math.min(1, this.t / 0.14);
      this.layout(1 - k * k);
      if (k >= 1) {
        this.state = 'closed';
        this.root.setVisible(false);
        this.hooks.onDone?.();
        return;
      }
    }
    if (this.state !== 'closing') this.text.update(dt);
    // 头像：滑入、说话时张嘴、偶尔眨眼
    this.slide = Math.min(1, this.slide + dt / 0.18);
    this.tagPop = Math.min(1, this.tagPop + dt / 0.14);
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blinking = 0.12;
      this.blinkT = 2.2 + Math.random() * 2.2;
    }
    if (this.blinking > 0) this.blinking -= dt;
    if (this.mouthT > 0) this.mouthT -= dt;
    else this.mouthOpen = false;
    const typing = !this.text.done;
    const sp = this.who ? SPEAKERS[this.who] : undefined;
    if (sp?.portrait) {
      const variant = this.blinking > 0 ? 'blink' : typing && this.mouthOpen ? 'talk' : '';
      this.portrait
        .setFrame(portraitFrame(sp.portrait, this.face, variant))
        .setPosition(PORTRAIT_X - Math.round((1 - backOut(this.slide)) * 10), PORTRAIT_Y)
        .setAlpha(Math.min(1, this.slide * 2));
    }
    this.tag.setScale(1, 0.3 + 0.7 * backOut(this.tagPop));
    this.arrow
      .setVisible(this.state === 'open' && !typing)
      .setY(BOX_H - 10 + (Math.floor(this.time * 3) % 2));
  }

  /** 立即关掉，不回调（跳过过场、离开场景时用） */
  destroy(): void {
    if (this.state !== 'closed') this.state = 'closed';
    this.text.destroy();
    this.tagText.destroy();
    this.root.destroy();
  }
}
