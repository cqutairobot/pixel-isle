import { BlockSet } from './blocks';
import { rectsOverlap, type Rect } from './body';
import { SimCamera } from './camera';
import { Chimes } from './chimes';
import { TILE } from './constants';
import { Enemy, type EnemyContext } from './enemies';
import type { RespawnCause, SimEvent, DefeatCause } from './events';
import { BTN, EMPTY_INPUT, isPressed, type InputFrame } from './input';
import { ItemSet, type Item } from './items';
import { standAt, type BlockKind, type EnemyKind, type ItemKind, type ParsedLevel } from './level';
import { Player, type PlayerEnv } from './player';
import { Props } from './props';
import { Starfish, type StarfishBump } from './starfish';
import { derive, RULES, type Derived, type Tuning } from './tuning';

export interface WorldOptions {
  autoRun: boolean;
  /** 辅助模式：心上限 +2 */
  assist?: boolean;
  /** 以前已经找到的海玻璃（再玩时半透明显示，不重复计数） */
  foundGlass?: readonly boolean[];
  /** 一开始就有的剧情标记（例如已经拿到的装备 starfish） */
  flags?: readonly string[];
}

/** 练习场里掉出地图后，过多少帧回到安全地面 */
export const RESPAWN_FRAMES = 30;

export type WorldState = 'play' | 'dying' | 'clear';

export interface Npc {
  id: string;
  /** 脚底中心（px） */
  x: number;
  y: number;
  facing: 1 | -1;
}

export interface Trigger {
  id: string;
  rect: Rect;
  blocking: boolean;
  fired: boolean;
}

export interface Checkpoint {
  index: number;
  col: number;
  row: number;
  active: boolean;
}

/** 过场或对话结束后世界要变成的样子（播完和跳过都用它，保证结果一致） */
export interface EndState {
  /** 主角站到第 col 列、第 row 行 */
  player?: [number, number];
  facing?: 1 | -1;
  flags?: string[];
}

export interface Stats {
  /** 用时（逻辑帧） */
  frames: number;
  shells: number;
  glass: boolean[];
  damaged: boolean;
  deaths: number;
}

/** 交谈的范围：脚底中心水平距离 */
const TALK_RANGE = 18;

/**
 * 把关卡、主角、敌人、方块、道具、镜头组合起来；每次 step 前进一个逻辑帧（1/60 秒）。
 * 规则见 docs/levels/1-1.md §3 与 PLAN.md §5。
 */
export class World implements PlayerEnv {
  readonly player: Player;
  readonly camera: SimCamera;
  readonly events: SimEvent[] = [];
  readonly blocks: BlockSet;
  readonly items: ItemSet;
  readonly enemies: Enemy[] = [];
  readonly npcs: Npc[] = [];
  readonly triggers: Trigger[] = [];
  readonly checkpoints: Checkpoint[] = [];
  readonly chimes: Chimes | null = null;
  /** 回旋海星（拥有它时 flags 里有 starfish） */
  readonly starfish = new Starfish();
  /** 椰子树和掉下来的椰子 */
  readonly props = new Props();
  /** 终点铃门的判定区 */
  readonly goal: Rect | null = null;
  frame = 0;
  derived: Derived;
  state: WorldState = 'play';
  /** 掉坑、落水后的等待帧数；大于 0 时主角不受控制 */
  respawnTimer = 0;
  respawnCause: RespawnCause = 'pit';
  dyingTimer = 0;
  /** 停顿帧数（踩踏、受击时画面定格一下） */
  hitstop = 0;
  hearts: number;
  maxHearts: number;
  /** 受击或复活后的无敌帧 */
  iframes = 0;
  /** 受击硬直：不能操作 */
  stun = 0;
  /** 刚踩中敌人后的保护帧 */
  grace = 0;
  /** 太阳果剩余帧数 */
  sunTimer = 0;
  /** 连踩计数（落地清零） */
  combo = 0;
  private shellChain = 0;
  private shellChainTimer = 0;
  /** 停顿期间按下的键，停顿结束后补上，不会丢 */
  private heldPressed = 0;
  checkpointIndex = 0;
  respawnPoint: { x: number; y: number };
  readonly stats: Stats = {
    frames: 0,
    shells: 0,
    glass: [false, false, false],
    damaged: false,
    deaths: 0,
  };
  readonly flags = new Set<string>();
  /** 等表现层处理的阻塞触发（过场）或交谈；处理完之前世界不前进 */
  pendingTrigger: string | null = null;
  pendingTalk: string | null = null;
  /** 当前可以交谈的 NPC（表现层据此显示"↑"提示） */
  talkTarget: Npc | null = null;
  private foundGlass: readonly boolean[];

