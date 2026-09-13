import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {GameController} from '../packages/client-runtime/index.js';
import {MemoryRepository} from '../apps/server/src/repository.js';
import {GameService} from '../apps/server/src/service.js';
import {sceneView,createStarterAppearance} from '../packages/game-rules/index.js';

async function fixture(){
 const repo=new MemoryRepository(),p=await repo.login(randomUUID()),service=new GameService(repo);
 const world=repo.versions[0].config,scene=world.scenes.find(s=>s.id==='STREET_BAISHI_01')!;
 scene.collision=[{x:10.7,y:9.7,width:.3,height:.6}];world.plots=[];world.npcs=[];
 await repo.mutate(p.id,randomUUID(),'fixture',p=>{p.appearance=createStarterAppearance('MALE',{});p.sceneId=scene.id;p.x=10;p.y=10;return {};});
 const c=new GameController(async(path,body)=>service.action(p.id,path.endsWith('/move')?'move':'portal',body));
 c.boot={player:await repo.player(p.id)} as any;c.view=sceneView(world,scene.id,new Date());c.x=10;c.y=10;
 (c as any).lastSync=-100;
 return {c,repo,p,service};
}

test('真实服务端：只传终点会切过障碍，保留转弯路径后正常同步',async()=>{
 const {c,service,p,repo}=await fixture();
 await assert.rejects(service.action(p.id,'move',{x:12,y:10,requestId:randomUUID()}),/无法通行/);
 c.tick(.2,0,-1);c.tick(.4,1,0);c.tick(.2,0,1);
 assert.equal(c.x,12);assert.equal(c.y,10);await c.sync();
 assert.equal((await repo.player(p.id)).x,12);assert.equal(c.offline,false);
});

test('旧移动在途时点击互动，必须同步最新位置；等待期间不移动、不重复发动作',async()=>{
 const {c}=await fixture();c.view!.scene.collision=[];
 c.view!.scene.portals=[{id:'test',x:12,y:10,toSceneId:c.player!.sceneId,spawnX:12,spawnY:10}];
 let resolve!:(r:any)=>void;const wait=new Promise(r=>resolve=r),calls:string[]=[];let first=true;
 c.transport=async(path,body:any)=>{calls.push(path);if(path.endsWith('/move')){if(first){first=false;return wait;}return {player:{...c.player,x:body.x,y:body.y}};}assert.equal(c.player!.x,12);return {};};
 c.x=11;const moving=c.sync();c.tick(.2,1,0);const action=c.interact();await c.interact();
 c.tick(.1,1,0);assert.equal(c.x,12);
 resolve({player:{...c.player,x:11,y:10}});await moving;await action;
 assert.deepEqual(calls,['/v1/player/move','/v1/player/move','/v1/world/portal']);
});

test('移动明确拒绝后恢复确认位置，不留下五格同步边界空气墙',async()=>{
 const {c}=await fixture();c.x=12;
 await assert.rejects(c.sync(),/无法通行/);assert.equal(c.x,10);assert.match(c.message,/位置同步未通过/);
 c.tick(.2,0,-1);await c.sync();assert.equal(c.player!.y,9);
});

test('直线行走合并同步点，避免逐帧请求服务器',async()=>{
 const {c}=await fixture();c.view!.scene.collision=[];let count=0;
 c.transport=async(_path,body:any)=>{count++;return {player:{...c.player,x:body.x,y:body.y}};};
 for(let i=0;i<20;i++)c.tick(.01,0,-1);await c.sync();assert.ok(count<=2);assert.ok(Math.abs(c.player!.y-9)<1e-8);
});
