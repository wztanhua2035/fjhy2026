import type Phaser from 'phaser';
import type {GameController} from './index.js';
import {hairAssets,resolvedHair} from './hair-assets.js';
import {hairConfigs,type HairConfig} from '../game-config/hair-services.js';
import {defaultFaceId,faceConfigs} from '../game-config/face-templates.js';
import {headwearConfigs} from '../game-config/headwear.js';
import {outfitConfigs} from '../game-config/outfits.js';
import {UI_DEPTH_BASE} from './assets.js';
import {uiTokens} from './ui-design-tokens.js';
import {addUiButton,addUiPanel} from './ui-phaser.js';

export function preloadHairAssets(scene:Phaser.Scene){for(const asset of hairAssets)scene.load.image(asset.key,asset.source);}
function paintHeadwear(scene:Phaser.Scene,context:CanvasRenderingContext2D,headwearId:string|null){
  if(!headwearId)return;
  const config=headwearConfigs.find(item=>item.headwearId===headwearId&&item.enabled);
  if(config&&scene.textures.exists(config.assetResourceId))context.drawImage(scene.textures.get(config.assetResourceId).getSourceImage() as HTMLImageElement,0,0);
}
/** Compose complete textures from independent slots while retaining one sprite's
 * frame, foot anchor, camera and world depth. */
export function composeHairTextures(scene:Phaser.Scene,configs:HairConfig[]=hairConfigs,faceIds?:string[],outfitIds?:string[]){
  for(const hair of configs){
    const body=`player-${hair.gender.toLowerCase()}-body-v6`;
    for(const face of faceConfigs.filter(face=>face.gender===hair.gender&&face.enabled&&(!faceIds||faceIds.includes(face.faceId)))){
      for(const outfit of outfitConfigs.filter(outfit=>outfit.gender===hair.gender&&outfit.enabled&&(!outfitIds||outfitIds.includes(outfit.outfitId)))){
      const key=`appearance:${face.faceId}:${hair.hairId}:${outfit.outfitId}`;
      if(scene.textures.exists(key)||!scene.textures.exists(body)||!scene.textures.exists(outfit.assetResourceId)||!scene.textures.exists(face.assetResourceId)||!scene.textures.exists(hair.assetResourceId))continue;
      const canvas=scene.textures.createCanvas(key,256,256);if(!canvas)continue;
      // Composition is native-size, but explicitly keep the canvas in nearest-neighbour
      // mode so it cannot introduce a soft edge before Phaser receives the sheet.
      canvas.context.imageSmoothingEnabled=false;
      canvas.context.drawImage(scene.textures.get(body).getSourceImage() as HTMLImageElement,0,0);
      canvas.context.drawImage(scene.textures.get(outfit.assetResourceId).getSourceImage() as HTMLImageElement,0,0);
      canvas.context.drawImage(scene.textures.get(face.assetResourceId).getSourceImage() as HTMLImageElement,0,0);
      canvas.context.drawImage(scene.textures.get(hair.assetResourceId).getSourceImage() as HTMLImageElement,0,0);
      // Body/Outfit → Face → Hair → Headwear. The registry is empty in V1.
      paintHeadwear(scene,canvas.context,null);
      canvas.refresh();scene.textures.addSpriteSheet(key,canvas,{frameWidth:64,frameHeight:64});
      }
    }
  }
}
export function applyHairTexture(scene:Phaser.Scene,sprite:Phaser.GameObjects.Sprite,gender:'MALE'|'FEMALE',hairId?:string,configs:HairConfig[]=hairConfigs,faceId?:string,outfitId?:string){
  const hair=configs.find(h=>h.hairId===hairId&&h.gender===gender)??resolvedHair(gender,hairId),outfit=outfitConfigs.find(o=>o.outfitId===outfitId&&o.gender===gender)??outfitConfigs.find(o=>o.gender===gender)!,selectedFace=faceId??defaultFaceId(gender),key=`appearance:${selectedFace}:${hair.hairId}:${outfit.outfitId}`;
  if(!scene.textures.exists(key))composeHairTextures(scene,[hair],[selectedFace],[outfit.outfitId]);
  if(!scene.textures.exists(key))return; // Keep the existing complete-player fallback.
  const frame=sprite.frame.name,width=sprite.displayWidth,height=sprite.displayHeight,ox=sprite.originX,oy=sprite.originY;
  sprite.setTexture(key,frame).setOrigin(ox,oy).setDisplaySize(width,height);
}

export function installHairService(scene:Phaser.Scene,game:GameController,sprite:Phaser.GameObjects.Sprite,width:number,height:number,creation?:()=>{gender:'MALE'|'FEMALE';faceId:string;hairId:string},options:{contextButton?:boolean}={}){
  const depth=UI_DEPTH_BASE+100,objects:Phaser.GameObjects.GameObject[]=[];
  const text=(x:number,y:number,label:string)=>{const t=scene.add.text(x,y,label,{fontFamily:'Microsoft YaHei, Arial',fontSize:`${uiTokens.typography.bodyL}px`,color:uiTokens.colors.textPrimary,align:'center'}).setOrigin(.5).setDepth(depth+2);objects.push(t);return t;};
  const run=(action:()=>Promise<unknown>)=>void action().catch((error:Error)=>{game.message=error.message;game.onChange();});
  const button=(x:number,y:number,label:string,action:()=>void)=>{const t=addUiButton(scene,x,y,label,depth+2,()=>{if(!game.busy)action();});objects.push(t);return t;};
  const open=button(width-110,height-218,'做个发型',()=>run(()=>game.openHairService()));
  const backdrop=addUiPanel(scene,width/2,height/2,Math.min(600,width-40),320,depth);objects.push(backdrop);
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
  const update=()=>{
    const configs=game.hairCatalog.length?game.hairCatalog:game.boot?.hairs??hairConfigs;
    const ap=game.player?.appearance??creation?.();
    if(ap&&sprite.visible)applyHairTexture(scene,sprite,ap.gender,game.player?.appearance?game.renderHairId:ap.hairId,configs,ap.faceId,game.player?.appearance?game.renderOutfitId:('outfitId' in ap?ap.outfitId:undefined));
    open.setVisible(options.contextButton!==false&&!!game.player?.appearance&&game.canUseHairService()&&!game.hairPanelOpen);
    for(const object of panel)object.setVisible(game.hairPanelOpen);
    if(!game.hairPanelOpen)return;
    const current=game.hairPanel();
    if(ap){preview.setTexture(`formal-player-${ap.gender.toLowerCase()}`,previewDirection*4);applyHairTexture(scene,preview,ap.gender,current?.hair.hairId,configs,ap.faceId,'outfitId' in ap?ap.outfitId:undefined);}
    info.setText(current?`${current.hair.displayName}${current.current?' · 当前发型':''}\n服务费 ${current.price} 文　铜钱 ${game.player?.cash??0} 文`:'暂无可用发型');
    confirm.setText(current?.current?'当前发型':game.busy?'正在确认…':'确认更换');
    confirm.setAlpha(!current||current.current||game.busy||!!game.pending? .5:1);
  };
  update();scene.events.on('postupdate',update);
  scene.events.once('shutdown',()=>{scene.events.off('postupdate',update);game.closeHairService();});
}
