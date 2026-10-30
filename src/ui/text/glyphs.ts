import type Phaser from 'phaser';

/** 界面字体（OFL-1.1），见 PLAN §2.8 */
export const UI_FONT = 'Fusion Pixel 12px Proportional SC';
export const FONT_PX = 12;
/** 行高：12px 字 + 2px 行距 */
export const LINE_HEIGHT = 14;
export const GLYPH_TEX = 'glyphs';
/** 每个字在图集里占的格子 */
const CELL = 16;

const isWide = (ch: string) => /[⺀-鿿豈-﫿＀-￯　-〿…—]/.test(ch);

/**
 * 运行时字库：游戏启动时把要用到的每个字用像素字体画一遍，阈值化去掉抗锯齿，
 * 打包成一张白色字形图集。显示时每个字一个精灵、按需着色，任意整数倍放大都锐利。
 */
export class GlyphAtlas {
  private adv = new Map<string, number>();
  private known = new Set<string>();
  /** 基线离格子顶部的距离 */
  baseline = 10;
  built = false;

  /** 生成图集。text 是要用到的全部文字（重复的字会自动去掉） */
  build(scene: Phaser.Scene, text: string): void {
    const chars = Array.from(new Set(Array.from(text + ' ?'))).filter((c) => c !== '\n');
    const perRow = 32;
    const rows = Math.ceil(chars.length / perRow);
    const canvas = document.createElement('canvas');
    canvas.width = perRow * CELL;
    canvas.height = rows * CELL;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.font = `${FONT_PX}px "${UI_FONT}"`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    const m = ctx.measureText('国');
    const ascent = Math.round(m.fontBoundingBoxAscent || m.actualBoundingBoxAscent || 10);
    this.baseline = Math.min(CELL - 2, Math.max(8, ascent));
    chars.forEach((ch, i) => {
      const x = (i % perRow) * CELL;
      const y = Math.floor(i / perRow) * CELL;
      ctx.fillText(ch, x, y + this.baseline);
      const w = Math.round(ctx.measureText(ch).width);
      this.adv.set(ch, w > 0 ? w : isWide(ch) ? FONT_PX : 6);
    });
    // 阈值化：半透明的边缘像素要么全有、要么全无
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const on = d[i + 3]! >= 110;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = on ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
    if (scene.textures.exists(GLYPH_TEX)) scene.textures.remove(GLYPH_TEX);
    const tex = scene.textures.addCanvas(GLYPH_TEX, canvas)!;
    chars.forEach((ch, i) => {
      tex.add(
        String(ch.codePointAt(0)),
        0,
        (i % perRow) * CELL,
        Math.floor(i / perRow) * CELL,
        CELL,
        CELL,
      );
      this.known.add(ch);
    });
    this.built = true;
  }

  advance(ch: string): number {
    return this.adv.get(ch) ?? (isWide(ch) ? FONT_PX : 6);
  }

  has(ch: string): boolean {
    return this.known.has(ch);
  }

  /** 字形帧名；没收录的字用"?"代替（开发时会在控制台提示） */
  frame(ch: string): string {
    if (this.known.has(ch)) return String(ch.codePointAt(0));
    if (import.meta.env?.DEV) console.warn(`字库里没有"${ch}"，请把它加进 src/content`);
    return String('?'.codePointAt(0));
  }
}

export const glyphs = new GlyphAtlas();