  constructor(
    readonly level: ParsedLevel,
    public tuning: Tuning,
    public options: WorldOptions,
    viewW: number,
    viewH: number,
  ) {
    this.derived = derive(tuning);
    this.player = new Player(level.spawn.x, level.spawn.y);
    this.respawnPoint = { ...level.spawn };
    this.camera = new SimCamera(viewW, viewH, level.grid.widthPx, level.grid.heightPx);
    this.maxHearts = options.assist ? RULES.assistHearts : RULES.hearts;
    this.hearts = this.maxHearts;
    this.foundGlass = options.foundGlass ?? [];
    this.blocks = new BlockSet(level.grid);
    this.items = new ItemSet(level.grid);
    for (const f of [...level.flags, ...(options.flags ?? [])]) this.flags.add(f);
    this.build();
    this.settle();
    this.camera.snap(this.player);
  }

  /** 按标记和实体表放好方块、道具、敌人、NPC、检查点、终点、触发区、风铃 */
  private build(): void {
    const level = this.level;
    const glassAt = new Map<string, number>();
    for (const e of level.entities)
      if (e.type === 'glass') glassAt.set(`${e.at[0]},${e.at[1]}`, e.index);
    let autoGlass = 0;
    const nextGlass = (c: number, r: number) => glassAt.get(`${c},${r}`) ?? autoGlass++;
    let enemyId = 1;
    const cps: Array<{ col: number; row: number }> = [];
    for (const m of level.markers) {
      const kind = String(m.data?.kind ?? '');
      switch (m.kind) {
        case 'block': {
          const item = (String(m.data?.item ?? '') || null) as ItemKind | null;
          const g = glassAt.get(`${m.col},${m.row}`);
          if (g !== undefined) this.blocks.add(m.col, m.row, kind as BlockKind, 'glass', g);
          else this.blocks.add(m.col, m.row, kind as BlockKind, item);
          break;
        }
        case 'item': {
          const k = kind as ItemKind;
          const g = k === 'glass' ? nextGlass(m.col, m.row) : -1;
          this.items.place(k, m.col, m.row, g, g >= 0 && !!this.foundGlass[g]);
          break;
        }
        case 'enemy':
          this.enemies.push(
            new Enemy(enemyId++, kind as EnemyKind, m.col, m.row, m.data?.still === 1),
          );
          break;
        case 'checkpoint':
          cps.push({ col: m.col, row: m.row });
          break;
        case 'goal':
          (this as { goal: Rect | null }).goal = {
            x: m.col * TILE + TILE / 2 - 4,
            y: (m.row - 3) * TILE,
            w: 8 + TILE,
            h: TILE * 4,
          };
          break;
      }
    }
    cps.sort((a, b) => a.col - b.col);
    cps.forEach((c, i) =>
      this.checkpoints.push({ index: i + 1, col: c.col, row: c.row, active: false }),
    );
    for (const e of level.entities) {
      if (e.type === 'npc') {
        this.npcs.push({
          id: e.id,
          x: e.at[0] * TILE + TILE / 2,
          y: e.at[1] * TILE + TILE,
          facing: e.facing ?? -1,
        });
      } else if (e.type === 'trigger') {
        const [c, r, w, h] = e.rect;
        this.triggers.push({
          id: e.id,
          rect: { x: c * TILE, y: r * TILE, w: w * TILE, h: h * TILE },
          blocking: e.blocking ?? true,
          // 已经有这个剧情标记了（比如拿到过海星）：这段过场不再播放
          fired: !!e.unless && this.flags.has(e.unless),
        });
      } else if (e.type === 'chimes') {
        (this as { chimes: Chimes | null }).chimes = new Chimes(e.at[0], e.at[1], e.glass);
      } else if (e.type === 'coconutTree') {
        this.props.addTree(e.at[0], e.at[1], e.coconuts ?? 2, !!e.mango);
      }
    }
  }

  get grid() {
    return this.level.grid;
  }

  get autoRun(): boolean {
    return this.options.autoRun;
  }

  /** 拥有的装备（现在只有回旋海星） */
  get equipment(): string[] {
    return this.flags.has('starfish') ? ['starfish'] : [];
  }

  /** 太阳果期间走速、跑速变快 */
  get speedMul(): number {
    return this.sunTimer > 0 ? RULES.sunSpeedMul : 1;
  }

  /** 世界在等过场或对话 */
  get waiting(): boolean {
    return this.pendingTrigger !== null || this.pendingTalk !== null;
  }

  emit(e: SimEvent): void {
    this.events.push(e);
  }

  setTuning(t: Tuning): void {
    this.tuning = t;
    this.derived = derive(t);
  }

  /** 把主角传送到 (x, y) 并让镜头立即对准 */
  teleport(x: number, y: number): void {
    this.player.reset(x, y);
    this.respawnTimer = 0;
    this.settle();
    this.camera.snap(this.player);
  }

