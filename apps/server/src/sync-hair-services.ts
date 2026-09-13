import {hairConfigs,hairServiceOffers} from '../../../packages/game-config/hair-services.js';
import type {Repository} from './repository.js';
import {validateWorld} from './config.js';

export async function ensureHairServices(repo:Repository){
  const previous=await repo.world();
  if(previous.hairs&&previous.hairServiceOffers)return {published:false,version:previous.configVersion};
  const config=validateWorld({...previous,hairs:previous.hairs??hairConfigs,hairServiceOffers:previous.hairServiceOffers??hairServiceOffers},previous);
  const draft=await repo.draft(config,previous.configVersion);await repo.transition(draft.id,'TEST');
  const release=await repo.transition(draft.id,'PUBLISHED');return {published:true,version:release.version};
}
