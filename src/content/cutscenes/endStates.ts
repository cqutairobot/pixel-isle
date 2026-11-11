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
  // 1-2 开场：白露把回旋海星借给小满，小满还站在原地（第 9 列）
  starfish: { flags: ['starfish'], player: [9, 27], facing: 1 },
  // 1-3 开场：谷雨的请求（小满还站在原地）
  guyu: {},
  // 1-3 咩铃出圈：小满站在羊圈左边（第 29 列），咩铃在羊圈门口朝着她；谷雨去铃门那边等
  rescue: {
    flags: ['mieling'],
    player: [29, 27],
    facing: 1,
    goat: { at: [31, 27], facing: -1 },
  },
  // 1-3 回声：石门打开，咩铃跑到回声铃旁边（第 197 列）
  echo: { flags: ['echo'], goat: { at: [197, 27], facing: 1 } },
  // 1-3 结尾：小满下来站在第 348 列，咩铃留在谷雨身边（不能再骑）
  thanks: {
    flags: ['thanks13'],
    mounted: false,
    player: [348, 9],
    facing: 1,
    goat: { at: [351, 9], facing: 1, mode: 'home' },
  },
};
