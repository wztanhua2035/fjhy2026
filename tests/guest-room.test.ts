import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { initialWorld } from '../packages/game-config/index.js';
import { GUEST_ROOM_SCENE_ID, INN_LOBBY_SCENE_ID, INTRO_INN_KEEPER_DONE, innOpeningDialogue } from '../packages/game-config/inn-opening.js';
import { canStand, sceneView } from '../packages/game-rules/index.js';
import { GameController } from '../packages/client-runtime/index.js';
import { MemoryRepository } from '../apps/server/src/repository.js';
import { GameService } from '../apps/server/src/service.js';
import { baishiSyncPlan } from '../apps/server/src/sync-baishi.js';
import { ensureGuestRoomScene } from '../apps/server/src/sync-baishi.js';
import { buildApp } from '../apps/server/src/app.js';
import { validateWorld } from '../apps/server/src/config.js';

const scene=initialWorld.scenes.find(s=>s.id===GUEST_ROOM_SCENE_ID)!;
function reachable(from:{x:number;y:number},to:{x:number;y:number}){
  const key=(p:{x:number;y:number})=>`${p.x},${p.y}`,seen=new Set([key(from)]),queue=[from];
  while(queue.length){const p=queue.shift()!;if(Math.hypot(p.x-to.x,p.y-to.y)<.6)return true;
    for(const [dx,dy] of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){const n={x:p.x+dx,y:p.y+dy};if(!seen.has(key(n))&&canStand(initialWorld,scene.id,n.x,n.y)){seen.add(key(n));queue.push(n);}}
  }return false;
}
const create={gender:'MALE',skinToneId:'SKIN_LIGHT',hairId:'M_HAIR_01',outfitId:'M_OUTFIT_01'};

test('临时房尺寸、美术、四件家具碰撞和独立可达交互点',async()=>{
  assert.equal(scene.width,14);assert.equal(scene.height,12);assert.equal(scene.tileSize,32);
  assert.equal(scene.width*scene.tileSize,448);assert.equal(scene.height*scene.tileSize,384);
  assert.equal(canStand(initialWorld,scene.id,scene.spawnX,scene.spawnY),true);
  const zones=scene.interior!.zones;
  for(const id of ['GUEST_BED','GUEST_CHEST','GUEST_WARDROBE','GUEST_DESK']){
    const zone=zones.find(z=>z.id===id)!;assert.ok(zone.interactionPoint);
    assert.equal(canStand(initialWorld,scene.id,zone.x+zone.width/2,zone.y+zone.height/2),false,id);
    assert.equal(canStand(initialWorld,scene.id,zone.interactionPoint.x,zone.interactionPoint.y),true,id);
    assert.equal(reachable({x:7,y:8.4},zone.interactionPoint),true,id);
  }
  const bed=zones.find(z=>z.id==='GUEST_BED')!,chest=zones.find(z=>z.id==='GUEST_CHEST')!;
  assert.ok(Math.hypot(bed.interactionPoint!.x-chest.interactionPoint!.x,bed.interactionPoint!.y-chest.interactionPoint!.y)>2.2);
  assert.equal(reachable({x:7,y:8.4},{x:7,y:10.2}),true);
  const base='apps/admin/public/scene-layers/baishi/interiors/';
  for(const file of ['interior_guest_room_v2.png','interior_guest_room_fg_v2.png']){
    const png=await readFile(base+file);assert.equal(png.readUInt32BE(16),448);assert.equal(png.readUInt32BE(20),384);
  }
});

test('四个物件服务端按共享交互点校验，不能远程查看',async()=>{
  const repo=new MemoryRepository(),p=await repo.login('guest-objects'),service=new GameService(repo);
  await service.action(p.id,'create',{requestId:randomUUID(),...create});
  for(const zone of scene.interior!.zones.filter(z=>z.interactionPoint)){
    Object.assign(repo.players.get(p.id)!,zone.interactionPoint);
    const result:any=await service.action(p.id,'inspect',{requestId:randomUUID(),zoneId:zone.id});
    assert.ok(result.dialogue.length>5,zone.id);
  }
  Object.assign(repo.players.get(p.id)!,{x:7,y:8.4});
  await assert.rejects(()=>service.action(p.id,'inspect',{requestId:randomUUID(),zoneId:'GUEST_BED'}),/请走近一些/);
});

