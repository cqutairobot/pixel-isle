import type Phaser from 'phaser';
import { colorInt, type ColorName } from '../art/palette';
import { BTN } from '../sim/input';
import { Spring } from '../view/spring';
import { ATLAS } from '../view/textures';
import { PixelText } from './text/pixelText';

export interface MenuItem {
  label: string;
  /** 右侧显示的值（开 / 关、标准 / 弱 / 关……） */
  value?: () => string;
  /** 右侧显示的音量格（0–1） */
  bar?: () => number;
  /** ← → 调整 */
  change?: (dir: -1 | 1) => void;
  select?: () => void;
  hidden?: boolean;
}

export type MenuSound = 'move' | 'confirm' | 'back' | 'change';

export interface MenuOptions {
  /** 每行高度 */
  rowH?: number;
  /** 值（或音量格）右对齐到的 x */
  width?: number;
  color?: ColorName;
  focusColor?: ColorName;
  /** 按返回键（J / Esc） */
  back?: () => void;
  sfx?: (s: MenuSound) => void;
}

/**
 * 竖排菜单：各项依次滑入，焦点处的小铃铛用弹簧滑到所选的行并轻轻摆动，选中时回弹；
 * ↑↓ 选择、确认键选中、← → 调整数值、返回键退出。
 */
export class Menu {
  readonly root: Phaser.GameObjects.Container;
  private rows: Array<{
    item: MenuItem;
    label: PixelText;
    value: PixelText | null;
    bar: Phaser.GameObjects.Graphics | null;
    y: number;
    enter: number;
  }> = [];
  private cursor: Phaser.GameObjects.Image;
  private cursorY: Spring;
  private press = new Spring(1, 600, 14);
  private time = 0;
  focus = 0;
  enabled = true;
  private o: Required<Omit<MenuOptions, 'back' | 'sfx'>> & Pick<MenuOptions, 'back' | 'sfx'>;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    items: MenuItem[],
    o: MenuOptions = {},
  ) {
    this.o = {
      rowH: o.rowH ?? 16,
      width: o.width ?? 160,
      color: o.color ?? 'night',
      focusColor: o.focusColor ?? 'red1',
      back: o.back,
      sfx: o.sfx,
    };
    this.root = scene.add.container(x, y);
    let row = 0;
    for (const item of items) {
      if (item.hidden) continue;
      const ry = row * this.o.rowH;
      const label = new PixelText(scene, 12, ry, item.label, { color: this.o.color });
      const value = item.value
        ? new PixelText(scene, 0, ry, item.value(), { color: this.o.color })
        : null;
      const bar = item.bar ? scene.add.graphics() : null;
      this.root.add(label.root);
      if (value) this.root.add(value.root);
      if (bar) this.root.add(bar);
      this.rows.push({ item, label, value, bar, y: ry, enter: -row * 0.05 });
      row++;
    }
    this.cursor = scene.add.image(0, 3, ATLAS, 'ui/cursor').setOrigin(0, 0);
    this.root.add(this.cursor);
    this.cursorY = new Spring(0, 700, 22);
    this.refresh();
  }

  get height(): number {
    return this.rows.length * this.o.rowH;
  }

  /** 数值变了之后刷新右侧的显示 */
  refresh(): void {
    for (const r of this.rows) {
      if (r.value && r.item.value) {
        r.value.setText(`◀ ${r.item.value()} ▶`);
        r.value.setPosition(this.o.width - r.value.width, r.y);
      }
      if (r.bar && r.item.bar) {
        const v = Math.round(r.item.bar() * 10);
        const g = r.bar;
        g.clear();
        const x0 = this.o.width - 10 * 5 + 1;
        for (let i = 0; i < 10; i++) {
          g.fillStyle(colorInt('night'), 1).fillRect(x0 + i * 5, r.y + 3, 4, 8);
          g.fillStyle(colorInt(i < v ? 'gold' : 'sand3'), 1).fillRect(
            x0 + i * 5 + 1,
            r.y + 4,
            2,
            6,
          );
        }
      }
    }
  }

  input(pressed: number): void {
    if (!this.enabled || !this.rows.length) return;
    const n = this.rows.length;
    if (pressed & BTN.up) {
      this.focus = (this.focus + n - 1) % n;
      this.o.sfx?.('move');
    } else if (pressed & BTN.down) {
      this.focus = (this.focus + 1) % n;
      this.o.sfx?.('move');
    }
    const item = this.rows[this.focus]!.item;
    if (item.change && pressed & (BTN.left | BTN.right)) {
      item.change(pressed & BTN.left ? -1 : 1);
      this.o.sfx?.('change');
      this.refresh();
    } else if (pressed & (BTN.jump | BTN.confirm)) {
      if (item.select) {
        this.press.set(0.85);
        this.o.sfx?.('confirm');
        item.select();
      } else if (item.change) {
        item.change(1);
        this.o.sfx?.('change');
        this.refresh();
      }
    } else if (pressed & (BTN.attack | BTN.cancel) && this.o.back) {
      this.o.sfx?.('back');
      this.o.back();
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.cursorY.target = this.rows[this.focus]?.y ?? 0;
    const cy = this.cursorY.update(dt);
    const swing = Math.sin(this.time * 6) * 0.25;
    this.cursor.setPosition(0, Math.round(cy + 3)).setRotation(swing * 0.4);
    const pk = this.press.update(dt);
    this.rows.forEach((r, i) => {
      r.enter = Math.min(1, r.enter + dt / 0.22);
      const k = Math.max(0, r.enter);
      const off = Math.round((1 - k) * (1 - k) * 24);
      const focused = i === this.focus;
      r.label.setColor(focused ? this.o.focusColor : this.o.color);
      r.label.setPosition(12 + off + (focused ? 2 : 0), r.y);
      r.label.root.setAlpha(k).setScale(focused ? pk : 1);
      r.value?.setColor(focused ? this.o.focusColor : this.o.color).setAlpha(k);
      r.bar?.setAlpha(k);
      r.label.update(dt);
    });
  }

  destroy(): void {
    for (const r of this.rows) {
      r.label.destroy();
      r.value?.destroy();
    }
    this.root.destroy();
  }
}
