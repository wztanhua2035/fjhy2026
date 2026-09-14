import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MemoryRepository} from '../apps/server/src/repository.js';
import {GameService} from '../apps/server/src/service.js';
import {firstDayFlags,firstDayQuestAvailable,firstDayStage,shopIntroductions} from '../packages/game-config/first-day.js';
import {GUEST_ROOM_LIFE_UNLOCKED} from '../packages/game-config/life-v1.js';
import {testProfile} from './creation-fixture.js';

const id=()=>randomUUID();
async function setup(){const repo=new MemoryRepository(),player=await repo.login(`first-day-${id()}`),service=new GameService(repo);
  const act=(action:string,body:object={})=>service.action(player.id,action,{requestId:id(),...body},{debugOpenAll:true});
  await act('create',{gender:'FEMALE',faceId:'F_FACE_01',profile:testProfile()});
  return {repo,player,service,get state(){return repo.players.get(player.id)!;},act};
}
async function street(f:Awaited<ReturnType<typeof setup>>){
  Object.assign(f.state,{sceneId:'INTERIOR_B_INN',x:12,y:18});await f.act('introComplete');
  return f.act('portal',{portalId:'EXIT_B_INN'});
}
test('陈掌柜开场接取急差，第一桶金仍在第一次出客栈时接取',async()=>{
  const f=await setup();assert.equal(firstDayStage(f.state),'WAKE_UP');assert.equal(firstDayQuestAvailable(f.state,'Q_002'),false);
  Object.assign(f.state,{sceneId:'INTERIOR_B_INN',x:12,y:18});
  assert.equal(firstDayQuestAvailable(f.state,'Q_001'),false);assert.equal(firstDayQuestAvailable(f.state,'Q_002'),false);
  const requestId=id();const accepted:any=await f.service.action(f.player.id,'introComplete',{requestId});
  assert.equal(accepted.guide,'接到任务\n《掌柜的急差》');
  assert.equal(firstDayStage(f.state),'MET_INNKEEPER');assert.equal(f.state.storyFlags?.[firstDayFlags.started],undefined);
  assert.equal(f.state.storyFlags?.[firstDayFlags.street],undefined);assert.equal(f.state.storyFlags?.[GUEST_ROOM_LIFE_UNLOCKED],undefined);
  assert.equal(f.state.ledger.filter(l=>l.type==='QUEST_ACCEPTED'&&l.referenceId==='Q_002').length,1);
  await f.service.action(f.player.id,'introComplete',{requestId});await f.act('introComplete');
  assert.equal(f.state.ledger.filter(l=>l.type==='QUEST_ACCEPTED'&&l.referenceId==='Q_002').length,1);
  const result:any=await f.act('portal',{portalId:'EXIT_B_INN'});assert.equal(firstDayStage(f.state),'FIRST_TRADE_STARTED');assert.equal(result.player.storyFlags[firstDayFlags.street],true);
  assert.equal(result.guide,'接到任务\n《第一桶金》');assert.equal(result.player.storyFlags[GUEST_ROOM_LIFE_UNLOCKED],true);
  assert.equal(f.state.ledger.filter(l=>l.type==='QUEST_ACCEPTED'&&l.referenceId==='Q_001').length,1);
  assert.equal(firstDayStage(await f.repo.player(f.player.id)),'FIRST_TRADE_STARTED');
  Object.assign(f.state,{sceneId:'INTERIOR_B_INN',x:12,y:18});await f.act('portal',{portalId:'EXIT_B_INN'});
  assert.equal(f.state.ledger.filter(l=>l.type==='QUEST_ACCEPTED'&&l.referenceId==='Q_001').length,1);
  const reset=await f.repo.restartGame(f.player.id,id());assert.deepEqual(reset.storyFlags,{});assert.equal(firstDayStage(reset),'WAKE_UP');
});
test('第一桶金买卖只奖励一次，首日回房自然结束且店铺提示只一次',async()=>{
  const f=await setup();await street(f);
  f.state.sceneId='INTERIOR_B_GROCERY';f.state.x=12;f.state.y=12.5;
  const introKey='FIRST_DAY_SHOP_INTRO_INTERIOR_B_GROCERY';
  // Entrance triggers its one-time guide; the same store can be revisited freely.
  assert.ok(shopIntroductions.INTERIOR_B_GROCERY);
  const bought:any=await f.act('buy',{buildingId:'B_GROCERY',itemId:'RICE_01',quantity:1});assert.equal(bought.player.inventory.RICE_01,1);
  f.state.sceneId='INTERIOR_B_TRADE';f.state.x=12;f.state.y=12.5;
  const sold:any=await f.act('sell',{buildingId:'B_TRADE',itemId:'RICE_01',quantity:1});
  assert.equal(sold.player.storyFlags[firstDayFlags.trade],true);assert.equal(firstDayStage(f.state),'EXPLORE_BAISHI');
  assert.equal(f.state.ledger.filter(l=>l.type==='QUEST_REWARD'&&l.referenceId==='Q_001').length,1);
  assert.equal(sold.player.cash,144);assert.equal(firstDayQuestAvailable(f.state,'Q_002'),true);
  const world=await f.repo.world();
  const innPlot=world.plots.find(plot=>plot.buildingId==='B_INN')!;
  const innDoor=innPlot.entrances![0];
  Object.assign(f.state,{sceneId:'STREET_BAISHI_01',x:innDoor.interactionArea!.x+innDoor.interactionArea!.width/2,y:innDoor.interactionArea!.y+innDoor.interactionArea!.height/2});
  await f.act('enter',{plotId:innPlot.id,entranceId:innDoor.id});
  assert.equal(firstDayStage(f.state),'RETURN_TO_INN');assert.equal(firstDayQuestAvailable(f.state,'Q_002'),true);
  Object.assign(f.state,{sceneId:'INTERIOR_B_INN',x:3,y:7.2});
  const home:any=await f.act('portal',{portalId:'ENTER_INN_GUEST_ROOM'});
  assert.equal(home.dialogue,'在横阳的第一天，总算有了个开始。');assert.equal(firstDayStage(f.state),'FIRST_DAY_COMPLETE');
  Object.assign(f.state,{sceneId:'INTERIOR_B_INN',x:3,y:7.2});assert.equal((await f.act('portal',{portalId:'ENTER_INN_GUEST_ROOM'}) as any).dialogue,undefined);
  assert.equal(firstDayQuestAvailable(f.state,'Q_003'),true);assert.equal(f.state.storyFlags![introKey],undefined);
});
test('首次店铺提示持久化，重复进店不弹；后续任务按首日阶段开放',async()=>{
  const f=await setup();await street(f);
  const world=await f.repo.world(),plot=world.plots.find(p=>p.buildingId==='B_GROCERY')!,door=plot.entrances![0];
  Object.assign(f.state,{sceneId:'STREET_BAISHI_01',x:door.interactionArea!.x+door.interactionArea!.width/2,y:door.interactionArea!.y+door.interactionArea!.height/2});
  const entered:any=await f.act('enter',{plotId:plot.id,entranceId:door.id});assert.equal(entered.guide,shopIntroductions.INTERIOR_B_GROCERY);
  assert.equal((await f.repo.player(f.player.id)).storyFlags?.FIRST_DAY_SHOP_INTRO_INTERIOR_B_GROCERY,true);
  Object.assign(f.state,{sceneId:'STREET_BAISHI_01',x:door.interactionArea!.x+door.interactionArea!.width/2,y:door.interactionArea!.y+door.interactionArea!.height/2});
  assert.equal((await f.act('enter',{plotId:plot.id,entranceId:door.id}) as any).guide,undefined);
  assert.equal(firstDayQuestAvailable(f.state,'Q_002'),true);assert.equal(firstDayQuestAvailable(f.state,'Q_003'),false);
  f.state.x=12;f.state.y=9;
  assert.equal(f.state.ledger.filter(l=>l.type==='QUEST_ACCEPTED'&&l.referenceId==='Q_002').length,1);
});
