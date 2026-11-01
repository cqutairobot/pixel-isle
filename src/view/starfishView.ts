import type Phaser from 'phaser';
import type { World } from '../sim/world';
import { ATLAS } from './textures';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 五角星每转 72° 和原来一样；旋转帧铺满这 72° */
const STEP = (Math.PI * 2) / 5 / 8;
const TRAIL = 4;

/**
 * 飞出去的回旋海星：按转过的角度选旋转帧（越快转得越快），身后拖几道渐隐的残影。
 * 挂在海星上的道具由 sim 跟着移动，道具精灵照常画（EntityViews）。
 */
export class StarfishView {
  private img: Phaser.GameObjects.Image;
  private trail: Phaser.GameObjects.Image[] = [];
  private hist: Array<{ x: number; y: number; f: string }> = [];
  private angle = 0;
  private sampleT = 0;

  constructor(
    scene: Phaser.Scene,
    private world: World,
  ) {
    this.img = scene.add.image(0, 0, ATLAS, 'equip/star_0').setDepth(8).setVisible(false);
    for (let i = 0; i < TRAIL; i++)
      this.trail.push(
        scene.add
          .image(0, 0, ATLAS, 'equip/star_0')
          .setDepth(7.9)
          .setVisible(false)
          .setAlpha(0.42 - i * 0.1),
      );
  }

  update(dt: number, alpha: number): void {
    const s = this.world.starfish;
    if (!s.out) {
      this.img.setVisible(false);
      for (const t of this.trail) t.setVisible(false);
      this.hist = [];
      return;
    }
    const b = s.body;
    const x = lerp(b.px, b.x, alpha) + b.w / 2;
    const y = lerp(b.py, b.y, alpha) + b.h / 2;
    // 转速跟着飞行速度：快的时候一秒转三圈多，慢下来时也不停
    const v = Math.hypot(b.x - b.px, b.y - b.py) * 60;
    const dir = s.state === 'out' ? Math.sign(s.dirX) || 1 : 1;
    this.angle += dt * (8 + v * 0.06) * dir;
    const k = Math.floor(this.angle / STEP);
    const f = `equip/star_${((k % 8) + 8) % 8}`;
    this.img.setVisible(true).setFrame(f).setPosition(Math.round(x), Math.round(y));
    // 每 1/40 秒记一个位置，残影画在最近的几个位置上
    this.sampleT += dt;
    if (this.sampleT >= 1 / 40) {
      this.sampleT = 0;
      this.hist.unshift({ x, y, f });
      if (this.hist.length > TRAIL + 1) this.hist.pop();
    }
    this.trail.forEach((t, i) => {
      const h = this.hist[i + 1];
      if (!h || v < 30) {
        t.setVisible(false);
        return;
      }
      t.setVisible(true).setFrame(h.f).setPosition(Math.round(h.x), Math.round(h.y));
    });
  }
}
