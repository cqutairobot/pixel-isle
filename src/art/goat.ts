import { Paint, type ImageSheet } from './paint';
import type { ColorName } from './palette';
import type { RGBAImage } from './sprite';

/**
 * 坐骑咩铃（24×18，脚底中心为原点，默认朝右）：白色的小山羊，一对往后弯的小角，
 * 下巴一撮胡子，红色项圈上挂着一只金色的小铃铛（随步伐叮当作响）。
 * 帧：待机 ×2、眨眼、跑 ×4、跳（蜷腿）、下落、蓄力 ×2（低头刨地）、冲刺 ×2、晕、受惊 ×2、
 * 低头请你骑、被摸（眯眼）、在羊圈里跺脚 ×2（被冻住时）；另有 HUD 用的头像和获得演出用的大图。
 * 骑着时小满画在她背上：背顶离地约 12 px，鞍子在身体中间略靠后。
 */

export const GOAT_W = 24;
export const GOAT_H = 18;

type Eyes = 'open' | 'closed' | 'happy' | 'wide' | 'dizzy' | 'angry';
type Head = 'up' | 'down' | 'low';

/** 一条腿：从胯（hx, hy）到蹄子（fx, fy）；near 是靠近镜头的那条 */
type Leg = [hx: number, hy: number, fx: number, fy: number];

interface GoatOpts {
  /** 远侧的两条腿（前、后）和近侧的两条腿（前、后） */
  far: [Leg, Leg];
  near: [Leg, Leg];
  head: Head;
  eyes: Eyes;
  /** 身子上下偏移（跑步起伏、蓄力下压） */
  dy: number;
  /** 身子往前伸长（冲刺） */
  stretch: number;
  /** 后腿蹬地扬起的尘土（蓄力刨地） */
  dust: boolean;
}

const STAND: Pick<GoatOpts, 'far' | 'near'> = {
  far: [
    [14, 12, 14, 17],
    [5, 12, 5, 17],
  ],
  near: [
    [16, 12, 16, 17],
    [7, 12, 7, 17],
  ],
};

/** 两像素宽的腿，最下面一格是深色的蹄子 */
function leg(p: Paint, [hx, hy, fx, fy]: Leg, c: ColorName): void {
  p.line(hx, hy, fx, fy - 1, c);
  p.line(hx + 1, hy, fx + 1, fy - 1, c);
  p.set(fx, fy, 'slate').set(fx + 1, fy, 'slate');
}

