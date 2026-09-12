import test from 'node:test';
import assert from 'node:assert/strict';
import { canInteractWithNpc, facesInteraction, interactionDefaults, scoredInteraction, selectInteraction, withinInteractionRect } from '../packages/client-runtime/interaction-targeting.js';
import { GameController } from '../packages/client-runtime/index.js';
import { initialWorld } from '../packages/game-config/index.js';
import { sceneView, canStand, portalInteractionZone } from '../packages/game-rules/index.js';
import { MemoryRepository } from '../apps/server/src/repository.js';
import { GameService } from '../apps/server/src/service.js';
import { randomUUID } from 'node:crypto';

const point={x:10,y:10};

test('真实场景门洞左右边缘、门帘前沿均可选中，出生点不触发返回',()=>{
  const fixtures=[{scene:'INTERIOR_B_INN',id:'EXIT_B_INN',points:[[10.3,18.7],[12,18.7],[13.7,18.7]]},{scene:'INTERIOR_B_INN',id:'ENTER_INN_GUEST_ROOM',points:[[2.2,5.2],[3,5.2],[4.2,5.2],[3,7.8]]},{scene:'INTERIOR_B_INN_GUEST_ROOM',id:'EXIT_INN_GUEST_ROOM',points:[[5.95,10.8],[7,10.8],[8.2,10.8]]}];
  for(const f of fixtures){const c=new GameController(async()=>({}));c.view=sceneView(initialWorld,f.scene,new Date());for(const [x,y] of f.points){assert.ok(canStand(initialWorld,f.scene,x,y),`${f.id} stand ${x},${y}`);c.x=x;c.y=y;assert.equal(c.nearby()?.id,`portal:${f.id}`);}
    const p=c.view.scene.portals.find(p=>p.id===f.id)!;const to=initialWorld.scenes.find(s=>s.id===p.toSceneId)!;for(const back of to.portals)assert.equal(withinInteractionRect({x:p.spawnX,y:p.spawnY},portalInteractionZone(back)),false,'arrival outside return trigger');}
});

test('真实陈掌柜与伙计四侧近身共用交谈及交易门槛，远处不可交易',()=>{
  for(const id of ['NPC_001','NPC_TRADE_CLERK']){const npc=initialWorld.npcs.find(n=>n.id===id)!;const c=new GameController(async()=>({}));c.view=sceneView(initialWorld,npc.sceneId,new Date());
    for(const [dx,dy] of [[-.95,0],[.95,0],[0,-1.15],[0,1.15]])for(const direction of ['up','down','left','right'] as const){c.x=npc.x+dx;c.y=npc.y+dy;c.direction=direction;assert.equal(c.nearby()?.id,`npc:${id}`,`${id} ${dx},${dy} ${direction}`);assert.equal(c.canUseNpcServices(),true);}
    c.x=npc.x+3;assert.equal(c.canUseNpcServices(),false);assert.equal(c.nearby()?.type==='npc',false);
  }
});

test('服务端接受与客户端相同的门洞边缘和贴门位置',async()=>{
  for(const [sceneId,portalId,x,y] of [['INTERIOR_B_INN','ENTER_INN_GUEST_ROOM',3,5.2],['INTERIOR_B_INN','EXIT_B_INN',10.3,18.7],['INTERIOR_B_INN_GUEST_ROOM','EXIT_INN_GUEST_ROOM',8.2,10.8]] as const){
    const repo=new MemoryRepository();const p=await repo.login(randomUUID());const game=new GameService(repo);
    await game.action(p.id,'create',{gender:'MALE',skinToneId:'SKIN_LIGHT',hairId:'M_HAIR_01',outfitId:'M_OUTFIT_01',requestId:randomUUID()});
    await repo.mutate(p.id,randomUUID(),'fixture',player=>{player.sceneId=sceneId;player.x=x;player.y=y;player.storyFlags={INTRO_INN_KEEPER_DONE:true};return {};});
    await game.action(p.id,'portal',{portalId,requestId:randomUUID()});
  }
});
const candidate=(id:string,type:'portal'|'npc'|'service'|'furniture',anchor:{x:number;y:number},extra:Record<string,unknown>={})=>scoredInteraction({id,type,label:id,path:'/test',body:{id},anchor,point,...extra} as any)!;

test('互动候选必须先进入自己的有效范围，远处 NPC 不会抢占门口',()=>{
  const far=scoredInteraction({id:'npc:far',type:'npc',label:'远处 NPC',path:'/npc',body:{},anchor:{x:16,y:10},radius:interactionDefaults.npcRadius,point});
  const door=candidate('portal:door','portal',{x:10.5,y:10},{zone:{x:9.8,y:9.7,width:1.4,height:1}});
  assert.equal(far,null);assert.equal(selectInteraction([door])?.id,'portal:door');
});

test('NPC 使用脚底坐标、小范围和宽松朝向锥',()=>{
  assert.equal(facesInteraction('right',{x:1,y:1},{x:2,y:1}),true);
  assert.equal(facesInteraction('left',{x:1,y:1},{x:2,y:1}),false);
  assert.equal(facesInteraction('right',{x:1,y:1},{x:1.5,y:1.7}),true);
  assert.equal(facesInteraction('right',{x:1,y:1},{x:1,y:2}),false);
});

test('门区是连续区域，贴近或越过门锚点不会因为最小距离失效',()=>{
  const zone={x:6.2,y:9.2,width:1.6,height:2};
  for(const doorFoot of [{x:6.25,y:9.25},{x:7,y:10.2},{x:7.75,y:11.15}]){
    const door=scoredInteraction({id:'portal:room',type:'portal',label:'前往客栈大厅',path:'/portal',body:{},anchor:{x:7,y:10.2},zone,point:doorFoot});
    assert.ok(door,`door must remain available at ${doorFoot.x},${doorFoot.y}`);
  }
});

