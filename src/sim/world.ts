import { SimCamera } from './camera';
import type { SimEvent } from './events';
import type { InputFrame } from './input';
import type { ParsedLevel } from './level';
import { Player, type PlayerEnv } from './player';
import { derive, type Derived, type Tuning } from './tuning';

export interface WorldOptions {
  autoRun: boolean;
}

/** 掉出地图后，过多少帧回到安全地面 */
export const RESPAWN_FRAMES = 30;

/** 把关卡、主角、镜头组合起来；每次 step 前进一个逻辑帧（1/60 秒）。 */
export class World implements PlayerEnv {
  readonly player: Player;
  readonly camera: SimCamera;
  readonly events: SimEvent[] = [];
  frame = 0;
  derived: Derived;
  /** 掉坑后的等待帧数；大于 0 时主角不受控制 */
  respawnTimer = 0;

  constructor(
    readonly level: ParsedLevel,
    public tuning: Tuning,
    public options: WorldOptions,
    viewW: number,
    viewH: number,
  ) {
    this.derived = derive(tuning);
    this.player = new Player(level.spawn.x, level.spawn.y);
    this.camera = new SimCamera(viewW, viewH, level.grid.widthPx, level.grid.heightPx);
    this.settle();
    this.camera.snap(this.player);
  }

  get grid() {
    return this.level.grid;
  }

  get autoRun(): boolean {
    return this.options.autoRun;
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

  step(input: InputFrame): void {
    this.events.length = 0;
    const p = this.player;
    if (this.respawnTimer > 0) {
      this.respawnTimer--;
      if (this.respawnTimer === 0) {
        p.reset(p.lastSafeX, p.lastSafeY);
        this.settle();
        this.camera.snap(p);
        this.emit({ type: 'respawn', x: p.body.centerX, y: p.body.bottom });
      }
    } else {
      p.step(input, this);
      if (p.body.y > this.grid.heightPx + 32) {
        this.respawnTimer = RESPAWN_FRAMES;
        this.emit({ type: 'fellOut', x: p.body.centerX, y: this.grid.heightPx });
      }
    }
    if (this.respawnTimer === 0) this.camera.step(p, this.tuning);
    this.frame++;
  }

  /** 传送后让主角落到脚下的地面上（只更新着地状态，不产生事件） */
  private settle(): void {
    const p = this.player;
    const b = p.body;
    p.onGround =
      this.grid.solidAt(b.x, b.y + 1, b.w, b.h) || this.grid.oneWayTopAt(b.x, b.y + b.h, b.w);
  }
}