function goat(o: Partial<GoatOpts>): RGBAImage {
  const opt: GoatOpts = {
    ...STAND,
    head: 'up',
    eyes: 'open',
    dy: 0,
    stretch: 0,
    dust: false,
    ...o,
  };
  const p = new Paint(GOAT_W, GOAT_H);
  const dy = opt.dy;
  // 远侧的腿（颜色暗一点）
  for (const l of opt.far) leg(p, [l[0], l[1] + dy, l[2], l[3]], 'mist');
  // 身子：蓬松的白毛，肚子下面一圈阴影
  const cx = 10.5 + opt.stretch / 2;
  p.ellipse(cx, 9.5 + dy, 7.6 + opt.stretch / 2, 4, 'white');
  p.recolorWhere((x, y, c) => c === 'white' && y >= 12 + dy, 'cloud');
  // 毛卷
  for (const [x, y] of [
    [6, 8],
    [9, 7],
    [12, 8],
    [8, 10],
    [13, 11],
  ] as const)
    p.set(x + Math.round(opt.stretch / 3), y + dy, 'cloud');
  // 尾巴：往上翘的一小撮
  p.set(2, 7 + dy, 'white')
    .set(2, 6 + dy, 'white')
    .set(1, 5 + dy, 'cloud');
  // 近侧的腿
  for (const l of opt.near) leg(p, [l[0], l[1] + dy, l[2], l[3]], 'white');
  // 脖子和头
  const hx = 19 + opt.stretch;
  const hy = opt.head === 'up' ? 5 : opt.head === 'low' ? 7 : 9;
  const neckTop = opt.head === 'up' ? 6 : 8;
  p.rect(15 + opt.stretch, neckTop + dy, 3, 12 - neckTop, 'white');
  p.ellipse(hx, hy + dy, 3.4, 2.8, 'white');
  // 圆圆的嘴巴往前突出，鼻头粉色，下面一道浅色的嘴缝
  const mx = hx + 3;
  const my = hy + 1 + dy;
  p.rect(mx - 1, my - 1, 3, 2, 'white');
  p.set(mx + 1, my - 1, 'blush');
  p.set(mx, my + 1, 'mist').set(mx - 1, my + 1, 'cloud');
  // 下巴底下一小撮胡子（靠后，不像牙）
  p.set(mx - 2, my + 2, 'cloud').set(mx - 2, my + 3, 'mist');
  // 耷拉的耳朵：往后下垂，里面粉色
  p.set(hx - 3, hy + dy, 'cloud')
    .set(hx - 4, hy + dy, 'cloud')
    .set(hx - 4, hy + 1 + dy, 'cloud')
    .set(hx - 3, hy + 1 + dy, 'blush');
  // 角：两像素粗、往后弯成一道弧（低头冲撞时朝前）
  if (opt.head === 'down') {
    p.set(hx - 1, hy - 3 + dy, 'sand2')
      .set(hx, hy - 3 + dy, 'sand2')
      .set(hx, hy - 4 + dy, 'sand2')
      .set(hx + 1, hy - 4 + dy, 'sand2')
      .set(hx + 2, hy - 4 + dy, 'sand1')
      .set(hx + 3, hy - 3 + dy, 'sand1');
  } else {
    p.set(hx, hy - 3 + dy, 'sand2')
      .set(hx - 1, hy - 3 + dy, 'sand2')
      .set(hx - 1, hy - 4 + dy, 'sand2')
      .set(hx - 2, hy - 4 + dy, 'sand2')
      .set(hx - 3, hy - 4 + dy, 'sand1')
      .set(hx - 4, hy - 3 + dy, 'sand1')
      .set(hx - 4, hy - 2 + dy, 'sand1');
  }
  // 眼睛
  const ex = hx + 1;
  const ey = hy - 1 + dy;
  switch (opt.eyes) {
    case 'open':
      p.set(ex, ey, 'ink').set(ex, ey + 1, 'ink');
      break;
    case 'closed':
      p.set(ex, ey + 1, 'ink');
      break;
    case 'happy':
      p.set(ex - 1, ey + 1, 'ink')
        .set(ex, ey, 'ink')
        .set(ex + 1, ey + 1, 'ink');
      break;
    case 'wide':
      p.rect(ex - 1, ey - 1, 2, 3, 'cloud');
      p.set(ex, ey, 'ink');
      break;
    case 'dizzy':
      p.set(ex - 1, ey - 1, 'ink')
        .set(ex + 1, ey + 1, 'ink')
        .set(ex, ey, 'ink');
      p.set(ex + 1, ey - 1, 'ink').set(ex - 1, ey + 1, 'ink');
      break;
    case 'angry':
      p.set(ex, ey, 'ink').set(ex, ey + 1, 'ink');
      p.set(ex - 1, ey - 2, 'slate')
        .set(ex, ey - 2, 'slate')
        .set(ex + 1, ey - 1, 'slate');
      break;
  }
  // 红项圈和金铃铛
  const bx = 16 + opt.stretch;
  const by = (opt.head === 'up' ? 9 : 10) + dy;
  p.hline(bx - 1, bx + 1, by, 'red1');
  p.set(bx, by + 1, 'gold').set(bx + 1, by + 1, 'gold');
  p.set(bx, by + 2, 'straw').set(bx + 1, by + 2, 'ochre');
  p.outline('night');
  // 蓄力时后蹄扬起尘土（在描边外面）
  if (opt.dust) {
    p.set(1, 15, 'sand2').set(0, 13, 'sand3').set(2, 13, 'sand2');
  }
  return p.toImage();
}

/** 跑步：前后腿交替伸出、收拢 */
const RUN: Array<Pick<GoatOpts, 'far' | 'near' | 'dy'>> = [
  {
    far: [
      [14, 12, 17, 16],
      [5, 12, 2, 16],
    ],
    near: [
      [16, 12, 19, 16],
      [7, 12, 4, 16],
    ],
    dy: 0,
  },
  {
    far: [
      [14, 12, 13, 17],
      [5, 12, 7, 17],
    ],
    near: [
      [16, 12, 15, 17],
      [7, 12, 9, 17],
    ],
    dy: -1,
  },
  {
    far: [
      [14, 12, 12, 17],
      [5, 12, 7, 17],
    ],
    near: [
      [16, 12, 18, 17],
      [7, 12, 4, 17],
    ],
    dy: 0,
  },
  {
    far: [
      [14, 12, 15, 16],
      [5, 12, 4, 16],
    ],
    near: [
      [16, 12, 17, 16],
      [7, 12, 6, 16],
    ],
    dy: -1,
  },
];

/** 蜷起腿（起跳、二段跳） */
const TUCK: Pick<GoatOpts, 'far' | 'near'> = {
  far: [
    [14, 12, 16, 14],
    [5, 12, 3, 14],
  ],
  near: [
    [16, 12, 18, 14],
    [7, 12, 5, 14],
  ],
};

/** 下落：腿往下伸、准备着地 */
const FALL: Pick<GoatOpts, 'far' | 'near'> = {
  far: [
    [14, 12, 15, 17],
    [5, 12, 4, 16],
  ],
  near: [
    [16, 12, 17, 17],
    [7, 12, 6, 16],
  ],
};

