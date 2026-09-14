import {testProfile} from './creation-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../apps/server/src/app.js';
import {MemoryRepository} from '../apps/server/src/repository.js';
import {ensureTradeShop} from '../apps/server/src/sync-trade.js';
import {validateWorld} from '../apps/server/src/config.js';
import {GameController} from '../packages/client-runtime/index.js';
import {resolveShopPrice} from '../packages/game-rules/inventory.js';
import {questStepProgress} from '../packages/game-rules/index.js';

const env={mode:'development',appEnv:'DEV',port:0,jwtSecret:'test-jwt-secret-at-least-32-characters',subjectSecret:'test-subject-secret-at-least-32-characters',adminToken:'test-admin-token-at-least-32-characters',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost',assetBase:'http://localhost/assets'};
async function fixture(){
  const repo=new MemoryRepository(),app=await buildApp(repo,env);
  const auth=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'trade-test'}})).json();
  const headers={authorization:`Bearer ${auth.token}`},post=(url:string,payload:object)=>app.inject({method:'POST',url,headers,payload});
  await post('/v1/player/appearance/create',{profile:testProfile(),requestId:randomUUID(),gender:'FEMALE',faceId:'F_FACE_01'});
  const player=repo.players.get(auth.player.id)!;player.sceneId='INTERIOR_B_TRADE';player.x=12;player.y=12.5;
  const sell=(itemId='WATER_01',quantity=1,requestId=randomUUID())=>post('/v1/economy/sell',{requestId,buildingId:'B_TRADE',itemId,quantity});
  return {repo,app,headers,post,player,sell};
}
test('六种商行报价区分店铺，固定价差与收购方向',async()=>{
  const f=await fixture();try{
    const world=await f.repo.world(),trade=world.buildings.find(b=>b.id==='B_TRADE')!,grocery=world.buildings.find(b=>b.id==='B_GROCERY')!;
    assert.equal(Object.keys(trade.stock).length,6);assert.equal(trade.clerkNpcId,'NPC_TRADE_CLERK');
    assert.equal(resolveShopPrice(grocery.stock.RICE_01,'buy'),12);assert.equal(resolveShopPrice(trade.stock.RICE_01,'sell'),16);
    assert.equal(trade.stock.MILK_01.canBuy,false);assert.equal(trade.stock.RICE_01.pricingMode,'FIXED');
    assert.equal(trade.stock.RICE_01.stockMode,'INFINITE');assert.equal(trade.stock.UMBRELLA_01.stockMode,'INFINITE');
  }finally{await f.app.close();}
});
test('多件出售按正式报价结算，账本、结果、背包、重登一致',async()=>{
  const f=await fixture();try{
    f.player.inventory.WATER_01=3;const sold=await f.sell('WATER_01',2);
    assert.equal(sold.statusCode,200);assert.equal(sold.json().trade.side,'SELL');assert.equal(sold.json().trade.actualUnitPrice,4);
    assert.equal(sold.json().trade.total,8);assert.equal(sold.json().trade.quantity,2);assert.equal(sold.json().player.cash,128);
    assert.equal(sold.json().player.inventory.WATER_01,1);assert.equal(sold.json().player.ledger.at(-1).referenceId,'B_TRADE:WATER_01:Q2');
    assert.equal((await f.repo.player(f.player.id)).inventory.WATER_01,1);
    const login=(await f.app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'trade-test'}})).json();
    assert.equal(login.player.inventory.WATER_01,1);assert.equal(login.player.cash,128);
  }finally{await f.app.close();}
});
test('并发出售同一份物品仅成功一次；同请求号重试复用结果',async()=>{
  const f=await fixture();try{
    f.player.inventory.RICE_01=1;
    const id=randomUUID(),same=await Promise.all(Array.from({length:5},()=>f.sell('RICE_01',1,id)));
    assert.ok(same.every(response=>response.statusCode===200&&response.body===same[0].body));
    const another=await Promise.all([f.sell('RICE_01'),f.sell('RICE_01')]);assert.ok(another.every(response=>response.json().code==='ITEM_NOT_OWNED'));
    const player=await f.repo.player(f.player.id);assert.equal(player.inventory.RICE_01,undefined);assert.equal(player.cash,136);
    assert.equal(player.ledger.filter(entry=>entry.type==='SHOP_SELL').length,1);
    assert.equal((await f.sell('RICE_01',2,id)).json().code,'REQUEST_CONFLICT');
  }finally{await f.app.close();}
});
test('商品、数量、方向、店铺和持有量失败均不改变钱包或背包',async()=>{
  const f=await fixture();try{
    f.player.inventory.WATER_01=1;const before=structuredClone(f.player);
    const cases:[()=>Promise<any>,string][]=[
      [()=>f.sell('WATER_01',2),'INSUFFICIENT_ITEM_QUANTITY'],[()=>f.sell('WATER_01',0),'INVALID_QUANTITY'],
      [()=>f.sell('UNKNOWN_01'),'SHOP_ITEM_NOT_LISTED'],[()=>f.sell('BREAD_01'),'SHOP_ITEM_NOT_LISTED'],
      [()=>f.post('/v1/economy/buy',{requestId:randomUUID(),buildingId:'B_TRADE',itemId:'MILK_01',quantity:1}),'ITEM_BUY_DISABLED'],
      [()=>f.post('/v1/economy/sell',{requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'WATER_01',quantity:1}),'WRONG_SHOP']
    ];
    for(const [call,code] of cases)assert.equal((await call()).json().code,code);
    assert.equal(f.player.cash,before.cash);assert.deepEqual(f.player.inventory,before.inventory);
    const stock=f.repo.versions[0].config.buildings.find(b=>b.id==='B_TRADE')!.stock;
    stock.WATER_01.canSell=false;assert.equal((await f.sell()).json().code,'ITEM_SELL_DISABLED');
    stock.WATER_01.canSell=true;stock.WATER_01.enabled=false;assert.equal((await f.sell()).json().code,'SHOP_ITEM_DISABLED');
  }finally{await f.app.close();}
});
test('第一桶金通过正式店铺 BUY/SELL 账本完成，奖励只发一次',async()=>{
  const f=await fixture();try{
    const player=f.player;player.sceneId='INTERIOR_B_GROCERY';
    player.storyFlags={FIRST_DAY_ENTERED_BAISHI:true};player.ledger.push({id:randomUUID(),type:'QUEST_ACCEPTED',amount:0,before:player.cash,after:player.cash,referenceId:'Q_001',requestId:randomUUID(),createdAt:new Date().toISOString()});
    const bought=await f.post('/v1/economy/buy',{requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'RICE_01',quantity:2});assert.equal(bought.statusCode,200);
    const quest=f.repo.versions[0].config.quests.find(q=>q.id==='Q_001')!;assert.deepEqual(questStepProgress(quest,bought.json().player.ledger),[1,0]);
    f.repo.players.get(player.id)!.sceneId='INTERIOR_B_TRADE';const sold=await f.sell('RICE_01',1);assert.equal(sold.statusCode,200);assert.deepEqual(questStepProgress(quest,sold.json().player.ledger),[1,1]);
    assert.equal(sold.json().player.ledger.filter((entry:any)=>entry.type==='QUEST_REWARD'&&entry.referenceId==='Q_001').length,0);
    const finalized=await f.post('/v1/quest/finalize',{requestId:randomUUID(),questId:'Q_001'});assert.equal(finalized.statusCode,200);
    assert.equal(finalized.json().player.ledger.filter((entry:any)=>entry.type==='QUEST_REWARD'&&entry.referenceId==='Q_001').length,1);
    await f.sell('RICE_01',1);assert.equal((await f.repo.player(player.id)).ledger.filter(entry=>entry.type==='QUEST_REWARD'&&entry.referenceId==='Q_001').length,1);
  }finally{await f.app.close();}
});
test('后台校验同店反向价差，改价和上下架影响下一次服务端结算',async()=>{
  const f=await fixture();try{
    const world=await f.repo.world(),trade=world.buildings.find(b=>b.id==='B_TRADE')!;
    trade.stock.WATER_01.baseSellPrice=20;assert.throws(()=>validateWorld(world),{code:'INVALID_SPREAD'});
    trade.stock.WATER_01.baseSellPrice=5;const admin={authorization:`Bearer ${env.adminToken}`};
    const draft=(await f.app.inject({method:'POST',url:'/admin/releases',headers:admin,payload:{config:world,basedOn:world.configVersion}})).json();
    for(const status of ['TEST','PUBLISHED'])assert.equal((await f.app.inject({method:'POST',url:`/admin/releases/${draft.id}/transition`,headers:admin,payload:{status}})).statusCode,200);
    f.player.inventory.WATER_01=1;const sold=await f.sell();assert.equal(sold.json().trade.actualUnitPrice,5);
    f.repo.versions.find(v=>v.status==='PUBLISHED')!.config.buildings.find(b=>b.id==='B_TRADE')!.stock.WATER_01.enabled=false;
    assert.equal((await f.sell()).json().code,'SHOP_ITEM_DISABLED');
  }finally{await f.app.close();}
});
test('商行增量迁移保留旧报价，下架状态与旧玩家物品；再次调用幂等',async()=>{
  const repo=new MemoryRepository(),world=repo.versions[0].config,trade=world.buildings.find(b=>b.id==='B_TRADE')!;
  trade.stock=Object.fromEntries(Object.entries(trade.stock).filter(([id])=>['RICE_01','SNACK_01'].includes(id)));
  trade.stock.RICE_01.sell=19;trade.stock.RICE_01.baseSellPrice=19;trade.stock.RICE_01.buy=22;trade.stock.RICE_01.baseBuyPrice=22;trade.stock.RICE_01.enabled=false;
  assert.equal((await ensureTradeShop(repo)).published,true);
  const live=(await repo.world()).buildings.find(b=>b.id==='B_TRADE')!;
  assert.equal(live.stock.RICE_01.baseSellPrice,19);assert.equal(live.stock.RICE_01.enabled,false);
  assert.equal(Object.keys(live.stock).length,6);assert.equal(live.clerkNpcId,'NPC_TRADE_CLERK');assert.equal(live.servicePointId,'TRADE_SERVICE');
  assert.equal((await ensureTradeShop(repo)).published,false);
});
test('共享控制器的商行买卖报价、页签、结算后余额与背包立即刷新',async()=>{
  const f=await fixture();try{
    const controller=new GameController(async(url,body)=>{const r=await f.app.inject({url,method:body?'POST':'GET',headers:f.headers,payload:body as any});if(r.statusCode>=400)throw Object.assign(new Error(r.json().message),{status:r.statusCode});return r.json();});
    await controller.refresh();await controller.openShop();assert.equal(controller.shopPanel()?.items.length,6);
    controller.setShopTab('sell');assert.equal(controller.shopTab,'sell');f.player.inventory.WATER_01=2;
    await controller.refresh();await controller.openShop();await controller.trade('sell','WATER_01',2);
    assert.equal(controller.player?.inventory.WATER_01,undefined);assert.equal(controller.player?.cash,128);
    assert.match(controller.message,/收入：8文/);
  }finally{await f.app.close();}
});
