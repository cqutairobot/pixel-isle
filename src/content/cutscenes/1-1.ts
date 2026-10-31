import { EASE, type Director } from '../../scenes/cutscene/director';
import { TILE } from '../../sim/constants';
import {
  BAILU_MEET,
  BELLTOWER,
  BELLTOWER_TIP,
  INTRO,
  PROLOGUE,
  PROLOGUE_CAPTION,
} from '../dialog/1-1';

/**
 * 第 1 关的过场分镜（docs/levels/1-1.md §4）。只管"演"：世界在过场期间不动，
 * 过场结束后套用 endStates.ts 里的结束状态，所以看完和跳过的结果一样。
 * 坐标都是世界像素；村庄地面顶在 y = 192，沙滩地面顶在 y = 224。
 */

const GROUND = 12 * TILE;
/** 钟楼（装饰 tower 在第 70 列，80×176）：大钟的中心、四个挂钩、亭子的横梁 */
const TOWER_X = 70 * TILE;
const BELL = { x: TOWER_X + 40, y: 16 + 50 };
const HOOKS = [20, 28, 52, 60].map((dx) => TOWER_X + dx);
const BEAM_Y = 16 + 31;
/** 爷爷（冰雕）站的位置：第 68 列的中心 */
const STATUE_X = 68 * TILE + 8;
const HUIHUI_FACES = { happy: 'npc/huihui_happy', worry: 'npc/huihui_worry' };
const HUIHUI_IDLE = ['npc/huihui_idle_0', 'npc/huihui_idle_1'];

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

function snow(d: Director, x: number, y: number, n: number, spread = 30): void {
  d.burst(n, () => ({
    x: x + rnd(-spread, spread),
    y: y + rnd(-spread / 2, spread / 2),
    vx: rnd(-30, 30),
    vy: rnd(-20, 25),
    drag: 1.5,
    life: rnd(0.6, 1.2),
    frames: [Math.random() < 0.4 ? 'fx2/snow_1' : 'fx2/snow_0'],
    fade: true,
  }));
}

/** 1-1 开场：小满推门出来，伸个懒腰（结束状态为空：最后站回出生点） */
export async function intro(d: Director): Promise<void> {
  const x0 = d.hero.x;
  d.letterbox(true);
  d.showHero(false);
  d.hero.x = x0 - 14;
  await d.wait(0.7);
  d.sfx('door', { volume: 0.5, rate: 1.4 });
  d.showHero(true);
  d.burst(5, (i) => ({
    x: x0 - 14 + (i - 2) * 3,
    y: d.hero.y - 2,
    vx: (i - 2) * 12,
    vy: -12,
    drag: 3,
    life: 0.4,
    frames: ['fx2/puff_1', 'fx2/puff_0'],
  }));
  await d.walk(x0, 34);
  await d.wait(0.25);
  for (let i = 0; i < 2; i++) {
    d.pose('stretch_0');
    await d.wait(0.4);
    d.pose('stretch_1');
    await d.wait(0.4);
  }
  d.pose(null);
  await d.say([INTRO[0]!]);
  // 左看看、右看看
  d.face(-1);
  await d.wait(0.35);
  d.face(1);
  d.emote('hero', 'q');
  await d.wait(0.5);
  await d.say([INTRO[1]!]);
  d.emote('hero', 'bang', 0.8);
  await d.wait(0.35);
  await d.say([INTRO[2]!]);
  d.letterbox(false);
}

