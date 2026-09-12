import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../apps/server/src/app.js';
import { MemoryRepository } from '../apps/server/src/repository.js';
import { GameService } from '../apps/server/src/service.js';
import { createStarterAppearance, formalizeAppearance, publicPlayer } from '../packages/game-rules/index.js';
import { starterLookOptions, availableStarterLookOptions } from '../packages/game-config/appearance-v1.js';
import { GameController } from '../packages/client-runtime/index.js';
import { initialWorld } from '../packages/game-config/index.js';
import { validateWorld } from '../apps/server/src/config.js';

const env={mode:'development',appEnv:'DEV',port:8080,jwtSecret:'test-jwt-secret-thirty-two-characters-long',subjectSecret:'test-subject-secret-thirty-two-characters',adminToken:'test-admin-token-thirty-two-characters-long',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost:5173',assetBase:'http://localhost:8080/assets'};

test('男女三肤色、三完整发型、三整套服装均可建角，重复请求不重复发钱',async()=>{
  const repo=new MemoryRepository(),service=new GameService(repo);
  for(const gender of ['MALE','FEMALE'] as const){
    const options=starterLookOptions(gender);
    assert.equal(options.skins.length,3);assert.equal(options.hairs.length,3);assert.equal(options.outfits.length,3);
    for(let index=0;index<3;index++){
      const player=await repo.login(`${gender}-${index}`),body={requestId:randomUUID(),gender,skinToneId:options.skins[index].id,hairId:options.hairs[index].id,outfitId:options.outfits[index].id};
      const first=await service.action(player.id,'create',body);
      const again=await service.action(player.id,'create',body);
      assert.deepEqual(again,first);
      const saved=await repo.login(`${gender}-${index}`);
      assert.equal(saved.appearance?.skinToneId,body.skinToneId);
      assert.equal(saved.appearance?.hairId,body.hairId);
      assert.equal(saved.appearance?.outfitId,body.outfitId);
      assert.equal(saved.cash,120);
      assert.equal(saved.ledger.filter(entry=>entry.type==='SYSTEM_GRANT').length,1);
      await assert.rejects(()=>service.action(player.id,'create',{...body,requestId:randomUUID()}),/角色已创建/);
    }
  }
});

test('建角不依赖旧发色/上衣色/下装色，缺省项回退合法选项，伪造 ID 被拒',async()=>{
  const options=availableStarterLookOptions({appearances:initialWorld.appearances,colors:initialWorld.colors},'FEMALE',{skinToneId:'SKIN_ABSENT',hairId:'HAIR_ABSENT',outfitId:'OUTFIT_ABSENT'});
  assert.deepEqual(options.selection,{skinToneId:'SKIN_LIGHT',hairId:'F_HAIR_01',outfitId:'F_OUTFIT_01'});
  const repo=new MemoryRepository();
  // Simulate a published world whose legacy color list differs from the client defaults.
  repo.versions[0].config.colors={SKIN_LIGHT:'#f5d8ba'};
  const service=new GameService(repo),player=await repo.login('new-minimal');
  await service.action(player.id,'create',{requestId:randomUUID(),gender:'MALE'});
  assert.equal((await repo.player(player.id)).appearance?.hairId,'M_HAIR_01');
  for(const [field,value] of [['skinToneId','SKIN_MISSING'],['hairId','M_HAIR_MISSING'],['outfitId','M_OUTFIT_MISSING']] as const){
    const other=await repo.login(field);
    await assert.rejects(()=>service.action(other.id,'create',{requestId:randomUUID(),gender:'MALE',[field]:value}));
    assert.equal((await repo.player(other.id)).appearance,null);
  }
});

test('创建 API 的共享客户端只发送新字段，重登 bootstrap 保留外观',async()=>{
  const repo=new MemoryRepository(),app=await buildApp(repo,env);
  try{
    const auth=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'new-appearance'}})).json();
    const headers={authorization:`Bearer ${auth.token}`};
    const boot=(await app.inject({url:'/v1/bootstrap',headers})).json();
    assert.equal(boot.player.appearance,null);
    assert.ok(boot.appearances.some((item:any)=>item.id==='F_OUTFIT_03'));
    const body={requestId:randomUUID(),gender:'FEMALE',skinToneId:'SKIN_WHEAT',hairId:'F_HAIR_03',outfitId:'F_OUTFIT_02'};
    const created=await app.inject({method:'POST',url:'/v1/player/appearance/create',headers,payload:body});
    assert.equal(created.statusCode,200,created.body);
    const restored=(await app.inject({url:'/v1/bootstrap',headers})).json();
    assert.equal(restored.player.appearance.hairId,'F_HAIR_03');
    assert.equal(restored.player.appearance.outfitId,'F_OUTFIT_02');
    const forged=await app.inject({method:'POST',url:'/v1/player/appearance/create',headers,payload:{...body,requestId:randomUUID(),topColorId:'SAGE'}});
    assert.equal(forged.statusCode,400);
    let sent:any;
    const controller=new GameController(async(_path,payload)=>{sent=payload;return {};});
    await controller.create('FEMALE',{skinToneId:'SKIN_LIGHT',hairId:'F_HAIR_01',outfitId:'F_OUTFIT_01'});
    assert.equal(sent.hairId,'F_HAIR_01');
    assert.equal(sent.outfitId,'F_OUTFIT_01');
    assert.equal('hairColorId' in sent,false);
    assert.equal('topColorId' in sent,false);
  }finally{await app.close();}
});

test('旧外观字段原样保留，新语义映射到安全默认选项',()=>{
  const legacy={gender:'FEMALE' as const,baseAvatarId:'FEMALE_04',skinColorId:'SKIN_LIGHT',hairStyleId:'HAIR_FEMALE_03',hairColorId:'CHESTNUT',topStyleId:'TOP_FEMALE_02',topColorId:'ROSE',bottomStyleId:'BOTTOM_FEMALE_01',bottomColorId:'CREAM',shoesId:'SHOES_FEMALE_01',accessoryIds:[]};
  const mapped=formalizeAppearance(legacy);
  assert.equal(mapped.hairStyleId,legacy.hairStyleId);
  assert.equal(mapped.topStyleId,legacy.topStyleId);
  assert.equal(mapped.hairId,'F_HAIR_01');
  assert.equal(mapped.outfitId,'F_OUTFIT_01');
  assert.equal(createStarterAppearance('MALE',{}).baseAvatarId,'MALE_01');
  assert.equal(publicPlayer({id:'p',nickname:'x',cash:0,stamina:100,status:'ACTIVE',sceneId:'INTERIOR_B_INN',x:12,y:15,appearance:legacy,inventory:{},cosmetics:[],ledger:[],tradeCounts:{},metNpcs:[]}).appearance?.hairId,'F_HAIR_01');
});

test('未来 NPC 可直接配置完整 Hair/Outfit 而无需旧式上下装字段',()=>{
  const world=structuredClone(initialWorld);
  world.npcs[0].appearance={gender:'MALE',skinToneId:'SKIN_LIGHT',hairId:'M_HAIR_01',outfitId:'M_OUTFIT_01',accessoryIds:[]};
  assert.equal(validateWorld(world).npcs[0].appearance?.gender,'MALE');
});
