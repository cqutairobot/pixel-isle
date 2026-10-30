import { DT } from './constants';
import { clamp, smoothDamp, type SpringRef } from './math';
import type { Player } from './player';
import type { Tuning } from './tuning';

/** 镜头参数，见 PLAN.md §6.6 */
export interface CameraTuning {
  /** 面向方向的前瞻距离（px），满跑时用 lookAheadRun */
  lookAhead: number;
  lookAheadRun: number;
  /** 前瞻偏移的平滑时间（秒） */
  lookSmooth: number;
  /** 水平跟随的平滑时间（秒） */
  followSmooth: number;
  /** 水平死区总宽度（px） */
  deadzone: number;
  /** 站在地上时，脚底在画面中的高度比例 */
  groundLine: number;
  /** 腾空时，主角超出这个上/下边界才跟随 */
  topMargin: number;
  bottomMargin: number;
  ySmooth: number;
  yFallSmooth: number;
  /** 按住↑/↓多少帧后开始窥视 */
  peekDelay: number;
  peekDistance: number;
}

export const DEFAULT_CAMERA: CameraTuning = {
  lookAhead: 40,
  lookAheadRun: 64,
  lookSmooth: 0.6,
  followSmooth: 0.3,
  deadzone: 16,
  groundLine: 0.68,
  topMargin: 0.25,
  bottomMargin: 0.75,
  ySmooth: 0.25,
  yFallSmooth: 0.1,
  peekDelay: 30,
  peekDistance: 48,
};

/** 镜头逻辑放在 sim 里，保证回放时镜头也完全确定。x, y 是视野左上角（世界像素，可为小数）。 */
export class SimCamera {
  x = 0;
  y = 0;
  focusX = 0;
  look = 0;
  lookTarget = 0;
  groundTargetY = 0;
  peek = 0;
  private refX: SpringRef = { v: 0 };
  private refY: SpringRef = { v: 0 };
  private refLook: SpringRef = { v: 0 };
  private refPeek: SpringRef = { v: 0 };

  constructor(
    readonly viewW: number,
    readonly viewH: number,
    public boundsW: number,
    public boundsH: number,
    public t: CameraTuning = { ...DEFAULT_CAMERA },
  ) {}

  /** 立即对准主角（传送、复活时用） */
  snap(player: Player): void {
    const b = player.body;
    this.focusX = b.centerX;
    this.lookTarget = player.facing * this.t.lookAhead;
    this.look = this.lookTarget;
    this.groundTargetY = b.bottom - this.viewH * this.t.groundLine;
    this.peek = 0;
    this.x = this.clampX(this.focusX + this.look - this.viewW / 2);
    this.y = this.clampY(this.groundTargetY);
    this.refX.v = this.refY.v = this.refLook.v = this.refPeek.v = 0;
  }

  step(player: Player, tuning: Tuning): void {
    const t = this.t;
    const b = player.body;

    // 水平：死区 + 前瞻
    const px = b.centerX;
    const half = t.deadzone / 2;
    if (px > this.focusX + half) this.focusX = px - half;
    else if (px < this.focusX - half) this.focusX = px + half;
    if (Math.abs(player.vx) > 20) {
      const ratio = player.speedRatio(tuning);
      this.lookTarget = player.facing * (t.lookAhead + (t.lookAheadRun - t.lookAhead) * ratio);
    }
    this.look = smoothDamp(this.look, this.lookTarget, this.refLook, t.lookSmooth, DT);
    const targetX = this.clampX(this.focusX + this.look - this.viewW / 2);
    this.x = smoothDamp(this.x, targetX, this.refX, t.followSmooth, DT);

    // 垂直：站在地上时才更新高度（平台吸附），腾空时只在越过边界后跟随
    if (player.onGround) this.groundTargetY = b.bottom - this.viewH * t.groundLine;
    let targetY = this.groundTargetY;
    let fast = false;
    if (b.y < this.y + this.viewH * t.topMargin) {
      targetY = Math.min(targetY, b.y - this.viewH * t.topMargin);
    }
    if (b.bottom > this.y + this.viewH * t.bottomMargin) {
      targetY = Math.max(targetY, b.bottom - this.viewH * t.bottomMargin);
      fast = true;
    }
    // 快速下落时多看下方
    if (!player.onGround && player.vy > 200) {
      targetY = Math.max(targetY, b.bottom - this.viewH * 0.55);
      fast = true;
    }

    // 窥视
    let peekTarget = 0;
    if (player.crouchFrames >= t.peekDelay) peekTarget = t.peekDistance;
    else if (player.lookUpFrames >= t.peekDelay) peekTarget = -t.peekDistance;
    this.peek = smoothDamp(this.peek, peekTarget, this.refPeek, 0.25, DT);

    targetY = this.clampY(targetY + this.peek);
    this.y = smoothDamp(this.y, targetY, this.refY, fast ? t.yFallSmooth : t.ySmooth, DT);

    // 硬约束：无论多快，主角都留在画面里
    this.x = clamp(this.x, b.x + b.w - this.viewW * 0.85, b.x - this.viewW * 0.15);
    this.y = clamp(this.y, b.bottom - this.viewH * 0.92, b.y - this.viewH * 0.08);
    this.x = this.clampX(this.x);
    this.y = this.clampY(this.y);
  }

  private clampX(x: number): number {
    return clamp(x, 0, Math.max(0, this.boundsW - this.viewW));
  }

  private clampY(y: number): number {
    return clamp(y, 0, Math.max(0, this.boundsH - this.viewH));
  }
}
