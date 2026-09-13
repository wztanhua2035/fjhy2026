import type { ItemConfig, BuildingConfig } from '../shared-types/index.js';
/** V1 trial prices; preserve existing IDs and first-trade prices. */
const groceryCatalog = [
  ['RICE_01','鸣山大米','米',12,'FOOD','本地出产的大米，一袋家常滋味。',99],
  ['SNACK_01','横阳米糕','糕',8,'FOOD','软糯的街坊小点心。',99],
  ['WATER_01','饮用水','水',6,'DRINK','一瓶干净的饮用水。',99],
  ['MILK_01','牛奶','奶',15,'DRINK','适合早餐的盒装牛奶。',99],
  ['BREAD_01','面包','包',10,'FOOD','简单便携的面包。',99],
  ['BISCUIT_01','饼干','饼',8,'FOOD','一小包酥脆饼干。',99],
  ['NOODLE_01','泡面','面',12,'FOOD','忙碌时的便捷一餐。',99],
  ['TISSUE_01','纸巾','纸',20,'HOUSEHOLD','日常随身使用的纸巾。',99],
  ['UMBRELLA_01','雨伞','伞',60,'HOUSEHOLD','一把结实朴素的雨伞。',5],
  ['BATTERY_01','电池','电',30,'HOUSEHOLD','小设备备用电池。',99],
] as const;
export const groceryItems: ItemConfig[] = groceryCatalog.map(([id,name,icon,,category,description,stackMax])=>({id,name,icon,category:category==='HOUSEHOLD'?'DAILY':category,description,stackMax,stackable:true,giftable:true,enabled:true,usable:false,droppable:true}));
export const groceryStock: BuildingConfig['stock'] = Object.fromEntries(groceryCatalog.map(([id,,,price])=>[id,{buy:price,sell:id==='RICE_01'?8:id==='SNACK_01'?5:Math.floor(price/2),baseBuyPrice:price,baseSellPrice:id==='RICE_01'?8:id==='SNACK_01'?5:Math.floor(price/2),canBuy:true,canSell:true,dailyLimit:999,stockMode:'INFINITE',pricingMode:'FIXED',enabled:true}]));
export const groceryBinding = {clerkNpcId:'NPC_GROCERY_CLERK',servicePointId:'GROCERY_SERVICE'};
