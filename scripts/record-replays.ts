/**
 * 用路线脚本里的"自动玩家"重新生成回放文件（关卡或手感改了、回放测试失败时运行）。
 * 用法：npm run replays
 * 重新生成后请在提交说明里写清原因（PLAN §2.10）。
 */
import { writeFileSync } from 'node:fs';
import { encodeInputs, type Replay } from '../src/sim/replay';
import { routeAny, routeFull } from '../tests/route/1-1';
import { routeAny as routeAny12, routeFull as routeFull12 } from '../tests/route/1-2';

const routes: Array<[string, string, () => ReturnType<typeof routeAny>]> = [
  ['tests/replays/1-1-any.json', '一路往右通关（反应式跳台阶、跳坑、跳螃蟹）', routeAny],
  ['tests/replays/1-1-full.json', '全收集：风铃旋律、隐藏铃砖、踩蓝钳弹上高台', routeFull],
  [
    'tests/replays/1-2-any.json',
    '通关：用海星打掉刺海胆和冰喙鸥，跳上高吊桥，沿大叶子爬到树冠顶',
    routeAny12,
  ],
  [
    'tests/replays/1-2-full.json',
    '全收集：岸边斜扔捞贝壳、满跳上鸥巢、海星钻树桩缝、起跳斜扔捞树冠外的海玻璃',
    routeFull12,
  ],
];

for (const [file, note, route] of routes) {
  const bot = route();
  const w = bot.world;
  if (w.state !== 'clear') throw new Error(`${file}：路线没有通关`);
  const replay: Replay = {
    version: 1,
    level: bot.levelId,
    preset: 'A',
    autoRun: false,
    note,
    frames: encodeInputs(bot.inputs),
  };
  writeFileSync(file, JSON.stringify(replay) + '\n');
  console.log(
    `${file}：${bot.inputs.length} 帧（${(w.stats.frames / 60).toFixed(1)} 秒），海玻璃 ${w.stats.glass.filter(Boolean).length}/3，剩 ${w.hearts} 心`,
  );
}
