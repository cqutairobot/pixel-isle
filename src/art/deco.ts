import { Paint, type ImageSheet } from './paint';
import type { ColorName } from './palette';
import { rng } from './rng';
import type { RGBAImage } from './sprite';

/**
 * 场景装饰（原点在左下角，对齐格子）：房屋、钟楼、集市摊、渔网、灯笼、花盆、栅栏、长椅、
 * 椰子树、礁石、海星、晾鱼架、系船柱、渔船；以及检查点铃柱、终点铃门、风铃架。
 * 背景装饰用柔和的浅色描边（PLAN §8：背景低对比、不用深色描边），可交互的东西用深蓝描边。
 */

/** 白墙平顶的海边小屋 */
function house(
  w: number,
  h: number,
  wall: ColorName,
  wallShade: ColorName,
  trim: ColorName,
  door: ColorName,
  seed: number,
): Paint {
  const p = new Paint(w, h);
  const rand = rng(seed);
  // 墙
  p.rect(3, 10, w - 6, h - 10, wall);
  p.rect(w - 7, 10, 4, h - 10, wallShade);
  p.rect(3, h - 3, w - 6, 3, wallShade);
  // 墙面上淡淡的斑驳
  for (let i = 0; i < 14; i++)
    p.set(4 + Math.floor(rand() * (w - 12)), 12 + Math.floor(rand() * (h - 16)), wallShade);
  // 平顶：檐口 + 女儿墙
  p.rect(0, 4, w, 6, trim);
  p.hline(0, w - 1, 4, 'orange');
  p.hline(0, w - 1, 9, 'red1');
  for (let x = 2; x < w - 2; x += 6) p.rect(x, 0, 3, 4, wall);
  p.hline(0, w - 1, 10, wallShade);
  // 门
  const dx = Math.round(w / 2) - 7;
  p.rect(dx, h - 26, 14, 23, door);
  p.ellipse(dx + 7, h - 26, 7, 4, door);
  p.vline(dx + 7, h - 28, h - 4, 'deep');
  p.set(dx + 10, h - 14, 'gold');
  p.rect(dx - 3, h - 3, 20, 3, 'stone');
  p.hline(dx - 3, dx + 16, h - 3, 'mist');
  // 窗：蓝色百叶 + 玻璃反光 + 花箱
  for (const wx of [10, w - 26]) {
    p.rect(wx, 20, 16, 14, 'sea');
    p.rect(wx + 2, 22, 12, 10, 'sky');
    p.vline(wx + 8, 22, 31, 'sea');
    p.hline(wx + 2, wx + 13, 26, 'sea');
    p.set(wx + 3, 23, 'white')
      .set(wx + 4, 23, 'white')
      .set(wx + 3, 24, 'white');
    p.rect(wx - 1, 34, 18, 3, 'bark');
    for (let i = 0; i < 6; i++) {
      p.set(wx + 1 + i * 3, 33, i % 2 ? 'blush' : 'gold');
      p.set(wx + 2 + i * 3, 33, 'leaf2');
    }
  }
  return p;
}

function houseHome(): RGBAImage {
  const p = house(96, 72, 'cloud', 'mist', 'red2', 'sea', 3);
  // 守钟人家门口挂着一只小铃铛
  p.vline(48, 36, 40, 'bark');
  p.ellipse(48, 43, 3, 3, 'gold');
  p.rect(45, 43, 7, 2, 'gold');
  p.hline(44, 52, 45, 'straw');
  p.set(47, 41, 'cream');
  p.outline('mist');
  return p.toImage();
}

function houseRoof(): RGBAImage {
  // 平顶露台：顶边和第 8 行的木板平台对齐，木板盖住檐口
  const p = house(96, 64, 'cream', 'sand3', 'bark', 'red2', 9);
  p.rect(0, 0, 96, 4, null);
  p.hline(0, 95, 4, 'ochre');
  p.outline('sand2');
  return p.toImage();
}

