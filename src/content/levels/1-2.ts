import { T_ONEWAY } from '../../sim/grid';
import { MAT_VINE, type EntityDef, type LevelDef } from '../../sim/level';

/**
 * 第 2 关「椰影小径」。设计见 docs/levels/1-2.md。
 * 300 列 × 32 行：A–C 段的地面顶在第 28 行；D 段从第 28 行沿着大叶子一路爬到第 6 行的树冠顶。
 *
 * 地图用下面的小工具一段一段"画"出来，比手写 300 列的字符串好读、好改。
 * 图例：& 林地、- 椰树叶（单向）、= 藤蔓吊桥（单向）、T 树皮（倒木、树桩、树枝）、~ 小溪，
 * u 刺海胆（慢慢爬）、v 刺海胆（不动）、U 倒挂刺海胆、w 冰喙鸥，其余同 1-1（见 src/sim/level.ts）。
 */

const COLS = 300;
const ROWS = 32;
/** A–C 段地面的顶 */
const GROUND = 28;

const map: string[][] = Array.from({ length: ROWS }, () => new Array<string>(COLS).fill('.'));

/** 在 (c, r) 放一个字符 */
function put(c: number, r: number, ch: string): void {
  map[r]![c] = ch;
}

/** 填满一个矩形（含两端） */
function fill(c0: number, r0: number, c1: number, r1: number, ch: string): void {
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) put(c, r, ch);
}

/** 一段横着的平台（叶子、吊桥、树枝）：第 r 行，从 c0 到 c1 */
function row(r: number, c0: number, c1: number, ch: string): void {
  fill(c0, r, c1, r, ch);
}

/** 小溪：c0–c1 列没有地面，水面在地面下一格 */
function stream(c0: number, c1: number): void {
  fill(c0, GROUND, c1, GROUND, '.');
  fill(c0, GROUND + 1, c1, ROWS - 1, '~');
}

// 整关先铺满地面
fill(0, GROUND, COLS - 1, ROWS - 1, '&');

// —— A 教学 · 椰林入口（0–72 列）——
// A1：白露的小屋。出生点在最左边，走到第 9 列触发开场
put(2, GROUND - 1, 'P');
// A2：一棵横倒的巨大椰树，底下只剩一格高的隧道；隧道里一只不动的刺海胆，跳不过去
fill(16, 22, 30, 26, 'T');
put(24, GROUND - 1, 'v');
// A3：平地上两只慢慢爬的刺海胆，旁边一棵椰子树（实体表）
put(36, GROUND - 1, 'u');
put(41, GROUND - 1, 'u');
// A4–A5：小溪上的高吊桥。岸边一截倒木当台阶；吊桥底下、小溪上方沿 45° 斜线悬着一串贝壳，
// 站在岸边斜着往上扔正好捞到（跳过去够得着，可是会掉进冷水里）
fill(51, 26, 53, 27, 'T');
stream(56, 69);
row(23, 54, 69, '=');
put(56, 26, 's');
put(57, 25, 's');
put(58, 24, 's');
put(64, 22, 'k');

// —— B 练习 · 林间空地（72–150 列）——
// B1：倒木搭成的阶梯，一级比一级高，每级上一只刺海胆
row(GROUND - 1, 75, 78, 'T');
row(GROUND - 2, 79, 82, 'T');
fill(79, GROUND - 1, 82, GROUND - 1, '&');
row(GROUND - 3, 83, 86, 'T');
fill(83, GROUND - 2, 86, GROUND - 1, '&');
row(GROUND - 4, 87, 90, 'T');
fill(87, GROUND - 3, 90, GROUND - 1, '&');
put(77, GROUND - 2, 'u');
put(81, GROUND - 3, 'u');
put(85, GROUND - 4, 'u');
put(89, GROUND - 5, 'u');
// B2：开阔的空地，第一只冰喙鸥；一串往左上的椰树叶通到鸥巢（可选路线，最后一级要满跳 4 格）
put(105, 21, 'w');
row(25, 110, 113, '-');
row(22, 105, 108, '-');
row(19, 100, 103, '-');
row(16, 95, 98, '-');
row(12, 88, 93, '-');
put(90, 11, 'g');
put(92, 11, 's');
put(89, 11, 's');
// B3：冰喙鸥和霜壳蟹，头顶一排铃砖
put(122, 24, 'B');
put(126, 24, 'M');
put(130, 24, 'B');
put(128, 20, 'w');
put(124, GROUND - 1, 'k');
put(136, GROUND - 1, 'k');
// B4：检查点 ①
put(146, GROUND - 1, 'C');

