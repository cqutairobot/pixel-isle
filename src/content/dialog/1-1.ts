/**
 * 第 1 关的对白（docs/levels/1-1.md §4）。说话人见 src/content/speakers.ts。
 * 文字标签：{color=gold}…{/color}、{wave}…{/wave}、{shake}…{/shake}、{pause=毫秒}。
 */

export interface Line {
  /** 说话人编号；'narrator' 是旁白（居中、没有头像） */
  who: string;
  text: string;
  /** 头像表情（不写就是普通） */
  face?: string;
}

/** NPC 交谈：第一次 / 之后再交谈 / 特殊状态 */
export const NPC_TALK: Record<string, { first: Line[]; again: Line[]; after?: Line[] }> = {
  haishen: {
    first: [
      { who: 'haishen', text: '小满早啊！今天大钟一声都没响，村里的鸡都不知道该不该打鸣了。' },
      { who: 'haishen', text: '你爷爷该不会病了吧？快去钟楼瞧瞧。' },
    ],
    again: [{ who: 'haishen', text: '钟楼就在村子东头，顺着大路一直走就到啦。' }],
  },
  adou: {
    first: [
      { who: 'adou', text: '小满姐姐！大钟今天没响，我想敲风铃代替它报晨！' },
      { who: 'adou', text: '奶奶教过我早安歌，是{color=gold}大、小、中、大{/color}！' },
      { who: 'adou', text: '可是最小的那只挂得太高了……姐姐帮我敲嘛！' },
    ],
    again: [
      {
        who: 'adou',
        text: '早安歌是{color=gold}大、小、中、大{/color}！跳起来碰一下风铃，它就会响。',
      },
    ],
    after: [{ who: 'adou', text: '风铃一响，今天一定是个好天气！' }],
  },
  bailu: {
    first: [],
    again: [{ who: 'bailu', text: '掉进海里会冻得一激灵，看准了再跳。' }],
  },
};

/** 解开风铃时阿豆说的话 */
export const ADOU_SOLVED: Line[] = [
  { who: 'adou', text: '{wave}哇——是早安歌！{/wave}', face: 'happy' },
  { who: 'adou', text: '风铃里掉出来一块亮晶晶的！是海玻璃！送给姐姐！', face: 'happy' },
];

/** 开场：小满推门出来 */
export const INTRO: Line[] = [
  { who: 'xiaoman', text: '呼啊——睡得真香！', face: 'happy' },
  { who: 'xiaoman', text: '……咦？太阳都出来了，晨钟怎么还没响？', face: 'surprised' },
  { who: 'xiaoman', text: '爷爷一定又睡过头了！去钟楼看看！', face: 'determined' },
];

/** 钟楼前（回回登场） */
export const BELLTOWER: Line[][] = [
  [{ who: 'xiaoman', text: '爷爷——我来啦！今天的钟怎么……' }],
  [
    { who: 'xiaoman', text: '爷、爷爷？！你怎么冻成冰块了！', face: 'surprised' },
    { who: 'xiaoman', text: '好冰……现在可是夏天啊！', face: 'sad' },
  ],
  [
    { who: 'huihui', text: '叮……叮！你好你好！', face: 'happy' },
    { who: 'xiaoman', text: '哇啊！会说话的……铃铛？', face: 'surprised' },
    { who: 'huihui', text: '我是回回，大钟的回音！回音、回音！' },
    {
      who: 'huihui',
      text: '昨天夜里，一个戴面具的人偷走了四枚时令铃。爷爷去拦他，就被冻住了……冻住了……',
      face: 'worry',
    },
    { who: 'xiaoman', text: '时令铃没了？那岛上的季节会怎么样？', face: 'sad' },
    {
      who: 'huihui',
      text: '夏天会被冰霜一点点吃掉。只有把时令铃找回来、挂回大钟上，爷爷才能化开。',
      face: 'worry',
    },
    { who: 'huihui', text: '你看，地上的冰霜脚印一直通到东边的海边……对吧对吧？' },
    { who: 'xiaoman', text: '爷爷，你等着！{shake}包在我身上！{/shake}', face: 'determined' },
    { who: 'huihui', text: '包在我身上！……啊不对，是包在你身上！我也一起去！', face: 'happy' },
  ],
];

/** 白露（检查点 ① 旁，第一次到达时） */
export const BAILU_MEET: Line[] = [
  { who: 'bailu', text: '哟，这不是小满吗？一大早背着个会发光的铃铛，要去哪儿？' },
  { who: 'huihui', text: '我是回回！回回！', face: 'happy' },
  { who: 'xiaoman', text: '白露姐！有人偷了钟楼的时令铃，爷爷被冻住了！我们在追冰霜脚印！' },
  { who: 'bailu', text: '难怪今天的海水这么冰……天亮前，我看见一大块怪冰漂向东边的潮汐神龛。' },
  { who: 'bailu', text: '前面的栈桥又湿又滑，掉进海里可不是闹着玩的，别逞强。' },
  { who: 'bailu', text: '对了——过了沙滩就是椰林，到时候来找我，我有个好东西借你。', face: 'smirk' },
  { who: 'xiaoman', text: '好东西？！是什么是什么？', face: 'surprised' },
  { who: 'bailu', text: '秘密。先走吧，记得看着脚下。', face: 'smirk' },
];

/** 序章「霜夜」 */
export const PROLOGUE: Line[][] = [
  [
    { who: 'narrator', text: '时令岛的钟楼上，挂着一口四时大钟。' },
    {
      who: 'narrator',
      text: '每天清晨大钟一响，春、夏、秋、冬四枚时令铃就跟着共鸣，岛上的季节才能一天天流转。',
    },
  ],
  [
    { who: 'shuangjiang', text: '花开了又谢，叶绿了又黄……年年如此，真是无趣。' },
    { who: 'shuangjiang', text: '不如，就让季节停在最冷的那一刻吧。' },
  ],
  [{ who: 'shuangjiang', text: '小东西，这枚夏铃给你当壳。替我好好看着。' }],
  [
    { who: 'grandpa', text: '{shake}站住！{/shake}把时令铃放下！' },
    { who: 'shuangjiang', text: '守钟人……你也该歇歇了。' },
  ],
];

/** 序章最后的字幕 */
export const PROLOGUE_CAPTION = '第二天清晨——';

/** 钟楼过场结束后的屏幕提示 */
export const BELLTOWER_TIP = '沿着冰霜脚印往东走';

export function allDialogText(): string[] {
  const lines: Line[] = [
    ...Object.values(NPC_TALK).flatMap((n) => [...n.first, ...n.again, ...(n.after ?? [])]),
    ...ADOU_SOLVED,
    ...INTRO,
    ...BELLTOWER.flat(),
    ...BAILU_MEET,
    ...PROLOGUE.flat(),
  ];
  return [...lines.map((l) => l.text), PROLOGUE_CAPTION, BELLTOWER_TIP];
}
