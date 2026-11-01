import { Paint, type ImageSheet } from './paint';
import type { ColorName } from './palette';
import type { RGBAImage } from './sprite';

/**
 * 对话框头像（32×32，朝右看向文字）。每个角色是"脸型 + 表情部件"：
 * 先画衣服、后发、脸，再按表情画眼睛、眉毛、嘴、腮红，最后画刘海和帽子盖在上面。
 * 每个表情另有两帧：_blink（眨眼）和 _talk（说话时张嘴），对话框用它们做小动画。
 * 帧名：portrait/<角色>_<表情>[_blink|_talk]。
 */

const S = 32;

type Eyes = 'open' | 'closed' | 'happy' | 'wide' | 'narrow' | 'wink' | 'none';
type Mouth = 'line' | 'smile' | 'open' | 'o' | 'frown' | 'smirk' | 'grin' | 'none';
type Brows = 'none' | 'up' | 'sad' | 'angry' | 'raised';

interface Expr {
  eyes: Eyes;
  mouth: Mouth;
  brows?: Brows;
  blush?: boolean;
  /** 冒汗（担心、吃惊） */
  sweat?: boolean;
}

interface Face {
  /** 两只眼睛（2×3 的眼框左上角） */
  eyeL: [number, number];
  eyeR: [number, number];
  /** 嘴（2 像素宽的左边那个像素） */
  mouth: [number, number];
  brow: ColorName;
  /** 嘴的颜色（深色的脸上用浅一点的颜色） */
  lip?: ColorName;
}

interface Character {
  face: Face;
  /** 衣服、后发、脸：表情画在它上面 */
  back(p: Paint): void;
  /** 刘海、帽子、胡子等盖在表情上面的部分；talk 为说话帧 */
  front?(p: Paint, talk: boolean, e: Expr): void;
  outline: ColorName;
  exprs: Record<string, Expr>;
}

/** 说话帧换成张开的嘴 */
const TALK: Record<Mouth, Mouth> = {
  line: 'o',
  smile: 'open',
  open: 'smile',
  o: 'line',
  frown: 'o',
  smirk: 'open',
  grin: 'open',
  none: 'none',
};

function eyes(p: Paint, f: Face, kind: Eyes): void {
  const [lx, ly] = f.eyeL;
  const [rx, ry] = f.eyeR;
  const both: Array<[number, number, 'L' | 'R']> = [
    [lx, ly, 'L'],
    [rx, ry, 'R'],
  ];
  for (const [x, y, side] of both) {
    const k = kind === 'wink' ? (side === 'R' ? 'happy' : 'open') : kind;
    switch (k) {
      case 'open':
        p.rect(x, y, 2, 3, 'ink').set(x + 1, y, 'white');
        break;
      case 'wide':
        p.rect(x, y - 1, 2, 4, 'ink')
          .set(x + 1, y - 1, 'white')
          .set(x, y + 2, 'night');
        break;
      case 'narrow':
        p.hline(x - 1, x + 2, y, 'ink');
        p.rect(x, y + 1, 2, 2, 'ink').set(x + 1, y + 1, 'white');
        break;
      case 'closed':
        p.hline(x, x + 1, y + 2, 'ink');
        p.set(side === 'L' ? x - 1 : x + 2, y + 1, 'ink');
        break;
      case 'happy':
        p.set(x - 1, y + 2, 'ink')
          .set(x, y + 1, 'ink')
          .set(x + 1, y + 1, 'ink')
          .set(x + 2, y + 2, 'ink');
        break;
      case 'none':
        break;
    }
  }
}

function brows(p: Paint, f: Face, kind: Brows): void {
  const c = f.brow;
  const [lx, ly] = f.eyeL;
  const [rx, ry] = f.eyeR;
  switch (kind) {
    case 'up':
      p.hline(lx, lx + 1, ly - 4, c).hline(rx, rx + 1, ry - 4, c);
      break;
    case 'sad':
      // 眉头（靠近脸中间的一端）抬高
      p.set(lx - 1, ly - 2, c)
        .set(lx, ly - 2, c)
        .set(lx + 1, ly - 3, c);
      p.set(rx, ry - 3, c)
        .set(rx + 1, ry - 2, c)
        .set(rx + 2, ry - 2, c);
      break;
    case 'angry':
      // 眉头压低
      p.set(lx - 1, ly - 3, c)
        .set(lx, ly - 3, c)
        .set(lx + 1, ly - 2, c);
      p.set(rx, ry - 2, c)
        .set(rx + 1, ry - 3, c)
        .set(rx + 2, ry - 3, c);
      break;
    case 'raised':
      p.hline(lx, lx + 1, ly - 2, c);
      p.set(rx, ry - 3, c)
        .set(rx + 1, ry - 4, c)
        .set(rx + 2, ry - 3, c);
      break;
    case 'none':
      break;
  }
}