/** 集市摊：红白条纹的布棚挂在木板下面，柜台上摆着芒果和鱼 */
function stall(): RGBAImage {
  const p = new Paint(96, 48);
  p.rect(18, 4, 2, 44, 'bark');
  p.rect(90, 4, 2, 44, 'bark');
  // 布棚的垂边：红白相间，下沿是波浪
  for (let x = 16; x < 96; x++) {
    const stripe = Math.floor((x - 16) / 5) % 2 === 0;
    const bottom = 13 + (Math.floor((x - 16) / 5) % 2);
    for (let y = 6; y <= bottom; y++) p.set(x, y, stripe ? 'red2' : 'cream');
  }
  p.hline(16, 95, 6, 'red1');
  // 柜台
  p.rect(22, 30, 66, 18, 'bark');
  p.rect(22, 30, 66, 3, 'ochre');
  p.hline(22, 87, 30, 'sand1');
  for (let x = 26; x < 86; x += 12) p.vline(x, 35, 46, 'night');
  // 货物：一筐芒果、一排鱼
  p.ellipse(34, 28, 7, 3, 'ochre');
  for (const [x, c] of [
    [30, 'gold'],
    [34, 'orange'],
    [38, 'gold'],
    [32, 'orange'],
    [36, 'gold'],
  ] as const)
    p.disc(x, x % 4 === 0 ? 25 : 26, 1.8, c);
  for (let i = 0; i < 4; i++) {
    const fx = 52 + i * 8;
    p.ellipse(fx, 27, 3.5, 1.6, 'mist');
    p.set(fx + 3, 26, 'mist')
      .set(fx + 4, 25, 'stone')
      .set(fx + 4, 28, 'stone');
    p.set(fx - 2, 26, 'ink');
  }
  p.outline('sand1');
  return p.toImage();
}

/** 晒渔网：两根杆子之间挂着一张下垂的网，顶绳上有浮子 */
function nets(): RGBAImage {
  const p = new Paint(48, 44);
  p.rect(2, 2, 2, 42, 'bark');
  p.rect(44, 2, 2, 42, 'bark');
  const sag = (x: number) => 6 + Math.sin(((x - 4) / 40) * Math.PI) * 4;
  for (let x = 4; x < 44; x++) {
    const top = Math.round(sag(x));
    p.set(x, top, 'sand1');
    const bottom = Math.round(top + 18 + Math.sin(((x - 4) / 40) * Math.PI) * 6);
    for (let y = top + 1; y <= bottom; y++) {
      if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0)
        p.set(x, y, (x + y) % 8 === 0 ? 'stone' : 'mist');
    }
  }
  for (let x = 8; x < 42; x += 7)
    p.ellipse(x, Math.round(sag(x)) + 1, 1.5, 1.2, x % 2 ? 'red2' : 'white');
  return p.toImage();
}

/** 路灯杆上挂着纸灯笼（frame 1 的光稍弱，做出摇曳） */
function lantern(frame: number): RGBAImage {
  const p = new Paint(14, 36);
  p.rect(2, 2, 2, 34, 'bark');
  p.hline(2, 9, 2, 'bark');
  p.vline(9, 3, 5, 'night');
  p.ellipse(9, 10, 3.5, 4.5, 'red2');
  p.hline(6, 12, 10, frame ? 'orange' : 'gold');
  p.vline(9, 7, 13, frame ? 'red1' : 'orange');
  p.hline(7, 11, 5, 'night');
  p.hline(7, 11, 15, 'night');
  p.vline(9, 16, 18, 'gold');
  p.rect(0, 34, 6, 2, 'stone');
  return p.toImage();
}