/** 蓄力：前腿撑住，后腿往后刨地 */
const WINDUP: Array<Pick<GoatOpts, 'far' | 'near'>> = [
  {
    far: [
      [14, 12, 15, 17],
      [5, 12, 3, 17],
    ],
    near: [
      [16, 12, 17, 17],
      [7, 12, 6, 17],
    ],
  },
  {
    far: [
      [14, 12, 15, 17],
      [5, 12, 4, 17],
    ],
    near: [
      [16, 12, 17, 17],
      [7, 12, 3, 16],
    ],
  },
];

/** 冲刺：身子拉长，腿伸得更开 */
const DASH: Array<Pick<GoatOpts, 'far' | 'near'>> = [
  {
    far: [
      [15, 12, 19, 15],
      [5, 12, 1, 15],
    ],
    near: [
      [17, 12, 21, 15],
      [7, 12, 3, 16],
    ],
  },
  {
    far: [
      [15, 12, 14, 17],
      [5, 12, 8, 17],
    ],
    near: [
      [17, 12, 16, 17],
      [7, 12, 10, 17],
    ],
  },
];

/** 跪下（前腿折起来），低头请小满骑上去 */
const KNEEL: Pick<GoatOpts, 'far' | 'near'> = {
  far: [
    [14, 13, 16, 17],
    [5, 12, 5, 17],
  ],
  near: [
    [16, 13, 18, 17],
    [7, 12, 7, 17],
  ],
};

/** 在羊圈里跺脚：一只前蹄抬起来 */
const STAMP: Pick<GoatOpts, 'far' | 'near'> = {
  far: [
    [14, 12, 14, 17],
    [5, 12, 5, 17],
  ],
  near: [
    [16, 12, 17, 15],
    [7, 12, 7, 17],
  ],
};

/** HUD 坐骑格里的头像（14×14）：白脸、弯角、红项圈和金铃 */
function head(): RGBAImage {
  const p = new Paint(14, 14);
  p.ellipse(6.5, 6.5, 4.4, 3.8, 'white');
  p.rect(9, 6, 3, 3, 'white');
  p.set(12, 7, 'blush').set(11, 6, 'cloud');
  p.set(10, 10, 'cloud').set(10, 11, 'cloud');
  p.set(7, 5, 'ink').set(7, 6, 'ink');
  p.set(3, 6, 'cloud').set(2, 7, 'cloud');
  p.set(5, 2, 'sand2').set(4, 1, 'sand2').set(3, 1, 'sand1').set(2, 2, 'sand1');
  p.hline(3, 7, 10, 'red1');
  p.set(5, 11, 'gold').set(6, 11, 'gold').set(5, 12, 'straw').set(6, 12, 'ochre');
  p.outline('night');
  return p.toImage();
}

/** 最近邻放大（获得演出用的大图） */
function upscale(img: RGBAImage, k: number): RGBAImage {
  const w = img.w * k;
  const h = img.h * k;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = ((Math.floor(y / k) * img.w + Math.floor(x / k)) * 4) | 0;
      const d = (y * w + x) * 4;
      data[d] = img.data[s]!;
      data[d + 1] = img.data[s + 1]!;
      data[d + 2] = img.data[s + 2]!;
      data[d + 3] = img.data[s + 3]!;
    }
  return { w, h, data };
}

const idle0 = goat({});
const frames: Record<string, RGBAImage> = {
  idle_0: idle0,
  idle_1: goat({ head: 'low', dy: 0 }),
  blink: goat({ eyes: 'closed' }),
  run_0: goat({ ...RUN[0]! }),
  run_1: goat({ ...RUN[1]! }),
  run_2: goat({ ...RUN[2]! }),
  run_3: goat({ ...RUN[3]! }),
  jump: goat({ ...TUCK, dy: -1 }),
  fall: goat({ ...FALL }),
  windup_0: goat({ ...WINDUP[0]!, head: 'down', dy: 1, dust: true }),
  windup_1: goat({ ...WINDUP[1]!, head: 'down', dy: 1 }),
  dash_0: goat({ ...DASH[0]!, head: 'down', stretch: 2 }),
  dash_1: goat({ ...DASH[1]!, head: 'down', stretch: 2, dy: -1 }),
  dizzy: goat({ eyes: 'dizzy', head: 'low' }),
  flee_0: goat({ ...RUN[0]!, eyes: 'wide' }),
  flee_1: goat({ ...RUN[2]!, eyes: 'wide' }),
  kneel: goat({ ...KNEEL, head: 'low', dy: 1 }),
  happy: goat({ eyes: 'happy' }),
  stamp_0: goat({ eyes: 'angry' }),
  stamp_1: goat({ ...STAMP, eyes: 'angry' }),
  head: head(),
  big: upscale(idle0, 2),
};

export const goatSheet: ImageSheet = { key: 'goat', frames };
