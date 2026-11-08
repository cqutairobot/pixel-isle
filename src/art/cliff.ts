import { Paint, ditherPick, type ImageSheet } from './paint';
import type { ColorName } from './palette';
import { hash2, rng } from './rng';
import type { RGBAImage } from './sprite';

/**
 * 第 3 关「回声崖」的机关和装饰（脚底左下角为原点，除非另外说明）：
 * 羊圈顶上的冰晶（3 个裂纹阶段）、羊圈、旧羊圈、回声铃（铃架 + 会摆的铜铃）、
 * 被风吹弯的崖松、路牌、羊蹄印、灌木上的羊毛、草丛、栈道上的风铃、绳子扶手、燕子窝、薄雾、
 * 画面边上的崖燕警示牌。裂岩和石门的大小每关不同，用 drawBoulder / drawGate 现画。
 */

/** 冰晶（16×16）：三根尖尖的冰柱，stage 越大裂得越厉害 */
function crystal(stage: number): RGBAImage {
  const p = new Paint(16, 16);
  // 中间高、两边矮的三根冰柱
  p.poly(
    [
      [6, 15],
      [7, 2],
      [8, 1],
      [10, 15],
    ],
    'frost',
  );
  p.poly(
    [
      [1, 15],
      [3, 6],
      [4, 6],
      [7, 15],
    ],
    'sky',
  );
  p.poly(
    [
      [9, 15],
      [12, 5],
      [13, 5],
      [15, 15],
    ],
    'sky',
  );
  // 亮面和高光
  p.vline(7, 3, 14, 'white').vline(3, 7, 14, 'cloud').vline(12, 6, 14, 'cloud');
  p.set(8, 2, 'white');
  // 裂纹
  if (stage >= 1) p.line(7, 5, 9, 9, 'slate').line(9, 9, 7, 12, 'slate');
  if (stage >= 2) {
    p.line(3, 9, 5, 12, 'slate').line(12, 8, 11, 11, 'slate');
    // 掉了一角
    p.set(13, 5, null).set(12, 5, null).set(8, 1, null);
  }
  p.outline('night');
  return p.toImage();
}

/** 碎冰屑（4×4） */
function shard(k: number): RGBAImage {
  const p = new Paint(4, 4);
  if (k === 0) p.set(1, 0, 'white').rect(0, 1, 3, 2, 'frost').set(1, 3, 'sky');
  else p.set(0, 0, 'frost').set(1, 1, 'white').set(2, 2, 'sky').set(1, 2, 'frost');
  return p.toImage();
}

/**
 * 羊圈（48×32，左下角对齐）：四根木桩一直撑到顶上的栈道木板（地图里是 = 格子），
 * 中间两道横栏，地上铺着干草，门柱上挂着一只小铃。old 是崖上的旧羊圈：木头发灰、栏杆断了一根。
 */
function pen(old: boolean): RGBAImage {
  const p = new Paint(48, 32);
  const wood: ColorName = old ? 'stone' : 'bark';
  const rail: ColorName = old ? 'mist' : 'sand1';
  const railTop: ColorName = old ? 'cloud' : 'sand2';
  // 干草
  for (let x = 2; x < 46; x++) {
    const h = 2 + (hash2(x, 3, 11) % 3);
    for (let y = 32 - h; y < 32; y++) p.set(x, y, y === 32 - h ? 'sand3' : 'straw');
  }
  // 木桩
  for (const x of [1, 16, 31, 45]) {
    p.rect(x, 0, 2, 32, wood);
    p.vline(x, 0, 31, old ? 'mist' : 'ochre');
  }
  // 横栏（旧羊圈断了一根）
  for (const y of [10, 20]) {
    for (let x = 3; x < 45; x++) {
      if (old && y === 10 && x > 18 && x < 30) continue;
      if (x === 16 || x === 17 || x === 31 || x === 32) continue;
      p.set(x, y, railTop).set(x, y + 1, rail);
    }
  }
  if (old) p.line(19, 10, 24, 14, railTop).line(19, 11, 24, 15, rail);
  // 门柱上的小铃
  if (!old) {
    p.vline(18, 1, 3, 'sand1');
    p.rect(17, 4, 3, 2, 'gold').set(18, 6, 'ochre').set(17, 4, 'straw');
  }
  p.outline('night');
  return p.toImage();
}

/**
 * 回声铃（24×34，脚底中心为原点）：两根石柱架着一根木梁，梁上用绳子吊着一口铜铃。
 * swing：-1 / 0 / 1 往左摆、不动、往右摆。
 */
