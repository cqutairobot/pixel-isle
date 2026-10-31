import type Phaser from 'phaser';
import { GLASS_COLORS } from '../art/items';
import { UI_TEXT } from '../content/text';
import { formatTime } from '../platform/save';
import { VIEW_H, VIEW_W } from '../platform/display';
import { BTN } from '../sim/input';
import { Spring } from '../view/spring';
import { ATLAS } from '../view/textures';
import { DUR, STAGGER } from './motion';
import { panelTexture } from './panel';
import { PixelText } from './text/pixelText';

export interface TallyData {
  title: string;
  frames: number;
  bestFrames: number | null;
  newRecord: boolean;
  shells: number;
  glass: readonly boolean[];
  /** 以前就找到过的海玻璃 */
  ghost: readonly boolean[];
  noDamage: boolean;
}

export type TallySfx = 'tick' | 'pop' | 'stamp' | 'move' | 'confirm' | 'open';

const W = 240;
const H = 150;

/**
 * 结算面板（PLAN §5.7）：面板回弹落下 → 用时从 0 数上去 → 贝壳数上去（滴答声）→
 * 海玻璃空槽依次"啪"地填上 → 无伤徽章、新纪录印章盖下来 → 按钮。
 */
export class Tally {
  private root: Phaser.GameObjects.Container;
  private texts: PixelText[] = [];
  private time = 0;
  private timeText: PixelText;
  private shellText: PixelText;
  private slots: Phaser.GameObjects.Image[] = [];
  private slotSprings: Spring[] = [];
  private stamp: Phaser.GameObjects.Container | null = null;
  private badge: Phaser.GameObjects.Container | null = null;
  private stampSpring = new Spring(1, 500, 14);
  private buttons: Array<{ label: string; t: PixelText; bg: Phaser.GameObjects.Image }> = [];
  private focus = 0;
  private focusFrame: Phaser.GameObjects.Graphics;
  private ready = false;
  private shownShells = 0;
  private stage = 0;
  private glassIndex = 0;
  private stageTimer = 0;

  constructor(
    private scene: Phaser.Scene,
    private data: TallyData,
    choices: string[],
    private onChoose: (index: number) => void,
    private sfx: (s: TallySfx) => void,
  ) {
    const x0 = Math.round((VIEW_W - W) / 2);
    const y0 = Math.round((VIEW_H - H) / 2) - 6;
    this.root = scene.add.container(x0, -H - 10).setDepth(30);
    const dim = scene.add
      .rectangle(-x0, -y0 - 400, VIEW_W, VIEW_H + 800, 0x1a1c2c, 0.35)
      .setOrigin(0, 0);
    this.root.add(dim);
    this.root.add(scene.add.image(0, 0, panelTexture(scene, W, H)).setOrigin(0, 0));
    const title = this.text(data.title, 0, 8, { align: 'center', color: 'red1', width: W });
    title.setPosition(Math.round((W - title.width) / 2), 8);
    const rowY = [34, 54, 74];
    this.text(UI_TEXT.time, 20, rowY[0]!, { color: 'night' });
    this.text(UI_TEXT.shells, 20, rowY[1]!, { color: 'night' });
    this.text(UI_TEXT.glass, 20, rowY[2]!, { color: 'night' });
    this.timeText = this.text('0:00.00', 0, rowY[0]!, { color: 'night' });
    this.shellText = this.text('0', 0, rowY[1]!, { color: 'night' });
    this.placeRight(this.timeText, rowY[0]!);
    this.placeRight(this.shellText, rowY[1]!);
    for (let i = 0; i < 3; i++) {
      const img = scene.add.image(W - 56 + i * 15, rowY[2]! + 7, ATLAS, 'ui/glass_slot');
      this.slots.push(img);
      this.slotSprings.push(new Spring(1, 700, 14));
      this.root.add(img);
    }
    // 分隔线
    const line = scene.add.graphics();
    line.fillStyle(0xe3b46e, 1);
    for (const y of [28, 92]) line.fillRect(14, y, W - 28, 1);
    this.root.add(line);
    if (data.bestFrames !== null && !data.newRecord) {
      const best = this.text(`最佳 ${formatTime(data.bestFrames)}`, 0, 96, { color: 'stone' });
      best.setPosition(20, 96);
    }
    // 按钮
    this.focusFrame = scene.add.graphics();
    const bw = 76;
    const gap = 10;
    const total = choices.length * bw + (choices.length - 1) * gap;
    choices.forEach((label, i) => {
      const bx = Math.round((W - total) / 2) + i * (bw + gap);
      const bg = scene.add
        .image(bx, H - 30, panelTexture(scene, bw, 18, 'paper', 'sand3'))
        .setOrigin(0, 0);
      this.root.add(bg);
      const t = this.text(label, 0, H - 28, { color: 'night' });
      t.setPosition(bx + Math.round((bw - t.width) / 2), H - 28);
      this.buttons.push({ label, t, bg });
    });
    this.root.add(this.focusFrame);
    this.root.setAlpha(1);
    scene.tweens.add({ targets: this.root, y: y0, duration: DUR.l, ease: 'Back.Out' });
    this.sfx('open');
  }

  private text(
    s: string,
    x: number,
    y: number,
    o: { color?: 'night' | 'red1' | 'stone'; align?: 'center'; width?: number },
  ): PixelText {
    const t = new PixelText(this.scene, x, y, s, { color: o.color ?? 'night', align: o.align });
    this.root.add(t.root);
    this.texts.push(t);
    return t;
  }

  private placeRight(t: PixelText, y: number): void {
    t.setPosition(W - 20 - t.width, y);
  }

