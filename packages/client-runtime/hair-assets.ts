import {hairConfigs} from '../game-config/hair-services.js';
const root='/scene-layers/baishi/formal/hair-v3';
export const hairAssets=[
  ...(['male','female'] as const).map(g=>({key:`player-${g}-body-v3`,source:`${root}/player_${g}_body_v3.png`})),
  ...hairConfigs.map(h=>({key:h.assetResourceId,source:`${root}/${h.hairId.toLowerCase()}_v3.png`}))
];
export function resolvedHair(gender:'MALE'|'FEMALE',hairId?:string){return hairConfigs.find(h=>h.gender===gender&&h.hairId===hairId)??hairConfigs.find(h=>h.gender===gender)!;}
