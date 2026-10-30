import type Phaser from 'phaser';
import { PALETTE, type ColorName } from '../art/palette';

export type PanelStyle = 'paper' | 'night' | 'tag';

const STYLES: Record<
  PanelStyle,
  { fill: ColorName; edge: ColorName; light: ColorName; dark: ColorName }
> = {
  // 米白纸色底、深蓝描边（PLAN §7）
  paper: { fill: 'cream', edge: 'night', light: 'white', dark: 'sand3' },
  night: { fill: 'night', edge: 'ink', light: 'slate', dark: 'ink' },
  tag: { fill: 'red2', edge: 'night', light: 'blush', dark: 'red1' },
};

/**
 * 像素面板贴图：圆角 1px、深蓝描边、内侧一道高光、底边一道暗色、右下 2px 投影。
 * 按尺寸和样式缓存，同一尺寸只生成一次。返回贴图键名。
 */
export function panelTexture(
  scene: Phaser.Scene,
  w: number,
  h: number,
  style: PanelStyle = 'paper',
  fill?: ColorName,
): string {
  w = Math.max(6, Math.round(w));
  h = Math.max(6, Math.round(h));
  const key = `panel-${style}-${fill ?? ''}-${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const st = STYLES[style];
  const canvas = document.createElement('canvas');
  canvas.width = w + 2;
  canvas.height = h + 2;
  const ctx = canvas.getContext('2d')!;
  // 投影
  ctx.fillStyle = 'rgba(26,28,44,0.35)';
  ctx.fillRect(3, 3, w - 1, h - 1);
  // 描边（圆角：四个角各缺一个像素）
  ctx.fillStyle = PALETTE[st.edge];
  ctx.fillRect(1, 0, w - 2, h);
  ctx.fillRect(0, 1, w, h - 2);
  ctx.fillStyle = PALETTE[fill ?? st.fill];
  ctx.fillRect(1, 1, w - 2, h - 2);
  ctx.fillStyle = PALETTE[st.light];
  ctx.fillRect(2, 1, w - 4, 1);
  ctx.fillStyle = PALETTE[st.dark];
  ctx.fillRect(1, h - 2, w - 2, 1);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** 一张全屏的抖动暗角（低血量时用），颜色只用调色板里的深蓝 */
export function vignetteTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `vignette-${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  ctx.fillStyle = PALETTE.wine;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / (w / 2);
      const dy = (y - h / 2) / (h / 2);
      const d = Math.sqrt(dx * dx * 0.55 + dy * dy * 0.75);
      const t = Math.max(0, (d - 0.9) / 0.45) * 0.7;
      if (t > (bayer[(y & 3) * 4 + (x & 3)]! + 0.5) / 16) ctx.fillRect(x, y, 1, 1);
    }
  }
  scene.textures.addCanvas(key, canvas);
  return key;
}
