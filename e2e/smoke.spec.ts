import { expect, test, type Page } from '@playwright/test';
import { SFX_IDS } from '../src/audio/sfx';

interface GymProbe {
  world: { frame: number; player: { body: { x: number; y: number }; onGround: boolean } };
}

interface LevelProbe {
  world: {
    frame: number;
    hearts: number;
    waiting: boolean;
    player: { body: { x: number; y: number }; onGround: boolean };
    teleport(x: number, y: number): void;
  };
  loop: { paused: boolean };
  ui: { modal: unknown };
}

interface TitleProbe {
  stage: string;
}

declare global {
  interface Window {
    __gym?: GymProbe;
    __level?: LevelProbe;
    __title?: TitleProbe;
  }
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('练习场能启动、能移动、能跳，没有报错', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/#gym');
  await page.waitForFunction(() => (window.__gym?.world.frame ?? 0) > 30, null, {
    timeout: 30_000,
  });
  const start = await page.evaluate(() => window.__gym!.world.player.body.x);

  await page.keyboard.down('ArrowRight');
  await page.waitForFunction((x0) => window.__gym!.world.player.body.x > x0 + 32, start, {
    timeout: 20_000,
  });
  await page.keyboard.up('ArrowRight');

  await page.waitForFunction(() => window.__gym!.world.player.onGround, null, { timeout: 10_000 });
  const y0 = await page.evaluate(() => window.__gym!.world.player.body.y);
  await page.keyboard.down('KeyZ');
  await page.waitForFunction((y) => window.__gym!.world.player.body.y < y - 24, y0, {
    timeout: 10_000,
  });
  await page.keyboard.up('KeyZ');

  await page.keyboard.press('Backquote');
  await expect(page.locator('#ui-root .debug')).toBeVisible();
  await page.keyboard.press('KeyH');
  await expect(page.locator('#ui-root .help')).toHaveClass(/show/);

  await page.screenshot({ path: 'test-results/gym.png' });
  expect(errors).toEqual([]);
});

test('试听板列出全部音效槽位', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?scene=soundboard');
  await expect(page.getByText('试听板')).toBeVisible();
  await expect(page.locator('button', { hasText: '候选 1' })).toHaveCount(SFX_IDS.length);
  // 按钮点得到（没有被铺满画面的游戏层挡住）：点一个环境声，再点一个音效候选
  await page.getByRole('button', { name: '≈ 环境声：海崖' }).click();
  await page.locator('button', { hasText: '候选 2' }).first().click();
  expect(errors).toEqual([]);
});

test('标题画面 → 菜单 → 练习场，没有报错', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.waitForFunction(() => window.__title, null, { timeout: 60_000 });
  // 跳过启动 Logo 和标题字的入场动画，打开菜单
  for (let i = 0; i < 4 && (await page.evaluate(() => window.__title!.stage)) !== 'menu'; i++) {
    await page.keyboard.press('KeyK');
    await page.waitForTimeout(700);
  }
  await page.waitForFunction(() => window.__title!.stage === 'menu', null, { timeout: 20_000 });
  await page.screenshot({ path: 'test-results/title.png' });
  // 第一次玩没有"继续"：新游戏 → 练习场
  await page.keyboard.press('KeyS');
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyK');
  await page.waitForFunction(() => (window.__gym?.world.frame ?? 0) > 10, null, {
    timeout: 30_000,
  });
  expect(errors).toEqual([]);
});

test('和海婶交谈：对话框打开、翻页、关闭，世界继续', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?intro=0#1-1');
  await page.waitForFunction(() => (window.__level?.world.frame ?? 0) > 20, null, {
    timeout: 60_000,
  });
  // 站到海婶旁边（第 15 列），按 W 交谈
  await page.evaluate(() => window.__level!.world.teleport(231, 178));
  await page.waitForTimeout(600);
  await page.keyboard.press('KeyW');
  await page.waitForFunction(() => !!window.__level!.ui.modal, null, { timeout: 5_000 });
  expect(await page.evaluate(() => window.__level!.world.waiting)).toBe(true);
  await page.screenshot({ path: 'test-results/dialog.png' });
  for (let i = 0; i < 12 && (await page.evaluate(() => !!window.__level!.ui.modal)); i++) {
    await page.keyboard.press('KeyK');
    await page.waitForTimeout(400);
  }
  await page.waitForFunction(() => !window.__level!.ui.modal, null, { timeout: 10_000 });
  await page.waitForFunction(() => !window.__level!.world.waiting, null, { timeout: 5_000 });
  expect(errors).toEqual([]);
});

