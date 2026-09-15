import Phaser from 'phaser';
import { containSize, worldOrigin } from './presentation-layout';
import { fetchInteriorResource, decodeInterior, GENERIC_INTERIOR_BG, GENERIC_INTERIOR_FG } from './interior-resources';
import { dialogueContext, notificationDestination } from './dialogue-presentation';
import { questPresentation } from './quest-presentation';
import { hairConfigs } from '../../../packages/game-config/hair-services.js';
import { outfitConfigs } from '../../../packages/game-config/outfits.js';
import {preloadHairAssets,installHairService} from '../../../packages/client-runtime/hair-phaser.js';
import {installOutfitShop} from '../../../packages/client-runtime/outfit-phaser.js';
import { OUTDOOR_CAMERA_ZOOM, actorVisualScale, playerNameTopY, PLAYER_NAME_STYLE, PIXEL_ART_RENDER_CONFIG, assetUrl, remoteAsset, GameController, drawAppearance, formatQuestTracker, sceneLabelFor, baishiV2ArtAssets, hengyangInnV1ArtAssets, streetGroceryV1ArtAssets, qingsiHairSalonV1ArtAssets, baishiFormalArtRegistry, baishiInteriorArtRegistry, ImageAssetStore, GROUND_DEPTH, WORLD_BASE, PORTRAIT_DIM_DEPTH, PORTRAIT_DEPTH, DEBUG_DEPTH, worldActorDepth, worldBuildingDepth, buildingImagePosition, foregroundImagePosition, baishiShopSignPlacements, buildingDisplayName, shouldUseCustomSign, signTemplateTextStyle, type Direction, type Painter } from '../../../packages/client-runtime/index.js';
import { baishiBuildingObjectCollision, availableStarterLookOptions } from '../../../packages/game-config/index.js';
import type { Appearance } from '../../../packages/shared-types/index.js';
import { createWebPlatform } from './web-platform';
import { createInventoryUi } from './inventory-ui';
import {personalityChoices,randomIdentity,validatePlayerIdentity,type PersonalityTag} from '../../../packages/game-config/player-profile.js';
import { uiTokens } from '../../../packages/client-runtime/ui-design-tokens.js';
import { createWebDialogueUi } from './dialogue-ui';
import './style.css';
import './quest.css';
import './shop.css';
import './design-system.css';
import './web-polish.css';
import './life-ui.css';
import {adoptRpgModal,rpgButton} from './rpg-modal';
import {createLifeUi} from './life-ui';
import {WebFeedbackQueue,isTransientSceneMessage,transitionLoading} from './scene-feedback';

