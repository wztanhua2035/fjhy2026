import type {Repository} from './repository.js';
import {groceryItems,groceryStock,groceryBinding} from '../../../packages/game-config/grocery.js';
import {validateWorld} from './config.js';

/** One-time additive staging migration; never resets later operator prices or delistings. */
export async function ensureGroceryShop(repo:Repository){
  const previous=await repo.world(),shop=previous.buildings.find(b=>b.id==='B_GROCERY');
  if(!shop||shop.servicePointId)return {published:false,version:previous.configVersion};
  const items=[...previous.items.map(i=>({...groceryItems.find(n=>n.id===i.id),...i})),...groceryItems.filter(i=>!previous.items.some(n=>n.id===i.id))];
  const stock={...groceryStock,...Object.fromEntries(Object.entries(shop.stock).map(([id,s])=>[id,{...s,stockMode:'infinite' as const}]))};
  const npcs=previous.npcs.map(n=>n.id===groceryBinding.clerkNpcId?{...n,dialogue:n.dialogue.map(line=>line==='鸣山大米十二文一袋，需要的话可以直接买。'?'日常吃用的东西都在柜台这边，可以看看商品。':line)}:n);
  const config=validateWorld({...previous,items,npcs,buildings:previous.buildings.map(b=>b.id===shop.id?{...b,...groceryBinding,stock}:b)},previous);
  const draft=await repo.draft(config,previous.configVersion);await repo.transition(draft.id,'TEST');
  const release=await repo.transition(draft.id,'PUBLISHED');return {published:true,version:release.version};
}
