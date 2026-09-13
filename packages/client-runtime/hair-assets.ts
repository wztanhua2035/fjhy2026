import {hairConfigs} from '../game-config/hair-services.js';
const root='/scene-layers/baishi/formal/hair-v1';
export const hairAssets=[
  ...(['male','female'] as const).map(g=>({key:`player-${g}-body-v1`,source:`${root}/player_${g}_body_v1.png`})),
  ...hairConfigs.map(h=>({key:h.assetResourceId,source:`${root}/${h.hairId.toLowerCase()}_v1.png`}))
];
export function resolvedHair(gender:'MALE'|'FEMALE',hairId?:string){return hairConfigs.find(h=>h.gender===gender&&h.hairId===hairId)??hairConfigs.find(h=>h.gender===gender)!;}
