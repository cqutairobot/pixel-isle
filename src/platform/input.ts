import { BTN, type InputFrame } from '../sim/input';

/** 键盘映射（PLAN.md §5.8），按物理键位 event.code，不受输入法和键盘布局影响 */
const KEYMAP: Record<string, number> = {
  ArrowLeft: BTN.left,
  KeyA: BTN.left,
  ArrowRight: BTN.right,
  KeyD: BTN.right,
  ArrowUp: BTN.up,
  KeyW: BTN.up,
  ArrowDown: BTN.down,
  KeyS: BTN.down,
  // WASD 这套：J 攻击、K 跳、L 切换；方向键这套：X 攻击、Z 跳、C 切换；空格也是跳
  KeyK: BTN.jump,
  KeyZ: BTN.jump,
  Space: BTN.jump,
  KeyJ: BTN.attack,
  KeyX: BTN.attack,
  KeyL: BTN.special,
  KeyC: BTN.special,
};

/** 标准手柄映射：A 跳、X（或 B）攻击、Y 切换，十字键与左摇杆移动 */
const PAD_BUTTONS: Array<[number, number]> = [
  [0, BTN.jump],
  [1, BTN.attack],
  [2, BTN.attack],
  [3, BTN.special],
  [12, BTN.up],
  [13, BTN.down],
  [14, BTN.left],
  [15, BTN.right],
];
const STICK_DEADZONE = 0.25;
const STICK_DIGITAL = 0.5;

/**
 * 把键盘和手柄合成每个逻辑步的输入帧。
 * 两步之间按下又松开的键也会记成"本步按下"，不会丢。
 */
export class InputDevices {
  private keysHeld = 0;
  private pressedAcc = 0;
  private releasedAcc = 0;
  private padHeld = 0;
  lastDevice: 'keyboard' | 'gamepad' = 'keyboard';

  constructor(private target: Window = window) {
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.releaseAll);
  }

  destroy(): void {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.releaseAll);
  }

  private onDown = (e: KeyboardEvent): void => {
    const b = KEYMAP[e.code];
    if (!b) return;
    e.preventDefault();
    this.lastDevice = 'keyboard';
    if (e.repeat) return;
    if (!(this.keysHeld & b)) this.pressedAcc |= b;
    this.keysHeld |= b;
  };

  private onUp = (e: KeyboardEvent): void => {
    const b = KEYMAP[e.code];
    if (!b) return;
    e.preventDefault();
    if (this.keysHeld & b) this.releasedAcc |= b;
    this.keysHeld &= ~b;
  };

  /** 窗口失焦时松开所有键，防止"卡键" */
  releaseAll = (): void => {
    this.releasedAcc |= this.keysHeld | this.padHeld;
    this.keysHeld = 0;
    this.padHeld = 0;
  };

  private pollPad(): number {
    const pads =
      typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let held = 0;
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      for (const [i, b] of PAD_BUTTONS) if (pad.buttons[i]?.pressed) held |= b;
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > STICK_DEADZONE) {
        if (ax < -STICK_DIGITAL) held |= BTN.left;
        if (ax > STICK_DIGITAL) held |= BTN.right;
        if (ay < -STICK_DIGITAL) held |= BTN.up;
        if (ay > STICK_DIGITAL) held |= BTN.down;
      }
    }
    return held;
  }

  /** 每个逻辑步调用一次 */
  sample(): InputFrame {
    const pad = this.pollPad();
    if (pad && pad !== this.padHeld) this.lastDevice = 'gamepad';
    this.pressedAcc |= pad & ~this.padHeld;
    this.releasedAcc |= this.padHeld & ~pad;
    this.padHeld = pad;
    const frame: InputFrame = {
      held: this.keysHeld | this.padHeld,
      pressed: this.pressedAcc,
      released: this.releasedAcc,
    };
    this.pressedAcc = 0;
    this.releasedAcc = 0;
    return frame;
  }

  /** 手柄的 Start 键是否按着（暂停用） */
  padStart(): boolean {
    const pads =
      typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    return pads.some((p) => p?.connected && p.buttons[9]?.pressed);
  }
}
