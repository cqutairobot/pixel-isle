/**
 * 在线试玩页（claude.ai Artifact）的构建里，Phaser 从 CDN 以全局变量加载，
 * vite.config.ts 在 artifact 模式下把 `import Phaser from 'phaser'` 指向这里。
 */
export default (window as unknown as { Phaser: typeof import('phaser') }).Phaser;
