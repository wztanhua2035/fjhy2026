import {outfitConfigs,outfitOffers} from '../../../packages/game-config/outfits.js';
import type {Repository} from './repository.js';
import {validateWorld} from './config.js';

export async function ensureOutfits(repo:Repository){
  const previous=await repo.world();
  if(previous.outfits&&previous.outfitOffers)return {published:false,version:previous.configVersion};
  const config=validateWorld({...previous,outfits:previous.outfits??outfitConfigs,outfitOffers:previous.outfitOffers??outfitOffers},previous);
  const draft=await repo.draft(config,previous.configVersion);await repo.transition(draft.id,'TEST');
  const release=await repo.transition(draft.id,'PUBLISHED');return {published:true,version:release.version};
}