test('临时房双向 portal、开场锁定、关系预置、重登和重新开始',async()=>{
  const repo=new MemoryRepository(),p=await repo.login('guest-opening'),service=new GameService(repo);
  const created:any=await service.action(p.id,'create',{requestId:randomUUID(),...create});
  assert.equal(created.player.sceneId,GUEST_ROOM_SCENE_ID);assert.deepEqual(created.player.storyFlags,{});
  assert.deepEqual([created.player.x,created.player.y],[7,8.4]);
  assert.deepEqual(created.player.metNpcs,['NPC_001']);
  assert.equal(sceneView(initialWorld,GUEST_ROOM_SCENE_ID,new Date()).scene.portals[0].toSceneId,'INTERIOR_B_INN');
  const roomDoor=scene.portals.find(p=>p.id==='EXIT_INN_GUEST_ROOM')!;
  const inn=initialWorld.scenes.find(s=>s.id===INN_LOBBY_SCENE_ID)!;
  const lobbyDoor=inn.portals.find(p=>p.id==='ENTER_INN_GUEST_ROOM')!;
  assert.deepEqual([roomDoor.x,roomDoor.y,roomDoor.spawnX,roomDoor.spawnY],[7,10.2,3,8.6]);
  assert.deepEqual([lobbyDoor.x,lobbyDoor.y,lobbyDoor.spawnX,lobbyDoor.spawnY],[3,7.2,7,8.4]);
  assert.equal(canStand(initialWorld,INN_LOBBY_SCENE_ID,roomDoor.spawnX,roomDoor.spawnY),true);
  assert.equal(canStand(initialWorld,GUEST_ROOM_SCENE_ID,lobbyDoor.spawnX,lobbyDoor.spawnY),true);
  assert.ok(Math.hypot(roomDoor.spawnX-lobbyDoor.x,roomDoor.spawnY-lobbyDoor.y)>1.1);
  assert.ok(Math.hypot(lobbyDoor.spawnX-roomDoor.x,lobbyDoor.spawnY-roomDoor.y)>1.1);
  // The visible inn door is centred around image pixel (96,230) on the 768×640 background.
  assert.ok(Math.hypot(lobbyDoor.x*32-96,lobbyDoor.y*32-230)<8);
  Object.assign(repo.players.get(p.id)!,{x:7,y:10.2});
  const entered:any=await service.action(p.id,'portal',{requestId:randomUUID(),portalId:'EXIT_INN_GUEST_ROOM'});
  assert.equal(entered.player.sceneId,'INTERIOR_B_INN');assert.equal(canStand(initialWorld,'INTERIOR_B_INN',entered.player.x,entered.player.y),true);
  await assert.rejects(()=>service.action(p.id,'portal',{requestId:randomUUID(),portalId:'ENTER_INN_GUEST_ROOM'}),/请先听陈掌柜/);
  await assert.rejects(()=>service.action(p.id,'move',{requestId:randomUUID(),x:5,y:15}),/陈掌柜/);
  await assert.rejects(()=>service.action(p.id,'portal',{requestId:randomUUID(),portalId:'EXIT_B_INN'}),/陈掌柜/);
  await assert.rejects(()=>service.action(p.id,'talk',{requestId:randomUUID(),npcId:'NPC_001'}),/陈掌柜/);
  assert.equal((await repo.login('guest-opening')).storyFlags?.[INTRO_INN_KEEPER_DONE],undefined);
  await service.action(p.id,'introComplete',{requestId:randomUUID()});
  assert.equal((await repo.login('guest-opening')).storyFlags?.[INTRO_INN_KEEPER_DONE],true);
  assert.deepEqual((await repo.player(p.id)).metNpcs,['NPC_001']);
  Object.assign(repo.players.get(p.id)!,{x:3,y:7.2});
  const back:any=await service.action(p.id,'portal',{requestId:randomUUID(),portalId:'ENTER_INN_GUEST_ROOM'});
  assert.equal(back.player.sceneId,GUEST_ROOM_SCENE_ID);assert.equal(canStand(initialWorld,GUEST_ROOM_SCENE_ID,back.player.x,back.player.y),true);
  await assert.rejects(()=>service.action(p.id,'portal',{requestId:randomUUID(),portalId:'EXIT_INN_GUEST_ROOM'}),/请走到出口/);
  Object.assign(repo.players.get(p.id)!,{x:7,y:10.2});
  await service.action(p.id,'portal',{requestId:randomUUID(),portalId:'EXIT_INN_GUEST_ROOM'});
  assert.equal((await repo.player(p.id)).storyFlags?.[INTRO_INN_KEEPER_DONE],true);
  const reset=await repo.restartGame(p.id,randomUUID());assert.equal(reset.id,p.id);assert.equal(reset.appearance,null);assert.equal(reset.sceneId,GUEST_ROOM_SCENE_ID);assert.deepEqual(reset.storyFlags,{});assert.deepEqual(reset.metNpcs,[]);
});

