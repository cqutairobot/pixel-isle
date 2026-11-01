import { Paint, type ImageSheet } from './paint';
import type { ColorName } from './palette';
import type { RGBAImage } from './sprite';

/**
 * 第 1 关的 NPC 与剧情角色（脚底中心为原点，默认朝右）：
 * 海婶（晒网的大婶）、阿豆（小男孩）、白露（渔家姐姐）、钟爷爷的冰雕、回回（大钟的回音精灵）。
 * Q 版两头身，和小满一样用深蓝描边。
 */

interface FaceOpts {
  /** 眼睛：睁开 / 闭上 / 开心眯眼 */
  eyes?: 'open' | 'closed' | 'happy';
  blush?: boolean;
}

/** 在 (cx, top) 画一张 Q 版脸（宽 9、高 7）：眼睛偏右，表示朝右 */
function face(p: Paint, cx: number, top: number, skin: ColorName, o: FaceOpts = {}): void {
  p.ellipse(cx, top + 3.5, 4.6, 3.8, skin);
  const ey = top + 3;
  const eyes = o.eyes ?? 'open';
  for (const ex of [cx, cx + 3]) {
    if (eyes === 'open') p.vline(ex, ey, ey + 1, 'ink');
    else if (eyes === 'closed') p.set(ex, ey + 1, 'ink');
    else
      p.set(ex - 1, ey + 1, 'ink')
        .set(ex, ey, 'ink')
        .set(ex + 1, ey + 1, 'ink');
  }
  if (o.blush !== false) p.set(cx + 4, ey + 2, 'blush').set(cx - 1, ey + 2, 'blush');
}

// —— 海婶：包着青色头巾，珊瑚色裙子配奶油色围裙 ——
function haishen(frame: number, wave: boolean): RGBAImage {
  const p = new Paint(18, 22);
  const bob = frame % 2;
  // 腿与鞋
  p.rect(6, 19, 2, 2, 'skin1').rect(10, 19, 2, 2, 'skin1');
  p.rect(5, 21, 3, 1, 'bark').rect(10, 21, 3, 1, 'bark');
  // 裙子与围裙
  p.rect(4, 12 + bob, 10, 7 - bob, 'red2');
  p.rect(4, 17, 10, 2, 'red1');
  p.rect(6, 12 + bob, 6, 6 - bob, 'cream');
  p.hline(6, 11, 13 + bob, 'white');
  // 手臂
  p.rect(3, 13 + bob, 1, 4, 'skin2');
  if (wave) {
    p.line(14, 12 + bob, 16, 7 + frame, 'skin2');
    p.rect(15, 5 + frame, 2, 2, 'skin2');
  } else {
    p.rect(14, 13 + bob, 1, 4, 'skin2');
  }
  // 头与头巾
  face(p, 8, 4 + bob, 'skin2');
  p.ellipse(8, 4 + bob, 5.2, 3.2, 'sea');
  p.hline(4, 12, 6 + bob, 'teal');
  p.set(4, 8 + bob, 'sea')
    .set(3, 9 + bob, 'sea')
    .set(3, 10 + bob, 'teal');
  p.set(6, 3 + bob, 'teal').set(7, 3 + bob, 'teal');
  p.outline('night');
  return p.toImage();
}

// —— 阿豆：刺刺的黑头发，蓝白条纹背心，短裤 ——
function adou(frame: number, cheer: boolean): RGBAImage {
  const p = new Paint(14, 17);
  const bob = cheer ? frame % 2 : 0;
  const by = 9 - bob;
  p.rect(4, by + 6, 2, 2, 'skin1').rect(8, by + 6, 2, 2, 'skin1');
  p.rect(3, by + 4, 8, 2, 'ochre');
  for (let y = 0; y < 4; y++) p.hline(3, 10, by + y, y % 2 === 0 ? 'white' : 'sky');
  if (cheer) {
    p.line(2, by + 1, 1, by - 3, 'skin2').line(11, by + 1, 12, by - 3, 'skin2');
  } else {
    p.rect(2, by + 1, 1, 3, 'skin2').rect(11, by + 1, 1, 3, 'skin2');
  }
  face(p, 6, by - 8 + (frame % 2 && !cheer ? 1 : 0), 'skin2', { eyes: cheer ? 'happy' : 'open' });
  const hy = by - 8 + (frame % 2 && !cheer ? 1 : 0);
  p.ellipse(6.5, hy + 1.5, 4.8, 2.4, 'night');
  for (const x of [3, 5, 7, 9]) p.set(x, hy - 1, 'night');
  p.set(2, hy + 3, 'night');
  p.outline('night');
  return p.toImage();
}

