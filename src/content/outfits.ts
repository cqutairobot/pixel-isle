import type { ColorName } from '../art/palette';
import { DEFAULT_OUTFIT, type SaveData } from '../platform/save';

/**
 * 换装（docs/levels/1-3.md §5）：在大暑的冰沙摊买布料，解锁小满的一套换色。
 * 只换帽带（颜色键 r / R）、上衣（w / W）、裙子（t / T），帽子上的飘带跟着帽带换色；
 * 小满所有的帧（包括骑咩铃、摸咩铃）都用同一套像素网格，换一组颜色键重新生成一张精灵表。
 */

export type OutfitId = 'default' | 'blue' | 'lime' | 'dusk';

/** 换装时会换掉的颜色键：帽带亮 / 暗、上衣亮 / 暗、裙子亮 / 暗 */
export type OutfitKey = 'r' | 'R' | 'w' | 'W' | 't' | 'T';

export interface Outfit {
  id: OutfitId;
  /** 换装栏里的名字 */
  name: string;
  /** 精灵表的键名：原色是 hero，换色是 hero_blue 等（帧名 hero_blue/run_3） */
  sheet: string;
  /** 换掉的颜色键（原色为空） */
  keys: Partial<Record<OutfitKey, ColorName>>;
  /** 帽子飘带的颜色：暗、亮 */
  ribbon: [ColorName, ColorName];
}

export const OUTFITS: readonly Outfit[] = [
  { id: 'default', name: '原色', sheet: 'hero', keys: {}, ribbon: ['red1', 'red2'] },
  {
    id: 'blue',
    name: '海盐蓝',
    sheet: 'hero_blue',
    keys: { r: 'sky', R: 'sea', w: 'cloud', W: 'mist', t: 'sea', T: 'deep' },
    ribbon: ['sea', 'sky'],
  },
  {
    id: 'lime',
    name: '青柠绿',
    sheet: 'hero_lime',
    keys: { r: 'leaf3', R: 'leaf2', w: 'cream', W: 'sand3', t: 'leaf2', T: 'leaf1' },
    ribbon: ['leaf2', 'leaf3'],
  },
  {
    id: 'dusk',
    name: '晚霞紫',
    sheet: 'hero_dusk',
    keys: { r: 'blush', R: 'wine', w: 'cream', W: 'sand3', t: 'violet', T: 'night' },
    ribbon: ['wine', 'blush'],
  },
];

/** 按编号找服装；不认识的编号当作原色 */
export function outfitOf(id: string | undefined): Outfit {
  return OUTFITS.find((o) => o.id === id) ?? OUTFITS[0]!;
}

/** 有没有这套衣服（原色一直有） */
export function hasOutfit(save: SaveData, id: string): boolean {
  return id === DEFAULT_OUTFIT || save.outfits.includes(id);
}

/** 换上一套衣服：只能穿原色和买下的布料；返回换没换成 */
export function wear(save: SaveData, id: string): boolean {
  if (!OUTFITS.some((o) => o.id === id) || !hasOutfit(save, id)) return false;
  save.outfit = id;
  return true;
}
