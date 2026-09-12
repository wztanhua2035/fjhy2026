import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildApp } from '../apps/server/src/app.js';
import { MemoryRepository } from '../apps/server/src/repository.js';

const env={mode:'development',appEnv:'DEV',port:8080,jwtSecret:'test-jwt-secret-thirty-two-characters-long',subjectSecret:'test-subject-secret-thirty-two-characters',adminToken:'test-admin-token-thirty-two-characters-long',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost:5173',assetBase:'http://localhost:8080/assets'};
const now=()=>new Date('2026-09-12T06:00:00Z');

test('账本允许同一请求产生多事件，请求去重仍由独立表负责',()=>{
  const schema=readFileSync(new URL('../database/prisma/schema.prisma',import.meta.url),'utf8');
  const ledger=schema.split('model PlayerLedger {')[1].split('model IdempotencyRequest {')[0];
  const requests=schema.split('model IdempotencyRequest {')[1].split('model GhostSnapshot {')[0];
  const migration=readFileSync(new URL('../database/prisma/migrations/202609120002_multi_event_ledger/migration.sql',import.meta.url),'utf8');
  assert.doesNotMatch(ledger,/@@unique\(\[playerId,requestId\]\)/);
  assert.match(requests,/@@id\(\[playerId,requestId\]\)/);
  assert.match(migration,/DROP INDEX IF EXISTS "player_ledger_playerId_requestId_key"/);
});

test('HTTP 第一桶金卖出+领奖；春衫首次对话接取+领取；三条任务和认识关系重登幂等',async()=>{
  const repo=new MemoryRepository(),app=await buildApp(repo,env,{now});
  try{
    const auth=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'multi-ledger'}})).json(),id=auth.player.id;
    const headers={authorization:`Bearer ${auth.token}`,'x-debug-open-all':'1'};
    const post=async(endpoint:string,payload:Record<string,unknown>)=>{
      const response=await app.inject({method:'POST',url:endpoint,headers,payload});
      assert.equal(response.statusCode,200,`${endpoint} ${JSON.stringify(payload)} => ${response.statusCode} ${response.body}`);
      return response.json();
    };
    const place=(sceneId:string,x:number,y:number)=>Object.assign(repo.players.get(id)!,{sceneId,x,y});
    await post('/v1/player/appearance/create',{requestId:randomUUID(),gender:'FEMALE',skinToneId:'SKIN_LIGHT',hairId:'F_HAIR_01',outfitId:'F_OUTFIT_01'});
    place('INTERIOR_B_TRADE',12,10);
    await post('/v1/npc/talk',{requestId:randomUUID(),npcId:'NPC_TRADE_CLERK'});
    place('INTERIOR_B_GROCERY',12,10);
    await post('/v1/economy/buy',{requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'RICE_01',quantity:1});
    place('INTERIOR_B_TRADE',12,10);
    const sellId=randomUUID(),sold=await post('/v1/economy/sell',{requestId:sellId,buildingId:'B_TRADE',itemId:'RICE_01',quantity:1});
    assert.equal(sold.player.cash,144);
    assert.deepEqual(sold.player.ledger.filter((l:any)=>l.requestId===sellId).map((l:any)=>l.type),['SHOP_SELL','QUEST_REWARD']);
    const repeated=await post('/v1/economy/sell',{requestId:sellId,buildingId:'B_TRADE',itemId:'RICE_01',quantity:1});assert.deepEqual(repeated,sold);
    place('INTERIOR_B_INN',8,10);await post('/v1/npc/talk',{requestId:randomUUID(),npcId:'NPC_001'});
    place('INTERIOR_B_GROCERY',12,10);await post('/v1/npc/talk',{requestId:randomUUID(),npcId:'NPC_GROCERY_CLERK'});
    place('INTERIOR_B_INN',8,10);await post('/v1/npc/talk',{requestId:randomUUID(),npcId:'NPC_001'});
    assert.equal((await repo.player(id)).ledger.filter(l=>l.type==='QUEST_REWARD'&&l.referenceId==='Q_002').length,1);
    place('INTERIOR_B_CLOTH',16,10);
    const clothId=randomUUID(),cloth=await post('/v1/npc/talk',{requestId:clothId,npcId:'NPC_CLOTH_SHOPKEEPER'});
    assert.deepEqual(cloth.player.ledger.filter((l:any)=>l.requestId===clothId).map((l:any)=>l.type),['QUEST_ACCEPTED','QUEST_ITEM_ACQUIRED']);
    assert.equal(cloth.player.inventory.CLOTH_SAMPLE_01,1);
    assert.ok(cloth.player.metNpcs.includes('NPC_CLOTH_SHOPKEEPER'));
    await post('/v1/npc/talk',{requestId:clothId,npcId:'NPC_CLOTH_SHOPKEEPER'});
    const talkAgain=await post('/v1/npc/talk',{requestId:randomUUID(),npcId:'NPC_CLOTH_SHOPKEEPER'});
    assert.equal(talkAgain.player.inventory.CLOTH_SAMPLE_01,1);
    place('INTERIOR_B_SALON',8,10);await post('/v1/npc/talk',{requestId:randomUUID(),npcId:'NPC_SALON_HAIRDRESSER'});
    assert.equal((await repo.player(id)).ledger.some(l=>l.type==='QUEST_REWARD'&&l.referenceId==='Q_003'),false);
    const relogin=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'multi-ledger'}})).json();assert.equal(relogin.player.id,id);
    assert.ok(relogin.player.metNpcs.includes('NPC_CLOTH_SHOPKEEPER'));
    place('INTERIOR_B_CLOTH',16,10);const reportId=randomUUID();
    const report=await post('/v1/npc/talk',{requestId:reportId,npcId:'NPC_CLOTH_SHOPKEEPER'});
    assert.equal(report.player.ledger.filter((l:any)=>l.type==='QUEST_REWARD'&&l.referenceId==='Q_003').length,1);
    assert.deepEqual(report.player.ledger.filter((l:any)=>l.requestId===reportId).map((l:any)=>l.type),['QUEST_REPORTED','QUEST_REWARD']);
    await post('/v1/npc/talk',{requestId:reportId,npcId:'NPC_CLOTH_SHOPKEEPER'});
    await post('/v1/npc/talk',{requestId:randomUUID(),npcId:'NPC_CLOTH_SHOPKEEPER'});
    assert.equal((await repo.player(id)).ledger.filter(l=>l.type==='QUEST_REWARD'&&l.referenceId==='Q_003').length,1);
  }finally{await app.close();}
});
