import type {ItemCategory,ItemConfig,PlayerState,ShopListing} from '../shared-types/index.js';
import {ensure} from './index.js';

export const itemCategories:ItemCategory[]=['KEY','QUEST','FOOD','DRINK','DAILY','MATERIAL','GIFT','CLOTHING','SPECIAL'];
export const itemCategoryNames:Record<ItemCategory,string>={KEY:'重要物品',QUEST:'任务物品',FOOD:'食品',DRINK:'饮品',DAILY:'日用品',MATERIAL:'材料',GIFT:'礼物',CLOTHING:'服饰',SPECIAL:'其他'};
export function itemCategory(item:ItemConfig):ItemCategory{return item.keyItem?'KEY':item.questOnly||item.questItem?'QUEST':item.category==='HOUSEHOLD'?'DAILY':item.category??'SPECIAL';}
export function itemStackLimit(item:ItemConfig){return item.stackable===false?1:item.stackMax;}
export function inventoryEntries(player:PlayerState,items:ItemConfig[]){
  return Object.entries(player.inventory).filter(([,quantity])=>quantity>0).map(([id,quantity])=>{
    const item=items.find(candidate=>candidate.id===id);
    return {id,quantity,name:item?.name??'未知物品',icon:item?.icon??'物',iconResourceId:item?.iconResourceId,category:item?itemCategory(item):'SPECIAL' as ItemCategory,description:item?.description??'',usable:!!item?.usable&&!item.questOnly&&!item.questItem&&!item.keyItem,stackLimit:item?itemStackLimit(item):1,sortOrder:item?.sortOrder??0};
  }).sort((a,b)=>itemCategories.indexOf(a.category)-itemCategories.indexOf(b.category)||a.sortOrder-b.sortOrder||a.id.localeCompare(b.id));
}
export function fixedShopPrice(offer:ShopListing,side:'buy'|'sell'){
  ensure((offer.pricingMode??'FIXED')==='FIXED','INVALID_PRICING_MODE','当前商品报价暂不可用');
  // A legacy operator may still edit buy/sell directly in a published draft.
  const price=side==='buy'?(offer.buy??offer.baseBuyPrice):(offer.sell??offer.baseSellPrice);
  ensure(typeof price==='number'&&Number.isSafeInteger(price)&&price>0,'INVALID_PRICE','商品报价无效');
  return price!;
}
export function requireSupportedStockMode(offer:ShopListing){
  ensure(['INFINITE','infinite'].includes(offer.stockMode??'INFINITE'),'INVALID_STOCK_MODE','当前商品库存模式暂不可用');
}
/** Effect handlers run before quantity deduction inside the repository transaction. */
export function applyItemEffect(player:PlayerState,item:ItemConfig){
  ensure(item.usable&&!item.questOnly&&!item.questItem&&!item.keyItem,'ITEM_NOT_USABLE','该物品暂不可使用');
  if(item.effectType==='ENERGY'){
    const delta=item.effectValue;
    ensure(typeof delta==='number'&&Number.isFinite(delta)&&delta>0&&player.stamina<100,'EFFECT_FAILED','当前无法使用该物品');
    player.stamina=Math.min(100,player.stamina+delta);return;
  }
  ensure(false,'EFFECT_FAILED','该物品效果尚未开放');
}
