import { _decorator,Component,Node,Canvas,Camera,UITransform,Graphics,Color,Label,Sprite,SpriteFrame,ImageAsset,input,Input,EventKeyboard,KeyCode,Layers,view,ResolutionPolicy,resources,TiledMap,TiledMapAsset } from 'cc';
import { GameController,drawAppearance,type Painter,type Direction,type Transport } from './generated/client-runtime/index';
import type { Appearance } from './generated/shared-types/index';
import { environment } from './Environment';
declare const wx:undefined|{login(options:{success:(result:{code:string})=>void;fail:(e:unknown)=>void}):void;request(options:any):void};
const {ccclass}=_decorator;
const W=960,H=540;
const BAISHI_RUNTIME_LAYERS=[
  {path:'scenes/baishi/ground/baishi_composition_approved_v01',foreground:false,enabled:true},
  {path:'scenes/baishi/buildings/baishi_buildings_north_candidate_v01',foreground:false,enabled:false},
  {path:'scenes/baishi/buildings/baishi_buildings_south_candidate_v01',foreground:false,enabled:false},
  {path:'scenes/baishi/foreground_branch_01',foreground:true,enabled:false},
  {path:'scenes/baishi/foreground_tree_canopy_01',foreground:true,enabled:false},
  {path:'scenes/baishi/foreground_eave_inn_01',foreground:true,enabled:false},
  {path:'scenes/baishi/foreground_eave_shop_01',foreground:true,enabled:false}
] as const;
@ccclass('GameRuntime')
export class GameRuntime extends Component {
  private controller!:GameController;private platform!:WeChatPlatform;private graphics!:Graphics;private world!:Node;private hud!:Node;private labels:Node[]=[];private labelIndex=0;private tileNode!:Node;private tiled!:TiledMap;private sceneLayers!:Node;private sceneForeground!:Node;private tileReady=false;private layerReady=false;
  private keys=new Set<number>();private touchX=0;private touchY=0;private selected=1;private gender:'MALE'|'FEMALE'='FEMALE';private skinColor='SKIN_LIGHT';private colors=['INK','SAGE','CREAM'];private direction:Direction='down';private sceneId='';private appearanceIndex=0;private appearanceColor='SAGE';private status='正在登录…';
  start(){
    view.setDesignResolutionSize(W,H,ResolutionPolicy.SHOW_ALL);
    const canvas=new Node('Canvas');canvas.layer=Layers.Enum.UI_2D;this.node.addChild(canvas);canvas.addComponent(UITransform).setContentSize(W,H);canvas.addComponent(Canvas);
    const cameraNode=new Node('Camera');canvas.addChild(cameraNode);cameraNode.setPosition(0,0,1000);const camera=cameraNode.addComponent(Camera);camera.projection=Camera.ProjectionType.ORTHO;camera.orthoHeight=H/2;camera.visibility=Layers.Enum.UI_2D;camera.clearColor=new Color(239,242,228,255);
    this.tileNode=new Node('Tiled Terrain');this.tileNode.layer=Layers.Enum.UI_2D;canvas.addChild(this.tileNode);this.tileNode.addComponent(UITransform);this.tiled=this.tileNode.addComponent(TiledMap);
    this.sceneLayers=new Node('Baishi Layers');this.sceneLayers.layer=Layers.Enum.UI_2D;canvas.addChild(this.sceneLayers);
    this.world=new Node('World');this.world.layer=Layers.Enum.UI_2D;canvas.addChild(this.world);this.world.addComponent(UITransform).setContentSize(W,H);this.graphics=this.world.addComponent(Graphics);
    this.sceneForeground=new Node('Baishi Foreground');this.sceneForeground.layer=Layers.Enum.UI_2D;canvas.addChild(this.sceneForeground);
    this.hud=new Node('HUD');this.hud.layer=Layers.Enum.UI_2D;canvas.addChild(this.hud);this.hud.addComponent(UITransform).setContentSize(W,H);
    this.platform=new WeChatPlatform(environment.apiBase);
    this.controller=new GameController(this.platform.transport as Transport);this.controller.onChange=()=>{this.status=this.controller.message;this.buildHUD();};
    input.on(Input.EventType.KEY_DOWN,this.keyDown,this);input.on(Input.EventType.KEY_UP,this.keyUp,this);
    this.buildHUD();void this.login();
  }
  private async login(){try{if(this.platform.canLoginWithWeChat)await this.controller.loginWechat(await this.platform.getLoginCode());else if(environment.allowDevLogin)await this.controller.loginDev(environment.devAccount);else throw new Error('请在微信小游戏中打开');}catch(e:any){this.status=e.message;this.buildHUD();}}
  private async relogin(){this.keys.clear();this.controller.logout();this.sceneId='';this.tileReady=false;this.tileNode.active=false;this.status='重新登录中…';this.buildHUD();await this.login();}
  private keyDown(e:EventKeyboard){this.keys.add(e.keyCode);if(e.keyCode===KeyCode.KEY_E)void this.run(()=>this.controller.interact());}
  private keyUp(e:EventKeyboard){this.keys.delete(e.keyCode);}
  private async run(fn:()=>Promise<unknown>){try{await fn();}catch(e:any){this.status=e.message;}this.buildHUD();}
  private label(text:string,x:number,y:number,size=18,parent=this.hud){const n=new Node('Text');n.layer=Layers.Enum.UI_2D;parent.addChild(n);n.setPosition(x-W/2,H/2-y);n.addComponent(UITransform).setContentSize(850,40);const l=n.addComponent(Label);l.string=text;l.fontSize=size;l.lineHeight=size+4;l.color=new Color(51,71,59);return n;}
  private button(text:string,x:number,y:number,w:number,fn:()=>void){const n=new Node('Button');n.layer=Layers.Enum.UI_2D;this.hud.addChild(n);n.setPosition(x-W/2,H/2-y);n.addComponent(UITransform).setContentSize(w,40);const g=n.addComponent(Graphics);g.fillColor=new Color(240,245,232,245);g.roundRect(-w/2,-20,w,40,7);g.fill();const l=new Node('Label');l.layer=Layers.Enum.UI_2D;n.addChild(l);l.addComponent(UITransform).setContentSize(w,40);const label=l.addComponent(Label);label.string=text;label.fontSize=16;label.lineHeight=32;label.color=new Color(48,81,60);n.on(Node.EventType.TOUCH_END,fn);return n;}
  private buildHUD(){
    if(!this.hud||this.touchX||this.touchY)return;for(const child of [...this.hud.children])child.destroy();const c=this.controller;
    if(!c?.boot){this.label('富甲横阳',480,200,40);this.label(this.status,480,270,18);this.button('重新登录',480,340,160,()=>void this.login());return;}
    if(!c.player?.appearance){this.label('初到横阳 · 创建你的角色',480,60,30);this.button(this.gender==='MALE'?'男 ✓':'男',260,125,90,()=>{this.gender='MALE';this.buildHUD();});this.button(this.gender==='FEMALE'?'女 ✓':'女',370,125,90,()=>{this.gender='FEMALE';this.buildHUD();});for(let i=1;i<=6;i++)this.button(`${this.selected===i?'✓ ':''}形象 ${i}`,200+(i-1)%3*110,195+Math.floor((i-1)/3)*55,100,()=>{this.selected=i;this.buildHUD();});
      [['肤色',this.skinColor],['发色',this.colors[0]],['上衣',this.colors[1]],['下装',this.colors[2]]].forEach(([name,value],i)=>this.button(`${name} · ${value}`,310,315+i*45,300,()=>{const keys=name==='肤色'?['SKIN_LIGHT','SKIN_WHEAT','SKIN_HONEY','SKIN_DEEP']:Object.keys(c.boot!.colors).filter(k=>!k.startsWith('SKIN_'));if(name==='肤色')this.skinColor=keys[(keys.indexOf(this.skinColor)+1)%keys.length];else{const index=['发色','上衣','下装'].indexOf(name as string);this.colors[index]=keys[(keys.indexOf(this.colors[index])+1)%keys.length];}this.buildHUD();}));
      this.button('旋转预览',710,405,150,()=>{const dirs:Direction[]=['down','left','up','right'];this.direction=dirs[(dirs.indexOf(this.direction)+1)%4];});
      this.button('确认形象，入住客栈',480,525,300,()=>void this.run(()=>c.create(this.gender,`${this.gender}_${String(this.selected).padStart(2,'0')}`,this.skinColor,this.colors[0],this.colors[1],this.colors[2])));
    }else{
      this.label(`${c.view?.scene.name??'横阳'} · ${c.view?.phase??''}　|　铜钱 ${c.player.cash} 文　|　大米 ${c.player.inventory.RICE_01??0}`,430,28,20);
if(c.dialogue)this.label(`${c.dialogueSpeaker??'白石街'}：${c.message}`,480,430,20);
      this.button('重登验存档',850,28,120,()=>void this.relogin());
      const dirs=[['↑',0,-1,95,500],['←',-1,0,45,550],['↓',0,1,95,600],['→',1,0,145,550]] as const;
      for(const [text,dx,dy,x,y] of dirs){const n=this.button(text,x,y,44,()=>{});n.on(Node.EventType.TOUCH_START,()=>{this.touchX=dx;this.touchY=dy;});for(const type of [Node.EventType.TOUCH_END,Node.EventType.TOUCH_CANCEL])n.on(type,()=>{this.touchX=0;this.touchY=0;this.buildHUD();});}
      this.button(c.nearby()?.label??'靠近门口 / NPC',765,560,280,()=>void this.run(()=>c.interact()));
      const b=c.view?.buildings.find(b=>b.id===c.view?.scene.buildingId);if(b){let y=100;for(const [id,s] of Object.entries(b.stock)){this.button(`${id==='RICE_01'?'大米':'米糕'} 买入 ${s.buy}文`,750,y,180,()=>void this.run(()=>c.trade('buy',id)));this.button(`卖出 ${s.sell}文`,750,y+45,180,()=>void this.run(()=>c.trade('sell',id)));y+=110;}
        if(b.buildingType==='SALON'||b.buildingType==='CLOTH'){const catalog=c.boot.appearances.filter(a=>a.genderScope===c.player!.appearance!.gender&&(b.buildingType==='SALON'?a.partType==='HAIR':['TOP','BOTTOM','SHOES'].includes(a.partType)));if(catalog.length){const item=catalog[this.appearanceIndex%catalog.length],owned=c.player.cosmetics.includes(item.id);this.label(`${item.name} · ${item.price} 文`,750,95,18);this.button('上一款',690,145,105,()=>{this.appearanceIndex=(this.appearanceIndex+catalog.length-1)%catalog.length;this.buildHUD();});this.button('下一款',810,145,105,()=>{this.appearanceIndex=(this.appearanceIndex+1)%catalog.length;this.buildHUD();});this.button(`配色 · ${this.appearanceColor}`,750,195,225,()=>{const choices=item.colors.length?item.colors:Object.keys(c.boot!.colors);this.appearanceColor=choices[(choices.indexOf(this.appearanceColor)+1+choices.length)%choices.length];this.buildHUD();});if(b.buildingType==='CLOTH'&&!owned)this.button('购买并永久拥有',750,245,225,()=>void this.run(()=>c.write('/v1/appearance/purchase',{buildingId:b!.id,appearanceId:item.id})));else this.button(b.buildingType==='SALON'?'付费理发并应用':'穿上已拥有服饰',750,245,225,()=>void this.run(()=>c.write('/v1/appearance/change',{buildingId:b!.id,appearanceId:item.id,colorId:this.appearanceColor})));}}}
    }
    this.label(this.status.slice(0,64),480,625,13);if(c.pending||c.offline)this.button(c.pending?'重试待确认操作':'重新连接',760,465,240,()=>void this.run(()=>c.retry()));
  }
  private loadLayer(path:string,parent:Node,worldX:number,worldY:number,width:number,height:number,requested:string,base=false){resources.load(path,ImageAsset,(err,image)=>{if(err||requested!==this.sceneId)return;const node=new Node(path);node.layer=Layers.Enum.UI_2D;parent.addChild(node);const sprite=node.addComponent(Sprite);const frame=new SpriteFrame();frame.texture=image;sprite.spriteFrame=frame;sprite.sizeMode=Sprite.SizeMode.CUSTOM;node.getComponent(UITransform)!.setContentSize(width,height);node.setPosition((worldX+width/32/2-this.controller.view!.scene.width/2)*32,(this.controller.view!.scene.height/2-(worldY+height/32/2))*32);if(base)this.layerReady=true;});}
  private painter():Painter{const g=this.graphics;return {rect:(x,y,w,h,c)=>{g.fillColor=new Color().fromHEX(c);g.rect(x-W/2,H/2-y-h,w,h);g.fill();},circle:(x,y,r,c)=>{g.fillColor=new Color().fromHEX(c);g.circle(x-W/2,H/2-y,r);g.fill();},text:(text,x,y,size)=>{let n=this.labels[this.labelIndex];if(!n){n=this.label(text,x,y,size,this.world);this.labels.push(n);}n.active=true;n.setPosition(x-W/2,H/2-y);const l=n.getComponent(Label)!;l.string=text;l.fontSize=size;this.labelIndex++;}};}
  update(dt:number){if(!this.controller||!this.graphics)return;const c=this.controller,k=this.keys;c.tick(Math.min(dt,.05),this.touchX+Number(k.has(KeyCode.KEY_D)||k.has(KeyCode.ARROW_RIGHT))-Number(k.has(KeyCode.KEY_A)||k.has(KeyCode.ARROW_LEFT)),this.touchY+Number(k.has(KeyCode.KEY_S)||k.has(KeyCode.ARROW_DOWN))-Number(k.has(KeyCode.KEY_W)||k.has(KeyCode.ARROW_UP)));
    this.graphics.clear();this.labelIndex=0;const p=this.painter();
    if(c.view&&this.sceneId!==c.view.scene.id){this.sceneId=c.view.scene.id;this.tileReady=false;this.layerReady=false;this.tileNode.active=false;this.sceneLayers.removeAllChildren();this.sceneForeground.removeAllChildren();const requested=this.sceneId;if(this.sceneId==='STREET_BAISHI_01'){const s=c.view.scene;for(const layer of BAISHI_RUNTIME_LAYERS.filter(layer=>layer.enabled)){this.loadLayer(layer.path,layer.foreground?this.sceneForeground:this.sceneLayers,0,0,s.width*32,s.height*32,requested,!layer.foreground);}}else{resources.load(c.view.scene.mapAsset.replace(/\\.tmx$/,''),TiledMapAsset,(err,asset)=>{if(err||requested!==this.sceneId)return;this.tiled.tmxAsset=asset;this.tileReady=true;this.tileNode.active=true;});}}
    if(c.view){const x=(c.view.scene.width/2-c.x)*32,y=(c.y-c.view.scene.height/2)*32;this.tileNode.setPosition(x,y);this.sceneLayers.setPosition(x,y);this.sceneForeground.setPosition(x,y);}
    if(c.player?.appearance)c.render(p,W,H,!(this.tileReady||this.layerReady),!(this.sceneId==='STREET_BAISHI_01'&&this.layerReady));else if(c.boot){p.rect(0,0,W,H,'#edf1e6');const a:Appearance={gender:this.gender,baseAvatarId:`${this.gender}_${String(this.selected).padStart(2,'0')}`,skinColorId:this.skinColor,hairStyleId:`HAIR_${this.gender}_01`,topStyleId:`TOP_${this.gender}_01`,bottomStyleId:`BOTTOM_${this.gender}_01`,shoesId:`SHOES_${this.gender}_01`,hairColorId:this.colors[0],topColorId:this.colors[1],bottomColorId:this.colors[2],accessoryIds:[]};drawAppearance(p,a,c.boot.colors,710,280,4,this.direction,c.walkTime);}
    for(let i=this.labelIndex;i<this.labels.length;i++)this.labels[i].active=false;
  }
  onDestroy(){input.off(Input.EventType.KEY_DOWN,this.keyDown,this);input.off(Input.EventType.KEY_UP,this.keyUp,this);}
}
