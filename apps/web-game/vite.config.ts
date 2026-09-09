import { defineConfig } from 'vite';
import path from 'node:path';
export default defineConfig({
  root: path.resolve('apps/web-game'),
  publicDir: path.resolve('apps/admin/public'),
  server: { host: '0.0.0.0', proxy: { '/v1': 'http://localhost:8080', '/healthz': 'http://localhost:8080' } },
  build: { outDir: path.resolve('dist/web-game'), emptyOutDir: true }
});