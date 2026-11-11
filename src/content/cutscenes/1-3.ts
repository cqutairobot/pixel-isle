import { EASE, type Director } from '../../scenes/cutscene/director';
import { TILE } from '../../sim/constants';
import { GUYU_PLEA, GUYU_THANKS, GUYU_THANKS_PETTED, MIELING_FREE } from '../dialog/1-3';

/**
 * 第 3 关的过场分镜（docs/levels/1-3.md §4）。只管"演"：世界在过场期间不动，
 * 过场结束后套用 endStates.ts 里的结束状态，所以看完和跳过的结果一样。
 * 坐标都是世界像素：A 段地面顶在 y = 448，山脊顶在 y = 160。
 */

const GROUND = 28 * TILE;
const RIDGE = 10 * TILE;
/** 羊圈（咩铃被冻在里面）、开场的谷雨、石门、回声洞里咩铃跑到的位置、铃门旁边的谷雨 */
const PEN_X = 31 * TILE + 8;
const GUYU_X = 26 * TILE + 8;
const GATE_X = 189 * TILE;
const ECHO_GOAT_X = 197 * TILE + 8;
const END_GUYU_X = 352 * TILE + 8;

const RUN = ['goat/run_0', 'goat/run_1', 'goat/run_2', 'goat/run_3'];

/** 开场「谷雨的请求」：谷雨蹲在结冰的羊圈前哭；镜头移到羊圈，咩铃在里面不服气地跺脚 */
export async function guyu(d: Director): Promise<void> {
  d.letterbox(true);
  await d.camera((d.hero.x + PEN_X) / 2, GROUND - 40, 0.6);
  d.emote('guyu', 'dots', 1.2);
  await d.wait(0.5);
  await d.say(GUYU_PLEA[0]!);
  await d.camera(PEN_X, GROUND - 48, 0.8);
  d.sfx('goatStartle', { volume: 0.6 });
  d.emote('mieling', 'bang', 1);
  await d.wait(0.6);
  await d.say(GUYU_PLEA[1]!);
  d.letterbox(false);
  await d.release(0.6);
}

/** 「咩铃出圈」：冰晶碎了，咩铃冲出来绕着谷雨跑一圈，低头请小满骑上去；"新伙伴"演出 */
export async function rescue(d: Director): Promise<void> {
  d.letterbox(true);
  // 小满从羊圈顶上跳下来，站到羊圈左边（和结束状态一样）
  await d.fade(1, 0.2);
  d.hero.x = 29 * TILE + 8;
  d.hero.y = GROUND;
  d.face(1);
  d.signal('goat:hide');
  d.signal('npc:guyu:hide');
  d.spawn('goat', 'goat/idle_0', PEN_X, GROUND, { flip: true, head: 20, depth: 8.5 });
  d.spawn('guyu', 'npc/guyu_idle_0', GUYU_X, GROUND, { head: 21, depth: 6 });
  await d.camera(PEN_X - 40, GROUND - 40, 0);
  await d.fade(0, 0.3);
  // 蹦出羊圈，绕着谷雨跑一圈
  d.sfx('goatMount');
  d.cycle('goat', RUN, 12);
  await d.arc('goat', PEN_X + 10, GROUND, 18, 0.35);
  d.flip('goat', true);
  await d.move('goat', GUYU_X - 20, GROUND, 0.7, EASE.linear);
  d.flip('goat', false);
  d.sfx('goatBell');
  await d.move('goat', d.hero.x - 6, GROUND, 0.45, EASE.linear);
  // 用脑袋顶了小满一下
  d.sfx('bonk', { volume: 0.6 });
  d.pose('hurt');
  d.shake(0.08);
  await d.wait(0.25);
  d.pose(null);
  d.cycle('goat', ['goat/happy'], 1);
  d.frame('guyu', 'npc/guyu_hug');
  await d.say(MIELING_FREE[0]!);
  // 走到小满面前，低下头
  d.cycle('goat', RUN, 10);
  d.flip('goat', true);
  await d.move('goat', PEN_X, GROUND, 0.4, EASE.out);
  d.cycle('goat', ['goat/kneel'], 1);
  d.sfx('goatBell');
  d.frame('guyu', 'npc/guyu_idle_0');
  await d.say(MIELING_FREE[1]!);
  // 新伙伴演出
  d.pose('victory_0');
  await d.itemGet('mieling');
  d.pose(null);
  d.cycle('goat', ['goat/idle_0', 'goat/idle_1'], 2);
  await d.say(MIELING_FREE[2]!);
  // 谷雨跑去羊肠小道
  d.cycle('guyu', ['npc/guyu_run_0', 'npc/guyu_run_1'], 8);
  await d.move('guyu', GUYU_X - 220, GROUND, 1.4, EASE.in);
  d.remove('guyu');
  d.remove('goat');
  d.signal('goat:show');
  d.letterbox(false);
  await d.release(0.6);
}