test('第 1 关能启动、能走、能暂停，没有报错', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?intro=0#1-1');
  await page.waitForFunction(() => (window.__level?.world.frame ?? 0) > 30, null, {
    timeout: 60_000,
  });
  const start = await page.evaluate(() => window.__level!.world.player.body.x);
  await page.keyboard.down('KeyD');
  await page.waitForFunction((x0) => window.__level!.world.player.body.x > x0 + 48, start, {
    timeout: 20_000,
  });
  await page.keyboard.up('KeyD');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__level!.loop.paused, null, { timeout: 5_000 });
  await page.screenshot({ path: 'test-results/level-1-1.png' });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__level!.loop.paused, null, { timeout: 20_000 });
  expect(await page.evaluate(() => window.__level!.world.hearts)).toBe(3);
  expect(errors).toEqual([]);
});

/** 关卡镜头是不是停在"淡出到深色"的状态（黑屏） */
function cameraDark(): boolean {
  const l = window.__level as unknown as {
    cameras: {
      main: {
        fadeEffect: { isRunning: boolean; isComplete: boolean; direction: boolean; alpha: number };
      };
    };
  };
  const f = l.cameras.main.fadeEffect;
  return (f.isRunning || f.isComplete) && f.direction && f.alpha > 0.5;
}

/** 找一列开阔的海面：从上到下都是空的，然后是海水；把小满放到海面上方掉下去 */
function dropIntoSea(hearts: number): void {
  const l = window.__level as unknown as {
    world: {
      hearts: number;
      level: { grid: { cols: number; rows: number; get(c: number, r: number): number } };
      teleport(x: number, y: number): void;
    };
  };
  const g = l.world.level.grid;
  for (let c = 150; c < g.cols; c++) {
    let r = 0;
    while (r < g.rows && g.get(c, r) === 0) r++;
    if (r < g.rows && g.get(c, r) === 3 && r > 4) {
      l.world.hearts = hearts;
      l.world.teleport(c * 16 + 3, (r - 4) * 16);
      return;
    }
  }
  throw new Error('找不到开阔的海面');
}

