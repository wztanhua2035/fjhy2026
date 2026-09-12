import type { Appearance, PlayerState, WorldConfig, SceneView, PlotConfig, EntranceConfig, LedgerEntry, QuestConfig, QuestStepConfig } from '../shared-types/index.js';
import { starterLookOptions } from '../game-config/appearance-v1.js';
export class GameError extends Error { constructor(public code:string, message:string, public status=400){super(message)} }
export function ensure(ok:unknown, code:string, message:string, status=400): asserts ok { if(!ok) throw new GameError(code,message,status); }
export function minutesAt(now:Date){return (now.getUTCHours()*60+now.getUTCMinutes()+480)%1440;}
export function isOpen(hours:[string,string],now:Date,forceOpen=false){if(forceOpen)return true;const m=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));const [a,b]=hours.map(m),t=minutesAt(now);return a===b|| (a<b ? t>=a&&t<b : t>=a||t<b);}
export function phaseAt(now:Date){const h=minutesAt(now)/60;return h<6?'深夜':h<9?'清晨':h<17?'日间':h<20?'傍晚':'夜晚';}
export function starterAppearance(world:WorldConfig,gender:'MALE'|'FEMALE',baseAvatarId:string,colors:{skinColorId?:string;hairColorId:string;topColorId:string;bottomColorId:string}):Appearance{
  ensure(world.appearances.some(a=>a.id===baseAvatarId&&a.partType==='BASE'&&a.genderScope===gender&&a.enabled),'BAD_AVATAR','请选择有效基础形象');
  for(const color of Object.values(colors)) if(color) ensure(Object.hasOwn(world.colors,color),'BAD_COLOR','配色不存在');
  return {gender,baseAvatarId,skinColorId:colors.skinColorId??'SKIN_LIGHT',hairStyleId:`HAIR_${gender}_01`,topStyleId:`TOP_${gender}_01`,bottomStyleId:`BOTTOM_${gender}_01`,shoesId:`SHOES_${gender}_01`,accessoryIds:[],...colors};
}
export function inEntranceArea(entrance:EntranceConfig,x:number,y:number){const r=entrance.interactionArea;return x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height;}
export function plotEntrances(plot:PlotConfig): EntranceConfig[]{
  return plot.entrances?.length ? plot.entrances : [{id:`${plot.id}_PRIMARY`,position:{x:plot.entranceX,y:plot.entranceY},direction:'south',interactionArea:{x:plot.entranceX-.9,y:plot.entranceY-.9,width:1.8,height:1.8},targetScene:'',targetSpawnPoint:{x:0,y:0}}];
}
export function sceneView(world:WorldConfig,id:string,now:Date,forceOpen=false):SceneView{
  const scene=world.scenes.find(s=>s.id===id);ensure(scene,'SCENE_NOT_FOUND','场景不存在',404);
  const plots=world.plots.filter(p=>p.sceneId===id);
  const occupancy=scene.buildingId?world.plots.find(p=>p.buildingId===scene.buildingId):undefined;
  const entrances=occupancy?plotEntrances(occupancy):[];const entrance=entrances[0];
  const configuredScene=occupancy&&entrance?{...scene,portals:scene.portals.map(p=>{if(!p.returnEntranceId)return p;const target=entrances.find(e=>e.id===p.returnEntranceId)??entrance;return {...p,toSceneId:occupancy.sceneId,spawnX:target.position.x,spawnY:target.position.y+1};})}:scene;
  return {scene:configuredScene,plots,buildings:world.buildings.filter(b=>b.enabled&&(plots.some(p=>p.buildingId===b.id)||b.id===scene.buildingId)),items:world.items,
    npcs:world.npcs.filter(n=>n.enabled&&n.sceneId===id&&isOpen(n.hours,now,forceOpen)).sort((a,b)=>b.priority-a.priority).slice(0,8),phase:phaseAt(now)};
}
// The portrait is taller than one map tile. Keep the collision body aligned with
// the visible torso and legs so players cannot appear to walk through an NPC.
export function npcCollisionRect(n:{x:number;y:number}){return {x:n.x-.5,y:n.y-.72,width:1,height:1.44};}
export function canStand(world:WorldConfig,sceneId:string,x:number,y:number){
  const s=world.scenes.find(s=>s.id===sceneId);if(!s||x<1||y<1||x>s.width-1||y>s.height-1)return false;
  const staticBlocks=[...s.collision,...world.plots.filter(p=>p.sceneId===sceneId&&p.buildingId)];const npcBlocks=world.npcs.filter(n=>n.enabled&&n.sceneId===sceneId).map(npcCollisionRect);return !staticBlocks.some(r=>x>r.x-.18&&x<r.x+r.width+.18&&y>r.y-.18&&y<r.y+r.height+.18)&&!npcBlocks.some(r=>x>r.x&&x<r.x+r.width&&y>r.y&&y<r.y+r.height);
}
export interface StarterLookSelection { skinToneId?: string; hairId?: string; outfitId?: string }
export function createStarterAppearance(gender:'MALE'|'FEMALE', selection:StarterLookSelection):Appearance {
  const options=starterLookOptions(gender);
  const skin=selection.skinToneId??options.skins[0].id;
  const hair=selection.hairId??options.hairs[0]?.id;
  const outfit=selection.outfitId??options.outfits[0]?.id;
  ensure(options.skins.some(s=>s.id===skin),'BAD_SKIN','肤色不存在');
  ensure(options.hairs.some(h=>h.id===hair),'BAD_HAIR','发型不存在');
  ensure(options.outfits.some(o=>o.id===outfit),'BAD_OUTFIT','服装不存在');
  // The database's existing non-null columns encode the complete IDs until a
  // future additive schema migration. Deprecated colors are storage defaults.
  return {gender,baseAvatarId:`${gender}_01`,skinToneId:skin,hairId:hair,outfitId:outfit,
    skinColorId:skin,hairStyleId:hair,hairColorId:'INK',topStyleId:outfit,topColorId:'SAGE',
    bottomStyleId:`BOTTOM_${gender}_01`,bottomColorId:'BLUE',shoesId:`SHOES_${gender}_01`,accessoryIds:[]};
}
export function formalizeAppearance(appearance:Appearance):Appearance {
  const options=starterLookOptions(appearance.gender);
  return {...appearance,skinToneId:options.skins.some(s=>s.id===(appearance.skinToneId??appearance.skinColorId))?(appearance.skinToneId??appearance.skinColorId):appearance.skinColorId==='SKIN_DEEP'?'SKIN_HONEY':options.skins[0].id,
    hairId:options.hairs.some(h=>h.id===(appearance.hairId??appearance.hairStyleId))?(appearance.hairId??appearance.hairStyleId):options.hairs[0].id,
    outfitId:options.outfits.some(o=>o.id===(appearance.outfitId??appearance.topStyleId))?(appearance.outfitId??appearance.topStyleId):options.outfits[0].id};
}
export function positionBlockers(world:WorldConfig,sceneId:string,x:number,y:number){
  const scene=world.scenes.find(s=>s.id===sceneId);
  if(!scene)return ['SCENE_NOT_FOUND'];
  const hits:string[]=[];
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<1||y<1||x>scene.width-1||y>scene.height-1)hits.push('OUT_OF_BOUNDS');
  for(const [index,r] of scene.collision.entries())if(x>r.x-.18&&x<r.x+r.width+.18&&y>r.y-.18&&y<r.y+r.height+.18)hits.push(`scene.collision[${index}](${r.x},${r.y},${r.width},${r.height})`);
  for(const plot of world.plots.filter(p=>p.sceneId===sceneId&&p.buildingId))if(x>plot.x-.18&&x<plot.x+plot.width+.18&&y>plot.y-.18&&y<plot.y+plot.height+.18)hits.push(`plot:${plot.id}`);
  for(const npc of world.npcs.filter(n=>n.enabled&&n.sceneId===sceneId)){const r=npcCollisionRect(npc);if(x>r.x&&x<r.x+r.width&&y>r.y&&y<r.y+r.height)hits.push(`npc:${npc.id}`);}
  return hits;
}

