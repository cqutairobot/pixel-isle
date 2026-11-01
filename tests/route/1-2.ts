import { TILE } from '../../src/sim/constants';
import type { Enemy } from '../../src/sim/enemies';
import type { EnemyKind } from '../../src/sim/level';
import { BTN } from '../../src/sim/input';
import { Bot } from './bot';

/**
 * 第 2 关的路线。刺海胆踩不得、冰喙鸥会俯冲，反应式的"自动玩家"应付不来，
 * 所以这里用两个靠搜索的小工具：
 * - kill：用海星打倒一只敌人（在等待时间、直扔 / 斜扔、要不要先跳之间搜索，选第一个不掉心的）；
 * - hop：跳到指定的平台上（在助跑、按跳时长之间搜索）。
 * 搜索靠 Bot.fork（从头重放输入），所以录回放会慢一点，但回放本身只是一串输入。
 */

/** 走到某个像素 x（站在地上），用小步调整 */
function stepTo(bot: Bot, x: number): void {
  for (let i = 0; i < 240; i++) {
    const dx = x - bot.p.body.centerX;
    if (Math.abs(dx) <= 1 && Math.abs(bot.p.vx) < 5) return;
    bot.step(Math.abs(dx) <= 1 ? 0 : dx > 0 ? BTN.right : BTN.left);
  }
}

/**
 * 第 col 列附近离得最近的某种敌人（可能已经被别的海星顺路打倒了）。
 * 螃蟹一直往前走、不在边缘回头，所以找的范围大一些。
 */
function enemyNear(bot: Bot, kind: EnemyKind, col: number): Enemy {
  const range = kind === 'crab' || kind === 'blueClaw' ? 14 : kind === 'gull' ? 9 : 4;
  const dist = (q: Enemy) => Math.abs(q.body.centerX / TILE - col);
  const e = bot.world.enemies
    .filter((q) => q.kind === kind && dist(q) <= range)
    .sort((a, b) => dist(a) - dist(b))[0];
  if (!e) throw new Error(`第 ${col} 列附近没有 ${kind}`);
  return e;
}

type Plan = (b: Bot, dir: number) => void;
const face = (dir: number) => (dir > 0 ? BTN.right : BTN.left);
/** 打敌人的几种方式：站着直扔、站着斜扔、跳起来在不同时刻直扔 / 斜扔 */
const PLANS: Plan[] = [
  (b) => b.step(BTN.attack),
  (b) => {
    b.step(BTN.up);
    b.step(BTN.up | BTN.attack);
  },
  ...[6, 12, 20].flatMap((h) =>
    [0, 6, 12].flatMap((late) =>
      [0, BTN.up].map((up) => (b: Bot) => {
        b.hold(BTN.jump, h);
        b.hold(0, late);
        b.step(up);
        b.step(up | BTN.attack);
      }),
    ),
  ),
];

/**
 * 用海星打倒 e；返回打倒以后的 Bot（站在地上，海星回到手里）。
 * 先等一会儿（让敌人走进射程、冰喙鸥俯冲下来），必要时先往旁边挪几步躲开俯冲，再选一种扔法。
 */
function kill(bot: Bot, e: Enemy, waits = [0, 10, 20, 35, 50, 70, 100, 140]): Bot {
  if (!e.alive) return bot;
  const hearts = bot.world.hearts;
  const moves = e.kind === 'gull' ? [0, -1, 1] : [0];
  for (const move of moves) {
    for (const wait of waits) {
      for (const plan of PLANS) {
        const b = bot.fork();
        const en = b.world.enemies.find((q) => q.id === e.id)!;
        b.release();
        if (move) {
          // 等敌人开始俯冲再往旁边躲
          b.waitUntil(() => en.mode === 'dive' || !en.alive, wait + 200);
          b.hold(face(move), 14);
          b.hold(0, Math.floor(wait / 4));
        } else b.hold(0, wait);
        if (!en.alive || b.world.hearts !== hearts || !b.p.onGround) continue;
        const dir = Math.sign(en.body.centerX - b.p.body.centerX) || 1;
        // 先转向它（只按一帧，几乎不挪动）
        if (b.p.facing !== dir) b.step(face(dir));
        plan(b, dir);
        b.waitUntil(() => !b.world.starfish.out && b.p.onGround, 240);
        b.hold(0, 2);
        if (!en.alive && b.world.hearts === hearts && b.world.state === 'play' && b.p.onGround)
          return b;
      }
    }
  }
  throw new Error(`打不倒第 ${(e.body.centerX / TILE).toFixed(1)} 列的 ${e.kind}`);
}

