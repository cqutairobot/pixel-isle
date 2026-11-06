/**
 * 存档 v2（PLAN §5.9，docs/levels/1-2.md §6.4）：localStorage 自动存档，只有一个存档位，
 * 带版本号和迁移。v2 比 v1 多了拥有的装备和章节地图的状态。
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

/** 章节地图的状态 */
export interface MapState {
  /** 小满在地图上站在哪个节点（关卡编号） */
  node: string;
  /** 已经播放过解锁动画的路（用路的终点关卡编号表示，例如 '1-2' 是 1-1 → 1-2 那条） */
  opened: string[];
  /** 已经说过的地图闲聊 */
  chatter: string[];
}

export interface SaveData {
  version: 2;
  levels: Record<string, LevelRecord>;
  /** 贝壳总数（货币） */
  shells: number;
  /** 剧情标记，例如看过序章 */
  flags: string[];
  /** 拥有的装备（例如 starfish），以后每一关都带着 */
  equipment: string[];
  map: MapState;
}

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const SAVE_KEY = 'pixel-isle.save';
export const SAVE_VERSION = 2;

/** v1 时代拿到装备是记成剧情标记的；迁移时挪进 equipment */
const V1_EQUIPMENT_FLAGS = ['starfish'];

export function emptySave(): SaveData {
  return {
    version: 2,
    levels: {},
    shells: 0,
    flags: [],
    equipment: [],
    map: { node: '1-1', opened: [], chatter: [] },
  };
}

function emptyRecord(): LevelRecord {
  return { cleared: false, bestFrames: null, glass: [false, false, false], noDamage: false };
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/**
 * 把读到的任意数据整理成 v2 存档；看不懂的字段丢掉，缺的补上默认值。
 * v1 → v2：剧情标记里的装备（starfish）挪进 equipment；地图从第一个节点开始，
 * 还没播放过的路径解锁动画会在第一次打开地图时补上。
 */
export function migrate(raw: unknown): SaveData {
  const out = emptySave();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.shells === 'number' && Number.isFinite(r.shells) && r.shells >= 0)
    out.shells = Math.floor(r.shells);
  const flags = strings(r.flags);
  const v2 = r.version === 2;
  out.flags = v2 ? flags : flags.filter((f) => !V1_EQUIPMENT_FLAGS.includes(f));
  out.equipment = v2 ? strings(r.equipment) : flags.filter((f) => V1_EQUIPMENT_FLAGS.includes(f));
  if (v2 && r.map && typeof r.map === 'object') {
    const m = r.map as Record<string, unknown>;
    if (typeof m.node === 'string' && m.node) out.map.node = m.node;
    out.map.opened = strings(m.opened);
    out.map.chatter = strings(m.chatter);
  }
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
  return Object.keys(data.levels).length > 0 || data.flags.length > 0 || data.equipment.length > 0;
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

/** 拿到一件装备（以后每一关都带着） */
export function addEquipment(data: SaveData, id: string): void {
  if (!data.equipment.includes(id)) data.equipment.push(id);
}

/** 往一个列表里加一项（不重复）：地图上播放过的解锁动画、说过的闲聊 */
export function remember(list: string[], id: string): void {
  if (!list.includes(id)) list.push(id);
}

/** 把帧数格式化成 分:秒.百分秒 */
export function formatTime(frames: number): string {
  const cs = Math.floor((frames / 60) * 100);
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}
