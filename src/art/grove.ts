import { Paint, ditherPick, type ImageSheet } from './paint';
import type { ColorName } from './palette';
import { rng } from './rng';
import type { RGBAImage } from './sprite';

/**
 * 椰林（第 2 关）的装饰：能打下椰子的椰子树、椰子和碎壳、蕨类、蘑菇、垂藤、鸥巢、白露的小屋、
 * 攀登段的巨大椰树（树干 + 树冠）、大暑的冰沙车，以及画在最前面的大椰叶。
 * 背景装饰用柔和的描边；能打的椰子、冰沙车这类会和人互动的东西用深蓝描边。
 */

/**
 * 能打下椰子的椰子树（64×96，树根在底边中间）：树冠中心在树根上方 75 px，
 * 和 src/sim/props.ts 的树冠判定区对齐。coconuts 是还挂着几个椰子，frame 让叶尖摆动。
 */
function coconutTree(coconuts: number, frame: number): RGBAImage {
  const W = 64;
  const H = 96;
  const p = new Paint(W, H);
  const baseX = 30;
  const topX = 33;
  const topY = 21;
  for (let y = H - 1; y >= topY; y--) {
    const t = (H - 1 - y) / (H - 1 - topY);
    const cx = baseX + (topX - baseX) * Math.sin(t * Math.PI * 0.5);
    const half = 3 - t * 0.9;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const ring = (H - y) % 4 === 0;
      p.set(x, y, ring ? 'bark' : x < cx - half / 3 ? 'sand1' : 'ochre');
    }
  }
  // 树根往两边稍微张开
  p.set(baseX - 4, H - 1, 'ochre').set(baseX + 4, H - 1, 'bark');
  const sway = frame ? 1 : 0;
  const fronds = [-2.8, -2.25, -1.75, -1.3, -0.85, -0.35, 0.25];
  for (const a of fronds) {
    const len = 25 + Math.abs(a + 1.5) * 3;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const x = topX + Math.cos(a) * i + (t > 0.6 ? sway * Math.sign(Math.cos(a)) : 0);
      const y = topY + Math.sin(a) * i * 0.5 + t * t * 15 + (t > 0.7 ? sway : 0);
      const thick = Math.max(1, Math.round((1 - t) * 3.2));
      for (let k = 0; k < thick; k++)
        p.set(x, y + k, k === 0 ? (t < 0.45 ? 'leaf3' : 'leaf2') : 'leaf1');
      if (i % 3 === 0 && t > 0.15) p.set(x, y + thick + 1, 'leaf1');
    }
  }
  p.ellipse(topX, topY + 1, 5, 2.5, 'leaf2');
  p.outline('pine');
  // 椰子挂在树冠下面，用深蓝描边，告诉玩家"这个能打"
  const spots: Array<[number, number]> = [
    [topX - 3, topY + 5],
    [topX + 3, topY + 5],
    [topX, topY + 7],
  ];
  const nut = new Paint(W, H);
  for (let i = 0; i < Math.min(coconuts, spots.length); i++) {
    const [x, y] = spots[i]!;
    nut.disc(x, y, 2.6, 'bark');
    nut.set(x - 1, y - 1, 'ochre').set(x - 1, y - 2, 'sand1');
  }
  nut.outline('night');
  p.paste(nut, 0, 0);
  return p.toImage();
}

/** 掉下来的椰子（10×10）：棕色的圆球，一头有三个小"眼睛" */
function coconut(): RGBAImage {
  const p = new Paint(10, 10);
  p.disc(5, 5, 4, 'bark');
  p.ellipse(4, 4, 2.2, 1.8, 'ochre');
  p.set(3, 3, 'sand1').set(4, 3, 'sand2');
  p.set(6, 7, 'night').set(7, 6, 'night').set(7, 8, 'wine');
  p.outline('night');
  return p.toImage();
}

