/**
 * 存档 v1（PLAN §5.9）：localStorage 自动存档，只有一个存档位，带版本号和迁移。
 * 纯逻辑，存储对象可以替换（测试里用内存存储）。
 */

export interface LevelRecord {
  cleared: boolean;
  /** 最佳用时（逻辑帧）；没通关过为 null */
  bestFrames: number | null;
  /** 找到过的海玻璃 */
  glass: boolean[];
  /** 曾经无伤通关 */
  noDamage: boolean;
}

export interface SaveData {
  version: 1;
  levels: Record<string, LevelRecord>;
  /** 贝壳总数（货币） */
  shells: number;
  /** 剧情标记，例如看过序章 */
  flags: string[];
}

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const SAVE_KEY = 'pixel-isle.save';
export const SAVE_VERSION = 1;

export function emptySave(): SaveData {
  return { version: 1, levels: {}, shells: 0, flags: [] };
}

function emptyRecord(): LevelRecord {
  return { cleared: false, bestFrames: null, glass: [false, false, false], noDamage: false };
}

/** 把读到的任意数据整理成 v1 存档；看不懂的字段丢掉，缺的补上默认值 */
export function migrate(raw: unknown): SaveData {
  const out = emptySave();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.shells === 'number' && Number.isFinite(r.shells) && r.shells >= 0)
    out.shells = Math.floor(r.shells);
  if (Array.isArray(r.flags)) out.flags = r.flags.filter((f): f is string => typeof f === 'string');
  if (r.levels && typeof r.levels === 'object') {
    for (const [id, v] of Object.entries(r.levels as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const lv = v as Record<string, unknown>;
      const rec = emptyRecord();
      rec.cleared = lv.cleared === true;
      if (typeof lv.bestFrames === 'number' && lv.bestFrames > 0)
        rec.bestFrames = Math.floor(lv.bestFrames);
      if (Array.isArray(lv.glass))
        rec.glass = [0, 1, 2].map((i) => (lv.glass as unknown[])[i] === true);
      rec.noDamage = lv.noDamage === true;
      out.levels[id] = rec;
    }
  }
  return out;
}

/** 浏览器里的 localStorage；隐私模式等拿不到时返回 null */
export function browserStorage(): KV | null {
  try {
    const s = globalThis.localStorage;
    const probe = '__pixel_isle_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function loadSave(kv: KV | null = browserStorage()): SaveData {
  if (!kv) return emptySave();
  const text = kv.getItem(SAVE_KEY);
  if (!text) return emptySave();
  try {
    return migrate(JSON.parse(text));
  } catch {
    // 存档坏了：备份一份再从头开始，不让游戏崩掉
    kv.setItem(`${SAVE_KEY}.broken`, text);
    return emptySave();
  }
}

export function writeSave(data: SaveData, kv: KV | null = browserStorage()): void {
  if (!kv) return;
  try {
    kv.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // 存储满了等情况：忽略，游戏照常进行
  }
}

export function hasProgress(data: SaveData): boolean {
  return Object.keys(data.levels).length > 0 || data.flags.length > 0;
}

export function levelRecord(data: SaveData, id: string): LevelRecord {
  return (data.levels[id] ??= emptyRecord());
}

/** 拾取海玻璃时立刻记下（再玩时显示为半透明） */
export function recordGlass(data: SaveData, id: string, index: number): void {
  const rec = levelRecord(data, id);
  rec.glass[index] = true;
}

/** 通关：更新最佳用时等；返回是否刷新了最佳用时 */
export function recordClear(
  data: SaveData,
  id: string,
  frames: number,
  shells: number,
  noDamage: boolean,
): boolean {
  const rec = levelRecord(data, id);
  const newRecord = rec.bestFrames === null || frames < rec.bestFrames;
  rec.cleared = true;
  if (newRecord) rec.bestFrames = frames;
  if (noDamage) rec.noDamage = true;
  data.shells += shells;
  return newRecord;
}

export function setFlag(data: SaveData, flag: string): void {
  if (!data.flags.includes(flag)) data.flags.push(flag);
}

/** 把帧数格式化成 分:秒.百分秒 */
export function formatTime(frames: number): string {
  const cs = Math.floor((frames / 60) * 100);
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}