// —— C 变化 · 藤蔓吊桥（150–222 列）——
// C1：小溪上两段低吊桥；头顶的树枝下面倒挂着刺海胆
stream(153, 172);
row(27, 153, 161, '=');
row(27, 164, 172, '=');
row(22, 155, 160, 'T');
row(22, 166, 171, 'T');
put(157, 23, 'U');
put(168, 23, 'U');
put(159, 26, 's');
put(160, 26, 's');
put(165, 26, 's');
put(166, 26, 's');
// C2：空心树桩。左边一截矮木头当台阶；树桩底部有一道缝，缝的尽头是一块铃砖（海玻璃 ①）
row(GROUND - 1, 175, 176, 'T');
fill(178, 24, 180, 26, 'T');
put(180, GROUND - 1, 'B');
// C3：树林里的小路，头顶树枝下倒挂着刺海胆，地上一只刺海胆；会掉芒果的椰子树（实体表）
row(22, 191, 196, 'T');
row(22, 202, 207, 'T');
put(193, 23, 'U');
put(205, 23, 'U');
put(186, GROUND - 1, 'v');
// C4：检查点 ②，大暑推着冰沙车歇脚
put(218, GROUND - 1, 'C');

// —— D 考验 · 树冠攀登（222–300 列，第 28 行 → 第 6 行）——
// D1：巨大椰树的底部，大叶子之字形往上排，每级高 3 格
row(25, 224, 229, '-');
row(22, 231, 236, '-');
row(19, 225, 230, '-');
row(16, 232, 237, '-');
// D2：爬到一半：冰喙鸥在不同高度盘旋，上面叶子的底下倒挂着刺海胆
row(13, 239, 244, '-');
row(10, 246, 251, '-');
row(8, 240, 245, '-');
row(6, 247, 252, '-');
put(242, 9, 'U');
put(249, 7, 'U');
put(240, 11, 'w');
put(243, 7, 's');
put(244, 7, 's');
// D2'：树冠外侧的一截短叶子，海玻璃 ③ 悬在它右上方很高的地方：
// 跳不到、站着斜扔也够不到，要从叶子上起跳，在最高点附近斜着往上扔
row(17, 252, 256, '-');
put(261, 9, 'g');
// D3：树冠顶。先是一根粗树枝（实心，不能往下穿），然后是一排大叶子，最后一只冰喙鸥，铃门
row(6, 254, 266, 'T');
row(6, 268, 275, '-');
row(6, 278, 285, '-');
row(6, 287, 299, '-');
put(258, 2, 'w');
put(282, 2, 'w');
put(271, 5, 's');
put(272, 5, 's');
put(273, 5, 's');
put(296, 5, 'G');

