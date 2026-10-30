import { TILE } from './constants';
import { Grid, T_EMPTY, T_HIDDEN, T_ONEWAY, T_SOLID, T_WATER } from './grid';
import { PLAYER_H, PLAYER_W } from './player';

/** 材质：决定这一格画成什么。碰撞由 Grid 的瓦片类型决定。 */
export const MAT_NONE = 0;
export const MAT_GROUND = 1;
export const MAT_SAND = 2;
export const MAT_CRATE = 3;
export const MAT_PLANK = 4;
export const MAT_WATER = 5;

/** 图例里一个字符的含义：瓦片类型、材质，以及（可选）放在这一格的标记 */
export interface LegendEntry {
  tile: number;
  material?: number;
  marker?: string;
  data?: Record<string, string | number>;
}

export type ItemKind = 'shell' | 'bigShell' | 'mango' | 'sun' | 'glass';
export type BlockKind = 'bell' | 'multi' | 'hidden' | 'brick';
export type EnemyKind = 'crab' | 'blueClaw';

/** 关卡实体：不方便画进网格、带参数的东西。坐标单位是格。 */
export type EntityDef =
  | { type: 'npc'; id: string; at: [number, number]; facing?: 1 | -1 }
  | { type: 'deco'; kind: string; at: [number, number]; flip?: boolean; front?: boolean }
  /** 触发区：blocking 为 true 时世界会停下等过场或对话结束 */
  | { type: 'trigger'; id: string; rect: [number, number, number, number]; blocking?: boolean }
  /** 指定某一格的海玻璃编号（这一格可以是海玻璃 g，也可以是一块砖，砖里就装这枚海玻璃） */
  | { type: 'glass'; at: [number, number]; index: number }
  /** 风铃架：at 是木架左上角所在的格子；按顺序碰响后掉出编号为 glass 的海玻璃 */
  | { type: 'chimes'; at: [number, number]; glass: number };

export interface LevelDef {
  id: string;
  name: string;
  /** 各段从左到右拼接；每段是多行文本，行数必须相同 */
  chunks: string[];
  /** 本关追加或覆盖的图例 */
  legend?: Record<string, LegendEntry>;
  /** 主题分段：从 from 列开始使用 theme */
  themes?: Array<{ from: number; theme: string }>;
  music?: string;
  entities?: EntityDef[];
  /** 练习场规则：不扣心，掉坑后很快回来 */
  practice?: boolean;
}

export interface Marker {
  kind: string;
  col: number;
  row: number;
  char: string;
  data?: Record<string, string | number>;
}

export interface ParsedLevel {
  id: string;
  name: string;
  grid: Grid;
  /** 每格的材质（MAT_*） */
  material: Uint8Array;
  /** 主角出生点（碰撞盒左上角，px） */
  spawn: { x: number; y: number };
  markers: Marker[];
  entities: EntityDef[];
  themes: Array<{ from: number; theme: string }>;
  music: string | null;
  practice: boolean;
}

/** 通用图例，见 PLAN.md §2.5 与 docs/levels/1-1.md §2 */
export const BASE_LEGEND: Record<string, LegendEntry> = {
  '.': { tile: T_EMPTY },
  '#': { tile: T_SOLID, material: MAT_GROUND },
  '%': { tile: T_SOLID, material: MAT_SAND },
  x: { tile: T_SOLID, material: MAT_CRATE },
  '=': { tile: T_ONEWAY, material: MAT_PLANK },
  '~': { tile: T_WATER, material: MAT_WATER },
  P: { tile: T_EMPTY, marker: 'spawn' },
  B: { tile: T_SOLID, marker: 'block', data: { kind: 'bell', item: 'shell' } },
  $: { tile: T_SOLID, marker: 'block', data: { kind: 'multi', item: 'shell' } },
  M: { tile: T_SOLID, marker: 'block', data: { kind: 'bell', item: 'mango' } },
  '*': { tile: T_SOLID, marker: 'block', data: { kind: 'bell', item: 'sun' } },
  '?': { tile: T_HIDDEN, marker: 'block', data: { kind: 'hidden', item: 'shell' } },
  b: { tile: T_SOLID, marker: 'block', data: { kind: 'brick', item: '' } },
  s: { tile: T_EMPTY, marker: 'item', data: { kind: 'shell' } },
  S: { tile: T_EMPTY, marker: 'item', data: { kind: 'bigShell' } },
  m: { tile: T_EMPTY, marker: 'item', data: { kind: 'mango' } },
  g: { tile: T_EMPTY, marker: 'item', data: { kind: 'glass' } },
  k: { tile: T_EMPTY, marker: 'enemy', data: { kind: 'crab' } },
  K: { tile: T_EMPTY, marker: 'enemy', data: { kind: 'blueClaw' } },
  C: { tile: T_EMPTY, marker: 'checkpoint' },
  G: { tile: T_EMPTY, marker: 'goal' },
};
for (let i = 0; i <= 9; i++)
  BASE_LEGEND[String(i)] = { tile: T_EMPTY, marker: 'sign', data: { value: i } };
