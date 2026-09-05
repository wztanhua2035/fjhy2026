import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({root:path.resolve('apps/admin'),plugins:[react()],server:{host:'127.0.0.1',proxy:{'/v1':'http://localhost:8080','/admin':'http://localhost:8080','/healthz':'http://localhost:8080'}},build:{outDir:path.resolve('dist/admin'),emptyOutDir:true}});