const WIDTH=960,HEIGHT=540,TILE=32;
for (const [name,value] of Object.entries(uiTokens.colors)) document.documentElement.style.setProperty(`--ui-${name}`,value);
const query=new URLSearchParams(location.search),debugOpenAll=import.meta.env.DEV&&query.get('debugOpenAll')==='1';
const platform=createWebPlatform(import.meta.env.VITE_API_BASE_URL??'',debugOpenAll);
const controller=new GameController(platform.transport);
const firstDayDebug=import.meta.env.DEV&&query.get('debugFirstDay')==='1'?document.createElement('pre'):null;
if(firstDayDebug){Object.assign(firstDayDebug.style,{position:'fixed',left:'12px',bottom:'12px',zIndex:'9999',maxWidth:'360px',padding:'8px',background:'#142b29e8',color:'#fff',fontSize:'12px',pointerEvents:'none'});document.body.append(firstDayDebug);}
const refreshInventory=()=>inventoryUi?.();
let inventoryUi:(()=>void)|undefined;
const imageAssets=new ImageAssetStore();
declare const __WEB_ASSET_BASE_URL__: string;
const WEB_ASSET_BASE_URL=import.meta.env.DEV?'/__fjhy_cdn__':__WEB_ASSET_BASE_URL__;
const remoteAssetDiagnostic=import.meta.env.DEV||(import.meta.env.VITE_API_BASE_URL??'').includes('staging');
const pressed=new Set<string>();
type Draft={gender:'MALE'|'FEMALE';faceId:string;hairId:string;outfitId:string;direction:Direction;surname:string;givenName:string;nickname:string;personalityTag:PersonalityTag|null};
const draft:Draft={gender:'FEMALE',faceId:'F_FACE_01',hairId:'F_HAIR_01',outfitId:'F_OUTFIT_01',direction:'down',surname:'',givenName:'',nickname:'',personalityTag:null};
function resetCreationDraft(){Object.assign(draft,{gender:'FEMALE',faceId:'F_FACE_01',hairId:'F_HAIR_01',outfitId:'F_OUTFIT_01',direction:'down',surname:'',givenName:'',nickname:'',personalityTag:null});creationStep=0;}
const byId=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const auth=byId<HTMLElement>('auth'),home=byId<HTMLElement>('home'),restartConfirm=byId<HTMLElement>('restart-confirm'),create=byId<HTMLElement>('create'),hud=byId<HTMLElement>('hud'),status=byId<HTMLElement>('status'),message=byId<HTMLElement>('message'),createMessage=byId<HTMLElement>('create-message'),questPanel=byId<HTMLElement>('quest-panel'),quest=byId<HTMLElement>('quest'),questToggle=byId<HTMLButtonElement>('quest-toggle'),questToggleIcon=byId<HTMLElement>('quest-toggle-icon'),shopPanel=byId<HTMLElement>('shop-panel'),shopTitle=byId<HTMLElement>('shop-title'),shopBalance=byId<HTMLElement>('shop-balance'),shopItems=byId<HTMLElement>('shop-items'),shopFeedback=byId<HTMLElement>('shop-feedback'),inventory=byId<HTMLElement>('inventory');
const dialogueUi=createWebDialogueUi(hud,()=>run(()=>controller.advanceDialogue()));
const notices=new WebFeedbackQueue();
let lastNoticeSource='',shownNoticeId=0,noticeTimer:ReturnType<typeof setTimeout>|undefined;
function presentNotice(){const notice=notices.current(controller.player?.sceneId,controller.transitionId);const blocked=notificationDestination(!!controller.dialogue,controller.shopOpen)!=='toast';message.classList.toggle('hidden',!notice||blocked);if(blocked){clearTimeout(noticeTimer);if(shownNoticeId)notices.dismiss(shownNoticeId);shownNoticeId=0;return;}if(!notice){shownNoticeId=0;return;}message.textContent=notice.text;message.dataset.kind=notice.kind;message.dataset.event=/获得|物品/.test(notice.text)?'item':/任务/.test(notice.text)?'quest':/奖励|文/.test(notice.text)?'reward':'tip';if(shownNoticeId===notice.id)return;shownNoticeId=notice.id;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{notices.dismiss(notice.id);presentNotice();},notice.kind==='result'?2800:2100);}
inventoryUi=createInventoryUi(controller,inventory);
let creationStep=0;
const creationNames=['选择性别','选择长相','选择完整发型','选择整套服装','姓名与外号','你最常说的是哪句话？','最终确认'];
const stepHeading=document.createElement('h2');create.insertBefore(stepHeading,byId('create-player'));
const identityPanel=document.createElement('div');identityPanel.id='creation-identity';identityPanel.innerHTML='<label>姓 <input id="creation-surname" maxlength="2" autocomplete="off"></label><label>名 <input id="creation-given" maxlength="2" autocomplete="off"></label><label>外号 <input id="creation-nickname" maxlength="3" autocomplete="off"></label><small>姓、名各 1～2 个汉字，外号 2～3 个汉字。</small><button type="button" id="creation-random">🎲 随机生成</button>';create.insertBefore(identityPanel,byId('create-player'));
const personalityPanel=document.createElement('div');personalityPanel.id='creation-personality';personalityPanel.className='personality-list';for(const choice of personalityChoices){const button=document.createElement('button');button.type='button';button.textContent=choice.quote;button.dataset.tag=choice.tag;button.onclick=()=>{draft.personalityTag=choice.tag;refreshCreation();};personalityPanel.append(button);}create.insertBefore(personalityPanel,byId('create-player'));
const confirmation=document.createElement('div');confirmation.id='creation-confirmation';create.insertBefore(confirmation,byId('create-player'));
const stepControls=document.createElement('div');stepControls.className='creation-navigation';stepControls.innerHTML='<button type="button" id="creation-back">上一步</button><button type="button" id="creation-next">下一步</button>';create.insertBefore(stepControls,byId('create-player'));
for(const [id,key] of [['creation-surname','surname'],['creation-given','givenName'],['creation-nickname','nickname']] as const)byId<HTMLInputElement>(id).oninput=e=>{draft[key]=(e.target as HTMLInputElement).value;};
byId<HTMLButtonElement>('creation-random').onclick=()=>void run(async()=>{for(let i=0;i<8;i++){Object.assign(draft,randomIdentity(draft.gender));const q=new URLSearchParams({surname:draft.surname,givenName:draft.givenName,nickname:draft.nickname});const result=await platform.transport(`/v1/player/identity/check?${q}`,undefined,controller.token);if(result.available)break;}refreshCreation();});
byId<HTMLButtonElement>('creation-back').onclick=()=>{creationStep=Math.max(0,creationStep-1);refreshCreation();};
byId<HTMLButtonElement>('creation-next').onclick=()=>{if(creationStep===4){try{validatePlayerIdentity({...draft,personalityTag:personalityChoices[0].tag});}catch(error:any){createMessage.textContent=error.message;return;}}if(creationStep===5&&!draft.personalityTag){createMessage.textContent='请先选择一句话';return;}createMessage.textContent='';creationStep=Math.min(6,creationStep+1);refreshCreation();};
const profileToggle=document.createElement('button');profileToggle.id='profile-toggle';profileToggle.textContent='个人档案';hud.append(profileToggle);
const resourceStatus=document.createElement('aside');resourceStatus.id='resource-status';resourceStatus.className='hidden';resourceStatus.setAttribute('role','status');hud.append(resourceStatus);
const scenePlaque=document.createElement('div');scenePlaque.id='scene-plaque';scenePlaque.setAttribute('aria-live','polite');hud.append(scenePlaque);
// The scene view is shared with the Phaser world; this DOM element remains fixed above it.
setInterval(()=>{scenePlaque.textContent=controller.player?.appearance?sceneLabelFor(controller.view?.scene):'';},200);
const profilePanel=document.createElement('section');profilePanel.id='profile-panel';profilePanel.className='hidden';adoptRpgModal(profilePanel,'个人档案');adoptRpgModal(shopPanel,'商品交易');hud.append(profilePanel);
const profileAvatar=document.createElement('canvas');profileAvatar.width=112;profileAvatar.height=112;profileAvatar.className='profile-avatar';
function refreshProfilePanel(){
  const player=controller.player,profile=player?.profile;
  profilePanel.replaceChildren();
  if(!profile){profilePanel.textContent='暂无角色档案';return;}
  const card=document.createElement('div');card.className='profile-card';
  const facts=document.createElement('div');
  const name=document.createElement('h2');name.className='profile-name';name.textContent=`${profile.surname}${profile.givenName}`;
  const nickname=document.createElement('small');nickname.className='profile-nickname';nickname.textContent=`外号 · ${profile.nickname}`;
  const hairName=hairConfigs.find(item=>item.hairId===player.appearance?.hairId)?.displayName??'尚未设定';const outfitName=outfitConfigs.find(item=>item.outfitId===player.appearance?.outfitId)?.displayName??'尚未设定';const rows:[string,string,string?][]=[['性格',profile.personalityTag],['铜钱',`${player.cash} 文`,'profile-cash'],['活力',`${player.stamina}`],['所在地',sceneLabelFor(controller.view?.scene)],['服装',outfitName],['发型',hairName]];
  facts.append(name,nickname);
  for(const [label,value,className] of rows){const row=document.createElement('div');row.className='profile-stat';const key=document.createElement('span');key.textContent=label;const text=document.createElement('b');text.textContent=value;if(className)text.className=className;row.append(key,text);facts.append(row);}
  card.append(profileAvatar,facts);const close=document.createElement('button');close.type='button';close.className='panel-close';close.textContent='关闭';close.onclick=()=>{profileOpen=false;syncUi();};profilePanel.append(card,close);renderProfileAvatar();
}
let profileOpen=false;profileToggle.onclick=()=>{profileOpen=!profileOpen;syncUi();};
const refreshLife=createLifeUi(controller,hud,()=>{profileOpen=true;syncUi();});
const transitionStatus=document.createElement('div');transitionStatus.id='transition-status';transitionStatus.className='hidden';transitionStatus.textContent='正在进入…';transitionStatus.setAttribute('role','status');hud.append(transitionStatus);
let contextPending=false;
const contextService=(id:string,label:string,action:()=>Promise<unknown>)=>{const button=rpgButton(label,()=>{if(contextPending)return;contextPending=true;button.disabled=true;button.textContent='正在处理…';void run(action).finally(()=>{contextPending=false;button.textContent=label;});},'context-action');button.id=id;hud.append(button);return button;};
const hairAction=contextService('hair-action','做个发型',()=>controller.openHairService());
const outfitAction=contextService('outfit-action','看看衣服',()=>controller.openOutfitShop());
byId('interact').classList.add('context-action');
setInterval(()=>{
 transitionStatus.classList.toggle('hidden',!transitionLoading(controller.transitionPending,controller.transitionStartedAt,Date.now()));
 const blocked=!!controller.dialogue||controller.hairPanelOpen||controller.outfitPanelOpen||!!controller.facilityPanel||controller.shopOpen;
 byId('interact').classList.toggle('hidden',blocked);
 hairAction.classList.toggle('hidden',blocked||!controller.canUseHairService());outfitAction.classList.toggle('hidden',blocked||!controller.canUseOutfitShop());
 for(const button of [hairAction,outfitAction]){button.disabled=contextPending||controller.actionPending;button.setAttribute('aria-busy',String(contextPending||controller.actionPending));}
},50);
let questDetailsOpen=false, entered=false, confirmingRestart=false;
const groundKey='baishi-ground',showSpriteDebug=query.has('debugSprites'),showClothDebug=query.has('debugCloth'),showCollisionDebug=import.meta.env.DEV&&query.has('debugCollision');
const localCollisionEntries=Object.entries(baishiBuildingObjectCollision).flatMap(([buildingId,rects])=>rects.map((rect,index)=>({buildingId,index,rect})));
const sameRect=(a:{x:number;y:number;width:number;height:number},b:{x:number;y:number;width:number;height:number})=>a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height;
if(import.meta.env.DEV)(globalThis as any).__fjhyController=controller;
function color(value:string){const hex=value.replace('#',''),rgb=hex.slice(0,6).padEnd(6,'0');return {value:parseInt(rgb,16),alpha:hex.length===8?parseInt(hex.slice(6),16)/255:1};}
function option(select:HTMLSelectElement,value:string,label:string){const item=document.createElement('option');item.value=value;item.textContent=label;select.append(item);}
function draftAppearance():Appearance{return {gender:draft.gender,baseAvatarId:`${draft.gender}_01`,faceId:draft.faceId,hairId:draft.hairId,outfitId:draft.outfitId,headwearId:null,hairStyleId:draft.hairId,hairColorId:'INK',topStyleId:draft.outfitId,topColorId:'SAGE',bottomStyleId:`BOTTOM_${draft.gender}_01`,bottomColorId:'BLUE',shoesId:`SHOES_${draft.gender}_01`,accessoryIds:[]};}
const previewImages=new Map<string,HTMLImageElement>();
function renderPreview(){
  if(!controller.boot)return;
  const canvas=byId<HTMLCanvasElement>('appearance-preview'),ctx=canvas.getContext('2d');if(!ctx)return;
  const gender=draft.gender.toLowerCase();
  const root='/scene-layers/baishi/formal';
  const paths=[`${root}/outfit-v1/player_${gender}_body_v6.png`,`${root}/outfit-v1/${draft.outfitId.toLowerCase()}_v1.png`,`${root}/face-v2/${draft.faceId.toLowerCase()}_v2.png`,`${root}/hair-v3/${draft.hairId.toLowerCase()}_v3.png`];
  const row={down:0,left:1,right:2,up:3}[draft.direction];
  const images=paths.map(path=>{let img=previewImages.get(path);if(!img){img=new Image();img.onload=renderPreview;img.src=path;previewImages.set(path,img);}return img;});
  // Keep the completed portrait visible while the next appearance layer loads.
  if(images.some(img=>!img.complete||!img.naturalWidth))return;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#edf3e8';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
  for(const img of images)ctx.drawImage(img,0,row*64,64,64,11,10,148,148);
}
function renderProfileAvatar(){
  const ap=controller.player?.appearance,ctx=profileAvatar.getContext('2d');if(!ap||!ctx)return;
  ctx.clearRect(0,0,112,112);ctx.imageSmoothingEnabled=false;
  const gender=ap.gender.toLowerCase(),root='/scene-layers/baishi/formal';
  const paths=[`${root}/outfit-v1/player_${gender}_body_v6.png`,`${root}/outfit-v1/${ap.outfitId?.toLowerCase()}_v1.png`,`${root}/face-v2/${ap.faceId?.toLowerCase()}_v2.png`,`${root}/hair-v3/${ap.hairId?.toLowerCase()}_v3.png`];
  for(const path of paths){let img=previewImages.get(path);if(!img){img=new Image();img.onload=renderProfileAvatar;img.src=path;previewImages.set(path,img);}if(img.complete&&img.naturalWidth)ctx.drawImage(img,0,0,64,64,0,0,112,112);}
}
function refreshCreation(){if(!controller.boot)return;refreshFormalCreation();for(const button of document.querySelectorAll<HTMLButtonElement>('[data-gender]'))button.classList.toggle('active',button.dataset.gender===draft.gender);for(const button of document.querySelectorAll<HTMLButtonElement>('[data-direction]'))button.classList.toggle('active',button.dataset.direction===draft.direction);renderPreview();stepHeading.textContent=`第 ${creationStep+1} / 7 步 · ${creationNames[creationStep]}`;byId('gender-buttons').classList.toggle('hidden',creationStep!==0);for(const [index,id] of ['face-choice','hair-choice','outfit-choice'].entries())byId(id).closest('.creation-option')?.classList.toggle('hidden',creationStep!==index+1);identityPanel.classList.toggle('hidden',creationStep!==4);personalityPanel.classList.toggle('hidden',creationStep!==5);confirmation.classList.toggle('hidden',creationStep!==6);confirmation.textContent=creationStep===6?`姓名：${draft.surname}${draft.givenName} · 外号：${draft.nickname}\n性格选择：${personalityChoices.find(choice=>choice.tag===draft.personalityTag)?.quote??'尚未选择'}`:'';for(const button of personalityPanel.querySelectorAll<HTMLButtonElement>('button'))button.classList.toggle('active',button.dataset.tag===draft.personalityTag);for(const [id,value] of [['creation-surname',draft.surname],['creation-given',draft.givenName],['creation-nickname',draft.nickname]] as const){const input=byId<HTMLInputElement>(id);if(document.activeElement!==input)input.value=value;}byId('appearance-preview').parentElement?.classList.remove('hidden');byId('direction-buttons').classList.remove('hidden');byId<HTMLButtonElement>('creation-back').classList.toggle('hidden',creationStep===0);byId<HTMLButtonElement>('creation-next').classList.toggle('hidden',creationStep===6);byId<HTMLButtonElement>('create-player').classList.toggle('hidden',creationStep!==6);}
function refreshFormalCreation(){
  const boot=controller.boot;if(!boot)return;
  const {faces,hairs,outfits,selection}=availableStarterLookOptions(boot,draft.gender,draft,boot.faces);
  Object.assign(draft,selection);
  const root='/scene-layers/baishi/formal';
  for(const path of [...faces.map(face=>`${root}/face-v2/${face.faceId.toLowerCase()}_v2.png`),...hairs.map(hair=>`${root}/hair-v3/${hair.id.toLowerCase()}_v3.png`),...outfits.map(outfit=>`${root}/outfit-v1/${outfit.id.toLowerCase()}_v1.png`)]){
    if(!previewImages.has(path)){const image=new Image();image.onload=renderPreview;image.src=path;previewImages.set(path,image);}
  }
  const groups=[
    {id:'face-choice',key:'faceId' as const,items:faces.map(face=>({id:face.faceId,name:face.displayName}))},
    {id:'hair-choice',key:'hairId' as const,items:hairs},
    {id:'outfit-choice',key:'outfitId' as const,items:outfits},
  ];
  for(const group of groups){
    const container=byId<HTMLElement>(group.id);container.replaceChildren();
    for(const item of group.items){
      const button=document.createElement('button');button.type='button';button.className='appearance-choice';
      button.textContent=item.name;button.classList.toggle('active',draft[group.key]===item.id);
      button.setAttribute('aria-pressed',String(draft[group.key]===item.id));
      button.onclick=()=>{draft[group.key]=item.id;refreshCreation();};container.append(button);
    }
  }
  byId<HTMLButtonElement>('create-player').disabled=!draft.faceId||!draft.hairId||!draft.outfitId;
}
const shopToggle=document.createElement('button');shopToggle.id='shop-toggle';shopToggle.className='context-action';shopToggle.textContent='看看商品';hud.append(shopToggle);shopToggle.onclick=()=>void run(async()=>{if(controller.shopOpen)controller.closeShop();else await controller.openShop();});const shopClose=document.createElement('button');shopClose.type='button';shopClose.className='shop-close';shopClose.textContent='关闭';shopClose.onclick=()=>controller.closeShop();shopPanel.querySelector('header')?.append(shopClose);
let selectedShopItemId='',shopResult='';
let previousShopOpen=false;
function refreshShopPanel(){
  if(controller.shopOpen&&!previousShopOpen)shopResult='';previousShopOpen=controller.shopOpen;
  const shop=controller.shopPanel(),nearClerk=controller.canUseShop();
  const visible=controller.shopOpen&&!!shop&&!!nearClerk&&!(controller.dialogueSpeaker==='白石商行伙计'&&!!controller.dialogue);
  shopToggle.classList.toggle('hidden',!shop||!nearClerk);
  shopToggle.textContent=controller.shopOpen?'收起商品':'看看商品';
  shopPanel.classList.toggle('hidden',!visible);if(!shop||!visible)return;
  shopTitle.textContent=shop.title;shopBalance.textContent=`铜钱 ${shop.balance} 文`;
  shopFeedback.textContent=shopResult||'选择商品与数量后确认交易。';shopFeedback.setAttribute('role','status');
  shopItems.replaceChildren();
  if(shop.buildingId==='B_TRADE'){
    const tabs=document.createElement('div');tabs.className='shop-tabs';
    for(const side of ['buy','sell'] as const){
      const tab=document.createElement('button');tab.type='button';tab.textContent=side==='buy'?'买入':'出售';
      tab.classList.toggle('active',controller.shopTab===side);
      tab.onclick=()=>controller.setShopTab(side);tabs.append(tab);
    }
    shopItems.append(tabs);
  }
  const side=shop.buildingId==='B_TRADE'?controller.shopTab:'buy';
  const items=shop.buildingId==='B_TRADE'?shop.items.filter(item=>side==='buy'?item.buyPrice>0:item.sellPrice>0&&item.owned>0):shop.items;
  if(!items.length){
    const empty=document.createElement('p');empty.className='shop-empty';
    empty.textContent=side==='sell'?'目前没有商行收购的物品。':'目前没有上架商品。';
    shopItems.append(empty);return;
  }
  if(!items.some(item=>item.id===selectedShopItemId))selectedShopItemId=items[0].id;
  const selected=items.find(item=>item.id===selectedShopItemId)!;
  const layout=document.createElement('div'),list=document.createElement('div'),detail=document.createElement('div');
  layout.className='shop-layout';list.className='shop-list';detail.className='shop-detail';
  for(const item of items){
    const row=document.createElement('button'),icon=document.createElement('span'),name=document.createElement('strong'),owned=document.createElement('small');
    row.type='button';row.className='shop-list-item';row.classList.toggle('selected',item.id===selectedShopItemId);
    row.setAttribute('aria-pressed',String(item.id===selectedShopItemId));
    icon.className='shop-icon';icon.textContent=item.icon;name.textContent=item.name;owned.textContent=`持有 ×${item.owned}`;
    row.append(icon,name,owned);row.onclick=()=>{selectedShopItemId=item.id;refreshShopPanel();};list.append(row);
  }
  const icon=document.createElement('span'),name=document.createElement('h3'),description=document.createElement('p'),owned=document.createElement('p');
  icon.className='shop-detail-icon';icon.textContent=selected.icon;name.textContent=selected.name;
  description.textContent=selected.description||'白石街的日常用品。';owned.textContent=`当前持有 ${selected.owned} 件`;
  const unitPrice=side==='buy'?selected.buyPrice:selected.sellPrice;
  const price=document.createElement('div'),total=document.createElement('div');
  price.className='shop-price';price.textContent=`${side==='buy'?'买价':'收价'} · ${unitPrice} 文 / 件`;
  const quantity=controller.shopQuantities[selected.id]??1;
  total.className='shop-total';total.textContent=`预计${side==='buy'?'支出':'收入'} · ${unitPrice*quantity} 文`;
  const controls=document.createElement('div'),minus=document.createElement('button'),plus=document.createElement('button'),count=document.createElement('span');
  controls.className='shop-quantity';minus.type='button';plus.type='button';minus.textContent='−';plus.textContent='+';count.textContent=`${quantity} 件`;
  minus.onclick=()=>controller.setShopQuantity(selected.id,-1);plus.onclick=()=>controller.setShopQuantity(selected.id,1);
  controls.append(minus,count,plus);
  const action=document.createElement('button');action.type='button';action.className='shop-primary-action';
  action.textContent=side==='buy'?'确认买入':'确认出售';
  action.disabled=controller.busy||!!controller.pending||unitPrice===0||(side==='sell'&&selected.owned<quantity);
  action.onclick=()=>void run(async()=>{shopResult='正在处理交易…';try{await controller.trade(side,selected.id,controller.shopQuantities[selected.id]??1);shopResult=controller.dialogue?'交易已处理，请继续对话。':controller.message;}catch(error){shopResult=error instanceof Error?error.message:'交易失败，请重试';throw error;}});
  detail.append(icon,name,description,owned,price,controls,total,action);
  layout.append(list,detail);shopItems.append(layout);
}
function refreshQuestPanel(){
  const tasks=controller.questTracker(),active=tasks.filter(task=>!task.completed),visible=active.length?active:(tasks.length?[tasks[0]]:[]);
  quest.replaceChildren();
  if(!visible.length)quest.textContent='暂无进行中的任务';
  for(const task of visible){
    const entry=document.createElement('article');entry.className='quest-entry';
    const name=document.createElement('strong');name.textContent=task.completed?`${task.name} · 已完成`:task.name;
    const objective=document.createElement('small');objective.textContent=task.completed?'奖励已经到账。':task.currentObjective;
    const progress=document.createElement('span');progress.className='quest-progress';progress.textContent=task.completed?'已完成':`${Math.min(task.stepIndex+1,task.stepCount)} / ${task.stepCount}`;
    entry.append(name,objective,progress);
    if(questDetailsOpen){
      const runtime=controller.quests.find(candidate=>candidate.id===task.id);
      const meta=questPresentation[task.id];
      const details=document.createElement('div');details.className='quest-details';
      const intro=document.createElement('p');intro.textContent=meta?.description??'跟随当前目标继续探索白石街。';
      const publisher=document.createElement('p');publisher.textContent=`发布人 · ${meta?.publisher??'白石街居民'}`;
      const stage=document.createElement('p');stage.textContent=`当前阶段 · ${task.currentStep}`;
      const reward=document.createElement('p');reward.textContent=task.rewardSummary;
      details.append(intro,publisher,stage,reward);
      if(runtime){
        const steps=document.createElement('ol');steps.className='quest-steps';
        runtime.steps.forEach((step,index)=>{
          const node=document.createElement('li');node.className=task.completed||index<task.stepIndex?'done':index===task.stepIndex?'current':'';
          node.textContent=step.title??step.objective??`第 ${index+1} 步`;steps.append(node);
        });details.append(steps);
      }
      entry.append(details);
    }
    quest.append(entry);
  }
  questPanel.classList.toggle('completed',!active.length&&tasks.length>0);
  quest.classList.remove('hidden');
  questToggle.setAttribute('aria-expanded',String(questDetailsOpen));
  questToggleIcon.textContent=questDetailsOpen?'▲':'▼';
}function baseSyncUi(){const player=controller.player;if(firstDayDebug&&player){const flags=player.storyFlags??{};firstDayDebug.textContent=`stage: ${controller.firstDayStage}\nquest: ${controller.questTracker().find(q=>!q.completed)?.name??'无'}\nmetNpcs: ${player.metNpcs.join(', ')}\nshops: ${Object.keys(flags).filter(k=>k.startsWith('FIRST_DAY_SHOP_INTRO_')).join(', ')}\nlifeUnlocked: ${!!flags.GUEST_ROOM_LIFE_UNLOCKED}\ntradeCompleted: ${controller.questProgress().completed}\nfirstDayComplete: ${!!flags.FIRST_DAY_COMPLETE}`;}auth.classList.toggle('hidden',!!controller.boot);home.classList.toggle('hidden',!controller.boot||entered||confirmingRestart);restartConfirm.classList.toggle('hidden',!confirmingRestart);byId<HTMLElement>('home-start').classList.toggle('hidden',!!player?.appearance);byId<HTMLElement>('home-continue').classList.toggle('hidden',!player?.appearance);byId<HTMLElement>('home-restart').classList.toggle('hidden',!player?.appearance);create.classList.toggle('hidden',!entered||!controller.boot||!!player?.appearance);hud.classList.toggle('hidden',!entered||!player?.appearance);if(entered&&controller.boot&&!player?.appearance)refreshCreation();status.textContent=player?.appearance?`${controller.view?.scene.name??'横阳'} · ${controller.view?.phase??''} · ${player.cash} 文`:'';createMessage.textContent=controller.boot&&!player?.appearance?controller.message:'';if(player?.appearance){refreshQuestPanel();refreshShopPanel();refreshInventory();}profileToggle.classList.toggle('hidden',!entered||!player?.appearance);profilePanel.classList.toggle('hidden',!profileOpen||!entered||!player?.appearance);if(profileOpen&&player?.appearance)refreshProfilePanel();byId<HTMLButtonElement>('interact').textContent=controller.nearby()?.label??'互动';}
function syncUi(){
  if(!controller.message)lastNoticeSource='';
  baseSyncUi();refreshLife();scenePlaque.textContent=controller.player?.appearance?sceneLabelFor(controller.view?.scene):'';
  const player=controller.player;
  dialogueUi.sync(controller.dialogueSpeaker??'',controller.dialogue??'',!!controller.dialogue,player?.profile?player.profile.surname+player.profile.givenName:undefined,dialogueContext(controller.message));
   if(controller.guide){const sequential=/任务|奖励/.test(controller.guide);notices.enqueue('toast',controller.guide,sequential?'sequential':'low',sequential?{}:{sceneId:player?.sceneId,transitionId:controller.transitionId});controller.guide=null;}
   if(controller.dialogue||controller.shopOpen||controller.facilityPanel||controller.outfitPanelOpen)lastNoticeSource=controller.message;
  else if(!controller.actionPending&&player?.appearance&&controller.message&&controller.message!==lastNoticeSource&&!isTransientSceneMessage(controller.message)){lastNoticeSource=controller.message;notices.enqueue(/成功|完成|获得|支出|售出|购买/.test(controller.message)?'result':'toast',controller.message.split('\n').slice(0,3).join('\n'),'immediate',{sceneId:controller.player?.sceneId,transitionId:controller.transitionId});presentNotice();}
  presentNotice();
  const interactButton=byId<HTMLButtonElement>('interact');interactButton.disabled=controller.actionPending;interactButton.setAttribute('aria-busy',String(controller.actionPending));if(controller.actionPending)interactButton.textContent='处理中…';
}
async function run(action:()=>Promise<unknown>){try{await action();}catch(error:any){controller.message=error.message??'操作失败';}syncUi();}