/**
 * 跳到第 col 列、站在第 row 行（脚下是 row + 1 行的平台）。
 * 在"先往回退几帧助跑"、"按住跳跃几帧"、"起跳后过几帧才往目标推"之间搜索，要求不掉心。
 */
function hop(bot: Bot, col: number, row: number): Bot {
  const tx = col * TILE + TILE / 2;
  const feet = (row + 1) * TILE;
  const hearts = bot.world.hearts;
  // 先在脚下的平台上往目标那边走，走到平台边上（或者正对着目标）为止
  {
    const g = bot.world.grid;
    const dir = Math.sign(tx - bot.p.body.centerX) || 1;
    const r = Math.round(bot.p.body.bottom / TILE);
    let c = Math.floor(bot.p.body.centerX / TILE);
    while (c !== col && g.standableAt(c * TILE + 8 + dir * TILE, r * TILE)) c += dir;
    stepTo(bot, c * TILE + 8);
  }
  for (const [back, run] of [
    [0, 0],
    [6, 0],
    [12, 0],
    [12, 8],
    [20, 0],
    [20, 12],
  ] as const) {
    for (const hold of [22, 16, 12, 8]) {
      for (const delay of [0, 4, 8, 12]) {
        const b = bot.fork();
        b.release();
        const dir = Math.sign(tx - b.p.body.centerX) || 1;
        b.hold(face(-dir), back);
        b.hold(face(dir), run);
        const steer = () => {
          const dx = tx - b.p.body.centerX;
          return Math.abs(dx) < 4 ? 0 : face(Math.sign(dx));
        };
        for (let i = 0; i < hold; i++) b.step(BTN.jump | (i >= delay ? steer() : 0));
        for (let i = hold; i < delay; i++) b.step(0);
        for (let i = 0; i < 140 && !b.p.onGround; i++) b.step(steer());
        b.hold(0, 6);
        const ok =
          b.p.onGround &&
          b.p.body.bottom === feet &&
          Math.abs(b.p.body.centerX - tx) < 3 * TILE &&
          b.world.hearts === hearts;
        if (ok) return b;
      }
    }
  }
  throw new Error(`跳不到第 ${col} 列第 ${row} 行`);
}

/**
 * 落在第 5 片叶子上以后：头顶的倒挂刺海胆开始晃，赶紧往右边躲开，等它掉下来落在叶子上，
 * 再转身用海星打掉。
 */
function dodgeAndClear(bot: Bot): Bot {
  const u = enemyNear(bot, 'urchinHang', 242);
  stepTo(bot, 244 * TILE + 8);
  bot.waitUntil(() => !u.alive || u.mode === 'walk', 120);
  return kill(bot, u);
}

/** 先走过去再打（敌人在前方高处、或者要走到合适的距离） */
export function walkAndKill(bot: Bot, col: number, kind: EnemyKind, enemyCol: number): Bot {
  bot.walkTo(col);
  const e = enemyNear(bot, kind, enemyCol);
  // 螃蟹会到处走：在直扔的射程外就慢慢走近（不跳），走到 4 格以内停下
  if (e.alive && (kind === 'crab' || kind === 'blueClaw')) {
    for (let i = 0; i < 300; i++) {
      const dx = e.body.centerX - bot.p.body.centerX;
      if (!e.alive || Math.abs(dx) <= 4 * TILE) break;
      bot.step(face(Math.sign(dx)));
    }
  }
  return kill(bot, e);
}

/** A 段：开场、隧道、A3 的刺海胆，到 A4 岸边的倒木前 */
export function sectionA(bot: Bot): Bot {
  bot.walkTo(8);
  bot.walkTo(13);
  if (!bot.world.flags.has('starfish')) throw new Error('开场没有拿到海星');
  let b = walkAndKill(bot, 18, 'urchin', 24);
  b = walkAndKill(b, 31, 'urchin', 36);
  b = walkAndKill(b, 35, 'urchin', 41);
  return b;
}

