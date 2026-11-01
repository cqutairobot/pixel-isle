import { compose, grid, type PixelGrid, type Sheet } from './sprite';

/**
 * 主角小满：16×18，脚底中心为原点，默认朝右。
 * 用"部件拼合"生成各帧：帽子、头、上身、裙子、腿各自有几种变体，保证帧与帧之间一致。
 * 帽子上红丝带的两条飘带由代码绘制（src/view/ribbon.ts），这里只画帽带与结。
 */
export const HERO_W = 16;
export const HERO_H = 18;

export const HERO_KEYS = {
  o: 'ink',
  h: 'straw',
  y: 'gold',
  H: 'ochre',
  r: 'red2',
  R: 'red1',
  n: 'night',
  s: 'skin2',
  S: 'skin1',
  p: 'blush',
  e: 'ink',
  w: 'white',
  W: 'cloud',
  t: 'teal',
  T: 'sea',
  b: 'bark',
} as const;

// 帽子：第 0–5 行
const HAT = grid(`
  .....oooooo.....
  ....oyyhhhho....
  ....oyhhhhHo....
  ...orrrrrrrRo...
  ooyyhhhhhhhhhhoo
  oHHHHHHHHHHHHHHo
`);

// 头：第 6–10 行（帽檐下沿、刘海、眼睛、腮红、下巴）。波波头，后脑的头发垂到下巴。
const HEAD = grid(`
  .ooonnnnnnnnooo.
  ...onnnnnnnnso..
  ...onnnsesesso..
  ...onnssesepso..
  ...onSssssso....
`);
const HEAD_BLINK = grid(`
  .ooonnnnnnnnooo.
  ...onnnnnnnnso..
  ...onnnsssssso..
  ...onnssesepso..
  ...onSssssso....
`);
// 受伤 / 打哈欠：紧闭的眼睛 + 张开的嘴
const HEAD_OUCH = grid(`
  .ooonnnnnnnnooo.
  ...onnnnnnnnso..
  ...onnnsssssso..
  ...onnssesepso..
  ...onSssessso...
`);
// 开心：眯成弯弯的眼睛 + 微笑
const HEAD_HAPPY = grid(`
  .ooonnnnnnnnooo.
  ...onnnnnnnnso..
  ...onnnsesesso..
  ...onnssssspso..
  ...onSsseeso....
`);
const HEAD_UP = grid(`
  .ooonnnnnnnnooo.
  ...onnnnnnnseso.
  ...onnnssesesso.
  ...onnsssssppso.
  ...onSssssso....
`).map((r) => r.slice(0, 16));

// 上身：第 11–13 行
const TORSO = grid(`
  .....owwwwwo....
  ....owwwwwWWo...
  ....oswwwwWso...
`);
const TORSO_SWING_A = grid(`
  .....owwwwwo....
  ....owwwwwWWso..
  ...osowwwwWo....
`);
const TORSO_SWING_B = grid(`
  .....owwwwwo....
  ..osWWwwwwwo....
  ....owwwwwWoso..
`);
const TORSO_UP = grid(`
  ....oswwwwwso...
  .....owwwwWo....
  .....owwwWWo....
`);
const TORSO_OUT = grid(`
  .....owwwwwo....
  ..ossowwwwWosso.
  .....owwwWWo....
`);
// 扔海星（第 2 关）：前手往前平伸、往斜上方伸
const TORSO_THROW = grid(`
  .....owwwwwo....
  ....owwwwwWWosso
  ....oswwwwWo....
`);
const TORSO_THROW_UP = grid(`
  .....owwwwwooso.
  ....owwwwwWWo...
  ....oswwwwWo....
`);

// 裙子：第 14–15 行
const SKIRT = grid(`
  ....ottttttTo...
  ...oTTTTTTTTo...
`);
const SKIRT_FLARE = grid(`
  ...otttttttTTo..
  ..oTTTTTTTTTTTo.
`);

// 腿：第 16–17 行
const LEGS_STAND = grid(`
  .....oso.oso....
  ....obbo.obbo...
`);
const LEGS_RUN = [
  grid(`
  ....oso...oso...
  ...obbo...obbbo.
`),
  grid(`
  .....oso.oso....
  .....obbobbbo...
`),
  grid(`
  ......osoo......
  ......obbbo.....
`),
  grid(`
  ...oso....oso...
  ..obbo....obbbo.
`),
  grid(`
  .....oso.oso....
  ....obbbobbo....
`),
  grid(`
  ......oosoo.....
  .......obbbo....
`),
];
const LEGS_TUCK = grid(`
  .....osooso.....
  .....obbobbo....
`);
const LEGS_FALL = grid(`
  ....oso..oso....
  ...obbo...obbo..
`);
const LEGS_SKID = grid(`
  ...oso...oso....
  ..obbbo..obbo...
`);

/** 每一帧帽子相对默认位置的竖直偏移，飘带锚点要跟着帽子走 */
export const HERO_HAT_DY: Record<string, number> = {};
let currentFrameName = '';

