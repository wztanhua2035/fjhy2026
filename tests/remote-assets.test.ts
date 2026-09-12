import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assetUrl, manifestContainsVendorUrls, remoteAsset, remoteAssetManifest, baishiInteriorArtRegistry } from '../packages/client-runtime/index.js';
import { WechatInteriorAssetLoader, WechatRemoteAssetCache } from '../apps/wechat-game/src/remote-interior-assets.js';

function fakeWx(download: (options: any) => void) {
  const files = new Set<string>(); let index = '';
  const fs = {
    readFile: (options: any) => index ? options.success(index) : options.fail(new Error('missing')),
    writeFile: (options: any) => { index = options.data; options.success({}); },
    access: (options: any) => files.has(options.path) ? options.success({}) : options.fail(new Error('missing')),
    saveFile: (options: any) => { files.add(options.filePath); options.success({ savedFilePath: options.filePath }); }
  };
  return { env: { USER_DATA_PATH: 'wxfile://cache' }, getFileSystemManager: () => fs, getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }), downloadFile: download, loadSubpackage: (options: any) => options.success({}) };
}

test('shared manifest resolves stable resource IDs to provider-neutral CDN URLs', () => {
  const asset = remoteAsset('BAISHI_INTERIOR_SALON_BG');
  assert.equal(asset.path, 'world/baishi/interiors/salon/background_v1.png');
  assert.equal(assetUrl(asset, 'https://res-fjhy.wzpy.net/'), 'https://res-fjhy.wzpy.net/world/baishi/interiors/salon/background_v1.png');
  assert.equal(manifestContainsVendorUrls(), false);
  assert.equal(Object.keys(remoteAssetManifest.resources).length, 17);
  assert.equal(remoteAsset('SIGN_BAISHI_TRADE_V1').type, 'shop-sign');
});

test('six interiors share twelve resolvable remote resources and support an alternate base URL', () => {
  assert.equal(baishiInteriorArtRegistry.length, 6);
  for (const interior of baishiInteriorArtRegistry) {
    assert.ok(remoteAsset(interior.resourceId)); assert.ok(remoteAsset(interior.foreground.resourceId));
    assert.match(assetUrl(remoteAsset(interior.resourceId), 'https://assets.example.test'), /^https:\/\/assets\.example\.test\/world\//);
  }
});

test('COS workflow only scopes assets/remote, skips safely without secrets, and keeps the manifest behind CDN verification', async () => {
  const workflow = await readFile('.github/workflows/cos-asset-publish.yml', 'utf8');
  const publisher = await readFile('tools/cos_publish_assets.py', 'utf8');
  assert.match(workflow, /assets\/remote/); assert.match(workflow, /COS publish skipped: secrets not configured/);
  assert.doesNotMatch(workflow, /DeleteObject|coscmd rm| rm /); assert.match(publisher, /assets = \[item for item in changed if item != manifest\]/);
  assert.match(publisher, /SIMPLE_UPLOAD_LIMIT_BYTES = 32 \* 1024 \* 1024/);
  assert.match(publisher, /client\.put_object/);
  assert.ok(publisher.indexOf('for item in assets:\n        verify_cdn_fn') < publisher.indexOf('if not publish_manifest:'));
});

test('wechat cache reuses a matching version and re-downloads a newer version', async () => {
  let downloads = 0;
  const wxRuntime = fakeWx((options: any) => { downloads++; options.success({ statusCode: 200, tempFilePath: `tmp-${downloads}` }); });
  const cache = new WechatRemoteAssetCache(wxRuntime, 'https://res-fjhy.wzpy.net');
  const first = await cache.localPath('BAISHI_INTERIOR_SALON_BG');
  const second = await cache.localPath('BAISHI_INTERIOR_SALON_BG');
  assert.equal(first, second); assert.equal(downloads, 1);
  const entry = remoteAssetManifest.resources.BAISHI_INTERIOR_SALON_BG; const old = entry.version; entry.version++;
  try { await cache.localPath('BAISHI_INTERIOR_SALON_BG'); assert.equal(downloads, 2); } finally { entry.version = old; }
});

test('wechat interior failure uses the shared low-cost fallback and never affects startup assets', async () => {
  const wxRuntime = fakeWx((options: any) => options.fail(new Error('offline')));
  const loader = new WechatInteriorAssetLoader(wxRuntime, 'https://res-fjhy.wzpy.net');
  const keys = new Set<string>(); const textures = { exists: (key: string) => keys.has(key), addImage: (key: string) => keys.add(key), addSpriteSheet: () => {} };
  await loader.load(baishiInteriorArtRegistry[0]!, textures, () => ({ onload: () => {}, set src(_value: string) { queueMicrotask(() => this.onload()); } }));
  assert.deepEqual([...keys].sort(), ['interior-salon-bg-v1', 'interior-salon-fg-v1']);
});

test('all six interior resource pairs load from CDN and remain independently addressable', async () => {
  const wxRuntime = fakeWx((options: any) => options.success({ statusCode: 200, tempFilePath: `tmp-${options.url.split('/').at(-1)}` }));
  const loader = new WechatInteriorAssetLoader(wxRuntime, 'https://res-fjhy.wzpy.net');
  const keys = new Set<string>();
  const textures = { exists: (key: string) => keys.has(key), addImage: (key: string) => keys.add(key), addSpriteSheet: () => {} };
  for (const interior of baishiInteriorArtRegistry) {
    await loader.load(interior, textures, () => ({ onload: () => {}, set src(_value: string) { queueMicrotask(() => this.onload()); } }));
  }
  assert.equal(keys.size, 12);
});
