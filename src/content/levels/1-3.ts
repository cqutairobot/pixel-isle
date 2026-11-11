import { T_ONEWAY, T_WATER } from '../../sim/grid';
import { MAT_BOARDWALK, MAT_CLOUD, type EntityDef, type LevelDef } from '../../sim/level';
import { MapBuilder } from './builder';

/**
 * 第 3 关「回声崖」。设计见 docs/levels/1-3.md。
 * 360 列 × 36 行：A–C1 段的地面顶在第 28 行，下面的云海从第 32 行开始；
 * C2 段在一道竖井里从第 28 行爬到第 10 行；D 段沿第 10 行的山脊往东冲，崖缝里灌满了云。
 *
 * 图例：^ 崖石、= 栈道（单向）、R 裂岩（只有冲撞撞得碎）、~ 云海（掉进去按掉坑处理）、
 * D 回声石门、? 隐藏铃砖，其余同前两关（见 src/sim/level.ts）。
 * 实测的咩铃跳跃：第一跳最高 4.5 格、最远约 7.6 格（加上土狼时间能过约 9 格的缝）；
 * 二段跳最高 8 格、最远约 13 格；冲撞跳（冲刺一开始就起跳）约 14 格，接二段跳约 19 格。
 * 所以"要二段跳的缝"做成 10 格宽，"一跳就过的缝"4 格宽。
 */

const COLS = 360;
const ROWS = 36;
/** A–C 段地面的顶 */
const GROUND = 28;
/** D 段山脊的顶 */
const RIDGE = 10;

const b = new MapBuilder(COLS, ROWS);

/** 从第 top 行一直到最底下都是崖石 */
const ground = (c0: number, c1: number, top = GROUND) => b.fill(c0, top, c1, ROWS - 1, '^');
/** 一块 w × h 的裂岩，脚下是第 floor 行（站在第 floor 行上） */
const boulder = (c0: number, w: number, h: number, floor: number) =>
  b.fill(c0, floor - h, c0 + w - 1, floor - 1, 'R');
/** D 段的崖缝：山脊挖空，下面灌满云（云面离崖顶 4 格） */
const chasm = (c0: number, c1: number) => {
  b.fill(c0, RIDGE, c1, RIDGE + 3, '.');
  b.fill(c0, RIDGE + 4, c1, ROWS - 1, '~');
};

// 先在最底下铺一层云海（地面会把它盖住，只在缝里露出来）
b.fill(0, 32, COLS - 1, ROWS - 1, '~');

// —— A 教学 · 崖顶牧场（0–90 列）——
// A1：海崖栈道的起点，下面就是云海；然后是崖顶
b.row(GROUND, 0, 9, '=');
ground(10, 45);
b.put(2, GROUND - 1, 'P');
b.put(15, GROUND - 1, 'k');
b.put(18, GROUND - 4, 'B');
b.put(12, GROUND - 2, 's');
b.put(13, GROUND - 2, 's');
// A2：结冰的羊圈（第 30–32 列）：顶上一排木板（离地 3 格），冰晶在木板上面（实体表）
b.row(GROUND - 3, 30, 32, '=');
// A3：6 格高的崖坎，徒步怎么跳都上不去；贝壳画出二段跳的弧线
ground(46, 84, GROUND - 6);
for (const [c, r] of [
  [42, 25],
  [43, 24],
  [44, 23],
  [45, 22],
  [46, 21],
  [47, 20],
  [48, 20],
] as const)
  b.put(c, r, 's');
// A4：崖坎上的小路钻进一段 3 格高的矮洞（洞顶是一整块崖石），两块裂岩把洞堵死了：
// 咩铃跳得再高也跳不过去，只能撞（第一次冲撞）。第二块后面躲着一只霜壳蟹，撞碎石头顺便撞飞它；
// 出了洞沿栈道一级级走下来
b.fill(60, 12, 84, 18, '^');
boulder(66, 2, 3, GROUND - 6);
b.put(70, GROUND - 8, 's');
b.put(71, GROUND - 8, 's');
b.put(82, GROUND - 7, 'k');
boulder(78, 2, 3, GROUND - 6);
b.row(GROUND - 3, 85, 87, '=');
ground(85, 92);

// —— B 练习 · 云海石柱（90–180 列）——
// B1：三道要二段跳的缝（10 格）、一道一跳就过的缝（4 格）
ground(103, 107);
ground(118, 122, GROUND - 2);
ground(127, 131, GROUND - 1);
for (const [c, r] of [
  [95, 25],
  [97, 23],
  [99, 22],
  [101, 23],
] as const)
  b.put(c, r, 's');
b.put(120, GROUND - 6, 'M');
// B2：崖边长长的平地。一排霜壳蟹和一只蓝钳迎面走来，尽头一堵沙岩砖墙；
// 头顶的旧栈道（羊肠小道，要二段跳两次）通到一个旧羊圈，海玻璃 ② 在里面
ground(142, 187);
b.row(GROUND - 6, 143, 147, '=');
b.row(GROUND - 11, 150, 163, '=');
b.put(158, GROUND - 12, 'g');
b.put(152, GROUND - 12, 's');
b.put(154, GROUND - 12, 's');
for (const c of [150, 152, 154, 156]) b.put(c, GROUND - 1, 'k');
b.put(159, GROUND - 1, 'K');
b.put(166, GROUND - 2, 'b');
b.put(166, GROUND - 1, 'b');
// B4：检查点 ①
b.put(177, GROUND - 1, 'C');

