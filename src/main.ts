import '@fontsource/fusion-pixel-12px-proportional-sc';
import Phaser from 'phaser';
import { mountSoundboard } from './audio/soundboard';
import { currentLayout } from './platform/display';
import { BootScene, type BootTarget } from './scenes/BootScene';
import { GymScene } from './scenes/GymScene';
import { LevelScene } from './scenes/LevelScene';
import { TitleScene } from './scenes/TitleScene';
import { UIScene } from './scenes/UIScene';

const params = new URLSearchParams(location.search);
/**
 * 页面路由（在线试玩页不支持 ?参数，只能用 #名字）：
 * 默认进标题画面；#1-1 直接进第 1 关；#prologue 序章；#gym 练习场；#soundboard 试听板。
 * 本地开发还可以用 ?level=1-1、?cp=2（从第 2 个检查点开始）、?intro=0（不播开场）。
 */
const route = location.hash.slice(1);

function bootTarget(): BootTarget {
  if (route === 'gym' || params.get('scene') === 'gym') return { scene: 'gym' };
  if (route === 'prologue') return { scene: 'level', data: { levelId: '1-1', mode: 'prologue' } };
  const level = params.get('level') ?? (/^\d+-\d+$/.test(route) ? route : null);
  if (!level) return { scene: 'title', data: { boot: true } };
  const cp = Number(params.get('cp') ?? 0);
  // ?intro=0：不播放开场过场（测试用）
  const intro = params.get('intro') !== '0';
  return { scene: 'level', data: { levelId: level, checkpoint: cp || undefined, intro } };
}
window.addEventListener('hashchange', () => location.reload());

function startGame(): void {
  const L = currentLayout();
  // 平滑像素（默认）：支持挤压拉伸与亚像素移动；?render=round 切换为取整像素，便于对比
  const render = params.get('render') === 'round' ? { pixelArt: true } : { smoothPixelArt: true };
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: L.devW,
    height: L.devH,
    backgroundColor: '#1a1c2c',
    render,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / L.dpr },
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    fps: { smoothStep: false },
    banner: false,
    // 界面场景排在最后，画在最上面
    scene: [BootScene, TitleScene, GymScene, LevelScene, UIScene],
  });
  game.registry.set('bootTarget', bootTarget());
  window.addEventListener('resize', () => {
    const next = currentLayout();
    game.scale.resize(next.devW, next.devH);
    game.scale.setZoom(1 / next.dpr);
    game.events.emit('layout', next);
  });
}

if (route === 'soundboard' || params.get('scene') === 'soundboard') mountSoundboard();
else startGame();
