import {testProfile} from './creation-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initialWorld } from '../packages/game-config/index.js';
import { canStand, recoverSafePosition } from '../packages/game-rules/index.js';
import { GameService } from '../apps/server/src/service.js';
import { MemoryRepository } from '../apps/server/src/repository.js';
import type { InteriorZone } from '../packages/shared-types/index.js';
import { ensureBaishiInteriorCollision } from '../apps/server/src/sync-baishi.js';
import {canInteractWithNpc} from '../packages/client-runtime/interaction-targeting.js';

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

test('五座室内正式画面中央大件具有保守实体占地，小装饰不单独碰撞',()=>{
  const footprints:Record<string,[number,number][]>= {
    INTERIOR_B_INN:[[3,13.5],[18,10.5],[18.5,14]],
    INTERIOR_B_GROCERY:[[8,12],[15,12],[4,8.5],[4,15]],
    INTERIOR_B_TRADE:[[12,10.5],[3,12],[20,13]],
    INTERIOR_B_SALON:[[3,8],[5.5,8],[8,8],[16,8],[19,13]],
    INTERIOR_B_CLOTH:[[7.5,10],[15,10],[4,13.5],[20,13.5],[21.2,7.5]]
  };
  for(const [sceneId,points] of Object.entries(footprints)){
    const scene=initialWorld.scenes.find(s=>s.id===sceneId)!;
    for(const [x,y] of points)assert.ok(scene.collision.some(r=>x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height),`${sceneId} 家具 (${x},${y}) 缺少实体`);
    assert.equal(scene.interior!.zones.some(z=>z.solid&&/PLANT|FLOWER|DECOR/.test(z.id)),false,sceneId);
    assert.equal(canStand(initialWorld,sceneId,scene.spawnX,scene.spawnY),true,`${sceneId} spawn`);
    assert.equal(canStand(initialWorld,sceneId,scene.portals[0].x,scene.portals[0].y-.5),true,`${sceneId} exit`);
  }
});

test('杂货铺与商行可从入口绕过中央陈列，到达 NPC 的真实互动范围',()=>{
  for(const npcId of ['NPC_GROCERY_CLERK','NPC_TRADE_CLERK']){
    const npc=initialWorld.npcs.find(n=>n.id===npcId)!,scene=initialWorld.scenes.find(s=>s.id===npc.sceneId)!;
    const target={x:10.5,y:9};
    assert.ok(route(scene.id,{x:scene.spawnX,y:scene.spawnY},target).length>1,npcId);
    assert.equal(canInteractWithNpc('right',target,npc).allowed,true,npcId);
  }
});

test('staging 仅同步五室内实体，保留服务点与 portal，重复启动不重复发布',async()=>{
  const repo=new MemoryRepository();
  const before=await repo.world();
  const old=repo.versions[0].config.scenes.find(s=>s.id==='INTERIOR_B_CLOTH')!;
  old.collision=old.collision.filter(r=>r.x!==12.1);
  old.interior!.zones=old.interior!.zones.filter(z=>z.id!=='CLOTH_DISPLAY_TABLE');
  const changed=await ensureBaishiInteriorCollision(repo);assert.equal(changed.published,true);
  const after=await repo.world();
  assert.deepEqual(after.scenes.find(s=>s.id==='STREET_BAISHI_01'),before.scenes.find(s=>s.id==='STREET_BAISHI_01'));
  for(const sceneId of Object.keys({INTERIOR_B_INN:1,INTERIOR_B_GROCERY:1,INTERIOR_B_TRADE:1,INTERIOR_B_SALON:1,INTERIOR_B_CLOTH:1})){
    const actual=after.scenes.find(s=>s.id===sceneId)!,expected=initialWorld.scenes.find(s=>s.id===sceneId)!;
    assert.deepEqual(actual.collision,expected.collision);
    assert.deepEqual(actual.portals,expected.portals);
    assert.deepEqual(actual.interior!.zones.filter(z=>!z.solid),expected.interior!.zones.filter(z=>!z.solid));
  }
  assert.equal((await ensureBaishiInteriorCollision(repo)).published,false);
});

test('客栈临时房门到正门之间的空地保持可通行', () => {
  const scene=initialWorld.scenes.find(s=>s.id==='INTERIOR_B_INN')!;
  const counter=scene.interior!.zones.find(z=>z.id==='INN_COUNTER')!;
  assert.equal(canStand(initialWorld,scene.id,counter.x+counter.width/2,counter.y+counter.height/2),false);
  for(const x of [6,7,8,9,10,11]) assert.equal(canStand(initialWorld,scene.id,x,10.5),true,`柜台前空地 x=${x}`);
  const guestDoor=initialWorld.scenes.find(s=>s.id==='INTERIOR_B_INN_GUEST_ROOM')!.portals[0];
  const path=route(scene.id,{x:guestDoor.spawnX,y:guestDoor.spawnY},{x:12,y:17.5});
  assert.ok(path.some(p=>p.x>=8&&p.y>=10&&p.y<=11), '可从临时房门横穿柜台前空地，再走向正门');
});

for(const [buildingId,npcId,serviceZoneId] of cases)test(`${buildingId} 室内入口、家具、NPC、出口与原门口闭环`,async()=>{
  const repo=new MemoryRepository(),service=new GameService(repo,()=>new Date('2026-09-12T06:00:00Z'));
  const player=await repo.login(`interior-${buildingId}`);
  await service.action(player.id,'create',{profile:testProfile(),requestId:randomUUID(),gender:'FEMALE',faceId:'F_FACE_01',hairId:'F_HAIR_01',outfitId:'F_OUTFIT_01'});
  repo.players.get(player.id)!.storyFlags={INTRO_INN_KEEPER_DONE:true};
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