/** 「回声」：回声扫过洞顶（照出隐藏铃砖），石门上的冰裂开、石门升起，咩铃从门下跑进来 */
export async function echo(d: Director): Promise<void> {
  d.letterbox(true);
  d.signal('echoReveal');
  await d.wait(1.1);
  await d.camera(GATE_X, GROUND - 48, 0.8);
  d.signal('gate:open');
  await d.wait(1.9);
  d.signal('goat:hide');
  d.spawn('goat', RUN[0]!, GATE_X - 24, GROUND, { head: 20, depth: 8.5, frames: RUN, fps: 12 });
  d.sfx('goatBell');
  const cam = d.camera((GATE_X + ECHO_GOAT_X) / 2 + 40, GROUND - 40, 1.1);
  await d.move('goat', ECHO_GOAT_X, GROUND, 1.1, EASE.out);
  await cam;
  d.cycle('goat', ['goat/idle_0', 'goat/idle_1'], 2);
  await d.say([{ who: 'huihui', text: '开了！开了！', face: 'happy' }]);
  d.remove('goat');
  d.signal('goat:show');
  d.letterbox(false);
  await d.release(0.6);
}

/** 结尾「谷雨的谢意」：咩铃跑回谷雨身边；谷雨道谢，说起拖着亮晶晶东西的大螃蟹 */
export async function thanks(d: Director): Promise<void> {
  d.letterbox(true);
  d.signal('npc:guyu_gate:hide');
  d.spawn('guyu', 'npc/guyu_wave_0', END_GUYU_X, RIDGE, {
    flip: true,
    head: 21,
    depth: 6,
    frames: ['npc/guyu_wave_0', 'npc/guyu_wave_1'],
    fps: 4,
  });
  await d.camera((d.hero.x + END_GUYU_X) / 2, RIDGE - 40, 0.6);
  d.signal('goat:hide');
  if (d.hero.mounted) {
    // 骑着来的：咩铃停下，小满跳下来
    d.spawn('goat', 'goat/idle_0', d.hero.x, RIDGE, { head: 20, depth: 8.5 });
    d.hero.mounted = false;
    d.sfx('goatDismount');
    await d.walk(d.hero.x - 18, 90);
    // 跳下来往后退了两步，再转回来看着谷雨
    d.face(1);
  } else {
    // 走着来的：咩铃从后面蹦进来
    d.spawn('goat', 'goat/jump', d.hero.x - 140, RIDGE - 30, { head: 20, depth: 8.5 });
    d.sfx('goatBell');
    await d.arc('goat', d.hero.x - 24, RIDGE, 30, 0.6);
  }
  d.cycle('goat', RUN, 12);
  await d.move('goat', END_GUYU_X - 22, RIDGE, 0.8, EASE.out);
  d.cycle('goat', ['goat/happy'], 1);
  d.cycle('guyu', ['npc/guyu_hug'], 1);
  d.sfx('goatPet');
  await d.say(GUYU_THANKS[0]!);
  d.cycle('guyu', ['npc/guyu_idle_0', 'npc/guyu_idle_1'], 2);
  // 谷雨想起什么：头上冒个"！"，转身朝东边（冻浪湾）一指，说起那只大螃蟹
  await d.wait(0.3);
  d.emote('guyu', 'bang', 0.9);
  d.sfx('emote');
  await d.wait(0.6);
  d.flip('guyu', false);
  d.cycle('guyu', ['npc/guyu_point'], 1);
  await d.wait(0.35);
  await d.say(GUYU_THANKS[1]!);
  d.flip('guyu', true);
  d.cycle('guyu', ['npc/guyu_idle_0', 'npc/guyu_idle_1'], 2);
  if (d.hasFlag('petted')) await d.say(GUYU_THANKS_PETTED);
  await d.say(GUYU_THANKS[2]!);
  d.remove('goat');
  d.remove('guyu');
  d.signal('goat:show');
  d.signal('npc:guyu_gate:show');
  d.letterbox(false);
  await d.release(0.6);
}

export const CUTSCENES_13: Record<string, (d: Director) => Promise<void>> = {
  guyu,
  rescue,
  echo,
  thanks,
};
