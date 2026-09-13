import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../apps/server/src/app.js';
import {MemoryRepository} from '../apps/server/src/repository.js';
import {validateWorld} from '../apps/server/src/config.js';
import {ensureGroceryShop} from '../apps/server/src/sync-grocery.js';
import {GameController} from '../packages/client-runtime/index.js';
const env={mode:'development',appEnv:'DEV',port:0,jwtSecret:'test-jwt-secret-at-least-32-characters',subjectSecret:'test-subject-secret-at-least-32-characters',adminToken:'test-admin-token-at-least-32-characters',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost',assetBase:'http://localhost/assets'};
async function fixture(){
 const repo=new MemoryRepository(),app=await buildApp(repo,env);
 const auth=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'grocery-test'}})).json(),headers={authorization:`Bearer ${auth.token}`};
 const post=(url:string,payload:object)=>app.inject({method:'POST',url,headers,payload});
 await post('/v1/player/appearance/create',{requestId:randomUUID(),gender:'FEMALE'});
 const p=repo.players.get(auth.player.id)!;p.sceneId='INTERIOR_B_GROCERY';p.x=12;p.y=12.5;
 const buy=(overrides:object={})=>post('/v1/economy/buy',{requestId:randomUUID(),buildingId:'B_GROCERY',itemId:'WATER_01',quantity:1,...overrides});
 return {repo,app,headers,p,post,buy};
}
test('商品目录、数量购买、余额、背包和重登恢复',async()=>{
 const f=await fixture();try{
 const catalog=await f.app.inject({url:'/v1/economy/catalog/B_GROCERY',headers:f.headers});assert.equal(catalog.statusCode,200);assert.equal(catalog.json().items.length,10);
 const result=await f.buy({quantity:3});assert.equal(result.statusCode,200);assert.equal(result.json().player.cash,102);assert.equal(result.json().player.inventory.WATER_01,3);
 const login=(await f.app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'grocery-test'}})).json();assert.equal(login.player.inventory.WATER_01,3);assert.equal(login.player.cash,102);
 }finally{await f.app.close();}
});
for(const [label,body,code] of [
 ['零数量',{quantity:0},'INVALID_QUANTITY'],['负数',{quantity:-1},'INVALID_QUANTITY'],['小数',{quantity:1.5},'INVALID_QUANTITY'],['超量',{quantity:100},'INVALID_QUANTITY'],
 ['未知商品',{itemId:'UNKNOWN_01'},'SHOP_ITEM_NOT_LISTED'],['不属于店铺',{itemId:'ERRAND_PACKAGE_01'},'SHOP_ITEM_NOT_LISTED'],['伪造价格',{totalPrice:0},'INVALID_INPUT'],['钱不足',{quantity:99},'INSUFFICIENT_CASH'],['店铺错误',{buildingId:'B_TRADE'},'WRONG_SHOP']
] as const)test(label,async()=>{const f=await fixture();try{const r=await f.buy(body);assert.equal(r.json().code,code);assert.equal((await f.repo.player(f.p.id)).cash,120);assert.deepEqual((await f.repo.player(f.p.id)).inventory,{});}finally{await f.app.close();}});
test('叠加上限与背包上限失败不扣款',async()=>{const f=await fixture();try{f.p.inventory.WATER_01=99;assert.equal((await f.buy()).json().code,'BAG_FULL');f.p.inventory={RICE_01:99,MILK_01:1};assert.equal((await f.buy()).json().code,'BAG_FULL');assert.equal((await f.repo.player(f.p.id)).cash,120);}finally{await f.app.close();}});
test('相同 requestId 并发只交易一次，改变内容冲突',async()=>{const f=await fixture();try{const requestId=randomUUID(),results=await Promise.all(Array.from({length:8},()=>f.buy({requestId})));for(const r of results)assert.deepEqual(r.json(),results[0].json());assert.equal((await f.repo.player(f.p.id)).cash,114);assert.equal((await f.repo.player(f.p.id)).inventory.WATER_01,1);assert.equal((await f.buy({requestId,quantity:2})).json().code,'REQUEST_CONFLICT');}finally{await f.app.close();}});
test('后台发布改价、全局下架与店铺下架，下一次读取立即生效',async()=>{const f=await fixture();try{
 const w=await f.repo.world();w.buildings.find(b=>b.id==='B_GROCERY')!.stock.WATER_01.buy=17;
 const admin={authorization:`Bearer ${env.adminToken}`};const draft=(await f.app.inject({method:'POST',url:'/admin/releases',headers:admin,payload:{config:w,basedOn:w.configVersion}})).json();assert.ok(draft.id);
 for(const status of ['TEST','PUBLISHED'])assert.equal((await f.app.inject({method:'POST',url:`/admin/releases/${draft.id}/transition`,headers:admin,payload:{status}})).statusCode,200);
 assert.equal((await f.app.inject({url:'/v1/economy/catalog/B_GROCERY',headers:f.headers})).json().building.stock.WATER_01.buy,17);assert.equal((await f.buy()).json().player.cash,103);
 const live=f.repo.versions.find(v=>v.status==='PUBLISHED')!.config;live.items.find(i=>i.id==='WATER_01')!.enabled=false;assert.equal((await f.buy()).json().code,'ITEM_DISABLED');live.items.find(i=>i.id==='WATER_01')!.enabled=true;live.buildings.find(b=>b.id==='B_GROCERY')!.stock.WATER_01.enabled=false;assert.equal((await f.buy()).json().code,'SHOP_ITEM_DISABLED');
 }finally{await f.app.close();}});
