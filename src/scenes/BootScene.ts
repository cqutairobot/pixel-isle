import Phaser from 'phaser';
import { buildAtlas } from '../view/textures';

export const UI_FONT = 'Fusion Pixel 12px Proportional SC';

/** 启动：生成图集、等界面字体加载完，再进入练习场 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    buildAtlas(this);
    const fontReady = document.fonts
      ? document.fonts.load(`12px "${UI_FONT}"`, '练习场预设手感').catch(() => undefined)
      : Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 3000));
    void Promise.race([fontReady, timeout]).then(() => this.scene.start('gym'));
  }
}