/** 椰子碎壳（粒子）：外面是棕色壳、里面露出白色椰肉 */
function shard(kind: number): RGBAImage {
  const p = new Paint(5, 4);
  if (kind === 0) {
    p.hline(0, 4, 0, 'bark').hline(0, 4, 1, 'cream').hline(1, 3, 2, 'cream');
    p.set(0, 1, 'bark').set(4, 1, 'bark');
  } else {
    p.hline(1, 3, 0, 'bark').hline(0, 3, 1, 'bark').hline(1, 2, 2, 'cream');
  }
  return p.toImage();
}

/** 蕨类：从底边中间往两边拱出去的几片羽状叶 */
function fern(seed: number, w: number, h: number): RGBAImage {
  const p = new Paint(w, h);
  const r = rng(seed);
  const cx = w / 2;
  const arcs = [-2.7, -2.2, -1.75, -1.4, -0.95, -0.45];
  for (const a0 of arcs) {
    const a = a0 + (r() - 0.5) * 0.2;
    const len = h * (0.9 + r() * 0.5);
    let px = cx;
    let py = h - 1;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      px = cx + Math.cos(a) * i * 0.9;
      py = h - 1 + Math.sin(a) * i * (1 - t * 0.9) + t * t * h * 0.35;
      p.set(px, py, t < 0.5 ? 'leaf2' : 'leaf1');
      // 两边的小叶
      if (i % 2 === 0 && t > 0.15 && t < 0.92) {
        const s = Math.max(1, Math.round((1 - t) * 3));
        for (let k = 1; k <= s; k++) p.set(px, py + k, 'leaf1');
        p.set(px + Math.sign(Math.cos(a)), py - 1, 'leaf2');
      }
    }
  }
  p.outline('pine');
  return p.toImage();
}

/** 两朵小蘑菇：红伞白点、奶油色的柄 */
function mushrooms(): RGBAImage {
  const p = new Paint(14, 10);
  // 大的
  p.rect(4, 5, 2, 4, 'cream');
  p.ellipse(5, 4, 3.6, 2.4, 'red1');
  p.hline(2, 8, 5, 'wine');
  p.set(4, 2, 'cream').set(6, 3, 'cream').set(3, 4, 'skin2');
  // 小的
  p.rect(10, 7, 1, 2, 'cream');
  p.ellipse(10.5, 6.5, 2.2, 1.6, 'orange');
  p.set(10, 6, 'cream');
  p.hline(0, 13, 9, 'pine');
  p.outline('night');
  return p.toImage();
}

/** 垂藤：从上往下挂，弯弯曲曲的藤，左右交替长着小叶子 */
function vines(len: number, seed: number): RGBAImage {
  const p = new Paint(9, len);
  const r = rng(seed);
  let x = 4;
  for (let y = 0; y < len; y++) {
    if (y % 5 === 4) x += r() < 0.5 ? -1 : 1;
    x = Math.max(2, Math.min(6, x));
    p.set(x, y, 'leaf1');
    if (y % 6 === 2 && y < len - 2) {
      const d = (y / 6) % 2 < 1 ? -1 : 1;
      p.set(x + d, y, 'leaf2')
        .set(x + d * 2, y + 1, 'leaf2')
        .set(x + d, y + 1, 'leaf1');
    }
  }
  p.set(x, len - 1, 'leaf2');
  p.outline('pine');
  return p.toImage();
}

/** 鸥巢：枯枝编的浅碗，里面躺着两颗带斑点的蛋 */
function nest(): RGBAImage {
  const p = new Paint(30, 13);
  p.ellipse(10, 6, 3, 3.4, 'cloud');
  p.ellipse(17, 6, 3, 3.4, 'cloud');
  p.set(9, 4, 'white').set(16, 4, 'white');
  p.set(11, 6, 'frost').set(18, 7, 'frost').set(16, 7, 'mist');
  p.ellipse(15, 10, 14, 3.4, 'sand1');
  const r = rng(5);
  for (let i = 0; i < 26; i++) {
    const x = 2 + r() * 26;
    const y = 7 + r() * 5;
    p.line(x, y, x + 3 + r() * 3, y + (r() - 0.5) * 2, r() < 0.5 ? 'ochre' : 'bark');
  }
  p.line(0, 8, 5, 7, 'sand1').line(25, 7, 29, 9, 'ochre');
  p.outline('bark');
  return p.toImage();
}