/** A4–A5：站上倒木，跳上高吊桥，踩过桥上的螃蟹，下到对岸 */
export function sectionA5(bot: Bot): Bot {
  bot.walkTo(52);
  let b = hop(bot, 57, 22);
  b.walkTo(68);
  b.walkTo(73);
  return b;
}

/** B 段：倒木阶梯（一级一级打掉刺海胆再上去）、空地上的冰喙鸥、铃砖和螃蟹，到检查点 ① */
export function sectionB(bot: Bot): Bot {
  let b = walkAndKill(bot, 73, 'urchin', 77);
  b = walkAndKill(b, 76, 'urchin', 81);
  b = walkAndKill(b, 80, 'urchin', 85);
  b = walkAndKill(b, 84, 'urchin', 89);
  b = walkAndKill(b, 102, 'gull', 105);
  b.walkTo(119);
  b = walkAndKill(b, 127, 'gull', 128);
  b.walkTo(147);
  return b;
}

/** C 段：吊桥上的倒挂刺海胆、空心树桩、林间小路，到检查点 ② */
export function sectionC(bot: Bot): Bot {
  let b = walkAndKill(bot, 151, 'urchinHang', 157);
  b = walkAndKill(b, 161, 'urchinHang', 168);
  // 空心树桩：踩着矮木头跳上树桩顶（别钻进底下的缝里）
  b.walkTo(176);
  b = hop(b, 179, 23);
  b = walkAndKill(b, 183, 'urchin', 186);
  b = walkAndKill(b, 188, 'urchinHang', 193);
  b = walkAndKill(b, 199, 'urchinHang', 205);
  b.walkTo(217);
  return b;
}

/** D 段：沿着大叶子往上爬，上到树冠顶，打掉冰喙鸥，冲进铃门 */
function climb(bot: Bot): Bot {
  bot.walkTo(224);
  let b = hop(bot, 226, 24);
  b = hop(b, 233, 21);
  b = hop(b, 228, 18);
  b = hop(b, 234, 15);
  b = kill(b, enemyNear(b, 'gull', 240), [0, 20, 40, 60, 90, 120, 160, 200]);
  b = dodgeAndClear(hop(b, 241, 12));
  b = hop(b, 247, 9);
  b = hop(b, 242, 7);
  b = hop(b, 248, 5);
  b.walkTo(255);
  b = kill(b, enemyNear(b, 'gull', 258), [0, 20, 40, 60, 90, 120, 160, 200]);
  b.walkTo(280);
  b = kill(b, enemyNear(b, 'gull', 282), [0, 20, 40, 60, 90, 120, 160, 200]);
  for (let k = 0; k < 20 && b.world.state !== 'clear'; k++) b.walkTo(299, 400);
  return b;
}

/** 通关路线 */
export function routeAny(): Bot {
  let b = sectionA(new Bot('1-2'));
  b = sectionA5(b);
  b = sectionB(b);
  b = sectionC(b);
  return climb(b);
}