// —— 白露：利落的黑色短发、金色小鱼发夹，青色上衣，卷起裤脚 ——
type BailuPose = 'idle' | 'blink' | 'throw_0' | 'throw_1' | 'catch';
function bailu(frame: number, pose: BailuPose = 'idle'): RGBAImage {
  // 比身体宽 2 px，给伸出去的手臂留位置；身体仍然在正中间
  const p = new Paint(18, 22);
  const o = 1;
  const bob = pose === 'idle' || pose === 'blink' ? frame % 2 : 0;
  p.rect(o + 5, 19, 2, 3, 'skin1').rect(o + 9, 19, 2, 3, 'skin1');
  p.rect(o + 4, 15, 8, 4, 'sand2');
  p.hline(o + 4, o + 11, 18, 'sand3');
  p.rect(o + 4, 10 + bob, 8, 5 - bob, 'teal');
  p.hline(o + 5, o + 10, 10 + bob, 'cloud');
  p.set(o + 7, 11 + bob, 'cloud').set(o + 8, 11 + bob, 'cloud');
  // 左手叉腰
  p.line(o + 3, 11 + bob, o + 2, 13, 'skin2').line(o + 2, 13, o + 4, 14, 'skin2');
  // 右手：叉腰 / 举起来准备扔 / 往前甩出去 / 举高接住
  if (pose === 'throw_0') {
    // 反手蓄力：胳膊横过胸前收到另一边
    p.line(o + 12, 11, o + 7, 12, 'skin2');
    p.rect(o + 5, 11, 2, 2, 'skin2');
  } else if (pose === 'throw_1') {
    p.line(o + 12, 11, o + 16, 10, 'skin2');
    p.set(o + 16, 9, 'skin2');
  } else if (pose === 'catch') {
    p.line(o + 12, 11, o + 14, 6, 'skin2');
    p.rect(o + 13, 4, 2, 2, 'skin2');
  } else {
    p.line(o + 12, 11 + bob, o + 13, 13, 'skin2').line(o + 13, 13, o + 11, 14, 'skin2');
  }
  const eyes = pose === 'blink' ? 'closed' : pose === 'catch' ? 'happy' : 'open';
  face(p, o + 7, 3 + bob, 'skin2', { eyes });
  // 头发：齐耳短发，刘海斜向一边
  p.ellipse(o + 7.5, 3.5 + bob, 5.2, 3.2, 'night');
  p.rect(o + 2, 4 + bob, 2, 4, 'night');
  p.set(o + 11, 5 + bob, 'night');
  p.set(o + 4, 2 + bob, 'gold')
    .set(o + 5, 2 + bob, 'gold')
    .set(o + 3, 3 + bob, 'orange');
  p.outline('night');
  return p.toImage();
}

// —— 大暑：圆滚滚的冰沙小贩，晒得黝黑，额头绑着白毛巾，橙色背心、蓝短裤 ——
function daishu(frame: number, wipe: boolean): RGBAImage {
  const p = new Paint(22, 25);
  const bob = wipe ? 0 : frame % 2;
  // 腿与凉鞋
  p.rect(7, 21, 3, 3, 'skin1').rect(12, 21, 3, 3, 'skin1');
  p.rect(6, 24, 4, 1, 'bark').rect(12, 24, 4, 1, 'bark');
  // 短裤
  p.rect(5, 18, 12, 4, 'sea');
  p.hline(5, 16, 21, 'deep');
  // 圆肚子 + 背心
  p.ellipse(11, 14 + bob, 6.6, 5.4 - bob, 'orange');
  p.ellipse(9.5, 12.5 + bob, 3, 2, 'gold');
  p.hline(7, 15, 9 + bob, 'orange');
  p.set(8, 8 + bob, 'orange').set(14, 8 + bob, 'orange');
  // 手臂
  p.rect(3, 11 + bob, 2, 6, 'skin1');
  p.set(3, 17 + bob, 'skin2');
  if (wipe) {
    // 举起胳膊用毛巾擦汗
    p.line(17, 11, 18, 7, 'skin1').line(18, 7, 15, 4, 'skin1');
    p.rect(14, 3, 3, 2, 'cloud');
  } else {
    p.rect(17, 11 + bob, 2, 6, 'skin1');
    p.set(18, 17 + bob, 'skin2');
  }
  // 头：晒黑的脸，额头的白毛巾在脑后打个结
  face(p, 10, 1 + bob, 'skin1', { eyes: wipe ? 'closed' : 'open' });
  p.hline(6, 14, 2 + bob, 'cloud');
  p.hline(6, 14, 1 + bob, 'white');
  p.set(5, 2 + bob, 'cloud')
    .set(4, 3 + bob, 'cloud')
    .set(4, 4 + bob, 'mist');
  // 汗珠
  if (frame % 2 === 0 || wipe) p.set(16, 4 + bob, 'sky').set(16, 5 + bob, 'white');
  p.outline('night');
  return p.toImage();
}

