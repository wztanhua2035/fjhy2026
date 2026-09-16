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

type HairServiceOptions={contextButton?:boolean;webPanel?:boolean};

export function installHairService(scene:Phaser.Scene,game:GameController,sprite:Phaser.GameObjects.Sprite,width:number,height:number,creation?:()=>{gender:'MALE'|'FEMALE';faceId:string;hairId:string},options:HairServiceOptions={}){
  const depth=UI_DEPTH_BASE+100,objects:Phaser.GameObjects.GameObject[]=[],webPanel=options.webPanel===true;
  const text=(x:number,y:number,label:string,origin:{x:number;y:number}={x:.5,y:.5})=>{const t=scene.add.text(x,y,label,{fontFamily:'Microsoft YaHei, Arial',fontSize:`${uiTokens.typography.bodyL}px`,color:uiTokens.colors.textPrimary,align:'center'}).setOrigin(origin.x,origin.y).setDepth(depth+2);objects.push(t);return t;};
  const run=(action:()=>Promise<unknown>)=>void action().catch((error:Error)=>{game.message=error.message;game.onChange();});
  const button=(x:number,y:number,label:string,action:()=>void,variant:'primary'|'secondary'|'ghost'='secondary')=>{const t=addUiButton(scene,x,y,label,depth+2,()=>{if(!game.busy)action();},variant);objects.push(t);return t;};
  const open=button(width-110,height-218,'做个发型',()=>run(()=>game.openHairService()));
  const panelWidth=webPanel?Math.min(820,width-40):Math.min(700,width-36),panelHeight=webPanel?500:400,panelLeft=width/2-panelWidth/2,panelTop=height/2-panelHeight/2;
  const backdrop=addUiPanel(scene,width/2,height/2,panelWidth,panelHeight,depth);objects.push(backdrop);
  backdrop.setStrokeStyle(2,Number.parseInt(uiTokens.colors.divider.slice(1),16),1);
  const title=webPanel?text(panelLeft+30,panelTop+30,'青丝美发室',{x:0,y:.5}).setFontSize(24).setColor(uiTokens.colors.accent):text(width/2,height/2-165,'青丝美发室 · 发型服务').setFontSize(24).setColor(uiTokens.colors.accent);
  const subtitle=webPanel?text(panelLeft+30,panelTop+58,'发型服务',{x:0,y:.5}).setFontSize(16).setColor(uiTokens.colors.textMuted):text(0,0,'');
  const wallet=webPanel?text(panelLeft+panelWidth-70,panelTop+30,'',{x:1,y:.5}).setFontSize(17).setColor(uiTokens.colors.accent):text(0,0,'');
  const close=webPanel?button(panelLeft+panelWidth-28,panelTop+30,'×',()=>game.closeHairService(),'ghost'):button(0,0,'',()=>undefined,'ghost');
  const info=text(webPanel?panelLeft+panelWidth*.50:panelLeft+panelWidth*.67,webPanel?panelTop+358:height/2-72,'',{x:webPanel?0:.5,y:.5}).setWordWrapWidth(webPanel?panelWidth*.44:panelWidth*.42).setAlign('left').setFontSize(webPanel?17:19);
  let previewDirection=0;
  const preview=scene.add.sprite(webPanel?panelLeft+panelWidth*.235:panelLeft+panelWidth*.28,webPanel?panelTop+260:height/2-2,'formal-player-female',0).setOrigin(.5,59/64).setDisplaySize(webPanel?190:210,webPanel?190:210).setDepth(depth+2).setInteractive();objects.push(preview);
  preview.on('pointerdown',()=>{previewDirection=(previewDirection+1)%4;});
  const previewHint=text(webPanel?panelLeft+panelWidth*.235:panelLeft+panelWidth*.28,webPanel?panelTop+424:height/2+108,'点击角色可切换朝向').setFontSize(16).setColor(uiTokens.colors.textMuted);
  const previous=button(panelLeft+panelWidth*.60,height/2+82,'‹ 上一个',()=>game.cycleHair(-1));
  const next=button(panelLeft+panelWidth*.84,height/2+82,'下一个 ›',()=>game.cycleHair(1));
  const legacyCards=([0,1,2] as const).map(i=>button(panelLeft+panelWidth*(.56+i*.18),height/2+84,'',()=>{const item=(game.hairCatalog.length?game.hairCatalog:game.boot?.hairs??hairConfigs)[i];if(item){game.previewHairId=item.hairId;game.onChange();}},'ghost'));
  const cardWidth=Math.round(panelWidth*.44),cardLeft=panelLeft+panelWidth*.50,cardEntries=([0,1,2] as const).map(index=>{
    const y=panelTop+133+index*70,background=scene.add.rectangle(cardLeft+cardWidth/2,y,cardWidth,58,Number.parseInt(uiTokens.colors.panelElevated.slice(1),16),.98).setStrokeStyle(1,Number.parseInt(uiTokens.colors.divider.slice(1),16),1).setDepth(depth+2).setInteractive({useHandCursor:true}),name=text(cardLeft+14,y-10,'',{x:0,y:.5}).setFontSize(17),price=text(cardLeft+cardWidth-14,y-10,'',{x:1,y:.5}).setFontSize(16).setColor(uiTokens.colors.accent),badge=text(cardLeft+14,y+15,'',{x:0,y:.5}).setFontSize(13);
    objects.push(background);background.on('pointerdown',()=>{const item=(game.hairCatalog.length?game.hairCatalog:game.boot?.hairs??hairConfigs)[index];if(item){game.previewHairId=item.hairId;game.onChange();}});return {background,name,price,badge};
  });
  const confirm=button(webPanel?panelLeft+panelWidth-130:panelLeft+panelWidth*.73,webPanel?panelTop+panelHeight-38:height/2+145,'确认更换',()=>{const current=game.hairPanel();if(!current||current.current||(game.player?.cash??0)<current.price||game.busy||game.pending)return;run(()=>game.confirmHair());},'primary');
  const cancel=button(webPanel?panelLeft+62:panelLeft+panelWidth*.48,webPanel?panelTop+panelHeight-38:height/2+145,'返回',()=>game.closeHairService(),'ghost');
  const panel=[backdrop,title,subtitle,wallet,close,info,preview,previewHint,previous,next,...legacyCards,...cardEntries.flatMap(card=>[card.background,card.name,card.price,card.badge]),confirm,cancel];
  scene.cameras.main.ignore(objects);
  const update=()=>{
    const configs=game.hairCatalog.length?game.hairCatalog:game.boot?.hairs??hairConfigs;
    const ap=game.player?.appearance??creation?.();
    if(ap&&sprite.visible)applyHairTexture(scene,sprite,ap.gender,game.player?.appearance?game.renderHairId:ap.hairId,configs,ap.faceId,game.player?.appearance?game.renderOutfitId:('outfitId' in ap?ap.outfitId:undefined));
    open.setVisible(options.contextButton!==false&&!!game.player?.appearance&&game.canUseHairService()&&!game.hairPanelOpen);
    for(const object of panel)object.setVisible(game.hairPanelOpen);
    if(!game.hairPanelOpen)return;
    const current=game.hairPanel(),cash=game.player?.cash??0,insufficient=!!current&&cash<current.price,currentHairId=game.player?.appearance?.hairId;
    if(ap){preview.setTexture(`formal-player-${ap.gender.toLowerCase()}`,previewDirection*4);applyHairTexture(scene,preview,ap.gender,current?.hair.hairId,configs,ap.faceId,'outfitId' in ap?ap.outfitId:undefined);}
    wallet.setText(`铜钱 ${cash}文`);
    info.setText(current?webPanel?`当前预览\n${current.hair.displayName}\n\n服务费        ${current.price}文\n当前铜钱      ${cash}文${insufficient?`\n还差          ${current.price-cash}文`:''}`:`正在浏览\n${current.hair.displayName}\n\n当前状态：${current.current?'当前发型':insufficient?'铜钱不足':'可更换'}\n服务费：${current.price} 文\n当前铜钱：${cash} 文`:'暂无可用发型');
    confirm.setText(current?.current?'✓ 当前发型':game.busy||game.pending?'处理中…':insufficient?`还差 ${(current?.price??0)-cash} 文`:`花费 ${current?.price??0} 文更换`);
    confirm.setAlpha(!current||current.current||insufficient||game.busy||!!game.pending? .55:1);
    subtitle.setVisible(webPanel);wallet.setVisible(webPanel);close.setVisible(webPanel);previous.setVisible(!webPanel);next.setVisible(!webPanel);legacyCards.forEach(card=>card.setVisible(!webPanel));
    const list=configs;
    cardEntries.forEach((card,i)=>{const item=list[i],offer=game.hairOffers.find(candidate=>candidate.hairId===item?.hairId),isCurrent=item?.hairId===currentHairId,isPreview=item?.hairId===current?.hair.hairId;card.background.setVisible(webPanel&&!!item);card.name.setVisible(webPanel&&!!item).setText(item?.displayName??'');card.price.setVisible(webPanel&&!!item).setText(offer?`${offer.price}文`:'');card.badge.setVisible(webPanel&&!!item).setText(isCurrent?'当前':isPreview?'预览中':'').setColor(isCurrent?uiTokens.colors.accent:uiTokens.colors.textMuted);card.background.setFillStyle(Number.parseInt((isPreview?uiTokens.colors.accentSoft:uiTokens.colors.panelElevated).slice(1),16),.98);});
    legacyCards.forEach((card,i)=>{const item=list[i];card.setText(item?`${item.displayName}\n${item.hairId===current?.hair.hairId?'✓ 选中':item.hairId===currentHairId?'当前发型':'查看'}`:'');card.setAlpha(item?.hairId===current?.hair.hairId?1:.82);});
  };
  update();scene.events.on('postupdate',update);
  scene.events.once('shutdown',()=>{scene.events.off('postupdate',update);game.closeHairService();});
}
