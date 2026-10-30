import { Paint, ditherPick, type ImageSheet } from './paint';
import type { RGBAImage } from './sprite';

/**
 * 海水（16×16，可横向平铺）：水面 4 帧（浪尖的白色泡沫左右起伏），水体 1 帧。
 * 游戏里整体半透明地画在主角前面，掉进水里时能隐约看见。
 */
function surface(frame: number): RGBAImage {
  const p = new Paint(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const t = y / 15;
      p.set(
        x,
        y,
        t < 0.45
          ? ditherPick(x, y, t / 0.45, 'teal', 'sea')
          : ditherPick(x, y, (t - 0.45) * 0.8, 'sea', 'deep'),
      );
    }
  }
  // 浪尖：一条起伏的亮线，上面点缀白色泡沫
  for (let x = 0; x < 16; x++) {
    const wave = Math.round(1 + Math.sin(((x + frame * 4) / 16) * Math.PI * 2) * 1);
    for (let y = 0; y < wave; y++) p.set(x, y, null);
    p.set(x, wave, 'cloud');
    if ((x + frame * 3) % 7 < 2) p.set(x, wave, 'white');
    p.set(x, wave + 1, 'teal');
  }
  // 水下的波光
  const sp = [
    [3, 8],
    [11, 6],
    [7, 12],
  ];
  for (const [x, y] of sp) if ((x! + frame) % 3 !== 0) p.set((x! + frame * 2) % 16, y!, 'sky');
  return p.toImage();
}

function body(): RGBAImage {
  const p = new Paint(16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) p.set(x, y, ditherPick(x, y, 0.35 + y / 40, 'sea', 'deep'));
  p.set(4, 5, 'teal');
  p.set(12, 11, 'teal');
  return p.toImage();
}

const frames: Record<string, RGBAImage> = { body: body() };
for (let i = 0; i < 4; i++) frames[`surface_${i}`] = surface(i);

export const waterSheet: ImageSheet = { key: 'water', frames };
