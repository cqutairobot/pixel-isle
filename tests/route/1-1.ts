import { CHIME_SEQUENCE } from '../../src/sim/chimes';
import { TILE } from '../../src/sim/constants';
import { BTN } from '../../src/sim/input';
import { Bot } from './bot';

/** 通关路线：一路往右（反应式跳台阶、跳坑、跳螃蟹） */
export function routeAny(): Bot {
  const bot = new Bot('1-1');
  for (let k = 0; k < 40 && bot.world.state !== 'clear'; k++) bot.walkTo(305, 400);
  return bot;
}

/** 走到某个像素 x（站在地上），用小步调整 */
function stepTo(bot: Bot, x: number): void {
  for (let i = 0; i < 240; i++) {
    const dx = x - bot.p.body.centerX;
    if (Math.abs(dx) <= 1 && Math.abs(bot.p.vx) < 5) return;
    bot.step(Math.abs(dx) <= 1 ? 0 : dx > 0 ? BTN.right : BTN.left);
  }
}

/** 全收集路线：风铃、隐藏铃砖、踩蓝钳弹上高台，三枚海玻璃都拿到 */
export function routeFull(): Bot {
  const bot = new Bot('1-1');
  const w = bot.world;
  // ① 风铃：按"大、小、中、大"跳起来碰响
  bot.walkTo(48);
  const ch = w.chimes!;
  const holdFor = [3, 9, 13];
  for (const i of CHIME_SEQUENCE) {
    const r = ch.rects[i]!;
    stepTo(bot, r.x + r.w / 2);
    bot.jump(holdFor[i]!);
    bot.hold(0, 4);
  }
  if (!w.flags.has('chimesSolved')) throw new Error('风铃没解开');
  // 海玻璃从木架上弹出来，落在右边地上，走过去捡
  bot.hold(0, 40);
  bot.walkTo(56);
  if (!w.stats.glass[0]) throw new Error('没拿到海玻璃 ①');

  // ② 隐藏铃砖：站在台阶顶平台的第 242 列，满跳撞出来，海玻璃往右弹，走过去捡
  bot.walkTo(242);
  stepTo(bot, 242 * TILE + 8);
  bot.jump(20);
  bot.hold(0, 50);
  bot.walkTo(245);
  if (!w.stats.glass[1]) throw new Error('没拿到海玻璃 ②');

  // ③ 高台：在第二座小岛上踩蓝钳弹起来，往高台中间飘
  bot.walkTo(254);
  stepTo(bot, 254 * TILE + 8);
  const ledgeX = 256 * TILE + 16;
  let best: Bot | null = null;
  search: for (let wait = 0; wait < 160; wait += 2) {
    for (const tap of [2, 4, 7]) {
      const b = bot.fork();
      b.hold(0, wait);
      if (!b.p.onGround) continue;
      b.hold(BTN.jump, tap);
      b.step(0);
      for (let i = 0; i < 110; i++) {
        const dx = ledgeX - b.p.body.centerX;
        const steer = Math.abs(dx) < 3 ? 0 : dx > 0 ? BTN.right : BTN.left;
        b.step(BTN.jump | steer);
        if (b.world.stats.glass[2]) break;
      }
      if (b.world.stats.glass[2] && b.world.hearts === 3) {
        best = b;
        break search;
      }
    }
  }
  if (!best) throw new Error('踩蓝钳弹上高台没成功');
  // 从高台往右走下来，继续通关
  for (let k = 0; k < 40 && best.world.state !== 'clear'; k++) best.walkTo(305, 400);
  return best;
}
