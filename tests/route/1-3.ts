import { TILE } from '../../src/sim/constants';
import { BTN } from '../../src/sim/input';
import { Bot } from './bot';

/**
 * 第 3 关的路线（docs/levels/1-3.md）。前半段徒步，救出咩铃以后大多骑着走。
 * - 反应式的 walkTo 只用在平地上：它不会二段跳，碰到 10 格的缝会掉下去，碰到矮洞里的裂岩会一直跳；
 * - 跳台阶、跳缝（含二段跳）、躲崖燕、冲过一串敌人都用 attempt 在几种操作里搜索（靠 Bot.fork 从头重放）；
 * - 骑上、下来、冲撞、敲铃用 Bot 上的骑乘动作。
 * 搜索只挑"不掉心、没掉下去、没被撞下坐骑"的操作，所以录出来的回放一路满心。
 */

const face = (dir: number) => (dir > 0 ? BTN.right : BTN.left);

type Move = (b: Bot) => void;

/** 依次试几种操作，返回第一个满足 ok、不掉心、没掉下去、骑乘状态没变（没被撞下来）的 */
function attempt(bot: Bot, moves: Move[], ok: (b: Bot) => boolean, what: string): Bot {
  const hearts = bot.world.hearts;
  const riding = bot.riding;
  for (const move of moves) {
    const b = bot.fork();
    b.release();
    move(b);
    const w = b.world;
    if (
      ok(b) &&
      w.hearts === hearts &&
      b.riding === riding &&
      w.respawnTimer === 0 &&
      (w.state === 'play' || w.state === 'clear')
    )
      return b;
  }
  throw new Error(`${what}：试了 ${moves.length} 种操作都不行（第 ${bot.col.toFixed(1)} 列）`);
}

/** 走到某个像素 x（站在地上），用小步调整 */
function stepTo(bot: Bot, x: number): void {
  const tol = bot.riding ? 3 : 1;
  for (let i = 0; i < 240; i++) {
    const dx = x - bot.p.body.centerX;
    if (Math.abs(dx) <= tol && Math.abs(bot.p.vx) < 5) return;
    bot.step(Math.abs(dx) <= tol ? 0 : dx > 0 ? BTN.right : BTN.left);
  }
}

/** 在脚下的平台上往第 col 列那边走，走到平台边上、墙根或者正对着目标为止 */
function toEdge(bot: Bot, col: number): void {
  const g = bot.world.grid;
  const tx = col * TILE + TILE / 2;
  const dir = Math.sign(tx - bot.p.body.centerX) || 1;
  const foot = Math.round(bot.p.body.bottom / TILE) * TILE;
  let c = Math.floor(bot.p.body.centerX / TILE);
  // 中心已经探出平台边了（只有身体一侧还踩着）：从踩着的那一格算起
  if (!g.standableAt(c * TILE + TILE / 2, foot)) c -= dir;
  for (;;) {
    if (c === col) break;
    const nx = (c + dir) * TILE + TILE / 2;
    if (!g.standableAt(nx, foot) || g.solidAt(nx, foot - 2, 1, 1)) break;
    c += dir;
  }
  stepTo(bot, c * TILE + TILE / 2);
}

/** 起跳前的准备：先往回退 back 帧，再往目标跑 run 帧 */
const RUNUPS: Array<[number, number]> = [
  [0, 0],
  [10, 0],
  [20, 0],
  [20, 12],
  [34, 0],
  [34, 20],
  [0, 14],
];

/**
 * 朝 tx 跳：按住跳跃 hold 帧，一路朝 tx 推；second ≥ 0 时到第 second 帧（或松开跳跃以后）再按住跳 30 帧（二段跳）；
 * 然后一直推到落地。
 */
