import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve('apps/wechat-game'),
  publicDir: path.resolve('apps/wechat-game/public'),
  define: { __WECHAT_API_BASE_URL__: JSON.stringify(process.env.WECHAT_GAME_API_BASE_URL ?? 'https://api-fjhy-staging.wzpy.net') },
  build: {
    outDir: path.resolve('dist/wechat-game'),
    emptyOutDir: true,
    lib: { entry: path.resolve('apps/wechat-game/src/main.ts'), formats: ['iife'], name: 'FujiaHengyang', fileName: () => 'game.bundle.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
    target: 'es2018',
  },
});