/** 钟楼前：爷爷被冻住、回回登场 */
export async function belltower(d: Director): Promise<void> {
  d.letterbox(true);
  d.music(null);
  d.sfx('wind', { volume: 0.6 });
  await d.wait(0.4);
  // 镜头沿着钟楼往上：结满冰霜的大钟一动不动，四个挂钩都空了（略高出地图顶边，塔尖不被黑边挡住）
  d.allowAbove = true;
  await d.camera(BELL.x - 6, 94, 1.8);
  d.burst(6, (i) => ({
    x: HOOKS[i % 4]! + rnd(-2, 2),
    y: 58 + rnd(-3, 3),
    vy: 6,
    life: 0.7,
    frames: ['fx2/snow_1', 'fx2/snow_0'],
    fade: true,
  }));
  await d.wait(1.1);
  await d.camera(d.hero.x + 40, 170, 1.3);
  await d.say(BELLTOWER[0]!);
  d.emote('hero', 'bang', 0.9);
  await d.wait(0.5);
  await d.walk(67 * TILE + 8, 110);
  await d.wait(0.3);
  await d.say(BELLTOWER[1]!);
  await d.wait(0.5);
  // 大钟里亮起一点微光，"叮——"，一个小铃铛飘了出来
  d.spawn('light', 'npc/glow', BELL.x, BELL.y, {
    origin: [0.5, 0.5],
    add: true,
    alpha: 0,
    scale: 0.6,
    depth: 9,
  });
  d.sfx('bell', { rate: 1.6, volume: 0.9 });
  await d.camera(BELL.x - 30, 130, 0.8);
  await d.tweenProp('light', { alpha: 0.9, scale: 1.5 }, 0.6, EASE.out);
  d.spawn('huihui', 'npc/huihui_idle_0', BELL.x, BELL.y + 4, {
    origin: [0.5, 0.5],
    scale: 0,
    depth: 12,
    head: 7,
    frames: HUIHUI_IDLE,
    fps: 2,
    bob: 1.5,
    glow: true,
    faces: HUIHUI_FACES,
  });
  sparkles(d, BELL.x, BELL.y + 4, 8);
  void d.tweenProp('light', { alpha: 0, scale: 2.2 }, 0.9);
  await d.tweenProp('huihui', { scale: 1 }, 0.35, EASE.back);
  const hx = d.hero.x + 16;
  const hy = d.hero.y - 30;
  const fly = d.arc('huihui', hx, hy, 14, 1.5);
  const cam = d.camera(hx - 10, 165, 1.5);
  for (let i = 0; i < 9; i++) {
    const at = d.where('huihui');
    if (at)
      d.burst(1, () => ({
        x: at.x + rnd(-3, 3),
        y: at.y + rnd(-3, 3),
        vy: 10,
        life: 0.5,
        frames: ['fx2/sparkle_1', 'fx2/sparkle_0'],
      }));
    await d.wait(0.16);
  }
  await d.all(fly, cam);
  d.remove('light');
  d.emote('hero', 'bang', 0.8);
  // 第 8 句"包在我身上"之后音乐重新响起
  await d.say(BELLTOWER[2]!, {
    onLine: (i, line) => {
      if (i === 1) d.pose('hurt');
      if (i === 2) d.pose(null);
      if (line.text.includes('包在我身上') && line.who === 'xiaoman') {
        d.music('beach');
        d.pose('victory_0');
      }
      if (line.who === 'huihui' && i === 8) d.pose(null);
    },
  });
  d.pose(null);
  // 回回飞到小满身后，之后一路跟着她
  await d.move('huihui', d.hero.x - 15, d.hero.y - 24, 0.6, EASE.out);
  d.letterbox(false);
  await d.release(0.8);
  d.toast(BELLTOWER_TIP);
}

/** 白露：检查点 ① 旁第一次见面 */
export async function bailu(d: Director): Promise<void> {
  d.letterbox(true);
  await d.wait(0.3);
  d.emote('bailu', 'bang', 0.9);
  await d.wait(0.5);
  await d.walk(145 * TILE + 8, 60);
  await d.wait(0.2);
  await d.say(BAILU_MEET);
  d.letterbox(false);
  await d.wait(0.3);
}

