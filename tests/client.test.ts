import test from 'node:test';
import assert from 'node:assert/strict';
import {GameController} from '../packages/client-runtime/index.js';
import {initialWorld,baishiBuildingObjectCollision} from '../packages/game-config/index.js';
import {sceneView} from '../packages/game-rules/index.js';

test('客户端 stand 直接拒绝每个正式建筑局部碰撞中心点',()=>{const c=new GameController(async()=>({}));c.boot={player:{id:'p',nickname:'旅人',cash:120,stamina:100,status:'ACTIVE',sceneId:'STREET_BAISHI_01',x:23,y:23,appearance:{} as any,inventory:{},cosmetics:[],ledger:[],tradeCounts:{},metNpcs:[]},serverTime:'',worldVersion:1,configVersion:1,assetVersion:1,assetManifest:'',colors:{},appearances:[],features:{}};c.view=sceneView(initialWorld,'STREET_BAISHI_01',new Date('2026-09-11T12:00:00Z'));for(const [buildingId,rects] of Object.entries(baishiBuildingObjectCollision))for(const [index,rect] of rects.entries())assert.equal(c.stand(rect.x+rect.width/2,rect.y+rect.height/2),false,`${buildingId}#${index+1} 中心点必须不可站立`);});
test('弱网重试保留完全相同请求，确认前阻止新经济操作',async()=>{const calls:any[]=[];let fail=true;const c=new GameController(async(path,body)=>{calls.push({path,body});if(fail)throw new Error('offline');return {ok:true};});await assert.rejects(()=>c.write('/v1/economy/buy',{itemId:'RICE_01'}));assert.ok(c.pending);await assert.rejects(()=>c.write('/v1/economy/buy',{itemId:'RICE_01'}),/尚未确认/);assert.equal(calls.length,1);fail=false;await c.retry();assert.deepEqual(calls[0],calls[1]);assert.equal(c.pending,null);assert.equal(c.offline,false);});
test('明确业务拒绝不无限重试',async()=>{const c=new GameController(async()=>{throw Object.assign(new Error('库存不足'),{status:400});});await assert.rejects(()=>c.write('/v1/economy/sell',{itemId:'RICE_01'}));assert.equal(c.pending,null);});
test('退出会清理会话和场景，允许重新登录验证服务端存档',()=>{const c=new GameController(async()=>({}));c.token='token';c.boot={player:{id:'p',nickname:'旅人',cash:120,stamina:100,status:'ACTIVE',sceneId:'STREET_BAISHI_01',x:9,y:41,appearance:null,inventory:{},cosmetics:[],ledger:[],tradeCounts:{},metNpcs:[]},serverTime:'',worldVersion:1,configVersion:1,assetVersion:1,assetManifest:'',colors:{},appearances:[],features:{}};c.view={} as any;c.ghosts=[{} as any];c.offline=true;c.logout();assert.equal(c.token,'');assert.equal(c.boot,null);assert.equal(c.view,null);assert.deepEqual(c.ghosts,[]);assert.equal(c.offline,false);assert.match(c.message,/重新登录/);});

test('移动同步期间保持本地移动，并对服务器位置平滑纠偏',async()=>{let resolve:(value:any)=>void=()=>{};const response=new Promise<any>(r=>{resolve=r;});const c=new GameController(async(path,body:any)=>{assert.equal(path,'/v1/player/move');assert.equal(body.requestId.length,36);return response;});c.boot={player:{id:'p',nickname:'旅人',cash:120,stamina:100,status:'ACTIVE',sceneId:'STREET_BAISHI_01',x:10,y:10,appearance:{} as any,inventory:{},cosmetics:[],ledger:[],tradeCounts:{},metNpcs:[]},serverTime:'',worldVersion:1,configVersion:1,assetVersion:1,assetManifest:'',colors:{},appearances:[],features:{}};c.view={scene:{id:'STREET_BAISHI_01',width:80,height:80,collision:[],roads:[],portals:[],buildingId:null},plots:[],buildings:[],npcs:[]} as any;c.x=10.5;c.y=10;const sync=c.sync();c.tick(.1,1,0);assert.equal(c.x,11);resolve({player:{...c.player,x:10,y:10}});await sync;assert.equal(c.x,11);c.tick(.01,0,0);assert.ok(c.x<11&&c.x>10.5);});

