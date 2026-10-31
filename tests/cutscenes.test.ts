import { describe, expect, it } from 'vitest';
import { PORTRAITS } from '../src/art/portraits';
import { CUTSCENES } from '../src/content/cutscenes/1-1';
import { END_STATES } from '../src/content/cutscenes/endStates';
import {
  ADOU_SOLVED,
  BAILU_MEET,
  BELLTOWER,
  INTRO,
  NPC_TALK,
  PROLOGUE,
} from '../src/content/dialog/1-1';
import type { Line } from '../src/content/dialog/line';
import { level11 } from '../src/content/levels/1-1';
import { SPEAKERS } from '../src/content/speakers';
import { Director, type DirectorHost } from '../src/scenes/cutscene/director';
import { T_ONEWAY, T_SOLID } from '../src/sim/grid';
import { parseLevel } from '../src/sim/level';

const ALL_LINES: Line[] = [
  ...Object.values(NPC_TALK).flatMap((n) => [...n.first, ...n.again, ...(n.after ?? [])]),
  ...ADOU_SOLVED,
  ...INTRO,
  ...BELLTOWER.flat(),
  ...BAILU_MEET,
  ...PROLOGUE.flat(),
];

/** 什么都接受的假对象：任何属性、任何调用都返回它自己（代替 Phaser 的场景和精灵） */
const fake: unknown = new Proxy(function () {}, {
  get: (_t, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : fake),
  apply: () => fake,
});

function host(autoDialog: boolean): DirectorHost {
  return {
    scene: fake,
    ui: {
      dialog: (
        _lines: unknown,
        hooks: { onDone?: () => void; onLine?: (i: number, l: Line) => void },
      ) => {
        if (autoDialog)
          queueMicrotask(() => {
            (_lines as Line[]).forEach((l, i) => hooks.onLine?.(i, l));
            hooks.onDone?.();
          });
        return fake;
      },
      closeModal: () => {},
      letterbox: () => {},
      setCover: () => {},
      caption: () => {},
    },
    particles: { spawn: () => {} },
    hero: { x: 100, y: 192, facing: 1 },
    camera: { x: 0, y: 72 },
    bounds: { w: 306 * 16, h: 288 },
    headOf: () => null,
    emote: () => {},
    sfx: () => {},
    music: () => {},
    shake: () => {},
    signal: () => {},
    toast: () => {},
    dialog: {},
  } as unknown as DirectorHost;
}

/** 让排队的 Promise 回调都跑完（浏览器里它们在同一帧之内就会跑完） */
async function flush(n = 20): Promise<void> {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

describe('第 1 关的剧情内容', () => {
  it('每句对白的说话人都存在，表情都有对应的头像', () => {
    for (const l of ALL_LINES) {
      const sp = SPEAKERS[l.who];
      expect(sp, l.who).toBeDefined();
      if (l.face && sp!.portrait)
        expect(PORTRAITS[sp!.portrait]!.exprs[l.face], `${l.who} ${l.face}`).toBeDefined();
    }
  });

  it('每个阻塞触发都有分镜和结束状态；结束位置能站', () => {
    const level = parseLevel(level11);
    const blocking = level11.entities!.filter(
      (e) => e.type === 'trigger' && e.blocking !== false,
    ) as Array<{ id: string }>;
    expect(blocking.map((t) => t.id).sort()).toEqual(['bailu', 'belltower']);
    for (const t of blocking) {
      expect(CUTSCENES[t.id], t.id).toBeDefined();
      const end = END_STATES[t.id]!;
      expect(end, t.id).toBeDefined();
      if (end.player) {
        const [c, r] = end.player;
        const below = level.grid.get(c, r + 1);
        expect(below === T_SOLID || below === T_ONEWAY, `${t.id} 脚下`).toBe(true);
        expect(level.grid.get(c, r), `${t.id} 所在格`).not.toBe(T_SOLID);
      }
    }
  });

  for (const [id, script] of Object.entries(CUTSCENES)) {
    it(`过场「${id}」：一直看到结尾不会卡住`, async () => {
      const d = new Director(host(true));
      let done = false;
      void script(d).then(() => (done = true));
      // 最多模拟 3 分钟
      for (let i = 0; i < 180 * 20 && !done; i++) {
        d.update(1 / 20);
        await flush();
      }
      expect(done).toBe(true);
      d.finish();
    });

    it(`过场「${id}」：一开始就跳过，马上结束`, async () => {
      const d = new Director(host(false));
      let done = false;
      void script(d).then(() => (done = true));
      d.update(1 / 60);
      d.skip();
      await flush(2000);
      expect(done).toBe(true);
      d.finish();
    });
  }
});
