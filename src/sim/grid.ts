import { TILE } from './constants';

export const T_EMPTY = 0;
export const T_SOLID = 1;
/** 单向平台：只有顶面挡住从上往下的移动 */
export const T_ONEWAY = 2;

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
}