// —— C 变化 · 回声石门与羊道（180–222 列）——
// C1：跳不过去的高崖壁（第 188–189 列），中间一扇被冻住的石门，门底下留着 1 格高的缝
b.fill(188, RIDGE, 189, 23, '^');
b.fill(188, 24, 189, 26, 'D');
ground(188, 220);
// 回声洞：洞顶（第 10–19 行）是一整块崖石
b.fill(190, RIDGE, 206, 19, '^');
b.put(192, GROUND - 1, 'v');
// 海玻璃 ①：回声照出来的两块隐藏铃砖当台阶，上到洞顶的暗格
b.put(196, 25, '?');
b.put(197, 22, '?');
b.fill(196, 17, 198, 19, '.');
b.put(197, 19, 'g');
// 海玻璃 ③：竖井左壁的一面裂岩后面藏着一个小洞（3 格高，上下左都是崖石，只有裂岩这一个口）。
// 站在第二级石台上朝左冲撞，冲出崖边撞碎裂岩；再从石台往上一跳就钻进去了
b.fill(203, 16, 205, 18, '.');
b.fill(206, 16, 206, 18, 'R');
b.put(204, 18, 'g');
// C2：羊道（第 207–220 列的竖井）：石台左右交替，每级高 4 格；最后一跳 9 格远、2 格高，要二段跳
b.fill(221, RIDGE, COLS - 1, ROWS - 1, '^');
b.row(24, 215, 220, '^');
b.row(20, 209, 212, '^');
b.row(16, 215, 220, '^');
b.row(12, 207, 211, '^');
b.put(207, 19, 's');
b.put(208, 19, 's');
b.put(217, 15, 's');
b.put(218, 15, 's');
// C3：爬到顶：检查点 ②
b.put(223, RIDGE - 1, 'C');

// —— D 考验 · 崖边冲刺（222–360 列，第 10 行的山脊）——
boulder(237, 2, 3, RIDGE);
chasm(243, 246);
boulder(251, 2, 3, RIDGE);
b.put(256, RIDGE - 1, 'K');
chasm(260, 269);
for (const [c, r] of [
  [261, 7],
  [263, 5],
  [265, 4],
  [267, 5],
] as const)
  b.put(c, r, 's');
b.put(276, RIDGE - 4, '$');
boulder(282, 2, 3, RIDGE);
chasm(288, 291);
boulder(298, 2, 3, RIDGE);
chasm(304, 313);
boulder(320, 2, 3, RIDGE);
boulder(324, 2, 3, RIDGE);
chasm(330, 339);
b.put(334, 6, 's');
b.put(335, 6, 's');
// D3：观景台和铃门
b.put(356, RIDGE - 1, 'G');

const decos: EntityDef[] = [
  // A
  { type: 'deco', kind: 'rail', at: [1, 27] },
  { type: 'deco', kind: 'pine', at: [11, 27] },
  { type: 'deco', kind: 'tuft', at: [16, 27] },
  { type: 'deco', kind: 'sign', at: [20, 27] },
  { type: 'deco', kind: 'tuft_b', at: [24, 27] },
  { type: 'deco', kind: 'pen', at: [30, 27] },
  { type: 'deco', kind: 'tuft', at: [36, 27] },
  { type: 'deco', kind: 'tuft_b', at: [50, 21] },
  { type: 'deco', kind: 'pine', at: [56, 21] },
  // B
  { type: 'deco', kind: 'tuft', at: [104, 27] },
  { type: 'deco', kind: 'tuft_b', at: [119, 25] },
  { type: 'deco', kind: 'sign', at: [142, 27] },
  { type: 'deco', kind: 'wool', at: [145, 23] },
  { type: 'deco', kind: 'wool', at: [151, 18] },
  { type: 'deco', kind: 'hoof', at: [144, 21] },
  { type: 'deco', kind: 'hoof', at: [146, 21] },
  { type: 'deco', kind: 'hoof', at: [151, 16] },
  { type: 'deco', kind: 'hoof', at: [154, 16] },
  { type: 'deco', kind: 'pen_old', at: [157, 16] },
  { type: 'deco', kind: 'pine', at: [147, 27] },
  { type: 'deco', kind: 'tuft', at: [163, 27] },
  { type: 'deco', kind: 'pen', at: [172, 27] },
  // C
  { type: 'deco', kind: 'tuft_b', at: [182, 27] },
  { type: 'deco', kind: 'swallow_nest', at: [187, 15] },
  { type: 'deco', kind: 'swallow_nest', at: [221, 20] },
  { type: 'deco', kind: 'pen', at: [225, 9] },
  // D
  { type: 'deco', kind: 'pine', at: [231, 9] },
  { type: 'deco', kind: 'tuft', at: [248, 9] },
  { type: 'deco', kind: 'mist_b', at: [262, 9] },
  { type: 'deco', kind: 'pine', at: [274, 9] },
  { type: 'deco', kind: 'tuft_b', at: [293, 9] },
  { type: 'deco', kind: 'mist', at: [306, 9] },
  { type: 'deco', kind: 'pine', at: [315, 9] },
  { type: 'deco', kind: 'tuft', at: [327, 9] },
  { type: 'deco', kind: 'sign', at: [341, 9] },
  { type: 'deco', kind: 'rail', at: [344, 9] },
  { type: 'deco', kind: 'pine', at: [348, 9] },
  { type: 'deco', kind: 'footprints', at: [340, 9] },
];

