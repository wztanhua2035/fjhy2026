import { createHash, randomUUID } from 'node:crypto';
import type { Repository } from './repository.js';
import type { PlayerState, WorldConfig, ShopTradeResult } from '../../../packages/shared-types/index.js';
import { ensure, GameError, canStand, recoverSafePosition, positionBlockers, isOpen, starterAppearance, createStarterAppearance, formalizeAppearance, publicPlayer, sceneView, plotEntrances, inEntranceArea, questStepProgress, questStepLedgerType, questStepReference, portalInteractionZone } from '../../../packages/game-rules/index.js';
import { starterLooks } from '../../../packages/game-config/appearance-v1.js';
import {hairServiceConfig} from '../../../packages/game-config/hair-services.js';
import {outfitShopConfig} from '../../../packages/game-config/outfits.js';
import {validatePlayerIdentity,PlayerIdentityError} from '../../../packages/game-config/player-profile.js';
import { GUEST_ROOM_SCENE_ID, INN_LOBBY_SCENE_ID, INTRO_INN_KEEPER_DONE, guestRoomObjectDialogue } from '../../../packages/game-config/inn-opening.js';
import {firstDayFlags,firstDayQuestAvailable,firstDayNpcIntroductions,shopIntroductions} from '../../../packages/game-config/first-day.js';
import {GUEST_ROOM_LIFE_UNLOCKED,normalizeLifeState,settleSleep,type LifeState} from '../../../packages/game-config/life-v1.js';
import {applyItemEffect,resolveShopPrice,itemStackLimit,requireSupportedStockMode} from '../../../packages/game-rules/inventory.js';
export interface RequestGameContext { debugOpenAll?: boolean }
function money(p:PlayerState,amount:number,type:string,referenceId:string,requestId:string){
  ensure(Number.isSafeInteger(p.cash+amount)&&p.cash+amount>=0&&p.cash+amount<=1e12,'INSUFFICIENT_CASH','铜钱不足或超出余额上限');
  const before=p.cash;p.cash+=amount;p.ledger.push({id:randomUUID(),type,amount,before,after:p.cash,referenceId,requestId,createdAt:new Date().toISOString()});
}
export class GameService {
  constructor(public repo:Repository, public now=()=>new Date()){}
  async settleDueSleep(playerId:string){
    const current=await this.repo.player(playerId),sleep=current.life.sleep;
    if(!sleep||!settleSleep(current.life,this.now()))return current;
    const result=await this.repo.mutate(playerId,randomUUID(),`SLEEP_SETTLEMENT:${sleep.startedAt}`,p=>{
      const settled=settleSleep(p.life,this.now());if(settled)p.life=settled.life;
      return {player:publicPlayer(p),sleepResult:settled?.result??null};
    });
    return result.player as PlayerState;
  }
  facility(world:WorldConfig,p:PlayerState,zoneId:string,kind:'bed'|'wardrobe'|'storage'|'desk'){
    ensure(p.storyFlags?.[GUEST_ROOM_LIFE_UNLOCKED],'FACILITY_LOCKED','先到白石街走走，再回来使用房间设施',403);
    if(p.life.sleep&&kind!=='bed')ensure(false,'SLEEPING','正在休息，请先醒来',409);
    const zone=world.scenes.find(s=>s.id===p.sceneId)?.interior?.zones.find(z=>z.id===zoneId&&z.kind===kind);
    ensure(zone?.interactionPoint,'NO_FACILITY','这里没有对应设施');
    ensure(Math.hypot(p.x-zone.interactionPoint.x,p.y-zone.interactionPoint.y)<1.1,'TOO_FAR','请走近一些');
    return zone;
  }
  async action(playerId:string,action:string,body:any,context:RequestGameContext={}){
    const world=await this.repo.world();
    const hash=createHash('sha256').update(JSON.stringify({action,body,debugOpenAll:!!context.debugOpenAll})).digest('hex');
    return this.repo.mutate(playerId,body.requestId,hash,p=>{
      let questDialogue:string|undefined,guide:string|undefined,trade:ShopTradeResult|undefined;
      ensure(p.status==='ACTIVE','BANNED','账号不可用',403);
      if(action==='buy'||action==='sell')ensure(Number.isSafeInteger(body.quantity)&&body.quantity>=1&&body.quantity<=99,'INVALID_QUANTITY','交易数量必须为 1 至 99 的整数',400);
      if(action!=='create')ensure(p.appearance,'CHARACTER_REQUIRED','请先创建角色',409);
      p.life=normalizeLifeState(p.life);
      if(p.life.sleep&&action!=='sleepWake')ensure(false,'SLEEPING','正在休息，请先醒来',409);
      if(p.appearance&&p.sceneId===INN_LOBBY_SCENE_ID&&!p.storyFlags?.[INTRO_INN_KEEPER_DONE]&&action!=='introComplete')ensure(false,'INTRO_IN_PROGRESS','请先听陈掌柜说完开场的话',409);
      switch(action){
        case 'appearanceService':{
          const shop=this.shop(world,p,body.shopId,context),{hairs,offers}=hairServiceConfig(world);
          ensure(shop.buildingType==='SALON'&&body.serviceType==='HAIR','INVALID_SERVICE','此店不提供该服务');
          const hair=hairs.find(h=>h.hairId===body.targetId),offer=offers.find(o=>o.shopId===shop.id&&o.hairId===body.targetId);
          ensure(hair,'HAIR_NOT_FOUND','发型不存在');ensure(hair.enabled,'HAIR_DISABLED','此发型暂不可用');
          ensure(hair.gender===p.appearance!.gender,'INCOMPATIBLE','此发型不适配当前角色');
          ensure(offer&&offer.enabled,'SERVICE_DISABLED','此服务暂不可用');
          ensure(Number.isSafeInteger(offer.price)&&offer.price>0,'INVALID_PRICE','服务报价无效');
          ensure((p.appearance!.hairId??p.appearance!.hairStyleId)!==hair.hairId,'CURRENT_HAIR','已经是当前发型');
          money(p,-offer.price,'HAIR_SERVICE',`${shop.id}:${hair.hairId}`,body.requestId);
          p.appearance!.hairId=hair.hairId;p.appearance!.hairStyleId=hair.hairId;
          break;
        }
        case 'create':{
          ensure(!p.appearance,'ALREADY_CREATED','角色已创建',409);
          try{p.profile=validatePlayerIdentity(body.profile);}catch(error){if(error instanceof PlayerIdentityError)throw new GameError(error.code,error.message,400);throw error;}
          p.nickname=p.profile.nickname;
          p.appearance=createStarterAppearance(body.gender,{faceId:body.faceId,hairId:body.hairId,outfitId:body.outfitId},world.faces);
          p.cosmetics=[p.appearance.hairId!,p.appearance.outfitId!];
          p.sceneId=GUEST_ROOM_SCENE_ID;p.x=7;p.y=8.4;p.metNpcs=[...new Set([...p.metNpcs,'NPC_001'])];p.storyFlags={};p.life=normalizeLifeState(null);p.storage={};
          money(p,120,'SYSTEM_GRANT','NEW_PLAYER',body.requestId);
          questDialogue='临时借住的房间不大，却总算有个落脚的地方。出门就是客栈大厅。';break;
        }
        case 'move':{
          if(!canStand(world,p.sceneId,p.x,p.y)){
            const before={sceneId:p.sceneId,x:p.x,y:p.y,hits:positionBlockers(world,p.sceneId,p.x,p.y)};
            const safe=recoverSafePosition(world,p.sceneId,p.x,p.y);p.x=safe.x;p.y=safe.y;
            console.info('PLAYER_POSITION_RESTORED',{playerId,x:before.x,y:before.y,sceneId:before.sceneId,hits:before.hits,after:safe});
            return {player:publicPlayer(p),positionRestored:true};
          }
          const points=body.path??[{x:body.x,y:body.y}];
          ensure(points.length>0&&points.length<=256,'INVALID_PATH','移动路径无效');
          const end=points[points.length-1];ensure(end.x===body.x&&end.y===body.y,'INVALID_PATH','移动终点不一致');
          let x=p.x,y=p.y,total=0;
          for(const point of points){
            ensure(Number.isFinite(point.x)&&Number.isFinite(point.y),'INVALID_PATH','移动路径无效');
            total+=Math.hypot(point.x-x,point.y-y);ensure(total<=8+1e-8,'MOVE_TOO_FAR','移动过远，请同步位置');
            const steps=Math.max(1,Math.ceil(Math.hypot(point.x-x,point.y-y)/.05));
            for(let i=1;i<=steps;i++)ensure(canStand(world,p.sceneId,x+(point.x-x)*i/steps,y+(point.y-y)*i/steps),'COLLISION','前方无法通行');
            x=point.x;y=point.y;
          }
          p.x=x;p.y=y;break;
        }
        case 'enter':{
          const plot=world.plots.find(t=>t.id===body.plotId&&t.sceneId===p.sceneId),b=world.buildings.find(b=>b.id===plot?.buildingId&&b.enabled);
          ensure(plot&&b,'NO_ENTRANCE','这里暂时没有可进入的建筑');const entrance=plotEntrances(plot).find(e=>e.id===body.entranceId)??plotEntrances(plot)[0];
          ensure(entrance&&entrance.targetScene===b.interiorSceneId,'NO_ENTRANCE','入口没有有效的室内目标');ensure(inEntranceArea(entrance,p.x,p.y),'TOO_FAR','请走到门口');ensure(isOpen(b.openingHours,this.now(),context.debugOpenAll),'CLOSED','店铺已打烊');
            p.sceneId=entrance.targetScene;const safe=recoverSafePosition(world,p.sceneId,entrance.targetSpawnPoint.x,entrance.targetSpawnPoint.y);p.x=safe.x;p.y=safe.y;
            if(p.sceneId===INN_LOBBY_SCENE_ID&&p.storyFlags?.[firstDayFlags.trade]&&!p.storyFlags?.[firstDayFlags.returned]){p.storyFlags[firstDayFlags.returned]=true;guide='忙了一阵，也可以回临时房歇歇。';}
            if(shopIntroductions[p.sceneId]){p.storyFlags??={};const key=`FIRST_DAY_SHOP_INTRO_${p.sceneId}`;if(!p.storyFlags[key]){p.storyFlags[key]=true;guide=shopIntroductions[p.sceneId];}}break;
        }
        case 'portal':{
          const portal=sceneView(world,p.sceneId,this.now()).scene.portals.find(t=>t.id===body.portalId);ensure(portal,'NO_PORTAL','出口不存在');ensure(inEntranceArea({interactionArea:portalInteractionZone(portal)} as any,p.x,p.y),'TOO_FAR','请走到出口');
            const firstStreetExit=p.sceneId===INN_LOBBY_SCENE_ID&&portal.toSceneId==='STREET_BAISHI_01'&&!!p.storyFlags?.[INTRO_INN_KEEPER_DONE];
            const firstReturn=p.sceneId==='STREET_BAISHI_01'&&portal.toSceneId===INN_LOBBY_SCENE_ID&&!!p.storyFlags?.[firstDayFlags.trade];
            const firstHome=p.sceneId===INN_LOBBY_SCENE_ID&&portal.toSceneId===GUEST_ROOM_SCENE_ID&&!!p.storyFlags?.[firstDayFlags.returned];
          p.sceneId=portal.toSceneId;const safe=recoverSafePosition(world,p.sceneId,portal.spawnX,portal.spawnY);p.x=safe.x;p.y=safe.y;
            if(firstStreetExit){p.storyFlags??={};p.storyFlags[GUEST_ROOM_LIFE_UNLOCKED]=true;
              if(!p.storyFlags[firstDayFlags.street]){p.storyFlags[firstDayFlags.street]=true;p.ledger.push({id:randomUUID(),type:'QUEST_ACCEPTED',amount:0,before:p.cash,after:p.cash,referenceId:'Q_001',requestId:body.requestId,createdAt:new Date().toISOString()});guide='街上转转\n先去街坊杂货铺买一份鸣山大米，再到白石商行问问收购价。';}}
            if(firstReturn&&!p.storyFlags?.[firstDayFlags.returned]){p.storyFlags![firstDayFlags.returned]=true;guide='忙了一阵，也可以回临时房歇歇。';}
            if(firstHome&&!p.storyFlags?.[firstDayFlags.complete]){p.storyFlags![firstDayFlags.complete]=true;questDialogue='在横阳的第一天，总算有了个开始。';}break;
        }
        case 'introComplete':{
          ensure(p.sceneId===INN_LOBBY_SCENE_ID,'WRONG_SCENE','请先进入客栈大厅');
          p.storyFlags??={};p.storyFlags[INTRO_INN_KEEPER_DONE]=true;
          if(!p.metNpcs.includes('NPC_001'))p.metNpcs.push('NPC_001');
          break;
        }
        case 'inspect':{
          ensure(p.sceneId===GUEST_ROOM_SCENE_ID,'WRONG_SCENE','请先进入临时房');
          const zone=world.scenes.find(s=>s.id===GUEST_ROOM_SCENE_ID)?.interior?.zones.find(z=>z.id===body.zoneId);
          ensure(zone?.interactionPoint&&guestRoomObjectDialogue[zone.id],'NO_INTERACTION','这里没有可查看的物件');
          ensure(Math.hypot(p.x-zone.interactionPoint.x,p.y-zone.interactionPoint.y)<1.1,'TOO_FAR','请走近一些');
          if(p.storyFlags?.[GUEST_ROOM_LIFE_UNLOCKED]){
            if(zone.kind==='bed'||zone.kind==='wardrobe'||zone.kind==='storage'||zone.kind==='desk')return {player:publicPlayer(p),facility:{zoneId:zone.id,kind:zone.kind},dialogue:zone.kind==='desk'?`旅人记录：当前活力 ${p.life.energy}/100，随身物品 ${Object.keys(p.inventory).length} 种。`:undefined};
          }
          return {player:publicPlayer(p),dialogue:guestRoomObjectDialogue[zone.id],speaker:'心声'};
        }
        case 'wardrobeEquip':{
          this.facility(world,p,body.zoneId,'wardrobe');
          const {outfits}=outfitShopConfig(world),outfit=outfits.find(o=>o.outfitId===body.outfitId&&o.enabled);
          ensure(outfit&&outfit.gender===p.appearance!.gender,'OUTFIT_UNAVAILABLE','服装不可用');
          ensure(p.cosmetics.includes(outfit.outfitId),'NOT_OWNED','尚未拥有该服装',403);
          ensure(p.appearance!.outfitId!==outfit.outfitId,'CURRENT_OUTFIT','已经穿着此服装');
          p.appearance!.outfitId=outfit.outfitId;p.appearance!.topStyleId=outfit.outfitId;break;
        }
        case 'storageTransfer':{
          this.facility(world,p,body.zoneId,'storage');
          ensure(Number.isSafeInteger(body.quantity)&&body.quantity>=1&&body.quantity<=99,'INVALID_QUANTITY','数量必须为 1 至 99 的整数');
          const item=world.items.find(i=>i.id===body.itemId&&i.enabled!==false);ensure(item,'ITEM_NOT_FOUND','物品不存在');
          const source=body.direction==='deposit'?p.inventory:p.storage,target=body.direction==='deposit'?p.storage:p.inventory;
          ensure(body.direction==='deposit'||body.direction==='withdraw','INVALID_DIRECTION','转移方向无效');
          if(body.direction==='deposit')ensure(!item.questItem&&!item.keyItem&&!item.questOnly,'PROTECTED_ITEM','任务或重要物品不能存入箱子');
          ensure((source[item.id]??0)>=body.quantity,'INSUFFICIENT_ITEM_QUANTITY','物品数量不足');
          if(body.direction==='withdraw')ensure((target[item.id]??0)+body.quantity<=itemStackLimit(item)&&Object.values(p.inventory).reduce((sum,n)=>sum+n,0)+body.quantity<=100,'BAG_FULL','行囊容量不足');
          source[item.id]-=body.quantity;if(source[item.id]===0)delete source[item.id];target[item.id]=(target[item.id]??0)+body.quantity;break;
        }
        case 'sleepStart':{
          this.facility(world,p,body.zoneId,'bed');
          ensure(!p.life.sleep,'SLEEPING','已经在休息');ensure([1,3,6].includes(body.hours),'INVALID_SLEEP_DURATION','请选择有效休息时长');
          p.life.sleep={startedAt:this.now().toISOString(),intendedHours:body.hours};p.life.lastSleepResult=null;break;
        }
        case 'sleepWake':{
          this.facility(world,p,body.zoneId,'bed');ensure(p.life.sleep,'NOT_SLEEPING','目前没有正在进行的休息');
          const settled=settleSleep(p.life,this.now(),true);ensure(settled,'INVALID_SLEEP','休息时间无效');p.life=settled.life;
          return {player:publicPlayer(p),sleepResult:settled.result};
        }
        case 'safeReset':{
          const scene=world.scenes.find(s=>s.id===p.sceneId);ensure(scene,'SCENE_NOT_FOUND','场景不存在',404);
          const safe=recoverSafePosition(world,p.sceneId,scene.spawnX,scene.spawnY);p.x=safe.x;p.y=safe.y;break;
        }
        case 'buy':case 'sell':{
          const shop=this.shop(world,p,body.buildingId,context),stock=shop.stock[body.itemId],item=world.items.find(i=>i.id===body.itemId);ensure(stock&&item,'SHOP_ITEM_NOT_LISTED','该店不经营此商品');ensure(item.enabled!==false,'ITEM_DISABLED','该物品已停用');ensure(stock.enabled!==false,'SHOP_ITEM_DISABLED','该商品已下架');ensure(!item.questOnly&&!item.questItem&&!item.keyItem&&(action==='buy'||item.sellableByNature!==false),'ITEM_NOT_SELLABLE','任务或重要物品不可买卖');
          ensure(action==='buy'?stock.canBuy!==false:stock.canSell!==false,action==='buy'?'ITEM_BUY_DISABLED':'ITEM_SELL_DISABLED',action==='buy'?'该店暂不出售此商品':'该店暂不收购此商品');requireSupportedStockMode(stock);
          const price=resolveShopPrice(stock,action);
          const day=new Date(this.now().getTime()+8*3600000).toISOString().slice(0,10),key=`${day}:${shop.id}:${body.itemId}:${action}`;
          p.tradeCounts=Object.fromEntries(Object.entries(p.tradeCounts).filter(([k])=>k.startsWith(day)));
          ensure(['infinite','INFINITE'].includes(stock.stockMode??'INFINITE')||(p.tradeCounts[key]??0)+body.quantity<=stock.dailyLimit,'DAILY_LIMIT','今日交易额度已用完');
          const held=p.inventory[item.id]??0;
          const referenceId=`${shop.id}:${item.id}${body.quantity>1?`:Q${body.quantity}`:''}`;
          if(action==='buy'){ensure(held+body.quantity<=itemStackLimit(item)&&Object.values(p.inventory).reduce((a,b)=>a+b,0)+body.quantity<=100,'BAG_FULL','行囊容量不足');money(p,-price*body.quantity,'SHOP_BUY',referenceId,body.requestId);p.inventory[item.id]=held+body.quantity;}
          else{ensure(held>=body.quantity,held?'INSUFFICIENT_ITEM_QUANTITY':'ITEM_NOT_OWNED',held?'库存不足，持有数量不够':'库存不足，行囊中没有此物品');money(p,price*body.quantity,'SHOP_SELL',referenceId,body.requestId);if(held===body.quantity)delete p.inventory[item.id];else p.inventory[item.id]=held-body.quantity;}
          const transaction=p.ledger[p.ledger.length-1];trade={transactionId:transaction.id,playerId:p.id,shopId:shop.id,itemId:item.id,side:action==='buy'?'BUY':'SELL',quantity:body.quantity,actualUnitPrice:price,total:price*body.quantity,timestamp:transaction.createdAt};
          p.tradeCounts[key]=(p.tradeCounts[key]??0)+body.quantity;
            for(const quest of world.quests.filter(q=>q.enabled&&p.ledger.some(l=>l.type==='QUEST_ACCEPTED'&&l.referenceId===q.id)&&!p.ledger.some(l=>l.type==='QUEST_REWARD'&&l.referenceId===q.id))){
            const progress=questStepProgress(quest,p.ledger);
            if(progress.every((value,index)=>value>=quest.steps[index].count)&&quest.steps.some(step=>step.type===trade!.side&&step.target===trade!.itemId&&(!step.shopId||step.shopId===trade!.shopId))){
                money(p,quest.reward,'QUEST_REWARD',quest.id,body.requestId);questDialogue=`任务完成：${quest.name}，获得 ${quest.reward} 文奖励`;
                if(quest.id==='Q_001'){p.storyFlags??={};p.storyFlags[firstDayFlags.trade]=true;guide='第一笔生意做成了。想再逛逛就逛逛，之后可以回客栈。';}
            }
          }
          break;
        }
        case 'useItem':{
          ensure(Number.isSafeInteger(body.quantity)&&body.quantity===1,'INVALID_QUANTITY','每次只能使用一件物品',400);
          const item=world.items.find(i=>i.id===body.itemId);ensure(item,'UNKNOWN_ITEM','物品不存在');
          ensure(item.enabled!==false,'ITEM_DISABLED','该物品已停用');
          const held=p.inventory[item.id]??0;ensure(held>=1,'ITEM_NOT_OWNED','行囊中没有此物品');
          applyItemEffect(p,item);
          if(held===1)delete p.inventory[item.id];else p.inventory[item.id]=held-1;
          p.ledger.push({id:randomUUID(),type:'ITEM_USE',amount:0,before:p.cash,after:p.cash,referenceId:item.id,requestId:body.requestId,createdAt:new Date().toISOString()});
          break;
        }
        case 'acceptQuest':{
            const quest=world.quests.find(q=>q.id===body.questId&&q.enabled&&firstDayQuestAvailable(p,q.id));ensure(quest,'QUEST_NOT_FOUND','任务不存在或未开放');
          ensure(p.sceneId==='INTERIOR_B_INN'&&Math.hypot(p.x-8,p.y-9)<6,'TOO_FAR','请先与陈掌柜交谈');
          ensure(!p.ledger.some(l=>l.type==='QUEST_ACCEPTED'&&l.referenceId===quest.id),'QUEST_ALREADY_ACCEPTED','任务已经接取');
          p.ledger.push({id:randomUUID(),type:'QUEST_ACCEPTED',amount:0,before:p.cash,after:p.cash,referenceId:quest.id,requestId:body.requestId,createdAt:new Date().toISOString()});
          questDialogue=`已接取任务：${quest.name}`;break;
        }        case 'talk':{
          const npc=world.npcs.find(n=>n.id===body.npcId&&n.enabled&&n.sceneId===p.sceneId&&isOpen(n.hours,this.now(),context.debugOpenAll));ensure(npc,'NPC_ABSENT','此刻该人物不在这里');ensure(Math.hypot(p.x-npc.x,p.y-npc.y)<6,'TOO_FAR','请靠近对话');
            const met=p.metNpcs.includes(npc.id);if(!met)p.metNpcs.push(npc.id);let dialogue=!met&&p.storyFlags?.[firstDayFlags.street]&&firstDayNpcIntroductions[npc.id]?firstDayNpcIntroductions[npc.id]:npc.dialogue[met?Math.min(1,npc.dialogue.length-1):0];const taskMessages:string[]=[];
            if(npc.questId&&firstDayQuestAvailable(p,npc.questId)&&!p.ledger.some(l=>l.type==='QUEST_ACCEPTED'&&l.referenceId===npc.questId)&&!p.ledger.some(l=>l.type==='QUEST_REWARD'&&l.referenceId===npc.questId)){const quest=world.quests.find(q=>q.id===npc.questId&&q.enabled);if(quest){p.ledger.push({id:randomUUID(),type:'QUEST_ACCEPTED',amount:0,before:p.cash,after:p.cash,referenceId:quest.id,requestId:body.requestId,createdAt:new Date().toISOString()});taskMessages.push('任务已接取\n任务：'+quest.name+'\n当前目标：'+(quest.steps[0]?.objective??'继续任务。'));}}
          for(const quest of world.quests.filter(q=>q.enabled&&p.ledger.some(l=>l.type==='QUEST_ACCEPTED'&&l.referenceId===q.id)&&!p.ledger.some(l=>l.type==='QUEST_REWARD'&&l.referenceId===q.id))){
            const progress=questStepProgress(quest,p.ledger),index=progress.findIndex((value,i)=>value<quest.steps[i].count),step=quest.steps[index];if(!step||step.npcId!==npc.id||!['ACQUIRE','DELIVER','REPORT'].includes(step.type))continue;
            if(step.type==='ACQUIRE'){const item=world.items.find(i=>i.id===step.target);ensure(item,'QUEST_ITEM','任务物品不存在');ensure((p.inventory[item.id]??0)+step.count<=item.stackMax,'BAG_FULL','任务物品无法放入行囊');p.inventory[item.id]=(p.inventory[item.id]??0)+step.count;taskMessages.push(step.completionDialogue??('已领取：'+item.name+'。'));}
            else if(step.type==='DELIVER'){const item=world.items.find(i=>i.id===step.target);ensure(item,'QUEST_ITEM','任务物品不存在');ensure((p.inventory[item.id]??0)>=step.count,'QUEST_ITEM_MISSING','请先领取任务物品');p.inventory[item.id]-=step.count;if(p.inventory[item.id]===0)delete p.inventory[item.id];taskMessages.push(step.completionDialogue??('已交付：'+item.name+'。'));}
            else taskMessages.push(step.completionDialogue??('汇报完成。'));
            p.ledger.push({id:randomUUID(),type:questStepLedgerType(step.type),amount:0,before:p.cash,after:p.cash,referenceId:questStepReference(quest.id,step),requestId:body.requestId,createdAt:new Date().toISOString()});
            if(questStepProgress(quest,p.ledger).every((value,i)=>value>=quest.steps[i].count)){money(p,quest.reward,'QUEST_REWARD',quest.id,body.requestId);taskMessages.push('任务完成：'+quest.name+'，获得 '+quest.reward+' 文奖励');}
          }
          if(taskMessages.length)dialogue=taskMessages.join('\n');return {player:publicPlayer(p),dialogue};
        }        case 'purchaseAppearance':{
          const shop=this.shop(world,p,body.buildingId,context),a=[...world.appearances,...starterLooks].find(a=>a.id===body.appearanceId&&a.enabled);
          ensure(a&&a.partType!=='BASE'&&a.partType!=='HAIR','BAD_APPEARANCE','请选择可购买的服饰');ensure(shop.buildingType==='CLOTH','WRONG_SHOP','请前往服装店');ensure(a.genderScope==='ALL'||a.genderScope===p.appearance!.gender,'INCOMPATIBLE','此部件不适配当前角色');ensure(!p.cosmetics.includes(a.id),'ALREADY_OWNED','已经拥有该服饰');
          if(a.partType==='OUTFIT'){
            const {outfits,offers}=outfitShopConfig(world),outfit=outfits.find(o=>o.outfitId===a.id),offer=offers.find(o=>o.shopId===shop.id&&o.outfitId===a.id);
            ensure(outfit&&outfit.enabled,'OUTFIT_DISABLED','此服装暂不可用');ensure(outfit.gender===p.appearance!.gender,'INCOMPATIBLE','此服装不适配当前角色');ensure(offer&&offer.enabled,'OUTFIT_UNLISTED','此服装未上架');
            money(p,-offer.price,'OUTFIT_BUY',`${shop.id}:${a.id}`,body.requestId);p.cosmetics.push(a.id);p.appearance!.outfitId=a.id;p.appearance!.topStyleId=a.id;
          }else{money(p,-a.price,'COSMETIC_BUY',a.id,body.requestId);p.cosmetics.push(a.id);}break;
        }
        case 'changeAppearance':{
          ensure(!hairServiceConfig(world).hairs.some(h=>h.hairId===body.appearanceId),'SERVICE_REQUIRED','请通过美发服务确认更换');
          const shop=this.shop(world,p,body.buildingId,context),a=[...world.appearances,...starterLooks].find(a=>a.id===body.appearanceId);
          ensure(a&&a.partType!=='BASE'&&a.partType!=='ACCESSORY','BAD_APPEARANCE','部件不可穿戴');ensure(a.genderScope==='ALL'||a.genderScope===p.appearance!.gender,'INCOMPATIBLE','此部件不适配当前角色');if(a.partType!=='OUTFIT'&&a.colors.length)ensure(a.colors.includes(body.colorId),'BAD_COLOR','配色不适配');
          if(a.partType==='HAIR'){ensure(shop.buildingType==='SALON'&&a.enabled,'WRONG_SHOP','请前往美发室选择有效发型');money(p,-a.price,'HAIRCUT',a.id,body.requestId);if(!p.cosmetics.includes(a.id))p.cosmetics.push(a.id);}
          else{ensure(shop.buildingType==='CLOTH','WRONG_SHOP','请在服装店试衣');ensure(p.cosmetics.includes(a.id),'NOT_OWNED','尚未拥有该服饰',403);if(a.partType==='OUTFIT'){const outfit=outfitShopConfig(world).outfits.find(o=>o.outfitId===a.id);ensure(outfit&&outfit.enabled&&outfit.gender===p.appearance!.gender,'OUTFIT_DISABLED','此服装暂不可用');ensure(p.appearance!.outfitId!==a.id,'CURRENT_OUTFIT','已经穿着此服装');}}
          const ap=p.appearance!;if(a.partType==='HAIR'){ap.hairStyleId=a.id;ap.hairId=starterLooks.some(look=>look.id===a.id)?a.id:undefined;if(body.colorId)ap.hairColorId=body.colorId;}if(a.partType==='OUTFIT'){ap.outfitId=a.id;ap.topStyleId=a.id;}if(a.partType==='TOP'){ap.topStyleId=a.id;ap.topColorId=body.colorId;}if(a.partType==='BOTTOM'){ap.bottomStyleId=a.id;ap.bottomColorId=body.colorId;}if(a.partType==='SHOES')ap.shoesId=a.id;break;
        }
      }
        return {player:publicPlayer(p),dialogue:questDialogue,...(guide?{guide}:{}),...(trade?{trade}:{})};
    });
  }
  shop(world:WorldConfig,p:PlayerState,id:string,context:RequestGameContext={}){const b=world.buildings.find(b=>b.id===id);ensure(b,'SHOP_NOT_FOUND','店铺不存在');ensure(b.enabled,'SHOP_DISABLED','店铺暂未营业');ensure(b.interiorSceneId===p.sceneId,'WRONG_SHOP','请先进入对应店铺');ensure(isOpen(b.openingHours,this.now(),context.debugOpenAll),'CLOSED','店铺已打烊');return b;}
}
