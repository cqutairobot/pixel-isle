import type Phaser from 'phaser';
import { UI_TEXT } from '../content/text';
import { VIEW_H, VIEW_W } from '../platform/display';
import type { Modal } from '../scenes/UIScene';
import { BTN } from '../sim/input';
import { ATLAS } from '../view/textures';
import { panelTexture } from './panel';
import type { ModalHost } from './panelModal';
import { PixelText } from './text/pixelText';

export interface ItemGetOptions {
  /** 道具名（大字） */
  name: string;
  /** 横幅最上面的一行（默认"得到了新装备！"；新伙伴是"新伙伴！"） */
  head?: string;
  /** 一句用法 */
  usage: string;
  /** 道具的大图 */
  frame: string;
  /** 小满脚底在屏幕上的位置 */
  at: { x: number; y: number };
  /** 演出结束（按确认关掉）以后 */
  onClose: () => void;
}

const SPOT_KEY = 'itemget-spot';
/** 横幅的高度；横幅贴着画面底边，不挡住小满 */
const BANNER_H = 58;
const RAYS_KEY = 'itemget-rays';

/** 一圈放射状的光芒（叠加混合，慢慢转）：12 道从中心往外变淡的楔形 */
function raysTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(RAYS_KEY)) return RAYS_KEY;
  const S = 176;
  const tex = scene.textures.createCanvas(RAYS_KEY, S, S)!;
  const ctx = tex.getContext();
  const c = S / 2;
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / n / 2;
    const g = ctx.createRadialGradient(c, c, 6, c, c, c);
    g.addColorStop(0, 'rgba(255,244,214,0.9)');
    g.addColorStop(0.55, 'rgba(255,201,60,0.35)');
    g.addColorStop(1, 'rgba(255,201,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, c, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  tex.refresh();
  return RAYS_KEY;
}

