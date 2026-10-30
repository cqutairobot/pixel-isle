import { describe, expect, it } from 'vitest';
import { readWoff } from '../scripts/lib/woff';
import { allText } from '../src/content/allText';
import { HINTS, KEY_HINTS, UI_TEXT } from '../src/content/text';
import { parseRich, plainText, wrapChars } from '../src/ui/text/layout';

const FONT =
  'node_modules/@fontsource/fusion-pixel-12px-proportional-sc/files/fusion-pixel-12px-proportional-sc-latin-400-normal.woff';
const font = readWoff(FONT);
/** 12px 下的真实字宽 */
const advance = (ch: string) => {
  const g = font.cmap.get(ch.codePointAt(0)!) ?? 0;
  return Math.round((font.advanceOf(g) * 12) / font.unitsPerEm);
};
const lines = (text: string, width: number) => wrapChars(parseRich(text), width, advance).length;

describe('字体覆盖', () => {
  it('游戏里显示的每个字都在像素字体里', () => {
    const missing = new Set<string>();
    for (const t of allText()) {
      for (const ch of plainText(t)) {
        if (ch === '\n') continue;
        if (!font.cmap.has(ch.codePointAt(0)!)) missing.add(ch);
      }
    }
    expect([...missing].join('')).toBe('');
  });

  it('中文字宽 12px，数字比中文窄', () => {
    expect(advance('海')).toBe(12);
    expect(advance('1')).toBeLessThan(12);
  });
});

describe('文本不超出文本框', () => {
  it('回回的提示气泡（宽 150）最多 3 行', () => {
    for (const [k, t] of Object.entries(HINTS)) expect(lines(t, 150), k).toBeLessThanOrEqual(3);
  });

  it('按键提示、提示条都是一行', () => {
    for (const t of Object.values(KEY_HINTS)) expect(lines(t, 220), t).toBe(1);
    for (const k of ['checkpoint', 'glassFound', 'glassAgain', 'sunFruit', 'tallyTitle'] as const)
      expect(lines(UI_TEXT[k], 200), k).toBe(1);
  });

  it('"制作中"卡片最多 2 行（宽 280）', () => {
    expect(lines(UI_TEXT.comingSoon, 280)).toBeLessThanOrEqual(2);
  });
});
