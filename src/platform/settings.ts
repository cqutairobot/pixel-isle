import { browserStorage, type KV } from './save';

/**
 * 设置（PLAN §5.9）：和存档分开保存，清除存档不会清掉设置。纯逻辑，存储对象可以替换。
 */
export interface Settings {
  version: 1;
  /** 总音量、音乐、音效（0–1，设置面板里按 10% 一格调） */
  master: number;
  music: number;
  sfx: number;
  /** 静音（练习场里按 M） */
  muted: boolean;
  /** 震屏强度 */
  shake: 'full' | 'low' | 'off';
  /** 减少闪烁：受击不白闪、过场不闪白 */
  reduceFlash: boolean;
  /** 自动奔跑：一动就是跑 */
  autoRun: boolean;
  /** 辅助模式：心上限 +2（下次进关生效） */
  assist: boolean;
}

export const SETTINGS_KEY = 'pixel-isle.settings';
/** M0 时期只存了音量和静音 */
export const OLD_AUDIO_KEY = 'pixel-isle.audio';

export const SHAKE_INTENSITY: Record<Settings['shake'], number> = { full: 1, low: 0.5, off: 0 };

export function defaultSettings(): Settings {
  return {
    version: 1,
    master: 0.8,
    music: 0.7,
    sfx: 1,
    muted: false,
    shake: 'full',
    reduceFlash: false,
    autoRun: false,
    assist: false,
  };
}

const vol = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.max(0, Math.min(1, Math.round(v * 10) / 10))
    : d;

/** 把读到的任意数据整理成设置；看不懂的丢掉，缺的补默认值。old 是旧的 pixel-isle.audio */
export function migrateSettings(raw: unknown, old?: unknown): Settings {
  const s = defaultSettings();
  if (old && typeof old === 'object') {
    const o = old as Record<string, unknown>;
    s.master = vol(o.volume, s.master);
    s.muted = o.muted === true;
  }
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Record<string, unknown>;
  s.master = vol(r.master, s.master);
  s.music = vol(r.music, s.music);
  s.sfx = vol(r.sfx, s.sfx);
  s.muted = r.muted === true;
  if (r.shake === 'full' || r.shake === 'low' || r.shake === 'off') s.shake = r.shake;
  s.reduceFlash = r.reduceFlash === true;
  s.autoRun = r.autoRun === true;
  s.assist = r.assist === true;
  return s;
}

function parse(text: string | null): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function loadSettings(kv: KV | null = browserStorage()): Settings {
  if (!kv) return defaultSettings();
  const raw = parse(kv.getItem(SETTINGS_KEY));
  return migrateSettings(raw, raw === undefined ? parse(kv.getItem(OLD_AUDIO_KEY)) : undefined);
}

export function writeSettings(s: Settings, kv: KV | null = browserStorage()): void {
  if (!kv) return;
  try {
    kv.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // 存不了就算了
  }
}

/** 全局的当前设置（启动时读一次，设置面板改完写回） */
export const settings: Settings = loadSettings();

export function saveSettings(): void {
  writeSettings(settings);
}
