import type Phaser from 'phaser';
import { GLASS_COLORS } from '../art/items';
import { VIEW_H, VIEW_W } from '../platform/display';
import { Spring } from '../view/spring';
import { ATLAS } from '../view/textures';
import { vignetteTexture } from './panel';

const HEART_X = 6;
const HEART_Y = 6;
const HEART_STEP = 12;
const SHELL_Y = 19;
/** 装备格（贝壳计数下面） */
const EQUIP_Y = 31;

interface Digit {
  img: Phaser.GameObjects.Image;
  value: string;
  /** 滚动动画：0 → 1 */
  roll: number;
  from: string;
  old: Phaser.GameObjects.Image;
}

/**
 * HUD（PLAN §6.10）：左上角的心、贝壳计数和装备格，右上角的 3 个海玻璃槽。
 * - 掉心：心碎成两半并抖动；回血：心填满并弹一下；只剩 1 颗心：心跳 + 画面四角暗角。
 * - 贝壳计数像里程表一样一位一位滚上去，图标跟着弹一下。
 * - 装备格：拥有装备后出现；海星飞出去时图标变暗，接住时弹一下，按切换键时晃一下。
 */
export class Hud {
  readonly root: Phaser.GameObjects.Container;
  private hearts: Phaser.GameObjects.Image[] = [];
  private heartSprings: Spring[] = [];
  private breaking: Array<{ i: number; t: number }> = [];
  private hp = 3;
  private max = 3;
  private shellIcon: Phaser.GameObjects.Image;
  private iconSpring = new Spring(1, 900, 18);
  private digits: Digit[] = [];
  private shown = 0;
  private target = 0;
  private tickTimer = 0;
  private glassSlots: Phaser.GameObjects.Image[] = [];
  private glassSprings: Spring[] = [];
  private vignette: Phaser.GameObjects.Image;
  private time = 0;
  private shakeT = 0;
  private equipSlot: Phaser.GameObjects.Image;
  private equipIcon: Phaser.GameObjects.Image;
  private equipSpring = new Spring(1, 700, 14);
  private equipTilt = new Spring(0, 520, 9);
  private equipOut = false;

  constructor(private scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(10);
    this.vignette = scene.add
      .image(0, 0, vignetteTexture(scene, VIEW_W, VIEW_H))
      .setOrigin(0, 0)
      .setAlpha(0)
      .setDepth(5);
    this.shellIcon = scene.add
      .image(HEART_X + 5, SHELL_Y + 4, ATLAS, 'ui/shell')
      .setOrigin(0.5, 0.5);
    this.root.add(this.shellIcon);
    for (let i = 0; i < 3; i++) {
      const img = scene.add
        .image(VIEW_W - 8 - (2 - i) * 13, HEART_Y + 5, ATLAS, 'ui/glass_slot')
        .setOrigin(0.5, 0.5);
      this.glassSlots.push(img);
      this.glassSprings.push(new Spring(1, 700, 16));
      this.root.add(img);
    }
    this.equipSlot = scene.add
      .image(HEART_X + 9, EQUIP_Y + 9, ATLAS, 'equip/slot')
      .setOrigin(0.5, 0.5)
      .setVisible(false);
    this.equipIcon = scene.add
      .image(HEART_X + 9, EQUIP_Y + 9, ATLAS, 'equip/star_0')
      .setOrigin(0.5, 0.5)
      .setVisible(false);
    this.root.add([this.equipSlot, this.equipIcon]);
    this.setMaxHearts(3, 3);
    this.setShells(0, true);
  }

  /** 有没有装备（拿到海星时 pop 出来） */
  setEquip(on: boolean, pop = false): void {
    const was = this.equipSlot.visible;
    this.equipSlot.setVisible(on);
    this.equipIcon.setVisible(on);
    if (on && !was && pop) this.equipSpring.set(0, 9);
    if (!on) this.setEquipOut(false);
  }

  /** 海星飞出去了：图标变暗 */
  setEquipOut(out: boolean): void {
    this.equipOut = out;
  }

  /** 接住海星：图标弹一下 */
  equipCatch(): void {
    this.equipSpring.set(1.5);
  }

  /** 切换装备（现在只有一件）：图标晃一下 */
  equipWiggle(): void {
    this.equipTilt.set(0, 9);
  }

  setVisible(v: boolean): void {
    this.root.setVisible(v);
    if (!v) this.vignette.setAlpha(0);
  }

  setMaxHearts(max: number, hp: number): void {
    for (const h of this.hearts) h.destroy();
    this.hearts = [];
    this.heartSprings = [];
    this.max = max;
    this.hp = hp;
    for (let i = 0; i < max; i++) {
      const img = this.scene.add
        .image(
          HEART_X + i * HEART_STEP + 5,
          HEART_Y + 4,
          ATLAS,
          i < hp ? 'ui/heart_full' : 'ui/heart_empty',
        )
        .setOrigin(0.5, 0.5);
      this.hearts.push(img);
      this.heartSprings.push(new Spring(1, 800, 14));
      this.root.add(img);
    }
  }

  /** 心数变化：减少时播放碎裂，增加时弹一下 */
  setHearts(hp: number): void {
    hp = Math.max(0, Math.min(this.max, hp));
    if (hp < this.hp) {
      for (let i = hp; i < this.hp; i++) this.breaking.push({ i, t: 0 });
      this.shakeT = 0.3;
    } else if (hp > this.hp) {
      for (let i = this.hp; i < hp; i++) {
        this.breaking = this.breaking.filter((b) => b.i !== i);
        this.hearts[i]?.setFrame('ui/heart_full');
        this.heartSprings[i]?.set(1.6);
      }
    }
    this.hp = hp;
  }

