import { describe, expect, it } from 'vitest';
import {
  addEquipment,
  emptySave,
  formatTime,
  loadSave,
  migrate,
  recordClear,
  recordGlass,
  SAVE_KEY,
  writeSave,
  type KV,
} from '../src/platform/save';

function memory(): KV & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('存档', () => {
  it('写入再读出，内容不变', () => {
    const kv = memory();
    const d = emptySave();
    recordGlass(d, '1-1', 2);
    expect(recordClear(d, '1-1', 9000, 42, true)).toBe(true);
    writeSave(d, kv);
    const back = loadSave(kv);
    expect(back.levels['1-1']).toEqual({
      cleared: true,
      bestFrames: 9000,
      glass: [false, false, true],
      noDamage: true,
    });
    expect(back.shells).toBe(42);
  });

  it('只有更快才刷新最佳用时', () => {
    const d = emptySave();
    recordClear(d, '1-1', 9000, 0, false);
    expect(recordClear(d, '1-1', 9500, 0, false)).toBe(false);
    expect(recordClear(d, '1-1', 8000, 0, false)).toBe(true);
    expect(d.levels['1-1']!.bestFrames).toBe(8000);
  });

  it('坏掉的存档：备份后从头开始，不会抛错', () => {
    const kv = memory();
    kv.setItem(SAVE_KEY, '{oops');
    expect(loadSave(kv)).toEqual(emptySave());
    expect(kv.map.get(`${SAVE_KEY}.broken`)).toBe('{oops');
  });

  it('迁移：丢掉看不懂的字段，补上缺的', () => {
    const d = migrate({
      shells: -5,
      flags: ['a', 3],
      levels: { '1-1': { cleared: true, glass: [true] }, x: 7 },
    });
    expect(d.shells).toBe(0);
    expect(d.flags).toEqual(['a']);
    expect(d.levels['1-1']).toEqual({
      cleared: true,
      bestFrames: null,
      glass: [true, false, false],
      noDamage: false,
    });
    expect(d.levels.x).toBeUndefined();
  });

  it('v1 → v2：海星从剧情标记挪进装备，其他标记和关卡记录都保留', () => {
    const v1 = {
      version: 1,
      shells: 57,
      flags: ['introSeen', 'starfish', 'talk:haishen'],
      levels: { '1-1': { cleared: true, bestFrames: 4321, glass: [true, false, true] } },
    };
    const d = migrate(v1);
    expect(d.version).toBe(2);
    expect(d.equipment).toEqual(['starfish']);
    expect(d.flags).toEqual(['introSeen', 'talk:haishen']);
    expect(d.shells).toBe(57);
    expect(d.levels['1-1']!.bestFrames).toBe(4321);
    // 地图从第一个节点开始；还没播放过的解锁动画留到第一次打开地图
    expect(d.map).toEqual({ node: '1-1', opened: [], chatter: [] });
  });

  it('v2 写入再读出：装备和地图状态不变；看不懂的地图字段丢掉', () => {
    const kv = memory();
    const d = emptySave();
    addEquipment(d, 'starfish');
    addEquipment(d, 'starfish');
    d.map = { node: '1-2', opened: ['1-2'], chatter: ['to12'] };
    writeSave(d, kv);
    const back = loadSave(kv);
    expect(back.equipment).toEqual(['starfish']);
    expect(back.map).toEqual({ node: '1-2', opened: ['1-2'], chatter: ['to12'] });
    const junk = migrate({ version: 2, equipment: ['starfish', 5], map: { node: 3, opened: 'x' } });
    expect(junk.equipment).toEqual(['starfish']);
    expect(junk.map).toEqual({ node: '1-1', opened: [], chatter: [] });
  });

  it('没有存储（隐私模式）时照样能玩', () => {
    expect(loadSave(null)).toEqual(emptySave());
    expect(() => writeSave(emptySave(), null)).not.toThrow();
  });

  it('时间格式 分:秒.百分秒', () => {
    expect(formatTime(0)).toBe('0:00.00');
    expect(formatTime(60 * 95 + 30)).toBe('1:35.50');
  });
});
