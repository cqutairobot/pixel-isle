import type Phaser from 'phaser';
import { GLASS_COLORS } from '../art/items';
import { BUMP_FRAMES, type Block } from '../sim/blocks';
import { CHIME_LAYOUT } from '../sim/chimes';
import { TILE } from '../sim/constants';
import type { Enemy } from '../sim/enemies';
import type { SimEvent } from '../sim/events';
import type { Item } from '../sim/items';
import type { Npc, World } from '../sim/world';
import type { Particles } from './particles';
import { Spring } from './spring';
import { ATLAS } from './textures';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const BELL_SEQ = [0, 1, 0, 3, 0, 1, 0, 3, 2];

/** 每个 NPC 的帧名前缀与精灵高度（提示"↑"放在头顶） */
const NPC_FRAMES: Record<string, { idle: string[]; h: number }> = {
  haishen: { idle: ['npc/haishen_idle_0', 'npc/haishen_idle_1'], h: 22 },
  adou: { idle: ['npc/adou_idle_0', 'npc/adou_idle_1'], h: 17 },
  bailu: { idle: ['npc/bailu_idle_0', 'npc/bailu_idle_1'], h: 22 },
};

interface Freed {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  dir: number;
  ground: number;
  flipped: boolean;
}

/**
 * 关卡里会动、会变的东西的精灵：方块（上弹）、道具、敌人（被打倒后变回原样跑走）、
 * NPC（转身、挥手、交谈提示）、检查点、铃门、风铃，以及跟着小满的回回。
 * 位置在两个逻辑步之间插值；所有状态都从 sim 读，这里只负责"怎么画"。
 */
export class EntityViews {
  private blocks = new Map<Block, Phaser.GameObjects.Image>();
  private items = new Map<number, Phaser.GameObjects.Image>();
  private enemies = new Map<number, Phaser.GameObjects.Image>();
  private npcs = new Map<string, Phaser.GameObjects.Image>();
  private prompt: Phaser.GameObjects.Image;
  private checkpoints: Phaser.GameObjects.Image[] = [];
  private gate: Phaser.GameObjects.Image | null = null;
  private chimeImgs: Phaser.GameObjects.Image[] = [];
  private chimeSprings: Spring[] = [];
  private freed: Freed[] = [];
  private huihui: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private hx = 0;
  private hy = 0;
  private huiShown = false;
  private huiMood: { face: string; t: number } | null = null;
  private time = 0;
  private glint = 0;
  private gateSwing = 0;
  private waved = new Set<string>();
  private waveT = new Map<string, number>();

  constructor(
    private scene: Phaser.Scene,
    private world: World,
    private particles: Particles,
  ) {
    for (const b of world.blocks.list) {
      this.blocks.set(
        b,
        scene.add
          .image(b.col * TILE, b.row * TILE, ATLAS, 'block/bell_0')
          .setOrigin(0, 0)
          .setDepth(2),
      );
    }
    for (const e of world.enemies) {
      this.enemies.set(
        e.id,
        scene.add.image(0, 0, ATLAS, this.enemyFrame(e, 0)).setOrigin(0.5, 1).setDepth(6),
      );
    }
    for (const n of world.npcs) {
      const f = NPC_FRAMES[n.id];
      if (!f) continue;
      this.npcs.set(
        n.id,
        scene.add
          .image(n.x, n.y, ATLAS, f.idle[0])
          .setOrigin(0.5, 1)
          .setDepth(5)
          .setFlipX(n.facing < 0),
      );
    }
    this.prompt = scene.add
      .image(0, 0, ATLAS, 'ui/prompt')
      .setOrigin(0.5, 1)
      .setDepth(14)
      .setVisible(false);
    for (const cp of world.checkpoints) {
      this.checkpoints.push(
        scene.add
          .image(cp.col * TILE + TILE / 2, (cp.row + 1) * TILE, ATLAS, 'deco/checkpoint_off')
          .setOrigin(6 / 22, 1)
          .setDepth(-3),
      );
    }
    const goal = world.level.markers.find((m) => m.kind === 'goal');
    if (goal) {
      this.gate = scene.add
        .image(goal.col * TILE + TILE / 2, (goal.row + 1) * TILE, ATLAS, 'deco/gate_0')
        .setOrigin(0.5, 1)
        .setDepth(-3);
    }
    const ch = world.chimes;
    if (ch) {
      scene.add.image(ch.x0, ch.y0, ATLAS, 'deco/chime_frame').setOrigin(0, 0).setDepth(-3);
      CHIME_LAYOUT.forEach((r, i) => {
        const img = scene.add
          .image(ch.x0 + r.x + r.w / 2, ch.y0 + 4, ATLAS, `deco/chime_${i}`)
          .setOrigin(0.5, 0)
          .setDepth(-2);
        this.chimeImgs.push(img);
        this.chimeSprings.push(new Spring(0, 55, 1.6));
      });
    }
    this.glow = scene.add.image(0, 0, ATLAS, 'npc/glow').setDepth(11).setAlpha(0).setBlendMode(1);
    this.huihui = scene.add.image(0, 0, ATLAS, 'npc/huihui_idle_0').setDepth(12).setVisible(false);
  }

