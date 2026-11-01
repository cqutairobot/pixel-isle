import { Paint, type ImageSheet } from './paint';
import type { ColorName } from './palette';
import type { RGBAImage } from './sprite';

/**
 * 霜壳蟹（20×16，脚底中心为原点，默认朝右）：背上长着一簇蓝色冰晶，眼睛长在小柄上。
 * 帧：走路 4 帧（腿交替 × 钳子上下）、被踩扁、恢复原色（2 帧蹦跳）、恢复原色眨眼。
 * 蓝钳：钳子换成蓝色，其余相同。
 */

export const CRAB_W = 20;
export const CRAB_H = 16;

interface CrabOpts {
  /** 腿的相位（0 / 1） */
  legs: number;
  /** 钳子抬高（0 / 1） */
  claws: number;
  crystal: boolean;
  /** 恢复原色（打倒后）：暖橙色，开心的眼睛 */
  freed: boolean;
  squash: boolean;
  blink: boolean;
  blueClaws: boolean;
}

function crab(o: Partial<CrabOpts>): RGBAImage {
  const opt: CrabOpts = {
    legs: 0,
    claws: 0,
    crystal: true,
    freed: false,
    squash: false,
    blink: false,
    blueClaws: false,
    ...o,
  };
  const p = new Paint(CRAB_W, CRAB_H);
  const body: ColorName = opt.freed ? 'orange' : 'red2';
  const shade: ColorName = opt.freed ? 'red2' : 'red1';
  const light: ColorName = opt.freed ? 'gold' : 'orange';
  const clawC: ColorName = opt.blueClaws ? 'sky' : body;
  const clawS: ColorName = opt.blueClaws ? 'sea' : shade;
  const ry = opt.squash ? 1.7 : 3;
  const cy = opt.squash ? 13.2 : 11.5;
  // 腿：左右各三条，交替抬起
  if (!opt.squash) {
    for (let i = 0; i < 3; i++) {
      const off = (i + opt.legs) % 2;
      const lx = 6 + i * 2;
      const rx = 14 - i * 2;
      p.line(lx, 14, lx - 1 - off, 15, shade);
      p.line(rx, 14, rx + 1 + off, 15, shade);
    }
  }
  // 眼柄（在身体后面先画）与眼睛：长在身体右上方
  const eyeY = opt.squash ? 10 : 4;
  if (!opt.squash) {
    p.vline(13, eyeY + 2, 9, shade);
    p.vline(16, eyeY + 2, 9, shade);
  }
  // 身体
  p.ellipse(10, cy, 6.5, ry, body);
  p.recolorWhere((_x, y, c) => c === body && y >= cy + 0.5, shade);
  if (!opt.squash) p.hline(11, 13, Math.round(cy - 2), light);
  // 钳子：前（右）大、后（左）小
  const clawY = (opt.squash ? 12 : 9) - opt.claws;
  p.line(16, Math.round(cy), 17, Math.round(clawY + 1), clawS);
  p.disc(17.8, clawY, 1.9, clawC);
  p.set(19, Math.round(clawY), null);
  p.set(18, Math.round(clawY) + 1, clawS);
  p.line(4, Math.round(cy), 3, Math.round(clawY + 1.5), clawS);
  p.disc(2.3, clawY + 0.8, 1.5, clawC);
  p.set(1, Math.round(clawY + 0.8), null);
  const eye = (x: number) => {
    if (opt.blink || opt.freed) {
      // 闭眼 / 开心眯眼（^ ^）
      p.set(x, eyeY + 1, 'ink');
      p.set(x + 1, eyeY + (opt.freed ? 0 : 1), 'ink');
    } else {
      p.rect(x, eyeY, 2, 2, 'white');
      p.set(x + 1, eyeY + 1, 'ink');
    }
  };
  eye(12);
  eye(15);
  // 背上的一小簇冰晶（偏左，和眼睛分开）
  if (opt.crystal) {
    const base = Math.round(cy - 2.5);
    const spike = (tipX: number, tipY: number, x0: number, x1: number) => {
      for (let y = Math.ceil(tipY); y <= base; y++) {
        const t = (y - tipY) / Math.max(1, base - tipY);
        const l = Math.round(tipX + (x0 - tipX) * t);
        const r = Math.round(tipX + (x1 - tipX) * t);
        for (let x = l; x <= r; x++) {
          const c: ColorName = x === l && y < base - 1 ? 'white' : x === r ? 'violet' : 'frost';
          p.set(x, y, c);
        }
      }
    };
    const lift = opt.squash ? 3 : 0;
    spike(7, 2 + lift, 5, 9);
    spike(4, 5 + lift, 3, 5);
  }
  p.outline('night');
  return p.toImage();
}

