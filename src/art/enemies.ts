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

export const enemySheet: ImageSheet = { key: 'enemy', frames };