test('掉进海里扣光心：回到检查点后画面恢复，不会一直黑屏', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?intro=0#1-1');
  await page.waitForFunction(() => (window.__level?.world.frame ?? 0) > 20, null, {
    timeout: 60_000,
  });
  // 只剩 1 颗心时掉海：倒下 → 回检查点满心复活
  await page.evaluate(dropIntoSea, 1);
  await page.waitForFunction(
    () => (window.__level as unknown as { world: { state: string } }).world.state === 'dying',
    null,
    { timeout: 10_000 },
  );
  await page.waitForFunction(
    () => {
      const w = (window.__level as unknown as { world: { state: string; hearts: number } }).world;
      return w.state === 'play' && w.hearts === 3;
    },
    null,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/after-water-death.png' });
  expect(await page.evaluate(cameraDark)).toBe(false);
  expect(
    await page.evaluate(
      () =>
        (window.__level as unknown as { ui: { transition: { covered: boolean } } }).ui.transition
          .covered,
    ),
  ).toBe(false);
  // 不致命的掉海：扣 1 心、在岸边复活，原来的淡出淡入照常
  await page.evaluate(dropIntoSea, 3);
  await page.waitForFunction(() => window.__level!.world.hearts === 2, null, { timeout: 10_000 });
  await page.waitForFunction(
    () =>
      (window.__level as unknown as { world: { respawnTimer: number } }).world.respawnTimer === 0,
    null,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(1200);
  expect(await page.evaluate(cameraDark)).toBe(false);
  expect(errors).toEqual([]);
});

test('第 2 关：开场借到海星（长按跳过），扔海星打倒隧道里的刺海胆，没有报错', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/#1-2');
  await page.waitForFunction(() => (window.__level?.world.frame ?? 0) > 20, null, {
    timeout: 60_000,
  });
  type L12 = {
    story: string | null;
    world: {
      flags: Set<string>;
      waiting: boolean;
      hearts: number;
      player: { body: { x: number } };
      enemies: Array<{ kind: string; alive: boolean; body: { centerX: number } }>;
    };
  };
  // 往右走到第 9 列：开场过场开始
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => !!(window.__level as unknown as L12).story, null, {
    timeout: 20_000,
  });
  await page.keyboard.up('KeyD');
  // 长按 Esc 跳过
  await page.keyboard.down('Escape');
  await page.waitForFunction(
    () => {
      const l = window.__level as unknown as L12;
      return l.world.flags.has('starfish') && !l.story;
    },
    null,
    { timeout: 20_000 },
  );
  await page.keyboard.up('Escape');
  // 走进隧道（离刺海胆 5 格左右，在海星的射程里），朝它扔海星
  await page.keyboard.down('KeyD');
  await page.waitForFunction(
    () => (window.__level as unknown as L12).world.player.body.x > 18 * 16,
    null,
    { timeout: 20_000 },
  );
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyJ');
  await page.waitForFunction(
    () =>
      (window.__level as unknown as L12).world.enemies.some(
        (e) => e.kind === 'urchin' && e.body.centerX < 30 * 16 && !e.alive,
      ),
    null,
    { timeout: 10_000 },
  );
  await page.screenshot({ path: 'test-results/level-1-2.png' });
  expect(await page.evaluate(() => (window.__level as unknown as L12).world.hearts)).toBe(3);
  expect(errors).toEqual([]);
});