function flowers(seed: number): RGBAImage {
  const p = new Paint(24, 16);
  const rand = rng(seed);
  p.rect(6, 10, 12, 6, 'red1');
  p.rect(5, 9, 14, 2, 'orange');
  p.hline(6, 17, 15, 'wine');
  p.ellipse(12, 7, 8, 4.5, 'leaf2');
  p.ellipse(10, 6, 4, 3, 'leaf3');
  p.recolorWhere((_x, y, c) => c === 'leaf2' && y >= 8, 'leaf1');
  const colors: ColorName[] = ['blush', 'white', 'gold', 'blush'];
  for (let i = 0; i < 7; i++) {
    const x = 6 + Math.floor(rand() * 13);
    const y = 3 + Math.floor(rand() * 5);
    p.set(x, y, colors[i % colors.length]!);
    if (i % 2 === 0) p.set(x + 1, y, colors[(i + 1) % colors.length]!);
  }
  return p.toImage();
}

function fence(): RGBAImage {
  const p = new Paint(48, 14);
  p.hline(0, 47, 5, 'mist');
  p.hline(0, 47, 10, 'mist');
  for (let x = 1; x < 48; x += 6) {
    p.rect(x, 2, 3, 12, 'white');
    p.set(x + 1, 1, 'white');
    p.vline(x + 2, 3, 13, 'mist');
  }
  p.outline('stone');
  return p.toImage();
}

function bench(): RGBAImage {
  const p = new Paint(32, 14);
  p.rect(1, 6, 30, 3, 'ochre');
  p.hline(1, 30, 6, 'sand1');
  p.rect(1, 1, 30, 2, 'ochre');
  for (const x of [4, 26]) p.rect(x, 3, 2, 11, 'bark');
  p.outline('bark');
  return p.toImage();
}

/** 钟楼：石砌底座、白墙、开敞的钟亭和大钟、红瓦尖顶；冰霜从底座往上爬 */
function tower(): RGBAImage {
  const w = 80;
  const h = 176;
  const p = new Paint(w, h);
  const rand = rng(21);
  // 尖顶
  for (let y = 4; y < 30; y++) {
    const half = Math.round(4 + ((y - 4) / 26) * 34);
    p.hline(40 - half, 39 + half, y, (y + Math.floor(rand() * 2)) % 4 === 0 ? 'red1' : 'red2');
  }
  for (let y = 6; y < 30; y += 4)
    p.hline(
      40 - Math.round(4 + ((y - 4) / 26) * 34),
      39 + Math.round(4 + ((y - 4) / 26) * 34),
      y,
      'red1',
    );
  p.hline(4, 75, 30, 'wine');
  p.vline(40, 0, 4, 'gold');
  p.set(39, 1, 'gold').set(41, 1, 'gold');
  // 钟亭
  p.rect(8, 31, 64, 40, 'cream');
  p.rect(14, 36, 52, 33, 'slate');
  p.rect(14, 36, 52, 3, 'night');
  for (const x of [8, 37, 66]) p.rect(x, 31, 6, 40, 'cream');
  p.ellipse(25, 38, 11, 4, 'cream');
  p.ellipse(54, 38, 11, 4, 'cream');
  p.rect(6, 69, 68, 4, 'sand3');
  // 大钟（挂在横梁中间）与四个空挂钩
  p.vline(40, 39, 42, 'bark');
  p.ellipse(40, 50, 9, 8, 'gold');
  p.rect(31, 50, 19, 8, 'gold');
  p.hline(29, 51, 58, 'straw');
  p.hline(29, 51, 59, 'ochre');
  p.recolorWhere((x, y, c) => c === 'gold' && x > 43 && y > 44, 'straw');
  p.vline(35, 44, 55, 'cream');
  p.vline(36, 44, 48, 'cream');
  for (const hx of [20, 28, 52, 60]) {
    p.vline(hx, 39, 43, 'bark');
    p.set(hx + 1, 43, 'bark');
  }
  // 白墙塔身 + 圆窗
  p.rect(10, 73, 60, 64, 'cloud');
  p.rect(62, 73, 8, 64, 'mist');
  p.disc(40, 92, 8, 'sea');
  p.disc(40, 92, 6, 'sky');
  p.hline(34, 46, 92, 'sea');
  p.vline(40, 86, 98, 'sea');
  p.set(37, 89, 'white').set(38, 88, 'white');
  for (let i = 0; i < 10; i++)
    p.set(12 + Math.floor(rand() * 48), 104 + Math.floor(rand() * 30), 'mist');
  // 石砌底座 + 木门
  p.rect(4, 137, 72, 39, 'stone');
  for (let y = 137; y < 176; y += 6) {
    p.hline(4, 75, y, 'slate');
    for (let x = 4 + ((y / 6) % 2) * 6; x < 76; x += 12) p.vline(x, y, y + 5, 'slate');
  }
  p.hline(4, 75, 137, 'mist');
  p.rect(30, 150, 20, 26, 'bark');
  p.ellipse(40, 150, 10, 6, 'bark');
  p.vline(40, 146, 175, 'night');
  p.set(44, 162, 'gold');
  // 冰霜：底座和塔身上不规则的冰斑，钟亭边缘挂着冰柱，大钟上也结了霜
  const frost = (cx: number, cy: number, r: number) => {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r && rand() < 0.8) {
          const c = p.get(cx + x, cy + y);
          if (c) p.set(cx + x, cy + y, y < -r / 3 ? 'white' : x > r / 3 ? 'frost' : 'cloud');
        }
  };
  for (let i = 0; i < 14; i++)
    frost(6 + Math.floor(rand() * 68), 140 + Math.floor(rand() * 36), 2 + Math.floor(rand() * 4));
  for (let i = 0; i < 6; i++)
    frost(12 + Math.floor(rand() * 56), 110 + Math.floor(rand() * 26), 2 + Math.floor(rand() * 2));
  frost(36, 55, 3);
  frost(45, 49, 2);
  for (let x = 9; x < 72; x += 5 + Math.floor(rand() * 3)) {
    const len = 2 + Math.floor(rand() * 4);
    p.vline(x, 73, 73 + len, 'frost');
    p.set(x, 73, 'white');
  }
  p.outline('slate');
  return p.toImage();
}

