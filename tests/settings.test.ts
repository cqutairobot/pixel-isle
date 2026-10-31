import { describe, expect, it } from 'vitest';
import type { KV } from '../src/platform/save';
import {
  defaultSettings,
  loadSettings,
  migrateSettings,
  OLD_AUDIO_KEY,
  SETTINGS_KEY,
  writeSettings,
} from '../src/platform/settings';

function memory(init: Record<string, string> = {}): KV & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}

describe('设置', () => {
  it('没有设置时用默认值', () => {
    expect(loadSettings(memory())).toEqual(defaultSettings());
    expect(loadSettings(null)).toEqual(defaultSettings());
  });

  it('迁移 M0 的旧音量设置', () => {
    const kv = memory({ [OLD_AUDIO_KEY]: JSON.stringify({ muted: true, volume: 0.43 }) });
    const s = loadSettings(kv);
    expect(s.master).toBe(0.4);
    expect(s.muted).toBe(true);
    expect(s.music).toBe(defaultSettings().music);
  });

  it('新设置优先于旧的音量设置', () => {
    const kv = memory({
      [OLD_AUDIO_KEY]: JSON.stringify({ muted: true, volume: 0.2 }),
      [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), master: 0.6 }),
    });
    expect(loadSettings(kv).master).toBe(0.6);
    expect(loadSettings(kv).muted).toBe(false);
  });

  it('看不懂的字段丢掉，越界的音量夹到 0–1', () => {
    const s = migrateSettings({ master: 7, music: -1, sfx: 'x', shake: 'huge', autoRun: 'yes' });
    expect(s.master).toBe(1);
    expect(s.music).toBe(0);
    expect(s.sfx).toBe(1);
    expect(s.shake).toBe('full');
    expect(s.autoRun).toBe(false);
  });

  it('写进去再读出来一样；坏掉的 JSON 不会崩', () => {
    const kv = memory();
    const s = { ...defaultSettings(), shake: 'low' as const, assist: true, sfx: 0.5 };
    writeSettings(s, kv);
    expect(loadSettings(kv)).toEqual(s);
    kv.setItem(SETTINGS_KEY, '{oops');
    expect(loadSettings(kv)).toEqual(defaultSettings());
  });
});
