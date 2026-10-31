import { audio } from '../audio/engine';
import { CONTROLS_TEXT, MENU_TEXT } from '../content/text';
import { emptySave, writeSave } from '../platform/save';
import { saveSettings, settings, type Settings } from '../platform/settings';
import { Menu } from './menu';
import { ConfirmBox, InfoCard, PanelModal, type ModalHost } from './panelModal';
import type { PixelText } from './text/pixelText';

const SHAKES: Array<Settings['shake']> = ['full', 'low', 'off'];
const SHAKE_LABEL: Record<Settings['shake'], string> = {
  full: MENU_TEXT.shakeFull,
  low: MENU_TEXT.shakeLow,
  off: MENU_TEXT.shakeOff,
};
const onOff = (v: boolean) => (v ? MENU_TEXT.on : MENU_TEXT.off);
const step = (v: number, dir: number) => Math.max(0, Math.min(1, Math.round(v * 10 + dir) / 10));

export interface SettingsHooks {
  /** 打开新的模态面板（操作说明、确认框）：叠在设置上面 */
  open(m: PanelModal): void;
  /** 设置改了：关卡场景据此更新震屏、闪烁、自动奔跑 */
  changed?(): void;
  /** 存档被清除了 */
  cleared?(): void;
  toast(text: string): void;
}

/**
 * 设置面板：音量（总 / 音乐 / 音效）、震屏、减少闪烁、自动奔跑、辅助模式、全屏、
 * 操作说明、清除存档（两次确认）。改动立即生效并保存。
 */
export class SettingsPanel extends PanelModal {
  private menu: Menu;
  private note: PixelText;

  constructor(
    host: ModalHost,
    private hooks: SettingsHooks,
  ) {
    super(host, 236, 208);
    this.centered(MENU_TEXT.settings, 6, 'red1');
    const apply = () => {
      saveSettings();
      audio.applyVolume();
      hooks.changed?.();
    };
    const vol = (key: 'master' | 'music' | 'sfx') => ({
      bar: () => settings[key],
      change: (d: -1 | 1) => {
        settings[key] = step(settings[key], d);
        apply();
        if (key !== 'music') audio.play('ui', { volume: 0.8 });
      },
    });
    const toggle = (key: 'reduceFlash' | 'autoRun' | 'assist') => ({
      value: () => onOff(settings[key]),
      change: () => {
        settings[key] = !settings[key];
        apply();
        if (key === 'assist') this.flashNote();
      },
    });
    this.menu = new Menu(
      host.scene,
      14,
      26,
      [
        { label: MENU_TEXT.master, ...vol('master') },
        { label: MENU_TEXT.music, ...vol('music') },
        { label: MENU_TEXT.sfx, ...vol('sfx') },
        {
          label: MENU_TEXT.shake,
          value: () => SHAKE_LABEL[settings.shake],
          change: (d) => {
            settings.shake = SHAKES[(SHAKES.indexOf(settings.shake) + d + 3) % 3]!;
            apply();
          },
        },
        { label: MENU_TEXT.reduceFlash, ...toggle('reduceFlash') },
        { label: MENU_TEXT.autoRun, ...toggle('autoRun') },
        { label: MENU_TEXT.assist, ...toggle('assist') },
        {
          label: MENU_TEXT.fullscreen,
          value: () => onOff(!!document.fullscreenElement),
          change: () => {
            const done = () => this.menu.refresh();
            if (document.fullscreenElement) void document.exitFullscreen().then(done, done);
            else void document.documentElement.requestFullscreen?.().then(done, done);
          },
        },
        {
          label: MENU_TEXT.controls,
          select: () => hooks.open(new InfoCard(host, MENU_TEXT.controls, CONTROLS_TEXT)),
        },
        {
          label: MENU_TEXT.clearSave,
          select: () =>
            hooks.open(
              new ConfirmBox(host, MENU_TEXT.clearSaveConfirm, () =>
                hooks.open(
                  new ConfirmBox(host, MENU_TEXT.clearSaveConfirm2, () => {
                    writeSave(emptySave());
                    hooks.cleared?.();
                    hooks.toast(MENU_TEXT.saveCleared);
                  }),
                ),
              ),
            ),
        },
        { label: MENU_TEXT.back, select: () => this.close() },
      ],
      { rowH: 14, width: 206, back: () => this.close(), sfx: (s) => host.sfx(s) },
    );
    this.root.add(this.menu.root);
    this.note = this.centered(MENU_TEXT.assistNote, this.h - 18, 'stone');
    this.note.setAlpha(0);
  }

  private flashNote(): void {
    this.note.setAlpha(1);
    this.host.scene.tweens.add({ targets: this.note.root, alpha: 0, delay: 2200, duration: 400 });
  }

  /** 叠在上面的面板关掉后，刷新显示（例如全屏状态） */
  refresh(): void {
    this.menu.refresh();
  }

  input(pressed: number): void {
    if (!this.isClosing) this.menu.input(pressed);
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
