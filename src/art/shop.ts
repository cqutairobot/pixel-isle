import type { ColorName } from './palette';
import { ditherPick, Paint, type ImageSheet } from './paint';
import type { RGBAImage } from './sprite';

/**
 * 大暑的冰沙摊（docs/levels/1-3.md §5、§7）：
 * - 商品图标（16×16）：椰子水、护身海螺、三卷布料；
 * - 商店画面里的冰沙摊：条纹遮阳伞和撑杆（后层）、推车柜台（前层）、刨冰机、柜台上的三杯冰沙；
 *   大暑的半身像（头像，32×32）夹在后层和前层之间，看上去就是站在柜台后面；
 * - 地图上冰沙摊旁边挥手的小大暑。
 * 图标和小人左上角为原点。
 */

/** 椰子水：插着红白吸管的青椰子，切开的口露出白色椰肉 */
function coconut(): RGBAImage {
  const p = new Paint(16, 16);
  p.disc(7.5, 9.5, 5.6, 'leaf1');
  p.ellipse(6, 8, 3, 2.5, 'leaf2');
  p.set(4, 7, 'leaf3').set(5, 6, 'leaf3');
  p.ellipse(7.5, 5.2, 3.4, 1.4, 'cream');
  p.hline(5, 10, 5, 'white');
  // 吸管：从椰子口斜着伸出去
  for (let i = 0; i < 6; i++) p.set(9 + Math.floor(i / 2), 4 - i, i % 2 ? 'white' : 'red2');
  p.set(12, 0, 'red2');
  p.outline('night');
  return p.toImage();
}

/** 护身海螺：圆圆的螺旋壳（一圈圈花纹往里卷），左下是粉色的开口，右上一个小尖 */
export function drawConch(size: number): RGBAImage {
  const p = new Paint(size, size);
  const c = size / 2 - 0.5;
  const r = size * 0.38;
  // 右上的小尖
  p.poly(
    [
      [c + r * 0.4, c - r * 0.9],
      [size - 1, 0],
      [c + r * 0.95, c - r * 0.3],
    ],
    'skin2',
  );
  p.disc(c, c, r, 'cream');
  // 右下半边暗一点
  p.recolorWhere((x, y, col) => col === 'cream' && x + y > c * 2 + r * 0.5, 'skin2');
  // 螺旋花纹：从中心一圈圈往外绕
  const turns = size >= 14 ? 2.2 : 1.4;
  for (let t = 0; t < turns * Math.PI * 2; t += 0.05) {
    const rr = (r * 0.92 * t) / (turns * Math.PI * 2);
    const x = Math.round(c + rr * Math.cos(t + 2.4));
    const y = Math.round(c + rr * Math.sin(t + 2.4));
    if (p.get(x, y)) p.set(x, y, 'skin1');
  }
  // 左下的开口
  p.ellipse(c - r * 0.75, c + r * 0.7, r * 0.5, r * 0.42, 'blush');
  p.set(Math.round(c - r * 0.75), Math.round(c + r * 0.7), 'wine');
  // 高光
  p.set(Math.round(c - r * 0.45), Math.round(c - r * 0.6), 'white');
  p.outline('night');
  return p.toImage();
}

/** 一卷布：横放的圆筒，左端看得到卷起来的一圈圈，右边垂下一角 */
function fabric(main: ColorName, light: ColorName, dark: ColorName): RGBAImage {
  const p = new Paint(16, 16);
  // 筒身
  p.rect(4, 3, 9, 8, main);
  p.hline(4, 12, 3, light);
  p.hline(4, 12, 4, light);
  p.hline(4, 12, 10, dark);
  // 布上的花纹：几道斜纹
  for (const x of [6, 9, 12]) p.set(x, 6, light).set(x - 1, 7, light);
  // 右端
  p.ellipse(12.5, 6.5, 1.6, 4, main);
  // 垂下来的一角，下摆有点波浪
  p.rect(8, 10, 5, 4, main);
  p.vline(12, 10, 13, dark);
  p.set(8, 14, main).set(10, 14, main).set(11, 14, dark);
  // 左端：卷口一圈圈
  p.ellipse(3.5, 6.5, 2.6, 4, light);
  p.vline(3, 4, 9, dark);
  p.set(4, 5, dark).set(4, 8, dark).set(2, 6, main).set(2, 7, main);
  p.outline('night');
  return p.toImage();
}

