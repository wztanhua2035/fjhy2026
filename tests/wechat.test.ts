import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadWechatAssets, wechatAssets, wechatStartupAssets, WECHAT_STARTUP_PACKAGE_ROOTS } from '../apps/wechat-game/src/assets.js';
import { mobileLayout } from '../apps/wechat-game/src/layout.js';
import { MemoryRepository } from '../apps/server/src/repository.js';
import { baishiSyncPlan, syncBaishiContent } from '../apps/server/src/sync-baishi.js';
import { initialWorld } from '../packages/game-config/index.js';
import { sceneView, plotEntrances } from '../packages/game-rules/index.js';
import { GameController } from '../packages/client-runtime/index.js';
import { createWeChatPlatform, allowWechatDebug } from '../apps/wechat-game/src/wechat-platform.js';
import { buildApp } from '../apps/server/src/app.js';
import { baishiCompatibility } from '../apps/wechat-game/src/compatibility.js';
import { validateWorld } from '../apps/server/src/config.js';

test('微信发布版和未识别环境不发送 DEV 覆盖', () => {
  assert.equal(allowWechatDebug(true, 'develop'), true);
  for (const version of ['release', 'trial', undefined]) assert.equal(allowWechatDebug(true, version), false);
  assert.equal(allowWechatDebug(false, 'develop'), false);
});

test('配置兼容诊断识别旧数据且不受 JSON 字段顺序影响', () => {
  const config = validateWorld(initialWorld);
  const view = sceneView(config, 'STREET_BAISHI_01', new Date(), true);
  assert.deepEqual(baishiCompatibility(view, config.quests as any), []);
  view.plots.find(p => p.id === 'P_BAISHI_005')!.buildingId = null;
  assert.ok(baishiCompatibility(view, []).includes('P_BAISHI_005'));
});

test('wx.request → HTTP → 共享控制器：送样、关系、断线重登、汇报奖励', async () => {
  const previousWx = (globalThis as any).wx;
  const repo = new MemoryRepository();
  const env = {mode:'development',appEnv:'DEV',port:8080,jwtSecret:'test-jwt-secret-thirty-two-characters-long',subjectSecret:'test-subject-secret-thirty-two-characters',adminToken:'test-admin-token-thirty-two-characters-long',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost:5173',assetBase:'http://localhost:8080/assets'};
  const app = await buildApp(repo, env, { now: () => new Date('2026-09-12T15:00:00Z'), exchangeCode: async () => 'wechat-slice-test' });
  (globalThis as any).wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    request: async (options: any) => { const result = await app.inject({method:options.method,url:new URL(options.url).pathname,headers:options.header,payload:options.data}); options.success({statusCode:result.statusCode,data:result.json()}); }
  };
  try {
    const platform = createWeChatPlatform('http://localhost:8080', {debugOpenAll:true});
    let c = new GameController(platform.transport);
    await c.loginWechat('code');
    await c.create('FEMALE',{skinToneId:'SKIN_LIGHT',hairId:'F_HAIR_01',outfitId:'F_OUTFIT_01'});
    await c.advanceDialogue();
    const place = async (npcId: string) => { if(c.dialogue)await c.advanceDialogue();const npc = initialWorld.npcs.find(n => n.id === npcId)!; Object.assign(repo.players.get(c.player!.id)!,{sceneId:npc.sceneId,x:npc.x,y:npc.y+1}); await c.refresh(); };
    await place('NPC_CLOTH_SHOPKEEPER'); await c.interact();
    assert.equal(c.player!.inventory.CLOTH_SAMPLE_01, 1);
    assert.ok(c.player!.metNpcs.includes('NPC_CLOTH_SHOPKEEPER'));
    await place('NPC_SALON_HAIRDRESSER'); await c.interact();
    assert.equal(c.player!.inventory.CLOTH_SAMPLE_01, undefined);
    assert.match(c.questTracker().find(q => q.id === 'Q_003')!.currentStep, /3\/3/);
    c = new GameController(platform.transport); await c.loginWechat('new-code');
    assert.equal(c.questTracker().find(q => q.id === 'Q_003')!.completed, false);
    await place('NPC_CLOTH_SHOPKEEPER'); await c.interact();
    assert.equal(c.questTracker().find(q => q.id === 'Q_003')!.completed, true);
    const cash = c.player!.cash;
    await c.advanceDialogue();await c.interact(); assert.equal(c.player!.cash, cash);
  } finally { (globalThis as any).wx = previousWx; await app.close(); }
});

