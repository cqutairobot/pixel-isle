import { rectsOverlap, type Rect } from './body';
import { TILE } from './constants';

/**
 * 风铃架上三只风铃的位置（相对木架左上角，px）：大的挂得低，小的挂得高。
 * 木架宽 4 格；风铃从左到右是大、中、小。
 */
export const CHIME_LAYOUT: ReadonlyArray<Rect> = [
  { x: 8, y: 30, w: 8, h: 16 },
  { x: 29, y: 18, w: 6, h: 12 },
  { x: 49, y: 8, w: 6, h: 10 },
];

/** 早安歌：大、小、中、大 */
export const CHIME_SEQUENCE: ReadonlyArray<number> = [0, 2, 1, 0];

/** 同一只风铃两次响之间至少隔多少帧 */
export const CHIME_COOLDOWN = 20;

export class Chimes {
  readonly rects: Rect[];
  readonly x0: number;
  readonly y0: number;
  private cooldown = [0, 0, 0];
  private touching = [false, false, false];
  history: number[] = [];
  solved = false;

  constructor(
    col: number,
    row: number,
    readonly glass: number,
  ) {
    this.x0 = col * TILE;
    this.y0 = row * TILE;
    this.rects = CHIME_LAYOUT.map((r) => ({ x: this.x0 + r.x, y: this.y0 + r.y, w: r.w, h: r.h }));
  }

  /**
   * 每步调用。返回这一步碰响的风铃序号（没有为 -1），以及是否刚好解开。
   * 只有"刚碰到"的那一下才响，一直贴着不会连响。
   */
  step(player: Rect): { rang: number; solvedNow: boolean } {
    let rang = -1;
    let solvedNow = false;
    this.rects.forEach((r, i) => {
      if (this.cooldown[i]! > 0) this.cooldown[i]!--;
      const touch = rectsOverlap(player.x, player.y, player.w, player.h, r);
      if (touch && !this.touching[i] && this.cooldown[i] === 0) {
        rang = i;
        this.cooldown[i] = CHIME_COOLDOWN;
      }
      this.touching[i] = touch;
    });
    if (rang >= 0 && !this.solved) {
      this.history.push(rang);
      if (this.history.length > CHIME_SEQUENCE.length) this.history.shift();
      if (
        this.history.length === CHIME_SEQUENCE.length &&
        this.history.every((v, i) => v === CHIME_SEQUENCE[i])
      ) {
        this.solved = true;
        solvedNow = true;
      }
    }
    return { rang, solvedNow };
  }
}