/** 椰子树：弯弯的树干（一节一节的环纹），六片下垂的叶子，几颗椰子；frame 让叶尖摆动 */
function palm(size: number, frame: number): RGBAImage {
  const W = Math.round(56 * size);
  const H = Math.round(88 * size);
  const p = new Paint(W, H);
  const baseX = W / 2 - 4 * size;
  const topX = W / 2 + 3 * size;
  const topY = Math.round(20 * size);
  for (let y = H - 1; y >= topY; y--) {
    const t = (H - 1 - y) / (H - 1 - topY);
    const cx = baseX + (topX - baseX) * Math.sin(t * Math.PI * 0.5);
    const half = (2.6 - t * 0.8) * size;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const ring = (H - y) % Math.max(3, Math.round(4 * size)) === 0;
      p.set(x, y, ring ? 'bark' : x < cx - half / 3 ? 'sand1' : 'ochre');
    }
  }
  const sway = frame ? 1 : 0;
  const fronds = [-2.7, -2.1, -1.4, -0.4, 0.3, 1.0];
  for (const a of fronds) {
    const len = (24 + Math.abs(a) * 2) * size;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const x =
        topX +
        Math.cos(a) * i * (a > -1.6 ? 1 : 0.95) +
        (t > 0.6 ? sway * Math.sign(Math.cos(a)) : 0);
      const y = topY + Math.sin(a) * i * 0.55 + t * t * 14 * size + (t > 0.7 ? sway : 0);
      const thick = Math.max(1, Math.round((1 - t) * 3 * size));
      for (let k = 0; k < thick; k++)
        p.set(x, y + k, k === 0 ? (t < 0.5 ? 'leaf3' : 'leaf2') : 'leaf1');
      if (i % 3 === 0 && t > 0.15) p.set(x, y + thick + 1, 'leaf1');
    }
  }
  p.ellipse(topX, topY + 1, 4 * size, 2.5 * size, 'leaf2');
  for (const dx of [-2, 1, 3]) p.disc(topX + dx * size, topY + 4 * size, 1.6 * size, 'bark');
  p.outline('pine');
  return p.toImage();
}