test('NPC 近距离不要求朝向，外围范围才使用朝向辅助',()=>{
  const outer=canInteractWithNpc('up',{x:8,y:10.4},{x:8,y:9});assert.equal(outer.allowed,true);assert.equal(outer.facingRequired,true);
  const close=canInteractWithNpc('down',{x:8,y:9.8},{x:8,y:9});assert.equal(close.allowed,true);assert.equal(close.facingRequired,false);
  assert.equal(canInteractWithNpc('left',{x:8,y:9.8},{x:8,y:9}).allowed,true);
  assert.equal(canInteractWithNpc('right',{x:8,y:9.8},{x:8,y:9}).allowed,true);
  assert.equal(canInteractWithNpc('left',{x:8,y:10.3},{x:8,y:9}).allowed,false);
});

test('门使用矩形，家具只允许正面锚点附近互动',()=>{
  const door={x:4,y:7,width:1.2,height:.8};assert.equal(withinInteractionRect({x:4.4,y:7.4},door),true);assert.equal(withinInteractionRect({x:5.4,y:7.4},door),false);
  assert.equal(scoredInteraction({id:'furniture:chest',type:'furniture',label:'打开箱子',path:'/inspect',body:{},anchor:{x:8,y:8},radius:interactionDefaults.furnitureRadius,point:{x:8.7,y:8}})?.id,'furniture:chest');
  assert.equal(scoredInteraction({id:'furniture:chest',type:'furniture',label:'打开箱子',path:'/inspect',body:{},anchor:{x:8,y:8},radius:interactionDefaults.furnitureRadius,point:{x:9,y:8}}),null);
});

test('候选按合法范围后的类型、距离评分排序，并保留当前目标避免抖动',()=>{
  const portal=candidate('portal:door','portal',{x:10.2,y:10},{zone:{x:9.5,y:9.5,width:1.5,height:1.5}});
  const npc=candidate('npc:keeper','npc',{x:10.1,y:10},{radius:interactionDefaults.npcRadius});
  assert.equal(selectInteraction([npc,portal])?.id,'portal:door');
  const furniture=candidate('furniture:desk','furniture',{x:10.05,y:10},{radius:interactionDefaults.furnitureRadius});
  assert.equal(selectInteraction([furniture,npc])?.id,'npc:keeper');
  const current={...npc,score:500},nearbyBetter={...npc,id:'npc:other',score:560};
  assert.equal(selectInteraction([current,nearbyBetter],current.id)?.id,current.id);
  assert.equal(selectInteraction([current,{...nearbyBetter,score:590}],current.id)?.id,'npc:other');
});

test('任务 NPC 只在正常范围内获得小幅评分，不会越界',()=>{
  const inRange=candidate('npc:quest','npc',{x:10.5,y:10},{radius:interactionDefaults.npcRadius,questBonus:20});
  assert.ok(inRange.score>candidate('npc:ordinary','npc',{x:10.5,y:10},{radius:interactionDefaults.npcRadius}).score);
  const outOfRange=scoredInteraction({id:'npc:quest',type:'npc',label:'任务 NPC',path:'/npc',body:{},anchor:{x:12,y:10},radius:interactionDefaults.npcRadius,point,questBonus:20});
  assert.equal(outOfRange,null);
});

test('共享 GameController 在同一位置给 Web 与微信同一个互动结果',()=>{
  const controller=new GameController(async()=>({}));
  controller.view={scene:{id:'INTERIOR_B_INN_GUEST_ROOM',name:'客栈临时房',width:14,height:12,collision:[],roads:[],portals:[{id:'EXIT_INN_GUEST_ROOM',x:7,y:10.2,toSceneId:'INTERIOR_B_INN',spawnX:3,spawnY:8.6}],buildingId:'B_INN',interior:{zones:[{id:'GUEST_CHEST',kind:'storage',x:10,y:6,width:2,height:2,solid:true,interactionPoint:{x:9.45,y:8.2}}]},tileSize:32,mapAsset:'',spawnX:7,spawnY:8.4},plots:[],buildings:[],items:[],npcs:[],phase:'白天'} as any;
  controller.x=7;controller.y=10.2;
  assert.equal(controller.nearby()?.id,'portal:EXIT_INN_GUEST_ROOM');
  controller.x=9.45;controller.y=8.2;
  assert.equal(controller.nearby()?.id,'furniture:GUEST_CHEST');
});

test('服务点不会用独立范围抢占 NPC：交谈与后续服务共用 NPC 物理门槛',()=>{
  const controller=new GameController(async()=>({}));
  controller.view={scene:{id:'INTERIOR_B_TRADE',name:'白石商行',width:24,height:20,collision:[],roads:[],portals:[],buildingId:'B_TRADE',interior:{zones:[{id:'TRADE_SERVICE',kind:'servicePoint',x:11,y:12,width:2,height:1,solid:false}]},tileSize:32,mapAsset:'',spawnX:12,spawnY:15},plots:[],buildings:[],items:[],npcs:[{id:'NPC_TRADE_CLERK',name:'白石商行伙计',x:12,y:9,enabled:true}],phase:'白天'} as any;
  controller.x=12;controller.y=12.5;controller.direction='up';assert.equal(controller.nearby(),null,'远处服务点不能替代 NPC 对话范围');
  controller.y=10;controller.direction='up';assert.equal(controller.nearby()?.id,'npc:NPC_TRADE_CLERK');
});