  input(pressed: number): void {
    if (!this.ready) {
      // 还在播放动画：按确认直接跳到最后
      if (pressed & (BTN.jump | BTN.confirm)) this.skip();
      return;
    }
    const n = this.buttons.length;
    if (pressed & (BTN.left | BTN.up)) {
      this.focus = (this.focus + n - 1) % n;
      this.sfx('move');
    }
    if (pressed & (BTN.right | BTN.down)) {
      this.focus = (this.focus + 1) % n;
      this.sfx('move');
    }
    if (pressed & (BTN.jump | BTN.confirm)) {
      this.sfx('confirm');
      const b = this.buttons[this.focus]!;
      this.scene.tweens.add({ targets: b.bg, scaleX: 0.92, scaleY: 0.9, duration: 60, yoyo: true });
      this.ready = false;
      this.scene.time.delayedCall(140, () => this.onChoose(this.focus));
    }
  }

  private skip(): void {
    this.stage = 99;
    this.timeText.setText(formatTime(this.data.frames));
    this.placeRight(this.timeText, 34);
    this.shownShells = this.data.shells;
    this.shellText.setText(String(this.data.shells));
    this.placeRight(this.shellText, 54);
    for (let i = 0; i < 3; i++) this.fillSlot(i, false);
    this.showBadges(false);
    this.ready = true;
  }

  private fillSlot(i: number, animate: boolean): void {
    const found = this.data.glass[i] || this.data.ghost[i];
    if (!found) return;
    const img = this.slots[i]!;
    img.setFrame(`item/glass_${GLASS_COLORS[i]}_0`).setAlpha(this.data.glass[i] ? 1 : 0.4);
    if (animate) {
      this.slotSprings[i]!.set(2.2);
      this.sfx('pop');
    }
  }

  private showBadges(animate: boolean): void {
    if (this.data.newRecord && !this.stamp) {
      this.stamp = this.makeStamp(UI_TEXT.newRecord, 'red2', W - 44, 106);
      if (animate) {
        this.stampSpring.set(2.4);
        this.sfx('stamp');
      }
    }
    if (this.data.noDamage && !this.badge) {
      this.badge = this.makeStamp(UI_TEXT.noDamage, 'leaf1', 34, 108);
      if (animate) this.sfx('stamp');
    }
  }

  private makeStamp(
    label: string,
    color: 'red2' | 'leaf1',
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    const t = new PixelText(this.scene, 0, 0, label, { color });
    const g = this.scene.add.graphics();
    const col = color === 'red2' ? 0xff5a4f : 0x2e8a4f;
    g.lineStyle(1, col, 1);
    g.strokeRect(-t.width / 2 - 4.5, -8.5, t.width + 9, 17);
    t.setPosition(-Math.round(t.width / 2), -7);
    c.add([g, t.root]);
    c.setAngle(-8);
    this.texts.push(t);
    this.root.add(c);
    return c;
  }

  update(dt: number): void {
    this.time += dt;
    for (const t of this.texts) t.update(dt);
    // 分阶段播放
    this.stageTimer -= dt;
    if (this.stage < 99 && this.stageTimer <= 0) {
      if (this.stage === 0 && this.time > 0.45) {
        this.stage = 1;
      } else if (this.stage === 1) {
        const k = Math.min(1, (this.time - 0.45) / 0.6);
        this.timeText.setText(formatTime(Math.round(this.data.frames * k)));
        this.placeRight(this.timeText, 34);
        if (Math.floor(this.time * 30) % 2 === 0) this.sfx('tick');
        if (k >= 1) {
          this.stage = 2;
          this.stageTimer = (STAGGER * 4) / 1000;
        }
      } else if (this.stage === 2) {
        const step = Math.max(1, Math.ceil(this.data.shells / 30));
        this.shownShells = Math.min(this.data.shells, this.shownShells + step);
        this.shellText.setText(String(this.shownShells));
        this.placeRight(this.shellText, 54);
        this.sfx('tick');
        this.stageTimer = 0.03;
        if (this.shownShells >= this.data.shells) {
          this.stage = 3;
          this.stageTimer = 0.2;
        }
      } else if (this.stage === 3) {
        while (
          this.glassIndex < 3 &&
          !(this.data.glass[this.glassIndex] || this.data.ghost[this.glassIndex])
        )
          this.glassIndex++;
        if (this.glassIndex < 3) {
          this.fillSlot(this.glassIndex, true);
          this.glassIndex++;
          this.stageTimer = 0.18;
        } else {
          this.stage = 4;
          this.stageTimer = 0.15;
        }
      } else if (this.stage === 4) {
        this.showBadges(true);
        this.stage = 99;
        this.ready = true;
      }
    }
    this.slots.forEach((s, i) => s.setScale(this.slotSprings[i]!.update(dt)));
    if (this.stamp) this.stamp.setScale(this.stampSpring.update(dt));
    // 焦点框：在按钮外面一圈金色描边，轻轻呼吸
    const g = this.focusFrame;
    g.clear();
    if (this.ready || this.stage === 99) {
      const b = this.buttons[this.focus];
      if (b) {
        const pad = 2 + (Math.sin(this.time * 6) > 0 ? 1 : 0);
        g.lineStyle(1, 0xffc93c, 1);
        g.strokeRect(
          b.bg.x - pad + 0.5,
          b.bg.y - pad + 0.5,
          b.bg.width - 2 + pad * 2,
          b.bg.height - 2 + pad * 2,
        );
      }
    }
  }

  destroy(): void {
    for (const t of this.texts) t.destroy();
    this.root.destroy();
  }
}
