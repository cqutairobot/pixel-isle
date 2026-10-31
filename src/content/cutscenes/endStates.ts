import type { EndState } from '../../sim/world';

/**
 * 每段过场 / 阻塞触发结束后世界要变成的样子。
 * 游戏里不管看完还是跳过都套用这里的结束状态；回放测试里直接套用（PLAN §5.10）。
 */
export const END_STATES: Record<string, EndState> = {
  // 小满跑到爷爷的冰雕前（第 67 列），回回从此跟着她
  belltower: { flags: ['huihui', 'belltower'], player: [67, 11], facing: 1 },
  // 小满走到白露跟前（第 145 列）
  bailu: { flags: ['metBailu'], player: [145, 13], facing: 1 },
};
