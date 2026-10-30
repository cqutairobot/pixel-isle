import { TILE } from './constants';
import { Grid, T_EMPTY, T_ONEWAY, T_SOLID } from './grid';
import { PLAYER_H, PLAYER_W } from './player';

/** 图例里一个字符的含义：瓦片类型，以及（可选）放在这一格的标记 */
export interface LegendEntry {
  tile: number;
  marker?: string;
  data?: Record<string, string | number>;
}

export interface LevelDef {
  id: string;
  name: string;
  /** 各段从左到右拼接；每段是多行文本，行数必须相同 */
  chunks: string[];
  /** 本关追加或覆盖的图例 */
  legend?: Record<string, LegendEntry>;
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
  /** 主角出生点（碰撞盒左上角，px） */
  spawn: { x: number; y: number };
  markers: Marker[];
}

/** 通用图例，见 PLAN.md §2.5 */
export const BASE_LEGEND: Record<string, LegendEntry> = {
  '.': { tile: T_EMPTY },
  '#': { tile: T_SOLID },
  '=': { tile: T_ONEWAY },
  P: { tile: T_EMPTY, marker: 'spawn' },
};
for (let i = 0; i <= 9; i++)
  BASE_LEGEND[String(i)] = { tile: T_EMPTY, marker: 'sign', data: { value: i } };
BASE_LEGEND['<'] = { tile: T_EMPTY, marker: 'arrow', data: { dir: -1 } };
BASE_LEGEND['>'] = { tile: T_EMPTY, marker: 'arrow', data: { dir: 1 } };

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
  const markers: Marker[] = [];
  let spawn: { x: number; y: number } | null = null;
  rows.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) {
      const ch = line[c]!;
      const entry = legend[ch];
      if (!entry) throw new Error(`关卡 ${def.id}：第 ${r + 1} 行第 ${c + 1} 列有未知字符 "${ch}"`);
      grid.set(c, r, entry.tile);
      if (entry.marker === 'spawn') {
        if (spawn) throw new Error(`关卡 ${def.id}：出生点 P 不止一个`);
        spawn = {
          x: c * TILE + Math.floor((TILE - PLAYER_W) / 2),
          y: r * TILE + TILE - PLAYER_H,
        };
      } else if (entry.marker) {
        markers.push({ kind: entry.marker, col: c, row: r, char: ch, data: entry.data });
      }
    }
  });
  if (!spawn) throw new Error(`关卡 ${def.id}：没有出生点 P`);
  return { id: def.id, name: def.name, grid, spawn, markers };
}

/** 把格子坐标换算成"脚站在这一格底部"的主角坐标 */
export function standAt(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE + Math.floor((TILE - PLAYER_W) / 2),
    y: row * TILE + TILE - PLAYER_H,
  };
}
