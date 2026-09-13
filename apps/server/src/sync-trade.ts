import {initialWorld} from '../../../packages/game-config/index.js';
import type {Repository} from './repository.js';
import {validateWorld} from './config.js';

/** Add newly introduced trade listings without changing existing operator quotes or delistings. */
export async function ensureTradeShop(repo:Repository){
  const previous=await repo.world(),shop=previous.buildings.find(b=>b.id==='B_TRADE');
  const defaults=initialWorld.buildings.find(b=>b.id==='B_TRADE');
  if(!shop||!defaults)return {published:false,version:previous.configVersion};
  const additions=Object.entries(defaults.stock).filter(([id])=>!shop.stock[id]&&previous.items.some(item=>item.id===id));
  const zone=previous.scenes.find(scene=>scene.id===shop.interiorSceneId)?.interior?.zones.some(z=>z.id==='TRADE_SERVICE'&&z.kind==='servicePoint');
  const binding={clerkNpcId:'NPC_TRADE_CLERK',...(zone?{servicePointId:'TRADE_SERVICE'}:{})};
  const quest=previous.quests.find(q=>q.id==='Q_001');
  const needsQuestBinding=!!quest?.steps.some(step=>['BUY','SELL'].includes(step.type)&&!step.shopId);
  if(!additions.length&&shop.clerkNpcId===binding.clerkNpcId&&shop.servicePointId===binding.servicePointId&&!needsQuestBinding)return {published:false,version:previous.configVersion};
  const config=validateWorld({...previous,buildings:previous.buildings.map(b=>b.id===shop.id?{...b,...binding,stock:{...b.stock,...Object.fromEntries(additions)}}:b),quests:previous.quests.map(q=>q.id==='Q_001'?{...q,steps:q.steps.map(step=>step.type==='BUY'?{...step,shopId:'B_GROCERY'}:step.type==='SELL'?{...step,shopId:'B_TRADE'}:step)}:q)},previous);
  const draft=await repo.draft(config,previous.configVersion);await repo.transition(draft.id,'TEST');
  const release=await repo.transition(draft.id,'PUBLISHED');return {published:true,version:release.version};
}
