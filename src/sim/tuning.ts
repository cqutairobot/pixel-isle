import { FPS, TILE } from './constants';

/** 手感参数。单位：px、px/s、帧（60 帧/秒）。见 PLAN.md §6 与 docs/levels/0-gym.md §3。 */
export interface Tuning {
  walkSpeed: number;
  runSpeed: number;
  /** 按住方向键多少帧后开始从走速加速到跑速（长按方向奔跑） */
  runDelayFrames: number;
  /** 从静止加速到走速所需帧数 */
  accelFramesToWalk: number;
  /** 开始奔跑后，从走速加速到跑速所需帧数 */
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
      runDelayFrames: 18,
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
      runDelayFrames: 12,
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
      runDelayFrames: 24,
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

/**
 * 战斗与关卡规则（不随手感预设变化）。单位同上。
 * 见 docs/levels/1-1.md §3、PLAN.md §5.1 与 §6.5。
 */
export const RULES = {
  /** 生命 */
  hearts: 3,
  assistHearts: 5,
  /** 受击：停顿、击退、硬直、无敌 */
  hurtHitstop: 6,
  knockbackX: 120,
  knockbackY: 180,
  hurtStunFrames: 12,
  hurtIframes: 90,
  /** 踩踏：停顿、弹起（不按跳 / 按住跳）、踩中后的保护帧、连踩答谢上限 */
  stompHitstop: 3,
  stompBounce: 240,
  stompBounceHeld: 440,
  stompGraceFrames: 4,
  stompComboMax: 5,
  /** 顶碎沙岩砖的停顿 */
  brickHitstop: 2,
  /** 掉海、掉坑：多少帧后回到岸上，回来后的无敌帧 */
  fallRespawnFrames: 36,
  respawnIframes: 60,
  /** 死亡：定格帧数、从死亡到复活的总帧数 */
  deathFreezeFrames: 12,
  deathFrames: 60,
  /** 太阳果：持续、最后闪烁提醒、跑速倍数 */
  sunFrames: 480,
  sunWarnFrames: 120,
  sunSpeedMul: 1.15,
  /** 多次铃砖：第一次顶之后的时限、最多几枚 */
  multiBlockFrames: 180,
  multiBlockMax: 8,
  /** 连续拾取贝壳的判定窗口（音高逐级升高） */
  shellChainFrames: 30,
  /** 满心时吃芒果换几枚贝壳 */
  mangoFullShells: 3,
  bigShellValue: 10,
  /** 敌人进入镜头外多少像素以内才开始活动 */
  activateMargin: 48,
  /** 敌人的重力与最大下落速度 */
  enemyGravity: 1000,
  enemyMaxFall: 300,
  /** 道具的重力与最大下落速度 */
  itemGravity: 900,
  itemMaxFall: 280,
} as const;