function mouth(p: Paint, f: Face, kind: Mouth): void {
  const [x, y] = f.mouth;
  const lip = f.lip ?? 'red1';
  switch (kind) {
    case 'line':
      p.hline(x, x + 1, y, lip);
      break;
    case 'smile':
      p.set(x - 1, y - 1, lip)
        .hline(x, x + 1, y, lip)
        .set(x + 2, y - 1, lip);
      break;
    case 'open':
      p.hline(x - 1, x + 2, y, 'wine')
        .hline(x, x + 1, y + 1, 'wine')
        .set(x + 1, y + 1, 'red2');
      break;
    case 'o':
      p.rect(x, y, 2, 2, 'wine');
      break;
    case 'frown':
      p.set(x - 1, y + 1, lip)
        .hline(x, x + 1, y, lip)
        .set(x + 2, y + 1, lip);
      break;
    case 'smirk':
      p.hline(x - 1, x + 1, y, lip).set(x + 2, y - 1, lip);
      break;
    case 'grin':
      p.hline(x - 1, x + 2, y, 'white').hline(x, x + 1, y + 1, 'wine');
      p.set(x - 2, y - 1, lip).set(x + 3, y - 1, lip);
      break;
    case 'none':
      break;
  }
}

function blush(p: Paint, f: Face): void {
  const [lx, ly] = f.eyeL;
  const [rx, ry] = f.eyeR;
  p.hline(lx - 2, lx - 1, ly + 4, 'blush');
  p.hline(rx + 2, rx + 3, ry + 4, 'blush');
}

function sweat(p: Paint, f: Face): void {
  const [rx, ry] = f.eyeR;
  p.set(rx + 5, ry - 3, 'white')
    .vline(rx + 5, ry - 2, ry - 1, 'sky')
    .set(rx + 4, ry - 1, 'sky');
}

/** 肩膀和衣服：一个压扁的半椭圆，右边一侧加阴影 */
function shoulders(p: Paint, c: ColorName, shade: ColorName, rx = 13): void {
  p.ellipse(16, 33, rx, 8.5, c);
  p.recolorWhere((x, y, k) => k === c && x >= 16 + rx * 0.45 && y >= 26, shade);
}

function neck(p: Paint, skin: ColorName): void {
  p.rect(14, 21, 4, 5, skin);
}

// —— 小满：草帽和红帽带、齐下巴的波波头、白衬衫配青色水手领 ——
const xiaoman: Character = {
  face: { eyeL: [13, 15], eyeR: [19, 15], mouth: [17, 20], brow: 'night' },
  outline: 'ink',
  back(p) {
    shoulders(p, 'white', 'cloud');
    // 水手领
    p.line(9, 25, 14, 30, 'teal').line(10, 25, 15, 30, 'teal');
    p.line(23, 25, 18, 30, 'teal').line(22, 25, 17, 30, 'teal');
    p.set(16, 30, 'red2').set(16, 31, 'red1');
    neck(p, 'skin1');
    // 后面的头发：波波头垂到下巴
    p.ellipse(16.5, 15, 10, 9.5, 'night');
    p.rect(6, 14, 4, 10, 'night').rect(23, 14, 4, 9, 'night');
    p.set(6, 24, null).set(26, 23, null);
    // 脸
    p.ellipse(16.8, 16.4, 7.3, 7, 'skin2');
    p.recolorWhere((x, y, c) => c === 'skin2' && y >= 21 && x <= 12, 'skin1');
    p.set(11, 22, 'skin1').set(12, 23, 'skin1');
  },
  front(p) {
    // 刘海（参差的发梢）
    p.rect(9, 9, 17, 3, 'night');
    for (const [x, y] of [
      [10, 12],
      [11, 12],
      [11, 13],
      [14, 12],
      [17, 12],
      [18, 12],
      [18, 13],
      [21, 12],
      [24, 12],
      [24, 13],
      [25, 12],
    ] as const)
      p.set(x, y, 'night');
    p.set(13, 10, 'slate').set(14, 10, 'slate').set(20, 10, 'slate');
    // 草帽：帽顶、红帽带、帽檐
    p.ellipse(16.5, 5.5, 7.5, 5.5, 'straw');
    p.recolorWhere((x, y, c) => c === 'straw' && x >= 20, 'ochre');
    p.set(12, 2, 'gold').set(13, 1, 'gold').set(12, 3, 'gold').set(14, 1, 'gold');
    p.rect(9, 6, 16, 2, 'red2').hline(9, 24, 7, 'red1');
    p.ellipse(16.5, 9.5, 15.5, 2.6, 'straw');
    p.recolorWhere((x, y, c) => c === 'straw' && y >= 10, 'ochre');
    p.hline(3, 10, 8, 'gold');
    // 帽带的结和飘带
    p.rect(24, 5, 2, 3, 'red2').set(26, 6, 'red2').set(26, 4, 'red2').set(27, 5, 'red1');
    p.set(27, 8, 'red1').set(28, 9, 'red2');
  },
  exprs: {
    normal: { eyes: 'open', mouth: 'smile', blush: true },
    happy: { eyes: 'happy', mouth: 'open', blush: true },
    surprised: { eyes: 'wide', mouth: 'o', brows: 'up', sweat: true },
    sad: { eyes: 'open', mouth: 'frown', brows: 'sad' },
    determined: { eyes: 'narrow', mouth: 'grin', brows: 'angry', blush: true },
  },
};

