import type { LevelDef } from '../../sim/level';
import { level11 } from './1-1';
import { gym } from './gym';

/** 关卡注册表：关卡编号 → 定义 */
export const LEVELS: Record<string, LevelDef> = {
  gym,
  '1-1': level11,
};

/** 第一章的正式关卡顺序 */
export const CHAPTER_1 = ['1-1'];
