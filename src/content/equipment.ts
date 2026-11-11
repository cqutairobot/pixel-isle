import type { Scheme } from '../ui/keyHint';

/** 一件装备：名字、获得时横幅上的一句用法（按键盘的两套键位和手柄分别给出）、大图 */
export interface EquipmentInfo {
  id: string;
  name: string;
  usage: Record<Scheme, string>;
  /** 获得道具演出用的大图（2 倍大小） */
  bigFrame: string;
}

/** 第一章的装备（docs/levels/1-2.md §3）。以后的雪绒手套、夏铃也加在这里 */
export const EQUIPMENT: Record<string, EquipmentInfo> = {
  starfish: {
    id: 'starfish',
    name: '回旋海星',
    usage: {
      wasd: '按 J 扔出，按住 W 斜着往上扔',
      arrows: '按 X 扔出，按住 ↑ 斜着往上扔',
      pad: '按 X 扔出，按住 ↑ 斜着往上扔',
    },
    bigFrame: 'equip/star_big',
  },
};

/** 装备的编号也是世界里的剧情标记（World 看 flags 里有没有 starfish 决定能不能扔） */
export const EQUIPMENT_IDS = Object.keys(EQUIPMENT);

/** 新伙伴（坐骑）：获得演出和装备一样，横幅上写"新伙伴！"（docs/levels/1-3.md §4） */
export const COMPANIONS: Record<string, EquipmentInfo & { head: string }> = {
  mieling: {
    id: 'mieling',
    name: '咩铃',
    head: '新伙伴！',
    usage: {
      wasd: '空中再按 K 二段跳 · 按 J 冲撞',
      arrows: '空中再按 Z 二段跳 · 按 X 冲撞',
      pad: '空中再按 A 二段跳 · 按 X 冲撞',
    },
    bigFrame: 'goat/big',
  },
};
