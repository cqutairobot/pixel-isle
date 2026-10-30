import { fxSheet } from './fx';
import { heroSheet } from './hero';
import { propSheet } from './props';
import type { Sheet } from './sprite';

/** 所有用字符网格绘制的精灵表 */
export const allSheets: Sheet[] = [heroSheet, propSheet, fxSheet];