/** 白露的小屋：竹编的墙、椰叶铺的屋顶，门口挂着青色的布帘，旁边晾着渔网 */
function hut(): RGBAImage {
  const W = 78;
  const H = 62;
  const p = new Paint(W, H);
  // 墙：竹编（竖条），下面一圈石头地基
  const wx0 = 12;
  const wx1 = 66;
  const wy0 = 26;
  for (let y = wy0; y < H - 3; y++)
    for (let x = wx0; x <= wx1; x++) {
      const col = (x - wx0) % 4;
      p.set(x, y, col === 0 ? 'sand1' : col === 3 ? 'sand2' : 'sand3');
    }
  for (let x = wx0; x <= wx1; x++) p.set(x, wy0 + 12, 'ochre');
  for (let x = wx0 - 1; x <= wx1 + 1; x++) {
    p.set(x, H - 3, (x >> 2) % 2 ? 'stone' : 'mist');
    p.set(x, H - 2, 'stone');
    p.set(x, H - 1, 'slate');
  }
  // 门（左边）：青色布帘，帘下摆是浪花纹
  p.rect(18, 36, 13, 23, 'night');
  p.rect(19, 37, 11, 18, 'teal');
  for (let x = 19; x < 30; x++) p.set(x, 54 + ((x >> 1) % 2), 'sea');
  p.vline(24, 37, 52, 'sea');
  p.set(21, 40, 'cloud').set(27, 44, 'cloud');
  // 圆窗（右边），窗台上一只海星
  p.disc(51, 39, 6, 'night');
  p.disc(51, 39, 5, 'deep');
  p.set(49, 37, 'sky').set(50, 36, 'sky').set(48, 38, 'sea');
  p.hline(44, 58, 46, 'bark');
  p.set(55, 45, 'orange').set(54, 44, 'orange').set(56, 44, 'orange').set(55, 44, 'gold');
  // 屋顶：一层层垂下来的椰叶（中间高、两头低）
  for (let layer = 0; layer < 4; layer++) {
    const y0 = 6 + layer * 6;
    const half = 22 + layer * 7;
    for (let x = 39 - half; x <= 39 + half; x++) {
      const d = Math.abs(x - 39) / half;
      const yTop = y0 + Math.round(d * d * 6);
      const len = 6 + ((x * 7 + layer * 3) % 3);
      for (let k = 0; k < len; k++) {
        const c: ColorName =
          k === len - 1
            ? 'ochre'
            : layer % 2
              ? k < 2
                ? 'gold'
                : 'straw'
              : k < 2
                ? 'sand3'
                : 'straw';
        p.set(x, yTop + k, c);
      }
      if ((x + layer) % 3 === 0) p.set(x, yTop + len, 'ochre');
    }
  }
  // 屋脊上压着一根竹竿
  p.hline(22, 56, 6, 'bark').hline(24, 54, 5, 'ochre');
  // 晾着的渔网（屋檐右边垂下来）
  for (let y = 30; y < 50; y++)
    for (let x = 68; x < 76; x++)
      if ((x + y) % 3 === 0 || (x - y + 99) % 3 === 0) p.set(x, y, y > 46 ? 'mist' : 'cloud');
  p.vline(67, 28, 59, 'bark');
  p.outline('bark');
  return p.toImage();
}

/**
 * 攀登段的巨大椰树树干（40×h）：一圈圈的环节，每节有交叉的叶痕；左亮右暗。
 * 是背景，颜色压暗一点、不用深色描边。
 */
