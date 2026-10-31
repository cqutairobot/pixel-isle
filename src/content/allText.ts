import { allDialogText } from './dialog/1-1';
import { LEVELS } from './levels';
import { speakerNames } from './speakers';
import { CONTROLS_TEXT, CREDITS, HINTS, KEY_HINTS, MENU_TEXT, UI_TEXT } from './text';

/** 可打印的 ASCII（数字、字母、常用符号），按键提示和数字都会用到 */
const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');

/** 额外会出现的符号（方向键、手柄按钮等） */
const SYMBOLS = '←→↑↓·…—～「」《》（）！？，。、：；“”‘’①②③◀▶';

/** 游戏里会显示的全部文字（带标签的原文），用来生成字库与做缺字检查 */
export function allText(): string[] {
  return [
    ...Object.values(UI_TEXT),
    ...Object.values(KEY_HINTS),
    ...Object.values(HINTS),
    ...Object.values(MENU_TEXT),
    ...CONTROLS_TEXT,
    ...CREDITS.flat(),
    ...Object.values(LEVELS).map((l) => l.name),
    ...allDialogText(),
    ...speakerNames(),
    ASCII,
    SYMBOLS,
  ];
}
