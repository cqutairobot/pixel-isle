/** 按钮位掩码。sim 只认这些抽象按钮，不关心键盘还是手柄。 */
export const BTN = {
  left: 1,
  right: 2,
  up: 4,
  down: 8,
  jump: 16,
  /** 攻击 / 使用装备 */
  attack: 32,
  /** 切换装备 / 下坐骑 */
  special: 64,
  // 以下三个只给界面用，sim 不读
  /** 暂停：Esc、Enter、P、手柄 Start */
  start: 128,
  /** 菜单确认：Enter（跳跃键也算确认） */
  confirm: 256,
  /** 菜单返回：Esc、Backspace（攻击键也算返回） */
  cancel: 512,
} as const;

/** 一个逻辑步的输入：当前按住的、本步新按下的、本步松开的。 */
export interface InputFrame {
  held: number;
  pressed: number;
  released: number;
}

export const EMPTY_INPUT: InputFrame = { held: 0, pressed: 0, released: 0 };

export function isHeld(f: InputFrame, b: number): boolean {
  return (f.held & b) !== 0;
}

export function isPressed(f: InputFrame, b: number): boolean {
  return (f.pressed & b) !== 0;
}