/** 序章「霜夜」：同一张地图的夜晚 */
export async function prologue(d: Director): Promise<void> {
  d.allowAbove = true;
  d.showHero(false);
  await d.fade(1, 0);
  await d.camera(BELL.x, -60, 0);
  d.music('night');
  await d.wait(0.8);
  // 夜空和星星，镜头缓缓下移到钟楼
  const fadeIn = d.fade(0, 2.2);
  const pan = d.camera(BELL.x, 112, 7, EASE.inOut);
  await d.wait(1.4);
  await d.say(PROLOGUE[0]!, { place: 'bottom' });
  await d.all(pan, fadeIn);
  // 一阵冷风吹灭了灯火
  d.sfx('wind');
  d.signal('lightsOut');
  d.burst(18, () => ({
    x: BELL.x + rnd(-150, 230),
    y: rnd(40, 180),
    vx: rnd(-90, -50),
    vy: rnd(-5, 10),
    life: rnd(1, 1.8),
    frames: ['fx2/snow_0'],
    fade: true,
  }));
  await d.wait(1.2);
  // 一个高瘦的身影出现在钟楼的横梁上
  const sjX = TOWER_X + 66;
  snow(d, sjX, BEAM_Y - 16, 14, 12);
  d.sfx('freeze', { volume: 0.5, rate: 0.7 });
  d.spawn('sj', 'npc/shuangjiang_0', sjX, BEAM_Y, {
    flip: true,
    alpha: 0,
    head: 34,
    depth: 7,
    frames: ['npc/shuangjiang_0', 'npc/shuangjiang_1'],
    fps: 1.5,
  });
  await d.tweenProp('sj', { alpha: 1 }, 0.9);
  await d.say(PROLOGUE[1]!);
  // 四枚时令铃一枚接一枚飞进他手里，一声比一声弱
  const hand = { x: sjX - 6, y: BEAM_Y - 18 };
  const kinds = ['spring', 'summer', 'autumn', 'winter'];
  for (let i = 0; i < 4; i++) {
    const id = `bell${i}`;
    d.spawn(id, `npc/bell_${kinds[i]}`, HOOKS[i]!, 60, { depth: 8 });
    d.sfx('bell', { rate: 1.25 - i * 0.08, volume: 0.9 - i * 0.2 });
    d.sfx('whoosh', { volume: 0.4 });
    await d.arc(id, hand.x + (i - 1.5) * 3, hand.y, 12, 0.55);
    if (i !== 1) d.remove(id);
    await d.wait(0.2);
  }
  // 一只小寄居蟹从屋檐下爬过
  d.spawn('crab', 'npc/hermit_0', TOWER_X - 90, GROUND, {
    depth: 6,
    head: 13,
    frames: ['npc/hermit_0', 'npc/hermit_1'],
    fps: 6,
  });
  await d.move('crab', STATUE_X + 8, GROUND, 2.4, EASE.linear);
  d.cycle('crab', ['npc/hermit_0']);
  d.emote('crab', 'q', 0.9);
  await d.say(PROLOGUE[2]!);
  d.frame('sj', 'npc/shuangjiang_cast');
  d.sfx('whoosh');
  await d.arc('bell1', STATUE_X + 6, GROUND - 6, 26, 0.75);
  d.remove('bell1');
  d.frame('crab', 'npc/hermit_bell_0');
  d.sfx('freeze');
  d.burst(10, (i) => ({
    x: STATUE_X + 6,
    y: GROUND - 8,
    vx: Math.cos((i / 10) * Math.PI * 2) * 50,
    vy: Math.sin((i / 10) * Math.PI * 2) * 50 - 20,
    gravity: 200,
    life: 0.6,
    frames: ['fx2/shard_0', 'fx2/shard_1', 'fx2/shard_2'],
    fps: 12,
  }));
  await d.wait(0.6);
  d.cycle('sj', ['npc/shuangjiang_0', 'npc/shuangjiang_1'], 1.5);
  d.cycle('crab', ['npc/hermit_bell_0', 'npc/hermit_bell_1'], 6);
  await d.move('crab', TOWER_X + 260, GROUND, 2.6, EASE.in);
  d.remove('crab');
  // 钟楼的门砰地打开，钟爷爷提着灯笼冲出来
  d.sfx('door');
  d.shake(0.25);
  d.spawn('grandpa', 'npc/grandpa', TOWER_X + 30, GROUND, { depth: 6, head: 25, flip: true });
  await d.move('grandpa', STATUE_X, GROUND, 0.7, EASE.out);
  d.flip('grandpa', false);
  d.emote('grandpa', 'bang', 0.8);
  await d.wait(0.3);
  await d.say(PROLOGUE[3]!);
  // 霜降一挥袖，寒气扑面而来
  d.frame('sj', 'npc/shuangjiang_cast');
  d.sfx('whoosh');
  d.burst(24, () => ({
    x: sjX - 10 + rnd(-6, 6),
    y: BEAM_Y - 18 + rnd(-6, 6),
    vx: rnd(-180, -110),
    vy: rnd(60, 130),
    life: rnd(0.5, 0.8),
    frames: [Math.random() < 0.5 ? 'fx2/snow_1' : 'fx2/snow_0'],
    fade: true,
  }));
  await d.wait(0.5);
  d.frame('grandpa', 'npc/grandpa_frozen');
  d.sfx('freeze');
  d.shake(0.45);
  await d.fade(0.6, 0.06);
  await d.fade(0, 0.3);
  await d.wait(1.0);
  // 霜降化作一阵雪花消失，冰霜从钟楼向四周蔓延
  snow(d, sjX, BEAM_Y - 16, 22, 14);
  d.sfx('wind', { volume: 0.8 });
  await d.tweenProp('sj', { alpha: 0 }, 0.7);
  d.remove('sj');
  d.signal('frost');
  await d.wait(1.6);
  await d.fade(1, 1.4);
  d.music(null);
  await d.caption(PROLOGUE_CAPTION, 2.4);
}

export const CUTSCENES: Record<string, (d: Director) => Promise<void>> = {
  intro,
  belltower,
  bailu,
  prologue,
};
