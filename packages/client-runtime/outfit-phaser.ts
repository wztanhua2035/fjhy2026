import type Phaser from 'phaser';
import type {GameController} from './index.js';
import {applyHairTexture} from './hair-phaser.js';
import {UI_DEPTH_BASE} from './assets.js';

/** The same functional fitting panel is installed in Web and WeChat scenes. */
export function installOutfitShop(scene:Phaser.Scene,game:GameController,width:number,height:number){
  const depth=UI_DEPTH_BASE+110,objects:Phaser.GameObjects.GameObject[]=[];
  const label=(x:number,y:number,value:string)=>{const t=scene.add.text(x,y,value,{fontFamily:'Microsoft YaHei, Arial',fontSize:'21px',color:'#334538',align:'center'}).setOrigin(.5).setDepth(depth+2);objects.push(t);return t;};
  const run=(action:()=>Promise<unknown>)=>void action().catch((error:Error)=>{game.message=error.message;game.onChange();});
  const button=(x:number,y:number,value:string,action:()=>void)=>{const t=label(x,y,value).setPadding(16,10).setBackgroundColor('#e6dbbb').setInteractive({useHandCursor:true});t.on('pointerdown',()=>{if(!game.busy)action();});return t;};
  const open=button(width-110,height-160,'看看衣服',()=>run(()=>game.openOutfitShop()));
  const backdrop=scene.add.rectangle(width/2,height/2,Math.min(600,width-40),320,0xfff9e9,.98).setDepth(depth).setInteractive();objects.push(backdrop);
  const title=label(width/2,height/2-112,'春衫衣坊');
  const info=label(width/2+70,height/2-48,'').setWordWrapWidth(330);
  const preview=scene.add.sprite(width/2-200,height/2+25,'formal-player-female',0).setOrigin(.5,59/64).setDisplaySize(110,110).setDepth(depth+2).setInteractive();objects.push(preview);
  let direction=0;preview.on('pointerdown',()=>{direction=(direction+1)%4;});
  const hint=label(width/2-195,height/2+65,'点人物转向').setFontSize(16);
  const previous=button(width/2-25,height/2+20,'上一件',()=>game.cycleOutfit(-1));
  const next=button(width/2+170,height/2+20,'下一件',()=>game.cycleOutfit(1));
  const confirm=button(width/2+120,height/2+90,'购买并穿上',()=>run(()=>game.confirmOutfit()));
  const cancel=button(width/2-120,height/2+90,'返回',()=>game.closeOutfitShop());
  const panel=[backdrop,title,info,preview,hint,previous,next,confirm,cancel];
  scene.cameras.main.ignore(objects);
  const update=()=>{
    open.setVisible(!!game.player?.appearance&&game.canUseOutfitShop()&&!game.outfitPanelOpen);
    for(const object of panel)object.setVisible(game.outfitPanelOpen);
    if(!game.outfitPanelOpen)return;
    const current=game.outfitPanel(),ap=game.player?.appearance;
    if(ap){preview.setTexture(`formal-player-${ap.gender.toLowerCase()}`,direction*4);applyHairTexture(scene,preview,ap.gender,ap.hairId,game.hairCatalog.length?game.hairCatalog:undefined,ap.faceId,current?.outfit.outfitId);}
    info.setText(current?`${current.outfit.displayName}${current.current?' · 当前穿着':current.owned?' · 已拥有':''}\n价格 ${current.price} 文　铜钱 ${game.player?.cash??0} 文`:'暂无可用服装');
    confirm.setText(current?.current?'当前穿着':current?.owned?'穿上':'购买并穿上');
    confirm.setAlpha(!current||current.current||game.busy||!!game.pending ? .5 : 1);
  };
  update();scene.events.on('postupdate',update);
  scene.events.once('shutdown',()=>{scene.events.off('postupdate',update);game.closeOutfitShop();});
}