  /** 过场或阻塞触发处理完后调用 */
  resolveTrigger(end: EndState = {}): void {
    this.pendingTrigger = null;
    this.applyEnd(end);
  }

  /** 对话结束后调用 */
  resolveTalk(end: EndState = {}): void {
    this.pendingTalk = null;
    this.applyEnd(end);
  }

  private applyEnd(end: EndState): void {
    if (end.player) {
      const p = standAt(end.player[0], end.player[1]);
      this.teleport(p.x, p.y);
    }
    if (end.facing) this.player.facing = end.facing;
    for (const f of end.flags ?? []) this.flags.add(f);
  }

  step(input: InputFrame): void {
    this.events.length = 0;
    if (this.waiting) return;
    this.player.body.snapshot();
    for (const e of this.enemies) e.body.snapshot();
    if (this.hitstop > 0) {
      this.hitstop--;
      this.heldPressed |= input.pressed;
      this.stats.frames++;
      this.frame++;
      return;
    }
    if (this.heldPressed) {
      input = { ...input, pressed: input.pressed | this.heldPressed };
      this.heldPressed = 0;
    }
    if (this.state === 'dying') this.stepDying();
    else if (this.state === 'clear') this.stepClear();
    else this.stepPlay(input);
    this.frame++;
  }

  private stepPlay(input: InputFrame): void {
    const p = this.player;
    this.stats.frames++;
    if (this.respawnTimer > 0) {
      this.respawnTimer--;
      if (this.respawnTimer === 0) this.respawnAtSafe();
      return;
    }
    const ctrl = this.stun > 0 ? EMPTY_INPUT : input;
    if (this.stun > 0) this.stun--;
    p.step(ctrl, this);

    this.updateTalk(ctrl);
    if (isPressed(ctrl, BTN.attack)) this.useEquipment(ctrl);
    if (isPressed(ctrl, BTN.special))
      this.emit({ type: 'equipSwitch', count: this.equipment.length });
    if (p.headHit) this.hitBlockAbove();
    this.blocks.step();
    for (const lost of this.items.step()) {
      if (lost.water) {
        const b = lost.item.body;
        this.emit({
          type: 'splash',
          x: b.centerX,
          y: this.waterSurface(b.centerX, b.bottom),
          big: false,
        });
      }
    }
    this.collectItems();
    this.stepEnemies();
    this.stepStarfish();
    this.stepProps();
    this.resolveCombat(input);
    if (this.state !== 'play') return;
    this.checkHazards();
    if (this.respawnTimer > 0 || this.state !== 'play') return;
    this.updateCheckpoints();
    this.updateChimes();
    this.updateTriggers();
    this.updateGoal();
    this.tickTimers();
    if (p.onGround) this.combo = 0;
    this.camera.step(p, this.tuning);
  }

  private stepDying(): void {
    this.stats.frames++;
    this.dyingTimer--;
    if (this.dyingTimer <= 0) this.respawnAtCheckpoint();
  }

  private stepClear(): void {
    // 通关后主角不再受控制，自然减速落地；镜头继续跟着
    this.player.step(EMPTY_INPUT, this);
    this.items.step();
    this.camera.step(this.player, this.tuning);
  }

  // —— 交谈 ——

  private updateTalk(input: InputFrame): void {
    const p = this.player;
    const b = p.body;
    let best: Npc | null = null;
    let bestD = Infinity;
    if (p.onGround && this.stun === 0) {
      for (const n of this.npcs) {
        const d = Math.abs(n.x - b.centerX);
        if (d <= TALK_RANGE && Math.abs(n.y - b.bottom) <= 8 && d < bestD) {
          best = n;
          bestD = d;
        }
      }
    }
    this.talkTarget = best;
    if (best && isPressed(input, BTN.up)) {
      this.pendingTalk = best.id;
      this.emit({ type: 'talk', id: best.id });
    }
  }

  // —— 方块与道具 ——

  /** 主角头顶撞到东西：只顶主角中心所在列的那块（那列不是砖时再看另一列） */
  private hitBlockAbove(): void {
    const b = this.player.body;
    const row = Math.floor((b.y - 1) / TILE);
    const center = Math.floor(b.centerX / TILE);
    const c0 = Math.floor(b.x / TILE);
    const c1 = Math.floor((b.x + b.w - 1) / TILE);
    const other = center === c0 ? c1 : c0;
    const col = this.blocks.at(center, row) ? center : this.blocks.at(other, row) ? other : -1;
    if (col >= 0) this.hitBlockAt(col, row, 0);
  }

