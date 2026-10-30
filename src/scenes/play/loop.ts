import type Phaser from 'phaser';
import type { Layout } from '../../platform/display';
import { DT } from '../../sim/constants';

/** 慢放档位 */
export const SLOW_STEPS = [1, 0.5, 0.25];

/**
 * 固定 60Hz 逻辑步 + 渲染插值（PLAN §2.4）。练习场和关卡共用。
 * 每帧最多补 5 步，卡顿后不会越补越卡。
 */
export class FixedStepLoop {
  private acc = 0;
  paused = false;
  /** 暂停时只前进一步（逐帧调试） */
  stepOnce = false;
  slow = 0;
  stepsThisFrame = 0;
  fps = 60;

  constructor(private stepFn: () => void) {}

  get scale(): number {
    return SLOW_STEPS[this.slow]!;
  }

  /** 推进一帧渲染时间；返回插值系数 alpha（0–1）和本帧经过的游戏时间（秒） */
  advance(deltaMs: number): { alpha: number; dt: number } {
    const dtReal = Math.min(deltaMs, 250) / 1000;
    this.fps += (1 / Math.max(0.001, dtReal) - this.fps) * 0.05;
    let steps = 0;
    if (!this.paused) {
      this.acc += dtReal * this.scale;
      while (this.acc >= DT && steps < 5) {
        this.stepFn();
        this.acc -= DT;
        steps++;
      }
      if (steps >= 5) this.acc = 0;
    } else if (this.stepOnce) {
      this.stepOnce = false;
      this.stepFn();
      steps = 1;
    }
    this.stepsThisFrame = steps;
    return { alpha: this.paused ? 1 : this.acc / DT, dt: this.paused ? 0 : dtReal * this.scale };
  }

  /** 丢掉累积的时间（暂停、切回前台时调用，防止一口气补很多步） */
  reset(): void {
    this.acc = 0;
  }
}

/** 让相机对准逻辑画面：视口、整数倍缩放、原点在左上角 */
export function fitCamera(cam: Phaser.Cameras.Scene2D.Camera, L: Layout): void {
  cam.setViewport(L.vpX, L.vpY, L.vpW, L.vpH);
  cam.setOrigin(0, 0);
  cam.setZoom(L.k);
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
