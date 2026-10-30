/**
 * 运动学物体：整数坐标 + 亚像素余量，按轴逐像素移动（参考 Celeste/TowerFall 的 Actor）。
 * x, y 是碰撞盒左上角。
 */
export class Body {
  rx = 0;
  ry = 0;

  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
  ) {}

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

  get bottom(): number {
    return this.y + this.h;
  }
}