  /**
   * 打 (col, row) 这块砖：dir = 0 是小满从下面顶；±1 是海星从侧面打（往那个方向飞）。
   * 海星打出来的道具直接挂到海星上带回来。
   */
  private hitBlockAt(col: number, row: number, dir: number, byStarfish = false): void {
    const block = this.blocks.at(col, row);
    if (!block) return;
    const wasHidden = block.kind === 'hidden' && !block.revealed;
    const res = this.blocks.hit(col, row, dir);
    if (!res) return;
    if (res.empty) {
      this.emit({ type: 'blockEmpty', col, row });
      return;
    }
    if (wasHidden) this.emit({ type: 'blockReveal', col, row });
    if (res.broke) {
      this.emit({ type: 'blockBreak', col, row });
      this.hitstop = Math.max(this.hitstop, RULES.brickHitstop);
    } else {
      this.emit({
        type: 'blockHit',
        col,
        row,
        kind: res.block.kind,
        item: res.item,
        used: res.block.used,
      });
    }
    if (res.bumped) this.bumpAbove(col, row);
    if (res.item === 'shell') {
      this.addShells(1, 'shell', col * TILE + TILE / 2, row * TILE, true);
    } else if (res.item) {
      const g = res.item === 'glass' ? res.block.glass : -1;
      const ghost = g >= 0 && !!this.foundGlass[g];
      if (byStarfish) {
        const it = this.items.popAt(
          res.item,
          col * TILE + TILE / 2,
          row * TILE + 12,
          0,
          0,
          g,
          ghost,
        );
        this.emit({
          type: 'itemSpawn',
          id: it.id,
          kind: it.kind,
          x: it.body.centerX,
          y: row * TILE,
        });
        this.grab(it);
      } else {
        const it = this.items.emergeFrom(res.item, col, row, this.player.facing, g, ghost);
        this.emit({
          type: 'itemSpawn',
          id: it.id,
          kind: it.kind,
          x: it.body.centerX,
          y: row * TILE,
        });
      }
    }
  }

  /** 砖被顶起：砖顶上的敌人被顶飞，贝壳被顶出来收下，其他道具被弹起来 */
  private bumpAbove(col: number, row: number): void {
    const top = row * TILE;
    for (const e of this.enemies) {
      if (!e.alive || !e.active) continue;
      const eb = e.body;
      if (e.onGround && eb.bottom === top && eb.x < (col + 1) * TILE && eb.right > col * TILE) {
        this.defeat(e, 'bump', 1);
      }
    }
    for (const it of this.items.onTopOf(col, row)) {
      if (it.kind === 'shell' || it.kind === 'bigShell') {
        this.collect(it);
      } else {
        it.physical = true;
        it.onGround = false;
        it.vy = -150;
      }
    }
  }

  private collectItems(): void {
    const h = this.player.hurtbox();
    for (const it of this.items.touching({ x: h.x - 2, y: h.y - 2, w: h.w + 4, h: h.h + 4 }))
      this.collect(it);
  }

  private collect(it: Item): void {
    it.alive = false;
    const b = it.body;
    const x = b.centerX;
    const y = b.centerY;
    switch (it.kind) {
      case 'shell':
        this.addShells(1, 'shell', x, y);
        break;
      case 'bigShell':
        this.addShells(RULES.bigShellValue, 'bigShell', x, y);
        break;
      case 'mango':
        if (this.hearts < this.maxHearts) {
          this.hearts++;
          this.emit({ type: 'collect', kind: 'mango', x, y, shells: 0, chain: 0 });
          this.emit({ type: 'heal', hearts: this.hearts });
        } else {
          this.addShells(RULES.mangoFullShells, 'mango', x, y);
        }
        break;
      case 'sun':
        if (this.sunTimer === 0) this.emit({ type: 'sun', on: true });
        this.sunTimer = RULES.sunFrames;
        this.emit({ type: 'collect', kind: 'sun', x, y, shells: 0, chain: 0 });
        break;
      case 'glass':
        if (!it.ghost && it.glass >= 0) this.stats.glass[it.glass] = true;
        this.emit({
          type: 'collect',
          kind: 'glass',
          x,
          y,
          shells: 0,
          chain: 0,
          glass: it.glass,
          ghost: it.ghost,
        });
        break;
    }
  }

  private addShells(n: number, kind: ItemKind, x: number, y: number, fromBlock = false): void {
    this.stats.shells += n;
    this.shellChain = this.shellChainTimer > 0 ? this.shellChain + 1 : 0;
    this.shellChainTimer = RULES.shellChainFrames;
    this.emit({ type: 'collect', kind, x, y, shells: n, chain: this.shellChain, fromBlock });
  }

  // —— 装备：回旋海星 ——

