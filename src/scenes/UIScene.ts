import Phaser from 'phaser';
import type { Line } from '../content/dialog/line';
import { currentLayout, type Layout } from '../platform/display';
import { Bubble } from '../ui/bubble';
import { DialogBox, type DialogHooks } from '../ui/dialogBox';
import { Hud } from '../ui/hud';
import { KeyHint } from '../ui/keyHint';
import { Toast } from '../ui/toast';
import { fitCamera } from './play/loop';

/** 模态界面（对话框、结算、暂停菜单、设置……）：最上面的一个接管按键 */
export interface Modal {
  update(dt: number): void;
  input(pressed: number, held: number): void;
  destroy(): void;
  /** 打开时把 HUD 淡出 */
  readonly hidesHud?: boolean;
}

/**
 * 叠在关卡上面的界面场景：HUD、提示条、按键提示、回回的气泡、对话框、结算面板。
 * 和世界用同样的整数倍缩放（PLAN §12.1：正式 UI 的像素与世界一致），但不跟随镜头。
 * 在 BootScene 里启动后一直运行，由关卡场景调用它的方法。
 */
export class UIScene extends Phaser.Scene {
  hud!: Hud;
  toast!: Toast;
  keyHint!: KeyHint;
  bubble!: Bubble;
  /** 打开的模态界面，后打开的在上面 */
  private modals: Modal[] = [];
  private hudAlpha = 1;

  constructor() {
    super('ui');
  }

  create(): void {
    this.applyLayout(currentLayout());
    this.game.events.on('layout', this.applyLayout, this);
    this.hud = new Hud(this);
    this.toast = new Toast(this);
    this.keyHint = new KeyHint(this);
    this.bubble = new Bubble(this);
    this.setLevelUI(false);
  }

  private applyLayout(L: Layout): void {
    fitCamera(this.cameras.main, L);
  }

  /** 关卡里才显示 HUD */
  setLevelUI(on: boolean): void {
    this.hud.setVisible(on);
  }

  /** 最上面的模态界面 */
  get modal(): Modal | null {
    return this.modals[this.modals.length - 1] ?? null;
  }

  openModal(m: Modal): void {
    this.modals.push(m);
  }

  /** 关掉指定的（默认最上面的）模态界面 */
  closeModal(m: Modal | null = this.modal): void {
    if (!m) return;
    const i = this.modals.indexOf(m);
    if (i >= 0) this.modals.splice(i, 1);
    m.destroy();
  }

  closeAll(): void {
    while (this.modals.length) this.closeModal();
  }

  /** 打开对话框；播完（最后一句收回）后调用 hooks.onDone */
  dialog(lines: readonly Line[], hooks: DialogHooks = {}): DialogBox {
    if (this.keyHint.current) this.keyHint.done(this.keyHint.current);
    this.bubble.hide();
    const box: DialogBox = new DialogBox(this, lines, {
      ...hooks,
      onDone: () => {
        this.closeModal(box);
        hooks.onDone?.();
      },
    });
    this.openModal(box);
    return box;
  }

  override update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 100) / 1000;
    const target = this.modals.some((m) => m.hidesHud) ? 0 : 1;
    this.hudAlpha += (target - this.hudAlpha) * (1 - Math.exp(-dt * 14));
    this.hud.root.setAlpha(this.hudAlpha);
    this.hud.update(dt);
    this.toast.update(dt);
    this.keyHint.update(dt);
    for (const m of [...this.modals]) m.update(dt);
  }
}
