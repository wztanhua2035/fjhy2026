import {isDeepStrictEqual} from 'node:util';
import {initialWorld} from '../../../packages/game-config/index.js';
import type {Repository} from './repository.js';
import {validateWorld} from './config.js';

/** Publish approved first-day quest content without replacing shops, prices or scenes. */
export async function ensureFirstDayQuests(repo:Repository){
  const previous=await repo.world();
  const questIds=new Set(['Q_001','Q_002','Q_003']);
  const quests=[...previous.quests.map(quest=>questIds.has(quest.id)?initialWorld.quests.find(source=>source.id===quest.id)!:quest),...initialWorld.quests.filter(quest=>questIds.has(quest.id)&&!previous.quests.some(old=>old.id===quest.id))];
  const npcs=previous.npcs.map(npc=>npc.id==='NPC_001'?{...npc,questId:'Q_002'}:npc.id==='NPC_TRADE_CLERK'?{...npc,questId:'Q_001'}:npc.id==='NPC_CLOTH_SHOPKEEPER'?{...npc,questId:'Q_003'}:npc);
  const items=[...previous.items,...initialWorld.items.filter(item=>['ERRAND_PACKAGE_01','CLOTH_SAMPLE_01'].includes(item.id)&&!previous.items.some(old=>old.id===item.id))];
  if(isDeepStrictEqual(quests,previous.quests)&&isDeepStrictEqual(npcs,previous.npcs)&&isDeepStrictEqual(items,previous.items))return {published:false,version:previous.configVersion};
  const config=validateWorld({...previous,quests,npcs,items},previous);
  const draft=await repo.draft(config,previous.configVersion);
  await repo.transition(draft.id,'TEST');
  const release=await repo.transition(draft.id,'PUBLISHED');
  return {published:true,version:release.version};
}
