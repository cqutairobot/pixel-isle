import type Phaser from 'phaser';
import { colorInt, type ColorName } from '../../art/palette';
import { GLYPH_TEX, glyphs, LINE_HEIGHT } from './glyphs';
import { lineWidth, parseRich, typeDelay, wrapChars, type StyledChar } from './layout';

export interface PixelTextOptions {
  /** 超过这个宽度自动换行（游戏像素）；不写就不换行 */
  maxWidth?: number;
  color?: ColorName;
  /** 1px 阴影的颜色；null 不要阴影 */
  shadow?: ColorName | null;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
}

interface Placed {
  c: StyledChar;
  x: number;
  y: number;
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image | null;
}

/**
 * 像素文字：每个字一个精灵（白色字形按需着色），支持变色、波浪、抖动、打字机逐字显示。
 * 坐标原点在文字块左上角。
 */
export class PixelText {
  readonly root: Phaser.GameObjects.Container;
  private placed: Placed[] = [];
  private time = 0;
  private opts: Required<PixelTextOptions>;
  width = 0;
  height = 0;
  /** 已经显示出来的字数（打字机） */
  shown = Infinity;
  private typeTimer = 0;
  /** 打字机每打出一个字时回调（播放说话音） */
  onType?: (c: StyledChar, index: number) => void;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    text = '',
    opts: PixelTextOptions = {},
  ) {
    this.opts = {
      maxWidth: opts.maxWidth ?? 10000,
      color: opts.color ?? 'night',
      shadow: opts.shadow === undefined ? null : opts.shadow,
      align: opts.align ?? 'left',
      lineHeight: opts.lineHeight ?? LINE_HEIGHT,
    };
    this.root = scene.add.container(x, y);
    if (text) this.setText(text);
  }

  get length(): number {
    return this.placed.length;
  }

  get done(): boolean {
    return this.shown >= this.placed.length;
  }

  setColor(c: ColorName): this {
    this.opts.color = c;
    for (const p of this.placed) if (!p.c.color) p.img.setTint(colorInt(c));
    return this;
  }

  setText(text: string): this {
    for (const p of this.placed) {
      p.img.destroy();
      p.shadow?.destroy();
    }
    this.placed = [];
    const adv = (ch: string) => glyphs.advance(ch);
    const lines = wrapChars(parseRich(text), this.opts.maxWidth, adv);
    const widths = lines.map((l) => lineWidth(l, adv));
    this.width = Math.max(0, ...widths);
    this.height = lines.length * this.opts.lineHeight;
    lines.forEach((line, li) => {
      let x =
        this.opts.align === 'center'
          ? Math.floor((this.width - widths[li]!) / 2)
          : this.opts.align === 'right'
            ? this.width - widths[li]!
            : 0;
      const y = li * this.opts.lineHeight;
      for (const c of line) {
        if (c.ch !== ' ') {
          const frame = glyphs.frame(c.ch);
          const color = colorInt((c.color as ColorName) ?? this.opts.color);
          const shadow = this.opts.shadow
            ? this.scene.add
                .image(x, y + 1, GLYPH_TEX, frame)
                .setOrigin(0, 0)
                .setTint(colorInt(this.opts.shadow))
            : null;
          const img = this.scene.add.image(x, y, GLYPH_TEX, frame).setOrigin(0, 0).setTint(color);
          if (shadow) this.root.add(shadow);
          this.root.add(img);
          this.placed.push({ c, x, y, img, shadow });
        }
        x += adv(c.ch);
      }
    });
    this.applyVisibility();
    return this;
  }

  /** 开始打字机效果（从第 0 个字开始逐字显示） */
  type(): this {
    this.shown = 0;
    this.typeTimer = 0;
    this.applyVisibility();
    return this;
  }

  /** 立即显示全部 */
  finish(): this {
    this.shown = Infinity;
    this.applyVisibility();
    return this;
  }

  private applyVisibility(): void {
    this.placed.forEach((p, i) => {
      const v = i < this.shown;
      p.img.setVisible(v);
      p.shadow?.setVisible(v);
    });
  }

  update(dt: number): void {
    this.time += dt;
    // 打字机
    if (this.shown < this.placed.length) {
      this.typeTimer -= dt * 1000;
      while (this.typeTimer <= 0 && this.shown < this.placed.length) {
        const p = this.placed[this.shown]!;
        this.onType?.(p.c, this.shown);
        this.typeTimer += typeDelay(p.c, this.placed[this.shown + 1]?.c);
        this.shown++;
      }
      this.applyVisibility();
    }
    // 逐字特效
    this.placed.forEach((p, i) => {
      let dx = 0;
      let dy = 0;
      if (p.c.wave) dy = Math.round(Math.sin(this.time * 7 + i * 0.7) * 1.4);
      if (p.c.shake) {
        const k = Math.floor(this.time * 30) + i * 7;
        dx = ((k * 7919) % 3) - 1;
        dy += ((k * 104729) % 3) - 1;
      }
      p.img.setPosition(p.x + dx, p.y + dy);
      p.shadow?.setPosition(p.x + dx, p.y + dy + 1);
    });
  }

  setPosition(x: number, y: number): this {
    this.root.setPosition(x, y);
    return this;
  }

  setAlpha(a: number): this {
    this.root.setAlpha(a);
    return this;
  }

  setVisible(v: boolean): this {
    this.root.setVisible(v);
    return this;
  }

  setDepth(d: number): this {
    this.root.setDepth(d);
    return this;
  }

  destroy(): void {
    this.root.destroy();
    this.placed = [];
  }
}

/** 测量一段文字排版后的尺寸（不创建精灵） */
export function measureText(
  text: string,
  maxWidth = 10000,
  lineHeight = LINE_HEIGHT,
): { w: number; h: number } {
  const adv = (ch: string) => glyphs.advance(ch);
  const lines = wrapChars(parseRich(text), maxWidth, adv);
  return { w: Math.max(0, ...lines.map((l) => lineWidth(l, adv))), h: lines.length * lineHeight };
}