function rock(): RGBAImage {
  const p = new Paint(26, 14);
  p.ellipse(12, 10, 11, 6, 'stone');
  p.ellipse(19, 11, 6, 4, 'stone');
  p.ellipse(9, 7, 5, 3, 'mist');
  p.recolorWhere((_x, y, c) => c === 'stone' && y > 11, 'slate');
  p.set(7, 5, 'cloud').set(8, 5, 'cloud');
  p.outline('slate');
  return p.toImage();
}

function starfish(): RGBAImage {
  const p = new Paint(11, 7);
  p.rect(4, 2, 3, 3, 'orange');
  p.line(5, 2, 5, 0, 'orange');
  p.line(4, 3, 0, 2, 'orange');
  p.line(6, 3, 10, 2, 'orange');
  p.line(4, 4, 2, 6, 'orange');
  p.line(6, 4, 8, 6, 'orange');
  p.set(5, 3, 'gold');
  p.outline('red1');
  return p.toImage();
}

function shellsDecal(): RGBAImage {
  const p = new Paint(18, 6);
  p.ellipse(4, 3, 3, 2, 'cream');
  p.set(4, 2, 'skin1').set(2, 3, 'skin1');
  p.ellipse(12, 4, 2, 1.5, 'blush');
  p.set(15, 4, 'white');
  p.outline('sand1');
  return p.toImage();
}

/** 晾鱼架：两根交叉的木杆架着横杆，挂着几条小鱼和一张网 */
function rack(): RGBAImage {
  const p = new Paint(44, 38);
  for (const x of [4, 38]) {
    p.line(x - 3, 37, x + 2, 6, 'bark');
    p.line(x + 3, 37, x - 2, 6, 'bark');
  }
  p.hline(0, 43, 8, 'ochre');
  p.hline(0, 43, 9, 'bark');
  for (let i = 0; i < 5; i++) {
    const fx = 9 + i * 6;
    p.vline(fx, 10, 12, 'sand1');
    p.ellipse(fx, 16, 1.6, 3.5, 'mist');
    p.set(fx, 13, 'ink');
    p.set(fx - 1, 20, 'stone').set(fx + 1, 20, 'stone');
  }
  for (let x = 6; x < 38; x++)
    for (let y = 24; y < 34; y++) if ((x + y) % 4 === 0) p.set(x, y, 'mist');
  return p.toImage();
}

/** 系船柱（木桩上缠着绳子），可选一只海鸥站在上面 */
function post(gull: boolean): RGBAImage {
  const p = new Paint(12, 34);
  p.rect(3, 8, 6, 26, 'bark');
  p.vline(4, 8, 33, 'ochre');
  p.hline(3, 8, 8, 'sand1');
  p.hline(2, 9, 14, 'sand2');
  p.hline(2, 9, 16, 'sand2');
  if (gull) {
    p.ellipse(6, 5, 3.5, 2.2, 'white');
    p.set(3, 3, 'white').set(2, 3, 'white');
    p.hline(5, 9, 6, 'mist');
    p.set(9, 4, 'gold').set(10, 4, 'gold').set(8, 3, 'ink');
    p.vline(6, 7, 7, 'gold');
  }
  p.outline('night');
  return p.toImage();
}

/** 小渔船：红色船身、奶油色腰线，船舱里横着两支桨 */
function boat(): RGBAImage {
  const p = new Paint(52, 20);
  for (let y = 8; y < 20; y++) {
    const inset = Math.round(((y - 8) / 11) ** 1.6 * 10);
    p.hline(inset, 51 - inset, y, y < 11 ? 'cream' : y < 16 ? 'red2' : 'red1');
  }
  p.hline(0, 51, 8, 'wine');
  p.rect(6, 6, 40, 2, 'bark');
  p.line(14, 6, 4, 2, 'ochre').line(36, 6, 46, 2, 'ochre');
  p.vline(26, 0, 6, 'bark');
  p.rect(27, 1, 6, 4, 'cream');
  p.outline('night');
  return p.toImage();
}

