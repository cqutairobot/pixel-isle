import { expect, test, type Page } from '@playwright/test';
import { SFX_IDS } from '../src/audio/sfx';

interface GymProbe {
  world: { frame: number; player: { body: { x: number; y: number }; onGround: boolean } };
}

interface LevelProbe {
  world: {
    frame: number;
    hearts: number;
    player: { body: { x: number; y: number }; onGround: boolean };
  };
  loop: { paused: boolean };
}

declare global {
  interface Window {
    __gym?: GymProbe;
    __level?: LevelProbe;
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
  expect(errors).toEqual([]);
});

test('第 1 关能启动、能走、能暂停，没有报错', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?intro=0');
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
  await page.waitForFunction(() => !window.__level!.loop.paused, null, { timeout: 5_000 });
  expect(await page.evaluate(() => window.__level!.world.hearts)).toBe(3);
  expect(errors).toEqual([]);
});
