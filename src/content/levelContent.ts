import type { Director } from '../scenes/cutscene/director';
import type { KeyHintId } from '../ui/keyHint';
import { CUTSCENES } from './cutscenes/1-1';
import { CUTSCENES_12 } from './cutscenes/1-2';
import { CUTSCENES_13 } from './cutscenes/1-3';
import { NPC_TALK } from './dialog/1-1';
import { NPC_TALK_12 } from './dialog/1-2';
import { NPC_TALK_13 } from './dialog/1-3';
import type { Line } from './dialog/line';
import { UI_TEXT } from './text';

/** 每一关自己的剧情内容：过场分镜、NPC 对白、进关标题卡、结算标题、提示 */
export interface LevelContent {
  cutscenes: Record<string, (d: Director) => Promise<void>>;
  talk: Record<string, { first: Line[]; again: Line[]; after?: Line[] }>;
  /** 从头开始时先播放的开场过场 */
  intro?: string;
  /** 进关横幅：关卡名（上面一行是章节名） */
  banner: string;
  /** 进关后先显示的按键提示 */
  startKey?: KeyHintId;
  tallyTitle: string;
  /** 冲进铃门时回回说的话（HINTS 里的编号） */
  clearHint: string;
  /** 第一次看到螃蟹时提示"踩它的背"（只在第 1 关） */
  crabHint?: boolean;
  /** 碰到第几个检查点时回回说的话 */
  checkpointHints?: Record<number, string>;
  /** 记进存档的剧情标记：再玩这一关时一开始就有（不再播放看过的开场、结尾） */
  storyFlags?: string[];
  /**
   * 只有骑着咩铃二段跳才上得去的崖坎前（1-3 的 A3）：第 cols[0] 到 cols[1] - 1 列，下面的地面顶在 feetRow 行，
   * 崖坎比地面高 6 格。徒步走到这里时回回提醒先救出（骑上）咩铃。
   */
  goatWall?: { cols: [number, number]; feetRow: number };
}

export const LEVEL_CONTENT: Record<string, LevelContent> = {
  '1-1': {
    cutscenes: CUTSCENES,
    talk: NPC_TALK,
    intro: 'intro',
    banner: UI_TEXT.levelTitle,
    startKey: 'move',
    tallyTitle: UI_TEXT.tallyTitle,
    clearHint: 'gate',
    crabHint: true,
    checkpointHints: { 2: 'cp2' },
  },
  '1-2': {
    cutscenes: CUTSCENES_12,
    talk: NPC_TALK_12,
    banner: UI_TEXT.levelTitle12,
    tallyTitle: UI_TEXT.tallyTitle12,
    clearHint: 'gate2',
  },
  '1-3': {
    cutscenes: CUTSCENES_13,
    talk: NPC_TALK_13,
    banner: UI_TEXT.levelTitle13,
    tallyTitle: UI_TEXT.tallyTitle13,
    clearHint: 'bye3',
    storyFlags: ['mieling', 'thanks13'],
    goatWall: { cols: [38, 46], feetRow: 28 },
  },
};