  private useEquipment(input: InputFrame): void {
    if (!this.flags.has('starfish')) return;
    const s = this.starfish;
    const p = this.player;
    const b = p.body;
    if (s.out || s.cooldown > 0) {
      this.emit({ type: 'starfishDud', x: b.centerX, y: b.centerY });
      return;
    }
    // 按住 ↑：斜着往上 45°
    const up = (input.held & BTN.up) !== 0;
    const dirX = up ? p.facing * Math.SQRT1_2 : p.facing;
    const dirY = up ? -Math.SQRT1_2 : 0;
    const x = b.centerX + p.facing * 4;
    const y = b.y + 5;
    s.throw(x, y, dirX, dirY);
    this.emit({ type: 'throw', x, y, dirX, dirY });
  }

  private stepStarfish(): void {
    const s = this.starfish;
    if (!s.out) {
      if (s.cooldown > 0) s.cooldown--;
      return;
    }
    const b = s.body;
    b.snapshot();
    const pb = this.player.body;
    if (s.state === 'out') {
      const bump = s.stepOut(this.grid);
      if (bump) {
        this.starfishHitBlocks(bump);
        this.emit({ type: 'starfishBounce', x: b.centerX, y: b.centerY });
      }
    } else if (s.stepBack(pb.centerX, pb.centerY)) {
      this.catchStarfish();
      return;
    }
    const r = { x: b.x, y: b.y, w: b.w, h: b.h };
    // 去程、回程都能打中敌人；穿透，同一只只算一次
    for (const e of this.enemies) {
      if (!e.alive || !e.active || s.hitIds.has(e.id)) continue;
      const h = e.hurtRect();
      if (!rectsOverlap(r.x, r.y, r.w, r.h, h)) continue;
      s.hitIds.add(e.id);
      this.emit({ type: 'starfishHit', id: e.id, x: h.x + h.w / 2, y: h.y + h.h / 2 });
      this.defeat(e, 'starfish', 1);
      this.hitstop = Math.max(this.hitstop, RULES.starfishHitstop);
    }
    // 捞道具：挂在海星上一起回来
    for (const it of this.items.touching(r)) this.grab(it);
    // 打椰子树的树冠：掉一个椰子
    for (const t of this.props.trees) {
      if (s.treeIds.has(t.id) || !rectsOverlap(r.x, r.y, r.w, r.h, t.crown)) continue;
      s.treeIds.add(t.id);
      const c = this.props.hitTree(t, Math.sign(s.dirX) || 1);
      this.emit({
        type: 'treeHit',
        id: t.id,
        x: t.crown.x + t.crown.w / 2,
        y: t.crown.y + t.crown.h / 2,
        empty: !c,
      });
      if (c) this.emit({ type: 'coconutDrop', id: c.id, x: c.body.centerX, y: c.body.centerY });
    }
    this.moveCarried();
  }

  /** 挂着的道具跟着海星（只改坐标，保留插值用的上一步位置） */
  private moveCarried(): void {
    const b = this.starfish.body;
    for (const it of this.starfish.carried) {
      it.body.x = Math.round(b.centerX - it.body.w / 2);
      it.body.y = Math.round(b.centerY - it.body.h / 2);
    }
  }

  private grab(it: Item): void {
    it.carried = true;
    it.physical = false;
    it.emerge = 0;
    it.delay = 0;
    this.starfish.carried.push(it);
    this.emit({ type: 'starfishGrab', id: it.id, x: it.body.centerX, y: it.body.centerY });
  }

  /** 去程撞到墙：如果撞到的是砖，就从侧面（或从下面）打它；只打正对着的那一块 */
  private starfishHitBlocks(bump: StarfishBump): void {
    const b = this.starfish.body;
    const cells: Array<[number, number]> = [];
    if (bump.dx !== 0) {
      const col = Math.floor((bump.dx > 0 ? b.right : b.x - 1) / TILE);
      const mid = Math.floor(b.centerY / TILE);
      cells.push([col, mid]);
      for (let row = Math.floor(b.y / TILE); row <= Math.floor((b.bottom - 1) / TILE); row++)
        if (row !== mid) cells.push([col, row]);
    } else if (bump.dy < 0) {
      const row = Math.floor((b.y - 1) / TILE);
      const mid = Math.floor(b.centerX / TILE);
      cells.push([mid, row]);
      for (let col = Math.floor(b.x / TILE); col <= Math.floor((b.right - 1) / TILE); col++)
        if (col !== mid) cells.push([col, row]);
    }
    for (const [col, row] of cells) {
      if (!this.blocks.at(col, row)) continue;
      this.hitBlockAt(col, row, bump.dx, true);
      return;
    }
  }

  private catchStarfish(): void {
    const s = this.starfish;
    const b = this.player.body;
    const n = s.carried.length;
    for (const it of s.carried.splice(0)) {
      it.carried = false;
      this.collect(it);
    }
    s.stow();
    this.emit({ type: 'starfishCatch', x: b.centerX, y: b.centerY, carried: n });
  }