class BaishiScene extends Phaser.Scene {private uiCamera!:Phaser.Cameras.Scene2D.Camera;private graphics!:Phaser.GameObjects.Graphics;private ground!:Phaser.GameObjects.Image;private labels:Phaser.GameObjects.Text[]=[];private labelIndex=0;private formalBuilding!:Phaser.GameObjects.Image;private innBuilding!:Phaser.GameObjects.Image;private groceryBuilding!:Phaser.GameObjects.Image;private salonBuilding!:Phaser.GameObjects.Image;private clothBuilding!:Phaser.GameObjects.Image;private buildingForegrounds=new Map<string,Phaser.GameObjects.Image>();private shopSigns=new Map<string,Phaser.GameObjects.Image>();private shopSignTemplates=new Map<string,Phaser.GameObjects.Text>();private interiorBackgrounds=new Map<string,Phaser.GameObjects.Image>();private interiorForegrounds=new Map<string,Phaser.GameObjects.Image>();private formalClerk!:Phaser.GameObjects.Sprite;private innShopkeeper!:Phaser.GameObjects.Sprite;private groceryAssistant!:Phaser.GameObjects.Sprite;private hairdresser!:Phaser.GameObjects.Sprite;private clothShopkeeper!:Phaser.GameObjects.Sprite;private formalPlayer!:Phaser.GameObjects.Sprite;private playerName!:Phaser.GameObjects.Text;private portraitDim!:Phaser.GameObjects.Rectangle;private clerkPortrait!:Phaser.GameObjects.Image;private shopkeeperPortrait!:Phaser.GameObjects.Image;private assistantPortrait!:Phaser.GameObjects.Image;private hairdresserPortrait!:Phaser.GameObjects.Image;private clothShopkeeperPortrait!:Phaser.GameObjects.Image;private playerPortrait!:Phaser.GameObjects.Image;private playerDebug!:Phaser.GameObjects.Text;constructor(){super('baishi');}preload(){this.load.image('web-interior-generic-bg',GENERIC_INTERIOR_BG);this.load.image('web-interior-generic-fg',GENERIC_INTERIOR_FG);preloadHairAssets(this);this.load.image(groundKey,'/scene-layers/baishi/ground/baishi_composition_approved_v01.png');for(const asset of baishiFormalArtRegistry.buildings){this.load.image(asset.assetKey,asset.imagePath);if(asset.foreground&&asset.foregroundOcclusionFrontY!==undefined)this.load.image(asset.foreground.assetKey,asset.foreground.imagePath);}for(const asset of baishiFormalArtRegistry.npcs)this.load.spritesheet(asset.assetKey,asset.imagePath,{frameWidth:asset.frameWidth,frameHeight:asset.frameHeight});this.load.spritesheet('formal-player-male',baishiV2ArtAssets.playerMale.imagePath,{frameWidth:64,frameHeight:64});this.load.spritesheet('formal-player-female',baishiV2ArtAssets.playerFemale.imagePath,{frameWidth:64,frameHeight:64});for(const asset of baishiFormalArtRegistry.portraits)this.load.image(asset.assetKey,asset.imagePath);this.load.image('portrait-player-male','/scene-layers/baishi/formal/portrait_player_male_base.png');this.load.image('portrait-player-female','/scene-layers/baishi/formal/portrait_player_female_base.png');for(const sign of baishiShopSignPlacements){const resourceId=({B_INN:'SIGN_BAISHI_INN_V1',B_GROCERY:'SIGN_BAISHI_GROCERY_V1',B_TRADE:'SIGN_BAISHI_TRADE_V1',B_SALON:'SIGN_BAISHI_SALON_V1',B_CLOTH:'SIGN_BAISHI_CLOTH_V1'} as Record<string,string>)[sign.buildingId];this.load.image(sign.assetKey,assetUrl(remoteAsset(resourceId),WEB_ASSET_BASE_URL));}}create(){this.ground=this.add.image(0,0,groundKey).setOrigin(0).setDisplaySize(48*TILE,48*TILE).setDepth(GROUND_DEPTH).setVisible(false);this.graphics=this.add.graphics().setDepth(GROUND_DEPTH+1);this.formalBuilding=this.add.image(0,0,baishiFormalArtRegistry.buildings.find(asset=>asset.buildingId==='B_TRADE')!.assetKey).setOrigin(0).setDepth(GROUND_DEPTH+1).setVisible(false);this.innBuilding=this.add.image(0,0,baishiFormalArtRegistry.buildings.find(asset=>asset.buildingId==='B_INN')!.assetKey).setOrigin(0).setDepth(GROUND_DEPTH+1).setVisible(false);this.groceryBuilding=this.add.image(0,0,baishiFormalArtRegistry.buildings.find(asset=>asset.buildingId==='B_GROCERY')!.assetKey).setOrigin(0).setDepth(GROUND_DEPTH+1).setVisible(false);this.salonBuilding=this.add.image(0,0,baishiFormalArtRegistry.buildings.find(asset=>asset.buildingId==='B_SALON')!.assetKey).setOrigin(0).setDepth(GROUND_DEPTH+1).setVisible(false);this.clothBuilding=this.add.image(0,0,baishiFormalArtRegistry.buildings.find(asset=>asset.buildingId==='B_CLOTH')!.assetKey).setOrigin(0).setDepth(GROUND_DEPTH+1).setVisible(false);for(const sign of baishiShopSignPlacements){if(this.textures.exists(sign.assetKey))this.shopSigns.set(sign.buildingId,this.add.image(0,0,sign.assetKey).setOrigin(.5).setDepth(WORLD_BASE).setVisible(false));this.shopSignTemplates.set(sign.buildingId,this.add.text(0,0,'',signTemplateTextStyle('',sign.templateId)).setOrigin(.5).setDepth(WORLD_BASE).setVisible(false));}for(const asset of baishiFormalArtRegistry.buildings)if(asset.foreground&&asset.foregroundOcclusionFrontY!==undefined)this.buildingForegrounds.set(asset.buildingId,this.add.image(0,0,asset.foreground.assetKey).setOrigin(0).setDepth(GROUND_DEPTH+1).setVisible(false));this.formalClerk=this.add.sprite(0,0,baishiFormalArtRegistry.npcs.find(asset=>asset.npcId==='NPC_TRADE_CLERK')!.assetKey,0).setOrigin(.5,59/64).setDisplaySize(60,60).setDepth(GROUND_DEPTH+1).setVisible(false);this.innShopkeeper=this.add.sprite(0,0,baishiFormalArtRegistry.npcs.find(asset=>asset.npcId==='NPC_001')!.assetKey,0).setOrigin(.5,59/64).setDisplaySize(60,60).setDepth(GROUND_DEPTH+1).setVisible(false);this.groceryAssistant=this.add.sprite(0,0,baishiFormalArtRegistry.npcs.find(asset=>asset.npcId==='NPC_GROCERY_CLERK')!.assetKey,0).setOrigin(.5,59/64).setDisplaySize(60,60).setDepth(GROUND_DEPTH+1).setVisible(false);this.hairdresser=this.add.sprite(0,0,baishiFormalArtRegistry.npcs.find(asset=>asset.npcId==='NPC_SALON_HAIRDRESSER')!.assetKey,0).setOrigin(.5,59/64).setDisplaySize(60,60).setDepth(GROUND_DEPTH+1).setVisible(false);this.clothShopkeeper=this.add.sprite(0,0,baishiFormalArtRegistry.npcs.find(asset=>asset.npcId==='NPC_CLOTH_SHOPKEEPER')!.assetKey,0).setOrigin(.5,59/64).setDisplaySize(60,60).setDepth(GROUND_DEPTH+1).setVisible(false);this.formalPlayer=this.add.sprite(0,0,'formal-player-female',0).setOrigin(.5,59/64).setDisplaySize(60,60).setDepth(GROUND_DEPTH+1).setVisible(false);this.playerName=this.add.text(0,0,'你',PLAYER_NAME_STYLE).setOrigin(.5,1).setVisible(false);this.portraitDim=this.add.rectangle(WIDTH/2,HEIGHT/2,WIDTH,HEIGHT,0x18251c,.38).setDepth(PORTRAIT_DIM_DEPTH).setVisible(false);this.clerkPortrait=this.add.image(WIDTH-125,HEIGHT-28,baishiFormalArtRegistry.portraits.find(asset=>asset.speaker==='白石商行伙计')!.assetKey).setOrigin(.5,1).setDepth(PORTRAIT_DEPTH).setVisible(false);this.shopkeeperPortrait=this.add.image(WIDTH-125,HEIGHT-28,baishiFormalArtRegistry.portraits.find(asset=>asset.speaker==='陈掌柜')!.assetKey).setOrigin(.5,1).setDepth(PORTRAIT_DEPTH).setVisible(false);this.assistantPortrait=this.add.image(WIDTH-125,HEIGHT-28,baishiFormalArtRegistry.portraits.find(asset=>asset.speaker==='街坊杂货铺店员')!.assetKey).setOrigin(.5,1).setDepth(PORTRAIT_DEPTH).setVisible(false);this.hairdresserPortrait=this.add.image(WIDTH-125,HEIGHT-28,baishiFormalArtRegistry.portraits.find(asset=>asset.speaker==='青丝美发师')!.assetKey).setOrigin(.5,1).setDepth(PORTRAIT_DEPTH).setVisible(false);this.clothShopkeeperPortrait=this.add.image(WIDTH-125,HEIGHT-28,baishiFormalArtRegistry.portraits.find(asset=>asset.speaker==='春衫掌柜')!.assetKey).setOrigin(.5,1).setDepth(PORTRAIT_DEPTH).setVisible(false);this.playerPortrait=this.add.image(125,HEIGHT-28,'portrait-player-female').setOrigin(.5,1).setDepth(PORTRAIT_DEPTH).setVisible(false);for(const portrait of [this.clerkPortrait,this.shopkeeperPortrait,this.assistantPortrait,this.hairdresserPortrait,this.clothShopkeeperPortrait,this.playerPortrait]){const source=portrait.texture.getSourceImage() as HTMLImageElement;const size=containSize(source.width,source.height,220,330);portrait.setDisplaySize(size.width,size.height);}this.playerDebug=this.add.text(10,10,'',{fontFamily:'monospace',fontSize:'11px',color:'#fffbda',backgroundColor:'#17231bcc',padding:{left:6,right:6,top:4,bottom:4}}).setDepth(DEBUG_DEPTH);this.input.keyboard?.on('keydown-E',()=>void run(()=>controller.interact()));this.input.keyboard?.on('keydown-SPACE',()=>void run(()=>controller.interact()));platform.onLifecycle(state=>{if(state==='hide')pressed.clear();});controller.onChange=syncUi;const world=[this.graphics,this.ground,this.formalBuilding,this.innBuilding,this.groceryBuilding,this.salonBuilding,this.clothBuilding,this.formalClerk,this.innShopkeeper,this.groceryAssistant,this.hairdresser,this.clothShopkeeper,this.formalPlayer,this.playerName,...this.buildingForegrounds.values(),...this.shopSigns.values(),...this.shopSignTemplates.values(),...this.interiorBackgrounds.values(),...this.interiorForegrounds.values()];const ui=[this.portraitDim,this.clerkPortrait,this.shopkeeperPortrait,this.assistantPortrait,this.hairdresserPortrait,this.clothShopkeeperPortrait,this.playerPortrait,this.playerDebug];this.cameras.main.ignore(ui);this.uiCamera=this.cameras.add(0,0,WIDTH,HEIGHT);this.uiCamera.ignore(world);installHairService(this,controller,this.formalPlayer,WIDTH,HEIGHT,undefined,{contextButton:false});installOutfitShop(this,controller,WIDTH,HEIGHT,{webLife:true});syncUi();}update(_time:number,delta:number){const keyboard=this.input.keyboard;const dx=Number(pressed.has('right')||keyboard?.addKey('RIGHT').isDown||keyboard?.addKey('D').isDown)-Number(pressed.has('left')||keyboard?.addKey('LEFT').isDown||keyboard?.addKey('A').isDown);const dy=Number(pressed.has('down')||keyboard?.addKey('DOWN').isDown||keyboard?.addKey('S').isDown)-Number(pressed.has('up')||keyboard?.addKey('UP').isDown||keyboard?.addKey('W').isDown);controller.tick(Math.min(delta/1000,.05),entered?dx:0,entered?dy:0);this.render();}private pendingInteriorArt=new Set<string>();
private interiorStatus=new Map<string,string>();
private ensureInteriorArt(sceneId:string){
  const asset=baishiInteriorArtRegistry.find(candidate=>candidate.sceneId===sceneId);
  if(!asset||this.pendingInteriorArt.has(sceneId)||this.interiorBackgrounds.has(sceneId))return;
  this.pendingInteriorArt.add(sceneId);
  const sources=[{id:asset.resourceId,foreground:false},{id:asset.foreground.resourceId,foreground:true}];
  const apply=async(recovery=false)=>{
    const results=await Promise.all(sources.map(async entry=>{
      try{
        const result=await fetchInteriorResource(entry.id,WEB_ASSET_BASE_URL,import.meta.env.DEV);
        if(!this.textures.exists(result.resource.key))this.textures.addImage(result.resource.key,await decodeInterior(result.blob));
        if(remoteAssetDiagnostic)console.info('[FJHY remote asset] web-verified '+JSON.stringify({sceneId,resourceId:entry.id,path:result.resource.path,version:result.resource.version,hash:result.resource.sha256,key:result.resource.key,source:result.source,url:result.url}));
        return {entry,key:result.resource.key,source:result.source};
      }catch(error){
        if(remoteAssetDiagnostic)console.warn('[FJHY remote asset] web-generic-fallback',{sceneId,resourceId:entry.id,error:String(error)});
        return {entry,key:entry.foreground?'web-interior-generic-fg':'web-interior-generic-bg',source:'generic'};
      }
    }));
    for(const result of results){
      const map=result.entry.foreground?this.interiorForegrounds:this.interiorBackgrounds;
      const existing=map.get(sceneId);
      if(existing){if(result.source!=='generic')existing.setTexture(result.key).setDisplaySize(asset.width,asset.height);}
      else if(this.textures.exists(result.key)){
        const image=this.add.image(0,0,result.key).setOrigin(0).setDisplaySize(asset.width,asset.height).setDepth(result.entry.foreground?WORLD_BASE:GROUND_DEPTH).setVisible(false);
        map.set(sceneId,image);this.uiCamera.ignore(image);
      }
    }
    const failed=results.some(result=>result.source==='generic');
    this.interiorStatus.set(sceneId,failed?'场景美术暂未载入，已使用简化背景。':'');
    this.pendingInteriorArt.delete(sceneId);
    if(failed&&!recovery)setTimeout(()=>void apply(true),5000);
  };
  void apply();
}
private render(){const view=controller.view;this.cameras.main.setZoom(view?.scene.id==='STREET_BAISHI_01'?OUTDOOR_CAMERA_ZOOM:1);this.graphics.setDepth(showCollisionDebug?DEBUG_DEPTH-1:GROUND_DEPTH+1);this.graphics.clear();this.labelIndex=0;this.playerName.setVisible(false);const painter:Painter={rect:(x,y,w,h,fill)=>{const c=color(fill);this.graphics.fillStyle(c.value,c.alpha);this.graphics.fillRect(x,y,w,h);},circle:(x,y,r,fill)=>{const c=color(fill);this.graphics.fillStyle(c.value,c.alpha);this.graphics.fillCircle(x,y,r);},text:(text,x,y,size,fill)=>{let label=this.labels[this.labelIndex++];if(!label){label=this.add.text(0,0,'',{fontFamily:'Microsoft YaHei',fontSize:size,color:'#ffffff',stroke:'#23352b',strokeThickness:2}).setOrigin(.5).setDepth(20);this.uiCamera.ignore(label);this.labels.push(label);}label.setText(text).setPosition(x,y).setFontSize(size).setColor(fill).setVisible(true);}};if(controller.boot&&!controller.player?.appearance){this.ground.setVisible(false);drawAppearance(painter,draftAppearance(),controller.boot.colors,WIDTH/2,HEIGHT/2,4,draft.direction,controller.walkTime);}else if(view){const origin=worldOrigin(WIDTH,HEIGHT,view.scene.width*TILE,view.scene.height*TILE,controller.x*TILE,controller.y*TILE,view.scene.id==='STREET_BAISHI_01'?OUTDOOR_CAMERA_ZOOM:1);const ox=origin.x,oy=origin.y;
const buildingDepth=(buildingId:string)=>{const asset=baishiFormalArtRegistry.buildings.find(candidate=>candidate.buildingId===buildingId);if(asset?.occlusionFrontY===undefined)throw new Error('Missing occlusionFrontY for '+buildingId);return worldBuildingDepth(asset.occlusionFrontY);};this.ground.setVisible(view.scene.id==='STREET_BAISHI_01').setPosition(ox,oy);const interiorArt=baishiInteriorArtRegistry.find(asset=>asset.sceneId===view.scene.id);if(interiorArt&&!this.interiorBackgrounds.has(interiorArt.sceneId))this.ensureInteriorArt(interiorArt.sceneId);const interiorReady=!!interiorArt&&this.interiorBackgrounds.has(view.scene.id)&&this.interiorForegrounds.has(view.scene.id);resourceStatus.textContent=this.interiorStatus.get(view.scene.id)??'';resourceStatus.classList.toggle('hidden',!resourceStatus.textContent);for(const asset of baishiInteriorArtRegistry){this.interiorBackgrounds.get(asset.sceneId)?.setVisible(asset.sceneId===view.scene.id&&!!interiorReady).setPosition(ox,oy);this.interiorForegrounds.get(asset.sceneId)?.setVisible(asset.sceneId===view.scene.id&&!!interiorReady).setPosition(ox,oy).setDepth(worldBuildingDepth(asset.foreground.occlusionFrontY));}const clerkReady=this.textures.exists(baishiFormalArtRegistry.npcs.find(asset=>asset.npcId==='NPC_TRADE_CLERK')!.assetKey),playerKey=controller.player?.appearance?.gender==='MALE'?'formal-player-male':'formal-player-female',playerAsset=controller.player?.appearance?.gender==='MALE'?baishiV2ArtAssets.playerMale:baishiV2ArtAssets.playerFemale,playerReady=this.textures.exists(playerKey),directionRow=controller.direction==='down'?0:controller.direction==='left'?1:controller.direction==='right'?2:3,frameInDirection=controller.moving?Math.floor((controller.walkTime*8)%4):0,playerFrame=directionRow*4+frameInDirection,playerOffset=playerAsset.frameOffsets[controller.direction][frameInDirection],playerDrawSuccess=playerReady&&playerFrame>=0&&playerFrame<16;this.formalPlayer.setTexture(playerKey).setDisplaySize(playerAsset.frameWidth*playerAsset.renderScale*actorVisualScale(view.scene.id),playerAsset.frameHeight*playerAsset.renderScale*actorVisualScale(view.scene.id)).setPosition(ox+controller.x*TILE+playerOffset.x,oy+controller.y*TILE+playerOffset.y).setFrame(playerFrame).setDepth(worldActorDepth(controller.y)).setVisible(playerDrawSuccess);this.playerName.setText(controller.player?.profile?controller.player.profile.surname+controller.player.profile.givenName:'你').setPosition(ox+controller.x*TILE,playerNameTopY(oy+controller.y*TILE,playerAsset.footAnchorY,playerAsset.renderScale,view.scene.id)).setDepth(worldActorDepth(controller.y)+2).setVisible(playerDrawSuccess);const innScene=view.scene.id==='STREET_BAISHI_01';const drawInteriorFallback=!innScene&&!interiorReady;const innInterior=view.scene.id==='INTERIOR_B_INN';const groceryInterior=view.scene.id==='INTERIOR_B_GROCERY';const salonInterior=view.scene.id==='INTERIOR_B_SALON';const clothInterior=view.scene.id==='INTERIOR_B_CLOTH';const hairdresserReady=this.textures.exists(baishiFormalArtRegistry.npcs.find(asset=>asset.npcId==='NPC_SALON_HAIRDRESSER')!.assetKey);const clothShopkeeperReady=this.textures.exists(baishiFormalArtRegistry.npcs.find(asset=>asset.npcId==='NPC_CLOTH_SHOPKEEPER')!.assetKey);const assistantReady=this.textures.exists(baishiFormalArtRegistry.npcs.find(asset=>asset.npcId==='NPC_GROCERY_CLERK')!.assetKey);const shopkeeperReady=this.textures.exists(baishiFormalArtRegistry.npcs.find(asset=>asset.npcId==='NPC_001')!.assetKey);controller.render(painter,WIDTH,HEIGHT,drawInteriorFallback,drawInteriorFallback,true,[...(clerkReady?['NPC_TRADE_CLERK']:[]),...(innInterior&&shopkeeperReady?['NPC_001']:[]),...(groceryInterior&&assistantReady?['NPC_GROCERY_CLERK']:[]),...(salonInterior&&hairdresserReady?['NPC_SALON_HAIRDRESSER']:[]),...(clothInterior&&clothShopkeeperReady?['NPC_CLOTH_SHOPKEEPER']:[])],playerDrawSuccess,drawInteriorFallback,showCollisionDebug,{origin,zoneLabels:false});for(const [buildingId,image] of [['B_TRADE',this.formalBuilding],['B_INN',this.innBuilding],['B_GROCERY',this.groceryBuilding],['B_SALON',this.salonBuilding],['B_CLOTH',this.clothBuilding]] as const){const asset=baishiFormalArtRegistry.buildings.find(candidate=>candidate.buildingId===buildingId)!;const position=buildingImagePosition(asset,TILE);image.setVisible(innScene).setPosition(ox+position.x,oy+position.y).setDepth(buildingDepth(buildingId));}for(const sign of baishiShopSignPlacements){const building=view.buildings.find(candidate=>candidate.id===sign.buildingId);const image=this.shopSigns.get(sign.buildingId);const template=this.shopSignTemplates.get(sign.buildingId);const resourceId=({B_INN:'SIGN_BAISHI_INN_V1',B_GROCERY:'SIGN_BAISHI_GROCERY_V1',B_TRADE:'SIGN_BAISHI_TRADE_V1',B_SALON:'SIGN_BAISHI_SALON_V1',B_CLOTH:'SIGN_BAISHI_CLOTH_V1'} as Record<string,string>)[sign.buildingId];const custom=!!building&&shouldUseCustomSign(building,resourceId)&&this.textures.exists(sign.assetKey);image?.setVisible(innScene&&custom).setPosition(ox+sign.worldX*TILE,oy+sign.worldY*TILE).setDisplaySize(sign.width,sign.height).setDepth(worldBuildingDepth(sign.frontY)+1);if(template){const name=building?buildingDisplayName(building):'';template.setText(name).setStyle(signTemplateTextStyle(name,sign.templateId)).setPosition(ox+sign.worldX*TILE,oy+sign.worldY*TILE).setDepth(worldBuildingDepth(sign.frontY)+1).setVisible(innScene&&!!building&&!custom);}}for(const asset of baishiFormalArtRegistry.buildings){const foreground=this.buildingForegrounds.get(asset.buildingId);if(!foreground||!asset.foreground||asset.foregroundOcclusionFrontY===undefined)continue;const position=foregroundImagePosition(asset,TILE);foreground.setVisible(innScene).setPosition(ox+position.x,oy+position.y).setDepth(worldBuildingDepth(asset.foregroundOcclusionFrontY));}const actorSize=64*actorVisualScale(view.scene.id);for(const sprite of [this.formalClerk,this.innShopkeeper,this.groceryAssistant,this.hairdresser,this.clothShopkeeper])sprite.setDisplaySize(actorSize,actorSize);const clerk=view.npcs.find(n=>n.id==='NPC_TRADE_CLERK');const shopkeeper=view.npcs.find(n=>n.id==='NPC_001');const assistant=view.npcs.find(n=>n.id==='NPC_GROCERY_CLERK');const stylist=view.npcs.find(n=>n.id==='NPC_SALON_HAIRDRESSER');const clothShopkeeper=view.npcs.find(n=>n.id==='NPC_CLOTH_SHOPKEEPER');this.clothShopkeeper.setVisible(!!clothShopkeeper&&clothInterior&&clothShopkeeperReady);if(clothShopkeeper)this.clothShopkeeper.setPosition(ox+clothShopkeeper.x*TILE,oy+clothShopkeeper.y*TILE).setDepth(worldActorDepth(clothShopkeeper.y));this.hairdresser.setVisible(!!stylist&&salonInterior&&hairdresserReady);if(stylist)this.hairdresser.setPosition(ox+stylist.x*TILE,oy+stylist.y*TILE).setDepth(worldActorDepth(stylist.y));this.groceryAssistant.setVisible(!!assistant&&groceryInterior&&assistantReady);if(assistant)this.groceryAssistant.setPosition(ox+assistant.x*TILE,oy+assistant.y*TILE).setDepth(worldActorDepth(assistant.y));this.innShopkeeper.setVisible(!!shopkeeper&&innInterior&&shopkeeperReady);if(shopkeeper)this.innShopkeeper.setPosition(ox+shopkeeper.x*TILE,oy+shopkeeper.y*TILE).setDepth(worldActorDepth(shopkeeper.y));this.formalClerk.setVisible(!!clerk&&view.scene.id==='INTERIOR_B_TRADE');if(clerk){const clerkOffset=baishiV2ArtAssets.npcClerk.frameOffsets.down[0];this.formalClerk.setPosition(ox+clerk.x*TILE+clerkOffset.x,oy+clerk.y*TILE+clerkOffset.y).setDepth(worldActorDepth(clerk.y));}if(showClothDebug&&innScene){const plotX=ox+28*TILE,plotY=oy+27*TILE,triggerX=ox+32.75*TILE,triggerY=oy+37.15*TILE;this.graphics.lineStyle(2,0xffd54f,.95);this.graphics.strokeRect(plotX,plotY,12*TILE,10*TILE);this.graphics.lineStyle(2,0x38d9ff,.95);this.graphics.strokeRect(triggerX,triggerY,2.5*TILE,1.6*TILE);this.graphics.fillStyle(0xff4f8b,.95);this.graphics.fillCircle(ox+34*TILE,oy+37.6*TILE,6);}let collisionDebugText='';if(showCollisionDebug){const targetDebug=controller.interactionDebug(),targetColors:Record<string,number>={portal:0x38d9ff,entrance:0x38d9ff,npc:0x8cdb75,service:0xffd54f,furniture:0xff9f43,scripted:0xff5b8a};for(const candidate of targetDebug.zones){const debugColor=targetColors[candidate.type]??0xffffff;this.graphics.lineStyle(candidate.id===targetDebug.active?.id?3:1,debugColor,candidate.id===targetDebug.active?.id?1:.72);if(candidate.zone)this.graphics.strokeRect(ox+candidate.zone.x*TILE,oy+candidate.zone.y*TILE,candidate.zone.width*TILE,candidate.zone.height*TILE);else this.graphics.strokeCircle(ox+candidate.anchor.x*TILE,oy+candidate.anchor.y*TILE,(candidate.radius??.25)*TILE);}const drawRect=(r:{x:number;y:number;width:number;height:number},fill:number,line:number)=>{this.graphics.fillStyle(fill,.2);this.graphics.fillRect(ox+r.x*TILE,oy+r.y*TILE,r.width*TILE,r.height*TILE);this.graphics.lineStyle(2,line,.95);this.graphics.strokeRect(ox+r.x*TILE,oy+r.y*TILE,r.width*TILE,r.height*TILE);this.graphics.lineStyle(1,line,.45);this.graphics.strokeRect(ox+(r.x-.18)*TILE,oy+(r.y-.18)*TILE,(r.width+.36)*TILE,(r.height+.36)*TILE);};for(const r of view.scene.collision)if(!localCollisionEntries.some(entry=>sameRect(entry.rect,r)))drawRect(r,0x8e6bbd,0xb99ae6);for(const plot of view.plots.filter(plot=>plot.buildingId))drawRect(plot,0xffd54f,0xffe680);for(const rect of view.scene.collision)if(localCollisionEntries.some(entry=>sameRect(entry.rect,rect)))drawRect(rect,0xff334f,0xff5d73);for(const plot of view.plots)for(const entrance of plot.entrances??[]){const area=entrance.interactionArea??{x:entrance.position.x-.8,y:entrance.position.y-.8,width:1.6,height:1.6};this.graphics.lineStyle(2,0x38d9ff,.98);this.graphics.strokeRect(ox+area.x*TILE,oy+area.y*TILE,area.width*TILE,area.height*TILE);}for(const image of [this.innBuilding,this.groceryBuilding,this.formalBuilding,this.salonBuilding,this.clothBuilding])if(image.visible){const bounds=image.getBounds();this.graphics.lineStyle(1,0x60f29a,.9);this.graphics.strokeRect(bounds.x,bounds.y,bounds.width,bounds.height);}this.graphics.fillStyle(0xffffff,.98);this.graphics.fillCircle(ox+controller.x*TILE,oy+controller.y*TILE,7);this.graphics.lineStyle(2,0x151515,1);this.graphics.strokeCircle(ox+controller.x*TILE,oy+controller.y*TILE,7);const hit=(r:{x:number;y:number;width:number;height:number})=>controller.x>r.x-.18&&controller.x<r.x+r.width+.18&&controller.y>r.y-.18&&controller.y<r.y+r.height+.18;const hits=[...view.scene.collision.flatMap((rect,index)=>{const local=localCollisionEntries.find(entry=>sameRect(entry.rect,rect));return hit(rect)?[local?'local '+local.buildingId+'#'+(local.index+1):'static#'+(index+1)]:[];}),...view.plots.flatMap(plot=>plot.buildingId&&hit(plot)?['plot '+plot.id]:[])],clothRuntime=localCollisionEntries.filter(entry=>entry.buildingId==='B_CLOTH').slice(0,3).map(entry=>({id:'#'+(entry.index+1),runtimeActive:view.scene.collision.some(rect=>sameRect(entry.rect,rect))}));(globalThis as any).__fjhyCollisionDebug={collisionCount:view.scene.collision.length,cloth:clothRuntime,collision:view.scene.collision};collisionDebugText='collision DEV\nruntime collision='+view.scene.collision.length+'\ncloth '+clothRuntime.map(entry=>entry.id+' runtimeActive='+entry.runtimeActive).join(' | ')+'\nplayer world='+controller.x.toFixed(2)+','+controller.y.toFixed(2)+' tile='+Math.floor(controller.x)+','+Math.floor(controller.y)+'\nhits='+(hits.join(', ')||'none')+'\ninteraction='+(targetDebug.active?targetDebug.active.id+' '+targetDebug.active.type+' d='+targetDebug.active.distance.toFixed(2)+' score='+targetDebug.active.score.toFixed(0):'none')+'\nlegend: static purple | plot yellow | local red | portal blue | NPC green | service yellow | furniture orange';}this.playerDebug.setVisible(showSpriteDebug||showClothDebug||showCollisionDebug);if(showCollisionDebug)this.playerDebug.setText(collisionDebugText);else if(showSpriteDebug)this.playerDebug.setText('player sprite\\nkey='+playerKey+' gender='+(controller.player?.appearance?.gender??'-')+'\\ndir='+controller.direction+' frame='+playerFrame+'\\nworld='+controller.x.toFixed(2)+','+controller.y.toFixed(2)+' draw='+(ox+controller.x*TILE).toFixed(1)+','+(oy+controller.y*TILE).toFixed(1)+'\\nloaded='+playerReady+' drawn='+playerDrawSuccess+' fallback='+(!playerDrawSuccess));else if(showClothDebug)this.playerDebug.setText('cloth V2 (debug only)\\nasset=building_cloth_shop_base?v=cloth-v2\\nnatural=384x320 | world bounds=(28,27)-(40,37)\\nplot=P_BAISHI_005 | entrance S=(34,37.6)\\ntrigger=(32.75,37.15) 2.5x1.6 | old W=false\\nplayer world='+controller.x.toFixed(2)+','+controller.y.toFixed(2));const important=(controller.dialogueSpeaker==='白石商行伙计'||controller.dialogueSpeaker==='陈掌柜'||controller.dialogueSpeaker==='街坊杂货铺店员'||controller.dialogueSpeaker==='青丝美发师'||controller.dialogueSpeaker==='春衫掌柜'||controller.dialogueSpeaker==='主角')&&!!controller.dialogue;this.portraitDim.setVisible(important);this.clerkPortrait.setVisible(important&&controller.dialogueSpeaker==='白石商行伙计');this.shopkeeperPortrait.setVisible(important&&controller.dialogueSpeaker==='陈掌柜');this.assistantPortrait.setVisible(important&&controller.dialogueSpeaker==='街坊杂货铺店员');this.hairdresserPortrait.setVisible(important&&controller.dialogueSpeaker==='青丝美发师');this.clothShopkeeperPortrait.setVisible(important&&controller.dialogueSpeaker==='春衫掌柜');this.playerPortrait.setTexture(controller.player?.appearance?.gender==='MALE'?'portrait-player-male':'portrait-player-female').setVisible(important);}else this.ground.setVisible(false);for(let i=this.labelIndex;i<this.labels.length;i++)this.labels[i].setVisible(false);}}
new Phaser.Game({type:Phaser.CANVAS,width:WIDTH,height:HEIGHT,parent:'game',backgroundColor:'#292924',scene:[BaishiScene],scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},...PIXEL_ART_RENDER_CONFIG});
byId<HTMLInputElement>('account').value=platform.readLocal('fjhy.devAccount')??'web-traveler';byId<HTMLButtonElement>('login').onclick=()=>void run(async()=>{const account=byId<HTMLInputElement>('account').value.trim()||'web-traveler';platform.writeLocal('fjhy.devAccount',account);await controller.loginDev(account);entered=false;confirmingRestart=false;});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-gender]'))button.onclick=()=>{draft.gender=button.dataset.gender as Draft['gender'];refreshCreation();};for(const button of document.querySelectorAll<HTMLButtonElement>('[data-direction]'))button.onclick=()=>{draft.direction=button.dataset.direction as Direction;refreshCreation();};byId<HTMLButtonElement>('create-player').onclick=()=>void run(()=>controller.create(draft.gender,{faceId:draft.faceId,hairId:draft.hairId,outfitId:draft.outfitId},validatePlayerIdentity(draft)));

byId<HTMLButtonElement>('interact').onclick=()=>void run(()=>controller.interact());for(const button of document.querySelectorAll<HTMLButtonElement>('#dpad button')){const direction=button.dataset.move!;const set=(on:boolean)=>on?pressed.add(direction):pressed.delete(direction);button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);set(true);};button.onpointerup=()=>set(false);button.onpointercancel=()=>set(false);button.onpointerleave=()=>set(false);button.oncontextmenu=e=>e.preventDefault();}window.addEventListener('blur',()=>pressed.clear());
questToggle.onclick=()=>{questDetailsOpen=!questDetailsOpen;refreshQuestPanel();};

byId<HTMLButtonElement>('home-start').onclick=()=>{entered=true;syncUi();};byId<HTMLButtonElement>('home-continue').onclick=()=>{entered=true;syncUi();};byId<HTMLButtonElement>('home-restart').onclick=()=>{confirmingRestart=true;syncUi();};byId<HTMLButtonElement>('restart-cancel').onclick=()=>{confirmingRestart=false;syncUi();};byId<HTMLButtonElement>('restart-accept').onclick=()=>void run(async()=>{await controller.restart();notices.clear();lastNoticeSource='';resetCreationDraft();confirmingRestart=false;entered=true;});
