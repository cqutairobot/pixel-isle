import { MAP_TEXT, MENU_TEXT } from '../content/text';
import { BTN } from '../sim/input';
import { Menu } from './menu';
import { PanelModal, type ModalHost } from './panelModal';

export interface PauseHooks {
  resume(): void;
  restart(): void;
  settings(): void;
  toTitle(): void;
  /** 最后一项的文字：地图开放以后是"回到地图" */
  leaveLabel?: string;
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
        { label: hooks.leaveLabel ?? MENU_TEXT.toTitle, select: () => hooks.toTitle() },
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

export interface MapMenuHooks {
  resume(): void;
  settings(): void;
  toTitle(): void;
}

/** 地图菜单（在章节地图上按 Esc）：继续 / 设置 / 回到标题 */
export class MapMenu extends PanelModal {
  private menu: Menu;

  constructor(
    host: ModalHost,
    private hooks: MapMenuHooks,
  ) {
    super(host, 150, 84, 'paper', 0.25);
    this.centered(MAP_TEXT.menuTitle, 7, 'red1');
    this.menu = new Menu(
      host.scene,
      22,
      28,
      [
        { label: MENU_TEXT.resume, select: () => this.close(hooks.resume) },
        { label: MENU_TEXT.settings, select: () => hooks.settings() },
        { label: MENU_TEXT.toTitle, select: () => this.close(hooks.toTitle) },
      ],
      { rowH: 16, back: () => this.close(hooks.resume), sfx: (snd) => host.sfx(snd) },
    );
    this.root.add(this.menu.root);
  }

  input(pressed: number): void {
    if (this.isClosing) return;
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
