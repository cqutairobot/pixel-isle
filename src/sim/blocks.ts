import { T_EMPTY, T_HIDDEN, T_SOLID, type Grid } from './grid';
import type { BlockKind, ItemKind } from './level';
import { RULES } from './tuning';

/** 铃砖上弹动画的总帧数（PLAN §6.7：先上弹 4px 再回落，共 8 帧） */
export const BUMP_FRAMES = 8;

export interface Block {
  col: number;
  row: number;
  kind: BlockKind;
  /** 里面装的东西；沙岩砖为 null */
  item: ItemKind | null;
  /** 装的是海玻璃时的编号 */
  glass: number;
  /** 用过了（变成暗色实心砖）或碎掉了 */
  used: boolean;
  broken: boolean;
  /** 隐藏铃砖是否已经现身 */
  revealed: boolean;
  /** 上弹动画剩余帧数 */
  bump: number;
  /** 被打的方向：0 从下面顶（往上弹），±1 被海星从侧面打（往那边晃） */
  bumpDir: number;
  /** 多次铃砖：已经顶出几枚、时限还剩多少帧（-1 表示还没开始计时） */
  hits: number;
  timer: number;
}

/** 一次顶砖的结果，由 World 负责生成道具、发事件 */
export interface BlockHitResult {
  block: Block;
  /** 这一下吐出的道具（贝壳会直接收下，其他道具从砖顶弹出） */
  item: ItemKind | null;
  /** 砖碎了 */
  broke: boolean;
  /** 已经用过的砖，只发出闷响 */
  empty: boolean;
  /** 这一下让砖上弹（顶得到砖顶上的敌人和贝壳） */
  bumped: boolean;
}

/** 关卡里所有可以顶的砖，按格子索引存放 */
export class BlockSet {
  readonly list: Block[] = [];
  private byCell = new Map<number, Block>();

  constructor(private grid: Grid) {}

  add(col: number, row: number, kind: BlockKind, item: ItemKind | null, glass = -1): Block {
    const b: Block = {
      col,
      row,
      kind,
      item: kind === 'brick' ? null : item,
      glass,
      used: false,
      broken: false,
      revealed: kind !== 'hidden',
      bump: 0,
      bumpDir: 0,
      hits: 0,
      timer: -1,
    };
    this.list.push(b);
    this.byCell.set(row * this.grid.cols + col, b);
    return b;
  }

  at(col: number, row: number): Block | undefined {
    return this.byCell.get(row * this.grid.cols + col);
  }

  /** 每个逻辑步调用：推进上弹动画与多次铃砖的时限 */
  step(): void {
    for (const b of this.list) {
      if (b.bump > 0) b.bump--;
      if (b.timer > 0) b.timer--;
    }
  }

  /** 从下面顶 (col, row) 这一格；dir 不为 0 时是被海星从侧面打（±1 是海星飞行的方向） */
  hit(col: number, row: number, dir = 0): BlockHitResult | null {
    const b = this.at(col, row);
    if (!b || b.broken) return null;
    if (b.used) return { block: b, item: null, broke: false, empty: true, bumped: false };
    if (b.kind === 'brick') {
      b.broken = true;
      this.grid.set(col, row, T_EMPTY);
      return { block: b, item: null, broke: true, empty: false, bumped: true };
    }
    if (b.kind === 'hidden' && !b.revealed) {
      b.revealed = true;
      this.grid.set(col, row, T_SOLID);
    }
    b.bump = BUMP_FRAMES;
    b.bumpDir = dir;
    if (b.kind === 'multi') {
      if (b.timer < 0) b.timer = RULES.multiBlockFrames;
      b.hits++;
      // 时限到了或者顶满了，这一下就是最后一枚
      if (b.hits >= RULES.multiBlockMax || b.timer === 0) b.used = true;
      return { block: b, item: 'shell', broke: false, empty: false, bumped: true };
    }
    b.used = true;
    return { block: b, item: b.item, broke: false, empty: false, bumped: true };
  }

  /** 方块网格是否仍是隐藏状态（关卡校验用） */
  isHidden(col: number, row: number): boolean {
    return this.grid.get(col, row) === T_HIDDEN;
  }
}
