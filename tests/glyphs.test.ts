import { describe, expect, it } from 'vitest';
import { readWoff } from '../scripts/lib/woff';
import { allText } from '../src/content/allText';
import {
  ADOU_SOLVED,
  BAILU_MEET,
  BELLTOWER,
  INTRO,
  NPC_TALK,
  PROLOGUE,
} from '../src/content/dialog/1-1';
import { MAP_CHATTER, NPC_TALK_12, STARFISH_OPENING } from '../src/content/dialog/1-2';
import { EQUIPMENT } from '../src/content/equipment';
import { MAP_NODES } from '../src/content/map';
import { HINTS, KEY_HINTS, MAP_TEXT, UI_TEXT } from '../src/content/text';
import { DIALOG_MAX_LINES, DIALOG_TEXT_W, NARRATOR_TEXT_W } from '../src/ui/dialogBox';
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

  it(`对话框：每句最多 ${DIALOG_MAX_LINES} 行`, () => {
    const all = [
      ...Object.values(NPC_TALK).flatMap((n) => [...n.first, ...n.again, ...(n.after ?? [])]),
      ...INTRO,
      ...BELLTOWER.flat(),
      ...BAILU_MEET,
      ...PROLOGUE.flat(),
    ];
    for (const l of all) {
      const w = l.who === 'narrator' ? NARRATOR_TEXT_W : DIALOG_TEXT_W;
      expect(lines(l.text, w), l.text).toBeLessThanOrEqual(DIALOG_MAX_LINES);
    }
    // 阿豆解开风铃时说的话用提示气泡（宽 150）
    for (const l of ADOU_SOLVED) expect(lines(l.text, 150), l.text).toBeLessThanOrEqual(3);
  });

  it('地图卡片："正在制作中"一行放得下（宽 180），关卡名不超出卡片', () => {
    expect(lines(MAP_TEXT.soon, 180)).toBe(1);
    for (const n of MAP_NODES) expect(lines(`${n.id} ${n.name}`, 186), n.name).toBe(1);
  });

  it('1-2 的对白、地图闲聊不超出对话框；获得道具横幅的用法一行放得下', () => {
    const all = [
      ...STARFISH_OPENING.flat(),
      ...Object.values(NPC_TALK_12).flatMap((n) => [...n.first, ...n.again]),
    ];
    for (const l of all)
      expect(lines(l.text, DIALOG_TEXT_W), l.text).toBeLessThanOrEqual(DIALOG_MAX_LINES);
    for (const l of Object.values(MAP_CHATTER).flat())
      expect(lines(l.text, 150), l.text).toBeLessThanOrEqual(3);
    for (const e of Object.values(EQUIPMENT))
      for (const u of Object.values(e.usage)) expect(lines(u, 236), u).toBe(1);
  });
});
