import { TILE } from './constants';

export const T_EMPTY = 0;
export const T_SOLID = 1;
/** 单向平台：只有顶面挡住从上往下的移动 */
export const T_ONEWAY = 2;
/** 海水：不挡路，主角或敌人掉进去按落水处理 */
export const T_WATER = 3;
/** 隐藏铃砖：平时不挡路，只有主角从下往上撞到它的底边时才挡住（随后变成实心） */
export const T_HIDDEN = 4;

/** 碰撞网格。左右越界当作墙，上方越界是空，下方越界是坑。 */
export class Grid {
  readonly data: Uint8Array;

  constructor(
    readonly cols: number,
    readonly rows: number,
  ) {
    this.data = new Uint8Array(cols * rows);
  }

  get widthPx(): number {
    return this.cols * TILE;
  }

  get heightPx(): number {
    return this.rows * TILE;
  }

  get(c: number, r: number): number {
    if (c < 0 || c >= this.cols) return T_SOLID;
    if (r < 0 || r >= this.rows) return T_EMPTY;
    return this.data[r * this.cols + c]!;
  }

  set(c: number, r: number, t: number): void {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return;
    this.data[r * this.cols + c] = t;
  }

  /** 矩形 [x, x+w) × [y, y+h) 是否与实心瓦片重叠 */
  solidAt(x: number, y: number, w: number, h: number): boolean {
    const c0 = Math.floor(x / TILE);
    const c1 = Math.floor((x + w - 1) / TILE);
    const r0 = Math.floor(y / TILE);
    const r1 = Math.floor((y + h - 1) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (this.get(c, r) === T_SOLID) return true;
      }
    }
    return false;
  }

  /** 像素行 rowPx 是否正好是某块单向平台的顶边，且与 [x, x+w) 重叠 */
  oneWayTopAt(x: number, rowPx: number, w: number): boolean {
    if (rowPx % TILE !== 0) return false;
    const r = rowPx / TILE;
    const c0 = Math.floor(x / TILE);
    const c1 = Math.floor((x + w - 1) / TILE);
    for (let c = c0; c <= c1; c++) {
      if (this.get(c, r) === T_ONEWAY) return true;
    }
    return false;
  }

  /**
   * 头顶 topPx 正好贴着某块隐藏铃砖的底边（与 [x, x+w) 重叠）时返回 true。
   * 用于"从下往上撞"：只有越过底边的那一下才会被挡住。
   */
  hiddenBelowEdge(x: number, topPx: number, w: number): boolean {
    if (topPx % TILE !== 0) return false;
    const r = topPx / TILE - 1;
    const c0 = Math.floor(x / TILE);
    const c1 = Math.floor((x + w - 1) / TILE);
    for (let c = c0; c <= c1; c++) {
      if (this.get(c, r) === T_HIDDEN) return true;
    }
    return false;
  }

  /** 像素点是否在海水里 */
  waterAt(px: number, py: number): boolean {
    return this.get(Math.floor(px / TILE), Math.floor(py / TILE)) === T_WATER;
  }

  /** 像素点下方是否是可以站立的面（实心顶或单向平台顶） */
  standableAt(px: number, footPx: number): boolean {
    return this.solidAt(px, footPx, 1, 1) || this.oneWayTopAt(px, footPx, 1);
  }
}
