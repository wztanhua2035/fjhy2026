import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initialWorld, baishiBuildingObjectCollision } from '../packages/game-config/index.js';
import { canStand, positionBlockers, recoverSafePosition } from '../packages/game-rules/index.js';
import { MemoryRepository } from '../apps/server/src/repository.js';
import { buildApp } from '../apps/server/src/app.js';
import { GameController } from '../packages/client-runtime/index.js';
import { createWeChatPlatform } from '../apps/wechat-game/src/wechat-platform.js';
import { GameService } from '../apps/server/src/service.js';

const env={mode:'development',appEnv:'DEV',port:8080,jwtSecret:'test-jwt-secret-thirty-two-characters-long',subjectSecret:'test-subject-secret-thirty-two-characters',adminToken:'test-admin-token-thirty-two-characters-long',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost:5173',assetBase:'http://localhost:8080/assets'};
const sceneId='STREET_BAISHI_01';

test('合法存档不改变；Plot 和 local collision 的非法点归位且命中可诊断',()=>{
  const legal={x:22,y:23};assert.equal(canStand(initialWorld,sceneId,legal.x,legal.y),true);
  assert.deepEqual(recoverSafePosition(initialWorld,sceneId,legal.x,legal.y),{...legal,source:'saved'});
  const plot=initialWorld.plots.find(p=>p.id==='P_BAISHI_005')!;
  const insidePlot={x:plot.x+plot.width/2,y:plot.y+plot.height/2};
  assert.ok(positionBlockers(initialWorld,sceneId,insidePlot.x,insidePlot.y).includes('plot:P_BAISHI_005'));
  const local=baishiBuildingObjectCollision.B_CLOTH[0],insideLocal={x:local.x+local.width/2,y:local.y+local.height/2};
  assert.ok(positionBlockers(initialWorld,sceneId,insideLocal.x,insideLocal.y).some(hit=>hit.startsWith('scene.collision[')));
  for(const point of [insidePlot,insideLocal]){
    const safe=recoverSafePosition(initialWorld,sceneId,point.x,point.y);
    assert.equal(safe.source,'nearby');assert.equal(canStand(initialWorld,sceneId,safe.x,safe.y),true);
    assert.ok(Math.hypot(safe.x-point.x,safe.y-point.y)<=8);
  }
});

test('附近不可站立时回退到场景默认安全出生点',()=>{
  const world=structuredClone(initialWorld),street=world.scenes.find(s=>s.id===sceneId)!;
  street.collision.push({x:1,y:1,width:18,height:18});
  const safe=recoverSafePosition(world,sceneId,10,10);
  assert.equal(safe.source,'spawn');assert.equal(canStand(world,sceneId,safe.x,safe.y),true);
});

test('入口目标点因地图更新失效时优先在该入口附近恢复',async()=>{
  const repo=new MemoryRepository(),world=repo.versions[0].config;
  const plot=world.plots.find(p=>p.id==='P_BAISHI_005')!;
  const entrance=plot.entrances![0];
  entrance.targetSpawnPoint={x:10,y:10};
  const interior=world.scenes.find(s=>s.id===entrance.targetScene)!;
  interior.collision.push({x:9.5,y:9.5,width:1,height:1});
  const p=await repo.login('entrance-restore');
  p.appearance={gender:'FEMALE',baseAvatarId:'FEMALE_01',skinColorId:'SKIN_LIGHT',hairStyleId:'HAIR_FEMALE_01',hairColorId:'INK',topStyleId:'TOP_FEMALE_01',topColorId:'SAGE',bottomStyleId:'BOTTOM_FEMALE_01',bottomColorId:'CREAM',shoesId:'SHOES_FEMALE_01',accessoryIds:[]};
  Object.assign(repo.players.get(p.id)!,{appearance:p.appearance,sceneId,x:34,y:37.6});
  const result=await new GameService(repo,()=>new Date('2026-09-12T02:00:00Z')).action(p.id,'enter',{requestId:randomUUID(),plotId:plot.id,entranceId:entrance.id});
  assert.equal(result.player.sceneId,interior.id);
  assert.equal(canStand(world,interior.id,result.player.x,result.player.y),true);
  assert.ok(Math.hypot(result.player.x-10,result.player.y-10)<=8);
});

test('bootstrap、scene API、Web 与微信共享修正坐标；服务端 move 不拉回旧点',async()=>{
  const repo=new MemoryRepository(),app=await buildApp(repo,env,{exchangeCode:async()=> 'same-wechat-user'});
  const wxBefore=(globalThis as any).wx;
  try{
    const login=(await app.inject({method:'POST',url:'/v1/auth/wechat',payload:{code:'one'}})).json();
    const playerId=login.player.id,record=repo.players.get(playerId)!;
    record.appearance={gender:'FEMALE',baseAvatarId:'FEMALE_01',skinColorId:'SKIN_LIGHT',hairStyleId:'HAIR_FEMALE_01',hairColorId:'INK',topStyleId:'TOP_FEMALE_01',topColorId:'SAGE',bottomStyleId:'BOTTOM_FEMALE_01',bottomColorId:'CREAM',shoesId:'SHOES_FEMALE_01',accessoryIds:[]};
    Object.assign(record,{sceneId,x:34.25,y:26.75});
    assert.equal(canStand(initialWorld,sceneId,record.x,record.y),false);
    const webTransport=async(path:string,body?:any,token?:string)=>{
      const response=await app.inject({method:body?'POST':'GET',url:path,headers:token?{authorization:`Bearer ${token}`}:{},payload:body});
      if(response.statusCode>=400)throw Object.assign(new Error(response.json().message),{status:response.statusCode});
      return response.json();
    };
    const web=new GameController(webTransport);await web.loginWechat('two');
    const safe={x:web.x,y:web.y};assert.equal(canStand(initialWorld,sceneId,safe.x,safe.y),true);
    assert.deepEqual({x:record.x,y:record.y},safe,'自动修正必须写回服务端存档');
    const view=await webTransport(`/v1/world/scenes/${sceneId}`,undefined,web.token);
    assert.deepEqual(view.playerPosition,{sceneId,...safe});
    (globalThis as any).wx={getAccountInfoSync:()=>({miniProgram:{envVersion:'release'}}),request:async(options:any)=>{
      const response=await app.inject({method:options.method,url:new URL(options.url).pathname,headers:options.header,payload:options.data});
      options.success({statusCode:response.statusCode,data:response.json()});
    }};
    const wechat=new GameController(createWeChatPlatform('http://localhost:8080').transport);
    await wechat.loginWechat('three');assert.deepEqual({x:wechat.x,y:wechat.y},safe);
    Object.assign(repo.players.get(playerId)!,{x:34.25,y:26.75});
    const move=await webTransport('/v1/player/move',{requestId:randomUUID(),x:34.5,y:26.75},web.token);
    assert.equal(move.positionRestored,true);
    assert.equal(canStand(initialWorld,sceneId,move.player.x,move.player.y),true);
    assert.deepEqual({x:repo.players.get(playerId)!.x,y:repo.players.get(playerId)!.y},{x:move.player.x,y:move.player.y});
    const repeat=await webTransport('/v1/bootstrap',undefined,web.token);
    assert.deepEqual({x:repeat.player.x,y:repeat.player.y},{x:repo.players.get(playerId)!.x,y:repo.players.get(playerId)!.y});
  }finally{(globalThis as any).wx=wxBefore;await app.close();}
});

test('DEV 手动安全复位只在开发环境存在',async()=>{
  const repo=new MemoryRepository(),app=await buildApp(repo,env);
  try{
    const login=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'safe-reset'}})).json();
    const created=await app.inject({method:'POST',url:'/v1/player/appearance/create',headers:{authorization:`Bearer ${login.token}`},payload:{requestId:randomUUID(),gender:'FEMALE',baseAvatarId:'FEMALE_01',skinColorId:'SKIN_LIGHT',hairColorId:'INK',topColorId:'SAGE',bottomColorId:'CREAM'}});
    assert.equal(created.statusCode,200,created.body);
    const response=await app.inject({method:'POST',url:'/v1/player/debug-safe-reset',headers:{authorization:`Bearer ${login.token}`},payload:{requestId:randomUUID()}});
    assert.equal(response.statusCode,200,response.body);
    assert.equal(canStand(initialWorld,response.json().player.sceneId,response.json().player.x,response.json().player.y),true);
  }finally{await app.close();}
  const prod=await buildApp(new MemoryRepository(),{...env,mode:'production',appEnv:'PROD',allowDevAuth:false},{exchangeCode:async()=> 'prod-reset-user'});
  try{
    const login=(await prod.inject({method:'POST',url:'/v1/auth/wechat',payload:{code:'prod'}})).json();
    const response=await prod.inject({method:'POST',url:'/v1/player/debug-safe-reset',headers:{authorization:`Bearer ${login.token}`},payload:{requestId:randomUUID()}});
    assert.equal(response.statusCode,404);
  }finally{await prod.close();}
});
