import { OUTFITS } from '../content/outfits';
import { HERO_KEYS, heroSheet } from './hero';
import type { Sheet } from './sprite';

/**
 * 换装（docs/levels/1-3.md §5）：小满每一帧都用同一套像素网格，换一组颜色键（帽带、上衣、裙子）
 * 生成一张新的精灵表，例如 hero_blue/run_3。骑咩铃、摸咩铃的帧也都在里面。
 */
export const outfitSheets: Sheet[] = OUTFITS.filter((o) => o.id !== 'default').map((o) => ({
  ...heroSheet,
  key: o.sheet,
  keys: { ...HERO_KEYS, ...o.keys },
}));
