import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MemoryRepository} from '../apps/server/src/repository.js';
import {buildApp} from '../apps/server/src/app.js';
import {GameService} from '../apps/server/src/service.js';
import {validateWorld} from '../apps/server/src/config.js';
import {initialWorld,baishiBuildingObjectCollision,baishiStreetObjectCollision} from '../packages/game-config/index.js';
import {canStand,inEntranceArea,plotEntrances} from '../packages/game-rules/index.js';
import {isOpen,phaseAt,sceneView} from '../packages/game-rules/index.js';
import {baishiLayerPlacements,baishiBuildingLayerBindings} from '../packages/game-config/baishi-layers.js';
const env={mode:'development',appEnv:'DEV',port:8080,jwtSecret:'test-jwt-secret-thirty-two-characters-long',subjectSecret:'test-subject-secret-thirty-two-characters',adminToken:'test-admin-token-thirty-two-characters-long',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost:5173',assetBase:'http://localhost:8080/assets'};
const appearance=(gender='FEMALE')=>({requestId:randomUUID(),gender,baseAvatarId:`${gender}_04`,hairColorId:'INK',topColorId:'SAGE',bottomColorId:'CREAM'});
async function fixture(){const repo=new MemoryRepository(),p=await repo.login(randomUUID()),service=new GameService(repo,()=>new Date('2026-09-05T02:00:00Z'));await service.action(p.id,'create',appearance());return {repo,p,service};}
test('北京时间边界和跨午夜营业窗口',()=>{assert.equal(phaseAt(new Date('2026-09-05T11:59:59Z')),'傍晚');assert.equal(phaseAt(new Date('2026-09-05T12:00:00Z')),'夜晚');assert.equal(phaseAt(new Date('2026-09-05T16:00:00Z')),'深夜');assert.equal(isOpen(['20:00','02:00'],new Date('2026-09-05T17:00:00Z')),true);assert.equal(isOpen(['20:00','02:00'],new Date('2026-09-05T18:00:00Z')),false);});
test('男女各六个基础角色，初次创建重试不重复发钱',async()=>{for(const gender of ['MALE','FEMALE'])assert.equal(initialWorld.appearances.filter(a=>a.partType==='BASE'&&a.genderScope===gender).length,6);const repo=new MemoryRepository(),p=await repo.login('a'),s=new GameService(repo),body=appearance();await Promise.all([s.action(p.id,'create',body),s.action(p.id,'create',body)]);const saved=await repo.player(p.id);assert.equal(saved.cash,120);assert.equal(saved.ledger.length,1);await assert.rejects(()=>s.action(p.id,'create',appearance()));assert.equal((await repo.login('a')).appearance?.baseAvatarId,'FEMALE_04');});
test('完整 HTTP 首登、建角、出门、买入卖出以及账本链路',async()=>{
 const repo=new MemoryRepository(),app=await buildApp(repo,env);try{
 const login=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'flow'}})).json(),headers={authorization:`Bearer ${login.token}`};
 const post=async(url:string,payload:object)=>{const r=await app.inject({method:'POST',url,headers,payload:{requestId:randomUUID(),...payload}});assert.equal(r.statusCode,200,r.body);return r.json();};
 assert.equal((await app.inject({url:'/v1/world/scenes/STREET_BAISHI_01',headers})).statusCode,409);
 await post('/v1/player/appearance/create',appearance());await post('/v1/world/portal',{portalId:'EXIT_B_INN'});
 const scene=(await app.inject({url:'/v1/world/scenes/STREET_BAISHI_01',headers})).json();assert.equal(scene.plots.length,10);assert.equal(scene.buildings.length,5);assert.equal(scene.items.find((item:any)=>item.id==='RICE_01').icon,'米');assert.equal(scene.npcs.length,3);assert.equal(scene.plots[0].entrances[0].direction,'south');assert.equal(scene.plots[3].entrances[0].direction,'south');
 for(const x of [15,21])await post('/v1/player/move',{x,y:20});
 await post('/v1/world/enter',{plotId:'P_BAISHI_002',entranceId:'ENT_BAISHI_GROCERY_S'});
 const buy={requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'RICE_01',quantity:1};const first=await post('/v1/economy/buy',buy);const retry=await post('/v1/economy/buy',buy);assert.deepEqual(first,retry);assert.equal(first.player.cash,108);
 await post('/v1/world/portal',{portalId:'EXIT_B_GROCERY'});for(const x of [27,32.5])await post('/v1/player/move',{x,y:20});await post('/v1/world/enter',{plotId:'P_BAISHI_003',entranceId:'ENT_BAISHI_TRADE_S'});const sold=await post('/v1/economy/sell',{buildingId:'B_TRADE',itemId:'RICE_01',quantity:1});assert.equal(sold.player.cash,144);assert.equal(sold.player.inventory.RICE_01,undefined);assert.deepEqual(sold.player.ledger.map((l:any)=>l.after),[120,108,124,144]);
 }finally{await app.close();}
});
test('伪造价格、数量、身份和未建角交易被拒绝',async()=>{const app=await buildApp(new MemoryRepository(),env);try{assert.equal((await app.inject({url:'/v1/bootstrap'})).statusCode,401);const auth=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'bad'}})).json(),headers={authorization:`Bearer ${auth.token}`};for(const quantity of [-1,0,1.5,100000000])assert.equal((await app.inject({method:'POST',url:'/v1/economy/buy',headers,payload:{requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'RICE_01',quantity}})).statusCode,400);assert.equal((await app.inject({method:'POST',url:'/v1/economy/buy',headers,payload:{requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'RICE_01',quantity:1,price:0}})).statusCode,400);}finally{await app.close();}});
test('交易失败回滚，库存不足、非店铺、负余额拒绝',async()=>{const {repo,p,service:s}=await fixture();await assert.rejects(()=>s.action(p.id,'buy',{requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'RICE_01',quantity:1}));repo.players.get(p.id)!.sceneId='INTERIOR_B_GROCERY';await assert.rejects(()=>s.action(p.id,'sell',{requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'RICE_01',quantity:1}));await assert.rejects(()=>s.action(p.id,'buy',{requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'RICE_01',quantity:20}));assert.equal((await repo.player(p.id)).cash,120);assert.equal((await repo.player(p.id)).ledger.length,1);});
test('同一请求号不同载荷冲突，并发重试只扣一次',async()=>{const {repo,p,service:s}=await fixture();repo.players.get(p.id)!.sceneId='INTERIOR_B_GROCERY';const body={requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'RICE_01',quantity:1};await Promise.all(Array.from({length:20},()=>s.action(p.id,'buy',body)));assert.equal((await repo.player(p.id)).cash,108);await assert.rejects(()=>s.action(p.id,'buy',{...body,quantity:2}),/请求编号/);});
test('外观所有权、性别兼容、Ghost同步',async()=>{const {repo,p,service:s}=await fixture();repo.players.get(p.id)!.sceneId='INTERIOR_B_CLOTH';const change={requestId:randomUUID(),buildingId:'B_CLOTH',appearanceId:'TOP_FEMALE_02',colorId:'ROSE'};await assert.rejects(()=>s.action(p.id,'changeAppearance',change),/尚未拥有/);await s.action(p.id,'purchaseAppearance',{requestId:randomUUID(),buildingId:'B_CLOTH',appearanceId:'TOP_FEMALE_02'});await s.action(p.id,'changeAppearance',change);const saved=await repo.player(p.id);assert.equal(saved.cash,90);assert.equal(saved.appearance?.baseAvatarId,'FEMALE_04');assert.equal((await repo.ghosts('other'))[0].appearance.topStyleId,'TOP_FEMALE_02');assert.equal((await repo.ghosts('other'))[0].appearance.topColorId,'ROSE');await assert.rejects(()=>s.action(p.id,'purchaseAppearance',{requestId:randomUUID(),buildingId:'B_CLOTH',appearanceId:'TOP_MALE_02'}));});
test('场景碰撞和远程入口被拒绝',async()=>{const {p,service:s}=await fixture();await assert.rejects(()=>s.action(p.id,'move',{requestId:randomUUID(),x:12,y:1}),/移动过远/);await assert.rejects(()=>s.action(p.id,'enter',{requestId:randomUUID(),plotId:'P_BAISHI_002'}));});
test('配置引用、道路、锁定名、版本发布与回滚',async()=>{const repo=new MemoryRepository();validateWorld(initialWorld);const bad=structuredClone(initialWorld);bad.npcs[0].name='改名';assert.throws(()=>validateWorld(bad,initialWorld),/锁定/);const badNpc=structuredClone(initialWorld);badNpc.npcs[1].route=[{x:3,y:40}];assert.throws(()=>validateWorld(badNpc),/NPC位置或巡逻点/);const badRoute=structuredClone(initialWorld);badRoute.npcs[1].route=[{x:15,y:10},{x:27,y:10}];assert.throws(()=>validateWorld(badRoute),/NPC位置或巡逻点|NPC巡逻路线/);const badEntrance=structuredClone(initialWorld);badEntrance.plots[0].entrances![0].targetScene='INTERIOR_B_GROCERY';assert.throws(()=>validateWorld(badEntrance),/目标必须指向该建筑室内/);const badArea=structuredClone(initialWorld);badArea.plots[0].entrances![0].interactionArea.x=-1;assert.throws(()=>validateWorld(badArea),/Number must be greater than or equal to 0/);const road=structuredClone(initialWorld);road.roads[0].connects=[];assert.throws(()=>validateWorld(road,initialWorld),/道路/);const changed=structuredClone(initialWorld);changed.buildings[1].name='新杂货铺';const r=await repo.draft(validateWorld(changed,initialWorld),1);await assert.rejects(()=>repo.transition(r.id,'PUBLISHED'));await repo.transition(r.id,'TEST');await repo.transition(r.id,'PUBLISHED');assert.equal((await repo.world()).buildings[1].name,'新杂货铺');const rollback=await repo.draft(initialWorld,2);await repo.transition(rollback.id,'TEST');await repo.transition(rollback.id,'PUBLISHED');assert.equal((await repo.world()).configVersion,3);assert.equal((await repo.world()).buildings[1].name,'街坊杂货铺');});
test('生产环境禁止开发登录、后台鉴权',async()=>{const app=await buildApp(new MemoryRepository(),{...env,mode:'production',appEnv:'PROD',allowDevAuth:false});try{assert.equal((await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'x'}})).statusCode,404);assert.equal((await app.inject({url:'/admin/world'})).statusCode,401);}finally{await app.close();}});

