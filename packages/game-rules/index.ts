import type { Appearance, PlayerState, WorldConfig, SceneView } from '../shared-types/index.js';
export class GameError extends Error { constructor(public code:string, message:string, public status=400){super(message)} }
export function ensure(ok:unknown, code:string, message:string, status=400): asserts ok { if(!ok) throw new GameError(code,message,status); }
export function minutesAt(now:Date){return (now.getUTCHours()*60+now.getUTCMinutes()+480)%1440;}
export function isOpen(hours:[string,string],now:Date){const m=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));const [a,b]=hours.map(m),t=minutesAt(now);return a===b|| (a<b ? t>=a&&t<b : t>=a||t<b);}
export function phaseAt(now:Date){const h=minutesAt(now)/60;return h<6?'深夜':h<9?'清晨':h<17?'日间':h<20?'傍晚':'夜晚';}
export function starterAppearance(world:WorldConfig,gender:'MALE'|'FEMALE',baseAvatarId:string,colors:{hairColorId:string;topColorId:string;bottomColorId:string}):Appearance{
  ensure(world.appearances.some(a=>a.id===baseAvatarId&&a.partType==='BASE'&&a.genderScope===gender&&a.enabled),'BAD_AVATAR','请选择有效基础形象');
  for(const color of Object.values(colors)) ensure(Object.hasOwn(world.colors,color),'BAD_COLOR','配色不存在');
  return {gender,baseAvatarId,hairStyleId:`HAIR_${gender}_01`,topStyleId:`TOP_${gender}_01`,bottomStyleId:`BOTTOM_${gender}_01`,shoesId:`SHOES_${gender}_01`,accessoryIds:[],...colors};
}
export function sceneView(world:WorldConfig,id:string,now:Date):SceneView{
  const scene=world.scenes.find(s=>s.id===id);ensure(scene,'SCENE_NOT_FOUND','场景不存在',404);
  const plots=world.plots.filter(p=>p.sceneId===id);
  const occupancy=scene.buildingId?world.plots.find(p=>p.buildingId===scene.buildingId):undefined;
  const configuredScene=occupancy?{...scene,portals:scene.portals.map(p=>({...p,toSceneId:occupancy.sceneId,spawnX:occupancy.entranceX,spawnY:occupancy.entranceY+1}))}:scene;
  return {scene:configuredScene,plots,buildings:world.buildings.filter(b=>b.enabled&&(plots.some(p=>p.buildingId===b.id)||b.id===scene.buildingId)),
    npcs:world.npcs.filter(n=>n.enabled&&n.sceneId===id&&isOpen(n.hours,now)).sort((a,b)=>b.priority-a.priority).slice(0,8),phase:phaseAt(now)};
}
export function canStand(world:WorldConfig,sceneId:string,x:number,y:number){
  const s=world.scenes.find(s=>s.id===sceneId);if(!s||x<1||y<1||x>s.width-1||y>s.height-1)return false;
  return ![...s.collision,...world.plots.filter(p=>p.sceneId===sceneId&&p.buildingId)].some(r=>x>r.x-.3&&x<r.x+r.width+.3&&y>r.y-.3&&y<r.y+r.height+.3);
}
export function publicPlayer(p:PlayerState){return {...p,tradeCounts:{},ledger:p.ledger.slice(-20)};}