test('无限库存忽略旧每日额度；大米 BUY 与 SELL 任务兼容',async()=>{const f=await fixture();try{
 const stock=f.repo.versions[0].config.buildings.find(b=>b.id==='B_GROCERY')!.stock;stock.RICE_01.dailyLimit=1;
 assert.equal((await f.buy({itemId:'RICE_01',quantity:2})).statusCode,200);
 const quests=(await f.app.inject({url:'/v1/quests',headers:f.headers})).json().quests;assert.ok(quests.find((q:any)=>q.id==='Q_001').stepProgress[0]>=1);
 f.repo.players.get(f.p.id)!.sceneId='INTERIOR_B_TRADE';const sold=await f.post('/v1/economy/sell',{requestId:randomUUID(),buildingId:'B_TRADE',itemId:'RICE_01',quantity:1});assert.equal(sold.statusCode,200);assert.equal(sold.json().player.cash,132);assert.ok(sold.json().player.ledger.some((l:any)=>l.type==='QUEST_REWARD'&&l.referenceId==='Q_001'));
 }finally{await f.app.close();}});
test('旧配置迁移仅执行一次，运营改价与下架不会被重置',async()=>{const repo=new MemoryRepository(),w=repo.versions[0].config,b=w.buildings.find(b=>b.id==='B_GROCERY')!;delete b.servicePointId;delete b.clerkNpcId;w.items=w.items.filter(i=>!['WATER_01','MILK_01'].includes(i.id));delete b.stock.WATER_01;delete b.stock.MILK_01;b.stock.RICE_01.buy=19;assert.equal((await ensureGroceryShop(repo)).published,true);const live=repo.versions.find(v=>v.status==='PUBLISHED')!.config;assert.equal(live.buildings.find(b=>b.id==='B_GROCERY')!.stock.RICE_01.buy,19);live.buildings.find(b=>b.id==='B_GROCERY')!.stock.WATER_01.enabled=false;assert.equal((await ensureGroceryShop(repo)).published,false);});
test('staging 旧室内没有语义服务区时迁移不阻断启动，仍可经店员购买且只发布一次',async()=>{
 const repo=new MemoryRepository(),old=repo.versions[0].config,scene=old.scenes.find(s=>s.id==='INTERIOR_B_GROCERY')!,building=old.buildings.find(b=>b.id==='B_GROCERY')!;
 delete scene.interior;scene.collision=[{x:0,y:0,width:1,height:1}];delete building.servicePointId;delete building.clerkNpcId;
 old.items=old.items.filter(item=>item.id!=='WATER_01');delete building.stock.WATER_01;
 assert.equal((await ensureGroceryShop(repo)).published,true);
 const live=await repo.world(),shop=live.buildings.find(b=>b.id==='B_GROCERY')!;
 assert.equal(shop.servicePointId,undefined);assert.equal(shop.clerkNpcId,'NPC_GROCERY_CLERK');
 assert.deepEqual(live.scenes.find(s=>s.id===scene.id)!.collision,scene.collision);
 assert.equal((await ensureGroceryShop(repo)).published,false);
 const app=await buildApp(repo,env);try{assert.equal((await app.inject({url:'/healthz'})).statusCode,200);assert.equal((await app.inject({url:'/readyz'})).statusCode,200);}finally{await app.close();}
});
test('后台保护稳定 ID、非法价格和图标绝对 URL',async()=>{const repo=new MemoryRepository(),w=await repo.world();const renamed=structuredClone(w);renamed.items[0].id='RENAMED';assert.throws(()=>validateWorld(renamed,w));const bad=structuredClone(w);bad.items[0].iconResourceId='https://vendor/image.png';assert.throws(()=>validateWorld(bad,w));w.buildings[1].stock.RICE_01.buy=-1;assert.throws(()=>validateWorld(w));});
test('共享控制器：柜台打开、最新价格、数量、快速连点与简洁结果',async()=>{const f=await fixture();try{
 const controller=new GameController(async(url,body)=>{const r=await f.app.inject({url,method:body?'POST':'GET',headers:f.headers,payload:body as any});if(r.statusCode>=400)throw Object.assign(new Error(r.json().message),{status:r.statusCode});return r.json();});await controller.refresh();assert.equal(controller.canUseShop(),true);await controller.openShop();assert.equal(controller.shopPanel()?.items.length,10);controller.setShopQuantity('WATER_01',2);assert.equal(controller.shopQuantities.WATER_01,3);await Promise.all([controller.trade('buy','WATER_01',3),controller.trade('buy','WATER_01',3)]);assert.equal(controller.player?.cash,102);assert.equal(controller.message.split('\n').length,3);assert.equal(controller.itemName('WATER_01'),'饮用水');
 const x=controller.x;controller.tick(.05,1,0);assert.equal(controller.x,x);controller.closeShop();
 }finally{await f.app.close();}});
test('全局下架后再次打开面板不会复用旧上架数据',async()=>{const f=await fixture();try{const c=new GameController(async(url,body)=>{const r=await f.app.inject({url,method:body?'POST':'GET',headers:f.headers,payload:body as any});return r.json();});await c.refresh();await c.openShop();assert.ok(c.shopPanel()?.items.some(i=>i.id==='WATER_01'));c.closeShop();f.repo.versions[0].config.items.find(i=>i.id==='WATER_01')!.enabled=false;await c.openShop();assert.equal(c.shopPanel()?.items.some(i=>i.id==='WATER_01'),false);}finally{await f.app.close();}});
test('店铺停用拒绝交易；缺省新字段的旧商品继续可买',async()=>{const f=await fixture();try{const w=f.repo.versions[0].config,b=w.buildings.find(b=>b.id==='B_GROCERY')!;b.enabled=false;assert.equal((await f.buy()).json().code,'WRONG_SHOP');b.enabled=true;const item=w.items.find(i=>i.id==='WATER_01')!;delete item.enabled;delete item.description;delete item.category;delete item.usable;delete b.stock.WATER_01.enabled;assert.equal((await f.buy()).statusCode,200);}finally{await f.app.close();}});
