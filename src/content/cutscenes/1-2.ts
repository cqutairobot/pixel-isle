import { EASE, type Director } from '../../scenes/cutscene/director';
import { TILE } from '../../sim/constants';
import { STARFISH_GET, STARFISH_OPENING } from '../dialog/1-2';

/**
 * 第 2 关的过场分镜（docs/levels/1-2.md §4）。只管"演"：世界在过场期间不动，
 * 过场结束后套用 endStates.ts 里的结束状态，所以看完和跳过的结果一样。
 * 坐标都是世界像素；椰林地面顶在 y = 448。
 */

const GROUND = 28 * TILE;
/** 白露站在第 11 列；她身后那棵椰子树（装饰 palm，第 13 列）的树冠中心 */
const BAILU_X = 11 * TILE + 8;
const CROWN = { x: 223, y: 384 };
const STAR = Array.from({ length: 8 }, (_, i) => `equip/star_${i}`);

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function sparkles(d: Director, x: number, y: number, n: number, r = 40): void {
  d.burst(n, (i) => {
    const a = (i / n) * Math.PI * 2;
    return {
      x,
      y,
      vx: Math.cos(a) * r,
      vy: Math.sin(a) * r,
      drag: 3,
      life: 0.5,
      frames: ['fx2/sparkle_2', 'fx2/sparkle_1', 'fx2/sparkle_0'],
    };
  });
}

function leaves(d: Director, x: number, y: number, n: number): void {
  d.burst(n, () => ({
    x: x + rnd(-14, 14),
    y: y + rnd(-6, 4),
    vx: rnd(-20, 20),
    vy: rnd(-30, 10),
    gravity: 90,
    life: rnd(0.8, 1.2),
    frames: ['fx2/leafg_0', 'fx2/leafg_1', 'fx2/leafg_2', 'fx2/leafg_1'],
    fps: 7,
    fade: true,
  }));
}

/** 1-2 开场「白露的海星」：白露示范扔海星打下椰子，然后把海星借给小满 */
export async function starfish(d: Director): Promise<void> {
  d.letterbox(true);
  // 白露换成演出精灵（要摆扔、接的姿势）
  d.signal('npc:bailu:hide');
  d.spawn('bailu', 'npc/bailu_idle_0', BAILU_X, GROUND, { flip: true, head: 22, depth: 6 });
  d.spawn('star', 'equip/star_0', BAILU_X - 6, GROUND - 20, {
    origin: [0.5, 0.5],
    depth: 7,
    frames: STAR,
    fps: 6,
  });
  // 镜头对准小满、白露和椰子树中间（camera 给的是画面中心）
  await d.camera(BAILU_X + 4, GROUND - 40, 0.6);
  // 白露把海星往上抛着玩
  for (let i = 0; i < 2; i++) {
    await d.move('star', BAILU_X - 6, GROUND - 34, 0.22, EASE.out);
    await d.move('star', BAILU_X - 6, GROUND - 20, 0.22, EASE.in);
  }
  await d.say(STARFISH_OPENING[0]!);
  // 转身、蓄力、扔向树冠
  d.flip('bailu', false);
  d.frame('bailu', 'npc/bailu_throw_0');
  d.cycle('star', STAR, 24);
  await d.move('star', BAILU_X - 4, GROUND - 14, 0.18, EASE.out);
  d.frame('bailu', 'npc/bailu_throw_1');
  d.sfx('throw');
  await d.move('star', CROWN.x, CROWN.y, 0.32, EASE.out);
  // "咚"：打下一个椰子，海星划个弧线往回飞
  d.sfx('coconut', { rate: 0.8 });
  d.shake(0.1);
  leaves(d, CROWN.x, CROWN.y, 6);
  d.spawn('nut', 'grove/coconut', CROWN.x, CROWN.y + 4, { origin: [0.5, 0.5], depth: 7 });
  const huiX = d.hero.x - 15;
  const nutFall = d.arc('nut', huiX + 14, GROUND - 5, 26, 0.8);
  const starBack = d.arc('star', BAILU_X + 6, GROUND - 16, 22, 0.7);
  await d.wait(0.45);
  d.emote('huihui', 'bang', 0.9);
  await starBack;
  d.frame('bailu', 'npc/bailu_catch');
  d.cycle('star', STAR, 6);
  d.sfx('catch');
  sparkles(d, BAILU_X + 6, GROUND - 16, 5, 30);
  await nutFall;
  // 椰子落在回回旁边弹一下，裂开
  d.sfx('coconut', { volume: 0.7, rate: 1.15 });
  await d.arc('nut', huiX + 8, GROUND - 5, 10, 0.3);
  d.sfx('coconutBreak');
  d.burst(6, (i) => ({
    x: huiX + 8,
    y: GROUND - 6,
    vx: rnd(-70, 70),
    vy: rnd(-150, -70),
    gravity: 600,
    life: rnd(0.5, 0.8),
    frames: [`grove/shard_${i % 2}`],
    fade: true,
  }));
  d.remove('nut');
  await d.wait(0.2);
  d.frame('bailu', 'npc/bailu_idle_0');
  await d.say(STARFISH_OPENING[1]!);
  // 把海星抛给小满
  d.flip('bailu', true);
  d.frame('bailu', 'npc/bailu_throw_1');
  d.sfx('throw', { rate: 0.9 });
  d.cycle('star', STAR, 18);
  await d.arc('star', d.hero.x, d.hero.y - 18, 22, 0.55);
  d.frame('bailu', 'npc/bailu_idle_0');
  d.sfx('catch');
  d.pose('catch');
  await d.wait(0.2);
  // 拿到道具（完整的演出在 M2-b）：海星一边转一边升起来，闪闪发光
  d.pose('victory_0');
  d.spawn('glow', 'npc/glow', d.hero.x, d.hero.y - 36, {
    origin: [0.5, 0.5],
    add: true,
    alpha: 0,
    scale: 0.6,
    depth: 6.5,
  });
  void d.tweenProp('glow', { alpha: 0.8, scale: 1.6 }, 0.5, EASE.out);
  d.cycle('star', STAR, 10);
  d.sfx('glass');
  await d.move('star', d.hero.x, d.hero.y - 36, 0.5, EASE.out);
  sparkles(d, d.hero.x, d.hero.y - 36, 10, 60);
  d.toast(STARFISH_GET);
  await d.wait(1.1);
  void d.tweenProp('glow', { alpha: 0 }, 0.3);
  await d.move('star', d.hero.x, d.hero.y - 10, 0.25, EASE.in);
  d.remove('star');
  d.pose(null);
  await d.say(STARFISH_OPENING[2]!, {
    onLine: (i) => {
      if (i === 1) d.pose('victory_0');
      if (i === 2) d.pose(null);
    },
  });
  d.pose(null);
  d.remove('glow');
  d.letterbox(false);
  await d.release(0.6);
}

export const CUTSCENES_12: Record<string, (d: Director) => Promise<void>> = { starfish };