test('通关过 1-1 的存档：标题"继续" → 章节地图 → 跳到 1-2 → 关卡卡片 → 进关', async ({ page }) => {
  const errors = collectErrors(page);
  const save = {
    version: 2,
    levels: {
      '1-1': { cleared: true, bestFrames: 5321, glass: [true, false, true], noDamage: false },
    },
    shells: 40,
    flags: ['introSeen', 'prologueSeen'],
    equipment: [],
    map: { node: '1-1', opened: [], chatter: [] },
  };
  await page.addInitScript((s) => localStorage.setItem('pixel-isle.save', s), JSON.stringify(save));
  await page.goto('/');
  await page.waitForFunction(() => window.__title, null, { timeout: 60_000 });
  for (let i = 0; i < 4 && (await page.evaluate(() => window.__title!.stage)) !== 'menu'; i++) {
    await page.keyboard.press('KeyK');
    await page.waitForTimeout(700);
  }
  await page.waitForFunction(() => window.__title!.stage === 'menu', null, { timeout: 20_000 });
  // 有存档时第一项是"继续"
  await page.keyboard.press('KeyK');
  await page.waitForFunction(() => !!(window as unknown as { __map?: unknown }).__map, null, {
    timeout: 30_000,
  });
  // 等通往 1-2 的路解锁完，再往右跳
  await page.waitForFunction(
    () => {
      const m = (window as unknown as { __map?: { revealing: boolean; revealQueued: boolean } })
        .__map;
      return !!m && !m.revealing && !m.revealQueued;
    },
    null,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyD');
  await page.waitForFunction(
    () => {
      const m = (window as unknown as { __map?: { at: string; hop: unknown } }).__map;
      return m?.at === '1-2' && !m.hop;
    },
    null,
    { timeout: 20_000 },
  );
  await page.screenshot({ path: 'test-results/map.png' });
  await page.keyboard.press('KeyK');
  await page.waitForFunction(
    () => !!(window as unknown as { __map?: { ui: { modal: unknown } } }).__map?.ui.modal,
    null,
    { timeout: 5_000 },
  );
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyK');
  await page.waitForFunction(
    () =>
      (window.__level as unknown as { levelId?: string } | undefined)?.levelId === '1-2' &&
      (window.__level?.world.frame ?? 0) > 5,
    null,
    { timeout: 30_000 },
  );
  expect(errors).toEqual([]);
});

test('第 3 关：跳过开场，踩碎冰晶救出咩铃（长按跳过），骑上，冲撞撞碎矮洞里的裂岩（不掉心），没有报错', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/#1-3');
  await page.waitForFunction(() => (window.__level?.world.frame ?? 0) > 20, null, {
    timeout: 60_000,
  });
  type L13 = {
    story: string | null;
    world: {
      flags: Set<string>;
      hearts: number;
      mountTarget: boolean;
      player: { ride: unknown; body: { centerX: number } };
      goat: { body: { centerX: number; bottom: number } } | null;
      blocks: { at(c: number, r: number): { broken: boolean } | undefined };
      teleportFeet(x: number, y: number): void;
    };
  };
  // 往右走到第 22 列：开场「谷雨的请求」，长按 Esc 跳过
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => !!(window.__level as unknown as L13).story, null, {
    timeout: 20_000,
  });
  await page.keyboard.up('KeyD');
  await page.keyboard.down('Escape');
  await page.waitForFunction(() => !(window.__level as unknown as L13).story, null, {
    timeout: 20_000,
  });
  await page.keyboard.up('Escape');
  // 放到冰晶正上方：落下来踩一下、弹起来再落下……踩够三下冰晶碎掉，过场「咩铃出圈」开始
  await page.evaluate(() => {
    (window.__level as unknown as L13).world.teleportFeet(31 * 16 + 8, 20 * 16);
  });
  await page.waitForFunction(() => !!(window.__level as unknown as L13).story, null, {
    timeout: 20_000,
  });
  await page.keyboard.down('Escape');
  await page.waitForFunction(
    () => {
      const l = window.__level as unknown as L13;
      return l.world.flags.has('mieling') && !l.story;
    },
    null,
    { timeout: 20_000 },
  );
  await page.keyboard.up('Escape');
  // 站到咩铃身边按 W 骑上
  await page.evaluate(() => {
    const w = (window.__level as unknown as L13).world;
    w.teleportFeet(w.goat!.body.centerX - 4, w.goat!.body.bottom);
  });
  await page.waitForFunction(() => (window.__level as unknown as L13).world.mountTarget, null, {
    timeout: 5_000,
  });
  await page.keyboard.press('KeyW');
  await page.waitForFunction(() => !!(window.__level as unknown as L13).world.player.ride, null, {
    timeout: 5_000,
  });
  // 放到矮洞口（第 61 列），按住 D、按 J 冲撞：第 66 列的裂岩碎掉，不掉心
  const hearts = await page.evaluate(() => (window.__level as unknown as L13).world.hearts);
  await page.evaluate(() => {
    (window.__level as unknown as L13).world.teleportFeet(61 * 16 + 8, 22 * 16);
  });
  await page.waitForTimeout(300);
  await page.keyboard.down('KeyD');
  await page.keyboard.press('KeyJ');
  await page.waitForFunction(
    () => !!(window.__level as unknown as L13).world.blocks.at(66, 19)?.broken,
    null,
    { timeout: 10_000 },
  );
  await page.keyboard.up('KeyD');
  await page.screenshot({ path: 'test-results/level-1-3.png' });
  expect(await page.evaluate(() => (window.__level as unknown as L13).world.hearts)).toBe(hearts);
  expect(errors).toEqual([]);
});