test('共享 GameController 自动逐句开场，期间不能移动，结束后恢复且只播一次',async()=>{
  const repo=new MemoryRepository(),service=new GameService(repo),p=await repo.login('guest-controller');
  const transport=async(path:string,body?:any)=>{
    if(path==='/v1/auth/dev')return {token:'test'};
    if(path==='/v1/bootstrap')return {player:await repo.player(p.id),colors:{},appearances:[],features:{}};
    if(path==='/v1/quests')return {quests:[]};
    if(path.startsWith('/v1/world/scenes/'))return sceneView(initialWorld,path.split('/').at(-1)!,new Date());
    if(path.endsWith('/ghosts'))return {ghosts:[]};
    const action:Record<string,string>={'/v1/player/appearance/create':'create','/v1/player/move':'move','/v1/world/portal':'portal','/v1/intro/complete':'introComplete'};
    return service.action(p.id,action[path],body);
  };
  const c=new GameController(transport);await c.loginDev('guest-controller');
  await c.create('MALE',create);assert.equal(c.player?.sceneId,GUEST_ROOM_SCENE_ID);
  await c.advanceDialogue();c.x=7;c.y=10.2;Object.assign(repo.players.get(p.id)!,{x:7,y:10.2});await c.interact();
  assert.equal(c.player?.sceneId,'INTERIOR_B_INN');assert.equal(c.dialogueSpeaker,'陈掌柜');
  assert.equal(c.dialogue,innOpeningDialogue[0].text);
  const before={x:c.x,y:c.y};c.tick(.2,1,0);assert.deepEqual({x:c.x,y:c.y},before);assert.equal(c.nearby(),null);
  for(let i=1;i<innOpeningDialogue.length;i++){await c.advanceDialogue();assert.equal(c.dialogue,innOpeningDialogue[i].text);assert.equal(c.dialogueSpeaker,innOpeningDialogue[i].speaker);}
  await c.advanceDialogue();assert.equal(c.dialogue,null);assert.equal(c.player?.storyFlags?.[INTRO_INN_KEEPER_DONE],true);
  c.tick(.1,1,0);assert.ok(c.x>before.x);
  await c.refresh();assert.equal(c.dialogue,null);
});

test('staging 内容同步会补入临时房及大厅侧房 portal',()=>{
  const old=structuredClone(initialWorld);
  old.scenes=old.scenes.filter(s=>s.id!==GUEST_ROOM_SCENE_ID);
  old.scenes.find(s=>s.id==='INTERIOR_B_INN')!.portals=old.scenes.find(s=>s.id==='INTERIOR_B_INN')!.portals.filter(p=>p.id!=='ENTER_INN_GUEST_ROOM');
  const plan=baishiSyncPlan(old);
  assert.ok(plan.changed.includes(`scenes:${GUEST_ROOM_SCENE_ID}`));
  assert.ok(plan.changed.includes('scenes:INTERIOR_B_INN'));
  assert.ok(plan.config.scenes.find(s=>s.id===GUEST_ROOM_SCENE_ID));
});