function echoBell(swing: number): RGBAImage {
  const p = new Paint(24, 34);
  // 石柱
  for (const x of [1, 19]) {
    p.rect(x, 6, 4, 28, 'stone');
    p.vline(x, 6, 33, 'mist');
    for (let y = 10; y < 34; y += 7) p.hline(x, x + 3, y, 'slate');
  }
  // 木梁
  p.rect(0, 3, 24, 3, 'bark');
  p.hline(0, 23, 3, 'sand1');
  p.set(0, 2, 'bark').set(23, 2, 'bark');
  // 绳子
  const cx = 12 + swing * 2;
  p.line(12, 6, cx, 10, 'sand2');
  // 铜铃：上窄下宽，一道亮边，铃口深色
  const by = 11;
  p.poly(
    [
      [cx - 3, by],
      [cx + 3, by],
      [cx + 5, by + 10],
      [cx - 5, by + 10],
    ],
    'ochre',
  );
  p.ellipse(cx, by + 1, 3.2, 2, 'ochre');
  p.vline(cx - 2, by + 1, by + 9, 'gold').vline(cx - 1, by + 2, by + 8, 'straw');
  p.hline(cx - 4, cx + 4, by + 6, 'sand1');
  p.hline(cx - 5, cx + 5, by + 10, 'bark');
  p.set(cx, by + 11, 'sand1').set(cx, by + 12, 'ochre');
  p.outline('night');
  return p.toImage();
}

/** 被风吹弯的崖松（32×28，左下角对齐）：树干往右歪，枝叶一层层往右（顺风）伸 */
function pine(): RGBAImage {
  const p = new Paint(32, 28);
  p.line(6, 27, 10, 14, 'bark').line(7, 27, 11, 14, 'bark').line(10, 14, 18, 8, 'bark');
  p.line(11, 14, 19, 9, 'ochre');
  const tufts: Array<[number, number, number]> = [
    [12, 12, 8],
    [18, 7, 9],
    [22, 11, 7],
    [8, 17, 6],
    [25, 5, 6],
  ];
  for (const [x, y, w] of tufts) {
    p.ellipse(x + w / 2, y, w / 2 + 1, 2.4, 'pine');
    p.hline(x, x + w - 2, y - 1, 'leaf1');
  }
  p.outline('night');
  return p.toImage();
}

/** 木头路牌（12×16）：牌子朝右指 */
function sign(): RGBAImage {
  const p = new Paint(14, 16);
  p.rect(5, 6, 2, 10, 'bark');
  p.poly(
    [
      [1, 2],
      [10, 2],
      [13, 5],
      [10, 8],
      [1, 8],
    ],
    'sand2',
  );
  p.hline(2, 10, 3, 'sand3');
  p.hline(3, 8, 5, 'sand1');
  p.outline('night');
  return p.toImage();
}

/** 一对羊蹄印（5×3）：画在崖壁上，一串串指向高处的羊肠小道 */
function hoof(): RGBAImage {
  const p = new Paint(5, 3);
  p.vline(0, 0, 2, 'slate').vline(1, 0, 1, 'slate');
  p.vline(3, 0, 2, 'slate').vline(4, 0, 1, 'slate');
  return p.toImage();
}

/** 挂在灌木上的一团羊毛（7×5） */
function wool(): RGBAImage {
  const p = new Paint(7, 5);
  p.ellipse(3, 2.5, 3, 2, 'white');
  p.set(1, 3, 'cloud').set(5, 3, 'cloud').set(4, 1, 'cloud');
  p.set(0, 4, 'leaf1').set(6, 4, 'leaf1');
  return p.toImage();
}

/** 崖顶的草丛（12×6，左下角对齐）：被风吹得往右倒 */
function tuft(k: number): RGBAImage {
  const p = new Paint(12, 6);
  const r = rng(30 + k);
  for (let i = 0; i < 6; i++) {
    const x = 1 + Math.floor(r() * 9);
    const h = 3 + Math.floor(r() * 3);
    p.line(x, 5, x + 2, 5 - h, i % 2 ? 'leaf2' : 'leaf1');
  }
  p.hline(0, 11, 5, 'leaf1');
  return p.toImage();
}

/** 栈道扶手上挂的风铃（8×14，顶边对齐）：一根细绳吊着三片小贝壳 */
function chimes(): RGBAImage {
  const p = new Paint(8, 14);
  p.vline(4, 0, 6, 'sand1');
  p.hline(1, 7, 6, 'sand1');
  for (const [x, len] of [
    [1, 4],
    [4, 6],
    [7, 3],
  ] as const) {
    p.vline(x, 7, 6 + len, 'cloud');
    p.set(x, 7 + len, 'sand3');
  }
  return p.toImage();
}

