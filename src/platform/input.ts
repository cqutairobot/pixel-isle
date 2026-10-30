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
  // 界面
  Enter: BTN.start | BTN.confirm,
  NumpadEnter: BTN.start | BTN.confirm,
  Escape: BTN.start | BTN.cancel,
  KeyP: BTN.start,
  Backspace: BTN.cancel,
};

/** 标准手柄映射：A 跳、X（或 B）攻击、Y 切换，十字键与左摇杆移动 */
const PAD_BUTTONS: Array<[number, number]> = [
  [0, BTN.jump | BTN.confirm],
  [1, BTN.attack | BTN.cancel],
  [2, BTN.attack],
  [3, BTN.special],
  [9, BTN.start],
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
 * 逻辑步（sample）和界面（sampleUI）各有一份"按下"记录，互不抢键。
 */
export class InputDevices {
  private keysHeld = 0;
  private pressedAcc = 0;
  private releasedAcc = 0;
  private padHeld = 0;
  private uiPressedAcc = 0;
  private uiPadHeld = 0;
  lastDevice: 'keyboard' | 'gamepad' = 'keyboard';
  /** 最近按过的方向键是方向键这套（←→）还是 WASD 这套，按键提示据此显示 */
  arrows = false;

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
    if (e.code.startsWith('Arrow')) this.arrows = true;
    else if (/^Key[WASDJKL]$/.test(e.code)) this.arrows = false;
    if (e.repeat) return;
    if (!(this.keysHeld & b)) {
      this.pressedAcc |= b;
      this.uiPressedAcc |= b;
    }
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
    this.uiPadHeld = 0;
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

  /** 每个渲染帧调用一次，给菜单、对话框用 */
  sampleUI(): { held: number; pressed: number } {
    const pad = this.pollPad();
    if (pad && pad !== this.uiPadHeld) this.lastDevice = 'gamepad';
    const pressed = this.uiPressedAcc | (pad & ~this.uiPadHeld);
    this.uiPadHeld = pad;
    this.uiPressedAcc = 0;
    return { held: this.keysHeld | pad, pressed };
  }

  /** 丢掉还没处理的"按下"（切换界面时用，避免一次按键被两个界面各处理一次） */
  flush(): void {
    this.pressedAcc = 0;
    this.uiPressedAcc = 0;
    this.releasedAcc = 0;
  }

  /** 手柄的 Start 键是否按着（暂停用） */
  padStart(): boolean {
    const pads =
      typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    return pads.some((p) => p?.connected && p.buttons[9]?.pressed);
  }
}
