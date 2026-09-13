import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../apps/server/src/app.js';
import {MemoryRepository} from '../apps/server/src/repository.js';
import {validateWorld} from '../apps/server/src/config.js';
import {ensureGroceryShop} from '../apps/server/src/sync-grocery.js';
import {GameController} from '../packages/client-runtime/index.js';
import {fixedShopPrice,inventoryEntries,itemCategory,itemStackLimit,requireSupportedStockMode} from '../packages/game-rules/inventory.js';
const env={mode:'development',appEnv:'DEV',port:0,jwtSecret:'test-jwt-secret-at-least-32-characters',subjectSecret:'test-subject-secret-at-least-32-characters',adminToken:'test-admin-token-at-least-32-characters',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost',assetBase:'http://localhost/assets'};
async function fixture(){
  const repo=new MemoryRepository(),app=await buildApp(repo,env);
  const auth=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'inventory-v11'}})).json();
  const headers={authorization:`Bearer ${auth.token}`};
  const post=(url:string,payload:object)=>app.inject({method:'POST',url,headers,payload});
  await post('/v1/player/appearance/create',{requestId:randomUUID(),gender:'FEMALE'});
  const player=repo.players.get(auth.player.id)!;
  return {repo,app,headers,post,player};
}
test('背包空态、分类排序和旧 itemId 存档仍可读取',async()=>{const f=await fixture();try{
  const empty=(await f.app.inject({url:'/v1/inventory',headers:f.headers})).json();assert.deepEqual(empty.items,[]);
  f.player.inventory={WATER_01:2,ERRAND_PACKAGE_01:1,RICE_01:3,UNKNOWN_OLD:1};
  const inventory=(await f.app.inject({url:'/v1/inventory',headers:f.headers})).json();
  assert.deepEqual(inventory.items.map((i:any)=>i.id),['ERRAND_PACKAGE_01','RICE_01','WATER_01','UNKNOWN_OLD']);
  assert.equal(inventory.items[3].name,'未知物品');assert.equal(inventory.items[1].quantity,3);
  assert.equal((await f.app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'inventory-v11'}})).json().player.inventory.RICE_01,3);
}finally{await f.app.close();}});
test('共享控制器购买与出售后背包立即更新，Web/微信读取同一结果',async()=>{const f=await fixture();try{
  f.player.sceneId='INTERIOR_B_GROCERY';f.player.x=12;f.player.y=12.5;
  const controller=new GameController(async(url,body)=>{const response=await f.app.inject({url,method:body?'POST':'GET',headers:f.headers,payload:body as any});if(response.statusCode>=400)throw Object.assign(new Error(response.json().message),{status:response.statusCode});return response.json();});
  await controller.refresh();await controller.trade('buy','WATER_01',2);
  assert.equal(controller.inventoryItems().find(item=>item.id==='WATER_01')?.quantity,2);
  await controller.trade('sell','WATER_01',1);
  assert.equal(controller.inventoryItems().find(item=>item.id==='WATER_01')?.quantity,1);
  assert.equal((await f.app.inject({url:'/v1/inventory',headers:f.headers})).json().items.find((item:any)=>item.id==='WATER_01').quantity,1);
}finally{await f.app.close();}});
test('物品身份与店铺价格分层，同一米在两店报价不同',async()=>{const f=await fixture();try{
  const world=await f.repo.world(),rice=world.items.find(i=>i.id==='RICE_01')!;
  assert.equal(rice.basePrice,undefined);assert.equal(itemCategory(rice),'FOOD');
  assert.equal(fixedShopPrice(world.buildings.find(b=>b.id==='B_GROCERY')!.stock.RICE_01,'buy'),12);
  assert.equal(fixedShopPrice(world.buildings.find(b=>b.id==='B_TRADE')!.stock.RICE_01,'buy'),18);
  assert.equal(itemStackLimit(world.items.find(i=>i.id==='ERRAND_PACKAGE_01')!),1);
}finally{await f.app.close();}});
test('没有正式效果的食品不能使用；任务物品也不能普通使用或出售',async()=>{const f=await fixture();try{
  f.player.inventory={WATER_01:1,ERRAND_PACKAGE_01:1};
  const water=await f.post('/v1/inventory/use',{requestId:randomUUID(),itemId:'WATER_01',quantity:1});assert.equal(water.json().code,'ITEM_NOT_USABLE');
  const quest=await f.post('/v1/inventory/use',{requestId:randomUUID(),itemId:'ERRAND_PACKAGE_01',quantity:1});assert.equal(quest.json().code,'ITEM_NOT_USABLE');
  assert.equal(f.player.inventory.WATER_01,1);assert.equal(f.player.inventory.ERRAND_PACKAGE_01,1);
}finally{await f.app.close();}});
test('使用物品由服务端执行效果再扣除，同请求号重试只扣一次',async()=>{const f=await fixture();try{
  const water=f.repo.versions[0].config.items.find(i=>i.id==='WATER_01')!;
  water.usable=true;water.effectType='ENERGY';water.effectValue=10;f.player.stamina=50;f.player.inventory.WATER_01=2;
  const payload={requestId:randomUUID(),itemId:'WATER_01',quantity:1};
  const first=await f.post('/v1/inventory/use',payload),repeat=await f.post('/v1/inventory/use',payload);
  assert.equal(first.statusCode,200);assert.deepEqual(repeat.json(),first.json());
  assert.equal((await f.repo.player(f.player.id)).stamina,60);assert.equal((await f.repo.player(f.player.id)).inventory.WATER_01,1);
  assert.equal((await f.post('/v1/inventory/use',{...payload,quantity:2})).json().code,'REQUEST_CONFLICT');
}finally{await f.app.close();}});
test('效果失败不扣物品；未知、停用、无物品、非法数量有明确错误',async()=>{const f=await fixture();try{
  const water=f.repo.versions[0].config.items.find(i=>i.id==='WATER_01')!;
  water.usable=true;water.effectType='ENERGY';water.effectValue=10;f.player.inventory.WATER_01=1;f.player.stamina=100;
  const use=(itemId:string,quantity=1)=>f.post('/v1/inventory/use',{requestId:randomUUID(),itemId,quantity});
  assert.equal((await use('WATER_01')).json().code,'EFFECT_FAILED');assert.equal(f.player.inventory.WATER_01,1);
  assert.equal((await use('MISSING_01')).json().code,'UNKNOWN_ITEM');
  water.enabled=false;assert.equal((await use('WATER_01')).json().code,'ITEM_DISABLED');water.enabled=true;
  delete f.player.inventory.WATER_01;assert.equal((await use('WATER_01')).json().code,'ITEM_NOT_OWNED');
  assert.equal((await use('WATER_01',0)).json().code,'INVALID_QUANTITY');
}finally{await f.app.close();}});
test('库存和定价预留模式可校验，但运行时安全拒绝未实现模式',async()=>{const f=await fixture();try{
  const world=structuredClone(await f.repo.world()),offer=world.buildings.find(b=>b.id==='B_GROCERY')!.stock.WATER_01;
  for(const mode of ['PLAYER_PRIVATE','GLOBAL_LIMITED'] as const){offer.stockMode=mode;assert.doesNotThrow(()=>validateWorld(world));assert.throws(()=>requireSupportedStockMode(offer));}
  offer.stockMode='INFINITE';offer.pricingMode='MARKET_DYNAMIC';assert.doesNotThrow(()=>validateWorld(world));assert.throws(()=>fixedShopPrice(offer,'buy'));
}finally{await f.app.close();}});
test('旧版 world 一次性迁移报价，保留已调价格、下架与店员入口',async()=>{
  const repo=new MemoryRepository(),world=repo.versions[0].config,grocery=world.buildings.find(b=>b.id==='B_GROCERY')!;
  const trade=world.buildings.find(b=>b.id==='B_TRADE')!;trade.stock=Object.fromEntries(Object.entries(trade.stock).filter(([id])=>['RICE_01','SNACK_01'].includes(id)));
  for(const offer of Object.values(trade.stock)){offer.buy=offer.baseBuyPrice;offer.sell=offer.baseSellPrice;}
  grocery.stock.RICE_01.buy=19;grocery.stock.RICE_01.enabled=false;
  for(const item of world.items)item.basePrice=1;
  for(const building of world.buildings)for(const offer of Object.values(building.stock)){delete offer.baseBuyPrice;delete offer.baseSellPrice;delete offer.pricingMode;offer.stockMode='infinite';}
  assert.equal((await ensureGroceryShop(repo)).published,true);
  const live=await repo.world(),offer=live.buildings.find(b=>b.id==='B_GROCERY')!.stock.RICE_01;
  assert.equal(offer.baseBuyPrice,19);assert.equal(offer.enabled,false);assert.equal(live.items.some(item=>item.basePrice!==undefined),false);
  assert.equal((await ensureGroceryShop(repo)).published,false);
});