/** 栈道的绳子扶手（32×12，左下角对齐）：两根木桩、一根松垂的绳子 */
function rail(): RGBAImage {
  const p = new Paint(32, 12);
  for (const x of [1, 29]) p.rect(x, 1, 2, 11, 'bark');
  for (let x = 2; x < 30; x++) {
    const sag = Math.round(Math.sin(((x - 2) / 27) * Math.PI) * 3);
    p.set(x, 2 + sag, 'sand2');
  }
  p.set(1, 0, 'sand1').set(30, 0, 'sand1');
  p.outline('night');
  return p.toImage();
}

/** 燕子窝（10×7）：贴在崖壁上的一个泥碗 */
function nest(): RGBAImage {
  const p = new Paint(10, 7);
  p.ellipse(5, 2, 4.6, 4.2, 'sand1');
  p.rect(0, 0, 10, 2, null);
  for (let x = 1; x < 9; x += 2) p.set(x, 3 + (x % 3 === 0 ? 1 : 0), 'ochre');
  p.hline(1, 8, 2, 'bark');
  p.outline('night');
  return p.toImage();
}

/** 飘过的薄雾（64×18，左下角对齐）：稀疏的白色，游戏里半透明地画在最前面 */
function mist(seed: number): RGBAImage {
  const p = new Paint(64, 18);
  const r = rng(seed);
  for (let i = 0; i < 5; i++) {
    const cx = 8 + r() * 48;
    const cy = 8 + r() * 4;
    const rx = 10 + r() * 10;
    const ry = 3 + r() * 3;
    for (let y = 0; y < 18; y++)
      for (let x = 0; x < 64; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d < 1)
          p.set(x, y, d < 0.4 ? 'white' : ditherPick(x, y, (d - 0.4) / 0.6, 'cloud', 'mist'));
      }
  }
  // 边缘稀疏一点
  for (let y = 0; y < 18; y++)
    for (let x = 0; x < 64; x++) if (p.get(x, y) === 'mist' && (x + y) % 2 === 0) p.set(x, y, null);
  return p.toImage();
}

/** 崖燕警示牌（18×16）：金色的三角，里面一个"！"；frame 1 是闪亮的那一帧 */
function warn(frame: number): RGBAImage {
  const p = new Paint(18, 16);
  p.poly(
    [
      [9, 1],
      [17, 15],
      [1, 15],
    ],
    frame ? 'cream' : 'gold',
  );
  p.poly(
    [
      [9, 3],
      [15, 14],
      [3, 14],
    ],
    frame ? 'gold' : 'orange',
  );
  p.rect(8, 6, 2, 5, 'ink');
  p.rect(8, 12, 2, 1, 'ink');
  p.outline('night');
  return p.toImage();
}

/**
 * 一整块裂岩（cols × rows 格）：偏浅的沙色大石头，圆角，几道深色的裂纹从边上往里裂，
 * 一看就知道撞得碎（和深灰色的崖石区别开）。
 */
