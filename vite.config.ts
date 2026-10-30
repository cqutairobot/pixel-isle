import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const local = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ mode }) => ({
  base: './',
  server: { port: 5173 },
  // artifact 模式：生成在线试玩页。Phaser、lil-gui 改从 CDN 加载（试玩页只允许从白名单 CDN 加载第三方脚本）
  resolve:
    mode === 'artifact'
      ? {
          alias: [
            { find: /^phaser$/, replacement: local('./src/platform/globalPhaser.ts') },
            { find: /^lil-gui$/, replacement: local('./src/platform/globalLilGui.ts') },
          ],
        }
      : undefined,
  build: {
    target: 'es2022',
    outDir: mode === 'artifact' ? 'dist-artifact' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
