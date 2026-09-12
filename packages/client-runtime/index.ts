import type { Appearance, FormalNpcAppearance, Bootstrap, GhostProfile, PlayerState, QuestRuntime, QuestTrackerItem, SceneView, ShopPanelView } from '../shared-types/index.js';
import {inEntranceArea,npcCollisionRect,questStepProgress} from '../game-rules/index.js';
export * from './assets.js';
export type Direction='up'|'down'|'left'|'right';
export interface Painter {rect(x:number,y:number,w:number,h:number,color:string):void;circle(x:number,y:number,r:number,color:string):void;text(text:string,x:number,y:number,size:number,color:string):void}
export function drawAppearance(p:Painter,input:Appearance|FormalNpcAppearance,colors:Record<string,string>,x:number,y:number,scale=1,direction:Direction='down',frame=0){
  const a:Appearance='hairStyleId' in input?input:{...input,baseAvatarId:input.baseAvatarId??`${input.gender}_01`,skinColorId:input.skinToneId,hairStyleId:input.hairId,hairColorId:'INK',topStyleId:input.outfitId,topColorId:'SAGE',bottomStyleId:`BOTTOM_${input.gender}_01`,bottomColorId:'BLUE',shoesId:`SHOES_${input.gender}_01`};
  const rect=(dx:number,dy:number,w:number,h:number,c:string)=>p.rect(x+dx*scale,y+dy*scale,w*scale,h*scale,c),circle=(dx:number,dy:number,r:number,c:string)=>p.circle(x+dx*scale,y+dy*scale,r*scale,c);
  const variant=Math.max(0,Math.min(5,Number(a.baseAvatarId.slice(-2))-1));
  const shapes=[
    {body:18,head:9.5,leg:7,height:0},
    {body:22,head:10.5,leg:8,height:-1},
    {body:16,head:9,leg:7,height:-3},
    {body:24,head:11,leg:8.5,height:1},
    {body:19,head:10,leg:7.5,height:3},
    {body:17,head:9.5,leg:7.5,height:-5}
  ][variant];
  const skin=colors[a.skinColorId??'']??['#f0c9a4','#e9b78e','#f5d8ba','#d6a180','#e6bb9f','#f8d7af'][variant];
  const modern=!!a.outfitId&&a.topStyleId===a.outfitId;
  const hair=modern&&a.gender==='MALE'?'#222b42':colors[a.hairColorId]??'#343948';
  const top=modern?(a.gender==='MALE'?'#83878c':'#de8eaa'):colors[a.topColorId]??'#86ac92';
  const bottom=modern?'#517fb8':colors[a.bottomColorId]??'#789fc5';
  const stride=Math.sin(frame*9)*2,variantHair=Number(a.hairStyleId.slice(-2));
  p.circle(x,y+(17+shapes.height)*scale,12*scale,'#00000018');
  const bodyX=shapes.body/2, legW=shapes.leg/2;
  if(a.gender==='FEMALE'||variantHair>3)rect(-bodyX,-14+shapes.height,shapes.body,24,hair);
  rect(-legW-1,7+shapes.height,legW,10+stride,bottom);rect(1,7+shapes.height,legW,10-stride,bottom);
  rect(-legW-1,16+shapes.height+stride,legW+1,4,'#3f454d');rect(1,16+shapes.height-stride,legW+1,4,'#3f454d');
  rect(-bodyX,-4+shapes.height,shapes.body,14,top);rect(-bodyX-3,-1+shapes.height,4,11,skin);rect(bodyX-1,-1+shapes.height,4,11,skin);
  if(Number(a.topStyleId.slice(-2))>1)rect(-1,-3+shapes.height,2,13,'#ffffff90');
  circle(0,-13+shapes.height,shapes.head,skin);rect(-shapes.head,-23+shapes.height,shapes.head*2,7+variantHair%3,hair);
  if(direction==='up')circle(0,-13+shapes.height,shapes.head,hair);
  else{if(direction!=='right')circle(-4,-12+shapes.height,1.2,'#343948');if(direction!=='left')circle(4,-12+shapes.height,1.2,'#343948');rect(-2,-7+shapes.height,4,1,'#bb786b');}
}export type Transport=(path:string,body?:unknown,token?:string)=>Promise<any>;
export function uuid(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return (c==='x'?r:(r&3)|8).toString(16);});}
export function formatQuestTracker(task:QuestTrackerItem){return task.completed?`${task.name}  ✓ 已完成\n${task.rewardSummary}（已发放）`:`${task.name}\n${task.currentStep}\n目标：${task.currentObjective}\n${task.rewardSummary}`;}
export function browserTransport(base=''):Transport{return async(path,body,token)=>{const response=await fetch(`${base}${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.message??'网络请求失败'),{status:response.status});return data;};}
export class GameController {
  token='';boot:Bootstrap|null=null;view:SceneView|null=null;ghosts:GhostProfile[]=[];quests:QuestRuntime[]=[];direction:Direction='down';walkTime=0;moving=false;private interactionCooldown=0;
  x=12;y=15;busy=false;offline=false;message='欢迎来到横阳';dialogue:string|null=null;dialogueSpeaker:string|null=null;pending:{path:string;body:any}|null=null;private interactionLabel='';private lastSync=0;private syncInFlight:Promise<unknown>|null=null;private correctionX=0;private correctionY=0;
  onChange=()=>{};
  constructor(public transport:Transport){}
  get player(){return this.boot?.player??null;}
  homeActions(){return this.player?.appearance?['继续游戏','重新开始'] as const:['开始游戏'] as const;}
  async restart(){await this.write('/v1/player/restart',{confirm:true});this.view=null;this.ghosts=[];this.quests=[];this.dialogue=null;this.dialogueSpeaker=null;await this.refresh();}
  logout(){this.token='';this.boot=null;this.view=null;this.ghosts=[];this.quests=[];this.pending=null;this.busy=false;this.offline=false;this.x=12;this.y=15;this.interactionCooldown=0;this.message='已退出，可以重新登录验证存档';this.dialogue=null;this.dialogueSpeaker=null;this.onChange();}
  async loginDev(account:string){const data=await this.transport('/v1/auth/dev',{account});this.token=data.token;await this.refresh();}
  async loginWechat(code:string){const data=await this.transport('/v1/auth/wechat',{code});this.token=data.token;await this.refresh();}
  async refresh(){this.boot=await this.transport('/v1/bootstrap',undefined,this.token);const taskData=await this.transport('/v1/quests',undefined,this.token);this.quests=taskData.quests??[];this.x=this.player!.x;this.y=this.player!.y;if(this.player!.appearance)await this.loadScene();this.onChange();}
  async loadScene(){this.view=await this.transport(`/v1/world/scenes/${this.player!.sceneId}`,undefined,this.token);const position=this.view?.playerPosition;if(position&&position.sceneId===this.player!.sceneId){this.boot!.player.x=position.x;this.boot!.player.y=position.y;this.x=position.x;this.y=position.y;}this.ghosts=[];this.transport(`/v1/scenes/${this.player!.sceneId}/ghosts`,undefined,this.token).then(data=>{this.ghosts=data.ghosts;this.onChange();}).catch(()=>{});}
  async write(path:string,body:any){
    if(this.busy)throw new Error('操作正在确认，请稍候');if(this.pending)throw new Error('上次操作尚未确认，请先重试');
    if(this.offline)throw new Error('离线期间暂停交易，请先重新连接');
    this.pending={path,body:{...body,requestId:uuid()}};return this.retry();
  }
  async retry(){if(this.busy)return;if(!this.pending){try{await this.refresh();this.offline=false;this.message='连接已恢复';}catch{this.offline=true;this.message='场景加载失败，请再次重连';}this.onChange();return;}this.busy=true;this.onChange();const op=this.pending;
    try{const knownNpcs=new Set(this.player?.metNpcs??[]),npc=this.view?.npcs.find(n=>n.id===op.body?.npcId);const result=await this.transport(op.path,op.body,this.token);this.pending=null;this.offline=false;this.dialogue=typeof result.dialogue==='string'?result.dialogue:null;this.dialogueSpeaker=this.dialogue?(npc?.name??'白石街'):null;if(result.player){const old=this.player?.sceneId;this.boot!.player=result.player;this.x=result.player.x;this.y=result.player.y;if(op.path==='/v1/player/restart'){this.view=null;this.ghosts=[];this.quests=[];}else if(old!==result.player.sceneId||!this.view)await this.loadScene();}const relationship=op.path==='/v1/npc/talk'&&npc?(knownNpcs.has(npc.id)?'关系状态：已认识。\n':'初次结识：'+npc.name+'。\n关系状态：已认识。\n'):'';this.message=relationship+(result.dialogue??'操作已完成');return result;}
    catch(e:any){this.dialogue=null;this.dialogueSpeaker=null;this.message=e.message;if(e.status){this.pending=null;this.x=this.player?.x??this.x;this.y=this.player?.y??this.y;}else{this.offline=true;this.message=this.pending?'网络中断，操作结果待确认。点击重试，使用同一请求编号。':'操作已确认，场景加载失败，请重新连接。';}throw e;}
    finally{this.busy=false;this.onChange();}
  }
  async create(gender:'MALE'|'FEMALE',selection:{skinToneId?:string;hairId?:string;outfitId?:string}):Promise<void>;
  async create(gender:'MALE'|'FEMALE',baseAvatarId:string,skinColorId:string,hairColorId:string,topColorId:string,bottomColorId:string):Promise<void>;
  async create(gender:'MALE'|'FEMALE',selection:string|{skinToneId?:string;hairId?:string;outfitId?:string},skinColorId?:string,hairColorId?:string,topColorId?:string,bottomColorId?:string){await this.write('/v1/player/appearance/create',typeof selection==='string'?{gender,baseAvatarId:selection,skinColorId,hairColorId,topColorId,bottomColorId}:{gender,...selection});}
  tick(dt:number,dx:number,dy:number){if(!this.view||!this.player?.appearance)return;this.interactionCooldown=Math.max(0,this.interactionCooldown-dt);
    this.walkTime+=dt;this.moving=!!(dx||dy)&&(!this.busy||this.offline);
    const correctionFactor=1-Math.exp(-dt*10);
    const correctionStepX=this.correctionX*correctionFactor,correctionStepY=this.correctionY*correctionFactor;
    if(this.stand(this.x+correctionStepX,this.y)&&this.stand(this.x,this.y+correctionStepY)){this.x+=correctionStepX;this.y+=correctionStepY;this.correctionX-=correctionStepX;this.correctionY-=correctionStepY;}
    if((!this.busy||this.offline)&&(dx||dy)){
      const norm=Math.hypot(dx,dy);dx/=norm;dy/=norm;const nx=this.x+dx*dt*5,ny=this.y+dy*dt*5;
      if(this.offline||Math.hypot(nx-this.player.x,ny-this.player.y)<5){if(this.traversable(this.x,this.y,nx,ny)){this.x=nx;this.y=ny;}}
      this.direction=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';
    }
    this.lastSync+=dt;if(this.lastSync>.4&&!this.busy&&!this.syncInFlight&&!this.offline&&Math.hypot(this.x-this.player.x,this.y-this.player.y)>.05){this.lastSync=0;void this.sync().catch(()=>{});}
    const interactionLabel=this.nearby()?.label??'互动';if(interactionLabel!==this.interactionLabel){this.interactionLabel=interactionLabel;this.onChange();}
  }
  stand(x:number,y:number){const v=this.view!;const staticBlocks=[...v.scene.collision,...v.plots.filter(p=>p.buildingId)];const npcBlocks=v.npcs.filter(n=>n.enabled).map(npcCollisionRect);return x>=1&&y>=1&&x<=v.scene.width-1&&y<=v.scene.height-1&&!staticBlocks.some(r=>x>r.x-.18&&x<r.x+r.width+.18&&y>r.y-.18&&y<r.y+r.height+.18)&&!npcBlocks.some(r=>x>r.x&&x<r.x+r.width&&y>r.y&&y<r.y+r.height);}
  traversable(fromX:number,fromY:number,toX:number,toY:number){for(let i=1;i<=8;i++){const t=i/8;if(!this.stand(fromX+(toX-fromX)*t,fromY+(toY-fromY)*t))return false;}return true;}
  async sync(){
    if(this.syncInFlight)return this.syncInFlight;
    if(!this.player||this.x===this.player.x&&this.y===this.player.y)return;
    const sentX=this.x,sentY=this.y;
    const request=this.transport('/v1/player/move',{x:sentX,y:sentY,requestId:uuid()},this.token).then((result:any)=>{
      if(result.player){this.boot!.player=result.player;if(result.positionRestored){this.x=result.player.x;this.y=result.player.y;this.correctionX=0;this.correctionY=0;}else{this.correctionX+=result.player.x-sentX;this.correctionY+=result.player.y-sentY;}this.offline=false;}
      return result;
    }).catch((error:any)=>{if(!error.status)this.offline=true;throw error;}).finally(()=>{this.syncInFlight=null;this.onChange();});
    this.syncInFlight=request;
    return request;
  }
  questProgress(){const ledger=this.player?.ledger??[];const bought=ledger.some(l=>l.type==='SHOP_BUY'&&l.referenceId.includes('RICE_01'));const sold=ledger.some(l=>l.type==='SHOP_SELL'&&l.referenceId.includes('RICE_01'));const accepted=ledger.some(l=>l.type==='QUEST_ACCEPTED'&&l.referenceId==='Q_001');const completed=ledger.some(l=>l.type==='QUEST_REWARD'&&l.referenceId==='Q_001');return {bought,sold,accepted,completed};}
  questTracker():QuestTrackerItem[]{const ledger=this.player?.ledger??[];return this.quests.flatMap(quest=>{const accepted=ledger.some(entry=>entry.type==='QUEST_ACCEPTED'&&entry.referenceId===quest.id),completed=ledger.some(entry=>entry.type==='QUEST_REWARD'&&entry.referenceId===quest.id);if(!accepted&&!completed)return [];const progress=questStepProgress(quest,ledger),pendingIndex=progress.findIndex((value,index)=>value<quest.steps[index].count),stepIndex=completed?quest.steps.length:pendingIndex<0?quest.steps.length-1:pendingIndex,step=quest.steps[Math.min(stepIndex,quest.steps.length-1)],awaitingReward=!completed&&pendingIndex<0;const fallbackTitle=`${step?.type??'任务'} ${step?.target??''}`.trim(),fallbackObjective=step?`${fallbackTitle} ×${step.count}`:'任务已完成';return [{id:quest.id,name:quest.name,state:completed?'completed':progress.some(Boolean)?'in_progress':'accepted',stepIndex,stepCount:quest.steps.length,currentStep:completed?'全部步骤已完成':awaitingReward?'全部步骤已完成 · 等待结算':`步骤 ${stepIndex+1}/${quest.steps.length} · ${step?.title??fallbackTitle}`,currentObjective:completed?'任务已完成':awaitingReward?'等待任务奖励结算':step?.objective??fallbackObjective,rewardSummary:`奖励：${quest.reward} 文`,completed}];});}
  async acceptQuest(){await this.write('/v1/quest/accept',{questId:'Q_001'});}
  nearby(){const v=this.view;if(!v)return null;
    for(const p of v.scene.portals)if(Math.hypot(p.x-this.x,p.y-this.y)<4)return {label:'走出房间',path:'/v1/world/portal',body:{portalId:p.id}};
    for(const p of v.plots)for(const entrance of p.entrances??[{id:`${p.id}_PRIMARY`,position:{x:p.entranceX,y:p.entranceY},interactionArea:{x:p.entranceX-.9,y:p.entranceY-.9,width:1.8,height:1.8}} as any])if(p.buildingId&&inEntranceArea(entrance,this.x,this.y))return {label:`进入${v.buildings.find(b=>b.id===p.buildingId)?.name??'建筑'}`,path:'/v1/world/enter',body:{plotId:p.id,entranceId:entrance.id}};
    for(const n of v.npcs)if(Math.hypot(n.x-this.x,n.y-this.y)<6)return {label:`与${n.name}交谈`,path:'/v1/npc/talk',body:{npcId:n.id}};
    return null;
  }
  async interact(){const target=this.nearby();if(!target)return;const entrance=target.path==='/v1/world/enter'?this.view?.plots.flatMap(p=>p.entrances??[]).find(e=>e.id===target.body.entranceId):undefined;const portal=target.path==='/v1/world/portal'?this.view?.scene.portals.find(p=>p.id===target.body.portalId):undefined;const returned=portal?this.view?.plots.flatMap(p=>p.entrances??[]).find(e=>e.id===portal.returnEntranceId):undefined;await this.sync();await this.write(target.path,target.body);if(entrance){this.direction=entrance.direction==='south'?'up':entrance.direction==='west'?'right':entrance.direction==='east'?'left':'down';this.message='进入建筑…';}else if(portal){if(returned)this.direction=returned.direction==='south'?'down':returned.direction==='west'?'left':returned.direction==='east'?'right':'up';this.interactionCooldown=.8;this.message='回到白石街…';}this.onChange();}
  async trade(action:'buy'|'sell',itemId:string,quantity=1){
    await this.sync();
    const building=this.view!.buildings.find(candidate=>candidate.id===this.view!.scene.buildingId);const firstTrade=!(this.player?.ledger??[]).some(entry=>(entry.type==='SHOP_BUY'||entry.type==='SHOP_SELL')&&entry.referenceId.startsWith((building?.id??'')+':'));
    const knownEntries=new Set(this.player?.ledger.map(entry=>entry.id)??[]);
    const result:any=await this.write(`/v1/economy/${action}`,{buildingId:this.view!.scene.buildingId,itemId,quantity});
    const entries=(result?.player?.ledger??[]).filter((entry:any)=>!knownEntries.has(entry.id));
    const tradeEntry=entries.find((entry:any)=>entry.type===(action==='buy'?'SHOP_BUY':'SHOP_SELL'));
    const rewardEntry=entries.find((entry:any)=>entry.type==='QUEST_REWARD'&&entry.referenceId==='Q_001');
    const itemName=itemId==='RICE_01'?'鸣山大米':itemId,relationshipNote=firstTrade&&building?'商号往来：'+building.name+'已记住你。':'';
    if(action==='buy')this.message=['购买成功',`获得：${itemName} ×${quantity}`,`花费：${Math.abs(tradeEntry?.amount??0)} 文`,`铜钱：${tradeEntry?.before??this.player?.cash} → ${tradeEntry?.after??this.player?.cash}`,`当前目标：将${itemName}带回白石商行出售。`].join('\n');
    else this.message=['出售成功',`出售：${itemName} ×${quantity}`,`获得：${tradeEntry?.amount??0} 文`,`关键步骤完成：已将${itemName}卖给白石商行。`,...(rewardEntry?['任务完成：第一桶金',`任务奖励：${rewardEntry.amount} 文`]:[]),`铜钱：${tradeEntry?.before??this.player?.cash} → ${rewardEntry?.after??tradeEntry?.after??this.player?.cash}`].join('\n');
    if(relationshipNote)this.message+='\n'+relationshipNote;
    this.dialogue=null;this.dialogueSpeaker=null;this.onChange();
  }
  shopPanel():ShopPanelView|null{const view=this.view,player=this.player,building=view?.buildings.find(candidate=>candidate.id===view.scene.buildingId);if(!view||!player||!building||!Object.keys(building.stock).length)return null;return {buildingId:building.id,title:building.name,balance:player.cash,items:Object.entries(building.stock).flatMap(([id,stock])=>{const item=view.items.find(candidate=>candidate.id===id);return item?[{id,name:item.name,icon:item.icon??'品',owned:player.inventory[id]??0,buyPrice:stock.buy,sellPrice:stock.sell,dailyLimit:stock.dailyLimit}]:[];})};}
  render(p:Painter,width:number,height:number,drawTerrain=true,drawStructures=true,drawNpcs=true,skipNpcIds:string[]=[],skipPlayer=false,drawCollision=true){
    const v=this.view;if(!v)return;if(drawTerrain)p.rect(0,0,width,height,'#b7cba5');
    const tile=32,ox=width/2-this.x*tile,oy=height/2-this.y*tile;
    const rect=(x:number,y:number,w:number,h:number,c:string)=>p.rect(ox+x*tile,oy+y*tile,w*tile,h*tile,c);
    if(drawTerrain){if(v.scene.buildingId){rect(0,0,v.scene.width,v.scene.height,'#e8d9bc');for(let y=0;y<v.scene.height;y+=2)rect(0,y,v.scene.width,.025,'#d5c4a6');}
    else{for(let y=0;y<v.scene.height;y+=3)for(let x=0;x<v.scene.width;x+=3)if((x+y)%9===0)rect(x,y,.15,.12,'#91b28c');}
    for(const r of v.scene.roads){rect(r.x,r.y,r.width,r.height,'#e9dfc9');rect(r.x,r.y,r.width,.06,'#c1b99f');}}
    if(drawCollision)for(const r of v.scene.collision){rect(r.x,r.y,r.width,r.height,'#977b61');}
    if(drawStructures)for(const plot of v.plots){const b=v.buildings.find(b=>b.id===plot.buildingId);
      if(b){rect(plot.x+.18,plot.y+.2,plot.width,plot.height,'#00000020');rect(plot.x,plot.y,plot.width,plot.height,'#f4e4cb');rect(plot.x-.25,plot.y-.2,plot.width+.5,1.6,['#688f83','#879bb3','#b4826a','#a7879c','#7b9a76'][v.buildings.indexOf(b)%5]);rect(plot.x+.6,plot.y+2,1,1.2,'#8aa8ad');rect(plot.x+plot.width-1.6,plot.y+2,1,1.2,'#8aa8ad');rect(plot.entranceX-.5,plot.y+3.4,1,1.6,'#876957');p.text(b.name,ox+(plot.x+plot.width/2)*tile,oy+(plot.y+2.5)*tile,15,'#4e4a43');}
      else{rect(plot.x,plot.y,plot.width,plot.height,'#bed0ac');p.text('空置地块 · 待开发',ox+(plot.x+plot.width/2)*tile,oy+(plot.y+2.5)*tile,13,'#62765a');}
    }
    for(const portal of v.scene.portals){rect(portal.x-.7,portal.y-.25,1.4,.5,'#91b7a3');p.text('出口 ↓',ox+portal.x*tile,oy+(portal.y-1)*tile,16,'#486d5d');}
    const defaultAp=this.player!.appearance!;
const people=[...(drawNpcs?v.npcs.filter(n=>!skipNpcIds.includes(n.id)).map(n=>({x:n.x,y:n.y,name:n.name,appearance:n.appearance??defaultAp,ghost:false})):[]),...(skipPlayer?[]:[...this.ghosts.slice(0,6).map((g,i)=>({x:(v.scene.buildingId?5:14)+i*3,y:v.scene.buildingId?12:43,name:`${g.nickname} · 留影`,appearance:g.appearance,ghost:true})),{x:this.x,y:this.y,name:'你',appearance:defaultAp,ghost:false}])].sort((a,b)=>a.y-b.y);
    for(const person of people){
      const isPlayer=person.name==='你', scale=isPlayer?1.45:person.ghost?1.05:1.25;
      drawAppearance(p,person.appearance,this.boot!.colors,ox+person.x*tile,oy+person.y*tile,scale,isPlayer?this.direction:'down',isPlayer?this.walkTime:0);
      p.text(person.name,ox+person.x*tile,oy+person.y*tile-(isPlayer?52:46),isPlayer?17:16,person.ghost?'#6c648d':'#445749');
    }
    if(v.phase==='夜晚'||v.phase==='深夜')p.rect(0,0,width,height,v.phase==='深夜'?'#23305266':'#34416b44');
  }
}