export function drawBoulder(cols: number, rows: number, seed: number): RGBAImage {
  const w = cols * 16;
  const h = rows * 16;
  const p = new Paint(w, h);
  const r = rng(seed);
  const rad = 5;
  // 往里收 1 px，给描边留位置
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const dx = x < rad + 1 ? rad + 1 - x : x > w - 2 - rad ? x - (w - 2 - rad) : 0;
      const dy = y < rad + 1 ? rad + 1 - y : y > h - 2 - rad ? y - (h - 2 - rad) : 0;
      if (dx * dx + dy * dy > rad * rad) continue;
      // 左上亮、右下暗
      const t = (x / w) * 0.6 + (y / h) * 0.7;
      p.set(
        x,
        y,
        t < 0.45
          ? 'sand3'
          : t < 0.95
            ? ditherPick(x, y, (t - 0.45) * 2, 'sand3', 'sand2')
            : 'sand2',
      );
    }
  // 几块深一点的斑
  for (let i = 0; i < cols * rows; i++) {
    const x = 3 + Math.floor(r() * (w - 8));
    const y = 3 + Math.floor(r() * (h - 8));
    p.set(x, y, 'sand1')
      .set(x + 1, y, 'sand1')
      .set(x, y + 1, 'sand2');
  }
  // 裂纹：从中间往外裂开好几道，越往外越细；中心深、边上浅，一眼看得出"撞得碎"
  const cx0 = w / 2 + (r() - 0.5) * 6;
  const cy0 = h / 2 + (r() - 0.5) * 6;
  const cracks = 4 + cols + rows;
  for (let i = 0; i < cracks; i++) {
    const a = (i / cracks) * Math.PI * 2 + r() * 0.6;
    const len = Math.min(w, h) * (0.35 + r() * 0.3);
    let x = cx0;
    let y = cy0;
    let ang = a;
    for (let k = 0; k < len; k++) {
      ang += (r() - 0.5) * 0.7;
      x += Math.cos(ang);
      y += Math.sin(ang);
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (!p.get(xi, yi)) break;
      const t = k / len;
      p.set(xi, yi, t < 0.45 ? 'night' : t < 0.8 ? 'bark' : 'sand1');
      // 靠近中心的裂缝两像素宽
      if (t < 0.3 && p.get(xi + 1, yi)) p.set(xi + 1, yi, 'bark');
    }
  }
  p.set(Math.round(cx0), Math.round(cy0), 'night');
  // 高光
  p.hline(rad + 1, w - rad - 2, 2, 'cream');
  p.vline(2, rad + 1, h - rad - 2, 'cream');
  p.outline('night');
  return p.toImage();
}

/**
 * 回声石门（cols × rows 格）：一整块石板，中间刻着一口铃；frozen 时边上和底下结着冰、挂着冰凌。
 */
export function drawGate(cols: number, rows: number, frozen: boolean): RGBAImage {
  const w = cols * 16;
  const h = rows * 16;
  const p = new Paint(w, h);
  // 整块石板：平整的灰色，左上一圈亮边，右下一圈暗边
  p.rect(0, 0, w, h, 'stone');
  p.hline(0, w - 1, 0, 'mist').vline(0, 0, h - 1, 'mist');
  p.hline(0, w - 1, h - 1, 'slate').vline(w - 1, 0, h - 1, 'slate');
  // 刻出来的内框
  p.rect(3, 3, w - 6, 1, 'slate').rect(3, h - 4, w - 6, 1, 'slate');
  p.rect(3, 3, 1, h - 6, 'slate').rect(w - 4, 3, 1, h - 6, 'slate');
  p.hline(4, w - 5, 4, 'mist').vline(4, 4, h - 5, 'mist');
  // 中间的铃纹
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2) - 4;
  p.poly(
    [
      [cx - 3, cy],
      [cx + 3, cy],
      [cx + 6, cy + 10],
      [cx - 6, cy + 10],
    ],
    'slate',
  );
  p.ellipse(cx, cy, 3.4, 2, 'slate');
  p.vline(cx - 2, cy + 1, cy + 8, 'mist');
  p.hline(cx - 6, cx + 6, cy + 10, 'night');
  p.set(cx, cy + 12, 'slate').set(cx, cy - 3, 'slate');
  if (frozen) {
    // 两边和底下的冰，底边挂着冰凌
    for (let y = 0; y < h; y++) {
      const t = 1 + (hash2(y, 1, 7) % 3);
      for (let x = 0; x < t; x++) {
        p.set(x, y, x === t - 1 ? 'sky' : 'frost');
        p.set(w - 1 - x, y, x === t - 1 ? 'sky' : 'frost');
      }
    }
    for (let x = 0; x < w; x++) {
      const t = 3 + (hash2(x, 2, 9) % 4);
      for (let y = h - t; y < h; y++) p.set(x, y, y === h - t ? 'white' : 'frost');
      if (x % 4 === 1) p.set(x, h - t - 1, 'cloud');
    }
  }
  return p.toImage();
}

const frames: Record<string, RGBAImage> = {
  crystal_0: crystal(0),
  crystal_1: crystal(1),
  crystal_2: crystal(2),
  shard_0: shard(0),
  shard_1: shard(1),
  pen: pen(false),
  pen_old: pen(true),
  bell_0: echoBell(0),
  bell_l: echoBell(-1),
  bell_r: echoBell(1),
  pine: pine(),
  sign: sign(),
  hoof: hoof(),
  wool: wool(),
  tuft_0: tuft(0),
  tuft_1: tuft(1),
  chimes: chimes(),
  rail: rail(),
  nest: nest(),
  mist_0: mist(3),
  mist_1: mist(8),
  warn_0: warn(0),
  warn_1: warn(1),
};

export const cliffSheet: ImageSheet = { key: 'cliff', frames };