function jumpTo(b: Bot, tx: number, back: number, run: number, hold: number, second: number) {
  const dir = Math.sign(tx - b.p.body.centerX) || 1;
  b.hold(face(-dir), back);
  b.hold(face(dir), run);
  const steer = () => {
    const dx = tx - b.p.body.centerX;
    return Math.abs(dx) < 4 ? 0 : face(Math.sign(dx));
  };
  let t = 0;
  for (; t < hold; t++) b.step(BTN.jump | steer());
  if (second >= 0) {
    for (; t < second && !b.p.onGround; t++) b.step(steer());
    b.step(steer());
    for (let k = 0; k < 30 && !b.p.onGround; k++) b.step(BTN.jump | steer());
  }
  for (let i = 0; i < 240 && !(b.p.onGround && b.world.respawnTimer === 0); i++) b.step(steer());
  b.hold(0, 6);
}

/**
 * 跳到第 col 列、站在第 row 行（脚下是第 row + 1 行的顶）。
 * 骑着时也试二段跳（按第一跳的时长和第二跳的时机搜索）；extra 是额外要满足的条件。
 */
function hop(bot: Bot, col: number, row: number, extra?: (b: Bot) => boolean): Bot {
  const tx = col * TILE + TILE / 2;
  const feet = (row + 1) * TILE;
  toEdge(bot, col);
  const seconds = bot.riding ? [-1, 20, 26, 14, 32] : [-1];
  const moves: Move[] = [];
  for (const [back, run] of RUNUPS)
    for (const second of seconds)
      for (const hold of [30, 20, 12, 8]) moves.push((b) => jumpTo(b, tx, back, run, hold, second));
  return attempt(
    bot,
    moves,
    (b) =>
      b.p.onGround &&
      b.p.body.bottom === feet &&
      Math.abs(b.p.body.centerX - tx) < 3 * TILE &&
      (!extra || extra(b)),
    `跳到第 ${col} 列第 ${row} 行`,
  );
}

/** 前面 ahead 像素处、往下 1 格以内有没有能站的地方 */
function groundAhead(b: Bot, ahead: number): boolean {
  const g = b.world.grid;
  const pb = b.p.body;
  const x = pb.right - 1 + ahead;
  for (let y = pb.bottom; y <= pb.bottom + TILE; y++) if (g.standableAt(x, y)) return true;
  return false;
}

/** 在平地上往右走，碰到墙（裂岩、砖墙）、走到崖边或者走到第 col 列就停（不跳） */
function rideUntilBlocked(b: Bot, col: number, max = 300): void {
  for (let i = 0; i < max; i++) {
    if (b.col >= col + 0.5 || !b.riding) break;
    if (b.p.onGround && !groundAhead(b, 12)) break;
    const x = b.p.body.x;
    b.step(BTN.right);
    if (b.p.onGround && b.p.body.x === x && i > 2) break;
  }
  b.hold(0, 8);
}

/**
 * 冲撞，冲到崖边就起跳（冲刺还没结束就是冲撞跳，跳得特别远），second ≥ 1 时起跳后第 30 + second 帧再二段跳；
 * 一路往右推，落地为止。前面没有崖边时就是一次普通的冲撞（冲完接着往右走到挡住为止）。
 */
function dashAcross(b: Bot, second: number): void {
  b.release();
  if (b.p.facing !== 1) b.step(BTN.right);
  b.step(BTN.right | BTN.attack);
  b.waitUntil(() => !b.p.ride || b.p.ride.dash > 0, 20, BTN.right);
  let jumped = -1;
  for (let i = 0; i < 300; i++) {
    if (!b.p.ride || b.world.respawnTimer > 0) return;
    if (jumped < 0 && b.p.onGround && !groundAhead(b, 6)) jumped = i;
    let held = BTN.right;
    if (jumped >= 0) {
      const t = i - jumped;
      if (t < 30) held |= BTN.jump;
      else if (second >= 1 && t >= 30 + second && t < 60 + second) held |= BTN.jump;
    } else if (b.p.ride.dash === 0 && b.p.onGround && Math.abs(b.p.vx) <= 170) break;
    b.step(held);
    if (jumped >= 0 && i - jumped > 5 && b.p.onGround) break;
  }
  b.hold(0, 10);
}

