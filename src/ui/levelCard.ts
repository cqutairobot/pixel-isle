import { GLASS_COLORS } from '../art/items';
import { MAP_TEXT } from '../content/text';
import { formatTime, type LevelRecord } from '../platform/save';
import { BTN } from '../sim/input';
import { ATLAS } from '../view/textures';
import { PanelModal, type ModalHost } from './panelModal';
import type { PixelText } from './text/pixelText';

/**
 * 章节地图上的关卡卡片（docs/levels/1-2.md §5）：关卡名、最佳用时、海玻璃 ○○○。
 * 按确认进关；还在做的关卡只写"正在制作中"，按什么键都关掉。
 */
export class LevelCard extends PanelModal {
  private ready = 0.25;
  private hint: PixelText;

  constructor(
    host: ModalHost,
    title: string,
    rec: LevelRecord | null,
    private soon: boolean,
    private onEnter: () => void,
  ) {
    super(host, 200, soon ? 74 : 92);
    this.centered(title, 9, 'red1');
    if (soon) {
      this.centered(MAP_TEXT.soon, 30, 'night', 180);
      this.hint = this.centered(MAP_TEXT.back, this.h - 17, 'stone');
      return;
    }
    const best = rec?.bestFrames;
    this.centered(
      best ? `${MAP_TEXT.best}  ${formatTime(best)}` : MAP_TEXT.notCleared,
      28,
      best ? 'night' : 'stone',
    );
    // 海玻璃：找到过的是彩色的，没找到的是空槽
    const glass = rec?.glass ?? [];
    for (let i = 0; i < 3; i++) {
      const img = host.scene.add
        .image(
          this.w / 2 + (i - 1) * 16,
          52,
          ATLAS,
          glass[i] ? `item/glass_${GLASS_COLORS[i]}_0` : 'ui/glass_slot',
        )
        .setOrigin(0.5, 0.5);
      this.root.add(img);
    }
    this.hint = this.centered(MAP_TEXT.enter, this.h - 17, 'stone');
  }

  input(pressed: number): void {
    if (this.ready > 0 || this.isClosing) return;
    if (!this.soon && pressed & (BTN.jump | BTN.confirm)) {
      this.host.sfx('confirm');
      this.close(this.onEnter);
    } else if (pressed & (BTN.attack | BTN.cancel | BTN.start | BTN.jump | BTN.confirm))
      this.close();
  }

  override update(dt: number): void {
    super.update(dt);
    if (this.ready > 0) this.ready -= dt;
    this.hint.setAlpha(this.ready > 0 ? 0 : 0.6 + Math.sin(this.time * 4) * 0.3);
  }
}