test('第一桶金任务接口返回统一配置、步骤进度和奖励状态',async()=>{const app=await buildApp(new MemoryRepository(),env);try{const auth=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'quest-test'}})).json(),headers={authorization:`Bearer ` + auth.token};await app.inject({method:'POST',url:'/v1/player/appearance/create',headers,payload:{requestId:randomUUID(),gender:'FEMALE',baseAvatarId:'FEMALE_01',hairColorId:'INK',topColorId:'SAGE',bottomColorId:'CREAM'}});const before=(await app.inject({url:'/v1/quests',headers})).json();assert.equal(before.quests[0].state,'available');assert.equal(before.quests[0].steps[0].title,'购买鸣山大米');assert.match(before.quests[0].steps[0].objective,/街坊杂货铺/);assert.deepEqual(before.quests[0].stepProgress,[0,0]);assert.equal(before.quests[0].reward,20);}finally{await app.close();}});

test('云存档验收 A/B：退出重登恢复状态且任务奖励与出售不可重复',async()=>{
 const repo=new MemoryRepository(),app=await buildApp(repo,env);try{
  const account=`save-flow-${randomUUID().slice(0,8)}`;
  const login=async()=>{const r=await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account}});assert.equal(r.statusCode,200,r.body);const data=r.json();return {data,headers:{authorization:`Bearer ${data.token}`}};};
  const first=await login();
  const post=async(headers:any,url:string,payload:object,requestId=randomUUID())=>{const r=await app.inject({method:'POST',url,headers,payload:{requestId,...payload}});assert.equal(r.statusCode,200,`${url}: ${r.body}`);return r.json();};
  const appearanceBody=appearance('FEMALE');
  const created=await post(first.headers,'/v1/player/appearance/create',appearanceBody,appearanceBody.requestId);
  await post(first.headers,'/v1/world/portal',{portalId:'EXIT_B_INN'});
  for(const x of [15,21,27,32.5])await post(first.headers,'/v1/player/move',{x,y:20});
  await post(first.headers,'/v1/world/enter',{plotId:'P_BAISHI_003',entranceId:'ENT_BAISHI_TRADE_S'});
  await post(first.headers,'/v1/player/move',{x:12,y:14});
  await post(first.headers,'/v1/npc/talk',{npcId:'NPC_TRADE_CLERK'});await post(first.headers,'/v1/player/move',{x:12,y:15});
  await post(first.headers,'/v1/world/portal',{portalId:'EXIT_B_TRADE'});
  for(const x of [27,21])await post(first.headers,'/v1/player/move',{x,y:20});
  await post(first.headers,'/v1/world/enter',{plotId:'P_BAISHI_002',entranceId:'ENT_BAISHI_GROCERY_S'});
  const buy={requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'RICE_01',quantity:1};
  const bought=await post(first.headers,'/v1/economy/buy',buy,buy.requestId);
  const snapshot=bought.player;
  assert.equal(snapshot.cash,108);assert.equal(snapshot.inventory.RICE_01,1);assert.equal(snapshot.sceneId,'INTERIOR_B_GROCERY');
  const questsA=(await app.inject({url:'/v1/quests',headers:first.headers})).json().quests[0];
  assert.equal(questsA.state,'in_progress');assert.deepEqual(questsA.stepProgress,[1,0]);
  const againA=await login(),restoredA=(await app.inject({url:'/v1/bootstrap',headers:againA.headers})).json().player;
  assert.equal(restoredA.id,snapshot.id);assert.equal(restoredA.nickname,snapshot.nickname);assert.deepEqual(restoredA.appearance,snapshot.appearance);assert.equal(restoredA.cash,108);assert.equal(restoredA.inventory.RICE_01,1);assert.equal(restoredA.sceneId,'INTERIOR_B_GROCERY');assert.equal(restoredA.x,snapshot.x);assert.equal(restoredA.y,snapshot.y);
  const questsAfterLogin=(await app.inject({url:'/v1/quests',headers:againA.headers})).json().quests[0];assert.deepEqual(questsAfterLogin.stepProgress,[1,0]);assert.match(questsAfterLogin.steps[1].objective,/白石商行/);
  await post(againA.headers,'/v1/world/portal',{portalId:'EXIT_B_GROCERY'});for(const x of [27,32.5])await post(againA.headers,'/v1/player/move',{x,y:20});await post(againA.headers,'/v1/world/enter',{plotId:'P_BAISHI_003',entranceId:'ENT_BAISHI_TRADE_S'});
  const sell={requestId:randomUUID(),buildingId:'B_TRADE',itemId:'RICE_01',quantity:1};const sold=await post(againA.headers,'/v1/economy/sell',sell,sell.requestId);assert.equal(sold.player.cash,144);assert.equal(sold.player.inventory.RICE_01,undefined);assert.equal(sold.player.ledger.filter((l:any)=>l.type==='QUEST_REWARD'&&l.referenceId==='Q_001').length,1);
  const retry=await post(againA.headers,'/v1/economy/sell',sell,sell.requestId);assert.deepEqual(retry,sold);
  const repeated=await app.inject({method:'POST',url:'/v1/economy/sell',headers:againA.headers,payload:{requestId:randomUUID(),buildingId:'B_TRADE',itemId:'RICE_01',quantity:1}});assert.equal(repeated.statusCode,400);assert.match(repeated.body,/库存不足/);
  const questsB=(await app.inject({url:'/v1/quests',headers:againA.headers})).json().quests[0];assert.equal(questsB.state,'completed');assert.equal(questsB.rewardClaimed,true);assert.deepEqual(questsB.stepProgress,[1,1]);
  const againB=await login(),restoredB=(await app.inject({url:'/v1/bootstrap',headers:againB.headers})).json().player;assert.equal(restoredB.cash,144);assert.equal(restoredB.inventory.RICE_01,undefined);assert.equal(restoredB.ledger.filter((l:any)=>l.type==='QUEST_REWARD'&&l.referenceId==='Q_001').length,1);assert.equal(restoredB.sceneId,'INTERIOR_B_TRADE');
 }finally{await app.close();}
});