test('第一桶金买卖反馈使用服务端账本金额并更新目标',async()=>{
  const accepted={id:'accepted',type:'QUEST_ACCEPTED',amount:0,before:120,after:120,referenceId:'Q_001',requestId:'r0',createdAt:''};
  const buy={id:'buy',type:'SHOP_BUY',amount:-12,before:120,after:108,referenceId:'B_GROCERY:RICE_01',requestId:'r1',createdAt:''};
  const sell={id:'sell',type:'SHOP_SELL',amount:16,before:108,after:124,referenceId:'B_TRADE:RICE_01',requestId:'r2',createdAt:''};
  const reward={id:'reward',type:'QUEST_REWARD',amount:20,before:124,after:144,referenceId:'Q_001',requestId:'r2',createdAt:''};
  let stage:'buy'|'sell'='buy';
  let c:GameController;c=new GameController(async path=>{assert.match(path,/economy/);return stage==='buy'?{player:{...c.player,cash:108,inventory:{RICE_01:1},ledger:[accepted,buy]}}:{player:{...c.player,cash:144,inventory:{},ledger:[accepted,buy,sell,reward]},dialogue:'任务完成：第一桶金，获得 20 文奖励'};});
  c.token='token';c.boot={player:{id:'p',nickname:'旅人',cash:120,stamina:100,status:'ACTIVE',sceneId:'INTERIOR_B_GROCERY',x:12,y:9,appearance:{} as any,inventory:{},cosmetics:[],ledger:[accepted],tradeCounts:{},metNpcs:[]},serverTime:'',worldVersion:1,configVersion:1,assetVersion:1,assetManifest:'',colors:{},appearances:[],features:{}};c.view={scene:{id:'INTERIOR_B_GROCERY',buildingId:'B_GROCERY'},plots:[],buildings:[{id:'B_GROCERY',name:'街坊杂货铺'}],npcs:[]} as any;c.x=12;c.y=9;
  await c.trade('buy','RICE_01');assert.match(c.message,/获得：鸣山大米 ×1/);assert.match(c.message,/花费：12 文/);assert.match(c.message,/120 → 108/);assert.match(c.message,/带回白石商行出售/);assert.match(c.message,/街坊杂货铺已记住你/);
  stage='sell';c.boot.player.sceneId='INTERIOR_B_TRADE';c.view!.scene.id='INTERIOR_B_TRADE';c.view!.scene.buildingId='B_TRADE';
  await c.trade('sell','RICE_01');assert.match(c.message,/出售：鸣山大米 ×1/);assert.match(c.message,/获得：16 文/);assert.match(c.message,/任务完成：第一桶金/);assert.match(c.message,/任务奖励：20 文/);assert.match(c.message,/108 → 144/);
});

test('任务追踪器从 Quest 配置生成步骤、目标、奖励和完成状态',()=>{
  const accepted={id:'accepted',type:'QUEST_ACCEPTED',amount:0,before:120,after:120,referenceId:'Q_001',requestId:'r0',createdAt:''};
  const buy={id:'buy',type:'SHOP_BUY',amount:-12,before:120,after:108,referenceId:'B_GROCERY:RICE_01',requestId:'r1',createdAt:''};
  const reward={id:'reward',type:'QUEST_REWARD',amount:20,before:124,after:144,referenceId:'Q_001',requestId:'r2',createdAt:''};
  const c=new GameController(async()=>({}));
  c.boot={player:{id:'p',nickname:'旅人',cash:108,stamina:100,status:'ACTIVE',sceneId:'STREET_BAISHI_01',x:12,y:15,appearance:{} as any,inventory:{RICE_01:1},cosmetics:[],ledger:[accepted,buy],tradeCounts:{},metNpcs:[]},serverTime:'',worldVersion:1,configVersion:1,assetVersion:1,assetManifest:'',colors:{},appearances:[],features:{}};
  c.quests=[{id:'Q_001',name:'第一桶金',steps:[{type:'BUY',target:'RICE_01',count:1,title:'购买鸣山大米',objective:'前往街坊杂货铺购买 1 份鸣山大米。'},{type:'SELL',target:'RICE_01',count:1,title:'出售鸣山大米',objective:'将鸣山大米带回白石商行出售。'}],reward:20,enabled:true,state:'in_progress',progress:{BUY:1,SELL:0},stepProgress:[1,0],rewardClaimed:false}];
  let task=c.questTracker()[0];assert.equal(task.name,'第一桶金');assert.equal(task.currentStep,'步骤 2/2 · 出售鸣山大米');assert.match(task.currentObjective,/白石商行/);assert.equal(task.rewardSummary,'奖励：20 文');
  c.boot.player.ledger.push({id:'sell',type:'SHOP_SELL',amount:16,before:108,after:124,referenceId:'B_TRADE:RICE_01',requestId:'r2',createdAt:''},reward);task=c.questTracker()[0];assert.equal(task.completed,true);assert.equal(task.currentStep,'全部步骤已完成');
});