export const level13: LevelDef = {
  id: '1-3',
  name: '回声崖',
  themes: [{ from: 0, theme: 'cliff' }],
  // 回回一直跟着；海星从 1-2 起就带着
  flags: ['huihui', 'starfish'],
  music: 'cliff',
  legend: {
    '=': { tile: T_ONEWAY, material: MAT_BOARDWALK },
    '~': { tile: T_WATER, material: MAT_CLOUD },
  },
  entities: [
    // NPC：谷雨开场在羊圈旁边，救出咩铃以后去铃门那边等
    { type: 'npc', id: 'guyu', at: [26, 27], facing: 1, unless: 'mieling' },
    { type: 'npc', id: 'guyu_gate', at: [352, 9], facing: -1, if: 'mieling' },
    // 咩铃：冻在第一个羊圈里；三个羊圈（死了以后她在最近的那个里等）
    { type: 'goat', at: [31, 27], facing: -1 },
    { type: 'pen', at: [31, 27] },
    { type: 'pen', at: [173, 27] },
    { type: 'pen', at: [226, 9] },
    { type: 'crystal', at: [31, 24] },
    { type: 'echoBell', at: [201, 27] },
    // 三枚海玻璃：① 回声洞顶的暗格，② 羊肠小道尽头的旧羊圈，③ 竖井左壁裂岩后面
    { type: 'glass', at: [197, 19], index: 0 },
    { type: 'glass', at: [158, 16], index: 1 },
    { type: 'glass', at: [204, 18], index: 2 },
    // 崖燕：B3 两只同高；D 段两组高低错开。被撞下坐骑会往后弹将近 2 格，
    // 所以触发线离身后的崖缝至少 3 格（关卡校验实测）；第 3 组到的时候正好在裂岩前，一次冲撞两样都撞开
    { type: 'swallows', rect: [168, 0, 2, 36], rows: [26, 26], from: 1 },
    { type: 'swallows', rect: [274, 0, 2, 36], rows: [9, 6], from: 1 },
    { type: 'swallows', rect: [295, 0, 2, 36], rows: [9, 6, 9], from: 1 },
    // A4 的矮洞、回声洞（连着石门底下的缝和洞顶的两个暗格）、羊道竖井的背墙
    { type: 'backdrop', kind: 'cave', rect: [60, 19, 25, 3] },
    { type: 'backdrop', kind: 'crevice', rect: [205, 10, 16, 18] },
    { type: 'backdrop', kind: 'cave', rect: [188, 16, 19, 12] },
    // 羊道：纵向镜头区域
    { type: 'cameraZone', rect: [205, 2, 17, 27] },
    // 过场：开场（谷雨的请求）、结尾（谷雨的谢意）；"咩铃出圈""回声"由冰晶、回声铃触发
    { type: 'trigger', id: 'guyu', rect: [22, 0, 1, 36], unless: 'mieling' },
    { type: 'trigger', id: 'thanks', rect: [346, 0, 1, 36], unless: 'thanks13' },
    // 回回的提示和按键提示（不停下世界）
    { type: 'trigger', id: 'echo13', rect: [6, 0, 1, 36], blocking: false },
    { type: 'trigger', id: 'key:stomp', rect: [24, 0, 1, 36], blocking: false, unless: 'mieling' },
    { type: 'trigger', id: 'hint:double', rect: [39, 0, 1, 36], blocking: false },
    { type: 'trigger', id: 'key:doubleJump', rect: [40, 0, 1, 36], blocking: false },
    { type: 'trigger', id: 'hint:rock', rect: [61, 0, 1, 36], blocking: false },
    { type: 'trigger', id: 'key:charge', rect: [62, 0, 1, 36], blocking: false },
    { type: 'trigger', id: 'hint:crabs', rect: [144, 0, 1, 36], blocking: false },
    { type: 'trigger', id: 'hint:stoneGate', rect: [183, 0, 1, 36], blocking: false },
    { type: 'trigger', id: 'key:dismount', rect: [184, 0, 1, 36], blocking: false },
    { type: 'trigger', id: 'hint:climb3', rect: [209, 20, 1, 9], blocking: false },
    { type: 'trigger', id: 'hint:rush', rect: [229, 0, 1, 36], blocking: false },
    ...decos,
  ],
  chunks: [b.toChunk()],
};
