import type Phaser from 'phaser';
import type { ColorName } from '../art/palette';
import { MENU_TEXT } from '../content/text';
import { VIEW_H, VIEW_W } from '../platform/display';
import type { Modal } from '../scenes/UIScene';
import { BTN } from '../sim/input';
import { Menu, type MenuSound } from './menu';
import { panelTexture, type PanelStyle } from './panel';
import { measureText, PixelText, type PixelTextOptions } from './text/pixelText';

/** 打开模态面板的地方（界面场景）：面板关掉时把自己从栈里拿掉 */
export interface ModalHost {
  scene: Phaser.Scene;
  close(m: Modal): void;
  sfx(s: MenuSound | 'open' | 'close'): void;
}

/**
 * 模态面板的基类：背后压暗，面板从上方落下回弹；关闭时往上收起再销毁。
 */
export abstract class PanelModal implements Modal {
  readonly hidesHud = true;
  protected root: Phaser.GameObjects.Container;
  protected texts: PixelText[] = [];
  protected readonly w: number;
  protected readonly h: number;
  private dim: Phaser.GameObjects.Rectangle;
  private closing = false;
  protected time = 0;

  constructor(
    protected host: ModalHost,
    w: number,
    h: number,
    style: PanelStyle = 'paper',
    dim = 0.45,
  ) {
    const scene = host.scene;
    this.w = w;
    this.h = h;
    const x0 = Math.round((VIEW_W - w) / 2);
    const y0 = Math.round((VIEW_H - h) / 2);
    this.dim = scene.add
      .rectangle(0, 0, VIEW_W, VIEW_H, 0x1a1c2c, dim)
      .setOrigin(0, 0)
      .setDepth(31)
      .setAlpha(0);
    this.root = scene.add.container(x0, -h - 10).setDepth(32);
    this.root.add(scene.add.image(0, 0, panelTexture(scene, w, h, style)).setOrigin(0, 0));
    scene.tweens.add({ targets: this.dim, alpha: 1, duration: 160 });
    scene.tweens.add({ targets: this.root, y: y0, duration: 260, ease: 'Back.Out' });
    host.sfx('open');
  }

  protected text(s: string, x: number, y: number, o: PixelTextOptions = {}): PixelText {
    const t = new PixelText(this.host.scene, x, y, s, { color: 'night', ...o });
    this.root.add(t.root);
    this.texts.push(t);
    return t;
  }

  /** 水平居中的一行字 */
  protected centered(
    s: string,
    y: number,
    color: ColorName = 'night',
    maxWidth?: number,
  ): PixelText {
    const t = this.text(s, 0, y, { color, maxWidth, align: 'center' });
    t.setPosition(Math.round((this.w - t.width) / 2), y);
    return t;
  }

  get isClosing(): boolean {
    return this.closing;
  }

  /** 收起面板，然后（可选）做下一件事 */
  close(then?: () => void): void {
    if (this.closing) return;
    this.closing = true;
    this.host.sfx('close');
    const scene = this.host.scene;
    scene.tweens.add({ targets: this.dim, alpha: 0, duration: 140 });
    scene.tweens.add({
      targets: this.root,
      y: -this.h - 10,
      duration: 170,
      ease: 'Cubic.In',
      onComplete: () => {
        this.host.close(this);
        then?.();
      },
    });
  }

  abstract input(pressed: number, held: number): void;

  update(dt: number): void {
    this.time += dt;
    for (const t of this.texts) t.update(dt);
  }

  destroy(): void {
    for (const t of this.texts) t.destroy();
    this.dim.destroy();
    this.root.destroy();
  }
}

/** 二次确认：一句话 + [确定] [取消]，默认焦点在"取消" */
export class ConfirmBox extends PanelModal {
  private menu: Menu;

  constructor(host: ModalHost, message: string, onYes: () => void, onNo?: () => void) {
    const probe = new PixelText(host.scene, 0, 0, message, { maxWidth: 196 });
    const h = probe.height + 58;
    probe.destroy();
    super(host, 220, h);
    this.text(message, 12, 10, { maxWidth: 196 });
    this.menu = new Menu(
      host.scene,
      70,
      h - 38,
      [
        { label: MENU_TEXT.yes, select: () => this.close(onYes) },
        { label: MENU_TEXT.no, select: () => this.close(onNo) },
      ],
      { rowH: 15, back: () => this.close(onNo), sfx: (s) => host.sfx(s) },
    );
    this.menu.focus = 1;
    this.root.add(this.menu.root);
  }

  input(pressed: number): void {
    if (!this.isClosing) this.menu.input(pressed);
  }

  override update(dt: number): void {
    super.update(dt);
    this.menu.update(dt);
  }

  override destroy(): void {
    this.menu.destroy();
    super.destroy();
  }
}

/** 一张信息卡片（操作说明、制作人员、"制作中"）：按任意键关掉 */
export class InfoCard extends PanelModal {
  private ready = 0.35;
  private hint: PixelText;

  constructor(
    host: ModalHost,
    title: string,
    lines: string[],
    private onClose?: () => void,
    width = 300,
  ) {
    const maxW = width - 28;
    const heights = lines.map((l) => (l ? measureText(l, maxW).h : 6));
    super(host, width, 30 + heights.reduce((a, b) => a + b + 1, 0) + 22);
    this.centered(title, 8, 'red1');
    let y = 27;
    lines.forEach((l, i) => {
      if (l) this.text(l, 14, y, { color: 'night', maxWidth: maxW });
      y += heights[i]! + 1;
    });
    this.hint = this.centered(MENU_TEXT.anyKey, this.h - 17, 'stone');
    this.hint.setAlpha(0);
  }

  input(pressed: number): void {
    if (this.ready > 0 || this.isClosing) return;
    if (pressed & (BTN.jump | BTN.confirm | BTN.attack | BTN.cancel | BTN.start))
      this.close(this.onClose);
  }

  override update(dt: number): void {
    super.update(dt);
    if (this.ready > 0) this.ready -= dt;
    this.hint.setAlpha(this.ready > 0 ? 0 : 0.6 + Math.sin(this.time * 4) * 0.3);
  }
}