// —— 回回：会发光的小铃铛，豆豆眼 ——
const huihui: Character = {
  face: { eyeL: [11, 13], eyeR: [19, 13], mouth: [15, 19], brow: 'bark', lip: 'bark' },
  outline: 'bark',
  back(p) {
    // 顶上的提环
    p.rect(14, 1, 4, 3, 'ochre').rect(15, 2, 2, 1, null);
    // 铃身：圆顶 + 向下张开的铃口
    p.ellipse(16, 13, 10, 10, 'gold');
    p.rect(6, 15, 20, 7, 'gold');
    p.ellipse(16, 22.5, 12.5, 3, 'gold');
    p.recolorWhere((x, y, c) => c === 'gold' && x >= 22 && y >= 6, 'straw');
    p.recolorWhere((x, y, c) => c === 'gold' && y >= 24, 'straw');
    p.hline(5, 27, 25, 'ochre');
    // 高光
    p.vline(9, 8, 11, 'cream').set(10, 6, 'cream').set(11, 5, 'cream').set(10, 7, 'cream');
    // 铃舌
    p.rect(14, 26, 4, 3, 'bark').set(15, 29, 'bark').set(16, 29, 'bark');
    // 身边的小闪光
    p.set(3, 6, 'cream').set(2, 7, 'gold').set(4, 7, 'gold').set(3, 8, 'gold');
    p.set(29, 15, 'cream').set(28, 16, 'gold').set(30, 16, 'gold').set(29, 17, 'gold');
  },
  exprs: {
    normal: { eyes: 'open', mouth: 'smile', blush: true },
    happy: { eyes: 'happy', mouth: 'open', blush: true },
    worry: { eyes: 'open', mouth: 'frown', brows: 'sad', blush: true, sweat: true },
  },
};

// —— 海婶：青色头巾、圆脸、珊瑚色裙子配奶油色围裙 ——
const haishen: Character = {
  face: { eyeL: [12, 16], eyeR: [19, 16], mouth: [16, 21], brow: 'bark' },
  outline: 'night',
  back(p) {
    shoulders(p, 'red2', 'red1', 14);
    p.rect(11, 26, 2, 6, 'cream').rect(20, 26, 2, 6, 'cream');
    p.rect(12, 29, 9, 3, 'cream');
    neck(p, 'skin1');
    // 头巾下露出的棕色头发
    p.rect(7, 14, 3, 7, 'bark').rect(23, 14, 3, 6, 'bark');
    // 圆圆的脸
    p.ellipse(16.4, 16.8, 8.2, 7.4, 'skin2');
    p.recolorWhere((x, y, c) => c === 'skin2' && y >= 22 && x <= 12, 'skin1');
  },
  front(p) {
    // 头巾：盖住头顶，额前一道边，右边打结
    p.ellipse(16.5, 10, 10.5, 6.5, 'sea');
    p.rect(7, 10, 19, 3, 'sea');
    p.hline(8, 25, 12, 'teal');
    for (const [x, y] of [
      [11, 6],
      [15, 5],
      [19, 6],
      [13, 9],
      [17, 8],
      [21, 9],
      [10, 10],
      [23, 10],
    ] as const)
      p.set(x, y, 'teal');
    p.set(13, 4, 'teal').set(14, 4, 'teal');
    // 结和垂下来的两条尾巴
    p.rect(25, 11, 3, 3, 'sea').set(28, 12, 'teal');
    p.line(26, 14, 28, 18, 'sea').line(25, 14, 26, 19, 'teal');
    // 耳环
    p.set(8, 21, 'gold');
  },
  exprs: {
    normal: { eyes: 'open', mouth: 'smile', blush: true },
  },
};

