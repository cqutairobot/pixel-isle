import { defineConfig } from '@playwright/test';

/**
 * 端到端冒烟测试。云端用预装的 Chromium（与 @playwright/test 1.63.0 匹配）；
 * 本地 Mac 如需运行，先执行 npx playwright install chromium。
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1152, height: 648 },
    deviceScaleFactor: 1,
    launchOptions: {
      // 无头环境用软件渲染 WebGL
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    },
  },
  webServer: {
    command: 'npx vite --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
