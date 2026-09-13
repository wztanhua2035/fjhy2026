import {hairConfigs} from '../game-config/hair-services.js';
import {faceConfigs} from '../game-config/face-templates.js';
const root='/scene-layers/baishi/formal/face-v2';
const outfitRoot='/scene-layers/baishi/formal/outfit-v1';
export const hairAssets=[
  ...(['male','female'] as const).map(g=>({key:`player-${g}-body-v6`,source:`${outfitRoot}/player_${g}_body_v6.png`})),
  ...(['m','f'] as const).flatMap(g=>[1,2,3].map(n=>({key:`PLAYER_${g.toUpperCase()}_OUTFIT_0${n}`,source:`${outfitRoot}/${g}_outfit_0${n}_v1.png`}))),
  ...faceConfigs.map(f=>({key:f.assetResourceId,source:`${root}/${f.faceId.toLowerCase()}_v2.png`})),
  ...hairConfigs.map(h=>({key:h.assetResourceId,source:`/scene-layers/baishi/formal/hair-v3/${h.hairId.toLowerCase()}_v3.png`}))
];
export function resolvedHair(gender:'MALE'|'FEMALE',hairId?:string){return hairConfigs.find(h=>h.gender===gender&&h.hairId===hairId)??hairConfigs.find(h=>h.gender===gender)!;}
