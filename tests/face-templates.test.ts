import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../apps/server/src/app.js';
import {MemoryRepository} from '../apps/server/src/repository.js';
import {GameService} from '../apps/server/src/service.js';
import {validateWorld} from '../apps/server/src/config.js';
import {faceConfigs} from '../packages/game-config/face-templates.js';
import {availableStarterLookOptions} from '../packages/game-config/appearance-v1.js';
import {initialWorld} from '../packages/game-config/index.js';
import {headwearConfigs} from '../packages/game-config/headwear.js';

const env={mode:'development',appEnv:'DEV',port:8080,jwtSecret:'test-jwt-secret-thirty-two-characters-long',subjectSecret:'test-subject-secret-thirty-two-characters',adminToken:'test-admin-token-thirty-two-characters-long',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost:5173',assetBase:'http://localhost:8080/assets'};

test('六套 Face ID 稳定，性别切换时三槽各回退到合法选项',()=>{
  assert.deepEqual(faceConfigs.map(face=>face.faceId),['M_FACE_01','M_FACE_02','M_FACE_03','F_FACE_01','F_FACE_02','F_FACE_03']);
  const current={faceId:'F_FACE_03',hairId:'F_HAIR_02',outfitId:'F_OUTFIT_02'};
  const female=availableStarterLookOptions({appearances:initialWorld.appearances,colors:initialWorld.colors},'FEMALE',current);
  assert.deepEqual(female.selection,current);
  const male=availableStarterLookOptions({appearances:initialWorld.appearances,colors:initialWorld.colors},'MALE',current);
  assert.deepEqual(male.selection,{faceId:'M_FACE_01',hairId:'M_HAIR_01',outfitId:'M_OUTFIT_01'});
  assert.equal(validateWorld(initialWorld).faces?.length,6);
  assert.equal(headwearConfigs.length,0);
});

test('API 创建要求 Face，拒绝异性/不存在/停用 Face；重登与重开保留所选槽位',async()=>{
  const repo=new MemoryRepository(),app=await buildApp(repo,env);
  try{
    const auth=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'face-test'}})).json();
    const headers={authorization:`Bearer ${auth.token}`};
    const before=(await app.inject({url:'/v1/bootstrap',headers})).json();
    assert.equal(before.faces.length,6);
    const post=(payload:Record<string,unknown>)=>app.inject({method:'POST',url:'/v1/player/appearance/create',headers,payload:{requestId:randomUUID(),gender:'FEMALE',hairId:'F_HAIR_02',outfitId:'F_OUTFIT_03',...payload}});
    assert.equal((await post({})).statusCode,400);
    assert.equal((await post({faceId:'M_FACE_01'})).statusCode,400);
    assert.equal((await post({faceId:'F_FACE_MISSING'})).statusCode,400);
    repo.versions[0].config.faces=faceConfigs.map(face=>face.faceId==='F_FACE_03'?{...face,enabled:false}:face);
    assert.equal((await post({faceId:'F_FACE_03'})).statusCode,400);
    repo.versions[0].config.faces=faceConfigs;
    const created=await post({faceId:'F_FACE_03'});
    assert.equal(created.statusCode,200,created.body);
    assert.equal(created.json().player.appearance.faceId,'F_FACE_03');
    assert.equal(created.json().player.appearance.headwearId,null);
    const restored=(await app.inject({url:'/v1/bootstrap',headers})).json().player.appearance;
    assert.deepEqual([restored.faceId,restored.hairId,restored.outfitId,restored.headwearId],['F_FACE_03','F_HAIR_02','F_OUTFIT_03',null]);
    const restart=await app.inject({method:'POST',url:'/v1/player/restart',headers,payload:{requestId:randomUUID(),confirm:true}});
    assert.equal(restart.statusCode,200,restart.body);
    assert.equal(restart.json().player.appearance,null);
  }finally{await app.close();}
});

test('Hair 服务更新只改变 Hair，保留 Face、Outfit 与 Headwear 槽位',async()=>{
  const repo=new MemoryRepository(),player=await repo.login('face-hair');
  const service=new GameService(repo,()=>new Date('2026-09-13T04:00:00Z'));
  await service.action(player.id,'create',{requestId:randomUUID(),gender:'FEMALE',faceId:'F_FACE_03',hairId:'F_HAIR_01',outfitId:'F_OUTFIT_02'});
  repo.players.get(player.id)!.sceneId='INTERIOR_B_SALON';
  const result=await service.action(player.id,'appearanceService',{requestId:randomUUID(),shopId:'B_SALON',serviceType:'HAIR',targetId:'F_HAIR_02'});
  const changed=result.player.appearance;
  assert.deepEqual([changed.faceId,changed.hairId,changed.outfitId,changed.headwearId],['F_FACE_03','F_HAIR_02','F_OUTFIT_02',null]);
});
