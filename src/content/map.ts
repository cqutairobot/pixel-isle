import type { SaveData } from '../platform/save';
import { LEVELS } from './levels';

/**
 * 第一章的章节地图（docs/levels/1-2.md §5）：一屏大小的时令岛南岸，每关一个铃铛节点，
 * 相邻两关之间是一串小圆点的路。坐标是地图画面上的像素（384×216）。
 * 这里只有数据和纯逻辑（哪些节点能去、哪些路刚解锁），表现在 src/scenes/MapScene.ts。
 */

export interface MapNode {
  /** 关卡编号 */
  id: string;
  /** 卡片上的名字 */
  name: string;
  x: number;
  y: number;
}

export const MAP_NODES: MapNode[] = [
  { id: '1-1', name: '晨钟村 · 晨光沙滩', x: 62, y: 140 },
  { id: '1-2', name: '椰影小径', x: 138, y: 122 },
  { id: '1-3', name: '回声崖', x: 214, y: 90 },
  { id: '1-4', name: '冻浪湾', x: 290, y: 132 },
  { id: '1-5', name: '潮汐神龛', x: 348, y: 168 },
];

/** 大暑的冰沙摊（海崖下面，先显示"即将开张"） */
export const MAP_SHOP = { x: 250, y: 150 };

/** 每条路的弯曲程度：二次曲线的控制点（键是路的终点） */
const CONTROL: Record<string, [number, number]> = {
  '1-2': [96, 148],
  '1-3': [182, 124],
  '1-4': [256, 100],
  '1-5': [326, 142],
};

export interface MapPath {
  from: string;
  to: string;
  /** 路上的小圆点（不含两头的节点） */
  dots: Array<[number, number]>;
}

/** 沿二次曲线每隔 spacing 像素取一个点，两头各留 margin 像素给节点 */
function sample(
  a: MapNode,
  c: [number, number],
  b: MapNode,
  spacing: number,
  margin: number,
): Array<[number, number]> {
  const at = (t: number): [number, number] => [
    (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c[0] + t * t * b.x,
    (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c[1] + t * t * b.y,
  ];
  // 先按很细的步长量出曲线长度，再按弧长均匀取点
  const fine: Array<{ t: number; s: number }> = [{ t: 0, s: 0 }];
  let prev = at(0);
  for (let i = 1; i <= 400; i++) {
    const p = at(i / 400);
    fine.push({ t: i / 400, s: fine[i - 1]!.s + Math.hypot(p[0] - prev[0], p[1] - prev[1]) });
    prev = p;
  }
  const len = fine[fine.length - 1]!.s;
  const usable = len - margin * 2;
  const n = Math.max(1, Math.round(usable / spacing));
  const out: Array<[number, number]> = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const s = margin + (usable * k) / n;
    while (j < fine.length - 1 && fine[j + 1]!.s < s) j++;
    const p = at(fine[j]!.t);
    out.push([Math.round(p[0]), Math.round(p[1])]);
  }
  return out;
}

export const MAP_PATHS: MapPath[] = MAP_NODES.slice(1).map((to, i) => {
  const from = MAP_NODES[i]!;
  return { from: from.id, to: to.id, dots: sample(from, CONTROL[to.id]!, to, 9, 10) };
});

export function mapNode(id: string): MapNode | undefined {
  return MAP_NODES.find((n) => n.id === id);
}

/**
 * 节点的样子：
 * - locked：前一关还没通关，连路都没有；
 * - open：可以进；cleared：通关过；
 * - soon：路通了，但这一关还在做（卡片上写"正在制作中"）。
 */
export type NodeState = 'locked' | 'open' | 'cleared' | 'soon';

export function nodeState(save: SaveData, id: string): NodeState {
  const i = MAP_NODES.findIndex((n) => n.id === id);
  if (i < 0) return 'locked';
  const prev = MAP_NODES[i - 1];
  if (prev && !save.levels[prev.id]?.cleared) return 'locked';
  if (!LEVELS[id]) return 'soon';
  return save.levels[id]?.cleared ? 'cleared' : 'open';
}

/** 通往 to 的那条路是不是已经通了（前一关通关过） */
export function pathOpen(save: SaveData, to: string): boolean {
  return nodeState(save, to) !== 'locked';
}

/** 已经通了、但还没播放过解锁动画的路（终点编号，从近到远） */
export function pathsToReveal(save: SaveData): string[] {
  return MAP_PATHS.filter((p) => pathOpen(save, p.to) && !save.map.opened.includes(p.to)).map(
    (p) => p.to,
  );
}

/** 地图开放了没有：通关过第 1 关以后，标题的"继续"和暂停菜单都会去地图 */
export function mapUnlocked(save: SaveData): boolean {
  return !!save.levels['1-1']?.cleared;
}

/**
 * 从 from 往 dir（+1 往右、-1 往左）走一步能到的节点；路没通就返回 null。
 * 地图上的路从左到右排，所以 ← → 就是上一关、下一关。
 */
export function stepNode(save: SaveData, from: string, dir: 1 | -1): string | null {
  const i = MAP_NODES.findIndex((n) => n.id === from);
  const next = MAP_NODES[i + dir];
  if (!next) return null;
  const to = dir > 0 ? next.id : from;
  return pathOpen(save, to) ? next.id : null;
}
