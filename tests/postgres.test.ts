import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {PostgresRepository} from '../apps/server/src/repository.js';
import {GameService} from '../apps/server/src/service.js';
import {ensureTradeShop} from '../apps/server/src/sync-trade.js';
import {GUEST_ROOM_LIFE_UNLOCKED} from '../packages/game-config/life-v1.js';
test('PostgreSQL 多连接并发幂等、事务与重启持久化',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=process.env.TEST_DATABASE_URL!;assert.ok(url.includes('test'),'集成测试只允许显式命名的 test 数据库');
 const db=new PrismaClient({datasourceUrl:url}),repo=new PostgresRepository(db),s=new GameService(repo);const p=await repo.login(`test-${randomUUID()}`);
 try{const body={requestId:randomUUID(),gender:'MALE',baseAvatarId:'MALE_01',hairColorId:'INK',topColorId:'BLUE',bottomColorId:'CREAM'};await Promise.all(Array.from({length:8},()=>s.action(p.id,'create',body)));assert.equal((await repo.player(p.id)).cash,120);assert.equal(await db.playerLedger.count({where:{playerId:p.id}}),1);
 await db.player.update({where:{id:p.id},data:{sceneId:'INTERIOR_B_GROCERY'}});const buy={requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'RICE_01',quantity:1};await Promise.all(Array.from({length:8},()=>s.action(p.id,'buy',buy)));assert.equal((await repo.player(p.id)).cash,108);assert.equal(await db.playerLedger.count({where:{playerId:p.id}}),2);
 await assert.rejects(()=>s.action(p.id,'buy',{...buy,requestId:randomUUID(),quantity:20}));assert.equal((await repo.player(p.id)).cash,108);
 const water={requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'WATER_01',quantity:3};await Promise.all(Array.from({length:8},()=>s.action(p.id,'buy',water)));assert.equal((await repo.player(p.id)).cash,90);assert.equal((await repo.player(p.id)).inventory.WATER_01,3);
 const second=new PostgresRepository(new PrismaClient({datasourceUrl:url}));try{assert.equal((await second.player(p.id)).inventory.RICE_01,1);assert.equal((await second.player(p.id)).inventory.WATER_01,3);assert.equal((await second.player(p.id)).cash,90);}finally{await second.close();}
 await ensureTradeShop(repo);await db.player.update({where:{id:p.id},data:{sceneId:'INTERIOR_B_TRADE'}});
 const before=(await repo.player(p.id)).cash;
 const attempts=await Promise.allSettled(Array.from({length:2},()=>s.action(p.id,'sell',{requestId:randomUUID(),buildingId:'B_TRADE',itemId:'WATER_01',quantity:2})));
 assert.equal(attempts.filter(result=>result.status==='fulfilled').length,1);assert.equal(attempts.filter(result=>result.status==='rejected').length,1);
 assert.equal((await repo.player(p.id)).inventory.WATER_01,1);
 assert.equal((await repo.player(p.id)).cash,before+8);
 assert.equal(await db.playerLedger.count({where:{playerId:p.id,type:'SHOP_SELL'}}),1);
 // The CI PostgreSQL database also exercises the new additive player columns.
 await db.player.update({where:{id:p.id},data:{sceneId:'INTERIOR_B_INN_GUEST_ROOM',x:9.45,y:8.2,storyFlags:{[GUEST_ROOM_LIFE_UNLOCKED]:true}}});
 const transfer={requestId:randomUUID(),zoneId:'GUEST_CHEST',itemId:'WATER_01',quantity:1,direction:'deposit'};
 await Promise.all(Array.from({length:2},()=>s.action(p.id,'storageTransfer',transfer)));
 const reloaded=new PostgresRepository(new PrismaClient({datasourceUrl:url}));
 try{assert.equal((await reloaded.player(p.id)).storage.WATER_01,1);assert.equal((await reloaded.player(p.id)).inventory.WATER_01,undefined);}finally{await reloaded.close();}
 await db.player.update({where:{id:p.id},data:{x:5.2,y:5.8,lifeState:{energy:20,sleep:null,lastEffectiveSleepAt:null,lastSleepResult:null}}});
 await s.action(p.id,'sleepStart',{requestId:randomUUID(),zoneId:'GUEST_BED',hours:6});
 s.now=()=>new Date(Date.now()+7*3600000);await s.settleDueSleep(p.id);await s.settleDueSleep(p.id);
 assert.equal((await repo.player(p.id)).life.energy,60);
 }finally{await repo.close();}
});
