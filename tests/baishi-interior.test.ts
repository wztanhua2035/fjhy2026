import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initialWorld } from '../packages/game-config/index.js';
import { canStand, recoverSafePosition } from '../packages/game-rules/index.js';
import { GameService } from '../apps/server/src/service.js';
import { MemoryRepository } from '../apps/server/src/repository.js';
import type { InteriorZone } from '../packages/shared-types/index.js';

function route(sceneId: string, start: {x:number;y:number}, target: {x:number;y:number}) {
  const step=.5, key=(x:number,y:number)=>`${x},${y}`;
  const queue=[start], previous=new Map<string,string|null>([[key(start.x,start.y),null]]);
  let reached='';
  while(queue.length){
    const p=queue.shift()!,current=key(p.x,p.y);
    if(Math.hypot(p.x-target.x,p.y-target.y)<=.5){reached=current;break;}
    for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){
      const x=p.x+dx,y=p.y+dy,next=key(x,y);
      if(!previous.has(next)&&canStand(initialWorld,sceneId,x,y)){previous.set(next,current);queue.push({x,y});}
    }
  }
  assert.ok(reached,`${sceneId} 无法从 ${key(start.x,start.y)} 走到 ${key(target.x,target.y)}`);
  const path:{x:number;y:number}[]=[];
  for(let at:string|null=reached;at;at=previous.get(at)??null){const [x,y]=at.split(',').map(Number);path.push({x,y});}
  return path.reverse();
}

const cases=[
  ['B_INN','NPC_001','INN_SERVICE'],
  ['B_GROCERY','NPC_GROCERY_CLERK','GROCERY_SERVICE'],
  ['B_TRADE','NPC_TRADE_CLERK','TRADE_SERVICE'],
  ['B_SALON','NPC_SALON_HAIRDRESSER','SALON_SERVICE'],
  ['B_CLOTH','NPC_CLOTH_SHOPKEEPER','CLOTH_COUNTER_SERVICE']
] as const;

for(const [buildingId,npcId,serviceZoneId] of cases)test(`${buildingId} 室内入口、家具、NPC、出口与原门口闭环`,async()=>{
  const repo=new MemoryRepository(),service=new GameService(repo,()=>new Date('2026-09-12T06:00:00Z'));
  const player=await repo.login(`interior-${buildingId}`);
  await service.action(player.id,'create',{requestId:randomUUID(),gender:'FEMALE',skinToneId:'SKIN_LIGHT',hairId:'F_HAIR_01',outfitId:'F_OUTFIT_01'});
  const building=initialWorld.buildings.find(b=>b.id===buildingId)!,scene=initialWorld.scenes.find(s=>s.id===building.interiorSceneId)!;
  const plot=initialWorld.plots.find(p=>p.buildingId===buildingId)!,entrance=plot.entrances![0],portal=scene.portals[0];
  assert.equal(scene.width,24);assert.equal(scene.height,20);assert.equal(scene.tileSize,32);
  assert.equal(scene.width*scene.tileSize,768);assert.equal(scene.height*scene.tileSize,640);
  assert.ok(scene.interior);
  const zones=scene.interior.zones;
  assert.ok(zones.some(z=>z.kind==='counter'));
  assert.ok(zones.some(z=>z.kind==='entry'));
  assert.ok(zones.some(z=>z.kind==='exit'));
  for(const z of zones.filter(z=>z.solid)){
    const x=z.x+z.width/2,y=z.y+z.height/2;
    assert.equal(canStand(initialWorld,scene.id,x,y),false,z.id);
    const restored=recoverSafePosition(initialWorld,scene.id,x,y);
    assert.equal(canStand(initialWorld,scene.id,restored.x,restored.y),true,`${z.id} 旧存档恢复`);
  }
  const saved=repo.players.get(player.id)!;
  Object.assign(saved,{sceneId:'STREET_BAISHI_01',x:entrance.position.x,y:entrance.position.y});
  const entered=await service.action(player.id,'enter',{requestId:randomUUID(),plotId:plot.id,entranceId:entrance.id});
  assert.equal(entered.player.sceneId,scene.id);
  assert.equal(canStand(initialWorld,scene.id,entered.player.x,entered.player.y),true);
  const serviceZone=zones.find(z=>z.id===serviceZoneId) as InteriorZone;
  const destination={x:Math.round((serviceZone.x+serviceZone.width/2)*2)/2,y:Math.round((serviceZone.y+serviceZone.height/2)*2)/2};
  let position={x:entered.player.x,y:entered.player.y};
  for(const step of route(scene.id,position,destination).slice(1)){await service.action(player.id,'move',{requestId:randomUUID(),...step});position=step;}
  const npc=initialWorld.npcs.find(n=>n.id===npcId)!;
  assert.ok(Math.hypot(position.x-npc.x,position.y-npc.y)<6);
  const talked=await service.action(player.id,'talk',{requestId:randomUUID(),npcId});
  assert.ok(talked.dialogue);
  const counter=zones.find(z=>z.kind==='counter')!;
  assert.equal(canStand(initialWorld,scene.id,counter.x+counter.width/2,counter.y+counter.height/2),false);
  for(const step of route(scene.id,position,{x:portal.x,y:portal.y-.5}).slice(1)){await service.action(player.id,'move',{requestId:randomUUID(),...step});position=step;}
  const left=await service.action(player.id,'portal',{requestId:randomUUID(),portalId:portal.id});
  assert.equal(left.player.sceneId,'STREET_BAISHI_01');
  assert.equal(left.player.x,entrance.position.x);
  assert.equal(left.player.y,entrance.position.y+1);
});
