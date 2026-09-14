import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MemoryRepository} from '../apps/server/src/repository.js';
import {GameService} from '../apps/server/src/service.js';
import {ensureFirstDayQuests} from '../apps/server/src/sync-first-day-quests.js';
import {GameController} from '../packages/client-runtime/index.js';
import {initialWorld} from '../packages/game-config/index.js';
import {sceneView} from '../packages/game-rules/index.js';
import {testProfile} from './creation-fixture.js';

test('staging 旧发布配置补齐三条首日任务的接取 NPC 并保留其他配置和玩家存档',async()=>{
  const repo=new MemoryRepository(),old=repo.versions[0].config;
  old.quests=old.quests.filter(quest=>quest.id!=='Q_002');
  old.items=old.items.filter(item=>item.id!=='ERRAND_PACKAGE_01');
  old.npcs.find(npc=>npc.id==='NPC_001')!.questId=undefined;
  old.npcs.find(npc=>npc.id==='NPC_TRADE_CLERK')!.questId=undefined;
  old.npcs.find(npc=>npc.id==='NPC_CLOTH_SHOPKEEPER')!.questId=undefined;
  old.quests.find(quest=>quest.id==='Q_001')!.reward=21;
  old.buildings.find(building=>building.id==='B_GROCERY')!.stock.RICE_01.baseBuyPrice=19;
  const player=await repo.login('quest-release');
  const before=await repo.player(player.id);
  const result=await ensureFirstDayQuests(repo);
  assert.equal(result.published,true);
  const live=await repo.world();
  assert.ok(live.quests.some(quest=>quest.id==='Q_002'));
  assert.equal(live.quests.find(quest=>quest.id==='Q_001')?.reward,20);
  assert.ok(live.items.some(item=>item.id==='ERRAND_PACKAGE_01'));
  assert.equal(live.npcs.find(npc=>npc.id==='NPC_001')?.questId,'Q_002');
  assert.equal(live.npcs.find(npc=>npc.id==='NPC_TRADE_CLERK')?.questId,'Q_001');
  assert.equal(live.npcs.find(npc=>npc.id==='NPC_CLOTH_SHOPKEEPER')?.questId,'Q_003');
  assert.equal(live.buildings.find(building=>building.id==='B_GROCERY')!.stock.RICE_01.baseBuyPrice,19);
  assert.deepEqual(await repo.player(player.id),before);
  assert.equal((await ensureFirstDayQuests(repo)).published,false);
  const service=new GameService(repo);
  await service.action(player.id,'create',{requestId:randomUUID(),gender:'FEMALE',faceId:'F_FACE_01',profile:testProfile()});
  Object.assign(repo.players.get(player.id)!,{sceneId:'INTERIOR_B_INN',x:12,y:18});
  await service.action(player.id,'introComplete',{requestId:randomUUID()});
  Object.assign(repo.players.get(player.id)!,{sceneId:'STREET_BAISHI_01',x:20.5,y:20});
  const entered=await service.action(player.id,'enter',{requestId:randomUUID(),plotId:'P_BAISHI_002',entranceId:'ENT_BAISHI_GROCERY_S'});
  assert.equal(entered.speaker,'街坊杂货铺店员');
  assert.match(entered.dialogue,/急件/);
  assert.equal((await repo.player(player.id)).inventory.ERRAND_PACKAGE_01,1);
  Object.assign(repo.players.get(player.id)!,{sceneId:'INTERIOR_B_CLOTH',x:16,y:9,storyFlags:{FIRST_DAY_ENTERED_BAISHI:true}});
  const rainSample=await service.action(player.id,'talk',{requestId:randomUUID(),npcId:'NPC_CLOTH_SHOPKEEPER'});
  assert.match(rainSample.dialogue,/新料子/);
  assert.equal((await repo.player(player.id)).inventory.CLOTH_SAMPLE_01,1);
});