test('真实 game-api 对旧已发布配置返回 404，staging 定向发布后可查询临时房与双向 portal',async()=>{
  const repo=new MemoryRepository(),old=structuredClone(initialWorld);
  old.scenes=old.scenes.filter(s=>s.id!==GUEST_ROOM_SCENE_ID);
  const inn=old.scenes.find(s=>s.id===INN_LOBBY_SCENE_ID)!;
  inn.portals=inn.portals.filter(p=>p.toSceneId!==GUEST_ROOM_SCENE_ID);
  repo.versions[0].config=old;
  const env={mode:'production',appEnv:'STAGING',port:8080,jwtSecret:'test-jwt-secret-thirty-two-characters-long',subjectSecret:'test-subject-secret-thirty-two-characters',adminToken:'test-admin-token-thirty-two-characters-long',allowDevAuth:false,appId:'',appSecret:'',adminOrigin:'http://localhost:5173',assetBase:'http://localhost:8080/assets'};
  const app=await buildApp(repo,env,{exchangeCode:async()=> 'new-wechat-guest'});
  try{
    const auth=(await app.inject({method:'POST',url:'/v1/auth/wechat',payload:{code:'test'}})).json();
    const headers={authorization:`Bearer ${auth.token}`};
    assert.deepEqual([auth.player.sceneId,auth.player.x,auth.player.y],[GUEST_ROOM_SCENE_ID,7,8.4]);
    const created=await app.inject({method:'POST',url:'/v1/player/appearance/create',headers,payload:{requestId:randomUUID(),...create}});
    assert.equal(created.statusCode,200);
    const endpoint=`/v1/world/scenes/${GUEST_ROOM_SCENE_ID}`;
    const missing=await app.inject({method:'GET',url:endpoint,headers});
    assert.equal(missing.statusCode,404);assert.deepEqual(missing.json(),{code:'SCENE_NOT_FOUND',message:'场景不存在'});
    const result=await ensureGuestRoomScene(repo);
    assert.equal(result.published,true);assert.deepEqual(result.added,[GUEST_ROOM_SCENE_ID,'ENTER_INN_GUEST_ROOM']);
    assert.equal((await ensureGuestRoomScene(repo)).published,false);
    const response=await app.inject({method:'GET',url:endpoint,headers});
    assert.equal(response.statusCode,200);
    assert.deepEqual([response.json().scene.id,response.json().scene.width,response.json().scene.height],[GUEST_ROOM_SCENE_ID,14,12]);
    assert.deepEqual(response.json().playerPosition,{sceneId:GUEST_ROOM_SCENE_ID,x:7,y:8.4});
    const diagnostic=await app.inject({method:'GET',url:`/diagnostics/scenes/${GUEST_ROOM_SCENE_ID}`});
    assert.equal(diagnostic.statusCode,200);
    assert.equal(diagnostic.json().scene.portals[0].toSceneId,INN_LOBBY_SCENE_ID);
    assert.ok(diagnostic.json().scene.collision.length>0);
    const lobby=await app.inject({method:'GET',url:`/diagnostics/scenes/${INN_LOBBY_SCENE_ID}`});
    assert.equal(lobby.statusCode,200);
    assert.ok(lobby.json().scene.portals.some((p:any)=>p.toSceneId===GUEST_ROOM_SCENE_ID));
    const reset=await app.inject({method:'POST',url:'/v1/player/restart',headers,payload:{requestId:randomUUID(),confirm:true}});
    assert.equal(reset.statusCode,200);assert.deepEqual([reset.json().player.sceneId,reset.json().player.x,reset.json().player.y],[GUEST_ROOM_SCENE_ID,7,8.4]);
    const production=await buildApp(repo,{...env,appEnv:'PROD'});
    try{assert.equal((await production.inject({method:'GET',url:`/diagnostics/scenes/${GUEST_ROOM_SCENE_ID}`})).statusCode,404);}finally{await production.close();}
  }finally{await app.close();}
});

test('所有场景 portal 目标都在已发布 registry 中',()=>{
  const config=validateWorld(initialWorld);
  const ids=new Set(config.scenes.map(s=>s.id));
  for(const scene of config.scenes)for(const portal of scene.portals)assert.ok(ids.has(portal.toSceneId),`${scene.id}:${portal.id} -> ${portal.toSceneId}`);
});

test('staging 已有临时房时仅更新该房与大厅小门 portal，保留大厅碰撞',async()=>{
  const repo=new MemoryRepository(),before=structuredClone(repo.versions[0].config);
  const oldRoom=repo.versions[0].config.scenes.find(s=>s.id===GUEST_ROOM_SCENE_ID)!;
  oldRoom.width=15;
  const oldInn=repo.versions[0].config.scenes.find(s=>s.id===INN_LOBBY_SCENE_ID)!;
  const oldCollision=structuredClone(oldInn.collision);
  const door=oldInn.portals.find(p=>p.id==='ENTER_INN_GUEST_ROOM')!;door.x=5;door.y=14.5;
  const result=await ensureGuestRoomScene(repo);
  assert.equal(result.published,true);
  const world=await repo.world();
  assert.deepEqual(world.scenes.find(s=>s.id===GUEST_ROOM_SCENE_ID),before.scenes.find(s=>s.id===GUEST_ROOM_SCENE_ID));
  assert.deepEqual(world.scenes.find(s=>s.id===INN_LOBBY_SCENE_ID)?.collision,oldCollision);
  assert.equal(world.scenes.find(s=>s.id===INN_LOBBY_SCENE_ID)?.portals.find(p=>p.id===door.id)?.x,3);
  assert.equal((await ensureGuestRoomScene(repo)).published,false);
});