/** 检查点铃柱：未激活时丝带缠在杆子上、铃铛暗淡；激活后丝带展开飘动、铃铛发亮 */
function checkpoint(active: boolean, frame: number): RGBAImage {
  const p = new Paint(22, 42);
  p.rect(5, 6, 3, 36, 'bark');
  p.vline(5, 6, 41, 'ochre');
  p.rect(3, 39, 7, 3, 'stone');
  p.hline(2, 12, 6, 'bark');
  p.vline(11, 7, 8, 'night');
  const bell: ColorName = active ? 'gold' : 'ochre';
  p.ellipse(11, 12, 3.5, 3.2, bell);
  p.rect(7, 12, 9, 3, bell);
  p.hline(7, 15, 15, active ? 'straw' : 'bark');
  p.set(9, 10, active ? 'cream' : 'sand1');
  if (active) {
    // 丝带从杆顶展开，向右飘
    for (let i = 0; i < 12; i++) {
      const y = 18 + i + Math.round(Math.sin(i * 0.7 + frame * 1.8) * 1.2);
      p.set(8 + i, y, 'red2');
      p.set(8 + i, y + 1, 'red1');
    }
  } else {
    for (let y = 18; y < 34; y += 3) {
      p.set(4, y, 'red2')
        .set(5, y + 1, 'red2')
        .set(6, y + 1, 'red2')
        .set(7, y + 2, 'red1');
    }
  }
  p.outline('night');
  return p.toImage();
}

/** 终点铃门：两根木柱、一道带红瓦飞檐的小屋顶、檐下挂着大铃铛和贝壳串；frame 0 正 / 1 左摆 / 2 右摆 */
function gate(frame: number): RGBAImage {
  const p = new Paint(58, 72);
  for (const x of [8, 44]) {
    p.rect(x, 18, 6, 54, 'bark');
    p.vline(x + 1, 18, 71, 'ochre');
    p.rect(x - 1, 66, 8, 6, 'stone');
    p.hline(x - 1, x + 6, 66, 'mist');
  }
  // 屋顶：红瓦，两端飞檐上翘，屋脊两头是金色的小铃
  for (let y = 6; y < 16; y++) {
    const t = (y - 6) / 9;
    const half = Math.round(18 + t * 9);
    p.hline(29 - half, 28 + half, y, y % 3 === 0 ? 'red1' : 'red2');
  }
  p.hline(1, 56, 16, 'wine');
  p.set(0, 14, 'red2').set(1, 15, 'red2').set(57, 14, 'red2').set(56, 15, 'red2');
  p.set(0, 13, 'gold').set(57, 13, 'gold');
  p.hline(12, 45, 5, 'wine');
  p.rect(10, 3, 3, 3, 'gold').rect(45, 3, 3, 3, 'gold');
  // 横梁
  p.rect(6, 17, 46, 4, 'bark');
  p.hline(6, 51, 17, 'ochre');
  // 贝壳串
  for (let x = 15; x < 44; x += 4) {
    const y = 23 + Math.round(Math.sin(((x - 15) / 28) * Math.PI) * 4);
    p.set(x, y, x % 8 === 3 ? 'cream' : 'blush');
  }
  // 大铃铛
  const sw = frame === 1 ? -1 : frame === 2 ? 1 : 0;
  p.vline(29, 21, 25, 'sand1');
  const bx = 29 + sw;
  p.ellipse(bx, 31, 6, 6, 'gold');
  p.rect(bx - 6, 31, 13, 6, 'gold');
  p.hline(bx - 7, bx + 7, 37, 'straw');
  p.recolorWhere((x, y, c) => c === 'gold' && x > bx + 2 && y > 27, 'straw');
  p.vline(bx - 3, 28, 35, 'cream');
  p.rect(bx - 1 + sw, 38, 2, 2, 'bark');
  p.outline('night');
  return p.toImage();
}