/** 冰沙摊后层：红白条纹的大遮阳伞（伞面圆鼓鼓、下摆一圈波浪边）和左边的撑杆 */
function stallBack(): RGBAImage {
  const w = 112;
  const h = 100;
  const p = new Paint(w, h);
  // 撑杆
  p.rect(14, 24, 3, h - 24, 'bark');
  p.vline(14, 24, h - 1, 'ochre');
  // 伞面：一道道竖条纹，越往两边越低
  const cx = w / 2;
  for (let x = 2; x < w - 2; x++) {
    const d = Math.abs(x + 0.5 - cx) / (cx - 2);
    const top = 3 + Math.round(d * d * 16);
    const bottom = 26 + (Math.floor(x / 7) % 2 ? 0 : 2);
    const stripe = Math.floor((x - 2) / 9) % 2 ? 'cream' : 'red2';
    for (let y = top; y <= bottom; y++) p.set(x, y, stripe);
    // 伞面高光和下摆的阴影
    if (y0(top)) p.set(x, top, stripe === 'red2' ? 'blush' : 'white');
    p.set(x, bottom, stripe === 'red2' ? 'red1' : 'sand3');
  }
  // 伞顶的小圆钮
  p.disc(cx - 0.5, 3, 2, 'gold');
  p.outline('night');
  return p.toImage();
}
/** 伞面顶边要不要画高光（每一列都画） */
function y0(top: number): boolean {
  return top >= 0;
}

/** 冰沙摊前层：推车柜台（木头台面、红白条纹的车身、两个轮子） */
function stallFront(): RGBAImage {
  const w = 112;
  const h = 48;
  const p = new Paint(w, h);
  // 台面
  p.rect(2, 0, w - 4, 6, 'sand2');
  p.hline(2, w - 3, 0, 'sand3');
  p.hline(2, w - 3, 5, 'sand1');
  // 车身：横条纹
  for (let y = 6; y < 36; y++) p.hline(6, w - 7, y, Math.floor((y - 6) / 5) % 2 ? 'cream' : 'sky');
  p.vline(6, 6, 35, 'sea');
  p.vline(w - 7, 6, 35, 'sea');
  p.hline(6, w - 7, 35, 'sea');
  // 车身中间挂一块招牌底板（字由界面写上）
  p.rect(32, 11, 48, 17, 'bark');
  p.rect(33, 12, 46, 15, 'sand1');
  p.hline(33, 78, 12, 'sand2');
  // 轮子
  for (const x of [22, w - 22]) {
    p.disc(x, 39, 7, 'night');
    p.disc(x, 39, 4.5, 'stone');
    p.disc(x, 39, 1.6, 'mist');
  }
  p.outline('night');
  return p.toImage();
}

/** 刨冰机：铁架子上压着一大块冰，侧面一个摇把，下面接着一碗刨好的冰 */
function machine(): RGBAImage {
  const p = new Paint(20, 28);
  // 冰块
  p.rect(5, 1, 10, 7, 'frost');
  p.rect(6, 2, 4, 2, 'white');
  p.set(13, 6, 'sky');
  // 铁架子
  p.rect(3, 8, 14, 3, 'stone');
  p.hline(3, 16, 8, 'mist');
  p.vline(4, 11, 21, 'stone');
  p.vline(15, 11, 21, 'stone');
  p.rect(3, 21, 14, 3, 'slate');
  // 摇把
  p.vline(17, 4, 9, 'bark');
  p.hline(17, 19, 4, 'bark');
  p.set(19, 3, 'red2');
  // 一碗冰
  p.ellipse(10, 16, 4.5, 2.6, 'white');
  p.rect(6, 17, 9, 3, 'sea');
  p.hline(6, 14, 17, 'sky');
  p.outline('night');
  return p.toImage();
}

/** 柜台上的三杯冰沙：草莓、青柠、芒果 */
function cups(): RGBAImage {
  const p = new Paint(32, 14);
  const syrups: Array<[ColorName, ColorName]> = [
    ['red2', 'blush'],
    ['leaf2', 'leaf3'],
    ['orange', 'gold'],
  ];
  syrups.forEach(([dark, light], i) => {
    const x = 1 + i * 10;
    // 冰尖
    p.ellipse(x + 4, 4, 3.6, 3, 'white');
    p.set(x + 3, 2, light)
      .set(x + 4, 3, dark)
      .set(x + 5, 4, light)
      .set(x + 2, 4, dark);
    // 杯子
    p.rect(x + 1, 6, 7, 6, 'cloud');
    p.hline(x + 1, x + 7, 6, 'white');
    p.vline(x + 7, 7, 11, 'mist');
    p.set(x + 6, 1, 'red2').set(x + 6, 0, 'red2');
  });
  p.outline('night');
  return p.toImage();
}

