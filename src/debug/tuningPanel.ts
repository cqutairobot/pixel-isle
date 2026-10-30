import type GUI from 'lil-gui';
import type { CameraTuning } from '../sim/camera';
import type { Tuning } from '../sim/tuning';
import type { Shake } from '../view/shake';

export interface TuningPanelOptions {
  tuning: Tuning;
  camera: CameraTuning;
  shake: Shake;
  onChange: () => void;
  onExport: () => void;
}

type Spec = [keyof Tuning, string, number, number, number];

const MOVE: Spec[] = [
  ['walkSpeed', '走速 px/s', 40, 200, 1],
  ['runSpeed', '跑速 px/s', 60, 260, 1],
  ['accelFramesToWalk', '起步帧数', 1, 30, 1],
  ['accelFramesWalkToRun', '走→跑帧数', 1, 90, 1],
  ['decelFramesFromWalk', '停下帧数', 1, 30, 1],
  ['turnDecelMul', '转身减速倍数', 1, 5, 0.1],
  ['skidThreshold', '急停阈值 px/s', 0, 200, 1],
  ['airAccelMul', '空中加速比例', 0.1, 1.5, 0.05],
  ['airDrag', '空中阻力', 0, 1200, 10],
];
const JUMP: Spec[] = [
  ['jumpHeightTiles', '最高跳（格）', 2, 7, 0.05],
  ['jumpTimeToApex', '到顶点时间 s', 0.2, 0.7, 0.01],
  ['runJumpBonus', '满跑额外起跳', 0, 120, 1],
  ['jumpCutMul', '松键截断乘数', 0.1, 1, 0.05],
  ['apexThreshold', '顶点悬停阈值', 0, 150, 1],
  ['apexGravityMul', '顶点重力乘数', 0.1, 1, 0.05],
  ['fallGravityMul', '下落重力乘数', 1, 3.5, 0.05],
  ['maxFall', '最大下落 px/s', 120, 700, 5],
  ['fastFallMul', '按↓加速下落', 1, 2, 0.05],
];
const FORGIVE: Spec[] = [
  ['coyoteFrames', '土狼时间（帧）', 0, 15, 1],
  ['bufferFrames', '跳跃缓冲（帧）', 0, 15, 1],
  ['cornerCorrection', '撞头修正 px', 0, 8, 1],
  ['ledgeAssist', '边缘辅助 px', 0, 8, 1],
];

/** 调参面板（lil-gui，按需加载）。改动立即生效，可导出 JSON 发给 Claude。 */
export async function createTuningPanel(o: TuningPanelOptions): Promise<GUI> {
  const { default: GUIClass } = await import('lil-gui');
  const gui = new GUIClass({ title: '调参面板（T 关闭）' });
  gui.domElement.style.zIndex = '20';
  const add = (folder: GUI, specs: Spec[]) => {
    for (const [key, label, min, max, step] of specs) {
      folder.add(o.tuning, key, min, max, step).name(label).listen().onChange(o.onChange);
    }
  };
  add(gui.addFolder('移动'), MOVE);
  add(gui.addFolder('跳跃'), JUMP);
  add(gui.addFolder('宽容'), FORGIVE);
  const cam = gui.addFolder('镜头');
  cam.add(o.camera, 'lookAhead', 0, 120, 1).name('前瞻 px');
  cam.add(o.camera, 'lookAheadRun', 0, 160, 1).name('满跑前瞻 px');
  cam.add(o.camera, 'followSmooth', 0.02, 1, 0.01).name('水平平滑 s');
  cam.add(o.camera, 'lookSmooth', 0.05, 2, 0.05).name('前瞻平滑 s');
  cam.add(o.camera, 'deadzone', 0, 64, 1).name('死区 px');
  cam.add(o.camera, 'groundLine', 0.4, 0.9, 0.01).name('地面线位置');
  cam.add(o.camera, 'ySmooth', 0.02, 1, 0.01).name('竖直平滑 s');
  cam.add(o.shake, 'intensity', 0, 1.5, 0.05).name('震屏强度');
  cam.close();
  gui.add({ export: o.onExport }, 'export').name('复制参数 JSON');
  return gui;
}
