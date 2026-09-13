import type {Repository} from './repository.js';
import {groceryItems,groceryStock,groceryBinding} from '../../../packages/game-config/grocery.js';
import {validateWorld} from './config.js';

/** One-time additive staging migration; never resets later operator prices or delistings. */
export async function ensureGroceryShop(repo:Repository){
  const previous=await repo.world(),shop=previous.buildings.find(b=>b.id==='B_GROCERY');
  if(!shop)return {published:false,version:previous.configVersion};
  const serviceZone=previous.scenes.find(s=>s.id===shop.interiorSceneId)?.interior?.zones.some(z=>z.id===groceryBinding.servicePointId&&z.kind==='servicePoint')??false;
  const catalogReady=groceryItems.every(item=>previous.items.some(existing=>existing.id===item.id)&&!!shop.stock[item.id]);
  const inventoryV11Ready=previous.items.every(item=>item.basePrice===undefined&&(!item.usable||!!item.effectType))&&previous.buildings.every(building=>Object.values(building.stock).every(offer=>offer.baseBuyPrice!==undefined&&offer.baseSellPrice!==undefined&&!!offer.pricingMode&&!!offer.stockMode&&offer.stockMode!=='infinite'));
  if(catalogReady&&inventoryV11Ready&&shop.clerkNpcId===groceryBinding.clerkNpcId&&(serviceZone?shop.servicePointId===groceryBinding.servicePointId:!shop.servicePointId))
    return {published:false,version:previous.configVersion};
  const items=[...previous.items.map(i=>{const {basePrice:_,...rest}=i;return {...groceryItems.find(n=>n.id===i.id),...rest,category:i.category==='HOUSEHOLD'?'DAILY' as const:i.category,usable:!!i.effectType&&i.usable===true,questItem:i.questItem??i.questOnly,stackable:i.stackable??i.stackMax>1,droppable:i.droppable??!(i.questOnly||i.questItem||i.keyItem)};}),...groceryItems.filter(i=>!previous.items.some(n=>n.id===i.id))];
  const migrateStock=(stock:typeof shop.stock)=>Object.fromEntries(Object.entries(stock).map(([id,offer])=>[id,{...offer,baseBuyPrice:offer.baseBuyPrice??offer.buy,baseSellPrice:offer.baseSellPrice??offer.sell,canBuy:offer.canBuy??true,canSell:offer.canSell??true,stockMode:offer.stockMode==='infinite'?'INFINITE' as const:offer.stockMode??'INFINITE' as const,pricingMode:offer.pricingMode??'FIXED' as const}]));
  const stock=migrateStock({...groceryStock,...Object.fromEntries(Object.entries(shop.stock).map(([id,offer])=>[id,{...groceryStock[id],...offer,baseBuyPrice:offer.baseBuyPrice??offer.buy,baseSellPrice:offer.baseSellPrice??offer.sell}]))});
  const npcs=previous.npcs.map(n=>n.id===groceryBinding.clerkNpcId?{...n,dialogue:n.dialogue.map(line=>line==='鸣山大米十二文一袋，需要的话可以直接买。'?'日常吃用的东西都在柜台这边，可以看看商品。':line)}:n);
  // Older published interiors have no semantic zones. Keep the NPC purchase
  // entrance until a separate scene release adds the actual counter zone.
  const binding={clerkNpcId:groceryBinding.clerkNpcId,servicePointId:serviceZone?groceryBinding.servicePointId:undefined};
  const config=validateWorld({...previous,items,npcs,buildings:previous.buildings.map(b=>b.id===shop.id?{...b,...binding,stock}:{...b,stock:migrateStock(b.stock)})},previous);
  const draft=await repo.draft(config,previous.configVersion);await repo.transition(draft.id,'TEST');
  const release=await repo.transition(draft.id,'PUBLISHED');return {published:true,version:release.version};
}
