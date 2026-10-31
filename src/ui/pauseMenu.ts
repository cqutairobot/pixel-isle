import { MENU_TEXT } from '../content/text';
import { BTN } from '../sim/input';
import { Menu } from './menu';
import { PanelModal, type ModalHost } from './panelModal';

export interface PauseHooks {
  resume(): void;
  restart(): void;
  settings(): void;
  toTitle(): void;
}

/**
 * 暂停菜单：继续游戏 / 重新开始本关 / 设置 / 回到标题。
 * 按 Esc、Enter、手柄 Start 或返回键都能直接继续；R 直接重新开始。
 */
export class PauseMenu extends PanelModal {
  private menu: Menu;

  constructor(
    host: ModalHost,
    private hooks: PauseHooks,
  ) {
    super(host, 150, 100, 'paper', 0.25);
    this.centered(MENU_TEXT.paused, 7, 'red1');
    this.menu = new Menu(
      host.scene,
      22,
      28,
      [
        { label: MENU_TEXT.resume, select: () => this.close(hooks.resume) },
        { label: MENU_TEXT.restart, select: () => this.close(hooks.restart) },
        { label: MENU_TEXT.settings, select: () => hooks.settings() },
        { label: MENU_TEXT.toTitle, select: () => hooks.toTitle() },
      ],
      { rowH: 16, back: () => this.close(hooks.resume), sfx: (s) => host.sfx(s) },
    );
    this.root.add(this.menu.root);
  }

  input(pressed: number): void {
    if (this.isClosing) return;
    // Esc、P、手柄 Start 直接继续；Enter 同时是"确认"，用来选中当前项
    if (pressed & BTN.start && !(pressed & BTN.confirm)) {
      this.host.sfx('back');
      this.close(this.hooks.resume);
      return;
    }
    this.menu.input(pressed);
  }

  override update(dt: number): void {
    super.update(dt);
    this.menu.update(dt);
  }

  override destroy(): void {
    this.menu.destroy();
    super.destroy();
  }
}
