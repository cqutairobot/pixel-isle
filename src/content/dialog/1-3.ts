import type { Line } from './line';

/**
 * 第 3 关的对白（docs/levels/1-3.md §4）。说话人见 src/content/speakers.ts，文字标签见 ./line.ts。
 */

/** NPC 交谈：开场后羊圈旁边的谷雨、铃门旁边的谷雨 */
export const NPC_TALK_13: Record<string, { first: Line[]; again: Line[]; after?: Line[] }> = {
  guyu: {
    first: [],
    again: [
      { who: 'guyu', text: '快、快帮帮咩铃！要从上面踩冰晶！', face: 'cry' },
      { who: 'huihui', text: '先跳到羊圈顶上，再踩！再踩！' },
    ],
  },
  guyu_gate: {
    first: [],
    again: [{ who: 'guyu', text: '冻浪湾在东边，那边冷得要命，多穿点！', face: 'happy' }],
  },
};

/** 开场「谷雨的请求」：第一段在谷雨身边，第二段镜头移到结冰的羊圈 */
export const GUYU_PLEA: Line[][] = [
  [
    { who: 'huihui', text: '有人在哭……在哭……', face: 'worry' },
    { who: 'xiaoman', text: '你怎么啦？' },
    { who: 'guyu', text: '呜……咩铃……我的咩铃被冻在羊圈里了……', face: 'cry' },
    {
      who: 'guyu',
      text: '昨天夜里刮来一阵好冷好冷的风，早上起来，羊圈就变成这样了……',
      face: 'cry',
    },
  ],
  [
    { who: 'huihui', text: '是{color=frost}霜之力{/color}！冰晶长在顶上……顶上！', face: 'worry' },
    { who: 'xiaoman', text: '别哭别哭，包在我身上！', face: 'determined' },
    { who: 'guyu', text: '真、真的吗？……咩铃一直在跺脚，她是说"从上面踩"！' },
    { who: 'huihui', text: '羊……会说话？' },
    { who: 'guyu', text: '跺脚就是这个意思！', face: 'pout' },
  ],
];

/** 「咩铃出圈」：冰晶碎掉以后；中间是"新伙伴"演出 */
export const MIELING_FREE: Line[][] = [
  [
    { who: 'guyu', text: '咩铃！', face: 'happy' },
    { who: 'mieling', text: '咩——！', face: 'happy' },
    { who: 'guyu', text: '她……她在谢谢你。她平时谁都不理的！', face: 'happy' },
  ],
  [
    { who: 'guyu', text: '咦？她要你骑上去！' },
    {
      who: 'guyu',
      text: '前面的崖路全是裂开的大石头，还有好宽好宽的缝……只有咩铃撞得开、跳得过。',
    },
    { who: 'guyu', text: '求求你……帮我们把冰赶走，好不好？', face: 'cry' },
    { who: 'xiaoman', text: '包在我身上！', face: 'determined' },
    { who: 'huihui', text: '包在……羊身上！', face: 'happy' },
  ],
  [
    { who: 'guyu', text: '我走羊肠小道先过去，在崖那头等你们！咩铃，要听话哦！' },
    { who: 'mieling', text: '哼。', face: 'smug' },
  ],
];

/** 结尾「谷雨的谢意」；petted 是摸过咩铃时多出来的两句 */
export const GUYU_THANKS: Line[][] = [
  [
    { who: 'guyu', text: '小满姐姐！咩铃！你们真的冲过来了！', face: 'happy' },
    { who: 'guyu', text: '谢谢你……我、我才没哭！是风太大了！', face: 'pout' },
    { who: 'huihui', text: '风太大了……太大了……', face: 'happy' },
  ],
  [
    {
      who: 'guyu',
      text: '对了！昨天夜里，我在崖上看见一只好大好大的螃蟹，背上驮着{color=gold}亮晶晶的东西{/color}，往冻浪湾那边爬过去了。',
    },
    { who: 'huihui', text: '亮晶晶的……是夏铃！一定是夏铃！', face: 'worry' },
    { who: 'xiaoman', text: '冻浪湾……我们走！', face: 'determined' },
  ],
  [{ who: 'guyu', text: '咩铃得留下来看家。路上小心！', face: 'happy' }],
];

export const GUYU_THANKS_PETTED: Line[] = [
  { who: 'guyu', text: '咩铃居然让你摸她的头……她真的好喜欢你。', face: 'happy' },
  { who: 'mieling', text: '咩～', face: 'happy' },
];

/** A1 回回冲着山谷喊，回声从画面右边传回来（提示气泡） */
export const ECHO_GAG: Array<{ who: 'huihui' | 'echo'; text: string }> = [
  { who: 'huihui', text: '回声崖——！' },
  { who: 'echo', text: '……声崖……崖……' },
  { who: 'huihui', text: '谁、谁在学我说话！' },
];

export function allDialogText13(): string[] {
  const lines: Line[] = [
    ...Object.values(NPC_TALK_13).flatMap((n) => [...n.first, ...n.again, ...(n.after ?? [])]),
    ...GUYU_PLEA.flat(),
    ...MIELING_FREE.flat(),
    ...GUYU_THANKS.flat(),
    ...GUYU_THANKS_PETTED,
  ];
  return [...lines.map((l) => l.text), ...ECHO_GAG.map((l) => l.text)];
}