// —— 阿豆：刺刺的黑头发、鼻梁上贴着创可贴、蓝白条纹背心 ——
const adou: Character = {
  face: { eyeL: [12, 17], eyeR: [18, 17], mouth: [16, 22], brow: 'night' },
  outline: 'night',
  back(p) {
    // 光着的肩膀 + 条纹背心
    p.ellipse(16, 34, 12, 8, 'skin2');
    p.ellipse(16, 34, 8, 8, 'white');
    for (let y = 26; y < S; y++)
      p.recolorWhere((x, yy, c) => yy === y && c === 'white' && y % 2 === 1, 'sky');
    p.recolorWhere((x, y, c) => c === 'skin2' && y >= 27 && x >= 22, 'skin1');
    neck(p, 'skin1');
    p.rect(14, 23, 4, 3, 'skin1');
    // 脸（小孩子脸圆、位置低一点）
    p.ellipse(16.2, 18.2, 7.6, 7, 'skin2');
    p.recolorWhere((x, y, c) => c === 'skin2' && y >= 23 && x <= 12, 'skin1');
  },
  front(p) {
    // 刺刺头
    p.ellipse(16, 11.5, 8.8, 5.5, 'night');
    const spikes: Array<[number, number, number]> = [
      [8, 9, 5],
      [10, 6, 4],
      [13, 4, 3],
      [16, 3, 3],
      [19, 4, 3],
      [22, 6, 4],
      [24, 9, 4],
    ];
    for (const [x, top, h] of spikes) {
      p.vline(x, top, top + h, 'night');
      p.vline(x + 1, top + 1, top + h, 'night');
    }
    // 刘海参差
    p.rect(9, 12, 15, 2, 'night');
    for (const x of [10, 13, 16, 19, 22]) p.set(x, 14, 'night');
    p.set(14, 8, 'slate').set(15, 8, 'slate').set(18, 9, 'slate');
    // 创可贴
    p.hline(14, 18, 20, 'cream').set(16, 20, 'sand3');
  },
  exprs: {
    normal: { eyes: 'open', mouth: 'smile', blush: true },
    happy: { eyes: 'happy', mouth: 'open', blush: true },
  },
};

// —— 白露：齐耳黑短发、斜刘海、金色小鱼发夹、青色上衣 ——
const bailu: Character = {
  face: { eyeL: [13, 16], eyeR: [19, 16], mouth: [17, 21], brow: 'night' },
  outline: 'ink',
  back(p) {
    shoulders(p, 'teal', 'sea');
    // 白色的 V 领
    p.line(12, 25, 16, 29, 'cloud').line(20, 25, 16, 29, 'cloud');
    p.line(13, 25, 16, 28, 'skin1').line(19, 25, 16, 28, 'skin1');
    neck(p, 'skin1');
    p.ellipse(16.5, 14.5, 9.6, 9, 'night');
    p.rect(7, 13, 3, 9, 'night');
    // 脸略瘦
    p.ellipse(17, 16.6, 6.9, 7.2, 'skin2');
    p.recolorWhere((x, y, c) => c === 'skin2' && y >= 21 && x <= 13, 'skin1');
    // 别在耳后的头发露出耳朵
    p.set(24, 16, 'skin1').set(24, 17, 'skin2');
  },
  front(p) {
    // 斜刘海：左边长、右边短
    p.rect(9, 7, 17, 4, 'night');
    p.line(9, 11, 17, 11, 'night').line(9, 12, 13, 12, 'night').line(9, 13, 11, 13, 'night');
    p.set(18, 11, 'night').set(22, 11, 'night');
    p.hline(14, 18, 8, 'slate').set(19, 9, 'slate');
    // 小鱼发夹
    p.hline(10, 13, 9, 'gold').set(11, 8, 'gold').set(11, 10, 'gold');
    p.set(9, 8, 'orange').set(9, 10, 'orange').set(12, 9, 'ink');
  },
  exprs: {
    normal: { eyes: 'narrow', mouth: 'smile' },
    smirk: { eyes: 'wink', mouth: 'smirk', brows: 'raised' },
  },
};