test('雨前送样 DELIVER 后追踪器进入 REPORT，REPORT 后才完成',()=>{
  const quest=initialWorld.quests.find(item=>item.id==='Q_003')!;
  const accepted={id:'a',type:'QUEST_ACCEPTED',amount:0,before:120,after:120,referenceId:quest.id,requestId:'r1',createdAt:''};
  const acquired={id:'b',type:'QUEST_ITEM_ACQUIRED',amount:0,before:120,after:120,referenceId:'Q_003:CLOTH_SAMPLE_01',requestId:'r1',createdAt:''};
  const delivered={id:'c',type:'QUEST_ITEM_DELIVERED',amount:0,before:120,after:120,referenceId:'Q_003:CLOTH_SAMPLE_01',requestId:'r2',createdAt:''};
  const reported={id:'d',type:'QUEST_REPORTED',amount:0,before:120,after:120,referenceId:'Q_003:NPC_CLOTH_SHOPKEEPER',requestId:'r3',createdAt:''};
  const reward={id:'e',type:'QUEST_REWARD',amount:15,before:120,after:135,referenceId:'Q_003',requestId:'r3',createdAt:''};
  const c=new GameController(async()=>({}));c.boot={player:{id:'p',nickname:'旅人',cash:120,stamina:100,status:'ACTIVE',sceneId:'INTERIOR_B_SALON',x:8,y:9,appearance:{} as any,inventory:{},cosmetics:[],ledger:[accepted,acquired,delivered],tradeCounts:{},metNpcs:[]},serverTime:'',worldVersion:1,configVersion:1,assetVersion:1,assetManifest:'',colors:{},appearances:[],features:{}};c.quests=[{...quest,state:'in_progress',progress:{ACQUIRE:1,DELIVER:1,REPORT:0},stepProgress:[1,1,0],rewardClaimed:false}];
  let tracker=c.questTracker()[0];assert.equal(tracker.currentStep,'步骤 3/3 · 回春衫衣坊向掌柜汇报');assert.match(tracker.currentObjective,/春衫衣坊/);assert.equal(tracker.completed,false);
  c.boot.player.ledger.push(reported,reward);tracker=c.questTracker()[0];assert.equal(tracker.currentStep,'全部步骤已完成');assert.equal(tracker.completed,true);assert.equal(tracker.rewardSummary,'奖励：15 文');
});

test('通用商店视图从场景配置生成商品、余额、持有量和双向价格',()=>{
  const c=new GameController(async()=>({}));
  c.boot={player:{id:'p',nickname:'旅人',cash:108,stamina:100,status:'ACTIVE',sceneId:'INTERIOR_B_GROCERY',x:12,y:9,appearance:{} as any,inventory:{RICE_01:1},cosmetics:[],ledger:[],tradeCounts:{},metNpcs:[]},serverTime:'',worldVersion:1,configVersion:1,assetVersion:1,assetManifest:'',colors:{},appearances:[],features:{}};
  c.view={scene:{id:'INTERIOR_B_GROCERY',buildingId:'B_GROCERY'},plots:[],npcs:[],items:[{id:'RICE_01',name:'鸣山大米',icon:'米',basePrice:12,giftable:true,stackMax:99}],buildings:[{id:'B_GROCERY',name:'街坊杂货铺',buildingType:'SHOP',assetKey:'',interiorSceneId:'INTERIOR_B_GROCERY',openingHours:['00:00','00:00'],enabled:true,buyable:false,baseValue:0,stock:{RICE_01:{buy:12,sell:8,dailyLimit:30}}}]} as any;
  const shop=c.shopPanel();assert.equal(shop?.title,'街坊杂货铺');assert.equal(shop?.balance,108);assert.deepEqual(shop?.items[0],{id:'RICE_01',name:'鸣山大米',icon:'米',owned:1,buyPrice:12,sellPrice:8,dailyLimit:30});
});

test('五名核心 NPC 首次与再次交谈显示轻量认识关系反馈',async()=>{for(const npc of [{id:'NPC_001',name:'陈掌柜'},{id:'NPC_TRADE_CLERK',name:'白石商行伙计'},{id:'NPC_GROCERY_CLERK',name:'街坊杂货铺店员'},{id:'NPC_SALON_HAIRDRESSER',name:'青丝美发师'},{id:'NPC_CLOTH_SHOPKEEPER',name:'春衫掌柜'}]){let c:GameController;c=new GameController(async()=>({player:{...c.player,metNpcs:[npc.id]},dialogue:'欢迎光临'}));c.token='token';c.boot={player:{id:'p',nickname:'旅人',cash:120,stamina:100,status:'ACTIVE',sceneId:'TEST_INTERIOR',x:12,y:9,appearance:{} as any,inventory:{},cosmetics:[],ledger:[],tradeCounts:{},metNpcs:[]},serverTime:'',worldVersion:1,configVersion:1,assetVersion:1,assetManifest:'',colors:{},appearances:[],features:{}};c.view={scene:{id:'TEST_INTERIOR'},plots:[],buildings:[],npcs:[npc]} as any;await c.write('/v1/npc/talk',{npcId:npc.id});assert.match(c.message,new RegExp('初次结识：'+npc.name));assert.match(c.message,/关系状态：已认识/);await c.write('/v1/npc/talk',{npcId:npc.id});assert.doesNotMatch(c.message,/初次结识/);assert.match(c.message,/关系状态：已认识/);}});
