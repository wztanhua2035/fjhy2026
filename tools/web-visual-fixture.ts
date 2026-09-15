/** Isolated in-memory API for repeatable Web visual acceptance. Never connects to a database. */
import { randomUUID } from 'node:crypto';
import { buildApp } from '../apps/server/src/app.js';
import { MemoryRepository } from '../apps/server/src/repository.js';
import { GameService } from '../apps/server/src/service.js';
import { initialWorld } from '../packages/game-config/index.js';
import { canStand } from '../packages/game-rules/index.js';
import { testProfile } from '../tests/creation-fixture.js';

const repo=new MemoryRepository(),now=()=>new Date('2026-09-05T02:00:00Z');
const app=await buildApp(repo,{mode:'development',appEnv:'DEV',port:8082,jwtSecret:randomUUID()+randomUUID(),subjectSecret:'isolated-visual-fixture-subject-secret',adminToken:randomUUID()+randomUUID(),allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost:5174',assetBase:'http://localhost:8082/assets'},{now});
const rooms=[['guest','INTERIOR_B_INN_GUEST_ROOM'],['inn','INTERIOR_B_INN'],['grocery','INTERIOR_B_GROCERY'],['trade','INTERIOR_B_TRADE'],['salon','INTERIOR_B_SALON'],['cloth','INTERIOR_B_CLOTH'],['street','STREET_BAISHI_01']];
for(const kind of ['bed','wardrobe','storage','desk'])rooms.push([kind,'INTERIOR_B_INN_GUEST_ROOM']);
for(const [account,sceneId] of rooms){
  const auth=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:`visual-${account}`}})).json();
  await new GameService(repo,now).action(auth.player.id,'create',{requestId:randomUUID(),gender:'FEMALE',faceId:'F_FACE_01',hairId:'F_HAIR_01',outfitId:'F_OUTFIT_01',profile:testProfile()});
  const player=repo.players.get(auth.player.id)!;
  const scene=initialWorld.scenes.find(scene=>scene.id===sceneId)!;
  const npc=initialWorld.npcs.find(npc=>npc.sceneId===sceneId);
  let point={x:scene.spawnX,y:scene.spawnY};
  if(npc){for(const [dx,dy] of [[0,.8],[.8,0],[-.8,0],[0,.4],[0,1.2]]){const candidate={x:npc.x+dx,y:npc.y+dy};if(canStand(initialWorld,sceneId,candidate.x,candidate.y)){point=candidate;break;}}}
  const zone=scene.interior?.zones.find(zone=>zone.kind===account);if(zone?.interactionPoint)point=zone.interactionPoint;
  Object.assign(player,{sceneId,...point,storyFlags:{INTRO_INN_KEEPER_DONE:true,GUEST_ROOM_LIFE_UNLOCKED:true,FIRST_DAY_WAKE_DONE:true,FIRST_DAY_ENTERED_BAISHI:true},inventory:{RICE_01:2,UMBRELLA_01:1},storage:{WATER_01:3}});
  console.log(`visual-${account}: ${sceneId} (${point.x},${point.y})`);
}
await app.listen({host:'127.0.0.1',port:8082});
console.log('Isolated visual fixture ready: localhost:8082; use VITE_API_BASE_URL=http://localhost:8082 on port 5174.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
