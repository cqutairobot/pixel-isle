/**
 * 界面文字（简体中文）。所有显示给玩家的文字都放在 src/content/ 里，
 * 启动时据此生成字库；tests/glyphs.test.ts 检查有没有缺字、会不会超出文本框。
 */
export const UI_TEXT = {
  levelTitle: '1-1 晨钟村 · 晨光沙滩',
  chapter: '第一章 · 夏铃',
  checkpoint: '已记录',
  glassFound: '找到海玻璃',
  glassAgain: '这枚已经找到过了',
  sunFruit: '太阳果！',
  paused: '已暂停',
  pauseHint: 'Esc 继续 · R 重新开始',
  tallyTitle: '晨光沙滩 · 通关！',
  time: '用时',
  shells: '贝壳',
  glass: '海玻璃',
  noDamage: '无伤',
  newRecord: '新纪录',
  retry: '再玩一次',
  next: '继续',
  comingSoon: '第 2 关「椰影小径」正在制作中，敬请期待！',
  confirmHint: 'K / 空格 确认',
  skipKey: '长按 Esc 跳过',
  skipPad: '长按 Start 跳过',
} as const;

/** 屏幕下方的按键提示 */
export const KEY_HINTS = {
  move: '移动',
  jump: '跳（按住跳得更高）',
  run: '按住方向键不放会跑起来',
  talk: '交谈',
  drop: '从木板上跳下',
} as const;

/** 回回的提示气泡（每条只出现一次），见 docs/levels/1-1.md §4 */
export const HINTS: Record<string, string> = {
  crab: '它背上长着冰晶！跳起来，踩它的背！',
  firstStomp: '冰晶碎啦，螃蟹变回原样了~',
  block: '那是铃砖！从下面顶一下试试！',
  attack: '现在还没有装备，先用踩的吧！',
  pier: '掉进海里可冷了，看准了再跳！',
  water: '呜哇，好冰好冰！',
  sun: '是太阳果！吃了浑身暖洋洋，冰晶一碰就化！',
  cp2: '冰霜脚印越来越密了……前面一定有很多被冻住的小动物。',
  gate: '脚印往椰林里去了！下一站，椰影小径！',
};
