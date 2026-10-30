import { blockSheet } from './blocks';
import { decoSheet } from './deco';
import { enemySheet } from './enemies';
import { fxSheet } from './fx';
import { fx2Sheet } from './fx2';
import { heroSheet } from './hero';
import { itemSheet } from './items';
import { npcSheet } from './npcs';
import type { ImageSheet } from './paint';
import { propSheet } from './props';
import { uiSheet } from './ui';
import { waterSheet } from './water';
import { rasterize, type RGBAImage, type Sheet } from './sprite';

/** 所有用字符网格绘制的精灵表 */
export const allSheets: Sheet[] = [heroSheet, propSheet, fxSheet, blockSheet, itemSheet];

/** 所有用 Paint 画出来的精灵表（帧尺寸可以不同） */
export const allImageSheets: ImageSheet[] = [
  enemySheet,
  waterSheet,
  fx2Sheet,
  npcSheet,
  decoSheet,
  uiSheet,
];

/** 全部帧：名字形如 hero/run_3 */
export function allFrames(): Array<{ name: string; img: RGBAImage }> {
  const out: Array<{ name: string; img: RGBAImage }> = [];
  for (const sheet of allSheets) {
    for (const [frame, g] of Object.entries(sheet.frames)) {
      out.push({
        name: `${sheet.key}/${frame}`,
        img: rasterize(g, sheet.keys, `${sheet.key}/${frame}`),
      });
    }
  }
  for (const sheet of allImageSheets) {
    for (const [frame, img] of Object.entries(sheet.frames))
      out.push({ name: `${sheet.key}/${frame}`, img });
  }
  return out;
}