// —— 钟爷爷：守钟人的小帽（帽顶一颗小金铃）、浓眉、白胡子、深蓝长袍 ——
const grandpa: Character = {
  face: { eyeL: [12, 16], eyeR: [19, 16], mouth: [16, 22], brow: 'cloud', lip: 'wine' },
  outline: 'ink',
  back(p) {
    shoulders(p, 'sea', 'deep', 14);
    p.line(12, 25, 16, 30, 'cloud').line(20, 25, 16, 30, 'cloud');
    neck(p, 'skin1');
    // 鬓角的白发连到胡子
    p.rect(8, 17, 2, 5, 'cloud').rect(24, 17, 2, 5, 'cloud');
    p.ellipse(16.4, 16.5, 7.8, 7.4, 'skin1');
    p.set(9, 17, 'skin1').set(24, 17, 'skin1');
  },
  front(p, talk) {
    // 小帽
    p.ellipse(16.5, 9, 8.6, 4.4, 'bark');
    p.rect(8, 9, 17, 2, 'bark');
    p.hline(8, 24, 10, 'ochre');
    p.set(16, 3, 'gold').set(17, 3, 'gold').set(16, 4, 'straw').set(17, 4, 'straw');
    // 浓眉
    p.rect(10, 13, 5, 2, 'cloud').rect(18, 13, 5, 2, 'cloud');
    p.set(10, 15, 'cloud').set(22, 15, 'cloud');
    // 圆鼻子
    p.rect(16, 18, 2, 2, 'blush');
    // 胡子
    p.ellipse(16.5, 25, 6.5, 4.5, 'cloud');
    p.hline(11, 22, 21, 'cloud').hline(12, 21, 20, 'white');
    p.set(13, 29, 'cloud').set(19, 29, 'cloud').set(16, 30, 'white');
    if (talk) p.hline(15, 18, 22, 'wine').set(16, 23, 'wine').set(17, 23, 'wine');
    p.recolorWhere((x, y, c) => c === 'cloud' && x >= 20 && y >= 23, 'mist');
  },
  exprs: {
    normal: { eyes: 'open', mouth: 'none' },
  },
};

// —— 霜降：冷白面具（眼缝、紫色泪痕、额上的雪花纹）、银蓝长发、高领紫斗篷 ——
const shuangjiang: Character = {
  face: { eyeL: [12, 16], eyeR: [19, 16], mouth: [16, 22], brow: 'mist' },
  outline: 'ink',
  back(p) {
    // 长发披到肩下
    p.ellipse(16.5, 15, 11, 11, 'mist');
    p.rect(5, 14, 5, 18, 'mist').rect(23, 14, 5, 18, 'mist');
    p.recolorWhere((x, y, c) => c === 'mist' && (x <= 7 || x >= 26) && y >= 12, 'stone');
    p.vline(7, 16, 30, 'cloud').vline(25, 18, 31, 'cloud');
    // 高领斗篷
    p.ellipse(16, 34, 15, 9, 'violet');
    p.rect(8, 22, 4, 6, 'violet').rect(21, 22, 4, 6, 'violet');
    p.line(8, 22, 12, 27, 'frost').line(24, 22, 20, 27, 'frost');
    p.recolorWhere((x, y, c) => c === 'violet' && x >= 22 && y >= 26, 'deep');
    // 面具
    p.ellipse(16.5, 16, 6.8, 8, 'cloud');
    p.recolorWhere((x, y, c) => c === 'cloud' && x <= 12 && y <= 13, 'white');
    p.recolorWhere((x, y, c) => c === 'cloud' && x >= 21 && y >= 18, 'mist');
  },
  front(p, talk) {
    // 眼缝（说话时透出冷光）
    p.line(11, 16, 14, 17, 'ink').line(18, 17, 21, 16, 'ink');
    if (talk) p.set(13, 17, 'frost').set(19, 17, 'frost');
    // 紫色泪痕
    p.vline(12, 19, 21, 'violet').vline(20, 19, 21, 'violet');
    p.set(12, 22, 'frost').set(20, 22, 'frost');
    // 额上的雪花纹
    p.vline(16, 9, 13, 'frost').hline(14, 18, 11, 'frost');
    p.set(14, 9, 'frost').set(18, 9, 'frost').set(14, 13, 'frost').set(18, 13, 'frost');
    // 刘海从中间分开
    p.line(9, 7, 15, 9, 'mist').line(10, 6, 16, 8, 'mist');
    p.line(23, 7, 17, 9, 'mist').line(22, 6, 16, 8, 'mist');
    p.ellipse(16.5, 6, 8, 2.5, 'mist');
    p.set(12, 5, 'cloud').set(13, 5, 'cloud').set(20, 6, 'cloud');
  },
  exprs: {
    normal: { eyes: 'none', mouth: 'none' },
  },
};