// —— 钟爷爷：守钟人的小帽、白胡子、提着灯笼；冰雕版把所有颜色换成冰色 ——
function grandpa(frozen: boolean): RGBAImage {
  const p = new Paint(20, 24);
  p.rect(7, 21, 2, 2, 'bark').rect(11, 21, 2, 2, 'bark');
  p.rect(5, 11, 10, 10, 'sea');
  p.rect(5, 19, 10, 2, 'deep');
  p.vline(10, 11, 20, 'deep');
  // 一只手抬起来（"站住！"），一只手提灯笼
  p.line(15, 12, 18, 8, 'sea').rect(17, 6, 2, 2, 'skin1');
  p.line(4, 12, 3, 16, 'sea').set(3, 17, 'skin1');
  p.vline(3, 18, 19, 'bark');
  p.rect(2, 20, 3, 3, 'red2').set(3, 21, 'gold');
  face(p, 9, 3, 'skin1', { eyes: 'open', blush: false });
  // 白胡子
  p.ellipse(10, 9.5, 3.5, 2.5, 'cloud');
  p.set(9, 11, 'white').set(10, 12, 'cloud');
  // 帽子
  p.ellipse(9.5, 3, 5, 2.2, 'bark');
  p.hline(4, 15, 4, 'ochre');
  p.set(9, 0, 'gold');
  p.outline('night');
  if (!frozen) return p.toImage();
  // 冰雕：按亮度映射到冰色，再加几根冰柱和高光
  const ice: Partial<Record<ColorName, ColorName>> = {
    night: 'violet',
    ink: 'violet',
    deep: 'frost',
    sea: 'frost',
    bark: 'mist',
    ochre: 'cloud',
    red2: 'sky',
    gold: 'white',
    skin1: 'cloud',
    cloud: 'white',
    white: 'white',
  };
  const q = new Paint(20, 26);
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 20; x++) {
      const c = p.get(x, y);
      if (c) q.set(x, y, ice[c] ?? 'cloud');
    }
  for (const [x, len] of [
    [6, 2],
    [12, 3],
    [17, 2],
  ] as const)
    q.vline(x, 24, 23 + len, 'cloud');
  q.set(7, 13, 'white').set(8, 14, 'white').set(13, 3, 'white');
  return q.toImage();
}