/** 按部件拼出一帧；dy 让上半身整体下移（呼吸、跑步起伏、下蹲） */
function frame(opts: {
  head?: PixelGrid;
  torso?: PixelGrid;
  skirt?: PixelGrid;
  legs?: PixelGrid;
  dy?: number;
  hatDy?: number;
}): PixelGrid {
  const dy = opts.dy ?? 0;
  const hatDy = opts.hatDy ?? dy;
  HERO_HAT_DY[currentFrameName] = hatDy;
  return compose(HERO_W, HERO_H, [
    [opts.legs ?? LEGS_STAND, 0, 16],
    [opts.skirt ?? SKIRT, 0, 14 + Math.min(dy, 1)],
    [opts.torso ?? TORSO, 0, 11 + dy],
    [opts.head ?? HEAD, 0, 6 + dy],
    [HAT, 0, hatDy],
  ]);
}

function named(defs: Record<string, () => PixelGrid>): Record<string, PixelGrid> {
  const out: Record<string, PixelGrid> = {};
  for (const [name, make] of Object.entries(defs)) {
    currentFrameName = name;
    out[name] = make();
  }
  return out;
}

export const heroSheet: Sheet = {
  key: 'hero',
  w: HERO_W,
  h: HERO_H,
  keys: HERO_KEYS,
  frames: named({
    idle_0: () => frame({}),
    idle_1: () => frame({ dy: 1 }),
    blink: () => frame({ head: HEAD_BLINK }),
    run_0: () => frame({ legs: LEGS_RUN[0], torso: TORSO_SWING_A, dy: 0 }),
    run_1: () => frame({ legs: LEGS_RUN[1], torso: TORSO_SWING_A, dy: 1 }),
    run_2: () => frame({ legs: LEGS_RUN[2], torso: TORSO, dy: 0 }),
    run_3: () => frame({ legs: LEGS_RUN[3], torso: TORSO_SWING_B, dy: 0 }),
    run_4: () => frame({ legs: LEGS_RUN[4], torso: TORSO_SWING_B, dy: 1 }),
    run_5: () => frame({ legs: LEGS_RUN[5], torso: TORSO, dy: 0 }),
    jump: () => frame({ legs: LEGS_TUCK, torso: TORSO_UP, skirt: SKIRT }),
    apex: () => frame({ legs: LEGS_TUCK, torso: TORSO_OUT, skirt: SKIRT_FLARE }),
    fall_0: () => frame({ legs: LEGS_FALL, torso: TORSO_OUT, skirt: SKIRT_FLARE, hatDy: -1 }),
    fall_1: () => frame({ legs: LEGS_FALL, torso: TORSO_UP, skirt: SKIRT_FLARE, hatDy: -1 }),
    land: () => frame({ legs: LEGS_TUCK, dy: 2 }),
    skid: () => frame({ legs: LEGS_SKID, torso: TORSO_SWING_B, skirt: SKIRT_FLARE }),
    crouch: () => frame({ legs: LEGS_TUCK, dy: 3 }),
    look_up: () => frame({ head: HEAD_UP }),
    // 第 1 关新增：受击、倒地（死亡时的抛物线）、胜利、伸懒腰
    hurt: () =>
      frame({ head: HEAD_OUCH, torso: TORSO_OUT, legs: LEGS_FALL, skirt: SKIRT_FLARE, hatDy: -1 }),
    ko: () =>
      frame({ head: HEAD_OUCH, torso: TORSO_UP, legs: LEGS_FALL, skirt: SKIRT_FLARE, hatDy: -1 }),
    victory_0: () => frame({ head: HEAD_HAPPY, torso: TORSO_UP }),
    victory_1: () => frame({ head: HEAD_HAPPY, torso: TORSO_UP, legs: LEGS_TUCK, hatDy: -1 }),
    stretch_0: () => frame({ head: HEAD_OUCH, torso: TORSO_UP, dy: 0, hatDy: -1 }),
    stretch_1: () => frame({ head: HEAD_BLINK, torso: TORSO_UP, dy: 1 }),
    // 第 2 关新增：扔海星（蓄力、出手、斜上出手、空中出手）、接住
    throw_0: () => frame({ torso: TORSO_SWING_B, dy: 1 }),
    throw_1: () => frame({ torso: TORSO_THROW }),
    throw_up: () => frame({ head: HEAD_UP, torso: TORSO_THROW_UP }),
    throw_air: () => frame({ torso: TORSO_THROW, legs: LEGS_TUCK, skirt: SKIRT_FLARE }),
    throw_air_up: () =>
      frame({ head: HEAD_UP, torso: TORSO_THROW_UP, legs: LEGS_TUCK, skirt: SKIRT_FLARE }),
    catch: () => frame({ head: HEAD_HAPPY, torso: TORSO_OUT }),
  }),
};

/** 帽子后侧帽带结的位置（相对精灵左上角，朝右时），飘带从这里长出来 */
export const RIBBON_ANCHOR = { x: 3, y: 3 };