test('白石街封闭建筑、水岸和入口通路符合样图布局',()=>{assert.equal(canStand(initialWorld,'STREET_BAISHI_01',8,10),false);assert.equal(canStand(initialWorld,'STREET_BAISHI_01',8.5,20),true);assert.equal(canStand(initialWorld,'STREET_BAISHI_01',37.5,14),true);assert.equal(canStand(initialWorld,'STREET_BAISHI_01',10,42),false);assert.equal(canStand(initialWorld,'STREET_BAISHI_01',24,24),true);});

test('白石街重新登录后恢复当前场景和位置',async()=>{const repo=new MemoryRepository(),p=await repo.login('save-restore'),s=new GameService(repo);await s.action(p.id,'create',appearance());repo.players.get(p.id)!.sceneId='STREET_BAISHI_01';repo.players.get(p.id)!.x=24;repo.players.get(p.id)!.y=24;const again=await repo.login('save-restore');assert.equal(again.sceneId,'STREET_BAISHI_01');assert.equal(again.x,24);assert.equal(again.y,24);});

test('白石街西侧入口完成进入、室内出生和原入口返回闭环',async()=>{const {repo,p,service:s}=await fixture();repo.players.get(p.id)!.sceneId='STREET_BAISHI_01';repo.players.get(p.id)!.x=44;repo.players.get(p.id)!.y=20;await s.action(p.id,'enter',{requestId:randomUUID(),plotId:'P_BAISHI_004',entranceId:'ENT_BAISHI_SALON_W'});let saved=await repo.player(p.id);assert.equal(saved.sceneId,'INTERIOR_B_SALON');assert.equal(saved.x,12);assert.equal(saved.y,15);await s.action(p.id,'portal',{requestId:randomUUID(),portalId:'EXIT_B_SALON'});saved=await repo.player(p.id);assert.equal(saved.sceneId,'STREET_BAISHI_01');assert.equal(saved.x,44);assert.equal(saved.y,21);});