/**
 * 骑着往右推进，至少到第 col 列（路上可能有敌人、裂岩、砖墙，中间也可能隔着崖缝）：
 * 一路"冲撞（冲到崖边就跳过去）、走到挡住为止"。在"先往回退几格、先等几帧、要不要二段跳、
 * 冲刺中途就起跳"里搜索。
 */
function charge(bot: Bot, col: number, what = `冲撞到第 ${col} 列`): Bot {
  const moves: Move[] = [];
  for (const second of [-1, 1, 6, 12])
    for (const back of [0, 3, 6])
      for (const wait of [0, 15, 35, 60])
        moves.push((b) => {
          if (back) stepTo(b, b.p.body.centerX - back * TILE);
          b.hold(0, wait);
          for (let k = 0; k < 4 && b.col < col; k++) {
            dashAcross(b, second);
            if (!b.riding || b.world.respawnTimer > 0) return;
            rideUntilBlocked(b, col);
          }
        });
  for (const jumpAt of [4, 10, 16])
    for (const wait of [0, 15, 35])
      moves.push((b) => {
        b.hold(0, wait);
        for (let k = 0; k < 4 && b.col < col; k++) {
          b.charge(1, jumpAt);
          if (!b.riding || b.world.respawnTimer > 0) return;
          rideUntilBlocked(b, col);
        }
      });
  return attempt(bot, moves, (b) => b.p.onGround && b.col >= col - 0.5, what);
}

/**
 * 骑着走进第 i 组崖燕的触发线，躲开或撞飞整组：在"走着 / 站着"、"等几帧"、"冲撞 / 跳 / 什么都不做"里搜索。
 * 结束时整组都飞完了（撞飞或者飞出画面），小满还骑着、没掉心。
 */
function flock(bot: Bot, i: number, stopCol: number): Bot {
  const f = bot.world.flocks[i]!;
  // 先走到触发线
  if (f.state === 'wait') bot.walkTo(Math.floor(f.rect.x / TILE) + 1, 600);
  if (bot.world.flocks[i]!.state === 'wait') throw new Error(`第 ${i} 组崖燕没有触发`);
  const flying = (b: Bot) =>
    b.world.flocks[i]!.ids.some((id) => {
      const e = b.world.enemies.find((q) => q.id === id)!;
      return e.alive && e.mode === 'fly';
    });
  const cleared = (b: Bot) => b.world.flocks[i]!.state === 'done' && !flying(b);
  const moves: Move[] = [];
  for (const walk of [false, true])
    for (let wait = 0; wait <= 110; wait += 5)
      for (const act of ['charge', 'jump', 'tap', 'none'] as const)
        moves.push((b) => {
          for (let k = 0; k < wait; k++) {
            if (walk && b.col < stopCol) b.step(BTN.right);
            else b.step(0);
          }
          if (act === 'charge') dashAcross(b, 6);
          else if (act === 'jump') b.jump(30, walk ? 1 : 0, 160);
          else if (act === 'tap') b.jump(10, walk ? 1 : 0, 160);
          for (let k = 0; k < 200 && !cleared(b); k++) b.step(0);
          b.hold(0, 4);
        });
  return attempt(bot, moves, cleared, `躲开第 ${i} 组崖燕`);
}

/** 站在铃砖正下方往上跳，顶出隐藏铃砖（在按跳时长里搜索） */
function bump(bot: Bot, col: number, row: number): Bot {
  const blk = () => bot.world.blocks.at(col, row)!;
  stepTo(bot, col * TILE + TILE / 2);
  const moves: Move[] = [6, 10, 14, 20, 30].map((hold) => (b: Bot) => b.jump(hold, 0, 160));
  return attempt(
    bot,
    moves,
    (b) => b.world.blocks.at(col, row)!.revealed && b.p.onGround,
    `顶出第 ${col} 列第 ${row} 行的铃砖（${blk().kind}）`,
  );
}