function giantTrunk(h: number): RGBAImage {
  const W = 40;
  const p = new Paint(W, h);
  for (let y = 0; y < h; y++) {
    // 树干从下往上稍微变细
    const t = y / h;
    const half = 15 + t * 3;
    const cx = W / 2 + Math.sin(y / 90) * 1.5;
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) {
      const u = (x - (cx - half)) / (half * 2);
      const seg = y % 12;
      let c: ColorName = ditherPick(x, y, u * 1.2 - 0.1, 'ochre', 'bark');
      if (u > 0.78) c = ditherPick(x, y, (u - 0.78) * 4, 'bark', 'wine');
      if (u < 0.12) c = 'sand1';
      // 环节和交叉的叶痕
      if (seg === 0) c = u > 0.7 ? 'wine' : 'bark';
      else if (seg === 1 && u > 0.1 && u < 0.85) c = u < 0.4 ? 'sand1' : 'ochre';
      else if ((seg === 5 || seg === 6) && Math.abs(((x + (seg === 5 ? 0 : 1)) % 8) - 4) < 1)
        c = u > 0.6 ? 'wine' : 'bark';
      p.set(x, y, c);
    }
  }
  return p.toImage();
}

/**
 * 一片羽状的椰叶：叶轴是一条弧线，两边排着楔形的小叶（下面一排长、垂得厉害，上面一排短）。
 * from 是叶柄的位置，len 是叶轴长度，dir 是朝左还是朝右，droop 是叶轴往下弯的程度。
 */
function frond(
  p: Paint,
  from: [number, number],
  len: number,
  dir: 1 | -1,
  droop: number,
  rise: number,
  leaflet: number,
  colors: { dark: ColorName; mid: ColorName; light: ColorName },
): void {
  const at = (t: number): [number, number] => [
    from[0] + dir * t * len,
    from[1] - Math.sin(t * Math.PI * 0.7) * rise + t * t * droop,
  ];
  const step = 4 / len;
  for (let t = 0.04; t < 1; t += step) {
    const [bx, by] = at(t);
    const [nx, ny] = at(Math.min(1, t + 0.01));
    const ax = (nx - bx) / Math.hypot(nx - bx, ny - by);
    const ay = (ny - by) / Math.hypot(nx - bx, ny - by);
    const l = leaflet * (1 - t * 0.7);
    // 下面一排：朝叶尖方向斜着往下垂
    const dx = ax * 0.55 - ay * 0.0;
    const dy = 0.85;
    const tip: [number, number] = [bx + dx * l, by + dy * l];
    const w = 2.9 * (1 - t * 0.5);
    p.poly([[bx - ax * w, by - ay * w], [bx + ax * w, by + ay * w], tip], colors.dark);
    p.line(bx, by + 1, bx + dx * l * 0.7, by + 1 + dy * l * 0.7, colors.mid);
    // 上面一排：短一些，先往上翘
    const ul = l * 0.45;
    p.poly(
      [
        [bx - ax * w, by - ay * w],
        [bx + ax * w, by + ay * w],
        [bx + ax * ul * 0.8, by - ul * 0.6],
      ],
      colors.dark,
    );
  }
  // 叶轴
  for (let t = 0; t < 1; t += 0.5 / len) {
    const [x, y] = at(t);
    p.set(x, y, colors.light);
    if (t < 0.6) p.set(x, y + 1, colors.mid);
  }
}

/** 巨大椰树的树冠（背景）：八片大叶子从中心往两边垂下去 */
function giantCrown(): RGBAImage {
  const W = 240;
  const H = 104;
  const p = new Paint(W, H);
  const cx = W / 2;
  const cy = 30;
  const colors = { dark: 'pine', mid: 'leaf1', light: 'leaf2' } as const;
  for (const [dir, len, droop, rise] of [
    [-1, 112, 60, 16],
    [1, 112, 62, 14],
    [-1, 92, 40, 22],
    [1, 96, 38, 24],
    [-1, 64, 22, 26],
    [1, 66, 20, 26],
  ] as Array<[1 | -1, number, number, number]>)
    frond(p, [cx, cy], len, dir, droop, rise, 18, colors);
  p.ellipse(cx, cy + 3, 13, 6, 'leaf1');
  p.ellipse(cx - 2, cy + 1, 8, 3, 'leaf2');
  return p.toImage();
}