const decos: EntityDef[] = [
  // A
  { type: 'deco', kind: 'hut', at: [4, 27] },
  { type: 'deco', kind: 'palm', at: [13, 27] },
  { type: 'deco', kind: 'fern', at: [11, 27] },
  { type: 'deco', kind: 'mushrooms', at: [14, 27] },
  { type: 'deco', kind: 'vine_l', at: [19, 27] },
  { type: 'deco', kind: 'fern_b', at: [33, 27] },
  { type: 'deco', kind: 'mushrooms', at: [38, 27] },
  { type: 'deco', kind: 'fern', at: [48, 27] },
  { type: 'deco', kind: 'vine_s', at: [60, 24] },
  { type: 'deco', kind: 'vine_s', at: [67, 24] },
  { type: 'deco', kind: 'footprints', at: [70, 27] },
  // B
  { type: 'deco', kind: 'fern_b', at: [92, 27] },
  { type: 'deco', kind: 'palm_small', at: [98, 27] },
  { type: 'deco', kind: 'nest', at: [90, 11] },
  { type: 'deco', kind: 'front_hang', at: [84, 7] },
  { type: 'deco', kind: 'mushrooms', at: [116, 27] },
  { type: 'deco', kind: 'palm', at: [133, 27] },
  { type: 'deco', kind: 'fern', at: [141, 27] },
  // C
  { type: 'deco', kind: 'vine_s', at: [157, 23] },
  { type: 'deco', kind: 'vine_l', at: [170, 23] },
  { type: 'deco', kind: 'fern_b', at: [183, 27] },
  { type: 'deco', kind: 'vine_s', at: [195, 23] },
  { type: 'deco', kind: 'front_rise', at: [189, 27] },
  { type: 'deco', kind: 'vine_l', at: [204, 23] },
  { type: 'deco', kind: 'front_hang', at: [200, 17] },
  { type: 'deco', kind: 'cart', at: [212, 27] },
  { type: 'deco', kind: 'mushrooms', at: [220, 27] },
  // D
  { type: 'deco', kind: 'giant_trunk', at: [238, 27] },
  { type: 'deco', kind: 'giant_crown', at: [238, 1] },
  { type: 'deco', kind: 'fern', at: [226, 27] },
  { type: 'deco', kind: 'fern_b', at: [262, 27] },
  { type: 'deco', kind: 'vine_l', at: [258, 7] },
  { type: 'deco', kind: 'vine_s', at: [264, 7] },
  { type: 'deco', kind: 'footprints', at: [268, 5] },
];

export const level12: LevelDef = {
  id: '1-2',
  name: '椰影小径',
  themes: [{ from: 0, theme: 'grove' }],
  // 回回从第 1 关的钟楼起就一直跟着小满
  flags: ['huihui'],
  // 1-2 的曲子在 M2-b 才写，先用沙滩那首
  music: 'beach',
  // 椰林里的 = 是藤蔓吊桥
  legend: { '=': { tile: T_ONEWAY, material: MAT_VINE } },
  entities: [
    // NPC
    { type: 'npc', id: 'bailu', at: [11, 27], facing: -1 },
    { type: 'npc', id: 'daishu', at: [215, 27], facing: -1 },
    // 椰子树：海星打树冠会掉椰子（C3 那棵最后一个椰子里是芒果）
    { type: 'coconutTree', at: [44, 27], coconuts: 2 },
    { type: 'coconutTree', at: [117, 27], coconuts: 2 },
    { type: 'coconutTree', at: [199, 27], coconuts: 2, mango: true },
    // 三枚海玻璃：① 树桩缝里的铃砖，② 鸥巢，③ 树冠外侧
    { type: 'glass', at: [180, 27], index: 0 },
    { type: 'glass', at: [90, 11], index: 1 },
    { type: 'glass', at: [261, 9], index: 2 },
    // 开场：白露借出海星（拿到海星以后再来就不放了）
    { type: 'trigger', id: 'starfish', rect: [9, 0, 1, 32], unless: 'starfish' },
    // 按键提示与回回的提示（不停下世界）
    { type: 'trigger', id: 'hint:urchin', rect: [14, 0, 1, 32], blocking: false },
    { type: 'trigger', id: 'hint:throwUp', rect: [52, 0, 3, 32], blocking: false },
    { type: 'trigger', id: 'key:throwUp', rect: [54, 0, 1, 32], blocking: false },
    { type: 'trigger', id: 'hint:stump', rect: [174, 0, 1, 32], blocking: false },
    { type: 'trigger', id: 'hint:climb', rect: [223, 0, 1, 32], blocking: false },
    ...decos,
  ],
  chunks: [map.map((r) => r.join('')).join('\n')],
};
