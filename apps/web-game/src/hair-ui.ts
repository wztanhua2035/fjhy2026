import type {GameController} from '../../../packages/client-runtime/index.js';
import {createRpgModal,rpgButton} from './rpg-modal';

const text=(tag:string,value:string,className='')=>{const node=document.createElement(tag);node.textContent=value;node.className=className;return node;};

/** Web Hair Service shares Spring Clothing's modal shell, preview column, cards and footer. */
export function createHairUi(game:GameController,root:HTMLElement){
  let direction=0,signature='',working=false;
  const modal=createRpgModal(root,'hair-panel',()=>{if(!working)game.closeHairService();});
  const images=new Map<string,HTMLImageElement>();
  const run=async(action:()=>Promise<unknown>)=>{if(working)return;working=true;refresh();try{await action();}catch(error){game.message=error instanceof Error?error.message:'暂时无法操作';}finally{working=false;refresh();}};
  const drawPreview=(canvas:HTMLCanvasElement)=>{
    const ap=game.player?.appearance,ctx=canvas.getContext('2d'),hairId=game.previewHairId??ap?.hairId;
    if(!ap||!ctx||!ap.outfitId||!ap.faceId||!hairId)return;
    const base='/scene-layers/baishi/formal',paths=[`${base}/outfit-v1/player_${ap.gender.toLowerCase()}_body_v6.png`,`${base}/outfit-v1/${ap.outfitId.toLowerCase()}_v1.png`,`${base}/face-v2/${ap.faceId.toLowerCase()}_v2.png`,`${base}/hair-v3/${hairId.toLowerCase()}_v3.png`];
    const layers=paths.map(path=>{let image=images.get(path);if(!image){image=new Image();image.onload=()=>{if(canvas.isConnected)drawPreview(canvas);};image.src=path;images.set(path,image);}return image;});
    if(layers.some(image=>!image.complete||!image.naturalWidth))return;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
    for(const image of layers)ctx.drawImage(image,0,direction*64,64,64,0,0,256,256);
  };
  function refresh(){
    if(!game.hairPanelOpen){modal.hide();signature='';return;}
    const next=JSON.stringify([game.player?.appearance,game.previewHairId,game.hairCatalog,game.hairOffers,game.player?.cash,game.busy,game.pending,working,direction]);
    if(next===signature)return;signature=next;
    modal.show('青丝美发室');modal.panel.dataset.kind='hair';modal.body.replaceChildren();modal.footer.replaceChildren();modal.close.disabled=working||game.busy||!!game.pending;
    const busy=working||game.busy||!!game.pending,current=game.hairPanel(),currentHairId=game.player?.appearance?.hairId,cash=game.player?.cash??0;
    const layout=text('div','','wardrobe-layout hair-service-layout'),left=text('section','','wardrobe-preview');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;left.append(canvas);
    const turns=text('div','','life-directions');for(const [index,label] of ['正面','左侧','右侧','背面'].entries())turns.append(rpgButton(label,()=>{direction=index;signature='';refresh();},direction===index?'selected':''));left.append(turns);
    const list=text('div','','life-item-list hair-service-list');
    for(const hair of game.hairCatalog){
      const offer=game.hairOffers.find(candidate=>candidate.hairId===hair.hairId),isCurrent=hair.hairId===currentHairId,isPreview=hair.hairId===game.previewHairId;
      const card=rpgButton('',()=>{if(busy)return;game.previewHairId=hair.hairId;game.onChange();},`rpg-item-card ${isPreview?'selected':''}`);
      const heading=text('div','','service-card-heading');heading.append(text('strong',hair.displayName),text('b',`${offer?.price??0} 文`));card.append(heading);
      if(isCurrent||isPreview)card.append(text('span',isCurrent?'当前发型':'预览中','service-card-badge'));
      card.disabled=busy;card.setAttribute('aria-pressed',String(isPreview));list.append(card);
    }
    layout.append(left,list);modal.body.append(layout);drawPreview(canvas);
    modal.footer.append(text('span',`当前铜钱：${cash}文`,'service-cash'));
    const insufficient=!!current&&cash<current.price,buttonLabel=!current?'暂无可用发型':busy?'处理中…':current.current?'✓ 当前发型':insufficient?`还差 ${current.price-cash} 文`:`花费 ${current.price} 文更换`;
    const action=rpgButton(buttonLabel,()=>void run(()=>game.confirmHair()),'rpg-primary');action.disabled=!current||busy||current.current||insufficient;modal.footer.append(action);
  }
  return refresh;
}
