import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../apps/server/src/app.js';
import {MemoryRepository} from '../apps/server/src/repository.js';
import {hairConfigs,hairServiceOffers} from '../packages/game-config/hair-services.js';
import {validateWorld} from '../apps/server/src/config.js';
import {GameController} from '../packages/client-runtime/index.js';
import {sceneView} from '../packages/game-rules/index.js';
import {ensureHairServices} from '../apps/server/src/sync-hair-services.js';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {HairServiceEditor} from '../apps/admin/src/HairServiceEditor.js';

const env={mode:'development',appEnv:'DEV',port:0,jwtSecret:'test-jwt-secret-at-least-32-characters',subjectSecret:'test-subject-secret-at-least-32-characters',adminToken:'test-admin-token-at-least-32-characters',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost',assetBase:'http://localhost/assets'};
async function fixture(gender:'MALE'|'FEMALE'='FEMALE'){
  const repo=new MemoryRepository(),app=await buildApp(repo,env,{now:()=>new Date('2026-09-13T04:00:00Z')});
  const auth=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'hair-test'}})).json();
  const headers={authorization:`Bearer ${auth.token}`},post=(url:string,payload:object)=>app.inject({method:'POST',url,headers,payload});
  await post('/v1/player/appearance/create',{requestId:randomUUID(),gender,faceId:gender==='MALE'?'M_FACE_01':'F_FACE_01'});
  const player=repo.players.get(auth.player.id)!;player.sceneId='INTERIOR_B_SALON';player.x=12;player.y=12.5;
  const change=(targetId='F_HAIR_02',requestId=randomUUID())=>post('/v1/services/appearance',{shopId:'B_SALON',serviceType:'HAIR',targetId,requestId});
  return {repo,app,player,headers,post,change};
}
test('六个稳定 Hair ID，与报价解耦且配置可校验',async()=>{
  assert.equal(hairConfigs.length,6);assert.equal(hairConfigs.filter(h=>h.gender==='MALE').length,3);
  assert(hairConfigs.every(h=>!('price' in h)));assert(hairServiceOffers.every(o=>o.price>=20&&o.price<=60));
  const repo=new MemoryRepository(),world=await repo.world();assert.doesNotThrow(()=>validateWorld(world));
});
test('服务目录仅返回适配性别；正常收费、外观和账本持久化，重复请求只执行一次',async()=>{
  const f=await fixture();try{
    const catalog=await f.app.inject({url:'/v1/services/appearance?shopId=B_SALON',headers:f.headers});assert.equal(catalog.statusCode,200);assert(catalog.json().hairs.every((h:any)=>h.gender==='FEMALE'));
    const id=randomUUID(),responses=await Promise.all([f.change('F_HAIR_02',id),f.change('F_HAIR_02',id)]);
    for(const response of responses){assert.equal(response.statusCode,200);assert.equal(response.json().player.cash,84);assert.equal(response.json().player.appearance.hairId,'F_HAIR_02');}
    const p=await f.repo.player(f.player.id);assert.equal(p.ledger.filter(l=>l.type==='HAIR_SERVICE').length,1);assert.equal(p.ledger.at(-1)?.referenceId,'B_SALON:F_HAIR_02');assert(!p.cosmetics.includes('F_HAIR_02'));
    const login=(await f.app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'hair-test'}})).json();assert.equal(login.player.appearance.hairId,'F_HAIR_02');assert.equal(login.player.cash,84);
    assert.equal((await f.change()).json().code,'CURRENT_HAIR');
  }finally{await f.app.close();}
});
for(const [target,code] of [['M_HAIR_02','INCOMPATIBLE'],['NO_SUCH_HAIR','HAIR_NOT_FOUND'],['F_HAIR_01','CURRENT_HAIR']])test(`拒绝 ${code}`,async()=>{
  const f=await fixture();try{const response=await f.change(target);assert.equal(response.json().code,code);assert.equal((await f.repo.player(f.player.id)).cash,120);}finally{await f.app.close();}
});
test('余额不足与旧免费接口无法更换正式发型',async()=>{
  const f=await fixture();try{f.player.cash=1;assert.equal((await f.change()).json().code,'INSUFFICIENT_CASH');const old=await f.post('/v1/appearance/change',{requestId:randomUUID(),buildingId:'B_SALON',appearanceId:'F_HAIR_02'});assert.equal(old.json().code,'SERVICE_REQUIRED');assert.equal((await f.repo.player(f.player.id)).appearance?.hairId,'F_HAIR_01');}finally{await f.app.close();}
});
for(const mode of ['hair-disabled','service-disabled','price'] as const)test(`后台配置 ${mode} 下一次请求立即生效`,async()=>{
  const f=await fixture();try{
    const world=await f.repo.world();
    if(mode==='hair-disabled')world.hairs!.find(h=>h.hairId==='F_HAIR_02')!.enabled=false;
    const offer=world.hairServiceOffers!.find(o=>o.hairId==='F_HAIR_02')!;
    if(mode==='service-disabled')offer.enabled=false;if(mode==='price')offer.price=29;
    const draft=await f.repo.draft(validateWorld(world),world.configVersion);await f.repo.transition(draft.id,'TEST');await f.repo.transition(draft.id,'PUBLISHED');
    const response=await f.change();if(mode==='price'){assert.equal(response.statusCode,200);assert.equal(response.json().player.cash,91);}else{assert.equal(response.json().code,mode==='hair-disabled'?'HAIR_DISABLED':'SERVICE_DISABLED');assert.equal((await f.repo.player(f.player.id)).cash,120);}
  }finally{await f.app.close();}
});
test('预览只读正式 appearance，取消/离开/退出均清除候选',async()=>{
  const f=await fixture();try{
    const world=await f.repo.world(),game=new GameController(async()=>({hairs:hairConfigs.filter(h=>h.gender==='FEMALE'),offers:hairServiceOffers}));
    game.boot={player:structuredClone(f.player)} as any;game.view=sceneView(world,'INTERIOR_B_SALON',new Date('2026-09-13T04:00:00Z'));
    const npc=game.view.npcs.find(n=>n.id==='NPC_SALON_HAIRDRESSER')!;game.x=npc.x;game.y=npc.y+.4;
    game.hairCatalog=hairConfigs.filter(h=>h.gender==='FEMALE');game.hairOffers=hairServiceOffers;game.hairPanelOpen=true;game.previewHairId='F_HAIR_01';
    game.cycleHair(1);assert.equal(game.renderHairId,'F_HAIR_02');assert.equal(game.player!.appearance!.hairId,'F_HAIR_01');
    game.closeHairService();assert.equal(game.renderHairId,'F_HAIR_01');assert.equal(game.previewHairId,null);
    game.hairPanelOpen=true;game.previewHairId='F_HAIR_02';game.x=2;game.y=17;game.tick(0,0,0);assert.equal(game.hairPanelOpen,false);
    game.hairPanelOpen=true;game.previewHairId='F_HAIR_03';game.logout();assert.equal(game.previewHairId,null);
  }finally{await f.app.close();}
});
test('重新开始清除发型，重建沿用同一 hairId 字段',async()=>{
  const f=await fixture();try{await f.change();const reset=await f.post('/v1/player/restart',{confirm:true,requestId:randomUUID()});assert.equal(reset.statusCode,200);assert(!reset.json().player.appearance);const created=await f.post('/v1/player/appearance/create',{requestId:randomUUID(),gender:'MALE',faceId:'M_FACE_01',hairId:'M_HAIR_03'});assert.equal(created.statusCode,200);assert.equal(created.json().player.appearance.hairId,'M_HAIR_03');}finally{await f.app.close();}
});
test('不同请求内容复用编号冲突；客户端价格字段拒绝',async()=>{
  const f=await fixture();try{
    const id=randomUUID();assert.equal((await f.change('F_HAIR_02',id)).statusCode,200);
    assert.equal((await f.change('F_HAIR_03',id)).statusCode,409);
    const bad=await f.post('/v1/services/appearance',{shopId:'B_SALON',serviceType:'HAIR',targetId:'F_HAIR_03',requestId:randomUUID(),price:0});assert.equal(bad.statusCode,400);
    assert.equal((await f.repo.player(f.player.id)).cash,84);
  }finally{await f.app.close();}
});
test('男性可正常付费；换发型不移动、不改背包和 outfit',async()=>{
  const f=await fixture('MALE');try{
    const before=structuredClone(f.player),response=await f.change('M_HAIR_03');assert.equal(response.statusCode,200);
    const p=response.json().player;assert.equal(p.appearance.hairId,'M_HAIR_03');assert.equal(p.cash,72);
    for(const key of ['x','y','sceneId','inventory'] as const)assert.deepEqual(p[key],before[key]);assert.equal(p.appearance.outfitId,before.appearance!.outfitId);
  }finally{await f.app.close();}
});
test('旧世界迁移只补缺失字段，不重置已发布改价与下架',async()=>{
  const repo=new MemoryRepository(),world=await repo.world();delete world.hairs;delete world.hairServiceOffers;
  const draft=await repo.draft(world,world.configVersion);await repo.transition(draft.id,'TEST');await repo.transition(draft.id,'PUBLISHED');
  assert.equal((await ensureHairServices(repo)).published,true);
  const next=await repo.world();next.hairServiceOffers![0].price=57;next.hairs![0].enabled=false;
  const edited=await repo.draft(next,next.configVersion);await repo.transition(edited.id,'TEST');await repo.transition(edited.id,'PUBLISHED');
  assert.equal((await ensureHairServices(repo)).published,false);assert.equal((await repo.world()).hairServiceOffers![0].price,57);assert.equal((await repo.world()).hairs![0].enabled,false);
});
test('后台编辑器展示独立报价和只读 Hair ID；发布拒绝改写身份',async()=>{
  const repo=new MemoryRepository(),world=await repo.world();
  const html=renderToStaticMarkup(createElement(HairServiceEditor,{json:JSON.stringify(world),onChange:()=>{}}));
  assert(html.includes('F_HAIR_03'));assert(html.includes('服务费'));assert(html.includes('发型与服务报价独立'));
  const changed=structuredClone(world);changed.hairs![0].hairId='M_HAIR_99';assert.throws(()=>validateWorld(changed,world));
});