/** 地图上冰沙摊旁边的小大暑（12×15）：圆脸、白毛巾、橙背心；wave 时一只手举起来挥 */
function miniDaishu(wave: number): RGBAImage {
  const p = new Paint(12, 15);
  // 腿
  p.rect(4, 12, 2, 3, 'skin1').rect(7, 12, 2, 3, 'skin1');
  p.rect(3, 10, 7, 3, 'sea');
  // 身子（橙背心）
  p.ellipse(6, 8, 3.6, 3, 'orange');
  p.set(4, 7, 'gold');
  // 头
  p.disc(6, 3.5, 3, 'skin1');
  p.hline(3, 9, 2, 'white');
  p.set(5, 4, 'ink').set(7, 4, 'ink');
  // 手：挥手的那只举过头顶（两帧左右摆）
  if (wave) {
    p.vline(wave > 0 ? 10 : 9, 1, 6, 'skin1');
    p.set(wave > 0 ? 11 : 8, 0, 'skin1');
  } else p.vline(10, 6, 8, 'skin1');
  p.vline(1, 6, 8, 'skin1');
  p.outline('night');
  return p.toImage();
}

/**
 * 商店画面的背景（w × h）：海崖脚下的沙滩。天空越往下越白，远处一道海，左边一面深色的崖壁，
 * 沙滩上几颗贝壳和一道浪花。
 */
export function shopBackdrop(w: number, h: number): RGBAImage {
  const p = new Paint(w, h);
  const horizon = Math.round(h * 0.44);
  const shore = Math.round(h * 0.55);
  for (let y = 0; y < horizon; y++) {
    const t = y / horizon;
    for (let x = 0; x < w; x++)
      p.set(x, y, t < 0.55 ? 'sky' : ditherPick(x, y, (t - 0.55) * 2.2, 'sky', 'cloud'));
  }
  // 远处的海：上亮下暗，零星几道白浪
  for (let y = horizon; y < shore; y++) {
    const t = (y - horizon) / (shore - horizon);
    for (let x = 0; x < w; x++) p.set(x, y, ditherPick(x, y, t * 1.3, 'teal', 'sea'));
  }
  for (let i = 0; i < 9; i++) {
    const x = (i * 47 + 13) % (w - 12);
    const y = horizon + 2 + ((i * 5) % (shore - horizon - 3));
    p.hline(x, x + 3 + (i % 3), y, 'cloud');
  }
  // 沙滩：靠海的一道浪花，越往下越深
  for (let y = shore; y < h; y++) {
    const t = (y - shore) / (h - shore);
    for (let x = 0; x < w; x++) p.set(x, y, ditherPick(x, y, t * 1.4, 'sand3', 'sand2'));
  }
  for (let x = 0; x < w; x++) {
    const y = shore + Math.round(Math.sin(x * 0.09) * 1.2);
    p.set(x, y, 'white').set(x, y + 1, 'cloud');
  }
  // 左边的崖壁
  for (let y = 0; y < shore + 6; y++) {
    const edge = Math.round(8 + y * 0.12 + Math.sin(y * 0.3) * 2);
    for (let x = 0; x < edge; x++) p.set(x, y, x === edge - 1 ? 'slate' : 'night');
  }
  // 沙滩上几颗贝壳
  for (const [x, y] of [
    [w - 30, shore + 20],
    [w - 70, shore + 34],
    [150, shore + 26],
  ] as const)
    p.set(x, y, 'skin1')
      .set(x + 1, y, 'blush')
      .set(x, y - 1, 'cream');
  return p.toImage();
}

const frames: Record<string, RGBAImage> = {
  coconut: coconut(),
  conch: drawConch(16),
  fabric_blue: fabric('sea', 'sky', 'deep'),
  fabric_lime: fabric('leaf2', 'leaf3', 'leaf1'),
  fabric_dusk: fabric('violet', 'blush', 'night'),
  stall_back: stallBack(),
  stall_front: stallFront(),
  machine: machine(),
  cups: cups(),
  daishu_0: miniDaishu(0),
  daishu_1: miniDaishu(1),
  daishu_2: miniDaishu(-1),
};

export const shopSheet: ImageSheet = { key: 'shop', frames };
