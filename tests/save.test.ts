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

  it('v1 → v3：海星从剧情标记挪进装备，其他标记和关卡记录都保留', () => {
    const v1 = {
      version: 1,
      shells: 57,
      flags: ['introSeen', 'starfish', 'talk:haishen'],
      levels: { '1-1': { cleared: true, bestFrames: 4321, glass: [true, false, true] } },
    };
    const d = migrate(v1);
    expect(d.version).toBe(3);
    expect(d.equipment).toEqual(['starfish']);
    expect(d.flags).toEqual(['introSeen', 'talk:haishen']);
    expect(d.shells).toBe(57);
    expect(d.levels['1-1']!.bestFrames).toBe(4321);
    // 地图从第一个节点开始；还没播放过的解锁动画留到第一次打开地图
    expect(d.map).toEqual({ node: '1-1', opened: [], chatter: [] });
    expect(d.bag).toEqual({ coconut: 0, conch: 0 });
    expect(d.outfit).toBe('default');
  });

  it('v2 → v3：装备、地图、关卡都保留；背包是空的，没有布料，穿原来的衣服', () => {
    const v2 = {
      version: 2,
      shells: 88,
      flags: ['introSeen', 'mieling'],
      equipment: ['starfish'],
      levels: { '1-2': { cleared: true, bestFrames: 7000, glass: [true, true, false] } },
      map: { node: '1-3', opened: ['1-2', '1-3'], chatter: ['to12'] },
    };
    const d = migrate(v2);
    expect(d.version).toBe(3);
    expect(d.shells).toBe(88);
    expect(d.flags).toEqual(['introSeen', 'mieling']);
    expect(d.equipment).toEqual(['starfish']);
    expect(d.map).toEqual({ node: '1-3', opened: ['1-2', '1-3'], chatter: ['to12'] });
    expect(d.levels['1-2']!.glass).toEqual([true, true, false]);
    expect(d.bag).toEqual({ coconut: 0, conch: 0 });
    expect(d.outfits).toEqual([]);
    expect(d.outfit).toBe('default');
  });

  it('v3：背包数量夹在 0 到上限之间；没买过的衣服穿不上；看不懂的值丢掉', () => {
    const kv = memory();
    const d = emptySave();
    d.bag = { coconut: 1, conch: 1 };
    d.outfits = ['blue', 'dusk'];
    d.outfit = 'dusk';
    writeSave(d, kv);
    const back = loadSave(kv);
    expect(back.bag).toEqual({ coconut: 1, conch: 1 });
    expect(back.outfits).toEqual(['blue', 'dusk']);
    expect(back.outfit).toBe('dusk');
    const junk = migrate({
      version: 3,
      bag: { coconut: 9, conch: -2, x: 1 },
      outfits: ['lime', 'lime', 4, 'default'],
      outfit: 'blue',
    });
    expect(junk.bag).toEqual({ coconut: 1, conch: 0 });
    expect(junk.outfits).toEqual(['lime']);
    expect(junk.outfit).toBe('default');
    expect(migrate({ version: 3, bag: 'x', outfit: 7 }).bag).toEqual({ coconut: 0, conch: 0 });
  });

  it('写入再读出：装备和地图状态不变；看不懂的地图字段丢掉', () => {
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
