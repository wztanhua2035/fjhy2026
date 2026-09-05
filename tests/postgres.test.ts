import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {PostgresRepository} from '../apps/server/src/repository.js';
import {GameService} from '../apps/server/src/service.js';
test('PostgreSQL 多连接并发幂等、事务与重启持久化',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=process.env.TEST_DATABASE_URL!;assert.ok(url.includes('test'),'集成测试只允许显式命名的 test 数据库');
 const db=new PrismaClient({datasourceUrl:url}),repo=new PostgresRepository(db),s=new GameService(repo);const p=await repo.login(`test-${randomUUID()}`);
 try{const body={requestId:randomUUID(),gender:'MALE',baseAvatarId:'MALE_01',hairColorId:'INK',topColorId:'BLUE',bottomColorId:'CREAM'};await Promise.all(Array.from({length:8},()=>s.action(p.id,'create',body)));assert.equal((await repo.player(p.id)).cash,120);assert.equal(await db.playerLedger.count({where:{playerId:p.id}}),1);
 await db.player.update({where:{id:p.id},data:{sceneId:'INTERIOR_B_GROCERY'}});const buy={requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'RICE_01',quantity:1};await Promise.all(Array.from({length:8},()=>s.action(p.id,'buy',buy)));assert.equal((await repo.player(p.id)).cash,108);assert.equal(await db.playerLedger.count({where:{playerId:p.id}}),2);
 await assert.rejects(()=>s.action(p.id,'buy',{...buy,requestId:randomUUID(),quantity:20}));assert.equal((await repo.player(p.id)).cash,108);
 const second=new PostgresRepository(new PrismaClient({datasourceUrl:url}));try{assert.equal((await second.player(p.id)).inventory.RICE_01,1);}finally{await second.close();}
 }finally{await repo.close();}
});