test('冰沙摊：1-2 通关、有 50 个贝壳 → 地图 ↓ 到冰沙摊 → 买椰子水 → 进 1-3 多一颗蓝心；地图菜单「换装」能打开', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const save = {
    version: 3,
    levels: {
      '1-1': { cleared: true, bestFrames: 5321, glass: [false, false, false], noDamage: false },
      '1-2': { cleared: true, bestFrames: 7012, glass: [false, false, false], noDamage: false },
    },
    shells: 50,
    flags: ['introSeen', 'prologueSeen'],
    equipment: ['starfish'],
    map: { node: '1-3', opened: ['1-2', '1-3'], chatter: [] },
    bag: { coconut: 0, conch: 0 },
    outfits: [],
    outfit: 'default',
  };
  type MapProbe = {
    at: string;
    hop: unknown;
    revealing: boolean;
    revealQueued: boolean;
    ui: { modal: unknown };
  };
  type ShopProbe = { o: { outfitOnly?: boolean } };
  const stored = () =>
    page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('pixel-isle.save')!) as {
          shells: number;
          bag: { coconut: number };
          map: { opened: string[] };
        },
    );
  await page.addInitScript((s) => localStorage.setItem('pixel-isle.save', s), JSON.stringify(save));
  await page.goto('/#map');
  // 第一次来：冰沙摊开张（"即将开张"翻成"营业中"），等它演完
  await page.waitForFunction(
    () => {
      const m = (window as unknown as { __map?: MapProbe }).__map;
      const s = JSON.parse(localStorage.getItem('pixel-isle.save') ?? '{}') as {
        map?: { opened?: string[] };
      };
      return (
        !!m && !m.revealing && !m.revealQueued && !!s.map?.opened?.includes('shop') && !m.ui.modal
      );
    },
    null,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1200);
  // ↓ 沿小路跳到冰沙摊，K 进店
  await page.keyboard.press('KeyS');
  await page.waitForFunction(
    () => {
      const m = (window as unknown as { __map?: MapProbe }).__map;
      return m?.at === 'shop' && !m.hop;
    },
    null,
    { timeout: 20_000 },
  );
  await page.keyboard.press('KeyK');
  await page.waitForFunction(() => !!(window as unknown as { __shop?: ShopProbe }).__shop, null, {
    timeout: 10_000,
  });
  await page.waitForTimeout(600);
  // 货架第一样就是椰子水：K 买下
  await page.keyboard.press('KeyK');
  await expect.poll(async () => (await stored()).bag.coconut, { timeout: 5_000 }).toBe(1);
  expect((await stored()).shells).toBe(30);
  await page.screenshot({ path: 'test-results/shop.png' });
  // J 离开，↑ 跳回 1-3，K 打开关卡卡片，再按 K 进关
  await page.keyboard.press('KeyJ');
  await page.waitForFunction(() => !(window as unknown as { __shop?: ShopProbe }).__shop, null, {
    timeout: 10_000,
  });
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyW');
  await page.waitForFunction(
    () => {
      const m = (window as unknown as { __map?: MapProbe }).__map;
      return m?.at === '1-3' && !m.hop;
    },
    null,
    { timeout: 20_000 },
  );
  // 地图菜单里的「换装」：只开换装那一页
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => !!(window as unknown as { __map?: MapProbe }).__map?.ui.modal,
    null,
    {
      timeout: 5_000,
    },
  );
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyS');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyK');
  await page.waitForFunction(
    () => (window as unknown as { __shop?: ShopProbe }).__shop?.o.outfitOnly === true,
    null,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyJ');
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __shop?: ShopProbe; __map?: MapProbe };
      return !w.__shop && !w.__map?.ui.modal;
    },
    null,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyK');
  await page.waitForFunction(
    () => !!(window as unknown as { __map?: MapProbe }).__map?.ui.modal,
    null,
    {
      timeout: 5_000,
    },
  );
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyK');
  await page.waitForFunction(
    () =>
      (window.__level as unknown as { levelId?: string } | undefined)?.levelId === '1-3' &&
      (window.__level?.world.frame ?? 0) > 5,
    null,
    { timeout: 30_000 },
  );
  // 进关时喝掉椰子水：多一颗蓝心，背包里的椰子水用掉了
  expect(
    await page.evaluate(
      () => (window.__level as unknown as { world: { blueHearts: number } }).world.blueHearts,
    ),
  ).toBe(1);
  expect((await stored()).bag.coconut).toBe(0);
  expect(errors).toEqual([]);
});

/** 第 3 关 A3 崖坎前的引导用到的探针 */
type L13Help = {
  story: string | null;
  hintsShown: Set<string>;
  ui: { keyHint: { current: string | null } };
  world: {
    frame: number;
    player: { ride: unknown };
    goat: { body: { centerX: number; bottom: number } } | null;
    teleportFeet(x: number, y: number): void;
  };
};

