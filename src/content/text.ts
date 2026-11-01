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
  throw: '扔海星',
  throwUp: '斜着往上扔',
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
  // 第 2 关，见 docs/levels/1-2.md §4
  urchin: '那是刺海胆！浑身是刺，千万别踩！用海星打它！',
  spike: '呜哇，好扎好扎！',
  throwUp: '贝壳在上面……按住↑再扔，斜着飞上去！',
  gull: '冰喙鸥！它叫一声就要冲下来了，看准了躲开！',
  hang: '头顶上有东西在晃……快跑快跑！',
  stump: '树桩缝里好像有一块铃砖……海星钻得进去吗？',
  coconut: '椰子里有贝壳！再打一个！',
  climb: '往上爬！铃门在树冠顶上！',
  gate2: '冰霜脚印往海崖那边去了！',
};

/** 标题画面、菜单、设置、暂停 */
export const MENU_TEXT = {
  gameTitle: '四时铃',
  subtitle: 'PIXEL ISLE · 第一章 夏铃',
  pressAny: '按任意键开始',
  continue: '继续',
  newGame: '新游戏',
  gym: '练习场',
  settings: '设置',
  credits: '制作人员',
  resume: '继续游戏',
  restart: '重新开始本关',
  toTitle: '回到标题',
  paused: '暂停',
  back: '返回',
  yes: '确定',
  no: '取消',
  newGameConfirm: '开始新游戏会清除现在的进度（设置会保留）。确定吗？',
  toTitleConfirm: '回到标题画面？这一关的进度不会保存。',
  clearSave: '清除存档',
  clearSaveConfirm: '真的要清除全部存档吗？找到的海玻璃和最佳用时都会消失。',
  clearSaveConfirm2: '最后确认一次：清除后无法恢复。',
  saveCleared: '存档已清除',
  menuHint: '↑↓ 选择 · K 确认 · J 返回',
  settingHint: '←→ 调整 · J 返回',
  anyKey: '按任意键返回',
  master: '总音量',
  music: '音乐',
  sfx: '音效',
  shake: '震屏',
  shakeFull: '标准',
  shakeLow: '弱',
  shakeOff: '关',
  reduceFlash: '减少闪烁',
  autoRun: '自动奔跑',
  assist: '辅助模式',
  assistNote: '辅助模式：心 +2，下次进关生效',
  fullscreen: '全屏',
  on: '开',
  off: '关',
  controls: '操作说明',
  thanks: '感谢游玩！',
} as const;

/** 操作说明卡片 */
export const CONTROLS_TEXT = [
  'A D / ← →　移动（按住不放会跑起来）',
  'K / 空格 / Z　跳（按住跳得更高）',
  'W / ↑　和村民交谈',
  'S + K / ↓ + Z　从木板上跳下',
  'J / X　攻击（第 2 关起）',
  'Esc / Enter / P　暂停',
  '长按 Esc　跳过过场',
  '手柄：A 跳 · X 攻击 · Start 暂停',
];

/** 制作人员名单：[职责, 名字] */
export const CREDITS: Array<[string, string]> = [
  ['创意、试玩与指导', '本项目的发起人'],
  ['设计、程序、美术、音乐、故事', 'Claude'],
  ['游戏引擎', 'Phaser（MIT）'],
  ['像素字体', '缝合像素字体（SIL OFL 1.1）'],
  ['音效合成', 'ZzFX（MIT）· Frank Force'],
  ['调参面板', 'lil-gui（MIT）'],
];
