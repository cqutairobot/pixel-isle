import type Phaser from 'phaser';
import { colorInt } from '../art/palette';
import { VIEW_H, VIEW_W } from '../platform/display';
import { TILE } from '../sim/constants';
import type { World } from '../sim/world';

/**
 * 调试叠加层（世界坐标）：碰撞盒、速度向量、上一次跳跃的轨迹点、撞头修正/边缘辅助的闪烁标记、1 格网格。
 */
export class DebugOverlay {
  private gfx: Phaser.GameObjects.Graphics;
  private grid: Phaser.GameObjects.TileSprite;
  private trail: Array<[number, number]> = [];
  private recording = false;
  private marks: Array<{ x: number; y: number; t: number; color: number }> = [];
  visible = false;

  constructor(scene: Phaser.Scene) {
    const tex = scene.textures.createCanvas('debug-grid', TILE, TILE)!;
    const ctx = tex.getContext();
    ctx.fillStyle = 'rgba(26,28,44,0.22)';
    ctx.fillRect(0, 0, TILE, 1);
    ctx.fillRect(0, 0, 1, TILE);
    tex.refresh();
    this.grid = scene.add
      .tileSprite(0, 0, VIEW_W + TILE, VIEW_H + TILE, 'debug-grid')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-50)
      .setVisible(false);
    this.gfx = scene.add.graphics().setDepth(60);
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.grid.setVisible(on);
    if (!on) this.gfx.clear();
  }

  /** 每个逻辑步调用：记录跳跃轨迹与修正事件 */
  onStep(world: World): void {
    const p = world.player;
    for (const e of world.events) {
      if (e.type === 'jump' || e.type === 'leaveGround' || e.type === 'drop') {
        this.trail = [];
        this.recording = true;
      } else if (e.type === 'cornerCorrect') {
        this.marks.push({ x: p.body.centerX, y: p.body.y, t: 0.5, color: colorInt('gold') });
      } else if (e.type === 'ledgeAssist') {
        this.marks.push({ x: p.body.centerX, y: p.body.bottom, t: 0.5, color: colorInt('teal') });
      } else if (e.type === 'respawn') {
        this.trail = [];
        this.recording = false;
      }
    }
    if (this.recording) {
      this.trail.push([p.body.centerX, p.body.bottom]);
      if (p.onGround) this.recording = false;
      if (this.trail.length > 600) this.trail.shift();
    }
  }

  draw(
    dt: number,
    world: World,
    bodyX: number,
    bodyY: number,
    camX: number,
    camY: number,
    k: number,
  ): void {
    if (!this.visible) return;
    this.grid.tilePositionX = camX;
    this.grid.tilePositionY = camY;
    const g = this.gfx;
    const p = world.player;
    const b = p.body;
    g.clear();
    const thin = 1 / k;
    // 轨迹点（脚底中心）
    g.fillStyle(colorInt('red2'), 1);
    for (const [x, y] of this.trail) g.fillRect(x - 0.5, y - 0.5, 1, 1);
    // 碰撞盒（10×14）与受伤判定（8×12）
    g.lineStyle(thin * 2, colorInt('teal'), 1);
    g.strokeRect(bodyX, bodyY, b.w, b.h);
    g.lineStyle(thin * 2, colorInt('red2'), 0.8);
    g.strokeRect(bodyX + 1, bodyY + 2, b.w - 2, b.h - 2);
    // 速度向量（缩到 1/8）
    const cx = bodyX + b.w / 2;
    const cy = bodyY + b.h / 2;
    g.lineStyle(thin * 2, colorInt('gold'), 1);
    g.lineBetween(cx, cy, cx + p.vx / 8, cy + p.vy / 8);
    // 修正标记
    this.marks = this.marks.filter((m) => (m.t -= dt) > 0);
    for (const m of this.marks) {
      g.fillStyle(m.color, Math.min(1, m.t * 3));
      g.fillRect(m.x - 2, m.y - 2, 4, 4);
    }
  }
}