test('第 3 关：没救出咩铃就徒步走到 A3 崖坎前，回回提醒先回去救她（不提示二段跳）；回到羊圈旁边再提示踩冰晶', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/#1-3');
  await page.waitForFunction(() => (window.__level?.world.frame ?? 0) > 20, null, {
    timeout: 60_000,
  });
  // 往右走：开场「谷雨的请求」，长按 Esc 跳过
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => !!(window.__level as unknown as L13Help).story, null, {
    timeout: 20_000,
  });
  await page.keyboard.up('KeyD');
  await page.keyboard.down('Escape');
  await page.waitForFunction(() => !(window.__level as unknown as L13Help).story, null, {
    timeout: 20_000,
  });
  await page.keyboard.up('Escape');
  // 不踩冰晶，从第 36 列一直走到崖坎前（路过第 39、40 列的二段跳提示区）
  await page.evaluate(() =>
    (window.__level as unknown as L13Help).world.teleportFeet(36 * 16 + 8, 28 * 16),
  );
  await page.waitForTimeout(300);
  await page.keyboard.down('KeyD');
  await page.waitForFunction(
    () => (window.__level as unknown as L13Help).hintsShown.has('freeGoat'),
    null,
    { timeout: 10_000 },
  );
  await page.keyboard.up('KeyD');
  const shown = await page.evaluate(() => {
    const l = window.__level as unknown as L13Help;
    return { double: l.hintsShown.has('double'), key: l.ui.keyHint.current };
  });
  expect(shown.double).toBe(false);
  expect(shown.key).not.toBe('doubleJump');
  // 回到羊圈旁边：再提示"跳上去，踩冰晶"
  await page.evaluate(() =>
    (window.__level as unknown as L13Help).world.teleportFeet(34 * 16 + 8, 28 * 16),
  );
  await page.waitForFunction(
    () => (window.__level as unknown as L13Help).ui.keyHint.current === 'stomp',
    null,
    { timeout: 10_000 },
  );
  expect(errors).toEqual([]);
});

test('再玩第 3 关（咩铃已经出圈）：站到咩铃旁边提示"W 骑上"；骑着来到 A3 崖坎前提示二段跳', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const save = {
    version: 3,
    levels: {},
    shells: 0,
    flags: ['introSeen', 'prologueSeen', 'mieling'],
    equipment: ['starfish'],
    map: { node: '1-3', opened: [], chatter: [] },
    bag: { coconut: 0, conch: 0 },
    outfits: [],
    outfit: 'default',
  };
  await page.addInitScript((s) => localStorage.setItem('pixel-isle.save', s), JSON.stringify(save));
  await page.goto('/#1-3');
  await page.waitForFunction(() => (window.__level?.world.frame ?? 0) > 20, null, {
    timeout: 60_000,
  });
  // 没有"咩铃出圈"过场了：咩铃在羊圈里等着，站到她旁边
  await page.evaluate(() => {
    const w = (window.__level as unknown as L13Help).world;
    w.teleportFeet(w.goat!.body.centerX - 4, w.goat!.body.bottom);
  });
  await page.waitForFunction(
    () => (window.__level as unknown as L13Help).ui.keyHint.current === 'ride',
    null,
    { timeout: 5_000 },
  );
  await page.keyboard.press('KeyW');
  await page.waitForFunction(
    () => !!(window.__level as unknown as L13Help).world.player.ride,
    null,
    {
      timeout: 5_000,
    },
  );
  // 骑着从第 36 列走到崖坎前：回回说"在空中再跳一次"，屏幕下方提示二段跳
  await page.evaluate(() =>
    (window.__level as unknown as L13Help).world.teleportFeet(36 * 16 + 8, 28 * 16),
  );
  await page.waitForTimeout(300);
  await page.keyboard.down('KeyD');
  await page.waitForFunction(
    () => (window.__level as unknown as L13Help).hintsShown.has('double'),
    null,
    { timeout: 10_000 },
  );
  await page.keyboard.up('KeyD');
  expect(
    await page.evaluate(() => (window.__level as unknown as L13Help).hintsShown.has('needRide')),
  ).toBe(false);
  expect(errors).toEqual([]);
});
