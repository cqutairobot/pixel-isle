import Phaser from 'phaser';
import { allText } from '../content/allText';
import { glyphs, UI_FONT } from '../ui/text/glyphs';
import { buildAtlas } from '../view/textures';

export { UI_FONT };

/** 启动后进入哪个场景（由 main.ts 按网址决定） */
export interface BootTarget {
  scene: 'gym' | 'level' | 'title';
  data?: Record<string, unknown>;
}

/** 启动：生成图集、等界面字体加载完、生成字库，然后启动界面场景和目标场景 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    buildAtlas(this);
    const text = allText().join('');
    const fontReady = document.fonts
      ? document.fonts.load(`12px "${UI_FONT}"`, text).catch(() => undefined)
      : Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 4000));
    void Promise.race([fontReady, timeout]).then(() => {
      glyphs.build(this, text);
      const target = (this.registry.get('bootTarget') as BootTarget | undefined) ?? {
        scene: 'level',
      };
      this.scene.launch('ui');
      this.scene.start(target.scene, target.data);
      // 去掉页面里的加载动画
      const loader = document.getElementById('loader');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 400);
      }
    });
  }
}
