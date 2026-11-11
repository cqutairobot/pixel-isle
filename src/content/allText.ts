import { allDialogText } from './dialog/1-1';
import { allDialogText12 } from './dialog/1-2';
import { allDialogText13 } from './dialog/1-3';
import { allShopText } from './dialog/shop';
import { COMPANIONS, EQUIPMENT } from './equipment';
import { MAP_NODES } from './map';
import { OUTFITS } from './outfits';
import { SHOP_ITEMS } from './shop';
import { LEVELS } from './levels';
import { speakerNames } from './speakers';
import {
  CONTROLS_TEXT,
  CREDITS,
  HINTS,
  KEY_HINTS,
  MAP_TEXT,
  MENU_TEXT,
  SHOP_TEXT,
  UI_TEXT,
} from './text';

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
    ...Object.values(MAP_TEXT),
    ...Object.values(SHOP_TEXT),
    ...SHOP_ITEMS.map((i) => i.name),
    ...OUTFITS.map((o) => o.name),
    ...MAP_NODES.map((n) => n.name),
    ...Object.values(EQUIPMENT).flatMap((e) => [e.name, ...Object.values(e.usage)]),
    ...Object.values(COMPANIONS).flatMap((e) => [e.name, e.head, ...Object.values(e.usage)]),
    ...CONTROLS_TEXT,
    ...CREDITS.flat(),
    ...Object.values(LEVELS).map((l) => l.name),
    ...allDialogText(),
    ...allDialogText12(),
    ...allDialogText13(),
    ...allShopText(),
    ...speakerNames(),
    ASCII,
    SYMBOLS,
  ];
}