// —— A：开场、救出咩铃、二段跳上崖坎、矮洞里撞开两块裂岩 ——

/** 跳上羊圈顶的木板，一直往冰晶上跳，踩够三下冰晶碎掉（过场"咩铃出圈"由 step 里的 resolveHeadless 套用结束状态） */
function rescue(bot: Bot): Bot {
  let b = hop(bot, 30, 24);
  const cr = b.world.crystal!;
  const cx = cr.rect.x + cr.rect.w / 2;
  const moves: Move[] = [0, 2, 4, -2].flatMap((off) =>
    [8, 14, 22].map((hold) => (q: Bot) => {
      const steer = () => {
        const dx = cx + off - q.p.body.centerX;
        return Math.abs(dx) < 2 ? 0 : face(Math.sign(dx));
      };
      for (let i = 0; i < 900 && !q.world.flags.has('mieling'); i++) {
        if (q.p.onGround && !(q.held & BTN.jump)) {
          for (let k = 0; k < hold && !q.world.flags.has('mieling'); k++)
            q.step(BTN.jump | steer());
        } else q.step(steer());
      }
      q.hold(0, 4);
    }),
  );
  b = attempt(b, moves, (q) => q.world.flags.has('mieling'), '踩碎冰晶');
  return b;
}

export function sectionA(bot: Bot): Bot {
  bot.walkTo(24);
  if (!bot.world.flags.has('huihui')) throw new Error('回回不在');
  let b = rescue(bot);
  if (!b.mount()) throw new Error('骑不上咩铃');
  // A3：二段跳上 6 格高的崖坎
  b = hop(b, 49, 21);
  // A4：矮洞里两块裂岩，一路撞过去；出了洞下到第 28 行
  b.walkTo(62);
  b = charge(b, 86, '撞开矮洞里的两块裂岩');
  return b;
}

// —— B：云海石柱、崖边的蟹群和砖墙、第一组崖燕 ——

export function sectionB(bot: Bot): Bot {
  let b = hop(bot, 105, 27);
  b = hop(b, 120, 25);
  b = hop(b, 129, 26);
  b = hop(b, 144, 27);
  b = charge(b, 168, '撞飞蟹群、撞开砖墙');
  b = flock(b, 0, 175);
  b.walkTo(178);
  return b;
}

// —— C：石门、回声洞、敲铃、羊道 ——

/** 下坐骑，从门缝钻进回声洞，用海星打掉刺海胆，敲响回声铃 */
function echoCave(bot: Bot): Bot {
  bot.walkTo(184);
  bot.dismount();
  bot.walkTo(189);
  // 洞里那只不动的刺海胆：站在门缝里朝它扔海星
  const urchin = bot.world.enemies.find((e) => e.kind === 'urchin' && e.alive)!;
  const moves: Move[] = [0, 6, 12, 20].map((wait) => (b: Bot) => {
    b.hold(0, wait);
    if (b.p.facing < 0) b.step(BTN.right);
    b.step(BTN.attack);
    b.waitUntil(() => !b.world.starfish.out, 200);
  });
  const b = attempt(
    bot,
    moves,
    (q) => !q.world.enemies.find((e) => e.id === urchin.id)!.alive,
    '打掉回声洞里的刺海胆',
  );
  if (!b.ringBell()) throw new Error('敲不响回声铃');
  return b;
}

/** 羊道：四级石台一级级跳上去，最后一跳 9 格远、2 格高，上到山脊 */
function climb(bot: Bot): Bot {
  let b = hop(bot, 216, 23);
  b = hop(b, 211, 19);
  b = hop(b, 216, 15);
  b = hop(b, 209, 11);
  b = hop(b, 224, 9);
  return b;
}