/** 风铃架（4 格宽）：两根细柱、一根横梁，顶上一道小瓦檐，两头挂着红色流苏；风铃单独成图，挂在横梁下 */
function chimeFrame(): RGBAImage {
  const p = new Paint(64, 80);
  p.rect(1, 2, 2, 78, 'bark');
  p.rect(61, 2, 2, 78, 'bark');
  p.vline(1, 2, 79, 'ochre');
  p.rect(0, 1, 64, 3, 'bark');
  p.hline(0, 63, 1, 'ochre');
  p.hline(3, 60, 4, 'night');
  // 小瓦檐
  p.hline(2, 61, 0, 'red2');
  p.set(0, 0, 'red1').set(63, 0, 'red1');
  // 流苏
  for (const x of [5, 58]) {
    p.vline(x, 4, 8, 'red2');
    p.rect(x - 1, 9, 3, 3, 'red1');
    p.vline(x, 12, 14, 'red2');
  }
  return p.toImage();
}

/** 一只玻璃风铃：从横梁垂下的细绳、玻璃铃身、下面挂着红色纸条 */
function chime(len: number, bw: number, bh: number, strip: number): RGBAImage {
  const W = bw + 2;
  const p = new Paint(W, len + bh + strip + 1);
  const cx = Math.floor(W / 2);
  p.vline(cx, 0, len, 'mist');
  p.ellipse(cx + 0.5, len + bh / 2 + 0.5, bw / 2, bh / 2, 'cloud');
  p.rect(1, len + Math.ceil(bh / 2), bw, Math.floor(bh / 2), 'cloud');
  p.hline(1, bw, len + bh, 'sky');
  p.set(cx - 1, len + 2, 'white');
  p.set(cx + 1, len + bh - 2, 'teal');
  p.rect(cx - 1, len + bh + 1, 2, strip, 'red2');
  p.vline(cx, len + bh + 1, len + bh + strip, 'blush');
  p.outline('slate');
  return p.toImage();
}

/** 冰霜脚印：一小块带白边的冰 */
function print(): RGBAImage {
  const p = new Paint(5, 2);
  p.hline(0, 3, 0, 'frost').hline(1, 4, 1, 'cloud').set(0, 0, 'white');
  return p.toImage();
}

const frames: Record<string, RGBAImage> = {
  print: print(),
  house_home: houseHome(),
  house_roof: houseRoof(),
  stall: stall(),
  nets: nets(),
  lantern_0: lantern(0),
  lantern_1: lantern(1),
  flowers: flowers(4),
  flowers_b: flowers(11),
  fence: fence(),
  bench: bench(),
  tower: tower(),
  palm_0: palm(1, 0),
  palm_1: palm(1, 1),
  palm_small_0: palm(0.62, 0),
  palm_small_1: palm(0.62, 1),
  rock: rock(),
  starfish: starfish(),
  shells: shellsDecal(),
  rack: rack(),
  post: post(false),
  post_gull: post(true),
  boat: boat(),
  checkpoint_off: checkpoint(false, 0),
  checkpoint_on_0: checkpoint(true, 0),
  checkpoint_on_1: checkpoint(true, 1),
  gate_0: gate(0),
  gate_1: gate(1),
  gate_2: gate(2),
  chime_frame: chimeFrame(),
  // 和 src/sim/chimes.ts 的 CHIME_LAYOUT 对齐：绳子从横梁底（第 4 行）垂到铃身顶
  chime_0: chime(26, 8, 9, 7),
  chime_1: chime(14, 6, 7, 5),
  chime_2: chime(4, 6, 6, 4),
};

export const decoSheet: ImageSheet = { key: 'deco', frames };