  /** 贝壳总数（会一位一位滚上去） */
  setShells(n: number, immediate = false): void {
    this.target = n;
    if (immediate) {
      this.shown = n;
      this.renderDigits(true);
    }
  }

  setGlass(found: readonly boolean[], ghost: readonly boolean[] = []): void {
    found.forEach((f, i) => {
      const slot = this.glassSlots[i];
      if (!slot) return;
      const want = f || ghost[i] ? `item/glass_${GLASS_COLORS[i]}_0` : 'ui/glass_slot';
      if (slot.frame.name !== want) {
        slot.setFrame(want);
        if (f) this.glassSprings[i]!.set(1.8);
      }
      slot.setAlpha(f ? 1 : ghost[i] ? 0.35 : 1);
    });
  }

  /** 收集到海玻璃时，对应的槽弹一下 */
  pulseGlass(i: number): void {
    this.glassSprings[i]?.set(2);
  }

  /** 贝壳计数图标在屏幕上的位置（飞来的贝壳朝这里飞） */
  get shellTarget(): { x: number; y: number } {
    return { x: this.shellIcon.x, y: this.shellIcon.y };
  }

  bumpShellIcon(): void {
    this.iconSpring.set(1.45);
  }

  private renderDigits(snap = false): void {
    const str = String(this.shown);
    while (this.digits.length < str.length) {
      const x = HEART_X + 13 + this.digits.length * 7;
      const img = this.scene.add.image(x, SHELL_Y, ATLAS, 'ui/d_0').setOrigin(0, 0);
      const old = this.scene.add
        .image(x, SHELL_Y, ATLAS, 'ui/d_0')
        .setOrigin(0, 0)
        .setVisible(false);
      this.root.add([old, img]);
      this.digits.push({ img, value: '0', roll: 1, from: '0', old });
    }
    for (let i = 0; i < this.digits.length; i++) {
      const d = this.digits[i]!;
      const ch = str[i];
      d.img.setVisible(ch !== undefined);
      if (ch === undefined) continue;
      if (ch !== d.value) {
        d.from = d.value;
        d.value = ch;
        d.roll = snap ? 1 : 0;
        d.img.setFrame(`ui/d_${ch}`);
        d.old.setFrame(`ui/d_${d.from}`);
      }
    }
  }

  update(dt: number): void {
    this.time += dt;
    // 贝壳计数追上目标：每 35ms 加 1，差得多时加快
    if (this.shown < this.target) {
      this.tickTimer -= dt;
      if (this.tickTimer <= 0) {
        const gap = this.target - this.shown;
        this.shown += gap > 20 ? Math.ceil(gap / 10) : 1;
        this.tickTimer = 0.035;
        this.renderDigits();
        this.bumpShellIcon();
      }
    } else if (this.shown > this.target) {
      this.shown = this.target;
      this.renderDigits(true);
    }
    // 里程表滚动：新数字从下面滚上来，旧数字往上滚走
    for (const d of this.digits) {
      if (d.roll < 1) {
        d.roll = Math.min(1, d.roll + dt / 0.09);
        const k = 1 - Math.pow(1 - d.roll, 2);
        d.img.y = SHELL_Y + Math.round((1 - k) * 6);
        d.img.setAlpha(k);
        d.old.setVisible(d.roll < 1).setAlpha(1 - k);
        d.old.y = SHELL_Y - Math.round(k * 6);
      } else {
        d.img.y = SHELL_Y;
        d.img.setAlpha(1);
        d.old.setVisible(false);
      }
    }
    const s = this.iconSpring.update(dt);
    this.shellIcon.setScale(s);
    // 心
    this.breaking = this.breaking.filter((b) => {
      b.t += dt;
      const img = this.hearts[b.i];
      if (!img) return false;
      const f = Math.min(2, Math.floor(b.t / 0.08));
      if (b.t < 0.28) {
        img.setFrame(`ui/heart_break_${f}`);
        return true;
      }
      img.setFrame('ui/heart_empty');
      return false;
    });
    const shake =
      this.shakeT > 0 ? Math.round(Math.sin(this.time * 80) * 2 * (this.shakeT / 0.3)) : 0;
    this.shakeT = Math.max(0, this.shakeT - dt);
    const low = this.hp === 1 && this.max > 1;
    this.hearts.forEach((img, i) => {
      let sc = this.heartSprings[i]!.update(dt);
      if (low && i === 0) {
        // 心跳：每 0.85 秒跳两下
        const t = (this.time % 0.85) / 0.85;
        sc *=
          1 +
          (t < 0.12
            ? Math.sin((t / 0.12) * Math.PI) * 0.28
            : t > 0.2 && t < 0.3
              ? Math.sin(((t - 0.2) / 0.1) * Math.PI) * 0.15
              : 0);
      }
      img.setScale(sc);
      img.x = HEART_X + i * HEART_STEP + 5 + shake;
    });
    this.vignette.setAlpha(
      low && this.root.visible
        ? 0.32 + Math.sin(this.time * 7.4) * 0.1
        : Math.max(0, this.vignette.alpha - dt * 2),
    );
    this.glassSlots.forEach((g, i) => g.setScale(this.glassSprings[i]!.update(dt)));
    // 装备格
    const es = this.equipSpring.update(dt);
    this.equipSlot.setScale(es);
    const target = this.equipOut ? 0.3 : 1;
    this.equipIcon
      .setScale(es)
      .setRotation(this.equipTilt.update(dt))
      .setAlpha(this.equipIcon.alpha + (target - this.equipIcon.alpha) * Math.min(1, dt * 12));
  }
}
