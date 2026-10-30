/** 逻辑分辨率（游戏像素）。见 PLAN.md §2.3。 */
export const VIEW_W = 384;
export const VIEW_H = 216;

export interface Layout {
  /** 设备像素比（Retina 为 2） */
  dpr: number;
  /** 画布的设备像素尺寸 */
  devW: number;
  devH: number;
  /** 每个游戏像素占多少设备像素（整数倍） */
  k: number;
  /** 游戏画面在画布上的位置与尺寸（设备像素） */
  vpX: number;
  vpY: number;
  vpW: number;
  vpH: number;
}

/** 按窗口尺寸计算整数倍缩放与居中的视口，四周剩下的部分是信箱区。 */
export function computeLayout(cssW: number, cssH: number, dpr: number): Layout {
  const devW = Math.max(1, Math.round(cssW * dpr));
  const devH = Math.max(1, Math.round(cssH * dpr));
  const k = Math.max(1, Math.floor(Math.min(devW / VIEW_W, devH / VIEW_H)));
  const vpW = VIEW_W * k;
  const vpH = VIEW_H * k;
  return {
    dpr,
    devW,
    devH,
    k,
    vpX: Math.floor((devW - vpW) / 2),
    vpY: Math.floor((devH - vpH) / 2),
    vpW,
    vpH,
  };
}

export function currentLayout(): Layout {
  return computeLayout(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
}