test('室内出口可按 returnEntranceId 选择对应外部入口',()=>{const world=structuredClone(initialWorld);const interior=world.scenes.find(scene=>scene.id==='INTERIOR_B_INN')!;interior.portals[0].returnEntranceId='ENT_BAISHI_INN_S';const view=sceneView(world,'INTERIOR_B_INN',new Date('2026-09-05T02:00:00Z'));assert.equal(view.scene.portals[0].spawnX,8.5);assert.equal(view.scene.portals[0].spawnY,21);});
test('春衫衣坊南向入口保留沿河步道并形成稳定返回闭环',async()=>{const plot=initialWorld.plots.find(p=>p.id==='P_BAISHI_005')!;const entrance=plot.entrances![0];assert.equal(entrance.id,'ENT_BAISHI_CLOTH_S');assert.equal(entrance.direction,'south');assert.deepEqual(entrance.position,{x:34,y:37.6});assert.deepEqual(entrance.interactionArea,{x:32.75,y:37.15,width:2.5,height:1.6});assert.equal(canStand(initialWorld,'STREET_BAISHI_01',34,38.6),true);const {repo,p,service:s}=await fixture();repo.players.get(p.id)!.sceneId='STREET_BAISHI_01';repo.players.get(p.id)!.x=34;repo.players.get(p.id)!.y=38.5;await s.action(p.id,'enter',{requestId:randomUUID(),plotId:plot.id,entranceId:entrance.id});let saved=await repo.player(p.id);assert.equal(saved.sceneId,'INTERIOR_B_CLOTH');assert.deepEqual([saved.x,saved.y],[12,15]);await s.action(p.id,'portal',{requestId:randomUUID(),portalId:'EXIT_B_CLOTH'});saved=await repo.player(p.id);assert.equal(saved.sceneId,'STREET_BAISHI_01');assert.deepEqual([saved.x,saved.y],[34,38.6]);});
test('白石街公共主街带没有静态碰撞空气墙，开放建筑均有候选素材绑定',()=>{const scene=initialWorld.scenes.find(s=>s.id==='STREET_BAISHI_01')!,publicLane={x:0,y:20,width:48,height:4.5};for(const collision of scene.collision)assert.equal(collision.x-.18>=publicLane.x+publicLane.width||collision.x+collision.width+.18<=publicLane.x||collision.y-.18>=publicLane.y+publicLane.height||collision.y+collision.height+.18<=publicLane.y,true,`静态碰撞实际余量与公共主街带重叠：${JSON.stringify(collision)}`);for(const plot of initialWorld.plots.filter(p=>p.buildingId))assert.ok(baishiBuildingLayerBindings[plot.buildingId as keyof typeof baishiBuildingLayerBindings],plot.buildingId!);});