// —— 大暑：晒得黝黑的圆脸、额头绑着白毛巾（脑后打个结）、橙色背心 ——
const daishu: Character = {
  face: { eyeL: [12, 17], eyeR: [19, 17], mouth: [16, 22], brow: 'bark', lip: 'wine' },
  outline: 'ink',
  back(p) {
    // 光着的肩膀，橙色背心
    p.ellipse(16, 34, 15, 9, 'skin1');
    p.ellipse(16, 35, 10, 9, 'orange');
    p.recolorWhere((x, y, c) => c === 'orange' && x >= 20 && y >= 27, 'red2');
    p.set(13, 27, 'gold').set(14, 27, 'gold').set(12, 28, 'gold');
    neck(p, 'skin1');
    // 圆圆的大脸
    p.ellipse(16.5, 17, 8.8, 8.4, 'skin1');
    p.recolorWhere((x, y, c) => c === 'skin1' && y >= 22 && y < 26 && x <= 11, 'ochre');
  },
  front(p) {
    // 短短的黑发，额头绑着白毛巾
    p.ellipse(16.5, 8.5, 8.4, 3.2, 'night');
    p.rect(8, 10, 17, 3, 'cloud');
    p.hline(8, 24, 10, 'white');
    p.set(16, 12, 'mist').set(20, 12, 'mist');
    // 毛巾在脑后打的结
    p.set(7, 10, 'cloud').set(6, 11, 'cloud').set(5, 12, 'cloud').set(6, 13, 'mist');
    p.set(7, 13, 'cloud').set(5, 10, 'white');
  },
  exprs: {
    normal: { eyes: 'open', mouth: 'smile' },
    sweat: { eyes: 'narrow', mouth: 'grin', sweat: true },
    laugh: { eyes: 'happy', mouth: 'open' },
  },
};

export const PORTRAITS: Record<string, Character> = {
  xiaoman,
  huihui,
  haishen,
  adou,
  bailu,
  grandpa,
  shuangjiang,
  daishu,
};

function draw(c: Character, e: Expr, variant: 'base' | 'blink' | 'talk'): RGBAImage {
  const p = new Paint(S, S);
  c.back(p);
  if (e.blush) blush(p, c.face);
  const eyeKind =
    variant === 'blink' && e.eyes !== 'happy' && e.eyes !== 'none' ? 'closed' : e.eyes;
  eyes(p, c.face, eyeKind);
  brows(p, c.face, e.brows ?? 'none');
  mouth(p, c.face, variant === 'talk' ? TALK[e.mouth] : e.mouth);
  if (e.sweat) sweat(p, c.face);
  c.front?.(p, variant === 'talk', e);
  p.outline(c.outline);
  return p.toImage();
}

/** 某个角色有没有这个表情（没有就用 normal） */
export function portraitFrame(
  who: string,
  face = 'normal',
  variant: '' | 'blink' | 'talk' = '',
): string {
  const c = PORTRAITS[who];
  const f = c && c.exprs[face] ? face : 'normal';
  return `portrait/${who}_${f}${variant ? `_${variant}` : ''}`;
}

const frames: Record<string, RGBAImage> = {};
for (const [id, c] of Object.entries(PORTRAITS)) {
  for (const [name, e] of Object.entries(c.exprs)) {
    frames[`${id}_${name}`] = draw(c, e, 'base');
    frames[`${id}_${name}_blink`] = draw(c, e, 'blink');
    frames[`${id}_${name}_talk`] = draw(c, e, 'talk');
  }
}

export const portraitSheet: ImageSheet = { key: 'portrait', frames };
