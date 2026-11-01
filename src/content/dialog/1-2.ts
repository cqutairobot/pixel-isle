import type { Line } from './line';

/**
 * 第 2 关的对白（docs/levels/1-2.md §4）。说话人见 src/content/speakers.ts，文字标签见 ./line.ts。
 */

/** NPC 交谈：第一次 / 之后再交谈 */
export const NPC_TALK_12: Record<string, { first: Line[]; again: Line[]; after?: Line[] }> = {
  bailu: {
    first: [],
    again: [
      {
        who: 'bailu',
        text: '海星还顺手吧？扔的时候按住{color=gold}↑{/color}，能斜着往上扔。',
        face: 'smirk',
      },
    ],
  },
  daishu: {
    first: [
      {
        who: 'daishu',
        text: '呼……呼……这天怎么忽冷忽热的，我的冰沙都不知道该化还是不化。',
        face: 'sweat',
      },
      {
        who: 'daishu',
        text: '小姑娘，等我在海崖下面摆好摊，来照顾生意啊。冰沙管够——冰嘛，最近最不缺的就是冰，哈哈哈……哈。',
        face: 'laugh',
      },
      { who: 'huihui', text: '……好冷的笑话。冷、冷……', face: 'worry' },
    ],
    again: [{ who: 'daishu', text: '我的冰沙摊就开在海崖下面。贝壳带够哦。' }],
  },
};

/** 1-2 开场「白露的海星」：三段对白，中间穿插扔海星打椰子、把海星借给小满 */
export const STARFISH_OPENING: Line[][] = [
  [
    { who: 'bailu', text: '来了？比我想的快嘛。', face: 'smirk' },
    { who: 'xiaoman', text: '白露姐！你说的好东西呢？', face: 'happy' },
    { who: 'bailu', text: '看好了——' },
  ],
  [
    { who: 'huihui', text: '哇！差、差点砸到我！砸到我！', face: 'worry' },
    {
      who: 'bailu',
      text: '这是{color=gold}回旋海星{/color}。扔出去会自己飞回来，路上碰到的东西也会顺手捞回来。',
    },
    { who: 'bailu', text: '椰林里多了好些长刺的怪海胆，踩不得。用它打。' },
  ],
  [
    { who: 'bailu', text: '借你的，{color=gold}记得还我{/color}！', face: 'smirk' },
    { who: 'xiaoman', text: '包在我身上！', face: 'determined' },
    { who: 'huihui', text: '包在你身上！……这次说对了吧？对吧对吧？', face: 'happy' },
  ],
];

/** 拿到海星时的屏幕提示（完整的获得道具演出在 M2-b） */
export const STARFISH_GET = '得到了「回旋海星」！';

export function allDialogText12(): string[] {
  const lines: Line[] = [
    ...Object.values(NPC_TALK_12).flatMap((n) => [...n.first, ...n.again, ...(n.after ?? [])]),
    ...STARFISH_OPENING.flat(),
  ];
  return [...lines.map((l) => l.text), STARFISH_GET];
}
