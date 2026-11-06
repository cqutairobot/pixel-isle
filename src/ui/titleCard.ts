import type Phaser from 'phaser';
import { GLASS_COLORS } from '../art/items';
import { VIEW_W } from '../platform/display';
import { ATLAS } from '../view/textures';
import { panelTexture } from './panel';
import { PixelText } from './text/pixelText';

/**
 * 关卡开场标题卡（docs/levels/1-2.md §5）：一条深色的带子从左边滑进来，
 * 上面一行是章节名，中间是"1-2 椰影小径"，下面一行是本关 3 枚海玻璃的收集情况，停一会儿再从右边滑出去。
 */
export class TitleCard {
  constructor(private scene: Phaser.Scene) {}

  show(chapter: string, title: string, glass: readonly boolean[] = []): void {
    const s = this.scene;
    const h = 68;
    const y = 44;
    const root = s.add.container(-VIEW_W - 16, y).setDepth(24);
    const bg = s.add.image(-8, 0, panelTexture(s, VIEW_W + 16, h, 'night')).setOrigin(0, 0);
    const c = new PixelText(s, 0, 0, chapter, { color: 'gold' });
    c.setPosition(Math.round((VIEW_W - c.width) / 2), 5);
    const t = new PixelText(s, 0, 0, title, { color: 'cream', shadow: 'ink' });
    t.root.setScale(2);
    t.setPosition(Math.round((VIEW_W - t.width * 2) / 2), 17);
    root.add([bg, c.root, t.root]);
    // 海玻璃：找到过的是彩色的，没找到的是空槽
    const slots = [0, 1, 2].map((i) => {
      const found = !!glass[i];
      return s.add
        .image(
          Math.round(VIEW_W / 2 + (i - 1) * 16),
          56,
          ATLAS,
          found ? `item/glass_${GLASS_COLORS[i]}_0` : 'ui/glass_slot',
        )
        .setOrigin(0.5, 0.5);
    });
    root.add(slots);
    s.tweens.chain({
      targets: root,
      tweens: [
        { x: 0, duration: 420, ease: 'Cubic.Out' },
        { x: 0, duration: 2300 },
        { x: VIEW_W + 16, duration: 380, ease: 'Cubic.In' },
      ],
      onComplete: () => {
        c.destroy();
        t.destroy();
        root.destroy();
      },
    });
    // 海玻璃一个接一个弹一下
    slots.forEach((img, i) =>
      s.tweens.add({
        targets: img,
        scale: { from: 0, to: 1 },
        delay: 380 + i * 110,
        duration: 260,
        ease: 'Back.Out',
      }),
    );
  }
}
