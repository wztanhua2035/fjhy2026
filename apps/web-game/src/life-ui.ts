import type {GameController} from '../../../packages/client-runtime/index.js';
import {createRpgModal,rpgButton} from './rpg-modal';

const text=(tag:string,value:string,className='')=>{const node=document.createElement(tag);node.textContent=value;node.className=className;return node;};
export function createLifeUi(game:GameController,root:HTMLElement,openProfile:()=>void){
  let hours:1|3|6=1,direction=0,signature='',feedback='',working=false,lastKind='';
  const modal=createRpgModal(root,'life-panel',()=>{if(working||game.player?.life.sleep)return;if(game.outfitPanelOpen)game.closeOutfitShop();else game.closeGuestFacility();});
  const images=new Map<string,HTMLImageElement>();
  const run=async(action:()=>Promise<unknown>)=>{if(working)return;working=true;feedback='正在处理…';refresh();try{await action();feedback=game.message;}catch(error){feedback=error instanceof Error?error.message:'暂时无法操作';}finally{working=false;refresh();}};
  function preview(canvas:HTMLCanvasElement){
    const ap=game.player?.appearance,ctx=canvas.getContext('2d');if(!ap||!ctx||!ap.outfitId||!ap.faceId||!ap.hairId)return;
    const base='/scene-layers/baishi/formal',outfit=game.previewOutfitId??ap.outfitId;
    const paths=[`${base}/outfit-v1/player_${ap.gender.toLowerCase()}_body_v6.png`,`${base}/outfit-v1/${outfit.toLowerCase()}_v1.png`,`${base}/face-v2/${ap.faceId.toLowerCase()}_v2.png`,`${base}/hair-v3/${ap.hairId.toLowerCase()}_v3.png`];
    const layers=paths.map(path=>{let img=images.get(path);if(!img){img=new Image();img.onload=()=>{if(canvas.isConnected)preview(canvas);};img.src=path;images.set(path,img);}return img;});
    if(layers.some(img=>!img.complete||!img.naturalWidth))return;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
    for(const img of layers)ctx.drawImage(img,0,direction*64,64,64,0,0,256,256);
  }
  function refresh(){
    const kind=game.outfitPanelOpen?'wardrobe':game.facilityPanel;
    if(!kind){modal.hide();lastKind='';signature='';return;}
    if(kind!==lastKind){feedback='';hours=1;lastKind=kind;}
    const next=JSON.stringify([kind,game.player?.inventory,game.player?.storage,game.player?.life,game.player?.appearance,game.previewOutfitId,game.outfitMode,game.player?.cash,game.storageSide,game.storageItemId,game.storageQuantity,game.busy,working,feedback,hours,direction,game.quests]);
    if(next===signature)return;signature=next;
    modal.show((kind==='wardrobe'&&game.outfitMode==='shop')?'春衫衣坊':({bed:'休息',storage:'个人箱子',wardrobe:'我的衣柜',desk:'书桌记录'})[kind]);
    modal.panel.dataset.kind=kind;modal.body.replaceChildren();modal.footer.replaceChildren();modal.close.disabled=working||!!game.player?.life.sleep;
    const busy=working||game.busy||!!game.pending;
    const action=(label:string,fn:()=>Promise<unknown>,disabled=false)=>{const b=rpgButton(busy?'正在处理…':label,()=>void run(fn),'rpg-primary');b.disabled=busy||disabled;modal.footer.append(b);};
    if(kind==='bed'){
      const energy=game.player?.life.energy??100,bar=document.createElement('progress');bar.max=100;bar.value=energy;bar.setAttribute('aria-label','当前活力');
      modal.body.append(text('p',`当前活力　${energy} / 100`,'life-energy'),bar);
      if(game.player?.life.sleep){modal.body.append(text('p','放下今天的忙碌，好好休息。'));action('结束休息',()=>game.wakeSleep());}
      else{
        const options=text('div','','rest-options');
        for(const [h,name,description] of [[1,'小憩','稍微歇一会儿'],[3,'短睡','恢复一些精神'],[6,'完整睡眠','好好休息一觉']] as const){
          const card=rpgButton('',()=>{hours=h;refresh();},hours===h?'selected':'');card.setAttribute('aria-pressed',String(hours===h));
          card.append(text('strong',name),text('b',`${h} 小时`),text('span',description));options.append(card);
        }modal.body.append(options);action('开始休息',()=>game.startSleep(hours));
      }
    }else if(kind==='storage'){
      const columns=text('div','','storage-columns');
      for(const side of ['deposit','withdraw'] as const){
        const column=text('section','','storage-column');column.append(text('h3',side==='deposit'?'我的行囊':'个人箱子'));
        const list=text('div','','life-item-list'),source=side==='deposit'?game.player?.inventory:game.player?.storage;
        const entries=Object.entries(source??{}).filter(([,count])=>count>0);
        if(!entries.length)list.append(text('p','这里暂时没有物品。','rpg-empty'));
        for(const [id,count] of entries){
          const config=game.facilityItems.find(item=>item.id===id),locked=side==='deposit'&&(config?.questItem||config?.keyItem||config?.questOnly);
          const card=rpgButton('',()=>{game.storageSide=side;game.storageItemId=id;game.storageQuantity=1;game.onChange();},`rpg-item-card ${game.storageSide===side&&game.storageItemId===id?'selected':''}`);
          card.append(text('strong',config?.name??id),text('span',`持有 ×${count}${locked?' · 随身任务物品':''}`));card.disabled=busy||!!locked;card.setAttribute('aria-pressed',String(game.storageSide===side&&game.storageItemId===id));list.append(card);
        }column.append(list);columns.append(column);
      }modal.body.append(columns);
      const entry=game.storageEntries().find(item=>item.id===game.storageItemId),detail=game.inventoryItems().find(item=>item.id===game.storageItemId);
      modal.body.append(text('p',entry?`${entry.name} · ${game.storageSide==='deposit'?'行囊 → 箱子（存入）':'箱子 → 行囊（取出）'}`:'选择一件物品进行转移','life-selection'));
      modal.body.append(text('p',detail?.description??game.facilityItems.find(item=>item.id===game.storageItemId)?.description??'选中左侧物品存入，选中右侧物品取出。','life-description'));
      const quantity=text('div','','life-quantity');quantity.append(rpgButton('−',()=>game.setStorageQuantity(-1)),text('b',`${game.storageQuantity}`),rpgButton('+',()=>game.setStorageQuantity(1)));modal.footer.append(quantity);
      action(game.storageSide==='deposit'?'确认存入 →':'← 确认取出',()=>game.transferStorage(),!entry);
    }else if(kind==='wardrobe'){
      const layout=text('div','','wardrobe-layout'),left=text('section','','wardrobe-preview'),canvas=document.createElement('canvas');canvas.width=canvas.height=256;
      left.append(canvas);const turns=text('div','','life-directions');for(const [i,label] of ['正面','左侧','右侧','背面'].entries())turns.append(rpgButton(label,()=>{direction=i;refresh();},direction===i?'selected':''));left.append(turns);
      const list=text('div','','life-item-list');for(const outfit of game.outfitCatalog){const card=rpgButton('',()=>{game.previewOutfitId=outfit.outfitId;game.onChange();},`rpg-item-card ${game.previewOutfitId===outfit.outfitId?'selected':''}`);card.append(text('strong',outfit.displayName),text('span',outfit.outfitId===game.player?.appearance?.outfitId?'当前穿着':game.ownedOutfitIds.includes(outfit.outfitId)?'已拥有':`${game.outfitOffers.find(offer=>offer.outfitId===outfit.outfitId)?.price??0} 文`));card.disabled=busy;list.append(card);}
      layout.append(left,list);modal.body.append(layout);preview(canvas);const current=game.outfitPanel();if(game.outfitMode==='shop')modal.body.append(text('p',`当前铜钱：${game.player?.cash??0} 文`));action(current?.current?'当前穿着':current?.owned?'穿上':'购买并穿上',()=>game.confirmOutfit(),!current||current.current);
    }else{
      modal.body.append(text('p','一天的见闻，从这里慢慢记起。','life-description'));
      for(const quest of game.questTracker().filter(q=>!q.completed)) {const card=text('article','','desk-record');card.append(text('h3',quest.name),text('p',quest.currentObjective));modal.body.append(card);}
      if(!game.questTracker().some(q=>!q.completed))modal.body.append(text('p','暂时没有待办的委托。','rpg-empty'));
      modal.body.append(text('p','出门前看看行囊，回来后也别忘了休息。','desk-record'));
      modal.footer.append(rpgButton('查看角色资料',()=>{game.closeGuestFacility();openProfile();},'rpg-primary'));
    }
    const status=text('span',feedback,'life-feedback');status.setAttribute('role','status');modal.footer.prepend(status);
  }
  return refresh;
}