test('微信启动只注册核心资源，室内包不再阻塞启动', async () => {
  const keys = new Set<string>(), paths: string[] = [], sheets: string[] = [];
  const textures = { exists: (key: string) => keys.has(key), addImage: (key: string) => keys.add(key), addSpriteSheet: (key: string, _image: any, config: any) => { assert.equal(config.frameWidth, 64); sheets.push(key); keys.add(key); } };
  const createImage = () => ({ onload: () => {}, set src(path: string) { paths.push(path); queueMicrotask(() => this.onload()); } });
  assert.deepEqual(await loadWechatAssets(textures, createImage), []);
  assert.equal(keys.size, wechatStartupAssets.length);
  assert.equal(sheets.length, 7);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.every(path => /^baishi-(ground|world|portraits)\//.test(path)));
  assert.ok(paths.includes('baishi-world/building_cloth_shop_fg.png'));
  assert.equal(paths.filter(path => path.startsWith('baishi-interior-')).length, 0);
  await loadWechatAssets(textures, createImage);
  assert.equal(paths.length, wechatStartupAssets.length, '切换场景不得再次加载');
});

test('启动时只预加载核心分包，保留室内分包给按需 fallback', async () => {
  const startup = await readFile('apps/wechat-game/game.js', 'utf8');
  const config = JSON.parse(await readFile('apps/wechat-game/game.json', 'utf8')) as { subpackages: { name: string; root: string }[] };
  const names = [...startup.matchAll(/'((?:baishi-ground|baishi-world|baishi-portraits|baishi-interior-[a-z]+))'/g)].map(match => match[1]);
  assert.deepEqual(new Set(names), new Set(WECHAT_STARTUP_PACKAGE_ROOTS));
  for (const asset of wechatAssets) assert.ok(config.subpackages.some(item => item.name === asset.path.split('/')[0] && item.root === item.name));
  assert.match(startup, /Promise\.all\(packageNames\.map/);
  assert.match(startup, /\.then\(\(\) => require\('\.\/game\.bundle\.js'\)\)/);
});

test('图片失败显示具体文件，允许仅重试缺失资源', async () => {
  const keys = new Set(wechatStartupAssets.slice(1).map(a => a.key));
  const textures = { exists: (key: string) => keys.has(key), addImage: () => {}, addSpriteSheet: () => {} };
  const failures = await loadWechatAssets(textures, () => ({ onerror: () => {}, set src(_path: string) { queueMicrotask(() => this.onerror()); } }));
  assert.deepEqual(failures, [wechatStartupAssets[0].path]);
});

test('白石街旧发布配置升级包含五栋建筑、三段任务，保留其他内容和历史发布', async () => {
  const repo = new MemoryRepository();
  const old = structuredClone(initialWorld);
  old.plots.find(p => p.id === 'P_BAISHI_005')!.buildingId = null;
  old.scenes.find(s => s.id === 'STREET_BAISHI_01')!.collision = [];
  old.quests = old.quests.filter(q => q.id !== 'Q_003');
  const release = await repo.draft(old, 1); await repo.transition(release.id, 'TEST'); await repo.transition(release.id, 'PUBLISHED');
  const player = await repo.login('preserve-player');
  const before = await repo.player(player.id);
  const plan = await syncBaishiContent(repo);
  assert.equal(plan.published, false); assert.ok(plan.changed.includes('quests:Q_003'));
  const result = await syncBaishiContent(repo, true);
  assert.equal(result.published, true);
  const current = await repo.world();
  assert.equal(current.plots.find(p => p.id === 'P_BAISHI_005')!.buildingId, 'B_CLOTH');
  assert.deepEqual(current.quests.find(q => q.id === 'Q_003')!.steps.map(s => s.type), ['ACQUIRE','DELIVER','REPORT']);
  assert.deepEqual(await repo.player(player.id), before);
  assert.ok((await repo.releases()).some(r => r.id === release.id && r.status === 'ARCHIVED'));
  assert.equal((await syncBaishiContent(repo, true)).published, false, '重复启动不得重复发布');
  assert.deepEqual(baishiSyncPlan(current).changed, []);
});

test('微信共享 runtime 使用五店入口、室内 NPC 和真实碰撞集合', () => {
  const c = new GameController(async () => ({}));
  for (const id of ['B_INN','B_GROCERY','B_TRADE','B_SALON','B_CLOTH']) {
    const plot = initialWorld.plots.find(p => p.buildingId === id)!;
    assert.ok(plot, id);
    const entrance = plotEntrances(plot)[0];
    const interior = sceneView(initialWorld, entrance.targetScene, new Date('2026-09-12T02:00:00Z'), true);
    assert.ok(interior.npcs.length, id);
    assert.ok(interior.scene.portals.some(p => p.toSceneId === 'STREET_BAISHI_01'));
  }
  c.view = sceneView(initialWorld, 'STREET_BAISHI_01', new Date(), true);
  for (const rect of c.view.scene.collision) assert.equal(c.stand(rect.x + rect.width / 2, rect.y + rect.height / 2), false);
});

test('安全区布局保留摇杆、按钮和胶囊下方空间', () => {
  for (const [width, height] of [[844,390],[960,540],[1024,768]]) {
    const layout = mobileLayout({ windowWidth: width, windowHeight: height, safeArea: { left: 44, right: width - 24, top: 0, bottom: height - 21 } }, { bottom: 40 });
    assert.ok(layout.left >= 16 && layout.right <= layout.width - 16);
    assert.ok(layout.bottom <= 524 && layout.rightTop >= layout.top);
  }
});