test('白石街正式建筑门前实体装饰物均使用局部碰撞',()=>{
  const scene=initialWorld.scenes.find(s=>s.id==='STREET_BAISHI_01')!;
  assert.deepEqual(Object.keys(baishiBuildingObjectCollision),['B_INN','B_GROCERY','B_TRADE','B_SALON','B_CLOTH']);
  for(const obstacle of baishiStreetObjectCollision)assert.ok(scene.collision.includes(obstacle));
  for(const [x,y] of [[4.5,19.5],[12,19.5],[19,19.5],[22.8,19.5],[28.5,19.5],[35.5,19.5],[40,19.5],[47,19.5]])assert.equal(canStand(initialWorld,scene.id,x,y),false,`门前实体应阻挡：${x},${y}`);
});

test('春衫衣坊突出遮棚与上层区域不可站立且南门、步道保持畅通',()=>{
  const scene=initialWorld.scenes.find(s=>s.id==='STREET_BAISHI_01')!;
  assert.equal(canStand(initialWorld,scene.id,25,31.68),true,'雨棚西侧南北道路应保持通行');
  assert.equal(canStand(initialWorld,scene.id,25.6,32),false,'左侧竖向雨棚应阻挡');
  assert.equal(canStand(initialWorld,scene.id,26.8,26.5),false,'左上角连接段应阻挡');
  assert.equal(canStand(initialWorld,scene.id,34.25,26.75),false,'北侧阳台视觉重叠位置应阻挡');
  assert.equal(canStand(initialWorld,scene.id,34.25,24.4),true,'北侧平台以外的公共区域应保持通行');
  assert.equal(canStand(initialWorld,scene.id,30,29),false,'后方阳台区域应由建筑 Plot 阻挡');
  assert.equal(canStand(initialWorld,scene.id,37,30),false,'上层平台应由建筑 Plot 阻挡');
  for(const [x,y] of [[34,37.6],[34,38.2],[32.9,38.2],[35.1,38.2]])assert.equal(canStand(initialWorld,scene.id,x,y),true,`应可通行：${x},${y}`);
  for(const [x,y] of [[29.8,37.4],[28.6,37.3],[37.6,37.2],[39.2,37.3]])assert.equal(canStand(initialWorld,scene.id,x,y),false,`实体应阻挡：${x},${y}`);
});