/** 全收集路线：三枚海玻璃，外加 A4 吊桥底下的贝壳 */
export function routeFull(): Bot {
  let b = sectionA(new Bot('1-2'));
  // A4：站在岸边斜着往上扔，捞回吊桥底下的贝壳
  b.walkTo(52);
  b.walkTo(55);
  stepTo(b, 55 * TILE + 8);
  b.release();
  b.step(BTN.right);
  b.step(BTN.up);
  b.step(BTN.up | BTN.attack);
  b.waitUntil(() => !b.world.starfish.out, 200, BTN.up);
  b.walkTo(52);
  b = sectionA5(b);
  // B：先打掉阶梯上的刺海胆和空地上的冰喙鸥，再沿椰树叶爬到鸥巢（海玻璃 ②）
  b = walkAndKill(b, 73, 'urchin', 77);
  b = walkAndKill(b, 76, 'urchin', 81);
  b = walkAndKill(b, 80, 'urchin', 85);
  b = walkAndKill(b, 84, 'urchin', 89);
  b = walkAndKill(b, 102, 'gull', 105);
  b.walkTo(112);
  b = hop(b, 111, 24);
  b = hop(b, 106, 21);
  b = hop(b, 101, 18);
  b = hop(b, 96, 15);
  b = hop(b, 92, 11);
  b.walkTo(89);
  if (!b.world.stats.glass[1]) throw new Error('没拿到海玻璃 ②');
  // 从鸥巢跳回地面，继续往右
  b.walkTo(99);
  b.walkTo(112);
  b.walkTo(119);
  b = walkAndKill(b, 127, 'gull', 128);
  b.walkTo(147);
  // C：先过吊桥，然后在树桩前直着扔，把缝里的海玻璃 ① 带回来
  b = walkAndKill(b, 151, 'urchinHang', 157);
  b = walkAndKill(b, 161, 'urchinHang', 168);
  b.walkTo(174);
  b = hop(b, 177, 27);
  stepTo(b, 177 * TILE + 8);
  b.release();
  b.step(BTN.right);
  b.hold(0, 2);
  b.step(BTN.attack);
  b.waitUntil(() => !b.world.starfish.out, 200);
  if (!b.world.stats.glass[0]) throw new Error('没拿到海玻璃 ①');
  b.walkTo(176);
  b = hop(b, 179, 23);
  b = walkAndKill(b, 183, 'urchin', 186);
  b = walkAndKill(b, 188, 'urchinHang', 193);
  b = walkAndKill(b, 199, 'urchinHang', 205);
  b.walkTo(217);
  // D：爬到第 6 片叶子，跳下到树冠外侧的短叶子上，起跳斜扔捞海玻璃 ③，再从地面爬一遍
  b.walkTo(224);
  b = hop(b, 226, 24);
  b = hop(b, 233, 21);
  b = hop(b, 228, 18);
  b = hop(b, 234, 15);
  b = kill(b, enemyNear(b, 'gull', 240), [0, 20, 40, 60, 90, 120, 160, 200]);
  b = dodgeAndClear(hop(b, 241, 12));
  b = hop(b, 247, 9);
  b = hop(b, 254, 16);
  b = glassThree(b);
  b.walkTo(226);
  b = climbAgain(b);
  return b;
}

/** 站在树冠外侧的短叶子上：起跳，在最高点附近斜着往上扔，捞海玻璃 ③（搜索起跳点和出手时机） */
function glassThree(bot: Bot): Bot {
  for (const col of [254, 253, 255, 252, 256]) {
    for (const runup of [0, 4, 8]) {
      for (const hold of [10, 16, 22]) {
        for (let wait = 8; wait <= 26; wait += 2) {
          const b = bot.fork();
          b.release();
          stepTo(b, col * TILE + 8);
          b.step(BTN.right);
          b.hold(0, 4);
          b.hold(BTN.right, runup);
          b.hold(BTN.right | BTN.jump, Math.min(hold, wait));
          b.hold(BTN.right, Math.max(0, wait - hold));
          b.step(BTN.right | BTN.up);
          b.step(BTN.right | BTN.up | BTN.attack);
          b.waitUntil(() => !b.world.starfish.out && b.p.onGround, 400, BTN.up);
          if (b.world.stats.glass[2]) return b;
        }
      }
    }
  }
  throw new Error('没拿到海玻璃 ③');
}

/** 拿完海玻璃 ③ 掉回地面后，再爬一遍（这次刺海胆、冰喙鸥已经打掉了一部分） */
function climbAgain(bot: Bot): Bot {
  let b = hop(bot, 226, 24);
  b = hop(b, 233, 21);
  b = hop(b, 228, 18);
  b = hop(b, 234, 15);
  b = hop(b, 241, 12);
  b = hop(b, 247, 9);
  b = hop(b, 242, 7);
  b = hop(b, 248, 5);
  b.walkTo(255);
  b = kill(b, enemyNear(b, 'gull', 258), [0, 20, 40, 60, 90, 120, 160, 200]);
  b.walkTo(280);
  b = kill(b, enemyNear(b, 'gull', 282), [0, 20, 40, 60, 90, 120, 160, 200]);
  for (let k = 0; k < 20 && b.world.state !== 'clear'; k++) b.walkTo(299, 400);
  return b;
}