/** Resolve old save positions against the currently published scene collision. */
export function recoverSafePosition(world:WorldConfig,sceneId:string,x:number,y:number){
  if(canStand(world,sceneId,x,y))return {x,y,source:'saved' as const};
  const scene=world.scenes.find(s=>s.id===sceneId);ensure(scene,'SCENE_NOT_FOUND','场景不存在',404);
  const search=(cx:number,cy:number,maxRadius:number)=>{
    if(!Number.isFinite(cx)||!Number.isFinite(cy))return null;
    for(let radius=.5;radius<=maxRadius;radius+=.5){
      const candidates:{x:number;y:number;distance:number}[]=[];
      const offsets:{dx:number;dy:number}[]=[];
      for(let delta=-radius;delta<=radius;delta+=.5){
        offsets.push({dx:delta,dy:-radius},{dx:delta,dy:radius});
        if(delta!==-radius&&delta!==radius)offsets.push({dx:-radius,dy:delta},{dx:radius,dy:delta});
      }
      for(const {dx,dy} of offsets){
        const px=Math.round((cx+dx)*2)/2,py=Math.round((cy+dy)*2)/2;
        if(canStand(world,sceneId,px,py))candidates.push({x:px,y:py,distance:Math.hypot(px-cx,py-cy)});
      }
      candidates.sort((a,b)=>a.distance-b.distance||a.y-b.y||a.x-b.x);
      if(candidates[0])return candidates[0];
    }
    return null;
  };
  const nearby=search(x,y,8);
  if(nearby)return {x:nearby.x,y:nearby.y,source:'nearby' as const};
  if(canStand(world,sceneId,scene.spawnX,scene.spawnY))return {x:scene.spawnX,y:scene.spawnY,source:'spawn' as const};
  const fallback=search(scene.spawnX,scene.spawnY,Math.max(scene.width,scene.height));
  ensure(fallback,'NO_SAFE_POSITION','场景没有可站立位置',503);
  return {x:fallback.x,y:fallback.y,source:'spawn' as const};
}
export function publicPlayer(p:PlayerState){return {...p,appearance:p.appearance?formalizeAppearance(p.appearance):null,tradeCounts:{},storyFlags:p.storyFlags??{},ledger:p.ledger.slice(-20)};}
export function questStepLedgerType(type:QuestStepConfig['type']){return type==='BUY'?'SHOP_BUY':type==='SELL'?'SHOP_SELL':type==='ACQUIRE'?'QUEST_ITEM_ACQUIRED':type==='DELIVER'?'QUEST_ITEM_DELIVERED':'QUEST_REPORTED';}
export function questStepReference(questId:string,step:QuestStepConfig){return step.type==='BUY'||step.type==='SELL'?step.target:`${questId}:${step.target}`;}
export function questStepProgress(quest:QuestConfig,ledger:LedgerEntry[]){return quest.steps.map(step=>{const type=questStepLedgerType(step.type),reference=questStepReference(quest.id,step);return Math.min(step.count,ledger.filter(entry=>entry.type===type&&(step.type==='BUY'||step.type==='SELL'?entry.referenceId.includes(reference):entry.referenceId===reference)).length);});}
