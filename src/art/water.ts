import { Paint, ditherPick, type ImageSheet } from './paint';
import type { ColorName } from './palette';
import type { RGBAImage } from './sprite';

/** 水的配色：海水偏蓝；椰林里的小溪偏绿 */
interface WaterColors {
  top: ColorName;
  mid: ColorName;
  low: ColorName;
  glint: ColorName;
}
const SEA: WaterColors = { top: 'teal', mid: 'sea', low: 'deep', glint: 'sky' };
const STREAM: WaterColors = { top: 'leaf2', mid: 'teal', low: 'pine', glint: 'leaf3' };

/**
 * 海水（16×16，可横向平铺）：水面 4 帧（浪尖的白色泡沫左右起伏），水体 1 帧。
 * 游戏里整体半透明地画在主角前面，掉进水里时能隐约看见。
 */
function surface(frame: number, k: WaterColors = SEA): RGBAImage {
  const p = new Paint(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const t = y / 15;
      p.set(
        x,
        y,
        t < 0.45
          ? ditherPick(x, y, t / 0.45, k.top, k.mid)
          : ditherPick(x, y, (t - 0.45) * 0.8, k.mid, k.low),
      );
    }
  }
  // 浪尖：一条起伏的亮线，上面点缀白色泡沫
  for (let x = 0; x < 16; x++) {
    const wave = Math.round(1 + Math.sin(((x + frame * 4) / 16) * Math.PI * 2) * 1);
    for (let y = 0; y < wave; y++) p.set(x, y, null);
    p.set(x, wave, 'cloud');
    if ((x + frame * 3) % 7 < 2) p.set(x, wave, 'white');
    p.set(x, wave + 1, k.top);
  }
  // 水下的波光
  const sp = [
    [3, 8],
    [11, 6],
    [7, 12],
  ];
  for (const [x, y] of sp) if ((x! + frame) % 3 !== 0) p.set((x! + frame * 2) % 16, y!, k.glint);
  return p.toImage();
}

function body(k: WaterColors = SEA): RGBAImage {
  const p = new Paint(16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) p.set(x, y, ditherPick(x, y, 0.35 + y / 40, k.mid, k.low));
  p.set(4, 5, k.top);
  p.set(12, 11, k.top);
  return p.toImage();
}

const frames: Record<string, RGBAImage> = { body: body(), stream_body: body(STREAM) };
for (let i = 0; i < 4; i++) {
  frames[`surface_${i}`] = surface(i);
  frames[`stream_surface_${i}`] = surface(i, STREAM);
}

export const waterSheet: ImageSheet = { key: 'water', frames };
