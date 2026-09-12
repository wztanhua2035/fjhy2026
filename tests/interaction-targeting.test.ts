import test from 'node:test';
import assert from 'node:assert/strict';
import { facesInteraction, interactionDefaults, scoredInteraction, selectInteraction, withinInteractionRect } from '../packages/client-runtime/interaction-targeting.js';
import { GameController } from '../packages/client-runtime/index.js';

const point={x:10,y:10};
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
  assert.ok(inRange.score>500);
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
