import type { Appearance, Bootstrap, GhostProfile, PlayerState, SceneView } from '../shared-types/index.js';
export type Direction='up'|'down'|'left'|'right';
export interface Painter {rect(x:number,y:number,w:number,h:number,color:string):void;circle(x:number,y:number,r:number,color:string):void;text(text:string,x:number,y:number,size:number,color:string):void}
export function drawAppearance(p:Painter,a:Appearance,colors:Record<string,string>,x:number,y:number,scale=1,direction:Direction='down',frame=0){
  const rect=(dx:number,dy:number,w:number,h:number,c:string)=>p.rect(x+dx*scale,y+dy*scale,w*scale,h*scale,c),circle=(dx:number,dy:number,r:number,c:string)=>p.circle(x+dx*scale,y+dy*scale,r*scale,c);
  const skin=['#f0c9a4','#e9b78e','#f5d8ba','#d6a180','#e6bb9f','#f8d7af'][Math.max(0,Number(a.baseAvatarId.slice(-2))-1)%6];
  const hair=colors[a.hairColorId]??'#343948',top=colors[a.topColorId]??'#86ac92',bottom=colors[a.bottomColorId]??'#789fc5';
  const stride=Math.sin(frame*9)*2,variant=Number(a.hairStyleId.slice(-2));
  p.circle(x,y+17*scale,12*scale,'#00000018');
  if(a.gender==='FEMALE'||variant>3)rect(-10,-14,20,24,hair);
  rect(-8,7,7,10+stride,bottom);rect(1,7,7,10-stride,bottom);
  rect(-9,16+stride,8,4,'#3f454d');rect(1,16-stride,8,4,'#3f454d');
  rect(-10,-4,20,14,top);rect(-13,-1,4,11,skin);rect(9,-1,4,11,skin);
  if(Number(a.topStyleId.slice(-2))>1)rect(-1,-3,2,13,'#ffffff90');
  circle(0,-13,10,skin);rect(-10,-23,20,7+variant%3,hair);
  if(direction==='up')circle(0,-13,10,hair);
  else{if(direction!=='right')circle(-4,-12,1.2,'#343948');if(direction!=='left')circle(4,-12,1.2,'#343948');rect(-2,-7,4,1,'#bb786b');}
}
export type Transport=(path:string,body?:unknown,token?:string)=>Promise<any>;
export function uuid(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return (c==='x'?r:(r&3)|8).toString(16);});}
export function browserTransport(base=''):Transport{return async(path,body,token)=>{const response=await fetch(`${base}${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.message??'网络请求失败'),{status:response.status});return data;};}
export class GameController {
  token='';boot:Bootstrap|null=null;view:SceneView|null=null;ghosts:GhostProfile[]=[];direction:Direction='down';walkTime=0;
  x=12;y=15;busy=false;offline=false;message='欢迎来到横阳';pending:{path:string;body:any}|null=null;private lastSync=0;
  onChange=()=>{};
  constructor(public transport:Transport){}
  get player(){return this.boot?.player??null;}
  logout(){this.token='';this.boot=null;this.view=null;this.ghosts=[];this.pending=null;this.busy=false;this.offline=false;this.x=12;this.y=15;this.message='已退出，可以重新登录验证存档';this.onChange();}
  async loginDev(account:string){const data=await this.transport('/v1/auth/dev',{account});this.token=data.token;await this.refresh();}
  async loginWechat(code:string){const data=await this.transport('/v1/auth/wechat',{code});this.token=data.token;await this.refresh();}
  async refresh(){this.boot=await this.transport('/v1/bootstrap',undefined,this.token);this.x=this.player!.x;this.y=this.player!.y;if(this.player!.appearance)await this.loadScene();this.onChange();}
  async loadScene(){this.view=await this.transport(`/v1/world/scenes/${this.player!.sceneId}`,undefined,this.token);this.ghosts=[];this.transport(`/v1/scenes/${this.player!.sceneId}/ghosts`,undefined,this.token).then(data=>{this.ghosts=data.ghosts;this.onChange();}).catch(()=>{});}
  async write(path:string,body:any){
    if(this.busy)throw new Error('操作正在确认，请稍候');if(this.pending)throw new Error('上次操作尚未确认，请先重试');
    if(this.offline)throw new Error('离线期间暂停交易，请先重新连接');
    this.pending={path,body:{...body,requestId:uuid()}};return this.retry();
  }
  async retry(){if(this.busy)return;if(!this.pending){try{await this.refresh();this.offline=false;this.message='连接已恢复';}catch{this.offline=true;this.message='场景加载失败，请再次重连';}this.onChange();return;}this.busy=true;this.onChange();const op=this.pending;
    try{const result=await this.transport(op.path,op.body,this.token);this.pending=null;this.offline=false;if(result.player){const old=this.player?.sceneId;this.boot!.player=result.player;this.x=result.player.x;this.y=result.player.y;if(old!==result.player.sceneId||!this.view)await this.loadScene();}this.message=result.dialogue??'操作已完成';return result;}
    catch(e:any){this.message=e.message;if(e.status){this.pending=null;this.x=this.player?.x??this.x;this.y=this.player?.y??this.y;}else{this.offline=true;this.message=this.pending?'网络中断，操作结果待确认。点击重试，使用同一请求编号。':'操作已确认，场景加载失败，请重新连接。';}throw e;}
    finally{this.busy=false;this.onChange();}
  }
  async create(gender:'MALE'|'FEMALE',baseAvatarId:string,hairColorId:string,topColorId:string,bottomColorId:string){await this.write('/v1/player/appearance/create',{gender,baseAvatarId,hairColorId,topColorId,bottomColorId});}
  tick(dt:number,dx:number,dy:number){if(!this.view||!this.player?.appearance)return;
    this.walkTime+=dt;
    if(((!this.busy&&!this.pending)||this.offline)&&(dx||dy)){
      const norm=Math.hypot(dx,dy);dx/=norm;dy/=norm;const nx=this.x+dx*dt*5,ny=this.y+dy*dt*5;
      if(this.offline||Math.hypot(nx-this.player.x,ny-this.player.y)<5){if(this.stand(nx,this.y))this.x=nx;if(this.stand(this.x,ny))this.y=ny;}
      this.direction=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';
    }
    this.lastSync+=dt;if(this.lastSync>.4&&!this.busy&&!this.pending&&!this.offline&&Math.hypot(this.x-this.player.x,this.y-this.player.y)>.05){this.lastSync=0;void this.sync().catch(()=>{});}
  }
  stand(x:number,y:number){const v=this.view!;return x>=1&&y>=1&&x<=v.scene.width-1&&y<=v.scene.height-1&&![...v.scene.collision,...v.plots.filter(p=>p.buildingId)].some(r=>x>r.x-.3&&x<r.x+r.width+.3&&y>r.y-.3&&y<r.y+r.height+.3);}
  async sync(){if(this.player&&(this.x!==this.player.x||this.y!==this.player.y))await this.write('/v1/player/move',{x:this.x,y:this.y});}
  nearby(){const v=this.view;if(!v)return null;
    for(const p of v.scene.portals)if(Math.hypot(p.x-this.x,p.y-this.y)<4)return {label:'走出房间',path:'/v1/world/portal',body:{portalId:p.id}};
    for(const p of v.plots)if(p.buildingId&&Math.hypot(p.entranceX-this.x,p.entranceY-this.y)<4)return {label:`进入${v.buildings.find(b=>b.id===p.buildingId)?.name??'建筑'}`,path:'/v1/world/enter',body:{plotId:p.id}};
    for(const n of v.npcs)if(Math.hypot(n.x-this.x,n.y-this.y)<6)return {label:`与${n.name}交谈`,path:'/v1/npc/talk',body:{npcId:n.id}};
    return null;
  }
  async interact(){const target=this.nearby();if(target){await this.sync();await this.write(target.path,target.body);}}
  async trade(action:'buy'|'sell',itemId:string,quantity=1){await this.sync();await this.write(`/v1/economy/${action}`,{buildingId:this.view!.scene.buildingId,itemId,quantity});}
  render(p:Painter,width:number,height:number,drawTerrain=true){
    const v=this.view;if(!v)return;if(drawTerrain)p.rect(0,0,width,height,'#b7cba5');
    const tile=32,ox=width/2-this.x*tile,oy=height/2-this.y*tile;
    const rect=(x:number,y:number,w:number,h:number,c:string)=>p.rect(ox+x*tile,oy+y*tile,w*tile,h*tile,c);
    if(drawTerrain){if(v.scene.buildingId){rect(0,0,v.scene.width,v.scene.height,'#e8d9bc');for(let y=0;y<v.scene.height;y+=2)rect(0,y,v.scene.width,.025,'#d5c4a6');}
    else{for(let y=0;y<v.scene.height;y+=3)for(let x=0;x<v.scene.width;x+=3)if((x+y)%9===0)rect(x,y,.15,.12,'#91b28c');}
    for(const r of v.scene.roads){rect(r.x,r.y,r.width,r.height,'#e9dfc9');rect(r.x,r.y,r.width,.06,'#c1b99f');}}
    for(const r of v.scene.collision){rect(r.x,r.y,r.width,r.height,'#977b61');}
    for(const plot of v.plots){const b=v.buildings.find(b=>b.id===plot.buildingId);
      if(b){rect(plot.x+.18,plot.y+.2,plot.width,plot.height,'#00000020');rect(plot.x,plot.y,plot.width,plot.height,'#f4e4cb');rect(plot.x-.25,plot.y-.2,plot.width+.5,1.6,['#688f83','#879bb3','#b4826a','#a7879c','#7b9a76'][v.buildings.indexOf(b)%5]);rect(plot.x+.6,plot.y+2,1,1.2,'#8aa8ad');rect(plot.x+plot.width-1.6,plot.y+2,1,1.2,'#8aa8ad');rect(plot.entranceX-.5,plot.y+3.4,1,1.6,'#876957');p.text(b.name,ox+(plot.x+plot.width/2)*tile,oy+(plot.y+2.5)*tile,15,'#4e4a43');}
      else{rect(plot.x,plot.y,plot.width,plot.height,'#bed0ac');p.text('空置地块 · 待开发',ox+(plot.x+plot.width/2)*tile,oy+(plot.y+2.5)*tile,13,'#62765a');}
    }
    for(const portal of v.scene.portals){rect(portal.x-.7,portal.y-.25,1.4,.5,'#91b7a3');p.text('出口 ↓',ox+portal.x*tile,oy+(portal.y-1)*tile,16,'#486d5d');}
    const defaultAp=this.player!.appearance!;
    const people=[...v.npcs.map(n=>({x:n.x,y:n.y,name:n.name,appearance:defaultAp,ghost:false})),...this.ghosts.slice(0,6).map((g,i)=>({x:(v.scene.buildingId?5:14)+i*3,y:v.scene.buildingId?12:43,name:`${g.nickname} · 留影`,appearance:g.appearance,ghost:true})),{x:this.x,y:this.y,name:'你',appearance:defaultAp,ghost:false}].sort((a,b)=>a.y-b.y);
    for(const person of people){drawAppearance(p,person.appearance,this.boot!.colors,ox+person.x*tile,oy+person.y*tile,1,person.name==='你'?this.direction:'down',person.name==='你'?this.walkTime:0);p.text(person.name,ox+person.x*tile,oy+person.y*tile-34,12,person.ghost?'#6c648d':'#445749');}
    if(v.phase==='夜晚'||v.phase==='深夜')p.rect(0,0,width,height,v.phase==='深夜'?'#23305266':'#34416b44');
  }
}
