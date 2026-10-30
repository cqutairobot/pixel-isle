import { FPS, TILE } from './constants';

/** 手感参数。单位：px、px/s、帧（60 帧/秒）。见 PLAN.md §6 与 docs/levels/0-gym.md §3。 */
export interface Tuning {
  walkSpeed: number;
  runSpeed: number;
  /** 从静止加速到走速所需帧数 */
  accelFramesToWalk: number;
  /** 按住跑键时，从走速加速到跑速所需帧数 */
  accelFramesWalkToRun: number;
  /** 松手后从走速停下所需帧数 */
  decelFramesFromWalk: number;
  /** 转身时减速度的倍数 */
  turnDecelMul: number;
  /** 空中加速度相对地面的比例 */
  airAccelMul: number;
  /** 空中不按方向键时的阻力（px/s²） */
  airDrag: number;
  /** 按住跳跃键时的最高跳（格） */
  jumpHeightTiles: number;
  /** 起跳到顶点的时间（秒） */
  jumpTimeToApex: number;
  /** 满跑时额外的起跳速度（px/s） */
  runJumpBonus: number;
  /** 上升途中松开跳跃键时，上升速度乘以它 */
  jumpCutMul: number;
  /** 顶点悬停：上升/下落速度小于它时生效（px/s） */
  apexThreshold: number;
  /** 顶点悬停时的重力乘数 */
  apexGravityMul: number;
  /** 下落时的重力乘数 */
  fallGravityMul: number;
  /** 最大下落速度（px/s） */
  maxFall: number;
  /** 按住↓时最大下落速度的乘数 */
  fastFallMul: number;
  coyoteFrames: number;
  bufferFrames: number;
  /** 撞头修正的最大侧移（px） */
  cornerCorrection: number;
  /** 边缘辅助的最大抬升（px） */
  ledgeAssist: number;
  /** 超过这个速度转身时进入急停（px/s） */
  skidThreshold: number;
}

/** 由手感参数推导出的物理量 */
export interface Derived {
  gravity: number;
  jumpVelocity: number;
  groundAccel: number;
  runAccel: number;
  groundDecel: number;
}

export function derive(t: Tuning): Derived {
  const h = t.jumpHeightTiles * TILE;
  const tApex = t.jumpTimeToApex;
  return {
    gravity: (2 * h) / (tApex * tApex),
    jumpVelocity: (2 * h) / tApex,
    groundAccel: t.walkSpeed / (t.accelFramesToWalk / FPS),
    runAccel: (t.runSpeed - t.walkSpeed) / (t.accelFramesWalkToRun / FPS),
    groundDecel: t.walkSpeed / (t.decelFramesFromWalk / FPS),
  };
}

const common = {
  coyoteFrames: 6,
  bufferFrames: 7,
  cornerCorrection: 4,
  ledgeAssist: 3,
  skidThreshold: 60,
  fastFallMul: 1.25,
};

export type PresetId = 'A' | 'B' | 'C';

export const PRESETS: Record<PresetId, { name: string; tuning: Tuning }> = {
  A: {
    name: '标准',
    tuning: {
      ...common,
      walkSpeed: 90,
      runSpeed: 150,
      accelFramesToWalk: 6,
      accelFramesWalkToRun: 24,
      decelFramesFromWalk: 5,
      turnDecelMul: 2,
      airAccelMul: 0.65,
      airDrag: 300,
      jumpHeightTiles: 4.25,
      jumpTimeToApex: 0.36,
      runJumpBonus: 24,
      jumpCutMul: 0.5,
      apexThreshold: 40,
      apexGravityMul: 0.5,
      fallGravityMul: 1.8,
      maxFall: 330,
    },
  },
  B: {
    name: '轻快',
    tuning: {
      ...common,
      walkSpeed: 96,
      runSpeed: 160,
      accelFramesToWalk: 4,
      accelFramesWalkToRun: 16,
      decelFramesFromWalk: 4,
      turnDecelMul: 2.5,
      airAccelMul: 0.8,
      airDrag: 450,
      jumpHeightTiles: 4,
      jumpTimeToApex: 0.32,
      runJumpBonus: 20,
      jumpCutMul: 0.45,
      apexThreshold: 30,
      apexGravityMul: 0.6,
      fallGravityMul: 2,
      maxFall: 360,
    },
  },
  C: {
    name: '厚重',
    tuning: {
      ...common,
      walkSpeed: 84,
      runSpeed: 150,
      accelFramesToWalk: 10,
      accelFramesWalkToRun: 36,
      decelFramesFromWalk: 9,
      turnDecelMul: 1.6,
      airAccelMul: 0.5,
      airDrag: 180,
      jumpHeightTiles: 4.5,
      jumpTimeToApex: 0.4,
      runJumpBonus: 30,
      jumpCutMul: 0.55,
      apexThreshold: 50,
      apexGravityMul: 0.45,
      fallGravityMul: 1.5,
      maxFall: 300,
    },
  },
};

export function cloneTuning(t: Tuning): Tuning {
  return { ...t };
}