  /** 掉海、倒下复活时海星直接回到手里（挂着的道具也算拿到） */
  private recallStarfish(): void {
    const s = this.starfish;
    if (!s.out) return;
    for (const it of s.carried.splice(0)) {
      it.carried = false;
      this.collect(it);
    }
    s.stow();
  }

  // —— 椰子 ——

  private stepProps(): void {
    for (const cue of this.props.step(this.grid)) {
      const c = cue.coconut;
      const b = c.body;
      if (cue.kind === 'bounce') {
        this.emit({ type: 'coconutBounce', id: c.id, x: b.centerX, y: b.bottom });
      } else if (cue.kind === 'break') {
        this.emit({ type: 'coconutBreak', id: c.id, x: b.centerX, y: b.bottom });
        if (c.contents === 'mango') {
          const it = this.items.popAt('mango', b.centerX, b.bottom, 0, -130);
          this.emit({ type: 'itemSpawn', id: it.id, kind: 'mango', x: b.centerX, y: b.bottom });
        } else {
          for (let i = 0; i < 3; i++) {
            const it = this.items.popAt('shell', b.centerX, b.bottom, (i - 1) * 45, -150 - i * 12);
            this.emit({ type: 'itemSpawn', id: it.id, kind: 'shell', x: b.centerX, y: b.bottom });
          }
        }
      }
    }
    // 滚动、下落中的椰子能砸倒敌人
    for (const c of this.props.coconuts) {
      if (!c.alive) continue;
      for (const e of this.enemies) {
        if (e.alive && e.active && c.body.overlaps(e.hurtRect())) this.defeat(e, 'coconut', 1);
      }
    }
  }

  // —— 敌人与战斗 ——

