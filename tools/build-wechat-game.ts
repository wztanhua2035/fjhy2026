import { cp, mkdir, readdir, rm, stat, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { wechatAssets, WECHAT_STARTUP_PACKAGE_ROOTS } from '../apps/wechat-game/src/assets.js';
import { baishiInteriorArtRegistry, remoteAsset, INTERACTION_TARGETING_BUILD_MARKER } from '../packages/client-runtime/index.js';

const outputRoot = path.resolve(process.env.WECHAT_GAME_OUTPUT_DIR ?? 'dist/wechat-game');
const retiredInteriorPackages = ['baishi-interior-salon', 'baishi-interior-grocery', 'baishi-interior-trade', 'baishi-interior-cloth', 'baishi-interior-inn', 'baishi-interior-guest'];
const vite = path.resolve('node_modules/vite/bin/vite.js');
try {
  await rm(outputRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
} catch (error: any) {
  throw new Error(`Cannot clean ${outputRoot}. Close the WeChat Developer Tools project before rebuilding. (${error?.code ?? 'unknown'})`);
}
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
const packageRoots = [...WECHAT_STARTUP_PACKAGE_ROOTS];
const gameConfig = JSON.parse(await readFile(path.join(outputRoot, 'game.json'), 'utf8')) as { subpackages: { name: string; root: string }[] };
const startup = await readFile(path.join(outputRoot, 'game.js'), 'utf8');
const startupPackages = [...startup.matchAll(/'((?:baishi-ground|baishi-world|baishi-portraits|baishi-interior-[a-z]+))'/g)].map(match => match[1]);
if (new Set(startupPackages).size !== startupPackages.length || startupPackages.length !== WECHAT_STARTUP_PACKAGE_ROOTS.length || WECHAT_STARTUP_PACKAGE_ROOTS.some(root => !startupPackages.includes(root))) {
  throw new Error('WeChat startup subpackage list must include only core startup packages');
}
if (gameConfig.subpackages.length !== packageRoots.length || packageRoots.some(root => !gameConfig.subpackages.some(item => item.name === root && item.root === root))) {
  throw new Error('WeChat game.json subpackage names/roots do not match packaged asset roots');
}
if (gameConfig.subpackages.some(item => retiredInteriorPackages.includes(item.name) || retiredInteriorPackages.includes(item.root))) {
  throw new Error('WeChat game.json still contains retired interior subpackages');
}
for (const root of packageRoots) {
  await mkdir(path.join(outputRoot, root), { recursive: true });
  // 微信小游戏要求每个分包根目录提供 game.js；资源分包无需额外业务逻辑。
  await writeFile(path.join(outputRoot, root, 'game.js'), `'use strict';\n`);
}
const resourceReport = [];
for (const asset of wechatAssets) {
  const source = path.resolve('apps/admin/public', asset.source.split('?')[0].replace(/^\//, ''));
  const target = path.join(outputRoot, asset.path);
  await cp(source, target);
  const original = await readFile(source), packaged = await readFile(target);
  if (!original.equals(packaged)) throw new Error(`Packaged asset mismatch: ${asset.path}`);
  const width = packaged.readUInt32BE(16), height = packaged.readUInt32BE(20);
  resourceReport.push({ key: asset.key, path: asset.path, bytes: packaged.length, width, height, decodedBytes: width * height * 4, sha256: createHash('sha256').update(packaged).digest('hex') });
}
for (const asset of wechatAssets) {
  let current = outputRoot;
  for (const segment of asset.path.split('/')) {
    const entries = await readdir(current);
    if (!entries.includes(segment)) throw new Error(`Packaged asset missing or case mismatch: ${asset.path}`);
    current = path.join(current, segment);
  }
  if (!(await stat(current)).isFile()) throw new Error(`Packaged asset is not a file: ${asset.path}`);
}
await writeFile(path.join(outputRoot, 'asset-manifest.json'), JSON.stringify(wechatAssets, null, 2));
await writeFile(path.join(outputRoot, 'asset-check-report.json'), JSON.stringify(resourceReport, null, 2));
for (const scene of baishiInteriorArtRegistry) {
  remoteAsset(scene.resourceId);
  remoteAsset(scene.foreground.resourceId);
}
for (const root of retiredInteriorPackages) {
  if (await stat(path.join(outputRoot, root)).then(() => true).catch(() => false)) throw new Error(`Retired interior subpackage remains in build output: ${root}`);
}
const finalConfigFiles = ['game.json', 'project.config.json', 'asset-manifest.json'];
for (const file of finalConfigFiles) {
  const content = await readFile(path.join(outputRoot, file), 'utf8');
  if (retiredInteriorPackages.some(root => content.includes(root))) throw new Error(`Retired interior subpackage reference remains in ${file}`);
}
const bundle = await readFile(path.join(outputRoot, 'game.bundle.js'), 'utf8');
if (retiredInteriorPackages.some(root => bundle.includes(root))) throw new Error('WeChat runtime still references a retired interior subpackage');
if (!bundle.includes(INTERACTION_TARGETING_BUILD_MARKER)) throw new Error('WeChat bundle is missing the current interaction targeting marker');
console.log(`正式 PNG ${resourceReport.length} 张，内容与 Web 源文件逐字节一致；解码像素约 ${(resourceReport.reduce((sum, item) => sum + item.decodedBytes, 0) / 1024 / 1024).toFixed(2)} MiB（不含引擎/Canvas）。`);

async function directoryBytes(root: string, ignoredTopLevel = new Set<string>()): Promise<number> {
  let total = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (ignoredTopLevel.has(entry.name)) continue;
    const target = path.join(root, entry.name);
    total += entry.isDirectory() ? await directoryBytes(target) : (await stat(target)).size;
  }
  return total;
}
const maxPackageBytes = 4 * 1024 * 1024;
const packageSizes = new Map<string, number>([['main', await directoryBytes(outputRoot, new Set(packageRoots))]]);
for (const root of packageRoots) packageSizes.set(root, await directoryBytes(path.join(outputRoot, root)));
for (const [name, bytes] of packageSizes) {
  if (bytes > maxPackageBytes) throw new Error(`微信小游戏分包 ${name} 为 ${(bytes / 1024 / 1024).toFixed(2)} MiB，超过 4 MiB 上限。`);
  console.log(`微信小游戏分包 ${name}: ${(bytes / 1024 / 1024).toFixed(2)} MiB`);
}
console.log(`微信小游戏真机体验包已生成：${outputRoot}`);
