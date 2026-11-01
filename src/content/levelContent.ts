import type { Director } from '../scenes/cutscene/director';
import type { KeyHintId } from '../ui/keyHint';
import { CUTSCENES } from './cutscenes/1-1';
import { CUTSCENES_12 } from './cutscenes/1-2';
import { NPC_TALK } from './dialog/1-1';
import { NPC_TALK_12 } from './dialog/1-2';
import type { Line } from './dialog/line';
import { UI_TEXT } from './text';

/** 每一关自己的剧情内容：过场分镜、NPC 对白、进关横幅、结算标题、通关后去哪 */
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
  /** 结算选"继续"以后去哪一关；没有就显示 comingSoon 的卡片，然后回到标题 */
  next?: string;
  comingSoon?: string;
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
    next: '1-2',
  },
  '1-2': {
    cutscenes: CUTSCENES_12,
    talk: NPC_TALK_12,
    banner: UI_TEXT.levelTitle12,
    tallyTitle: UI_TEXT.tallyTitle12,
    clearHint: 'gate2',
    comingSoon: UI_TEXT.comingSoon3,
  },
};

/** 存进存档、以后每一关都带着的剧情标记（拿到的装备） */
export const PERSISTENT_FLAGS = ['starfish'];
