/**
 * 运动学物体：整数坐标 + 亚像素余量，按轴逐像素移动（参考 Celeste/TowerFall 的 Actor）。
 * x, y 是碰撞盒左上角。
 */
export class Body {
  rx = 0;
  ry = 0;
  /** 上一个逻辑步开始时的位置，表现层用它做插值 */
  px: number;
  py: number;

  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
  ) {
    this.px = x;
    this.py = y;
  }

  /** 每个逻辑步开始时记下位置 */
  snapshot(): void {
    this.px = this.x;
    this.py = this.y;
  }

  /** 直接放到 (x, y)，不留插值痕迹 */
  place(x: number, y: number): void {
    this.x = this.px = x;
    this.y = this.py = y;
    this.rx = this.ry = 0;
  }

  /**
   * 水平移动 amount 像素（可为小数）。被挡住时调用 onBlocked，
   * 若它返回 true（已经把物体挪到可以继续走的位置），就继续移动。
   * 返回值：最终是否被挡住。
   */
  moveX(
    amount: number,
    blocked: (x: number, y: number) => boolean,
    onBlocked?: (sign: number) => boolean,
  ): boolean {
    this.rx += amount;
    let move = Math.round(this.rx);
    if (move === 0) return false;
    this.rx -= move;
    const sign = Math.sign(move);
    while (move !== 0) {
      if (!blocked(this.x + sign, this.y)) {
        this.x += sign;
        move -= sign;
      } else if (onBlocked && onBlocked(sign)) {
        // 被修正后重试
      } else {
        this.rx = 0;
        return true;
      }
    }
    return false;
  }

  moveY(
    amount: number,
    blocked: (x: number, y: number, sign: number) => boolean,
    onBlocked?: (sign: number) => boolean,
  ): boolean {
    this.ry += amount;
    let move = Math.round(this.ry);
    if (move === 0) return false;
    this.ry -= move;
    const sign = Math.sign(move);
    while (move !== 0) {
      if (!blocked(this.x, this.y + sign, sign)) {
        this.y += sign;
        move -= sign;
      } else if (onBlocked && onBlocked(sign)) {
        // 被修正后重试
      } else {
        this.ry = 0;
        return true;
      }
    }
    return false;
  }

  get centerX(): number {
    return this.x + this.w / 2;
  }

  get centerY(): number {
    return this.y + this.h / 2;
  }

  get right(): number {
    return this.x + this.w;
  }

  get bottom(): number {
    return this.y + this.h;
  }

  overlaps(o: Rect): boolean {
    return rectsOverlap(this.x, this.y, this.w, this.h, o);
  }
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectsOverlap(x: number, y: number, w: number, h: number, o: Rect): boolean {
  return x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y;
}