test('旧第一桶金存档也优先显示急差，两条任务进度互不覆盖',()=>{
  const controller=new GameController(async()=>({}));
  const ledger=[
    {id:'old-trade',type:'QUEST_ACCEPTED',amount:0,before:120,after:120,referenceId:'Q_001',requestId:randomUUID(),createdAt:'2026-09-13T00:00:00Z'},
    {id:'errand',type:'QUEST_ACCEPTED',amount:0,before:120,after:120,referenceId:'Q_002',requestId:randomUUID(),createdAt:'2026-09-14T00:00:00Z'}
  ];
  controller.boot={player:{id:'p',nickname:'旅人',cash:120,stamina:100,status:'ACTIVE',sceneId:'INTERIOR_B_INN',x:12,y:18,appearance:{} as any,inventory:{},storage:{},life:{energy:100,sleep:null,lastEffectiveSleepAt:null,lastSleepResult:null},cosmetics:[],ledger,tradeCounts:{},metNpcs:[]},serverTime:'',worldVersion:1,configVersion:1,assetVersion:1,assetManifest:'',colors:{},appearances:[],features:{}};
  controller.quests=initialWorld.quests.filter(quest=>['Q_001','Q_002'].includes(quest.id)) as any;
  assert.deepEqual(controller.questTracker().map(task=>task.name),['掌柜的急差','第一桶金']);
  assert.match(controller.questTracker()[0].currentObjective,/急件/);
});

test('共享客户端进入杂货铺时保留店员自动对白，不被进入建筑提示覆盖',async()=>{
  const plot=initialWorld.plots.find(item=>item.id==='P_BAISHI_002')!,door=plot.entrances![0];
  let controller:GameController;
  controller=new GameController(async path=>{
    if(path==='/v1/world/enter')return {player:{...controller.player,sceneId:'INTERIOR_B_GROCERY',x:12,y:15},dialogue:'陈掌柜让你来取急件吧？拿上。',speaker:'街坊杂货铺店员'};
    if(path==='/v1/quests')return {quests:[]};
    if(path.endsWith('/ghosts'))return {ghosts:[]};
    if(path.startsWith('/v1/world/scenes/'))return sceneView(initialWorld,'INTERIOR_B_GROCERY',new Date());
    throw new Error(`Unexpected path: ${path}`);
  });
  controller.boot={player:{id:'p',nickname:'旅人',cash:120,stamina:100,status:'ACTIVE',sceneId:'STREET_BAISHI_01',x:door.position.x,y:door.position.y,appearance:{} as any,inventory:{},storage:{},life:{energy:100,sleep:null,lastEffectiveSleepAt:null,lastSleepResult:null},cosmetics:[],ledger:[],tradeCounts:{},metNpcs:[]},serverTime:'',worldVersion:1,configVersion:1,assetVersion:1,assetManifest:'',colors:{},appearances:[],features:{}};
  controller.view=sceneView(initialWorld,'STREET_BAISHI_01',new Date());
  controller.x=door.position.x;controller.y=door.position.y;
  (controller as any).sync=async()=>{};
  await controller.interact();
  assert.equal(controller.dialogueSpeaker,'街坊杂货铺店员');
  assert.match(controller.message,/急件/);
  assert.doesNotMatch(controller.message,/进入建筑/);
});

test('任务完成对白逐句播放后才请求服务端 finalize',async()=>{
  const calls:string[]=[];let controller:GameController;controller=new GameController(async path=>{
    calls.push(path);
    if(path==='/v1/quest/finalize')return {player:{...controller.player,cash:132},dialogue:'任务完成\n《掌柜的急差》\n+12文'};
    if(path==='/v1/quests')return {quests:[]};
    throw new Error(`Unexpected path: ${path}`);
  });
  controller.boot={player:{id:'p',nickname:'旅人',cash:120,stamina:100,status:'ACTIVE',sceneId:'INTERIOR_B_INN',x:8,y:9,appearance:{} as any,inventory:{ERRAND_PACKAGE_01:1},storage:{},life:{energy:100,sleep:null,lastEffectiveSleepAt:null,lastSleepResult:null},cosmetics:[],ledger:[],tradeCounts:{},metNpcs:[]},serverTime:'',worldVersion:1,configVersion:1,assetVersion:1,assetManifest:'',colors:{},appearances:[],features:{}};
  controller.view={scene:{id:'INTERIOR_B_INN'},plots:[],buildings:[],npcs:[]} as any;
  (controller as any).dialogueQueue=[{speakerId:'NPC_001',speaker:'陈掌柜',text:'这事要是再晚一点，还真有点麻烦。多谢你。'}];
  (controller as any).pendingQuestFinalization='Q_002';controller.dialogue='拿回来了？辛苦你跑这一趟，我正等着呢。';controller.dialogueSpeaker='陈掌柜';
  await controller.advanceDialogue();assert.equal(controller.dialogue,'这事要是再晚一点，还真有点麻烦。多谢你。');assert.deepEqual(calls,[]);
  await controller.advanceDialogue();assert.deepEqual(calls,['/v1/quest/finalize','/v1/quests']);assert.equal(controller.player?.cash,132);
});
