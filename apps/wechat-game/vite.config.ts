import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve('apps/wechat-game'),
  publicDir: false,
  define: {
    __WECHAT_API_BASE_URL__: JSON.stringify(process.env.WECHAT_GAME_API_BASE_URL ?? 'https://api-fjhy-staging.wzpy.net'),
    __WECHAT_DEV_OPEN_ALL__: JSON.stringify(process.env.WECHAT_GAME_DEBUG_OPEN_ALL === 'true'),
    __WECHAT_DEV_COLLISION__: JSON.stringify(process.env.WECHAT_GAME_DEBUG_COLLISION === 'true'),
    __WECHAT_DEV_SAFE_RESET__: JSON.stringify(process.env.WECHAT_GAME_DEBUG_SAFE_RESET === 'true'),
    __WECHAT_DEV_LOGIN__: JSON.stringify(process.env.WECHAT_GAME_DEV_LOGIN === 'true'),
    __WECHAT_ASSET_BASE_URL__: JSON.stringify(process.env.ASSET_BASE_URL ?? process.env.WECHAT_ASSET_BASE_URL ?? 'https://res-fjhy.wzpy.net'),
  },
  build: {
    outDir: path.resolve('dist/wechat-game'),
    emptyOutDir: true,
    lib: { entry: path.resolve('apps/wechat-game/src/main.ts'), formats: ['iife'], name: 'FujiaHengyang', fileName: () => 'game.bundle.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
    target: 'es2018',
  },
});
