import '@fontsource/fusion-pixel-12px-proportional-sc';
import Phaser from 'phaser';
import { mountSoundboard } from './audio/soundboard';
import { currentLayout } from './platform/display';
import { BootScene } from './scenes/BootScene';
import { GymScene } from './scenes/GymScene';

const params = new URLSearchParams(location.search);
/** 页面路由：#soundboard 打开试听板（在线试玩页不支持 ?参数，只能用 #名字） */
const route = location.hash.slice(1);
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
    scene: [BootScene, GymScene],
  });
  window.addEventListener('resize', () => {
    const next = currentLayout();
    game.scale.resize(next.devW, next.devH);
    game.scale.setZoom(1 / next.dpr);
    game.events.emit('layout', next);
  });
}

if (route === 'soundboard' || params.get('scene') === 'soundboard') mountSoundboard();
else startGame();
