import { describe, expect, it } from 'vitest';
import {
  MAP_NODES,
  MAP_PATHS,
  MAP_SHOP,
  mapUnlocked,
  nodeState,
  pathsToReveal,
  stepNode,
} from '../src/content/map';
import { emptySave, recordClear, remember } from '../src/platform/save';

const W = 384;
const H = 216;

describe('章节地图', () => {
  it('节点、路、冰沙摊都在画面里；路连接相邻两关，小圆点间距均匀', () => {
    for (const n of [...MAP_NODES, MAP_SHOP]) {
      expect(n.x).toBeGreaterThan(8);
      expect(n.x).toBeLessThan(W - 8);
      expect(n.y).toBeGreaterThan(24);
      expect(n.y).toBeLessThan(H - 8);
    }
    expect(MAP_PATHS.map((p) => `${p.from}>${p.to}`)).toEqual([
      '1-1>1-2',
      '1-2>1-3',
      '1-3>1-4',
      '1-4>1-5',
    ]);
    for (const p of MAP_PATHS) {
      expect(p.dots.length).toBeGreaterThanOrEqual(4);
      for (let i = 1; i < p.dots.length; i++) {
        const [x0, y0] = p.dots[i - 1]!;
        const [x1, y1] = p.dots[i]!;
        const d = Math.hypot(x1 - x0, y1 - y0);
        expect(d).toBeGreaterThan(5);
        expect(d).toBeLessThan(13);
      }
    }
  });

  it('新存档：只有 1-1 能去，地图还没开放', () => {
    const s = emptySave();
    expect(nodeState(s, '1-1')).toBe('open');
    expect(nodeState(s, '1-2')).toBe('locked');
    expect(mapUnlocked(s)).toBe(false);
    expect(pathsToReveal(s)).toEqual([]);
    expect(stepNode(s, '1-1', 1)).toBeNull();
    expect(stepNode(s, '1-1', -1)).toBeNull();
  });

  it('通关 1-1：路通到 1-2，播放一次解锁动画；1-3 还锁着', () => {
    const s = emptySave();
    recordClear(s, '1-1', 3000, 10, false);
    expect(mapUnlocked(s)).toBe(true);
    expect(nodeState(s, '1-1')).toBe('cleared');
    expect(nodeState(s, '1-2')).toBe('open');
    expect(nodeState(s, '1-3')).toBe('locked');
    expect(pathsToReveal(s)).toEqual(['1-2']);
    remember(s.map.opened, '1-2');
    expect(pathsToReveal(s)).toEqual([]);
    expect(stepNode(s, '1-1', 1)).toBe('1-2');
    expect(stepNode(s, '1-2', 1)).toBeNull();
    expect(stepNode(s, '1-2', -1)).toBe('1-1');
  });

  it('通关 1-2：路通到 1-3，可以进；通关 1-3：路通到 1-4，但 1-4 还在做（正在制作中）', () => {
    const s = emptySave();
    recordClear(s, '1-1', 3000, 10, false);
    recordClear(s, '1-2', 5000, 20, false);
    expect(nodeState(s, '1-3')).toBe('open');
    expect(nodeState(s, '1-4')).toBe('locked');
    expect(pathsToReveal(s)).toEqual(['1-2', '1-3']);
    expect(stepNode(s, '1-2', 1)).toBe('1-3');
    recordClear(s, '1-3', 6000, 30, false);
    expect(nodeState(s, '1-3')).toBe('cleared');
    expect(nodeState(s, '1-4')).toBe('soon');
    expect(stepNode(s, '1-3', 1)).toBe('1-4');
  });
});
