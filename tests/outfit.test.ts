import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../apps/server/src/app.js';
import {MemoryRepository} from '../apps/server/src/repository.js';
import {validateWorld} from '../apps/server/src/config.js';
import {outfitConfigs,outfitOffers} from '../packages/game-config/outfits.js';
import {GameController} from '../packages/client-runtime/index.js';
import {sceneView} from '../packages/game-rules/index.js';
import {ensureOutfits} from '../apps/server/src/sync-outfits.js';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {OutfitEditor} from '../apps/admin/src/OutfitEditor.js';

const env={mode:'development',appEnv:'DEV',port:0,jwtSecret:'test-jwt-secret-at-least-32-characters',subjectSecret:'test-subject-secret-at-least-32-characters',adminToken:'test-admin-token-at-least-32-characters',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost',assetBase:'http://localhost/assets'};
async function fixture(gender:'MALE'|'FEMALE'='FEMALE'){
  const repo=new MemoryRepository(),app=await buildApp(repo,env,{now:()=>new Date('2026-09-13T04:00:00Z')});
  const auth=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'outfit-test'}})).json();
  const headers={authorization:`Bearer ${auth.token}`},post=(url:string,payload:object)=>app.inject({method:'POST',url,headers,payload});
  const prefix=gender==='MALE'?'M':'F';
  await post('/v1/player/appearance/create',{requestId:randomUUID(),gender,faceId:`${prefix}_FACE_02`,hairId:`${prefix}_HAIR_03`,outfitId:`${prefix}_OUTFIT_01`});
  const player=repo.players.get(auth.player.id)!;player.sceneId='INTERIOR_B_CLOTH';player.x=16;player.y=11;
  const buy=(id=`${prefix}_OUTFIT_02`,requestId=randomUUID())=>post('/v1/appearance/purchase',{buildingId:'B_CLOTH',appearanceId:id,requestId});
  const wear=(id=`${prefix}_OUTFIT_01`)=>post('/v1/appearance/change',{buildingId:'B_CLOTH',appearanceId:id,requestId:randomUUID()});
  return {repo,app,player,headers,post,buy,wear,prefix};
}
test('六套稳定 Outfit、独立报价与配置引用',async()=>{
  assert.equal(outfitConfigs.length,6);assert(outfitConfigs.every(o=>!('price' in o)));
  assert.deepEqual(outfitOffers.filter(o=>o.shopId==='B_CLOTH').map(o=>o.price),[70,110,150,70,110,150]);
  const world=await new MemoryRepository().world();assert.doesNotThrow(()=>validateWorld(world));
});
test('创建拥有初始整套；购买原子扣款、穿上、重登和幂等',async()=>{
  const f=await fixture();try{
    assert(f.player.cosmetics.includes('F_OUTFIT_01'));
    const catalog=await f.app.inject({url:'/v1/outfits/catalog?shopId=B_CLOTH',headers:f.headers});
    assert.equal(catalog.statusCode,200);assert.deepEqual(catalog.json().outfits.map((o:any)=>o.outfitId),['F_OUTFIT_01','F_OUTFIT_02','F_OUTFIT_03']);
    const legacyCatalog=await f.app.inject({url:'/v1/appearance/catalog?shop=B_CLOTH',headers:f.headers});assert.equal(legacyCatalog.json().catalog.find((o:any)=>o.id==='F_OUTFIT_02').price,110);
    const before=structuredClone(f.player),requestId=randomUUID();
    const results=await Promise.all([f.buy('F_OUTFIT_02',requestId),f.buy('F_OUTFIT_02',requestId)]);
    for(const r of results){assert.equal(r.statusCode,200);assert.equal(r.json().player.cash,10);assert.equal(r.json().player.appearance.outfitId,'F_OUTFIT_02');}
    const p=await f.repo.player(f.player.id);assert.equal(p.ledger.filter(l=>l.type==='OUTFIT_BUY').length,1);assert.deepEqual(p.cosmetics.filter(id=>id.startsWith('F_OUTFIT')),['F_OUTFIT_01','F_OUTFIT_02']);
    for(const key of ['faceId','hairId','headwearId'] as const)assert.equal(p.appearance![key],before.appearance![key]);
    for(const key of ['x','y','sceneId','inventory'] as const)assert.deepEqual(p[key],before[key]);
    assert.equal((await f.buy()).json().code,'ALREADY_OWNED');
    const worn=await f.wear();assert.equal(worn.statusCode,200);assert.equal(worn.json().player.cash,10);assert.equal(worn.json().player.appearance.outfitId,'F_OUTFIT_01');
    assert.equal((await f.wear()).json().code,'CURRENT_OUTFIT');
    const relogin=(await f.app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'outfit-test'}})).json();assert.equal(relogin.player.appearance.outfitId,'F_OUTFIT_01');assert(relogin.player.cosmetics.includes('F_OUTFIT_02'));
  }finally{await f.app.close();}
});
test('无效、异性、下架、余额不足和客户端伪造价格均拒绝',async()=>{
  const f=await fixture();try{
    assert.equal((await f.buy('NO_OUTFIT')).json().code,'BAD_APPEARANCE');
    assert.equal((await f.buy('M_OUTFIT_02')).json().code,'INCOMPATIBLE');
    const bad=await f.post('/v1/appearance/purchase',{buildingId:'B_CLOTH',appearanceId:'F_OUTFIT_02',requestId:randomUUID(),price:0});assert.equal(bad.statusCode,400);
    f.player.cash=1;assert.equal((await f.buy()).json().code,'INSUFFICIENT_CASH');
    const world=await f.repo.world();world.outfitOffers!.find(o=>o.outfitId==='F_OUTFIT_02')!.enabled=false;
    const draft=await f.repo.draft(validateWorld(world),world.configVersion);await f.repo.transition(draft.id,'TEST');await f.repo.transition(draft.id,'PUBLISHED');
    assert.equal((await f.buy()).json().code,'OUTFIT_UNLISTED');
  }finally{await f.app.close();}
});
test('预览和取消不写 PlayerState，场景变化关闭试衣',async()=>{
  const f=await fixture();try{
    const game=new GameController(async()=>({}));game.boot={player:structuredClone(f.player)} as any;game.view=sceneView(await f.repo.world(),'INTERIOR_B_CLOTH',new Date('2026-09-13T04:00:00Z'));
    game.outfitCatalog=outfitConfigs.filter(o=>o.gender==='FEMALE');game.outfitOffers=outfitOffers;game.ownedOutfitIds=['F_OUTFIT_01'];game.outfitPanelOpen=true;game.previewOutfitId='F_OUTFIT_01';
    game.cycleOutfit(1);assert.equal(game.renderOutfitId,'F_OUTFIT_02');assert.equal(game.player?.appearance?.outfitId,'F_OUTFIT_01');
    game.closeOutfitShop();assert.equal(game.renderOutfitId,'F_OUTFIT_01');assert.equal(game.previewOutfitId,null);
    game.outfitPanelOpen=true;game.previewOutfitId='F_OUTFIT_02';game.x=2;game.y=17;game.tick(0,0,0);assert.equal(game.outfitPanelOpen,false);
    game.outfitPanelOpen=true;game.previewOutfitId='F_OUTFIT_03';game.logout();assert.equal(game.previewOutfitId,null);
  }finally{await f.app.close();}
});
test('重开后失去购买衣服并重新拥有创建选择；旧世界只补字段',async()=>{
  const f=await fixture();try{
    await f.buy();await f.post('/v1/player/restart',{confirm:true,requestId:randomUUID()});
    const created=await f.post('/v1/player/appearance/create',{requestId:randomUUID(),gender:'MALE',faceId:'M_FACE_01',outfitId:'M_OUTFIT_03'});
    assert.equal(created.statusCode,200);assert.deepEqual(created.json().player.cosmetics.filter((id:string)=>id.includes('OUTFIT')),['M_OUTFIT_03']);
  }finally{await f.app.close();}
  const repo=new MemoryRepository(),old=await repo.world();delete old.outfits;delete old.outfitOffers;const draft=await repo.draft(old,old.configVersion);await repo.transition(draft.id,'TEST');await repo.transition(draft.id,'PUBLISHED');
  assert.equal((await ensureOutfits(repo)).published,true);assert.equal((await ensureOutfits(repo)).published,false);
});
test('后台表格含独立报价，稳定 ID/性别不可变',async()=>{
  const world=await new MemoryRepository().world(),html=renderToStaticMarkup(createElement(OutfitEditor,{json:JSON.stringify(world),onChange:()=>{}}));
  assert(html.includes('F_OUTFIT_03'));assert(html.includes('售价（文）'));
  const changed=structuredClone(world);changed.outfits![0].gender='FEMALE';assert.throws(()=>validateWorld(changed,world));
});
