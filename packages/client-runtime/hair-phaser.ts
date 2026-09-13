import type Phaser from 'phaser';
import type {GameController} from './index.js';
import {hairAssets,resolvedHair} from './hair-assets.js';
import {hairConfigs,type HairConfig} from '../game-config/hair-services.js';
import {UI_DEPTH_BASE} from './assets.js';

export function preloadHairAssets(scene:Phaser.Scene){for(const asset of hairAssets)scene.load.image(asset.key,asset.source);}
/** Body already includes the unchanged starter outfit. Compose once, then use
 * one sprite so frame, camera, depth, visibility and scale cannot diverge. */
export function composeHairTextures(scene:Phaser.Scene,configs:HairConfig[]=hairConfigs){
  for(const hair of configs){
    const key=`appearance:${hair.hairId}:${hair.assetResourceId}`,body=`player-${hair.gender.toLowerCase()}-body-v3`;
    if(scene.textures.exists(key)||!scene.textures.exists(body)||!scene.textures.exists(hair.assetResourceId))continue;
    const canvas=scene.textures.createCanvas(key,256,256);if(!canvas)continue;
    canvas.context.drawImage(scene.textures.get(body).getSourceImage() as HTMLImageElement,0,0);
    canvas.context.drawImage(scene.textures.get(hair.assetResourceId).getSourceImage() as HTMLImageElement,0,0);
    canvas.refresh();scene.textures.addSpriteSheet(key,canvas,{frameWidth:64,frameHeight:64});
  }
}
export function applyHairTexture(scene:Phaser.Scene,sprite:Phaser.GameObjects.Sprite,gender:'MALE'|'FEMALE',hairId?:string,configs:HairConfig[]=hairConfigs){
  const hair=configs.find(h=>h.hairId===hairId&&h.gender===gender)??resolvedHair(gender,hairId),key=`appearance:${hair.hairId}:${hair.assetResourceId}`;
  if(!scene.textures.exists(key))return; // Keep the existing complete-player fallback.
  const frame=sprite.frame.name,width=sprite.displayWidth,height=sprite.displayHeight,ox=sprite.originX,oy=sprite.originY;
  sprite.setTexture(key,frame).setOrigin(ox,oy).setDisplaySize(width,height);
}

export function installHairService(scene:Phaser.Scene,game:GameController,sprite:Phaser.GameObjects.Sprite,width:number,height:number,creation?:()=>{gender:'MALE'|'FEMALE';hairId:string}){
  composeHairTextures(scene);
  const depth=UI_DEPTH_BASE+100,objects:Phaser.GameObjects.GameObject[]=[];
  const text=(x:number,y:number,label:string)=>{const t=scene.add.text(x,y,label,{fontFamily:'Microsoft YaHei, Arial',fontSize:'21px',color:'#334538',align:'center'}).setOrigin(.5).setDepth(depth+2);objects.push(t);return t;};
  const run=(action:()=>Promise<unknown>)=>void action().catch((error:Error)=>{game.message=error.message;game.onChange();});
  const button=(x:number,y:number,label:string,action:()=>void)=>{const t=text(x,y,label).setPadding(16,10).setBackgroundColor('#e6dbbb').setInteractive({useHandCursor:true});t.on('pointerdown',()=>{if(!game.busy)action();});return t;};
  const open=button(width-110,height-218,'做个发型',()=>run(()=>game.openHairService()));
  const backdrop=scene.add.rectangle(width/2,height/2,Math.min(600,width-40),320,0xfff9e9,.98).setDepth(depth).setInteractive();objects.push(backdrop);
  const title=text(width/2,height/2-112,'青丝美发室');
  const info=text(width/2+65,height/2-48,'').setWordWrapWidth(350);
  let previewDirection=0;
  const preview=scene.add.sprite(width/2-200,height/2+25,'formal-player-female',0).setOrigin(.5,59/64).setDisplaySize(110,110).setDepth(depth+2).setInteractive();objects.push(preview);
  preview.on('pointerdown',()=>{previewDirection=(previewDirection+1)%4;});
  const previewHint=text(width/2-195,height/2+65,'点人物转向').setFontSize(16);
  const previous=button(width/2-25,height/2+20,'上一个',()=>game.cycleHair(-1));
  const next=button(width/2+170,height/2+20,'下一个',()=>game.cycleHair(1));
  const confirm=button(width/2+120,height/2+90,'确认更换',()=>run(()=>game.confirmHair()));
  const cancel=button(width/2-120,height/2+90,'返回',()=>game.closeHairService());
  const panel=[backdrop,title,info,preview,previewHint,previous,next,confirm,cancel];
  scene.cameras.main.ignore(objects);
  let previousConfig:HairConfig[]|undefined;
  const update=()=>{
    const configs=game.hairCatalog.length?game.hairCatalog:game.boot?.hairs??hairConfigs;
    if(configs!==previousConfig){composeHairTextures(scene,configs);previousConfig=configs;}
    const ap=game.player?.appearance??creation?.();
    if(ap&&sprite.visible)applyHairTexture(scene,sprite,ap.gender,game.player?.appearance?game.renderHairId:ap.hairId,configs);
    open.setVisible(!!game.player?.appearance&&game.canUseHairService()&&!game.hairPanelOpen);
    for(const object of panel)object.setVisible(game.hairPanelOpen);
    if(!game.hairPanelOpen)return;
    const current=game.hairPanel();
    if(ap){preview.setTexture(`formal-player-${ap.gender.toLowerCase()}`,previewDirection*4);applyHairTexture(scene,preview,ap.gender,current?.hair.hairId,configs);}
    info.setText(current?`${current.hair.displayName}${current.current?' · 当前发型':''}\n服务费 ${current.price} 文　铜钱 ${game.player?.cash??0} 文`:'暂无可用发型');
    confirm.setText(current?.current?'当前发型':game.busy?'正在确认…':'确认更换');
    confirm.setAlpha(!current||current.current||game.busy||!!game.pending? .5:1);
  };
  update();scene.events.on('postupdate',update);
  scene.events.once('shutdown',()=>{scene.events.off('postupdate',update);game.closeHairService();});
}
