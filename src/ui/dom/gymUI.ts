import type { Layout } from '../../platform/display';
import './ui.css';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  parent: HTMLElement,
  html = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  parent.appendChild(e);
  return e;
}

const HELP_GAME: Array<[string, string]> = [
  ['← → / A D', '移动'],
  ['↓ / S', '下蹲（往下看）'],
  ['↑ / W', '抬头（往上看）'],
  ['Z / 空格 / K', '跳（按住跳得更高）'],
  ['X / J', '跑（按住）'],
  ['↓ + 跳', '下穿单向平台'],
  ['手柄', 'A 跳 · X 跑 · 摇杆移动'],
];

const HELP_GYM: Array<[string, string]> = [
  ['1 2 3', '手感预设 A / B / C'],
  ['4', '自动奔跑 开 / 关'],
  ['5', '镜头亚像素平滑 开 / 关'],
  ['Q / E', '上一站 / 下一站'],
  ['R', '回到起点'],
  ['M', '静音'],
  ['` 或 F1', '调试叠加层'],
  ['T 或 F2', '调参面板'],
  ['G 或 F4', '慢放'],
  ['P 或 Esc', '暂停（暂停时 N 逐帧）'],
  ['H', '显示 / 隐藏本说明'],
];

/** 练习场的 DOM 叠加界面：预设标签、站点提示、操作说明、调试信息、按键显示 */
export class GymUI {
  readonly root: HTMLDivElement;
  private presetBadge: HTMLDivElement;
  private runBadge: HTMLDivElement;
  private camBadge: HTMLDivElement;
  private station: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private help: HTMLDivElement;
  private hint: HTMLDivElement;
  private debug: HTMLDivElement;
  private keys: HTMLDivElement;
  private keyEls: Record<string, HTMLDivElement> = {};
  private pauseEl: HTMLDivElement;
  private stationTimer = 0;
  private toastTimer = 0;

  constructor() {
    const host = document.getElementById('ui') ?? document.body;
    this.root = el('div', '', host);
    this.root.id = 'ui-root';
    const hud = el('div', 'hud', this.root);
    this.presetBadge = el('div', 'badge', hud);
    this.runBadge = el('div', 'badge', hud);
    this.camBadge = el('div', 'badge', hud);
    this.station = el('div', 'station panel', this.root);
    this.toastEl = el('div', 'toast panel', this.root);
    this.help = el('div', 'help panel', this.root);
    const col = (title: string, rows: Array<[string, string]>) => {
      const c = el('div', '', this.help, `<h3>${title}</h3>`);
      for (const [k, v] of rows)
        el('div', 'row', c, `<span class="k">${k}</span><span>${v}</span>`);
    };
    col('操作', HELP_GAME);
    col('练习场', HELP_GYM);
    this.hint = el('div', 'hint', this.root, 'H 操作说明');
    this.debug = el('div', 'debug', this.root);
    this.keys = el('div', 'keys', this.root);
    for (const [id, label] of [
      ['left', '←'],
      ['right', '→'],
      ['up', '↑'],
      ['down', '↓'],
      ['jump', '跳'],
      ['action', '跑'],
    ] as const) {
      this.keyEls[id] = el('div', 'key', this.keys, label);
    }
    this.pauseEl = el('div', 'pause panel', this.root, '已暂停 · N 逐帧 · P 继续');
  }

  setLayout(L: Layout): void {
    const s = this.root.style;
    s.left = `${L.vpX / L.dpr}px`;
    s.top = `${L.vpY / L.dpr}px`;
    s.width = `${L.vpW / L.dpr}px`;
    s.height = `${L.vpH / L.dpr}px`;
    // 辅助文字用半尺寸像素（每个 UI 像素 = floor(k/2) 个设备像素），不挡住游戏画面；
    // 取整数设备像素，12px 像素字体才能保持锐利
    const uiScale = Math.max(1, Math.floor(L.k / 2));
    s.setProperty('--px', `${uiScale / L.dpr}px`);
  }

  private pop(e: HTMLElement): void {
    e.classList.remove('pop');
    void e.offsetWidth;
    e.classList.add('pop');
  }

  setPreset(id: string, name: string, animate = true): void {
    this.presetBadge.innerHTML = `预设 <b>${id}</b> ${name}`;
    if (animate) this.pop(this.presetBadge);
  }

  setRunMode(auto: boolean, animate = true): void {
    this.runBadge.innerHTML = auto ? '<b>自动奔跑</b>' : '按住 X 跑';
    if (animate) this.pop(this.runBadge);
  }

  setSmooth(on: boolean, animate = true): void {
    this.camBadge.innerHTML = `镜头 <b>${on ? '平滑' : '像素'}</b>`;
    if (animate) this.pop(this.camBadge);
  }

  showStation(title: string, tip: string): void {
    this.station.innerHTML = `<div class="title">${title}</div><div>${tip}</div>`;
    this.station.classList.add('show');
    window.clearTimeout(this.stationTimer);
    this.stationTimer = window.setTimeout(() => this.station.classList.remove('show'), 4200);
  }

  toast(msg: string, ms = 1800): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  toggleHelp(force?: boolean): boolean {
    const on = this.help.classList.toggle('show', force);
    this.hint.style.visibility = on ? 'hidden' : 'visible';
    return on;
  }

  setDebugVisible(on: boolean): void {
    this.debug.classList.toggle('show', on);
    this.keys.classList.toggle('show', on);
  }

  setDebugText(html: string): void {
    this.debug.innerHTML = html;
  }

  setKeys(state: Record<string, boolean>): void {
    for (const [id, e] of Object.entries(this.keyEls)) e.classList.toggle('on', !!state[id]);
  }

  setPaused(on: boolean): void {
    this.pauseEl.classList.toggle('show', on);
  }

  setHint(text: string): void {
    this.hint.textContent = text;
  }
}
