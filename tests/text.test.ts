import { describe, expect, it } from 'vitest';
import { lineWidth, parseRich, plainText, typeDelay, wrapChars } from '../src/ui/text/layout';

/** 测试用字宽：中文 12，英文和数字 6，空格 4 */
const adv = (ch: string) => (/[　-鿿＀-￯…—“”‘’]/.test(ch) ? 12 : ch === ' ' ? 4 : 6);
const wrap = (s: string, w: number) =>
  wrapChars(parseRich(s), w, adv).map((l) => l.map((c) => c.ch).join(''));

describe('文字标签', () => {
  it('解析颜色、波浪、停顿，纯文字里不含标签', () => {
    const chars = parseRich('早安歌是{color=gold}大、小{/color}！{pause=200}{wave}哇{/wave}');
    expect(plainText('早安歌是{color=gold}大、小{/color}！')).toBe('早安歌是大、小！');
    expect(chars.find((c) => c.ch === '大')!.color).toBe('gold');
    expect(chars.find((c) => c.ch === '！')!.color).toBeNull();
    expect(chars.find((c) => c.ch === '！')!.pause).toBe(200);
    expect(chars.find((c) => c.ch === '哇')!.wave).toBe(true);
  });
});

describe('换行与避头尾', () => {
  it('按宽度换行，每行不超过最大宽度', () => {
    const lines = wrapChars(
      parseRich('小满早啊！今天大钟一声都没响，村里的鸡都不知道该不该打鸣了。'),
      120,
      adv,
    );
    for (const l of lines) expect(lineWidth(l, adv)).toBeLessThanOrEqual(120);
    expect(lines.length).toBeGreaterThan(2);
  });

  it('标点不出现在行首：把前一个字一起带到下一行', () => {
    // 10 个字宽正好到"响"，下一个是"，"
    const lines = wrap('今天大钟一声都没有响，村里', 120);
    for (const l of lines) expect('，。！？、'.includes(l[0]!)).toBe(false);
    expect(lines[1]!.startsWith('响，')).toBe(true);
  });

  it('开括号不留在行尾', () => {
    const lines = wrap('一二三四五六七八九「十」', 120);
    for (const l of lines) expect(l.endsWith('「')).toBe(false);
  });

  it('省略号成对不拆开；英文单词不拆开', () => {
    const lines = wrap('一二三四五六七八九……好', 120);
    expect(lines.some((l) => l.includes('……'))).toBe(true);
    // hello(30) + 空格(4) + world(30) = 64 > 60
    const en = wrap('hello world pixel isle', 60);
    expect(en).toEqual(['hello', 'world', 'pixel isle']);
  });

  it('换行符强制换行', () => {
    expect(wrap('第一行\n第二行', 300)).toEqual(['第一行', '第二行']);
  });
});

describe('打字机节奏', () => {
  it('句号停得比逗号久，省略号最久；连续标点只停一次', () => {
    const cs = parseRich('好，好。好……');
    const d = cs.map((c, i) => typeDelay(c, cs[i + 1]));
    expect(d[1]).toBeGreaterThan(d[0]!);
    expect(d[3]).toBeGreaterThan(d[1]!);
    expect(d[5]).toBeLessThan(d[6]!);
    expect(d[6]).toBeGreaterThan(d[3]!);
  });
});
