import {isDeepStrictEqual} from 'node:util';
import {initialWorld} from '../../../packages/game-config/index.js';
import type {Repository} from './repository.js';
import {validateWorld} from './config.js';

/** Publish the two approved opening quests without replacing shops, prices or scenes. */
export async function ensureFirstDayQuests(repo:Repository){
  const previous=await repo.world();
  const quests=[...previous.quests.map(quest=>quest.id==='Q_002'?initialWorld.quests.find(source=>source.id==='Q_002')!:quest),...initialWorld.quests.filter(quest=>['Q_001','Q_002'].includes(quest.id)&&!previous.quests.some(old=>old.id===quest.id))];
  const npcs=previous.npcs.map(npc=>npc.id==='NPC_001'?{...npc,questId:'Q_002'}:npc.id==='NPC_TRADE_CLERK'?{...npc,questId:'Q_001'}:npc);
  const items=[...previous.items,...initialWorld.items.filter(item=>item.id==='ERRAND_PACKAGE_01'&&!previous.items.some(old=>old.id===item.id))];
  if(isDeepStrictEqual(quests,previous.quests)&&isDeepStrictEqual(npcs,previous.npcs)&&isDeepStrictEqual(items,previous.items))return {published:false,version:previous.configVersion};
  const config=validateWorld({...previous,quests,npcs,items},previous);
  const draft=await repo.draft(config,previous.configVersion);
  await repo.transition(draft.id,'TEST');
  const release=await repo.transition(draft.id,'PUBLISHED');
  return {published:true,version:release.version};
}
