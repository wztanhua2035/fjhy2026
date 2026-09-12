import { createHash, randomUUID } from 'node:crypto';
import type { Repository } from './repository.js';
import type { PlayerState, WorldConfig } from '../../../packages/shared-types/index.js';
import { ensure, canStand, recoverSafePosition, positionBlockers, isOpen, starterAppearance, createStarterAppearance, formalizeAppearance, publicPlayer, sceneView, plotEntrances, inEntranceArea, questStepProgress, questStepLedgerType, questStepReference, portalInteractionZone } from '../../../packages/game-rules/index.js';
import { starterLooks } from '../../../packages/game-config/appearance-v1.js';
import { GUEST_ROOM_SCENE_ID, INN_LOBBY_SCENE_ID, INTRO_INN_KEEPER_DONE, guestRoomObjectDialogue } from '../../../packages/game-config/inn-opening.js';
export interface RequestGameContext { debugOpenAll?: boolean }
function money(p:PlayerState,amount:number,type:string,referenceId:string,requestId:string){
  ensure(Number.isSafeInteger(p.cash+amount)&&p.cash+amount>=0&&p.cash+amount<=1e12,'INSUFFICIENT_CASH','铜钱不足或超出余额上限');
  const before=p.cash;p.cash+=amount;p.ledger.push({id:randomUUID(),type,amount,before,after:p.cash,referenceId,requestId,createdAt:new Date().toISOString()});
}
export class GameService {
  constructor(public repo:Repository, public now=()=>new Date()){}
  async action(playerId:string,action:string,body:any,context:RequestGameContext={}){
    const world=await this.repo.world();
    const hash=createHash('sha256').update(JSON.stringify({action,body,debugOpenAll:!!context.debugOpenAll})).digest('hex');
    return this.repo.mutate(playerId,body.requestId,hash,p=>{
      let questDialogue:string|undefined;
      ensure(p.status==='ACTIVE','BANNED','账号不可用',403);
      if(action!=='create')ensure(p.appearance,'CHARACTER_REQUIRED','请先创建角色',409);
      if(p.appearance&&p.sceneId===INN_LOBBY_SCENE_ID&&!p.storyFlags?.[INTRO_INN_KEEPER_DONE]&&action!=='introComplete')ensure(false,'INTRO_IN_PROGRESS','请先听陈掌柜说完开场的话',409);
      switch(action){
        case 'create':{
          ensure(!p.appearance,'ALREADY_CREATED','角色已创建',409);
          p.appearance='baseAvatarId' in body
            ?formalizeAppearance(starterAppearance(world,body.gender,body.baseAvatarId,{skinColorId:body.skinColorId,hairColorId:body.hairColorId,topColorId:body.topColorId,bottomColorId:body.bottomColorId}))
            :createStarterAppearance(body.gender,{skinToneId:body.skinToneId,hairId:body.hairId,outfitId:body.outfitId});
          p.cosmetics=[p.appearance.hairId!,p.appearance.outfitId!];
          p.sceneId=GUEST_ROOM_SCENE_ID;p.x=7;p.y=8.4;p.metNpcs=[...new Set([...p.metNpcs,'NPC_001'])];p.storyFlags={};
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
          ensure(Math.hypot(p.x-body.x,p.y-body.y)<=8,'MOVE_TOO_FAR','移动过远，请同步位置');
          const steps=32;for(let i=1;i<=steps;i++)ensure(canStand(world,p.sceneId,p.x+(body.x-p.x)*i/steps,p.y+(body.y-p.y)*i/steps),'COLLISION','前方无法通行');
          p.x=body.x;p.y=body.y;break;
        }
        case 'enter':{
          const plot=world.plots.find(t=>t.id===body.plotId&&t.sceneId===p.sceneId),b=world.buildings.find(b=>b.id===plot?.buildingId&&b.enabled);
          ensure(plot&&b,'NO_ENTRANCE','这里暂时没有可进入的建筑');const entrance=plotEntrances(plot).find(e=>e.id===body.entranceId)??plotEntrances(plot)[0];
          ensure(entrance&&entrance.targetScene===b.interiorSceneId,'NO_ENTRANCE','入口没有有效的室内目标');ensure(inEntranceArea(entrance,p.x,p.y),'TOO_FAR','请走到门口');ensure(isOpen(b.openingHours,this.now(),context.debugOpenAll),'CLOSED','店铺已打烊');
          p.sceneId=entrance.targetScene;const safe=recoverSafePosition(world,p.sceneId,entrance.targetSpawnPoint.x,entrance.targetSpawnPoint.y);p.x=safe.x;p.y=safe.y;break;
        }
        case 'portal':{
          const portal=sceneView(world,p.sceneId,this.now()).scene.portals.find(t=>t.id===body.portalId);ensure(portal,'NO_PORTAL','出口不存在');ensure(inEntranceArea({interactionArea:portalInteractionZone(portal)} as any,p.x,p.y),'TOO_FAR','请走到出口');
          p.sceneId=portal.toSceneId;const safe=recoverSafePosition(world,p.sceneId,portal.spawnX,portal.spawnY);p.x=safe.x;p.y=safe.y;break;
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
          return {player:publicPlayer(p),dialogue:guestRoomObjectDialogue[zone.id],speaker:'心声'};
        }
        case 'safeReset':{
          const scene=world.scenes.find(s=>s.id===p.sceneId);ensure(scene,'SCENE_NOT_FOUND','场景不存在',404);
          const safe=recoverSafePosition(world,p.sceneId,scene.spawnX,scene.spawnY);p.x=safe.x;p.y=safe.y;break;
        }
        case 'buy':case 'sell':{
          const shop=this.shop(world,p,body.buildingId,context),stock=shop.stock[body.itemId],item=world.items.find(i=>i.id===body.itemId);ensure(stock&&item,'NOT_SOLD','该店不经营此商品');ensure(!item.questOnly,'QUEST_ITEM','任务物品不可买卖');
          const day=new Date(this.now().getTime()+8*3600000).toISOString().slice(0,10),key=`${day}:${shop.id}:${body.itemId}:${action}`;
          p.tradeCounts=Object.fromEntries(Object.entries(p.tradeCounts).filter(([k])=>k.startsWith(day)));
          ensure((p.tradeCounts[key]??0)+body.quantity<=stock.dailyLimit,'DAILY_LIMIT','今日交易额度已用完');
          const held=p.inventory[item.id]??0;
          if(action==='buy'){ensure(held+body.quantity<=item.stackMax&&Object.values(p.inventory).reduce((a,b)=>a+b,0)+body.quantity<=100,'BAG_FULL','行囊容量不足');money(p,-stock.buy*body.quantity,'SHOP_BUY',`${shop.id}:${item.id}`,body.requestId);p.inventory[item.id]=held+body.quantity;}
          else{ensure(held>=body.quantity,'INSUFFICIENT_ITEM','库存不足');money(p,stock.sell*body.quantity,'SHOP_SELL',`${shop.id}:${item.id}`,body.requestId);if(held===body.quantity)delete p.inventory[item.id];else p.inventory[item.id]=held-body.quantity;}
          p.tradeCounts[key]=(p.tradeCounts[key]??0)+body.quantity;
          if(action==='sell'&&body.itemId==='RICE_01'&&!p.ledger.some(l=>l.type==='QUEST_REWARD'&&l.referenceId==='Q_001')&&p.ledger.some(l=>l.type==='SHOP_BUY'&&l.referenceId.includes('RICE_01'))){money(p,20,'QUEST_REWARD','Q_001',body.requestId);questDialogue='任务完成：第一桶金，获得 20 文奖励';}
          break;
        }
        case 'acceptQuest':{
          const quest=world.quests.find(q=>q.id===body.questId&&q.enabled);ensure(quest,'QUEST_NOT_FOUND','任务不存在或未开放');
          ensure(p.sceneId==='INTERIOR_B_INN'&&Math.hypot(p.x-8,p.y-9)<6,'TOO_FAR','请先与陈掌柜交谈');
          ensure(!p.ledger.some(l=>l.type==='QUEST_ACCEPTED'&&l.referenceId===quest.id),'QUEST_ALREADY_ACCEPTED','任务已经接取');
          p.ledger.push({id:randomUUID(),type:'QUEST_ACCEPTED',amount:0,before:p.cash,after:p.cash,referenceId:quest.id,requestId:body.requestId,createdAt:new Date().toISOString()});
          questDialogue=`已接取任务：${quest.name}`;break;
        }        case 'talk':{
          const npc=world.npcs.find(n=>n.id===body.npcId&&n.enabled&&n.sceneId===p.sceneId&&isOpen(n.hours,this.now(),context.debugOpenAll));ensure(npc,'NPC_ABSENT','此刻该人物不在这里');ensure(Math.hypot(p.x-npc.x,p.y-npc.y)<6,'TOO_FAR','请靠近对话');
          const met=p.metNpcs.includes(npc.id);if(!met)p.metNpcs.push(npc.id);let dialogue=npc.dialogue[met?Math.min(1,npc.dialogue.length-1):0];const taskMessages:string[]=[];
          if(npc.questId&&!p.ledger.some(l=>l.type==='QUEST_ACCEPTED'&&l.referenceId===npc.questId)&&!p.ledger.some(l=>l.type==='QUEST_REWARD'&&l.referenceId===npc.questId)){const quest=world.quests.find(q=>q.id===npc.questId&&q.enabled);if(quest){p.ledger.push({id:randomUUID(),type:'QUEST_ACCEPTED',amount:0,before:p.cash,after:p.cash,referenceId:quest.id,requestId:body.requestId,createdAt:new Date().toISOString()});taskMessages.push('任务已接取\n任务：'+quest.name+'\n当前目标：'+(quest.steps[0]?.objective??'继续任务。'));}}
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
          ensure(a&&a.partType!=='BASE'&&a.partType!=='HAIR','BAD_APPEARANCE','请选择可购买的服饰');ensure(shop.buildingType==='CLOTH','WRONG_SHOP','请前往服装店');ensure(a.genderScope==='ALL'||a.genderScope===p.appearance!.gender,'INCOMPATIBLE','此部件不适配当前角色');ensure(!p.cosmetics.includes(a.id),'ALREADY_OWNED','已经拥有该服饰');money(p,-a.price,'COSMETIC_BUY',a.id,body.requestId);p.cosmetics.push(a.id);break;
        }
        case 'changeAppearance':{
          const shop=this.shop(world,p,body.buildingId,context),a=[...world.appearances,...starterLooks].find(a=>a.id===body.appearanceId);
          ensure(a&&a.partType!=='BASE'&&a.partType!=='ACCESSORY','BAD_APPEARANCE','部件不可穿戴');ensure(a.genderScope==='ALL'||a.genderScope===p.appearance!.gender,'INCOMPATIBLE','此部件不适配当前角色');if(a.partType!=='OUTFIT'&&a.colors.length)ensure(a.colors.includes(body.colorId),'BAD_COLOR','配色不适配');
          if(a.partType==='HAIR'){ensure(shop.buildingType==='SALON'&&a.enabled,'WRONG_SHOP','请前往美发室选择有效发型');money(p,-a.price,'HAIRCUT',a.id,body.requestId);if(!p.cosmetics.includes(a.id))p.cosmetics.push(a.id);}
          else{ensure(shop.buildingType==='CLOTH','WRONG_SHOP','请在服装店试衣');ensure(p.cosmetics.includes(a.id),'NOT_OWNED','尚未拥有该服饰',403);}
          const ap=p.appearance!;if(a.partType==='HAIR'){ap.hairStyleId=a.id;ap.hairId=starterLooks.some(look=>look.id===a.id)?a.id:undefined;if(body.colorId)ap.hairColorId=body.colorId;}if(a.partType==='OUTFIT'){ap.outfitId=a.id;ap.topStyleId=a.id;}if(a.partType==='TOP'){ap.topStyleId=a.id;ap.topColorId=body.colorId;}if(a.partType==='BOTTOM'){ap.bottomStyleId=a.id;ap.bottomColorId=body.colorId;}if(a.partType==='SHOES')ap.shoesId=a.id;break;
        }
      }
      return {player:publicPlayer(p),dialogue:questDialogue};
    });
  }
  shop(world:WorldConfig,p:PlayerState,id:string,context:RequestGameContext={}){const b=world.buildings.find(b=>b.id===id&&b.enabled);ensure(b&&b.interiorSceneId===p.sceneId,'WRONG_SHOP','请先进入对应店铺');ensure(isOpen(b.openingHours,this.now(),context.debugOpenAll),'CLOSED','店铺已打烊');return b;}
}
