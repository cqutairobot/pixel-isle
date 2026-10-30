/**
 * 文字排版（纯逻辑，可以在 Node 里测试）：解析文字标签、按字宽换行、中文避头尾。
 * 标签见 PLAN §5.10：{color=gold}…{/color}、{wave}…{/wave}、{shake}…{/shake}、
 * {speed=0.5}…{/speed}、{pause=300}。
 */

export interface StyledChar {
  ch: string;
  /** 调色板颜色名；null 用文本框的默认色 */
  color: string | null;
  wave: boolean;
  shake: boolean;
  /** 打字速度倍数 */
  speed: number;
  /** 打出这个字之后额外停顿（毫秒），来自 {pause=…} 标签 */
  pause: number;
}

/** 行首不能出现的标点 */
export const NO_LINE_START = '，。！？、；：」』）》〉】〕｝…—～·%,.!?;:)]}’”';
/** 行尾不能出现的标点 */
export const NO_LINE_END = '（「『《〈【〔｛([{‘“';

const TAG = /\{(\/?)(color|wave|shake|speed|pause)(?:=([^}]*))?\}/y;

export function parseRich(text: string): StyledChar[] {
  const out: StyledChar[] = [];
  const colors: string[] = [];
  const speeds: number[] = [];
  let wave = 0;
  let shake = 0;
  let pendingPause = 0;
  let i = 0;
  while (i < text.length) {
    TAG.lastIndex = i;
    const m = TAG.exec(text);
    if (m) {
      const [, close, name, arg] = m;
      if (name === 'pause') {
        const ms = Number(arg ?? 300);
        if (out.length) out[out.length - 1]!.pause += ms;
        else pendingPause += ms;
      } else if (name === 'color') {
        if (close) colors.pop();
        else colors.push(arg ?? 'gold');
      } else if (name === 'speed') {
        if (close) speeds.pop();
        else speeds.push(Number(arg ?? 1));
      } else if (name === 'wave') wave += close ? -1 : 1;
      else if (name === 'shake') shake += close ? -1 : 1;
      i = TAG.lastIndex;
      continue;
    }
    const cp = text.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    out.push({
      ch,
      color: colors.at(-1) ?? null,
      wave: wave > 0,
      shake: shake > 0,
      speed: speeds.at(-1) ?? 1,
      pause: pendingPause,
    });
    pendingPause = 0;
    i += ch.length;
  }
  return out;
}

/** 去掉标签后的纯文字（缺字检查、测量用） */
export function plainText(text: string): string {
  return parseRich(text)
    .map((c) => c.ch)
    .join('');
}

const isLatinWord = (ch: string) => /[A-Za-z0-9_'’\-]/.test(ch);

/**
 * 按最大宽度换行。中文可以在任意两个字之间断开，但遵守避头尾；
 * 英文单词和数字不拆开（单词本身比一行还长时才硬断）。"\n" 强制换行。
 */
export function wrapChars(
  chars: StyledChar[],
  maxWidth: number,
  advance: (ch: string) => number,
): StyledChar[][] {
  const lines: StyledChar[][] = [];
  let line: StyledChar[] = [];
  let width = 0;
  const push = () => {
    // 行尾的空格不占位
    while (line.length && line[line.length - 1]!.ch === ' ') line.pop();
    lines.push(line);
    line = [];
    width = 0;
  };
  let i = 0;
  while (i < chars.length) {
    const c = chars[i]!;
    if (c.ch === '\n') {
      push();
      i++;
      continue;
    }
    // 取一个不可拆分的单元：英文单词、连续的省略号/破折号，或者单个字
    let j = i + 1;
    if (isLatinWord(c.ch)) while (j < chars.length && isLatinWord(chars[j]!.ch)) j++;
    else if (c.ch === '…' || c.ch === '—') while (j < chars.length && chars[j]!.ch === c.ch) j++;
    const unit = chars.slice(i, j);
    const unitW = unit.reduce((s, u) => s + advance(u.ch), 0);
    if (width + unitW > maxWidth && line.length > 0) {
      if (NO_LINE_START.includes(unit[0]!.ch)) {
        // 避头：把上一行最后一个字带到下一行（最多带两个），标点跟着它走
        const carry: StyledChar[] = [];
        while (carry.length < 2 && line.length > 1 && NO_LINE_START.includes(unit[0]!.ch)) {
          carry.unshift(line.pop()!);
          if (!NO_LINE_START.includes(carry[0]!.ch)) break;
        }
        push();
        line.push(...carry);
        width = carry.reduce((s, u) => s + advance(u.ch), 0);
      } else if (NO_LINE_END.includes(line[line.length - 1]!.ch)) {
        // 避尾：行尾的开括号挪到下一行
        const open = line.pop()!;
        push();
        line.push(open);
        width = advance(open.ch);
      } else {
        push();
      }
      if (unit[0]!.ch === ' ' && line.length === 0) {
        i = j;
        continue;
      }
    }
    if (unitW > maxWidth && line.length === 0) {
      // 一个单元比整行还宽：硬断
      for (const u of unit) {
        const w = advance(u.ch);
        if (width + w > maxWidth && line.length) push();
        line.push(u);
        width += w;
      }
      i = j;
      continue;
    }
    line.push(...unit);
    width += unitW;
    i = j;
  }
  if (line.length || lines.length === 0) push();
  return lines;
}

export function lineWidth(line: StyledChar[], advance: (ch: string) => number): number {
  return line.reduce((s, c) => s + advance(c.ch), 0);
}

/**
 * 打字机节奏（PLAN §6.10）：约 40 字/秒；逗号停 150ms，句号、叹号、问号停 300ms，省略号停 500ms。
 * 返回打出这个字之后要等多少毫秒。
 */
export function typeDelay(c: StyledChar, next: StyledChar | undefined): number {
  const base = 25 / c.speed;
  let extra = c.pause;
  // 连续的标点只在最后一个停顿
  const nextIsSame = next && next.ch === c.ch;
  if (!nextIsSame) {
    if ('，、,；;：:'.includes(c.ch)) extra += 150;
    else if ('。！？!?'.includes(c.ch)) extra += 300;
    else if (c.ch === '…' || c.ch === '—') extra += 500;
  }
  return base + extra;
}
