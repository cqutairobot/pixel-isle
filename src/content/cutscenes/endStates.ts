import type { EndState } from '../../sim/world';

/**
 * 每段过场 / 阻塞触发结束后世界要变成的样子。
 * 游戏里不管看完还是跳过都套用这里的结束状态；回放测试里直接套用（PLAN §5.10）。
 */
export const END_STATES: Record<string, EndState> = {
  belltower: { flags: ['huihui', 'belltower'], facing: 1 },
  bailu: { flags: ['metBailu'] },
};
