import { describe, expect, it } from 'vitest';
import {
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

  it('没有存储（隐私模式）时照样能玩', () => {
    expect(loadSave(null)).toEqual(emptySave());
    expect(() => writeSave(emptySave(), null)).not.toThrow();
  });

  it('时间格式 分:秒.百分秒', () => {
    expect(formatTime(0)).toBe('0:00.00');
    expect(formatTime(60 * 95 + 30)).toBe('1:35.50');
  });
});