/** 大暑的冰沙车：两个轮子、木头车厢、红白条纹的遮阳伞，车上一块冰和三瓶糖浆 */
function cart(): RGBAImage {
  const W = 44;
  const H = 46;
  const p = new Paint(W, H);
  // 伞
  p.vline(30, 6, 30, 'bark');
  for (let x = 12; x <= 43; x++) {
    const d = Math.abs(x - 28) / 16;
    const yTop = 2 + Math.round(d * d * 6);
    for (let y = yTop; y <= 8 + Math.round(d * 2); y++)
      p.set(x, y, Math.floor((x - 12) / 4) % 2 ? 'cream' : 'red2');
    p.set(x, 9 + Math.round(d * 2), Math.floor((x - 12) / 4) % 2 ? 'sand3' : 'red1');
  }
  p.set(28, 1, 'gold');
  // 车厢
  p.rect(4, 28, 34, 11, 'sand2');
  p.hline(4, 37, 28, 'sand3');
  p.hline(4, 37, 38, 'sand1');
  p.rect(8, 30, 26, 6, 'sky');
  p.rect(9, 31, 24, 4, 'cloud');
  p.set(12, 32, 'red2').set(13, 32, 'red2').set(20, 32, 'gold').set(21, 32, 'gold');
  p.set(27, 32, 'leaf2').set(28, 32, 'leaf2');
  // 冰块和糖浆瓶
  p.rect(8, 21, 10, 7, 'frost');
  p.rect(9, 21, 8, 2, 'cloud');
  p.set(9, 21, 'white');
  for (const [x, c] of [
    [21, 'red2'],
    [25, 'gold'],
    [29, 'leaf2'],
  ] as Array<[number, ColorName]>) {
    p.rect(x, 22, 3, 6, c);
    p.rect(x + 1, 20, 1, 2, 'mist');
    p.set(x, 23, 'white');
  }
  // 车把
  p.line(38, 30, 43, 26, 'bark');
  // 轮子
  for (const wx of [11, 31]) {
    p.disc(wx, 41, 4.5, 'night');
    p.disc(wx, 41, 3, 'stone');
    p.set(wx, 41, 'mist');
  }
  p.outline('night');
  return p.toImage();
}

/**
 * 前景大椰叶（画在最前面）：深色的叶片剪影。hang 为 true 时从画面上边垂下来，
 * 否则从下边斜着翘起来。
 */
function frontFrond(hang: boolean): RGBAImage {
  const W = 144;
  const H = 80;
  const p = new Paint(W, H);
  const colors = { dark: 'pine', mid: 'leaf1', light: 'leaf1' } as const;
  if (hang) {
    frond(p, [0, 4], 136, 1, 52, 4, 26, colors);
    frond(p, [8, 0], 96, 1, 30, 2, 20, colors);
  } else {
    frond(p, [W - 1, H - 6], 138, -1, -4, 40, 22, colors);
    frond(p, [W - 10, H - 1], 100, -1, 6, 30, 18, colors);
  }
  return p.toImage();
}

const frames: Record<string, RGBAImage> = {
  coconut: coconut(),
  shard_0: shard(0),
  shard_1: shard(1),
  fern: fern(3, 26, 14),
  fern_b: fern(8, 20, 11),
  mushrooms: mushrooms(),
  vine_s: vines(26, 2),
  vine_l: vines(46, 7),
  nest: nest(),
  hut: hut(),
  giant_trunk: giantTrunk(368),
  giant_crown: giantCrown(),
  cart: cart(),
  front_hang: frontFrond(true),
  front_rise: frontFrond(false),
};
for (let c = 0; c <= 3; c++)
  for (let f = 0; f < 2; f++) frames[`tree_${c}_${f}`] = coconutTree(c, f);

export const groveSheet: ImageSheet = { key: 'grove', frames };
