import { createHash, randomUUID } from 'node:crypto';
import type { Repository } from './repository.js';
import type { PlayerState, WorldConfig } from '../../../packages/shared-types/index.js';
import { ensure, canStand, isOpen, starterAppearance, publicPlayer, sceneView } from '../../../packages/game-rules/index.js';
function money(p:PlayerState,amount:number,type:string,referenceId:string,requestId:string){
  ensure(Number.isSafeInteger(p.cash+amount)&&p.cash+amount>=0&&p.cash+amount<=1e12,'INSUFFICIENT_CASH','铜钱不足或超出余额上限');
  const before=p.cash;p.cash+=amount;p.ledger.push({id:randomUUID(),type,amount,before,after:p.cash,referenceId,requestId,createdAt:new Date().toISOString()});
}
export class GameService {
  constructor(public repo:Repository, public now=()=>new Date()){}
  async action(playerId:string,action:string,body:any){
    const world=await this.repo.world();
    const hash=createHash('sha256').update(JSON.stringify({action,body})).digest('hex');
    return this.repo.mutate(playerId,body.requestId,hash,p=>{
      ensure(p.status==='ACTIVE','BANNED','账号不可用',403);
      if(action!=='create')ensure(p.appearance,'CHARACTER_REQUIRED','请先创建角色',409);
      switch(action){
        case 'create':{
          ensure(!p.appearance,'ALREADY_CREATED','角色已创建',409);
          p.appearance=starterAppearance(world,body.gender,body.baseAvatarId,{hairColorId:body.hairColorId,topColorId:body.topColorId,bottomColorId:body.bottomColorId});
          p.cosmetics=[p.appearance.hairStyleId,p.appearance.topStyleId,p.appearance.bottomStyleId,p.appearance.shoesId];
          money(p,120,'SYSTEM_GRANT','NEW_PLAYER',body.requestId);break;
        }
        case 'move':{
          ensure(Math.hypot(p.x-body.x,p.y-body.y)<=8,'MOVE_TOO_FAR','移动过远，请同步位置');
          const steps=32;for(let i=1;i<=steps;i++)ensure(canStand(world,p.sceneId,p.x+(body.x-p.x)*i/steps,p.y+(body.y-p.y)*i/steps),'COLLISION','前方无法通行');
          p.x=body.x;p.y=body.y;break;
        }
        case 'enter':{
          const plot=world.plots.find(t=>t.id===body.plotId&&t.sceneId===p.sceneId),b=world.buildings.find(b=>b.id===plot?.buildingId&&b.enabled);
          ensure(plot&&b,'NO_ENTRANCE','这里暂时没有可进入的建筑');ensure(Math.hypot(p.x-plot.entranceX,p.y-plot.entranceY)<4,'TOO_FAR','请走到门口');ensure(isOpen(b.openingHours,this.now()),'CLOSED','店铺已打烊');
          const s=world.scenes.find(s=>s.id===b.interiorSceneId)!;p.sceneId=s.id;p.x=s.spawnX;p.y=s.spawnY;break;
        }
        case 'portal':{
          const portal=sceneView(world,p.sceneId,this.now()).scene.portals.find(t=>t.id===body.portalId);ensure(portal,'NO_PORTAL','出口不存在');ensure(Math.hypot(p.x-portal.x,p.y-portal.y)<4,'TOO_FAR','请走到出口');
          p.sceneId=portal.toSceneId;p.x=portal.spawnX;p.y=portal.spawnY;break;
        }
        case 'buy':case 'sell':{
          const shop=this.shop(world,p,body.buildingId),stock=shop.stock[body.itemId],item=world.items.find(i=>i.id===body.itemId);ensure(stock&&item,'NOT_SOLD','该店不经营此商品');
          const day=new Date(this.now().getTime()+8*3600000).toISOString().slice(0,10),key=`${day}:${shop.id}:${body.itemId}:${action}`;
          p.tradeCounts=Object.fromEntries(Object.entries(p.tradeCounts).filter(([k])=>k.startsWith(day)));
          ensure((p.tradeCounts[key]??0)+body.quantity<=stock.dailyLimit,'DAILY_LIMIT','今日交易额度已用完');
          const held=p.inventory[item.id]??0;
          if(action==='buy'){ensure(held+body.quantity<=item.stackMax&&Object.values(p.inventory).reduce((a,b)=>a+b,0)+body.quantity<=100,'BAG_FULL','行囊容量不足');money(p,-stock.buy*body.quantity,'SHOP_BUY',`${shop.id}:${item.id}`,body.requestId);p.inventory[item.id]=held+body.quantity;}
          else{ensure(held>=body.quantity,'INSUFFICIENT_ITEM','库存不足');money(p,stock.sell*body.quantity,'SHOP_SELL',`${shop.id}:${item.id}`,body.requestId);if(held===body.quantity)delete p.inventory[item.id];else p.inventory[item.id]=held-body.quantity;}
          p.tradeCounts[key]=(p.tradeCounts[key]??0)+body.quantity;break;
        }
        case 'talk':{
          const npc=world.npcs.find(n=>n.id===body.npcId&&n.enabled&&n.sceneId===p.sceneId&&isOpen(n.hours,this.now()));ensure(npc,'NPC_ABSENT','此刻该人物不在这里');ensure(Math.hypot(p.x-npc.x,p.y-npc.y)<6,'TOO_FAR','请靠近对话');
          const met=p.metNpcs.includes(npc.id);if(!met)p.metNpcs.push(npc.id);return {player:publicPlayer(p),dialogue:npc.dialogue[met?Math.min(1,npc.dialogue.length-1):0]};
        }
        case 'purchaseAppearance':{
          const shop=this.shop(world,p,body.buildingId),a=world.appearances.find(a=>a.id===body.appearanceId&&a.enabled);
          ensure(a&&a.partType!=='BASE'&&a.partType!=='HAIR','BAD_APPEARANCE','请选择可购买的服饰');ensure(shop.buildingType==='CLOTH','WRONG_SHOP','请前往服装店');ensure(a.genderScope==='ALL'||a.genderScope===p.appearance!.gender,'INCOMPATIBLE','此部件不适配当前角色');ensure(!p.cosmetics.includes(a.id),'ALREADY_OWNED','已经拥有该服饰');money(p,-a.price,'COSMETIC_BUY',a.id,body.requestId);p.cosmetics.push(a.id);break;
        }
        case 'changeAppearance':{
          const shop=this.shop(world,p,body.buildingId),a=world.appearances.find(a=>a.id===body.appearanceId);
          ensure(a&&a.partType!=='BASE'&&a.partType!=='ACCESSORY','BAD_APPEARANCE','部件不可穿戴');ensure(a.genderScope==='ALL'||a.genderScope===p.appearance!.gender,'INCOMPATIBLE','此部件不适配当前角色');ensure(a.colors.includes(body.colorId),'BAD_COLOR','配色不适配');
          if(a.partType==='HAIR'){ensure(shop.buildingType==='SALON'&&a.enabled,'WRONG_SHOP','请前往美发室选择有效发型');money(p,-a.price,'HAIRCUT',a.id,body.requestId);if(!p.cosmetics.includes(a.id))p.cosmetics.push(a.id);}
          else{ensure(shop.buildingType==='CLOTH','WRONG_SHOP','请在服装店试衣');ensure(p.cosmetics.includes(a.id),'NOT_OWNED','尚未拥有该服饰',403);}
          const ap=p.appearance!;if(a.partType==='HAIR'){ap.hairStyleId=a.id;ap.hairColorId=body.colorId;}if(a.partType==='TOP'){ap.topStyleId=a.id;ap.topColorId=body.colorId;}if(a.partType==='BOTTOM'){ap.bottomStyleId=a.id;ap.bottomColorId=body.colorId;}if(a.partType==='SHOES')ap.shoesId=a.id;break;
        }
      }
      return {player:publicPlayer(p)};
    });
  }
  shop(world:WorldConfig,p:PlayerState,id:string){const b=world.buildings.find(b=>b.id===id&&b.enabled);ensure(b&&b.interiorSceneId===p.sceneId,'WRONG_SHOP','请先进入对应店铺');ensure(isOpen(b.openingHours,this.now()),'CLOSED','店铺已打烊');return b;}
}