/**
 * 刺海胆（16×16，脚底中心为原点）：紫色的圆身子，长着一圈冰蓝色的刺，生气的眼睛。
 * phase 让刺一伸一缩；hang 是倒挂款（顶上有一截冰凌连着树枝）；freed 是打倒后的小海胆。
 */
function urchin(o: { phase?: number; hang?: boolean; freed?: boolean; roll?: number }): RGBAImage {
  const p = new Paint(16, 16);
  const cx = 7.5;
  const cy = o.hang ? 7 : 9;
  const r = o.freed ? 3.6 : 4.2;
  // 刺：8 个方向，冰蓝色、尖端发白；打倒后变成短短的粉色软刺
  const spikes = 8;
  const rot = ((o.roll ?? 0) / 4) * (Math.PI / 4) + (o.phase ?? 0) * 0.2;
  for (let i = 0; i < spikes; i++) {
    const a = rot + (i / spikes) * Math.PI * 2;
    const len = o.freed ? 1.6 : 3 + ((i + (o.phase ?? 0)) % 2);
    for (let k = 0; k <= len * 2; k++) {
      const d = r + k / 2;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      const tip = k / 2 > len - 1;
      p.set(x, y, o.freed ? 'blush' : tip ? 'white' : 'frost');
    }
  }
  p.disc(cx, cy, r, o.freed ? 'blush' : 'violet');
  p.recolorWhere(
    (x, y, c) => (c === 'violet' || c === 'blush') && x >= cx + 1 && y >= cy,
    o.freed ? 'red2' : 'deep',
  );
  p.set(cx - 1.5, cy - 2.5, o.freed ? 'cream' : 'mist');
  // 眼睛
  const ey = Math.round(cy);
  if (o.freed) {
    p.set(cx - 1.5, ey, 'ink').set(cx + 1.5, ey, 'ink');
    p.set(cx - 2.5, ey + 1, 'ink').set(cx + 2.5, ey + 1, 'ink');
  } else {
    p.set(cx - 1.5, ey, 'white').set(cx + 1.5, ey, 'white');
    p.set(cx - 1.5, ey + 1, 'ink').set(cx + 1.5, ey + 1, 'ink');
    // 生气的眉毛
    p.set(cx - 2.5, ey - 1, 'ink').set(cx + 2.5, ey - 1, 'ink');
  }
  if (o.hang) {
    // 顶上一截冰凌，连着上面的树枝
    p.vline(7, 0, 2, 'cloud').vline(8, 0, 1, 'frost');
  } else if (!o.freed) {
    // 底下一排小管足
    for (const x of [5, 7, 9, 11]) p.set(x + ((o.phase ?? 0) % 2), 15, 'deep');
  }
  p.outline('night');
  return p.toImage();
}

/**
 * 冰喙鸥（20×14，中心偏下为原点，默认朝右）：白身子、灰翅膀、背上一簇冰晶，喙是冰蓝色的。
 * wing：0 上、1 平、2 下；alert 张开翅膀张嘴；dive 收翅俯冲；freed 是普通海鸥（黄喙、没有冰晶）。
 */