  /** 回回在世界里的位置（提示气泡的锚点）；还没出现时返回 null */
  get huihuiPos(): { x: number; y: number } | null {
    return this.huiShown ? { x: this.hx, y: this.hy - 7 } : null;
  }

  npcTop(id: string): { x: number; y: number } | null {
    const n = this.world.npcs.find((q) => q.id === id);
    if (!n) return null;
    return { x: n.x, y: n.y - (NPC_FRAMES[id]?.h ?? 20) };
  }

  /** 让回回换个表情一会儿（开心、担心） */
  mood(face: 'happy' | 'worry', t = 0.8): void {
    this.huiMood = { face, t };
  }

  onEvents(events: readonly SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'enemyDefeat': {
          const img = this.enemies.get(e.id);
          img?.setVisible(false);
          const dir = Math.sign(e.x - this.world.player.body.centerX) || 1;
          const f = this.scene.add
            .image(e.x, e.y, ATLAS, e.cause === 'stomp' ? 'enemy/crab_squash' : 'enemy/free_blink')
            .setOrigin(0.5, 1)
            .setDepth(6)
            .setFlipX(dir < 0);
          this.freed.push({
            img: f,
            x: e.x,
            y: e.y,
            vx: 0,
            vy: e.cause === 'bump' ? -200 : 0,
            t: e.cause === 'stomp' ? 0 : 0.1,
            dir,
            ground: e.y,
            flipped: e.cause === 'bump',
          });
          if (this.huiShown) this.mood('happy', 0.6);
          break;
        }
        case 'enemyLost':
          this.enemies.get(e.id)?.setVisible(false);
          break;
        case 'chime': {
          const s = this.chimeSprings[e.index];
          if (s) s.velocity += 2.6 * (Math.random() < 0.5 ? 1 : -1);
          break;
        }
        case 'chimeSolved':
          for (const s of this.chimeSprings) s.velocity += 2;
          break;
        case 'clear':
          this.gateSwing = 2.2;
          if (this.huiShown) this.mood('happy', 3);
          break;
        case 'hurt':
          if (this.huiShown) this.mood('worry', 1);
          break;
      }
    }
  }

  private enemyFrame(e: Enemy, t: number): string {
    const pre = e.kind === 'blueClaw' ? 'blue' : 'crab';
    if (!e.active)
      return Math.floor(t * 0.7 + e.id) % 7 === 0 ? `enemy/${pre}_blink` : `enemy/${pre}_walk_0`;
    return `enemy/${pre}_walk_${Math.floor(e.walked / 3) % 4}`;
  }

  private itemFrame(it: Item): string {
    const t = this.time;
    switch (it.kind) {
      case 'shell': {
        const k = Math.floor(t * 12 + it.id * 5) % 24;
        return `item/shell_${k < 4 ? k : 0}`;
      }
      case 'bigShell':
        return `item/bigShell_${Math.floor(t * 2 + it.id) % 2}`;
      case 'mango':
        return 'item/mango';
      case 'sun':
        return `item/sun_${Math.floor(t * 8) % 4}`;
      case 'glass':
        return `item/glass_${GLASS_COLORS[Math.max(0, it.glass)] ?? 'aqua'}_${Math.floor(t * 3 + it.id) % 2}`;
    }
  }

  update(dt: number, alpha: number, camX: number): void {
    this.time += dt;
    const w = this.world;
    const p = w.player;
    // 方块
    for (const [b, img] of this.blocks) {
      if (b.broken || (b.kind === 'hidden' && !b.revealed)) {
        img.setVisible(false);
        continue;
      }
      img.setVisible(true);
      let frame: string;
      if (b.used) frame = 'block/used';
      else if (b.kind === 'brick') frame = 'block/brick';
      else {
        const seq = BELL_SEQ[Math.floor(this.time * 4 + b.col * 0.7) % BELL_SEQ.length]!;
        frame = `block/${b.kind === 'multi' ? 'multi' : 'bell'}_${seq}`;
      }
      img.setFrame(frame);
      const k = b.bump > 0 ? (BUMP_FRAMES - b.bump + alpha) / BUMP_FRAMES : 1;
      img.y = b.row * TILE - Math.round(Math.sin(Math.min(1, k) * Math.PI) * 4);
    }
    // 隐藏铃砖的位置偶尔闪一下微光（顺路但要留心）
    this.glint -= dt;
    if (this.glint <= 0) {
      this.glint = 2.8;
      for (const b of w.blocks.list) {
        if (b.kind !== 'hidden' || b.revealed) continue;
        const x = b.col * TILE + TILE / 2;
        if (x < camX - 16 || x > camX + 400) continue;
        this.particles.spawn({
          x: x + 3,
          y: b.row * TILE + 5,
          life: 0.45,
          frames: ['fx2/sparkle_0', 'fx2/sparkle_1', 'fx2/sparkle_0'],
        });
      }
    }
    // 道具
    const alive = new Set<number>();
    for (const it of w.items.list) {
      if (!it.alive) continue;
      alive.add(it.id);
      let img = this.items.get(it.id);
      if (!img) {
        img = this.scene.add.image(0, 0, ATLAS, this.itemFrame(it)).setOrigin(0.5, 1);
        this.items.set(it.id, img);
      }
      const b = it.body;
      const bob =
        !it.physical && it.kind !== 'shell' ? Math.round(Math.sin(this.time * 3 + it.id) * 1) : 0;
      img
        .setFrame(this.itemFrame(it))
        .setPosition(
          lerp(b.px + b.w / 2, b.centerX, alpha),
          lerp(b.py + b.h, b.bottom, alpha) + bob + 1,
        )
        .setDepth(it.emerge > 0 ? 1.5 : 3)
        .setAlpha(it.ghost ? 0.45 : 1);
    }
    for (const [id, img] of this.items) {
      if (!alive.has(id)) {
        img.destroy();
        this.items.delete(id);
      }
    }
    // 敌人
    for (const e of w.enemies) {
      const img = this.enemies.get(e.id)!;
      img.setVisible(e.alive);
      if (!e.alive) continue;
      const b = e.body;
      img
        .setFrame(this.enemyFrame(e, this.time))
        .setFlipX(e.facing < 0)
        .setPosition(lerp(b.px + b.w / 2, b.centerX, alpha), lerp(b.py + b.h, b.bottom, alpha));
    }
    this.updateFreed(dt);
    this.updateNpcs(dt);
    // 检查点
    w.checkpoints.forEach((cp, i) => {
      this.checkpoints[i]!.setFrame(
        cp.active ? `deco/checkpoint_on_${Math.floor(this.time * 5) % 2}` : 'deco/checkpoint_off',
      );
    });
    // 铃门：通关时铃铛左右摆
    if (this.gate) {
      if (this.gateSwing > 0) {
        this.gateSwing -= dt;
        this.gate.setFrame(`deco/gate_${[1, 0, 2, 0][Math.floor(this.time * 8) % 4]}`);
      } else this.gate.setFrame('deco/gate_0');
    }
    // 风铃：被碰到后像钟摆一样摆，平时随风轻轻晃
    this.chimeImgs.forEach((img, i) => {
      const s = this.chimeSprings[i]!;
      s.target = Math.sin(this.time * 1.3 + i) * 0.05;
      img.setRotation(s.update(dt));
    });
    this.updateHuihui(dt, p.body.centerX, p.body.y, p.facing);
  }

  private updateFreed(dt: number): void {
    this.freed = this.freed.filter((f) => {
      f.t += dt;
      if (f.t < 0.12) return true;
      if (f.t < 0.4) {
        // 恢复原色，眨眨眼
        f.img.setFrame(Math.floor(f.t * 12) % 3 === 0 ? 'enemy/free_blink' : 'enemy/free_0');
        if (f.flipped) {
          f.vy += 900 * dt;
          f.y = Math.min(f.ground, f.y + f.vy * dt);
          f.img.setFlipY(f.vy < 0);
        }
        f.img.setPosition(f.x, f.y);
        return true;
      }
      // 蹦蹦跳跳地跑开
      f.img.setFlipY(false);
      if (f.vx === 0) {
        f.vx = f.dir * 85;
        f.vy = -110;
      }
      f.vy += 650 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y >= f.ground) {
        f.y = f.ground;
        f.vy = -90;
      }
      f.img
        .setFrame(Math.floor(f.t * 10) % 2 ? 'enemy/free_1' : 'enemy/free_0')
        .setPosition(Math.round(f.x), Math.round(f.y));
      if (f.t > 0.9) f.img.setAlpha(Math.max(0, 1 - (f.t - 0.9) / 0.5));
      if (f.t > 1.4) {
        f.img.destroy();
        return false;
      }
      return true;
    });
  }

  private updateNpcs(dt: number): void {
    const p = this.world.player;
    for (const n of this.world.npcs) {
      const img = this.npcs.get(n.id);
      if (!img) continue;
      const near = Math.abs(p.body.centerX - n.x) < 72;
      if (near) img.setFlipX(p.body.centerX < n.x);
      let frame = NPC_FRAMES[n.id]!.idle[Math.floor(this.time * 1.6 + n.x) % 2]!;
      // 海婶第一次看到小满会挥挥手；阿豆在风铃解开后欢呼
      if (n.id === 'haishen') {
        if (near && !this.waved.has(n.id)) {
          this.waved.add(n.id);
          this.waveT.set(n.id, 1.6);
        }
        const t = this.waveT.get(n.id) ?? 0;
        if (t > 0) {
          this.waveT.set(n.id, t - dt);
          frame = `npc/haishen_wave_${Math.floor(this.time * 5) % 2}`;
        }
      } else if (n.id === 'adou' && this.world.flags.has('chimesSolved')) {
        frame = `npc/adou_cheer_${Math.floor(this.time * 4) % 2}`;
      } else if (
        n.id === 'bailu' &&
        Math.floor(this.time * 0.8 + 3) % 5 === 0 &&
        this.time % 1.25 < 0.15
      ) {
        frame = 'npc/bailu_blink';
      }
      img.setFrame(frame);
    }
    const t: Npc | null = this.world.talkTarget;
    if (t) {
      const h = NPC_FRAMES[t.id]?.h ?? 20;
      this.prompt
        .setVisible(true)
        .setPosition(t.x, t.y - h - 3 - Math.round(Math.abs(Math.sin(this.time * 5)) * 3));
    } else this.prompt.setVisible(false);
  }

  private updateHuihui(dt: number, px: number, py: number, facing: number): void {
    const show = this.world.flags.has('huihui');
    if (show && !this.huiShown) {
      this.huiShown = true;
      this.hx = px;
      this.hy = py - 20;
      this.huihui.setVisible(true).setScale(0);
      this.scene.tweens.add({ targets: this.huihui, scale: 1, duration: 300, ease: 'Back.Out' });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.particles.spawn({
          x: this.hx,
          y: this.hy,
          vx: Math.cos(a) * 60,
          vy: Math.sin(a) * 60,
          drag: 4,
          life: 0.4,
          frames: ['fx2/sparkle_2', 'fx2/sparkle_1', 'fx2/sparkle_0'],
        });
      }
    }
    if (!this.huiShown) return;
    // 飘在小满身后上方，慢慢跟过去，上下浮动
    const tx = px - facing * 15;
    const ty = py - 10 + Math.sin(this.time * 2.6) * 2.5;
    const k = 1 - Math.exp(-dt * 5);
    this.hx += (tx - this.hx) * k;
    this.hy += (ty - this.hy) * k;
    let face = Math.floor(this.time * 2) % 2 ? 'idle_1' : 'idle_0';
    if (this.time % 3.1 < 0.12) face = 'blink';
    if (this.huiMood) {
      face = this.huiMood.face;
      this.huiMood.t -= dt;
      if (this.huiMood.t <= 0) this.huiMood = null;
    }
    this.huihui
      .setFrame(`npc/huihui_${face}`)
      .setPosition(Math.round(this.hx), Math.round(this.hy))
      .setFlipX(facing < 0);
    this.glow
      .setPosition(Math.round(this.hx), Math.round(this.hy))
      .setAlpha(0.28 + Math.sin(this.time * 3) * 0.08);
  }
}
