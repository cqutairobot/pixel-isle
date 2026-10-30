/** 动效令牌（PLAN.md §7）。DOM 界面与 Phaser 补间都从这里取值。 */
export const DUR = {
  xs: 80,
  s: 150,
  m: 250,
  l: 400,
  xl: 700,
} as const;

/** CSS 缓动：入场回弹、三次缓出、三次缓入 */
export const EASE_CSS = {
  back: 'cubic-bezier(.34,1.56,.64,1)',
  out: 'cubic-bezier(.33,1,.68,1)',
  in: 'cubic-bezier(.32,0,.67,0)',
} as const;

/** 列表项依次入场的间隔（ms） */
export const STAGGER = 40;
