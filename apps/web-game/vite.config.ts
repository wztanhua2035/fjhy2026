import { defineConfig } from 'vite';
import path from 'node:path';
export default defineConfig({
  root: path.resolve('apps/web-game'),
  publicDir: path.resolve('apps/admin/public'),
  server: { host: '0.0.0.0', proxy: { '/v1': 'http://localhost:8080', '/healthz': 'http://localhost:8080' } },
  define: { __WEB_ASSET_BASE_URL__: JSON.stringify(process.env.ASSET_BASE_URL ?? process.env.WEB_ASSET_BASE_URL ?? 'https://res-fjhy.wzpy.net') },
  build: { outDir: path.resolve('dist/web-game'), emptyOutDir: true }
});