BASE_LEGEND['<'] = { tile: T_EMPTY, marker: 'arrow', data: { dir: -1 } };
BASE_LEGEND['>'] = { tile: T_EMPTY, marker: 'arrow', data: { dir: 1 } };

/** 没写材质时按瓦片类型取默认材质 */
function defaultMaterial(tile: number): number {
  if (tile === T_SOLID) return MAT_GROUND;
  if (tile === T_ONEWAY) return MAT_PLANK;
  if (tile === T_WATER) return MAT_WATER;
  return MAT_NONE;
}

/** 把一段多行文本切成行：去掉每行首尾空白，丢掉空行 */
export function chunkRows(chunk: string): string[] {
  return chunk
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** 把所有段横向拼接成完整的行 */
export function joinChunks(chunks: string[]): string[] {
  let rows: string[] | null = null;
  chunks.forEach((chunk, i) => {
    const r = chunkRows(chunk);
    const width = r[0]?.length ?? 0;
    r.forEach((line, j) => {
      if (line.length !== width) {
        throw new Error(`第 ${i + 1} 段第 ${j + 1} 行长度是 ${line.length}，应为 ${width}`);
      }
    });
    if (rows === null) {
      rows = r;
    } else {
      if (r.length !== rows.length) {
        throw new Error(`第 ${i + 1} 段有 ${r.length} 行，第 1 段有 ${rows.length} 行`);
      }
      rows = rows.map((line, j) => line + r[j]);
    }
  });
  if (!rows) throw new Error('关卡没有内容');
  return rows;
}

export function parseLevel(def: LevelDef): ParsedLevel {
  const legend = { ...BASE_LEGEND, ...def.legend };
  const rows = joinChunks(def.chunks);
  const grid = new Grid(rows[0]!.length, rows.length);
  const material = new Uint8Array(grid.cols * grid.rows);
  const markers: Marker[] = [];
  let spawn: { x: number; y: number } | null = null;
  rows.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) {
      const ch = line[c]!;
      const entry = legend[ch];
      if (!entry) throw new Error(`关卡 ${def.id}：第 ${r + 1} 行第 ${c + 1} 列有未知字符 "${ch}"`);
      grid.set(c, r, entry.tile);
      // 方块由表现层单独绘制，不进瓦片图
      material[r * grid.cols + c] =
        entry.marker === 'block' ? MAT_NONE : (entry.material ?? defaultMaterial(entry.tile));
      if (entry.marker === 'spawn') {
        if (spawn) throw new Error(`关卡 ${def.id}：出生点 P 不止一个`);
        spawn = standAt(c, r);
      } else if (entry.marker) {
        markers.push({ kind: entry.marker, col: c, row: r, char: ch, data: entry.data });
      }
    }
  });
  if (!spawn) throw new Error(`关卡 ${def.id}：没有出生点 P`);
  return {
    id: def.id,
    name: def.name,
    grid,
    material,
    spawn,
    markers,
    entities: def.entities ?? [],
    themes: def.themes ?? [],
    music: def.music ?? null,
    practice: def.practice ?? false,
  };
}

/** 第 col 列用的主题 */
export function themeAt(level: ParsedLevel, col: number): string {
  let theme = level.themes[0]?.theme ?? '';
  for (const t of level.themes) if (col >= t.from) theme = t.theme;
  return theme;
}

/** 把格子坐标换算成"脚站在这一格底部"的主角坐标 */
export function standAt(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE + Math.floor((TILE - PLAYER_W) / 2),
    y: row * TILE + TILE - PLAYER_H,
  };
}
