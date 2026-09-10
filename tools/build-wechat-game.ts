import { cp, mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const publicRoot = path.resolve('apps/wechat-game/public');
const outputRoot = path.resolve('dist/wechat-game');
await rm(publicRoot, { recursive: true, force: true });
const vite = path.resolve('node_modules/vite/bin/vite.js');
const exitCode = await new Promise<number>((resolve, reject) => {
  const child = spawn(process.execPath, [vite, 'build', '--config', 'apps/wechat-game/vite.config.ts'], { stdio: 'inherit', shell: false });
  child.on('error', reject); child.on('exit', code => resolve(code ?? 1));
});
if (exitCode !== 0) process.exit(exitCode);
await cp(path.resolve('apps/wechat-game/game.js'), path.join(outputRoot, 'game.js'));
await cp(path.resolve('apps/wechat-game/game.json'), path.join(outputRoot, 'game.json'));
await cp(path.resolve('apps/wechat-game/project.config.json'), path.join(outputRoot, 'project.config.json'));
await mkdir(path.join(outputRoot, 'libs'), { recursive: true });
await cp(path.resolve('apps/wechat-game/libs/weapp-adapter.js'), path.join(outputRoot, 'libs/weapp-adapter.js'));
await cp(path.resolve('apps/wechat-game/libs/WEAPP_ADAPTER_LICENSE'), path.join(outputRoot, 'libs/WEAPP_ADAPTER_LICENSE'));
await mkdir(path.join(outputRoot, 'scene-layers/baishi/formal'), { recursive: true });
await cp(path.resolve('apps/admin/public/scene-layers/baishi/formal'), path.join(outputRoot, 'scene-layers/baishi/formal'), { recursive: true });
console.log(`微信小游戏真机体验包已生成：${outputRoot}`);
