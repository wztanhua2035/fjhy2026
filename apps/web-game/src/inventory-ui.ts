import {adoptRpgModal} from './rpg-modal';
import type {GameController} from '../../../packages/client-runtime/index.js';
import {itemCategoryNames} from '../../../packages/game-rules/inventory.js';

export function createInventoryUi(controller:GameController,root:HTMLElement){
  let open=false,selected='',category='ALL';
  const toggle=document.createElement('button'),panel=document.createElement('section');
  toggle.type='button';toggle.textContent='背包';toggle.onclick=()=>{open=!open;refresh();};
  panel.className='inventory-panel hidden';adoptRpgModal(panel,'行囊');root.replaceChildren(toggle);root.parentElement!.append(panel);
  function refresh(){
    const visible=open&&!controller.dialogue&&!controller.shopOpen;
    panel.classList.toggle('hidden',!visible);if(!visible)return;
    const entries=controller.inventoryItems();panel.replaceChildren();
    const heading=document.createElement('h3'),close=document.createElement('button');
    heading.textContent=`行囊 · ${entries.length} 类物品`;close.type='button';close.className='panel-close';close.textContent='关闭';
    close.onclick=()=>{open=false;refresh();};panel.append(heading,close);
    if(!entries.length){const empty=document.createElement('p');empty.textContent='行囊里暂时没有东西。';panel.append(empty);return;}
    const categories=['ALL',...Array.from(new Set(entries.map(item=>item.category)))];
    if(!categories.includes(category))category='ALL';
    const filters=document.createElement('div');filters.className='inventory-categories';
    for(const id of categories){const button=document.createElement('button');button.type='button';button.className=id===category?'active':'';button.textContent=id==='ALL'?'全部':itemCategoryNames[id as keyof typeof itemCategoryNames]??id;button.onclick=()=>{category=id;refresh();};filters.append(button);}panel.append(filters);
    const filtered=category==='ALL'?entries:entries.filter(item=>item.category===category);
    if(!filtered.some(item=>item.id===selected))selected=filtered[0]?.id??entries[0].id;
    const list=document.createElement('div');list.className='inventory-list';
    for(const item of filtered){
      const row=document.createElement('button');row.type='button';row.className=item.id===selected?'selected':'';
      row.setAttribute('aria-pressed',String(item.id===selected));
      const icon=document.createElement('span'),name=document.createElement('strong'),quantity=document.createElement('small');
      icon.className='inventory-icon';icon.textContent=item.icon;
      name.textContent=item.name;quantity.textContent=`×${item.quantity}`;
      row.append(icon,name,quantity);row.onclick=()=>{selected=item.id;refresh();};list.append(row);
    }
    const item=entries.find(entry=>entry.id===selected)!;
    const detail=document.createElement('div');detail.className='inventory-detail';
    const title=document.createElement('strong');title.textContent=`${item.icon} ${item.name}`;
    const meta=document.createElement('p');meta.textContent=`${itemCategoryNames[item.category]} · 持有 ${item.quantity} · ${item.usable?'可使用':'暂不可使用'}`;
    const description=document.createElement('p');description.textContent=item.description||'暂无说明。';
    detail.append(title,meta,description);
    if(item.usable){const use=document.createElement('button');use.type='button';use.textContent='使用';use.disabled=controller.busy||!!controller.pending;use.onclick=()=>void controller.useItem(item.id).catch(error=>{controller.message=error.message??'使用失败';controller.onChange();});detail.append(use);}
    panel.append(list,detail);
  }
  return refresh;
}