/** 全屏压暗，只在 (x, y) 附近留一圈亮的（聚光） */
function spotTexture(scene: Phaser.Scene, x: number, y: number): string {
  if (scene.textures.exists(SPOT_KEY)) scene.textures.remove(SPOT_KEY);
  const tex = scene.textures.createCanvas(SPOT_KEY, VIEW_W, VIEW_H)!;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(x, y, 18, x, y, 86);
  g.addColorStop(0, 'rgba(26,28,44,0)');
  g.addColorStop(1, 'rgba(26,28,44,0.82)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  tex.refresh();
  return SPOT_KEY;
}

/**
 * 获得道具演出（docs/levels/1-2.md §5，以后的雪绒手套、夏铃也用它）：
 * 时间停住，画面压暗、聚光照在小满身上；道具一边转一边升起来，背后的光芒慢慢转动；
 * 横幅写道具名和一句用法。按确认结束。
 */
export class ItemGet implements Modal {
  readonly hidesHud = true;
  private spot: Phaser.GameObjects.Image;
  private rays: Phaser.GameObjects.Image;
  private item: Phaser.GameObjects.Image;
  private banner: Phaser.GameObjects.Container;
  private texts: PixelText[] = [];
  private hint: PixelText;
  private t = 0;
  private closing = false;
  private readonly topY: number;

  constructor(
    private host: ModalHost,
    private o: ItemGetOptions,
  ) {
    const s = host.scene;
    const { x, y } = o.at;
    this.topY = Math.max(40, y - 62);
    this.spot = s.add
      .image(0, 0, spotTexture(s, x, y - 24))
      .setOrigin(0, 0)
      .setDepth(31)
      .setAlpha(0);
    this.rays = s.add
      .image(x, this.topY, raysTexture(s))
      .setDepth(31.5)
      .setBlendMode(1)
      .setAlpha(0)
      .setScale(0.3);
    this.item = s.add
      .image(x, y - 14, ATLAS, o.frame)
      .setDepth(32)
      .setScale(0.5)
      .setAlpha(0);
    // 横幅：道具名（2 倍大）+ 一句用法 + 按键提示
    const w = 248;
    const h = BANNER_H;
    this.banner = s.add.container(Math.round((VIEW_W - w) / 2), VIEW_H + 4).setDepth(33);
    this.banner.add(s.add.image(0, 0, panelTexture(s, w, h, 'paper')).setOrigin(0, 0));
    const head = new PixelText(s, 0, 0, o.head ?? UI_TEXT.itemGet, { color: 'ochre' });
    head.setPosition(Math.round((w - head.width) / 2), 3);
    const name = new PixelText(s, 0, 0, o.name, { color: 'night' });
    name.root.setScale(2);
    name.setPosition(Math.round((w - name.width * 2) / 2), 12);
    const usage = new PixelText(s, 0, 0, o.usage, { color: 'slate' });
    usage.setPosition(Math.round((w - usage.width) / 2), 42);
    this.banner.add([head.root, name.root, usage.root]);
    this.hint = new PixelText(s, 0, 0, UI_TEXT.confirmHint, { color: 'cream', shadow: 'ink' });
    // 按键提示放在横幅右上方，不压着横幅
    this.hint.setPosition(VIEW_W - this.hint.width - 8, VIEW_H - BANNER_H - 20);
    this.hint.root.setDepth(33).setAlpha(0);
    this.texts.push(head, name, usage, this.hint);
    s.tweens.add({ targets: this.spot, alpha: 1, duration: 260 });
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    const { x, y } = this.o.at;
    for (const tx of this.texts) tx.update(dt);
    if (this.closing) return;
    // 道具升起（0.15–0.85 秒），然后上下轻轻浮动
    const k = Math.min(1, Math.max(0, (t - 0.15) / 0.7));
    const ease = 1 - Math.pow(1 - k, 3);
    const bob = k >= 1 ? Math.sin((t - 0.85) * 3) * 2 : 0;
    this.item
      .setAlpha(Math.min(1, k * 3))
      .setPosition(x, Math.round(y - 14 + (this.topY - (y - 14)) * ease + bob))
      .setScale(0.5 + ease * 1.5);
    // 一边转：横向缩放模拟翻转，转得越来越慢
    const spin = Math.cos(t * (14 - Math.min(10, t * 6)));
    this.item.scaleX = this.item.scaleY * (k < 1 ? spin : Math.max(0.85, Math.abs(spin)));
    this.rays
      .setAlpha(Math.min(0.9, Math.max(0, (t - 0.5) * 2)))
      .setScale(Math.min(1.1, 0.3 + Math.max(0, t - 0.5) * 1.6))
      .setRotation(t * 0.5)
      .setPosition(x, this.item.y);
    // 横幅滑上来
    const b = Math.min(1, Math.max(0, (t - 0.7) / 0.35));
    const by = VIEW_H + 4 - (1 - Math.pow(1 - b, 3)) * (BANNER_H + 10);
    this.banner.y = Math.round(by);
    this.hint.root.setAlpha(t > 1.4 ? 0.6 + Math.sin(t * 4) * 0.3 : 0);
  }

  input(pressed: number): void {
    if (this.closing || this.t < 1.2) return;
    if (pressed & (BTN.jump | BTN.confirm | BTN.attack | BTN.start)) this.close();
  }

  /** 收起：所有东西淡出，然后告诉过场可以继续了 */
  close(): void {
    if (this.closing) return;
    this.closing = true;
    this.host.sfx('close');
    const s = this.host.scene;
    s.tweens.add({
      targets: [this.spot, this.rays, this.item, this.hint.root],
      alpha: 0,
      duration: 260,
    });
    s.tweens.add({
      targets: this.banner,
      y: VIEW_H + 4,
      duration: 240,
      ease: 'Cubic.In',
      onComplete: () => {
        this.host.close(this);
        this.o.onClose();
      },
    });
  }

  destroy(): void {
    for (const t of this.texts) t.destroy();
    this.spot.destroy();
    this.rays.destroy();
    this.item.destroy();
    this.banner.destroy();
  }
}
