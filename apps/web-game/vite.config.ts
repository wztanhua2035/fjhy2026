import { defineConfig } from 'vite';
import path from 'node:path';
const remoteAssetOrigin = process.env.ASSET_BASE_URL ?? process.env.WEB_ASSET_BASE_URL ?? 'https://res-fjhy.wzpy.net';
export default defineConfig({
  root: path.resolve('apps/web-game'),
  publicDir: path.resolve('apps/admin/public'),
  server: { host: '0.0.0.0', proxy: { '/v1': 'http://localhost:8080', '/healthz': 'http://localhost:8080', '/__fjhy_cdn__': { target: remoteAssetOrigin, changeOrigin: true, rewrite: path => path.replace(/^\/__fjhy_cdn__/, ''), configure: proxy => { proxy.on('error', error => console.error('[FJHY CDN proxy]', error.message)); } } } },
  define: { __WEB_ASSET_BASE_URL__: JSON.stringify(remoteAssetOrigin) },
  build: { outDir: path.resolve('dist/web-game'), emptyOutDir: true }
});