export function sectionC(bot: Bot): Bot {
  const b = echoCave(bot);
  if (!b.mount()) throw new Error('门开以后骑不上咩铃');
  b.walkTo(212);
  return climb(b);
}

// —— D：山脊上的裂岩、崖缝、两组崖燕，结尾过场，铃门 ——

export function sectionD(bot: Bot): Bot {
  let b = charge(bot, 241, '撞开山脊上第一块裂岩');
  b = hop(b, 248, 9);
  b = charge(b, 271, '撞开第二块裂岩和后面的蓝钳，跳过 10 格的崖缝');
  b = flock(b, 1, 280);
  b = charge(b, 293, '撞开第三块裂岩，跳过 4 格的崖缝');
  b = flock(b, 2, 297);
  b = charge(b, 315, '撞开第四块裂岩，跳过 10 格的崖缝');
  b = charge(b, 342, '撞开最后两块裂岩，跳过最后一道崖缝');
  // 结尾过场（谷雨的谢意）以后小满已经下了坐骑，走进铃门
  for (let k = 0; k < 10 && b.world.state !== 'clear'; k++) b.walkTo(358, 600);
  return b;
}

/** 通关路线 */
export function routeAny(): Bot {
  let b = sectionA(new Bot('1-3'));
  b = sectionB(b);
  b = sectionC(b);
  return sectionD(b);
}

/** 全收集路线：通关路线上再拿三枚海玻璃 */
export function routeFull(): Bot {
  let b = sectionA(new Bot('1-3'));
  // ②：羊肠小道。先二段跳上第一块木板（比地面高 6 格），再二段跳上第二块（再高 5 格），走到旧羊圈
  b = hop(b, 105, 27);
  b = hop(b, 120, 25);
  b = hop(b, 129, 26);
  b = hop(b, 144, 27);
  b = hop(b, 145, 21);
  b = hop(b, 152, 16);
  b.walkTo(160);
  if (!b.world.stats.glass[1]) throw new Error('没拿到海玻璃 ②');
  b = hop(b, 164, 27);
  b = charge(b, 168, '撞开砖墙');
  b = flock(b, 0, 175);
  b.walkTo(178);
  // ①：回声洞里敲完铃，顶出两块隐藏铃砖当台阶，上到洞顶的暗格
  b = echoCave(b);
  b = bump(b, 196, 25);
  b = hop(b, 196, 24);
  b = bump(b, 197, 22);
  b = hop(b, 197, 21);
  // 暗格没有底：站在第二块铃砖上往上跳，钻进暗格拿到海玻璃，再落回铃砖
  b = hop(b, 197, 21, (q) => q.world.stats.glass[0] === true);
  b = hop(b, 199, 27);
  if (!b.world.stats.glass[0]) throw new Error('没拿到海玻璃 ①');
  if (!b.mount()) throw new Error('门开以后骑不上咩铃');
  // ③：上到第二级石台，朝左冲出去撞碎裂岩，再从石台跳进小洞
  b.walkTo(212);
  b = hop(b, 216, 23);
  b = hop(b, 211, 19);
  stepTo(b, 210 * TILE + 8);
  b.charge(-1);
  if (!b.world.blocks.at(206, 18)!.broken) throw new Error('没撞碎小洞口的裂岩');
  if (!b.riding) throw new Error('撞完裂岩被撞下坐骑了');
  if (b.p.body.bottom !== 20 * TILE) {
    b.walkTo(212);
    b = hop(b, 216, 23);
    b = hop(b, 211, 19);
  }
  b = hop(b, 204, 18, (q) => q.world.stats.glass[2] === true);
  b = hop(b, 211, 19);
  b = hop(b, 216, 15);
  b = hop(b, 209, 11);
  b = hop(b, 224, 9);
  return sectionD(b);
}