test('杂货铺入口与局部碰撞的实际余量之间保留安全间隔',()=>{
  const entrance=initialWorld.plots.find(plot=>plot.id==='P_BAISHI_002')!.entrances![0];
  const area=entrance.interactionArea!;
  const blocks=baishiBuildingObjectCollision.B_GROCERY;
  const blockedByLocal=(x:number,y:number)=>blocks.some(rect=>x>rect.x-.18&&x<rect.x+rect.width+.18&&y>rect.y-.18&&y<rect.y+rect.height+.18);
  for(const x of [area.x+.05,entrance.position.x,area.x+area.width-.05])assert.equal(blockedByLocal(x,19.5),false,`入口横向测试点不应被局部碰撞阻挡：${x}`);
});

test('服务端 move 使用同一场景碰撞并拒绝春衫三块红框中心点',async()=>{const {repo,p,service}=await fixture();const rects=baishiBuildingObjectCollision.B_CLOTH.slice(0,3);for(const rect of rects){const x=rect.x+rect.width/2,y=rect.y+rect.height/2,saved=repo.players.get(p.id)!;saved.sceneId='STREET_BAISHI_01';saved.x=x;saved.y=y;await assert.rejects(()=>service.action(p.id,'move',{requestId:randomUUID(),x,y}),/前方无法通行/);}});

