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

/** 页面是否嵌在别的页面的框里（例如 claude.ai 的在线试玩页） */
export const EMBEDDED = typeof window !== 'undefined' && window.self !== window.top;

/**
 * 按窗口尺寸计算整数倍缩放与居中的视口，四周剩下的部分是信箱区。
 * gutter：四周至少留出的 CSS 像素（嵌入网页时留 16px，避免画面贴边）。
 */
export function computeLayout(cssW: number, cssH: number, dpr: number, gutter = 0): Layout {
  const devW = Math.max(1, Math.round(cssW * dpr));
  const devH = Math.max(1, Math.round(cssH * dpr));
  const availW = Math.max(1, devW - 2 * gutter * dpr);
  const availH = Math.max(1, devH - 2 * gutter * dpr);
  const k = Math.max(1, Math.floor(Math.min(availW / VIEW_W, availH / VIEW_H)));
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
  return computeLayout(
    window.innerWidth,
    window.innerHeight,
    window.devicePixelRatio || 1,
    EMBEDDED ? 16 : 0,
  );
}
