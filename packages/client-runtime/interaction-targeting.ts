import { npcCollisionRect } from '../game-rules/index.js';
/** Shared interaction targeting rules. World coordinates are always player feet. */
/** Embedded in the client bundle so the build can reject stale interaction code. */
export const INTERACTION_TARGETING_BUILD_MARKER = 'interaction-targeting-v3';
export type InteractionType='scripted'|'portal'|'entrance'|'npc'|'service'|'furniture';
export type InteractionDirection='up'|'down'|'left'|'right';
export interface InteractionRect {x:number;y:number;width:number;height:number}
export interface InteractionCandidate {
  id:string; type:InteractionType; label:string; path:string; body:Record<string,unknown>;
  anchor:{x:number;y:number}; radius?:number; zone?:InteractionRect; facingRequired?:boolean;
  distance:number; score:number;
}
export const interactionDefaults={
  /** Reach measured from the fixed collision rectangle, not the sprite or centre. */
  npcRadius:.8,
  /** Close to the NPC collision body, joystick direction must not block interaction. */
  npcCloseRadius:.5,
  furnitureRadius:.8,
  serviceRadius:.9,
  npcFacingConeDegrees:140,
  targetSwitchMargin:.15,
  targetStickinessSeconds:.25
} as const;
const priority:Record<InteractionType,number>={scripted:1000,portal:700,entrance:700,npc:500,service:400,furniture:300};
export function withinInteractionRect(point:{x:number;y:number},zone:InteractionRect){return point.x>=zone.x&&point.x<=zone.x+zone.width&&point.y>=zone.y&&point.y<=zone.y+zone.height;}
export function interactionDistance(point:{x:number;y:number},anchor:{x:number;y:number}){return Math.hypot(point.x-anchor.x,point.y-anchor.y);}
export function facesInteraction(direction:InteractionDirection,from:{x:number;y:number},to:{x:number;y:number},coneDegrees=interactionDefaults.npcFacingConeDegrees){
  const distance=interactionDistance(from,to);if(distance<.001)return true;
  const facing={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}[direction];
  return (facing.x*(to.x-from.x)+facing.y*(to.y-from.y))/distance>=Math.cos(coneDegrees*Math.PI/360);
}
/**
 * One shared physical gate for every NPC action. Both points are world feet /
 * collision-body centres, never sprite or portrait centres.
 */
export function canInteractWithNpc(direction:InteractionDirection,playerFoot:{x:number;y:number},npcFoot:{x:number;y:number}){
  const body=npcCollisionRect(npcFoot);
  const distance=Math.hypot(Math.max(body.x-playerFoot.x,0,playerFoot.x-body.x-body.width),Math.max(body.y-playerFoot.y,0,playerFoot.y-body.y-body.height));
  if(distance>interactionDefaults.npcRadius)return {allowed:false,distance,facingRequired:false};
  const facingRequired=distance>interactionDefaults.npcCloseRadius;
  return {allowed:!facingRequired||facesInteraction(direction,playerFoot,npcFoot),distance,facingRequired};
}
export function scoredInteraction(input:Omit<InteractionCandidate,'distance'|'score'>&{point:{x:number;y:number};questBonus?:number;validatedDistance?:number}){
  const distance=input.validatedDistance??interactionDistance(input.point,input.anchor);
  const range=input.radius??0;
  const valid=input.zone?withinInteractionRect(input.point,input.zone):distance<=range;
  if(!valid)return null;
  const normalized=range>0?Math.min(1,distance/range):0;
  return {...input,distance,score:priority[input.type]+(input.questBonus??0)-normalized*40} as InteractionCandidate;
}
/** Keep a valid target until a replacement has a meaningful score advantage. */
export function selectInteraction(candidates:InteractionCandidate[],currentId?:string){
  const ordered=[...candidates].sort((a,b)=>b.score-a.score||a.distance-b.distance||a.id.localeCompare(b.id));
  const best=ordered[0]??null;if(!best)return null;
  const current=currentId?ordered.find(candidate=>candidate.id===currentId):undefined;
  return current&&best.id!==current.id&&best.score<current.score*(1+interactionDefaults.targetSwitchMargin)?current:best;
}
export function interactionLabel(type:InteractionType,name?:string){
  switch(type){
    case 'npc':return `与${name??'人物'}交谈`;
    case 'entrance':return `进入${name??'建筑'}`;
    case 'portal':return name??'进入';
    case 'service':return name??'查看服务';
    case 'furniture':return name??'查看物件';
    default:return name??'互动';
  }
}
