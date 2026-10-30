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
function bailu(frame: number): RGBAImage {
  const p = new Paint(16, 22);
  const bob = frame % 2;
  p.rect(5, 19, 2, 3, 'skin1').rect(9, 19, 2, 3, 'skin1');
  p.rect(4, 15, 8, 4, 'sand2');
  p.hline(4, 11, 18, 'sand3');
  p.rect(4, 10 + bob, 8, 5 - bob, 'teal');
  p.hline(5, 10, 10 + bob, 'cloud');
  p.set(7, 11 + bob, 'cloud').set(8, 11 + bob, 'cloud');
  // 叉腰
  p.line(3, 11 + bob, 2, 13, 'skin2').line(2, 13, 4, 14, 'skin2');
  p.line(12, 11 + bob, 13, 13, 'skin2').line(13, 13, 11, 14, 'skin2');
  face(p, 7, 3 + bob, 'skin2', { eyes: frame === 2 ? 'closed' : 'open' });
  // 头发：齐耳短发，刘海斜向一边
  p.ellipse(7.5, 3.5 + bob, 5.2, 3.2, 'night');
  p.rect(2, 4 + bob, 2, 4, 'night');
  p.set(11, 5 + bob, 'night');
  p.set(4, 2 + bob, 'gold')
    .set(5, 2 + bob, 'gold')
    .set(3, 3 + bob, 'orange');
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
  bailu_blink: bailu(2),
  grandpa: grandpa(false),
  grandpa_frozen: grandpa(true),
  huihui_idle_0: huihui('idle_0'),
  huihui_idle_1: huihui('idle_1'),
  huihui_blink: huihui('blink'),
  huihui_happy: huihui('happy'),
  huihui_worry: huihui('worry'),
  glow: glow(11),
};

export const npcSheet: ImageSheet = { key: 'npc', frames };