test('五栋正式建筑入口中心与门前主街仍可站立',()=>{
  const sceneId='STREET_BAISHI_01';
  for(const [x,y] of [[8.5,20],[21,20],[32.5,20],[44,20],[34,37.6],[8.5,21],[21,21],[32.5,21],[44,21],[34,38.2]])assert.equal(canStand(initialWorld,sceneId,x,y),true,`入口或步道应可站立：${x},${y}`);
});

test('白石街五个开放入口均可从公共道路步行到达',()=>{
 const scene=initialWorld.scenes.find(s=>s.id==='STREET_BAISHI_01')!;const step=0.5;const key=(x:number,y:number)=>`${Math.round(x/step)},${Math.round(y/step)}`;
 const start=[24,24] as const;
 for(const plot of initialWorld.plots.filter(p=>p.buildingId)){
  const target=plotEntrances(plot)[0].position;const queue:[[number,number]]|Array<[number,number]>=[[start[0],start[1]]];const seen=new Set([key(start[0],start[1])]);let reached=false;
  while(queue.length){const [x,y]=queue.shift()!;if(Math.hypot(x-target.x,y-target.y)<=step){reached=true;break;}for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]] as const){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(nx>=1&&ny>=1&&nx<=scene.width-1&&ny<=scene.height-1&&!seen.has(k)&&canStand(initialWorld,scene.id,nx,ny)){seen.add(k);queue.push([nx,ny]);}}}
  assert.equal(reached,true,`${plot.id} 入口无法从公共道路到达`);
 }
});

test('街道 NPC 的完整可见身体范围不可被玩家穿过',()=>{for(const npc of initialWorld.npcs.filter(n=>n.sceneId==='STREET_BAISHI_01')){assert.equal(canStand(initialWorld,'STREET_BAISHI_01',npc.x,npc.y),false,npc.id);assert.equal(canStand(initialWorld,'STREET_BAISHI_01',npc.x,npc.y-.6),false,`${npc.id} 上半身`);}});
test('白石街 NPC 使用独立外观并与主角默认外观区分',()=>{const npcs=initialWorld.npcs.filter(n=>n.sceneId==='STREET_BAISHI_01');assert.equal(npcs.length,3);assert.ok(npcs.every(n=>n.appearance));assert.equal(new Set(npcs.map(n=>n.appearance!.baseAvatarId)).size,3);assert.notEqual(npcs[0].appearance!.topColorId,npcs[1].appearance!.topColorId);});
test('入口交互区域限制在门前范围内且可从道路侧稳定触发',()=>{const entrance=plotEntrances(initialWorld.plots[1])[0];assert.equal(inEntranceArea(entrance,21,20),true);assert.equal(inEntranceArea(entrance,20,18.7),true);assert.equal(inEntranceArea(entrance,19.5,20),false);});
test('白石街图层挂载表保持地面启用、候选建筑停用并按 z 排序',()=>{const enabled=baishiLayerPlacements.filter(layer=>layer.enabled).sort((a,b)=>a.z-b.z);assert.equal(enabled[0].layer,'ground');assert.equal(enabled[0].asset,'baishi_composition_approved_v01');assert.equal(baishiLayerPlacements.find(layer=>layer.asset==='baishi_buildings_candidate_v01')?.enabled,false);assert.ok(baishiLayerPlacements.every(layer=>layer.width>0&&layer.height>0));});

