import { expect, test, type Page } from '@playwright/test';

interface GymProbe {
  world: { frame: number; player: { body: { x: number; y: number }; onGround: boolean } };
}

declare global {
  interface Window {
    __gym?: GymProbe;
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
  await page.goto('/');
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
  await expect(page.locator('button', { hasText: '候选 1' })).toHaveCount(9);
  expect(errors).toEqual([]);
});
