import {testProfile} from './creation-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MemoryRepository} from '../apps/server/src/repository.js';
import {buildApp} from '../apps/server/src/app.js';
import {GUEST_ROOM_LIFE_UNLOCKED,initialLifeState,settleSleep} from '../packages/game-config/life-v1.js';
import {GameController} from '../packages/client-runtime/index.js';
import {sceneView} from '../packages/game-rules/index.js';

const env={mode:'development',appEnv:'DEV',port:0,jwtSecret:'test-jwt-secret-at-least-32-characters',subjectSecret:'test-subject-secret-at-least-32-characters',adminToken:'test-admin-token-at-least-32-characters',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost',assetBase:'http://localhost/assets'};
async function fixture(){
  let clock=new Date('2026-09-13T04:00:00Z');
  const repo=new MemoryRepository(),app=await buildApp(repo,env,{now:()=>clock});
  const auth=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:randomUUID().slice(0,24)}})).json();
  const headers={authorization:`Bearer ${auth.token}`};
  const post=(url:string,body:Record<string,unknown>)=>app.inject({method:'POST',url,headers,payload:{requestId:randomUUID(),...body}});
  const created=await post('/v1/player/appearance/create',{profile:testProfile(),gender:'FEMALE',faceId:'F_FACE_01',outfitId:'F_OUTFIT_01'});
  assert.equal(created.statusCode,200,created.body);
  return {repo,app,headers,post,get player(){return repo.players.get(auth.player.id)!;},setClock:(value:string)=>{clock=new Date(value);}};
}
function at(f:Awaited<ReturnType<typeof fixture>>,zone:'GUEST_BED'|'GUEST_CHEST'|'GUEST_WARDROBE'|'GUEST_DESK'){
  const positions={GUEST_BED:[5.2,5.8],GUEST_CHEST:[9.45,8.2],GUEST_WARDROBE:[7.25,5.15],GUEST_DESK:[8.9,5.9]};
  f.player.sceneId='INTERIOR_B_INN_GUEST_ROOM';[f.player.x,f.player.y]=positions[zone];
}
test('房间设施直到客栈首次正式出街才解锁，重开重置',async()=>{
  const f=await fixture();try{
    at(f,'GUEST_BED');
    const preview=await f.post('/v1/world/inspect',{zoneId:'GUEST_BED'});assert.equal(preview.statusCode,200);assert.equal(preview.json().facility,undefined);
    assert.equal((await f.post('/v1/facilities/sleep/start',{zoneId:'GUEST_BED',hours:6})).statusCode,403);
    f.player.sceneId='INTERIOR_B_INN';f.player.x=12;f.player.y=18;f.player.storyFlags={INTRO_INN_KEEPER_DONE:true};
    const exit=await f.post('/v1/world/portal',{portalId:'EXIT_B_INN'});assert.equal(exit.statusCode,200,exit.body);
    assert.equal(exit.json().player.storyFlags[GUEST_ROOM_LIFE_UNLOCKED],true);
    at(f,'GUEST_BED');assert.equal((await f.post('/v1/world/inspect',{zoneId:'GUEST_BED'})).json().facility.kind,'bed');
    const restarted=await f.post('/v1/player/restart',{confirm:true});assert.equal(restarted.statusCode,200);
    assert.equal(restarted.json().player.storyFlags[GUEST_ROOM_LIFE_UNLOCKED],undefined);assert.equal(restarted.json().player.life.energy,100);assert.deepEqual(restarted.json().player.storage,{});
  }finally{await f.app.close();}
});
test('衣柜仅显示已拥有 Outfit，换装免费、不可跨性别或越权',async()=>{
  const f=await fixture();try{
    f.player.storyFlags={[GUEST_ROOM_LIFE_UNLOCKED]:true};at(f,'GUEST_WARDROBE');
    const catalog=await f.app.inject({url:'/v1/facilities/wardrobe?zoneId=GUEST_WARDROBE',headers:f.headers});
    assert.equal(catalog.statusCode,200);assert.deepEqual(catalog.json().outfits.map((o:any)=>o.outfitId),['F_OUTFIT_01']);
    assert.equal((await f.post('/v1/facilities/wardrobe/equip',{zoneId:'GUEST_WARDROBE',outfitId:'F_OUTFIT_02'})).statusCode,403);
    f.player.cosmetics.push('F_OUTFIT_02');const cash=f.player.cash;
    const equipped=await f.post('/v1/facilities/wardrobe/equip',{zoneId:'GUEST_WARDROBE',outfitId:'F_OUTFIT_02'});
    assert.equal(equipped.statusCode,200,equipped.body);assert.equal(equipped.json().player.cash,cash);assert.equal(equipped.json().player.appearance.outfitId,'F_OUTFIT_02');
    assert.notEqual((await f.post('/v1/facilities/wardrobe/equip',{zoneId:'GUEST_WARDROBE',outfitId:'M_OUTFIT_02'})).statusCode,200);
  }finally{await f.app.close();}
});
test('箱子转移守恒、保护任务物品、幂等请求和重登恢复',async()=>{
  const f=await fixture();try{
    f.player.storyFlags={[GUEST_ROOM_LIFE_UNLOCKED]:true};f.player.inventory={RICE_01:3};at(f,'GUEST_CHEST');
    const requestId=randomUUID(),payload={requestId,zoneId:'GUEST_CHEST',itemId:'RICE_01',quantity:2,direction:'deposit'};
    const a=await f.app.inject({method:'POST',url:'/v1/facilities/storage/transfer',headers:f.headers,payload});
    const b=await f.app.inject({method:'POST',url:'/v1/facilities/storage/transfer',headers:f.headers,payload});
    assert.equal(a.statusCode,200,a.body);assert.deepEqual(a.json(),b.json());assert.equal(f.player.inventory.RICE_01,1);assert.equal(f.player.storage.RICE_01,2);
    const reloaded=await f.app.inject({url:'/v1/bootstrap',headers:f.headers});assert.equal(reloaded.json().player.storage.RICE_01,2);
    const withdrawn=await f.post('/v1/facilities/storage/transfer',{zoneId:'GUEST_CHEST',itemId:'RICE_01',quantity:1,direction:'withdraw'});
    assert.equal(withdrawn.statusCode,200,withdrawn.body);assert.equal(f.player.inventory.RICE_01,2);assert.equal(f.player.storage.RICE_01,1);
    f.player.inventory.CLOTH_SAMPLE_01=1;
    assert.notEqual((await f.post('/v1/facilities/storage/transfer',{zoneId:'GUEST_CHEST',itemId:'CLOTH_SAMPLE_01',quantity:1,direction:'deposit'})).statusCode,200);
    assert.equal(f.player.inventory.CLOTH_SAMPLE_01,1);
  }finally{await f.app.close();}
});
test('睡眠一次结算、离线重登结算、精力上限和疲劳冷却',async()=>{
  const f=await fixture();try{
    f.player.storyFlags={[GUEST_ROOM_LIFE_UNLOCKED]:true};f.player.life.energy=20;at(f,'GUEST_BED');
    assert.equal((await f.post('/v1/facilities/sleep/start',{zoneId:'GUEST_BED',hours:6})).statusCode,200);
    assert.equal((await f.post('/v1/facilities/sleep/start',{zoneId:'GUEST_BED',hours:6})).statusCode,409);
    f.setClock('2026-09-13T10:01:00Z');
    const once=await f.app.inject({url:'/v1/bootstrap',headers:f.headers});assert.equal(once.json().player.life.energy,60);assert.equal(once.json().player.life.sleep,null);
    const twice=await f.app.inject({url:'/v1/bootstrap',headers:f.headers});assert.equal(twice.json().player.life.energy,60);
    assert.equal((await f.post('/v1/facilities/sleep/start',{zoneId:'GUEST_BED',hours:6})).statusCode,200);
    f.setClock('2026-09-13T16:02:00Z');const repeated=await f.app.inject({url:'/v1/bootstrap',headers:f.headers});assert.equal(repeated.json().player.life.energy,62);assert.equal(repeated.json().player.life.lastSleepResult.repeated,true);
  }finally{await f.app.close();}
  const high={...initialLifeState(),energy:90,sleep:{startedAt:'2026-09-13T00:00:00Z',intendedHours:6 as const}};
  assert.equal(settleSleep(high,new Date('2026-09-13T06:00:00Z'))?.life.energy,90);
});
test('设施要求正确房间和距离，书桌只读',async()=>{
  const f=await fixture();try{
    f.player.storyFlags={[GUEST_ROOM_LIFE_UNLOCKED]:true};at(f,'GUEST_DESK');
    const desk=await f.post('/v1/world/inspect',{zoneId:'GUEST_DESK'});assert.equal(desk.json().facility.kind,'desk');
    assert.equal((await f.post('/v1/facilities/sleep/start',{zoneId:'GUEST_BED',hours:1})).statusCode,400);
    f.player.sceneId='INTERIOR_B_INN';assert.notEqual((await f.post('/v1/world/inspect',{zoneId:'GUEST_DESK'})).statusCode,200);
  }finally{await f.app.close();}
});
test('完整睡眠分段上限与短睡规则均不降低已有精力',()=>{
  const settle=(energy:number,hours:1|3|6,lastEffectiveSleepAt:string|null=null)=>settleSleep({energy,sleep:{startedAt:'2026-09-13T00:00:00Z',intendedHours:hours},lastEffectiveSleepAt,lastSleepResult:null},new Date(`2026-09-13T${String(hours).padStart(2,'0')}:00:00Z`))!.result;
  assert.deepEqual([20,59,60,65,69,70,90,100].map(n=>settle(n,6).after),[60,60,70,70,70,70,90,100]);
  assert.equal(settle(20,1).after,24);assert.equal(settle(20,3).after,30);assert.equal(settle(20,6).after,60);
  assert.equal(settle(20,6,'2026-09-13T00:00:00Z').after,28);
  assert.equal(settle(20,6,'2026-09-12T17:59:59Z').after,60);
});
test('未出街时返回房间仍锁定，完成出街后重登维持独立剧情标记',async()=>{
  const f=await fixture();try{
    f.player.sceneId='INTERIOR_B_INN';f.player.x=3;f.player.y=7.2;
    const intro=await f.post('/v1/intro/complete',{});assert.equal(intro.statusCode,200);
    const back=await f.post('/v1/world/portal',{portalId:'ENTER_INN_GUEST_ROOM'});assert.equal(back.statusCode,200,back.body);
    assert.equal(back.json().player.storyFlags[GUEST_ROOM_LIFE_UNLOCKED],undefined);
    at(f,'GUEST_CHEST');const light=await f.post('/v1/world/inspect',{zoneId:'GUEST_CHEST'});assert.equal(light.json().facility,undefined);
    assert.equal((await f.app.inject({url:'/v1/facilities/storage?zoneId=GUEST_CHEST',headers:f.headers})).statusCode,403);
    f.player.sceneId='INTERIOR_B_INN';f.player.x=12;f.player.y=18;
    assert.equal((await f.post('/v1/world/portal',{portalId:'EXIT_B_INN'})).statusCode,200);
    const relogin=await f.app.inject({url:'/v1/bootstrap',headers:f.headers});assert.equal(relogin.json().player.storyFlags[GUEST_ROOM_LIFE_UNLOCKED],true);
    assert.equal(relogin.json().player.storyFlags.INTRO_INN_KEEPER_DONE,true);
  }finally{await f.app.close();}
});
test('睡眠中重新进入 Web/微信共用控制器时恢复床面板并锁定移动',async()=>{
  const f=await fixture();try{
    f.player.storyFlags={[GUEST_ROOM_LIFE_UNLOCKED]:true};at(f,'GUEST_BED');
    assert.equal((await f.post('/v1/facilities/sleep/start',{zoneId:'GUEST_BED',hours:6})).statusCode,200);
    const world=await f.repo.world();
    const game=new GameController(async path=>path==='/v1/bootstrap'?{player:await f.repo.player(f.player.id)}:path==='/v1/quests'?{quests:[]}:path.startsWith('/v1/world/scenes/')?sceneView(world,'INTERIOR_B_INN_GUEST_ROOM',new Date()):{ghosts:[]});
    game.token='test';await game.refresh();
    assert.equal(game.facilityPanel,'bed');assert.equal(game.facilityZoneId,'GUEST_BED');
    const x=game.x;game.tick(.1,1,0);assert.equal(game.x,x);
  }finally{await f.app.close();}
});