function gull(o: { wing?: number; alert?: boolean; dive?: boolean; freed?: boolean }): RGBAImage {
  const p = new Paint(22, 16);
  const beak: ColorName = o.freed ? 'gold' : 'sky';
  if (o.dive) {
    // 收起翅膀、头朝前下方
    p.ellipse(9, 7, 5.5, 3.2, 'white');
    p.disc(14.5, 10, 2.6, 'white');
    p.line(4, 5, 12, 8, 'mist').line(5, 4, 11, 6, 'cloud');
    p.set(3, 4, 'stone').set(2, 4, 'stone');
    p.set(17, 11, beak).set(18, 12, beak).set(19, 13, beak);
    p.set(15, 9, 'ink');
    if (!o.freed) p.set(8, 3, 'frost').set(9, 2, 'white').set(10, 3, 'frost');
    p.outline('night');
    return p.toImage();
  }
  // 身子
  p.ellipse(10, 9, 5.5, 3.2, 'white');
  p.recolorWhere((x, y, c) => c === 'white' && y >= 11, 'cloud');
  // 尾巴
  p.rect(3, 8, 2, 2, 'cloud').set(2, 8, 'mist');
  // 头和喙
  p.disc(15, 7.5, 2.6, 'white');
  p.set(16, 7, 'ink');
  if (o.alert) {
    p.set(18, 7, beak).set(19, 6, beak).set(18, 9, beak).set(19, 10, beak);
    p.set(15, 6, 'ink');
  } else {
    p.hline(18, 20, 8, beak);
    p.set(18, 9, o.freed ? 'straw' : 'frost');
  }
  // 翅膀：实心的一片，前缘浅、后缘深
  const wing = o.alert ? 0 : (o.wing ?? 1);
  const span = (y: number, x0: number, x1: number) => {
    p.hline(x0, x1, y, 'cloud');
    p.set(x1, y, 'mist');
  };
  if (wing === 0) {
    span(6, 7, 12);
    span(5, 6, 11);
    span(4, 6, 10);
    span(3, 5, 9);
    span(2, 5, 7);
    p.set(4, 1, 'stone').set(5, 1, 'stone');
  } else if (wing === 1) {
    p.hline(3, 14, 7, 'cloud').hline(4, 13, 6, 'cloud');
    p.hline(5, 12, 8, 'mist');
    p.set(2, 7, 'stone').set(15, 7, 'stone');
  } else {
    span(10, 7, 12);
    span(11, 7, 11);
    span(12, 7, 10);
    span(13, 8, 9);
    p.set(8, 14, 'stone');
  }
  // 背上的冰晶
  if (!o.freed) p.set(9, 5, 'frost').set(10, 4, 'white').set(11, 5, 'frost').set(10, 5, 'sky');
  // 爪子
  p.set(9, 12, 'straw').set(11, 12, 'straw');
  p.outline('night');
  return p.toImage();
}

const frames: Record<string, RGBAImage> = {};
for (const blue of [false, true]) {
  const pre = blue ? 'blue' : 'crab';
  frames[`${pre}_walk_0`] = crab({ legs: 0, claws: 1, blueClaws: blue });
  frames[`${pre}_walk_1`] = crab({ legs: 1, claws: 1, blueClaws: blue });
  frames[`${pre}_walk_2`] = crab({ legs: 0, claws: 0, blueClaws: blue });
  frames[`${pre}_walk_3`] = crab({ legs: 1, claws: 0, blueClaws: blue });
  frames[`${pre}_squash`] = crab({ squash: true, blueClaws: blue });
  frames[`${pre}_blink`] = crab({ blink: true, claws: 1, blueClaws: blue });
}
// 恢复原色之后两种蟹看起来一样
frames.free_0 = crab({ crystal: false, freed: true, legs: 0, claws: 1 });
frames.free_1 = crab({ crystal: false, freed: true, legs: 1, claws: 0 });
frames.free_blink = crab({ crystal: false, freed: true, blink: true });

// 第 2 关：刺海胆、冰喙鸥
frames.urchin_0 = urchin({ phase: 0 });
frames.urchin_1 = urchin({ phase: 1 });
frames.urchin_hang = urchin({ hang: true });
frames.urchin_hang_1 = urchin({ hang: true, phase: 1 });
for (let i = 0; i < 4; i++) frames[`urchin_free_${i}`] = urchin({ freed: true, roll: i });
frames.gull_0 = gull({ wing: 0 });
frames.gull_1 = gull({ wing: 1 });
frames.gull_2 = gull({ wing: 2 });
frames.gull_alert = gull({ alert: true });
frames.gull_dive = gull({ dive: true });
frames.gull_free_0 = gull({ wing: 0, freed: true });
frames.gull_free_1 = gull({ wing: 2, freed: true });

export const enemySheet: ImageSheet = { key: 'enemy', frames };
