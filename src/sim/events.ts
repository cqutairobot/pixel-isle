import type { BlockKind, EnemyKind, ItemKind } from './level';

/** 敌人被打倒的原因：踩、被下方的砖顶飞、太阳果、回旋海星、掉下来的椰子 */
export type DefeatCause = 'stomp' | 'bump' | 'sun' | 'starfish' | 'coconut';

/** 回到安全地面的原因 */
export type RespawnCause = 'pit' | 'water' | 'death';

/** sim 每一步产生的事件，表现层（粒子、震动、音效、UI）据此做反馈。坐标为游戏像素。 */
export type SimEvent =
  | { type: 'jump'; x: number; y: number; run: number }
  | { type: 'land'; x: number; y: number; vy: number; fall: number; hard: boolean }
  | { type: 'skid'; x: number; y: number; dir: number }
  | { type: 'bonk'; x: number; y: number }
  | { type: 'wallBump'; x: number; y: number; dir: number }
  | { type: 'drop'; x: number; y: number }
  | { type: 'leaveGround'; x: number; y: number }
  | { type: 'fellOut'; x: number; y: number }
  | { type: 'respawn'; x: number; y: number; cause?: RespawnCause }
  | { type: 'cornerCorrect'; dx: number }
  | { type: 'ledgeAssist'; dy: number }
  // —— 敌人与战斗 ——
  | { type: 'enemyActivate'; id: number; kind: EnemyKind; x: number; y: number }
  | { type: 'stomp'; x: number; y: number; combo: number; held: boolean }
  | {
      type: 'enemyDefeat';
      id: number;
      kind: EnemyKind;
      x: number;
      y: number;
      cause: DefeatCause;
      reward: number;
      facing: number;
    }
  | { type: 'enemyLost'; id: number; kind: EnemyKind; x: number; y: number; water: boolean }
  | { type: 'hurt'; x: number; y: number; hearts: number; dir: number; spike?: boolean }
  | { type: 'death'; x: number; y: number }
  | { type: 'splash'; x: number; y: number; big: boolean }
  // —— 方块与道具 ——
  | {
      type: 'blockHit';
      col: number;
      row: number;
      kind: BlockKind;
      item: ItemKind | null;
      /** 这一下之后砖变成了用过的暗色砖 */
      used: boolean;
    }
  | { type: 'blockEmpty'; col: number; row: number }
  | { type: 'blockBreak'; col: number; row: number }
  | { type: 'blockReveal'; col: number; row: number }
  | { type: 'itemSpawn'; id: number; kind: ItemKind; x: number; y: number }
  | {
      type: 'collect';
      kind: ItemKind;
      x: number;
      y: number;
      /** 获得的贝壳数（贝壳、大贝壳、满心时的芒果、敌人和砖的答谢） */
      shells: number;
      /** 连续拾取的序号（从 0 开始，音高逐级升高） */
      chain: number;
      glass?: number;
      /** 这枚海玻璃以前已经找到过 */
      ghost?: boolean;
      /** 从砖里直接顶出来的贝壳 */
      fromBlock?: boolean;
    }
  | { type: 'heal'; hearts: number }
  | { type: 'sun'; on: boolean }
  // —— 关卡流程与互动 ——
  | { type: 'checkpoint'; index: number; x: number; y: number }
  | { type: 'clear'; frames: number }
  | { type: 'trigger'; id: string; blocking: boolean }
  | { type: 'talk'; id: string }
  | { type: 'chime'; index: number; x: number; y: number }
  | { type: 'chimeSolved'; x: number; y: number }
  // —— 装备：回旋海星 ——
  | { type: 'throw'; x: number; y: number; dirX: number; dirY: number }
  /** 海星还在外面、或者刚接住还在冷却时按了攻击键 */
  | { type: 'starfishDud'; x: number; y: number }
  /** 去程撞到墙，折返 */
  | { type: 'starfishBounce'; x: number; y: number }
  | { type: 'starfishHit'; id: number; x: number; y: number }
  /** 接住；carried 是一起带回来的道具数 */
  | { type: 'starfishCatch'; x: number; y: number; carried: number }
  /** 捞到一个道具 */
  | { type: 'starfishGrab'; id: number; x: number; y: number }
  /** 按了切换键：count 是拥有的装备数 */
  | { type: 'equipSwitch'; count: number }
  // —— 第 2 关的敌人和椰子 ——
  | { type: 'urchinShake'; id: number; x: number; y: number }
  | { type: 'urchinFall'; id: number; x: number; y: number }
  | { type: 'urchinLand'; id: number; x: number; y: number }
  | { type: 'gullAlert'; id: number; x: number; y: number }
  | { type: 'gullDive'; id: number; x: number; y: number }
  /** 海星打到椰子树的树冠（没有椰子了也会沙沙响一下） */
  | { type: 'treeHit'; id: number; x: number; y: number; empty: boolean }
  | { type: 'coconutDrop'; id: number; x: number; y: number }
  | { type: 'coconutBounce'; id: number; x: number; y: number }
  | { type: 'coconutBreak'; id: number; x: number; y: number };

export type SimEventType = SimEvent['type'];