// —— 回回：会发光的小铃铛，豆豆眼 ——
function huihui(frame: 'idle_0' | 'idle_1' | 'blink' | 'happy' | 'worry'): RGBAImage {
  const p = new Paint(14, 14);
  const sq = frame === 'idle_1' ? 1 : 0;
  // 铃身
  p.ellipse(7, 6 + sq * 0.5, 5, 5 - sq * 0.5, 'gold');
  p.rect(2, 8, 10, 3 - sq, 'gold');
  p.hline(1, 12, 11 - sq, 'straw');
  p.recolorWhere((x, y, c) => c === 'gold' && x >= 9 && y >= 4, 'straw');
  p.set(4, 3, 'cream').set(5, 2, 'cream').set(4, 4, 'cream');
  p.rect(6, 0, 2, 1, 'ochre');
  // 铃舌
  p.rect(6, 12 - sq, 2, 1, 'bark');
  // 眼睛
  const ey = 6;
  if (frame === 'blink') p.hline(5, 5, ey + 1, 'ink').hline(8, 8, ey + 1, 'ink');
  else if (frame === 'happy')
    p.set(4, ey + 1, 'ink')
      .set(5, ey, 'ink')
      .set(6, ey + 1, 'ink')
      .set(8, ey + 1, 'ink')
      .set(9, ey, 'ink')
      .set(10, ey + 1, 'ink');
  else if (frame === 'worry')
    p.vline(5, ey, ey + 1, 'ink')
      .vline(9, ey, ey + 1, 'ink')
      .set(4, ey - 1, 'ochre')
      .set(10, ey - 1, 'ochre');
  else p.vline(5, ey, ey + 1, 'ink').vline(9, ey, ey + 1, 'ink');
  p.set(3, ey + 2, 'blush').set(11, ey + 2, 'blush');
  p.outline('bark');
  return p.toImage();
}

// —— 霜降：高瘦的身影，冷白面具、银蓝长发、长及脚面的紫斗篷（默认朝右）——
function shuangjiang(frame: 0 | 1 | 'cast'): RGBAImage {
  const p = new Paint(22, 34);
  const sway = frame === 1 ? 1 : 0;
  // 长发：从头顶披到背后
  p.ellipse(9, 5, 4.5, 4.5, 'mist');
  p.rect(4, 5, 4, 15, 'mist');
  p.vline(3, 9, 19 + sway, 'stone').vline(4, 14, 21 + sway, 'stone');
  p.vline(6, 7, 18, 'cloud');
  // 斗篷：肩窄、下摆宽，前襟一道霜色镶边
  for (let y = 10; y < 33; y++) {
    const t = (y - 10) / 22;
    const l = Math.round(6 - t * 3 - (y > 28 ? sway : 0));
    const r = Math.round(13 + t * 3 + (y > 28 ? sway : 0));
    p.hline(l, r, y, 'violet');
  }
  p.recolorWhere((x, y, c) => c === 'violet' && x >= 13 && y >= 12, 'deep');
  p.vline(12, 11, 32, 'frost');
  p.hline(3 - sway, 16 + sway, 33, 'frost');
  // 高领
  p.rect(6, 8, 7, 3, 'violet').hline(6, 12, 8, 'frost');
  // 面具和眼缝
  p.ellipse(10.5, 4.5, 3.2, 4, 'cloud');
  p.set(9, 2, 'white').set(9, 3, 'white');
  p.hline(10, 12, 4, 'ink');
  p.set(11, 6, 'violet').set(11, 7, 'violet');
  p.set(10, 1, 'frost');
  if (frame === 'cast') {
    // 一挥袖：手臂伸向前方，袖口带出寒气
    p.line(12, 12, 19, 9, 'violet').line(12, 13, 19, 10, 'violet').line(13, 14, 18, 12, 'deep');
    p.set(20, 9, 'cloud').set(21, 8, 'cloud');
    p.set(20, 12, 'frost').set(21, 14, 'frost').set(19, 15, 'white');
  }
  p.outline('ink');
  return p.toImage();
}

/** 四枚时令铃：春（嫩绿）、夏（金）、秋（橙红）、冬（冰蓝） */
function seasonBell(
  body: ColorName,
  shade: ColorName,
  light: ColorName,
  mark: ColorName,
): RGBAImage {
  const p = new Paint(10, 11);
  p.rect(4, 0, 2, 2, 'ochre').set(4, 0, null);
  p.ellipse(5, 5, 3.6, 3.6, body);
  p.rect(1, 5, 8, 3, body);
  p.hline(0, 9, 8, shade);
  p.recolorWhere((x, y, c) => c === body && x >= 6 && y >= 3, shade);
  p.set(3, 3, light).set(3, 4, light);
  p.set(5, 5, mark);
  p.rect(4, 9, 2, 1, 'bark');
  p.outline('night');
  return p.toImage();
}

