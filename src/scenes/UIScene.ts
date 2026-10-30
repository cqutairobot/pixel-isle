import Phaser from 'phaser';
import { currentLayout, type Layout } from '../platform/display';
import { Bubble } from '../ui/bubble';
import { Hud } from '../ui/hud';
import { KeyHint } from '../ui/keyHint';
import { Toast } from '../ui/toast';
import { fitCamera } from './play/loop';

/**
 * 叠在关卡上面的界面场景：HUD、提示条、按键提示、回回的气泡、结算面板。
 * 和世界用同样的整数倍缩放（PLAN §12.1：正式 UI 的像素与世界一致），但不跟随镜头。
 * 在 BootScene 里启动后一直运行，由关卡场景调用它的方法。
 */
export class UIScene extends Phaser.Scene {
  hud!: Hud;
  toast!: Toast;
  keyHint!: KeyHint;
  bubble!: Bubble;
  /** 当前打开的模态界面（结算、暂停）：它在的时候由它接管按键 */
  modal: { update(dt: number): void; input(pressed: number): void; destroy(): void } | null = null;

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

  openModal(m: NonNullable<UIScene['modal']>): void {
    this.modal?.destroy();
    this.modal = m;
  }

  closeModal(): void {
    this.modal?.destroy();
    this.modal = null;
  }

  override update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 100) / 1000;
    this.hud.update(dt);
    this.toast.update(dt);
    this.keyHint.update(dt);
    this.modal?.update(dt);
  }
}