  private stepEnemies(): void {
    const cam = this.camera;
    const margin = RULES.activateMargin;
    const pb = this.player.body;
    const ctx: EnemyContext = {
      px: pb.centerX,
      pTop: pb.y,
      pBottom: pb.bottom,
      camX: cam.x,
      camY: cam.y,
      viewW: cam.viewW,
      viewH: cam.viewH,
    };
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (!e.active) {
        const b = e.body;
        if (
          b.right > cam.x - margin &&
          b.x < cam.x + cam.viewW + margin &&
          b.bottom > cam.y - margin * 2 &&
          b.y < cam.y + cam.viewH + margin * 2
        ) {
          e.active = true;
          this.emit({ type: 'enemyActivate', id: e.id, kind: e.kind, x: b.centerX, y: b.bottom });
        } else continue;
      }
      const fate = e.step(this.grid, ctx);
      const eb = e.body;
      switch (e.cue) {
        case 'shake':
          this.emit({ type: 'urchinShake', id: e.id, x: eb.centerX, y: eb.bottom });
          break;
        case 'fall':
          this.emit({ type: 'urchinFall', id: e.id, x: eb.centerX, y: eb.bottom });
          break;
        case 'land':
          this.emit({ type: 'urchinLand', id: e.id, x: eb.centerX, y: eb.bottom });
          break;
        case 'alert':
          this.emit({ type: 'gullAlert', id: e.id, x: eb.centerX, y: eb.y });
          break;
        case 'dive':
          this.emit({ type: 'gullDive', id: e.id, x: eb.centerX, y: eb.centerY });
          break;
      }
      if (fate) {
        e.alive = false;
        const b = e.body;
        this.emit({
          type: 'enemyLost',
          id: e.id,
          kind: e.kind,
          x: b.centerX,
          y: b.bottom,
          water: fate === 'water',
        });
        if (fate === 'water')
          this.emit({
            type: 'splash',
            x: b.centerX,
            y: this.waterSurface(b.centerX, b.bottom),
            big: false,
          });
      }
    }
    // 走路的敌人互相碰到时，正朝对方走的那只回头
    const list = this.enemies.filter((e) => e.alive && e.active && e.mode === 'walk');
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const c = list[j]!;
        if (!a.body.overlaps(c.body)) continue;
        if (a.facing === Math.sign(c.body.centerX - a.body.centerX)) a.turn();
        if (c.facing === Math.sign(a.body.centerX - c.body.centerX)) c.turn();
      }
    }
  }

  private resolveCombat(input: InputFrame): void {
    const p = this.player;
    const pb = p.body;
    // 同一步落在两只敌人身上时两只都算踩中，所以先记下"是否在下落"
    const falling = p.vy > 0;
    let stomped = false;
    let stompTop = Infinity;
    let spiked: Enemy | null = null;
    for (const e of this.enemies) {
      if (!e.alive || !e.active) continue;
      const r = e.hurtRect();
      if (this.sunTimer > 0) {
        if (pb.overlaps(r)) this.defeat(e, 'sun', 1);
        continue;
      }
      // 踩踏：正在下落，上一步脚底不低于敌人的上半部；踩踏判定左右各宽 2px
      const stompRect = { x: r.x - 2, y: r.y, w: r.w + 4, h: r.h };
      if (falling && pb.overlaps(stompRect) && p.prevBottom <= r.y + r.h / 2) {
        // 浑身是刺的不能踩：踩上去会受伤
        if (e.spec.spiky) {
          spiked = e;
          continue;
        }
        stomped = true;
        stompTop = Math.min(stompTop, r.y);
        this.combo++;
        this.defeat(e, 'stomp', Math.min(this.combo, RULES.stompComboMax));
      }
    }
    if (stomped) {
      // 弹起从敌人头顶开始：下落太快、脚已经陷进敌人身体时，先把脚放回敌人头顶
      const lift = pb.bottom - stompTop;
      if (lift > 0 && !this.grid.solidAt(pb.x, pb.y - lift, pb.w, pb.h)) {
        pb.y -= lift;
        pb.ry = 0;
      }
      const held = (input.held & BTN.jump) !== 0;
      p.bounce(held ? RULES.stompBounceHeld : RULES.stompBounce, held);
      this.grace = RULES.stompGraceFrames;
      this.hitstop = Math.max(this.hitstop, RULES.stompHitstop);
      this.emit({ type: 'stomp', x: pb.centerX, y: pb.bottom, combo: this.combo, held });
      return;
    }
    if (this.grace > 0 || this.iframes > 0 || this.sunTimer > 0) return;
    if (spiked) {
      this.damage(spiked.body.centerX, true);
      return;
    }
    const h = p.hurtbox();
    for (const e of this.enemies) {
      if (!e.alive || !e.active) continue;
      if (rectsOverlap(h.x, h.y, h.w, h.h, e.hurtRect())) {
        this.damage(e.body.centerX);
        return;
      }
    }
  }

  private defeat(e: Enemy, cause: DefeatCause, reward: number): void {
    e.alive = false;
    const b = e.body;
    this.stats.shells += reward;
    this.emit({
      type: 'enemyDefeat',
      id: e.id,
      kind: e.kind,
      x: b.centerX,
      y: b.bottom,
      cause,
      reward,
      facing: e.facing,
    });
  }

  /** 被敌人碰到：扣 1 心、停顿、击退、硬直、无敌；spike 是踩到了刺海胆 */
  private damage(fromX: number, spike = false): void {
    const p = this.player;
    if (this.level.practice) return;
    this.hearts--;
    this.stats.damaged = true;
    this.combo = 0;
    const dir = Math.sign(p.body.centerX - fromX) || -p.facing;
    this.emit({
      type: 'hurt',
      x: p.body.centerX,
      y: p.body.centerY,
      hearts: this.hearts,
      dir,
      spike,
    });
    if (this.hearts <= 0) {
      this.die();
      return;
    }
    this.hitstop = Math.max(this.hitstop, RULES.hurtHitstop);
    p.bounce(RULES.knockbackY, false);
    p.vx = dir * RULES.knockbackX;
    this.stun = RULES.hurtStunFrames;
    this.iframes = RULES.hurtIframes;
  }

  private die(): void {
    const p = this.player;
    this.state = 'dying';
    this.dyingTimer = RULES.deathFrames;
    this.stats.deaths++;
    this.respawnTimer = 0;
    if (this.sunTimer > 0) {
      this.sunTimer = 0;
      this.emit({ type: 'sun', on: false });
    }
    this.emit({ type: 'death', x: p.body.centerX, y: p.body.bottom });
  }

  /** 心归零：回到检查点，满心复活；没打倒的敌人回到原位 */
  private respawnAtCheckpoint(): void {
    const p = this.player;
    this.recallStarfish();
    p.reset(this.respawnPoint.x, this.respawnPoint.y);
    p.facing = 1;
    this.hearts = this.maxHearts;
    this.iframes = RULES.respawnIframes;
    this.stun = 0;
    this.grace = 0;
    this.combo = 0;
    for (const e of this.enemies) if (e.alive) e.reset();
    this.state = 'play';
    this.settle();
    this.camera.snap(p);
    this.emit({ type: 'respawn', x: p.body.centerX, y: p.body.bottom, cause: 'death' });
    this.emit({ type: 'heal', hearts: this.hearts });
  }

  // —— 掉海、掉坑 ——

  private checkHazards(): void {
    const p = this.player;
    const b = p.body;
    if (this.grid.waterAt(b.centerX, b.bottom - 4)) {
      this.emit({
        type: 'splash',
        x: b.centerX,
        y: this.waterSurface(b.centerX, b.bottom),
        big: true,
      });
      this.fall('water');
    } else if (b.y > this.grid.heightPx + 32) {
      this.emit({ type: 'fellOut', x: b.centerX, y: this.grid.heightPx });
      this.fall('pit');
    }
  }

  private fall(cause: RespawnCause): void {
    this.respawnCause = cause;
    if (this.level.practice) {
      this.respawnTimer = RESPAWN_FRAMES;
      return;
    }
    const p = this.player;
    this.hearts--;
    this.stats.damaged = true;
    this.combo = 0;
    this.emit({ type: 'hurt', x: p.body.centerX, y: p.body.centerY, hearts: this.hearts, dir: 0 });
    if (this.hearts <= 0) this.die();
    else this.respawnTimer = RULES.fallRespawnFrames;
  }

  private respawnAtSafe(): void {
    const p = this.player;
    this.recallStarfish();
    p.reset(p.lastSafeX, p.lastSafeY);
    if (!this.level.practice) this.iframes = RULES.respawnIframes;
    this.settle();
    this.camera.snap(p);
    this.emit({ type: 'respawn', x: p.body.centerX, y: p.body.bottom, cause: this.respawnCause });
  }

  /** (x, y) 所在水柱的水面高度（px） */
  private waterSurface(x: number, y: number): number {
    let row = Math.floor(y / TILE);
    while (row > 0 && this.grid.waterAt(x, (row - 1) * TILE + 1)) row--;
    return row * TILE;
  }

  // —— 检查点、风铃、触发区、终点 ——

  private updateCheckpoints(): void {
    const x = this.player.body.centerX;
    for (const cp of this.checkpoints) {
      if (cp.active || x < cp.col * TILE + 4) continue;
      cp.active = true;
      // 只往前更新：激活更靠后的检查点之后，再碰到前面的不会把复活点挪回去
      if (cp.index > this.checkpointIndex) {
        this.checkpointIndex = cp.index;
        this.respawnPoint = standAt(cp.col, cp.row);
      }
      this.emit({
        type: 'checkpoint',
        index: cp.index,
        x: cp.col * TILE + TILE / 2,
        y: cp.row * TILE + TILE,
      });
    }
  }

  private updateChimes(): void {
    const ch = this.chimes;
    if (!ch) return;
    const b = this.player.body;
    const { rang, solvedNow } = ch.step({ x: b.x, y: b.y, w: b.w, h: b.h });
    if (rang >= 0) {
      const r = ch.rects[rang]!;
      this.emit({ type: 'chime', index: rang, x: r.x + r.w / 2, y: r.y + r.h / 2 });
    }
    if (solvedNow) {
      this.flags.add('chimesSolved');
      const x = ch.x0 + 32;
      const y = ch.y0 + 6;
      const it = this.items.popAt('glass', x, y, 30, -140, ch.glass, !!this.foundGlass[ch.glass]);
      this.emit({ type: 'chimeSolved', x, y });
      this.emit({ type: 'itemSpawn', id: it.id, kind: 'glass', x, y });
    }
  }

  private updateTriggers(): void {
    const b = this.player.body;
    for (const t of this.triggers) {
      if (t.fired) continue;
      const r = t.rect;
      if (b.centerX < r.x || b.centerX >= r.x + r.w || b.centerY < r.y || b.centerY >= r.y + r.h)
        continue;
      t.fired = true;
      this.emit({ type: 'trigger', id: t.id, blocking: t.blocking });
      if (t.blocking) {
        this.pendingTrigger = t.id;
        return;
      }
    }
  }

  private updateGoal(): void {
    const g = this.goal;
    if (!g) return;
    const b = this.player.body;
    if (b.centerX >= g.x && b.bottom > g.y && b.y < g.y + g.h) {
      this.state = 'clear';
      this.recallStarfish();
      if (this.sunTimer > 0) {
        this.sunTimer = 0;
        this.emit({ type: 'sun', on: false });
      }
      this.emit({ type: 'clear', frames: this.stats.frames });
    }
  }

  private tickTimers(): void {
    if (this.iframes > 0) this.iframes--;
    if (this.grace > 0) this.grace--;
    if (this.shellChainTimer > 0) this.shellChainTimer--;
    if (this.sunTimer > 0) {
      this.sunTimer--;
      if (this.sunTimer === 0) this.emit({ type: 'sun', on: false });
    }
  }

  /** 传送后让主角落到脚下的地面上（只更新着地状态，不产生事件） */
  private settle(): void {
    const p = this.player;
    const b = p.body;
    p.onGround =
      this.grid.solidAt(b.x, b.y + 1, b.w, b.h) || this.grid.oneWayTopAt(b.x, b.y + b.h, b.w);
  }
}