/** 小寄居蟹：螺旋纹的壳里探出橙红色的小螃蟹（第 frame 帧，腿交替） */
function hermit(frame: number, bell: boolean): RGBAImage {
  const p = new Paint(16, 14);
  const leg = frame % 2;
  // 腿和钳子（在壳的右前方）
  p.set(9, 12, 'red1')
    .set(11, 12 - leg, 'red1')
    .set(13, 12, 'red1');
  p.rect(9, 9, 5, 3, 'red2');
  p.rect(13, 8, 2, 2, 'red2').set(15, 8, 'red1');
  // 眼睛长在小柄上；背着夏铃时眼睛发出冰蓝的光
  p.vline(11, 6, 8, 'red1').vline(13, 6, 7, 'red1');
  p.set(11, 5, bell ? 'sky' : 'ink').set(13, 5, bell ? 'sky' : 'ink');
  if (bell) {
    // 夏铃当壳，壳顶结出冰晶
    p.ellipse(5.5, 8, 4.6, 4.6, 'gold');
    p.rect(1, 9, 9, 3, 'gold');
    p.hline(0, 10, 12, 'straw');
    p.recolorWhere((x, y, c) => c === 'gold' && x >= 6 && y >= 7, 'straw');
    p.set(3, 6, 'cream').set(3, 7, 'cream');
    p.vline(4, 1, 4, 'frost').vline(5, 0, 4, 'cloud').vline(6, 2, 4, 'frost');
    p.set(3, 3, 'frost').set(7, 3, 'frost').set(5, 0, 'white');
  } else {
    // 螺旋纹的壳
    p.ellipse(5.5, 8.5, 4.6, 4.2, 'sand2');
    p.ellipse(5, 8, 2.6, 2.4, 'sand3');
    p.set(5, 8, 'sand1').set(6, 8, 'sand1').set(6, 9, 'sand1').set(4, 7, 'sand1');
    p.recolorWhere((x, y, c) => c === 'sand2' && y >= 11, 'sand1');
  }
  p.outline('night');
  return p.toImage();
}

/** 回回身后的光晕（半透明画，叠加发光） */
function glow(r: number): RGBAImage {
  const s = Math.ceil(r * 2 + 2);
  const p = new Paint(s, s);
  const c = s / 2;
  p.dither(0, 0, s, s, 'cream', 'gold', 0.4);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / r;
      // 越往外越稀疏
      if (d > 1 || (d > 0.55 && (x + y * 3) % Math.max(2, Math.round(d * 5)) !== 0))
        p.set(x, y, null);
    }
  return p.toImage();
}

const frames: Record<string, RGBAImage> = {
  haishen_idle_0: haishen(0, false),
  haishen_idle_1: haishen(1, false),
  haishen_wave_0: haishen(0, true),
  haishen_wave_1: haishen(1, true),
  adou_idle_0: adou(0, false),
  adou_idle_1: adou(1, false),
  adou_cheer_0: adou(0, true),
  adou_cheer_1: adou(1, true),
  bailu_idle_0: bailu(0),
  bailu_idle_1: bailu(1),
  bailu_blink: bailu(0, 'blink'),
  bailu_throw_0: bailu(0, 'throw_0'),
  bailu_throw_1: bailu(0, 'throw_1'),
  bailu_catch: bailu(0, 'catch'),
  daishu_idle_0: daishu(0, false),
  daishu_idle_1: daishu(1, false),
  daishu_wipe: daishu(0, true),
  grandpa: grandpa(false),
  grandpa_frozen: grandpa(true),
  huihui_idle_0: huihui('idle_0'),
  huihui_idle_1: huihui('idle_1'),
  huihui_blink: huihui('blink'),
  huihui_happy: huihui('happy'),
  huihui_worry: huihui('worry'),
  glow: glow(11),
  shuangjiang_0: shuangjiang(0),
  shuangjiang_1: shuangjiang(1),
  shuangjiang_cast: shuangjiang('cast'),
  bell_spring: seasonBell('leaf2', 'leaf1', 'leaf3', 'blush'),
  bell_summer: seasonBell('gold', 'straw', 'cream', 'orange'),
  bell_autumn: seasonBell('orange', 'red1', 'gold', 'wine'),
  bell_winter: seasonBell('frost', 'mist', 'white', 'sky'),
  hermit_0: hermit(0, false),
  hermit_1: hermit(1, false),
  hermit_bell_0: hermit(0, true),
  hermit_bell_1: hermit(1, true),
};

export const npcSheet: ImageSheet = { key: 'npc', frames };
