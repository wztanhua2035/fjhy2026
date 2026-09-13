import type {GameController} from '../../../packages/client-runtime/index.js';
import {itemCategoryNames} from '../../../packages/game-rules/inventory.js';

export function createInventoryUi(controller:GameController,root:HTMLElement){
  let open=false,selected='';
  const toggle=document.createElement('button'),panel=document.createElement('section');
  toggle.type='button';toggle.textContent='背包';toggle.onclick=()=>{open=!open;refresh();};
  panel.className='inventory-panel hidden';root.replaceChildren(toggle,panel);
  function refresh(){
    const visible=open&&!controller.dialogue&&!controller.shopOpen;
    panel.classList.toggle('hidden',!visible);if(!visible)return;
    const entries=controller.inventoryItems();panel.replaceChildren();
    const heading=document.createElement('h3');heading.textContent='背包';panel.append(heading);
    if(!entries.length){const empty=document.createElement('p');empty.textContent='行囊里暂时没有东西。';panel.append(empty);return;}
    if(!entries.some(item=>item.id===selected))selected=entries[0].id;
    const list=document.createElement('div');list.className='inventory-list';
    for(const item of entries){const row=document.createElement('button');row.type='button';row.className=item.id===selected?'selected':'';row.textContent=`${item.icon} ${item.name} ×${item.quantity}`;row.onclick=()=>{selected=item.id;refresh();};list.append(row);}
    const item=entries.find(entry=>entry.id===selected)!;
    const detail=document.createElement('div');detail.className='inventory-detail';
    const title=document.createElement('strong');title.textContent=item.name;
    const meta=document.createElement('p');meta.textContent=`${itemCategoryNames[item.category]} · 持有 ${item.quantity} · ${item.usable?'可使用':'暂不可使用'}`;
    const description=document.createElement('p');description.textContent=item.description||'暂无说明。';
    detail.append(title,meta,description);
    if(item.usable){const use=document.createElement('button');use.type='button';use.textContent='使用';use.disabled=controller.busy||!!controller.pending;use.onclick=()=>void controller.useItem(item.id).catch(error=>{controller.message=error.message??'使用失败';controller.onChange();});detail.append(use);}
    panel.append(list,detail);
  }
  return refresh;
}