test('白石街 NPC 首次交谈、重复交谈与重新登录记录',async()=>{const repo=new MemoryRepository(),p=await repo.login('npc-loop'),service=new GameService(repo);await service.action(p.id,'create',appearance());const saved=repo.players.get(p.id)!;saved.sceneId='STREET_BAISHI_01';saved.x=16;saved.y=22.5;const first=await service.action(p.id,'talk',{requestId:randomUUID(),npcId:'NPC_002'});assert.match(first.dialogue,/白石街/);assert.deepEqual((await repo.player(p.id)).metNpcs,['NPC_002']);const second=await service.action(p.id,'talk',{requestId:randomUUID(),npcId:'NPC_002'});assert.match(second.dialogue,/白石街/);assert.deepEqual((await repo.login('npc-loop')).metNpcs,['NPC_002']);});

test('第一桶金接取状态可保存并防止重复接取',async()=>{const repo=new MemoryRepository(),p=await repo.login('quest-accept'),service=new GameService(repo);await service.action(p.id,'create',appearance());const saved=repo.players.get(p.id)!;saved.x=8;saved.y=9;const accepted=await service.action(p.id,'acceptQuest',{requestId:randomUUID(),questId:'Q_001'});assert.match(accepted.dialogue,/已接取任务/);assert.equal((await repo.player(p.id)).ledger.some(l=>l.type==='QUEST_ACCEPTED'&&l.referenceId==='Q_001'),true);await assert.rejects(()=>service.action(p.id,'acceptQuest',{requestId:randomUUID(),questId:'Q_001'}),/任务已经接取/);});

test('掌柜的急差流程支持恢复且取物交付不可重复',async()=>{const repo=new MemoryRepository(),p=await repo.login('q002-flow'),service=new GameService(repo);await service.action(p.id,'create',appearance());const saved=repo.players.get(p.id)!;repo.players.get(p.id)!.sceneId='INTERIOR_B_INN';repo.players.get(p.id)!.x=8;repo.players.get(p.id)!.y=9;const accepted=await service.action(p.id,'talk',{requestId:randomUUID(),npcId:'NPC_001'});assert.match(accepted.dialogue,/掌柜的急差/);repo.players.get(p.id)!.sceneId='INTERIOR_B_GROCERY';repo.players.get(p.id)!.x=12;repo.players.get(p.id)!.y=9;await service.action(p.id,'talk',{requestId:randomUUID(),npcId:'NPC_GROCERY_CLERK'});assert.equal((await repo.player(p.id)).inventory.ERRAND_PACKAGE_01,1);await service.action(p.id,'talk',{requestId:randomUUID(),npcId:'NPC_GROCERY_CLERK'});assert.equal((await repo.player(p.id)).inventory.ERRAND_PACKAGE_01,1);const restored=await repo.login('q002-flow');assert.equal(restored.inventory.ERRAND_PACKAGE_01,1);repo.players.get(p.id)!.sceneId='INTERIOR_B_INN';repo.players.get(p.id)!.x=8;repo.players.get(p.id)!.y=9;await service.action(p.id,'talk',{requestId:randomUUID(),npcId:'NPC_001'});const completed=await repo.player(p.id);assert.equal(completed.inventory.ERRAND_PACKAGE_01,undefined);assert.equal(completed.ledger.filter(l=>l.type==='QUEST_REWARD'&&l.referenceId==='Q_002').length,1);await service.action(p.id,'talk',{requestId:randomUUID(),npcId:'NPC_001'});const retried=await repo.player(p.id);assert.equal(retried.ledger.filter(l=>l.type==='QUEST_REWARD'&&l.referenceId==='Q_002').length,1);});
