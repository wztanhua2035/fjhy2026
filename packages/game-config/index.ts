import { groceryItems, groceryStock, groceryBinding } from './grocery.js';
import type { WorldConfig, SceneConfig, BuildingConfig, AppearanceDefinition, EntranceDirection, PlotConfig, InteriorZone } from '../shared-types/index.js';
import { GUEST_ROOM_SCENE_ID, INN_LOBBY_SCENE_ID } from './inn-opening.js';
import { starterLooks } from './appearance-v1.js';
import {hairConfigs,hairServiceOffers} from './hair-services.js';
import {outfitConfigs,outfitOffers} from './outfits.js';
import {faceConfigs} from './face-templates.js';
export { starterLookOptions, starterLooks, availableStarterLookOptions } from './appearance-v1.js';
export {faceConfigs,availableFaces,defaultFaceId} from './face-templates.js';
export {headwearConfigs} from './headwear.js';
const street = 'STREET_BAISHI_01';
// Solid decorations reuse the shared static-collision path. Rectangles follow
// only each object's footprint and leave every entrance corridor unobstructed.
export const baishiBuildingObjectCollision = {
  B_INN: [
    {x:3.35,y:18.2,width:2.65,height:1.55}, // 左侧花盆与落地装饰
    {x:10,y:18.55,width:.9,height:1.2}, // 门右侧花盆
    {x:11.1,y:17.7,width:2.15,height:2.05} // 右侧黑板
  ],
  B_GROCERY: [
    {x:16.05,y:18.15,width:1.9,height:1.6}, // 左侧花盆、货袋
    {x:18.25,y:17.65,width:1.25,height:2.1}, // 左侧黑板
    {x:22.5,y:18.45,width:1.15,height:1.3}, // 门右侧货物、花盆
    {x:23.75,y:17.65,width:2.1,height:2.1} // 右侧黑板与货物
  ],
  B_TRADE: [
    {x:27.35,y:18.1,width:2.55,height:1.65}, // 大门左侧货袋、花盆
    {x:33.95,y:18.45,width:.7,height:1.3}, // 大门右侧小摆件
    {x:34.65,y:18,width:2.25,height:1.75} // 右侧花盆与货物
  ],
  B_SALON: [
    {x:39.05,y:17.8,width:2.2,height:1.95}, // 左侧理发灯与花盆
    {x:46.4,y:17.65,width:1.45,height:2.1} // 右侧立牌与花盆
  ],
  B_CLOTH: [
    {x:25.5,y:27.2,width:2.5,height:9.8}, // 左侧竖向雨棚
    {x:26.4,y:25.75,width:1.6,height:1.45}, // 左上角雨棚与阳台连接段
    {x:27.55,y:24.75,width:9.6,height:2.25}, // 北侧横向阳台、上层平台
    {x:29.15,y:36.15,width:1.55,height:1.4}, // 门前黑板
    {x:28.05,y:35.8,width:1.05,height:1.75}, // 左侧大型花盆
    {x:36.85,y:35.55,width:1.7,height:1.85}, // 落地衣架
    {x:38.7,y:35.7,width:1.15,height:1.85} // 右侧大型花盆
  ]
} as const;
export const baishiStreetObjectCollision = Object.values(baishiBuildingObjectCollision).flat();
const buildings: BuildingConfig[] = [
  ['B_INN', '横阳客栈', 'INN'], ['B_GROCERY', '街坊杂货铺', 'SHOP'], ['B_TRADE', '白石商行', 'SHOP'],
  ['B_SALON', '青丝美发室', 'SALON'], ['B_CLOTH', '春衫衣坊', 'CLOTH']
].map(([id,name,buildingType],i):BuildingConfig=>({id,name,displayName:name,description:{B_INN:'白石街上的温暖落脚处',B_GROCERY:'街坊日常所需的小店',B_TRADE:'收购与交易的商行',B_SALON:'传统街景里的现代美发室',B_CLOTH:'陈列完整穿搭的精品衣坊'}[id],signMode:'custom_image',signResourceId:({B_INN:'SIGN_BAISHI_INN_V1',B_GROCERY:'SIGN_BAISHI_GROCERY_V1',B_TRADE:'SIGN_BAISHI_TRADE_V1',B_SALON:'SIGN_BAISHI_SALON_V1',B_CLOTH:'SIGN_BAISHI_CLOTH_V1'} as Record<string,string>)[id],signTemplateId:id==='B_TRADE'?'horizontal-lacquer':'horizontal-wood',signMeta:{layout:'horizontal',maxChars:8},buildingType,assetKey:`buildings/${id}`,interiorSceneId:`INTERIOR_${id}`,
  openingHours: i<3 ? ['00:00','00:00'] : ['08:00','20:30'], enabled:true,buyable:false,baseValue:0,
  ...(i===1?groceryBinding:i===2?{clerkNpcId:'NPC_TRADE_CLERK',servicePointId:'TRADE_SERVICE'}:{}),
  stock: i===1 ? groceryStock : i===2 ? {
    RICE_01:{baseBuyPrice:18,baseSellPrice:16,canBuy:true,canSell:true,stockMode:'INFINITE',pricingMode:'FIXED',dailyLimit:999,enabled:true,sortOrder:1},
    SNACK_01:{baseBuyPrice:10,baseSellPrice:7,canBuy:true,canSell:true,stockMode:'INFINITE',pricingMode:'FIXED',dailyLimit:999,enabled:true,sortOrder:2},
    WATER_01:{baseBuyPrice:9,baseSellPrice:4,canBuy:true,canSell:true,stockMode:'INFINITE',pricingMode:'FIXED',dailyLimit:999,enabled:true,sortOrder:3},
    MILK_01:{baseSellPrice:9,canBuy:false,canSell:true,stockMode:'INFINITE',pricingMode:'FIXED',dailyLimit:999,enabled:true,sortOrder:4},
    TISSUE_01:{baseBuyPrice:28,baseSellPrice:13,canBuy:true,canSell:true,stockMode:'INFINITE',pricingMode:'FIXED',dailyLimit:999,enabled:true,sortOrder:5},
    UMBRELLA_01:{baseSellPrice:38,canBuy:false,canSell:true,stockMode:'INFINITE',pricingMode:'FIXED',dailyLimit:999,enabled:true,sortOrder:6}
  } : {}
}));
const zone=(id:string,kind:InteriorZone['kind'],x:number,y:number,width:number,height:number,solid=false,label?:string):InteriorZone=>({id,kind,x,y,width,height,solid,...(label?{label}:{})});
const interiorZones: Record<string,InteriorZone[]> = {
  B_INN: [
    zone('INN_NORTH_WALL','wall',2,3,20,2,true),
    zone('INN_COUNTER','counter',8.4,6.5,6.4,2.2,true),
      zone('INN_GUEST_ROOM','room',1.8,5.1,2.6,3.2),
    zone('INN_ROOM_PARTITION','wall',2.5,11.4,5,.45,true),
    zone('INN_ROOM_SIDE','wall',7.05,11.4,.45,2,true),
    zone('INN_WAITING','waitingArea',15,12,6,3),
    zone('INN_TABLE_A','chair',16.7,9.6,2.8,2.1,true),
    zone('INN_TABLE_B','chair',17.1,13,2.8,2.5,true),
    zone('INN_WAITING_SOFA','chair',1.9,12.4,5,2.8,true),
    zone('INN_SIDE_DISPLAY','shelf',20.5,9.3,2.1,2.7,true),
    zone('INN_STAIRS','stairs',17.5,5.4,3.5,3.2,true,'二楼装修中'),
    zone('INN_SERVICE','servicePoint',8,12,1.5,1),
    zone('INN_ENTRY','entry',11.5,14.4,1,1),
    zone('INN_EXIT','exit',11.3,17.3,1.4,1.4)
  ],
  B_GROCERY: [
    zone('GROCERY_NORTH_WALL','wall',2,3,20,2,true),
    zone('GROCERY_COUNTER','counter',7.9,7.45,7.7,1.2,true),
    zone('GROCERY_SHELF_A','shelf',6.2,11.1,4.1,2.15,true),
    zone('GROCERY_SHELF_B','shelf',13.7,11.1,3.5,2.15,true),
    zone('GROCERY_SHELF_C','shelf',21.4,8.5,1.2,4.2,true),
    zone('GROCERY_SIDE_TABLE','chair',2.8,7.2,3,2.8,true),
    zone('GROCERY_FRONT_DISPLAY','shelf',1.8,14.5,4.5,1.6,true),
    zone('GROCERY_DISPLAY','displayArea',4,13,3,2),
    zone('GROCERY_SERVICE','servicePoint',11,12,2,1),
    zone('GROCERY_ENTRY','entry',11.5,14.4,1,1),
    zone('GROCERY_EXIT','exit',11.3,17.3,1.4,1.4)
  ],
  B_TRADE: [
    zone('TRADE_NORTH_WALL','wall',2,3,20,2,true),
    zone('TRADE_COUNTER','counter',7.9,7.4,7.7,1.25,true),
    zone('TRADE_STORAGE_LEFT','storage',1.1,9.5,5.1,5.8,true),
    zone('TRADE_STORAGE_RIGHT','storage',19.5,8.4,3.3,6.6,true),
    zone('TRADE_CENTRE_GOODS','displayArea',9.5,9.5,4.7,2.1,true),
    zone('TRADE_SIDE_DESK','counter',18.3,11.8,2.6,2.1,true),
    zone('TRADE_LEDGER_DESK','desk',2.2,6.9,3,1.6,true),
    zone('TRADE_DISPLAY','displayArea',18,12,3,2),
    zone('TRADE_SERVICE','servicePoint',11,12,2,1),
    zone('TRADE_FUTURE_COMMISSION','future',4,13,3,2),
    zone('TRADE_ENTRY','entry',11.5,14.4,1,1),
    zone('TRADE_EXIT','exit',11.3,17.3,1.4,1.4)
  ],
  B_SALON: [
    zone('SALON_NORTH_WALL','wall',2,3,20,2,true),
    zone('SALON_MIRROR','mirror',2.1,6.1,7.2,1.1,true),
    zone('SALON_CHAIR','chair',2.2,7.4,1.4,1.9,true),
    zone('SALON_CHAIR_B','chair',4.8,7.4,1.4,1.9,true),
    zone('SALON_CHAIR_C','chair',7.4,7.4,1.4,1.15,true),
    zone('SALON_COUNTER','counter',13,7.2,6.1,1.7,true),
    zone('SALON_WAITING_TABLE','chair',18.2,12.2,1.7,2.2,true),
    zone('SALON_WAITING_SOFA','chair',21,10.7,1.4,4.1,true),
    zone('SALON_WAITING','waitingArea',17,12,4,3),
    zone('SALON_SERVICE','servicePoint',10.5,10,2,1),
    zone('SALON_ENTRY','entry',11.5,14.4,1,1),
    zone('SALON_EXIT','exit',11.3,17.3,1.4,1.4)
  ],
  B_CLOTH: [
    zone('CLOTH_NORTH_WALL','wall',2,3,20,2,true),
    zone('CLOTH_COUNTER','counter',12.1,9.5,5.9,1.55,true),
    zone('CLOTH_RACK_LEFT','shelf',2.2,5.1,6.8,1.2,true),
    zone('CLOTH_RACK_RIGHT','shelf',16.8,5.1,5.1,1.2,true),
    zone('CLOTH_DISPLAY_TABLE','displayArea',5.2,8.7,5.2,2.2,true),
    zone('CLOTH_FRONT_RACK_LEFT','shelf',2.6,12,4.1,3.15,true),
    zone('CLOTH_FRONT_RACK_RIGHT','shelf',18.2,12,3.7,3.15,true),
    zone('CLOTH_FITTING_SCREEN','room',20.3,6.2,2.2,3.3,true),
    zone('CLOTH_DISPLAY','displayArea',5,12,3,2),
    zone('CLOTH_COUNTER_SERVICE','servicePoint',15,12,2,1),
    zone('CLOTH_FITTING','servicePoint',18,12,3,2),
    zone('CLOTH_ENTRY','entry',11.5,14.4,1,1),
    zone('CLOTH_EXIT','exit',11.3,17.3,1.4,1.4)
  ]
};
const guestRoomZones: InteriorZone[] = [
  zone('GUEST_NORTH_WALL','wall',.7,.5,12.6,.7,true),
  zone('GUEST_LEFT_WALL','wall',.7,1.2,.5,8.7,true),
  zone('GUEST_RIGHT_WALL','wall',12.9,1.2,.5,8.7,true),
  zone('GUEST_SOUTH_WALL_LEFT','wall',.7,9.9,5,1.1,true),
  zone('GUEST_SOUTH_WALL_RIGHT','wall',8.5,9.9,4.9,1.1,true),
  {...zone('GUEST_BED','bed',1.8,3.25,2.65,3.85,true,'床'),interactionPoint:{x:5.2,y:5.8}},
  {...zone('GUEST_WARDROBE','wardrobe',6.25,2,2,2.45,true,'衣柜'),interactionPoint:{x:7.25,y:5.15}},
  {...zone('GUEST_DESK','desk',9.4,3,2.6,2.4,true,'书桌'),interactionPoint:{x:8.9,y:5.9}},
  {...zone('GUEST_CHEST','storage',10.15,6.7,2.55,2.05,true,'大箱子'),interactionPoint:{x:9.45,y:8.2}},
  zone('GUEST_ENTRY','entry',6.2,8.2,1.6,1.1),
  zone('GUEST_EXIT','exit',6.2,9.75,1.6,.9)
];
const scenePresentation: Record<string, Pick<SceneConfig, 'formalName'|'sceneLabel'>> = {
  [street]: { formalName: '平阳县白石街', sceneLabel: '白石街' },
  INTERIOR_B_INN: { formalName: '横阳客栈大堂', sceneLabel: '横阳客栈' },
  INTERIOR_B_GROCERY: { formalName: '街坊杂货铺', sceneLabel: '街坊杂货铺' },
  INTERIOR_B_TRADE: { formalName: '白石商行', sceneLabel: '白石商行' },
  INTERIOR_B_SALON: { formalName: '青丝美发室', sceneLabel: '青丝美发室' },
  INTERIOR_B_CLOTH: { formalName: '春衫衣坊', sceneLabel: '春衫衣坊' },
  [GUEST_ROOM_SCENE_ID]: { formalName: '横阳客栈临时房', sceneLabel: '临时房' }
};
const scenes: SceneConfig[] = [{id:street,name:'白石街',...scenePresentation[street],townId:'TOWN_CENTER',width:48,height:48,tileSize:32,mapAsset:'maps/baishi.tmx',
  // Follows the approved composition: compact main street, centre lane, canal and bridge.
  roads:[{x:0,y:20,width:48,height:5},{x:21,y:20,width:5,height:19},{x:0,y:45,width:48,height:3}],
  collision:[{x:0,y:39,width:22,height:6},{x:26,y:39,width:22,height:6},{x:0,y:0,width:15,height:4},{x:16,y:0,width:18,height:5},{x:35,y:0,width:13,height:4},{x:2,y:27,width:11,height:12},{x:14,y:29,width:6,height:9},{x:28,y:27,width:11.5,height:10},{x:42,y:27,width:6,height:12},...baishiStreetObjectCollision],portals:[],spawnX:23,spawnY:23},
 ...buildings.map((b,i)=>({id:b.interiorSceneId,name:b.name,...scenePresentation[b.interiorSceneId],townId:'TOWN_CENTER',width:24,height:20,tileSize:32,mapAsset:'maps/interior.tmx',roads:[],
  collision:interiorZones[b.id].filter(z=>z.solid).map(({x,y,width,height})=>({x,y,width,height})),interior:{zones:interiorZones[b.id]},buildingId:b.id,spawnX:12,spawnY:15,
    portals:[{id:`EXIT_${b.id}`,x:12,y:18,interactionArea:{x:10.2,y:17,width:3.6,height:2},toSceneId:street,spawnX:8.5+i*6,spawnY:21,returnEntranceId:['ENT_BAISHI_INN_S','ENT_BAISHI_GROCERY_S','ENT_BAISHI_TRADE_S','ENT_BAISHI_SALON_W','ENT_BAISHI_CLOTH_S'][i]},...(b.id==='B_INN'?[{id:'ENTER_INN_GUEST_ROOM',x:3,y:7.2,interactionArea:{x:1.8,y:5.1,width:2.6,height:3.2},toSceneId:GUEST_ROOM_SCENE_ID,spawnX:7,spawnY:8.4}]:[])]}))];
scenes.push({id:GUEST_ROOM_SCENE_ID,name:'客栈临时房',...scenePresentation[GUEST_ROOM_SCENE_ID],townId:'TOWN_CENTER',width:14,height:12,tileSize:32,mapAsset:'maps/interior.tmx',roads:[],collision:guestRoomZones.filter(z=>z.solid).map(({x,y,width,height})=>({x,y,width,height})),interior:{zones:guestRoomZones},buildingId:'B_INN',spawnX:7,spawnY:8.4,portals:[{id:'EXIT_INN_GUEST_ROOM',x:7,y:10.2,interactionArea:{x:5.7,y:9.2,width:2.8,height:2},toSceneId:INN_LOBBY_SCENE_ID,spawnX:3,spawnY:8.6}]});
const appearances: AppearanceDefinition[] = [];
for(const gender of ['MALE','FEMALE'] as const){
  for(let i=1;i<=6;i++) appearances.push({id:`${gender}_${String(i).padStart(2,'0')}`,partType:'BASE',name:`${gender==='MALE'?'少年':'少女'} ${i}`,genderScope:gender,assetKey:`avatars/${gender}_${i}`,price:0,colors:[],enabled:true,starter:true});
  for(const part of ['HAIR','TOP','BOTTOM','SHOES']) for(let i=1;i<=(part==='HAIR'?8:part==='TOP'?6:4);i++) appearances.push({id:`${part}_${gender}_${String(i).padStart(2,'0')}`,partType:part,name:`${{HAIR:'发型',TOP:'上衣',BOTTOM:'下装',SHOES:'鞋'}[part]} ${i}`,genderScope:gender,assetKey:`appearance/${part}_${gender}_${i}`,price:i===1?0:20+i*5,colors:['INK','CHESTNUT','CREAM','SAGE','BLUE','ROSE'],enabled:true,starter:i===1});
}
appearances.push(...starterLooks);
// Entry markers sit immediately outside a blocked building plot. Make the
// activation zone comfortably reachable from the public road, especially with
// a touch joystick, without opening the building collision area itself.
const entrance=(id:string,x:number,y:number,direction:EntranceDirection,targetScene:string,spawnX=12,spawnY=15)=>({id,position:{x,y},direction,interactionArea:{x:x-1.25,y:y-1.45,width:2.5,height:2.6},targetScene,targetSpawnPoint:{x:spawnX,y:spawnY}});
const baishiPlots: PlotConfig[] = [
  {id:'P_BAISHI_001',x:2,y:5,width:13,height:14,entranceX:8.5,entranceY:20,entrances:[entrance('ENT_BAISHI_INN_S',8.5,20,'south','INTERIOR_B_INN')],buildingId:'B_INN'},
  {id:'P_BAISHI_002',x:16,y:9,width:10,height:10,entranceX:21,entranceY:20,entrances:[entrance('ENT_BAISHI_GROCERY_S',21,20,'south','INTERIOR_B_GROCERY')],buildingId:'B_GROCERY'},
  {id:'P_BAISHI_003',x:27,y:7,width:10,height:12,entranceX:32.5,entranceY:20,entrances:[entrance('ENT_BAISHI_TRADE_S',32.5,20,'south','INTERIOR_B_TRADE')],buildingId:'B_TRADE'},
  {id:'P_BAISHI_004',x:39,y:5,width:9,height:14,entranceX:44,entranceY:20,entrances:[entrance('ENT_BAISHI_SALON_W',44,20,'south','INTERIOR_B_SALON')],buildingId:'B_SALON'},
  {id:'P_BAISHI_005',x:28,y:27,width:11.5,height:10,entranceX:34,entranceY:37.6,entrances:[{...entrance('ENT_BAISHI_CLOTH_S',34,37.6,'south','INTERIOR_B_CLOTH'),interactionArea:{x:32.75,y:37.15,width:2.5,height:1.6}}],buildingId:'B_CLOTH'},
  ...[{id:'P_BAISHI_006',x:2,y:27,width:11,height:12},{id:'P_BAISHI_007',x:14,y:29,width:6,height:9},{id:'P_BAISHI_008',x:28,y:27,width:12,height:11},{id:'P_BAISHI_009',x:41,y:27,width:7,height:12},{id:'P_BAISHI_010',x:41,y:5,width:7,height:14}].map(p=>({...p,entranceX:p.x+1,entranceY:p.y+p.height+1,buildingId:null}))
].map(p=>({townId:'TOWN_CENTER',districtId:'DIST_BAISHI',sceneId:street,plotType:'M',facing:'SOUTH',status:p.buildingId?'NPC_OCCUPIED':'RESERVED',allowedBuildingTypes:['SHOP','INN','SALON','CLOTH'],version:1,...p}));
export const initialWorld: WorldConfig = {
  faces:faceConfigs,
  hairs:hairConfigs,hairServiceOffers,outfits:outfitConfigs,outfitOffers,
  worldVersion:1, configVersion:1, assetVersion:2, scenes, buildings, appearances,
  plots:baishiPlots,
  npcs:[{id:'NPC_001',name:'陈掌柜',nameLocked:true,enabled:true,sceneId:'INTERIOR_B_INN',x:8,y:9,priority:100,hours:['00:00','00:00'],questId:'Q_002',dialogue:['急件拿到了就好，辛苦你跑这一趟。','白石街不大，慢慢走走，总会找到自己的路。','工作慢慢找，别把自己逼得太紧。','街上有什么不清楚的，回来问我。'],route:[{x:8,y:9},{x:10,y:9}],appearance:{gender:'MALE',baseAvatarId:'MALE_05',hairStyleId:'HAIR_MALE_06',hairColorId:'CHESTNUT',topStyleId:'TOP_MALE_04',topColorId:'BLUE',bottomStyleId:'BOTTOM_MALE_02',bottomColorId:'CREAM',shoesId:'SHOES_MALE_02',accessoryIds:[]}},    {id:'NPC_TRADE_CLERK',name:'白石商行伙计',nameLocked:false,enabled:true,sceneId:'INTERIOR_B_TRADE',x:12,y:9,priority:80,hours:['00:00','00:00'] as [string,string],questId:'Q_001',dialogue:['想试试做点小买卖？街坊杂货铺有鸣山大米。你买一份来，我按收价给你算。','大米买好后带来柜台，我替你过秤收下。','货不错，价我给你算清楚。','最近货价还算稳，过阵子就不好说了。'],route:[],appearance:{gender:'MALE',baseAvatarId:'MALE_02',hairStyleId:'HAIR_MALE_04',hairColorId:'INK',topStyleId:'TOP_MALE_02',topColorId:'SAGE',bottomStyleId:'BOTTOM_MALE_01',bottomColorId:'CREAM',shoesId:'SHOES_MALE_01',accessoryIds:[]}},
    {id:'NPC_GROCERY_CLERK',name:'街坊杂货铺店员',nameLocked:false,enabled:true,sceneId:'INTERIOR_B_GROCERY',x:12,y:9,priority:75,hours:['00:00','00:00'] as [string,string],dialogue:['日常吃用的东西都在柜台这边，可以看看商品。','货物新鲜，买好后可以拿去白石商行问问收购价。','要什么自己看看，这边东西都标着呢。','街坊里缺什么，明早进货时我也能留意。'],route:[],appearance:{gender:'FEMALE',baseAvatarId:'FEMALE_04',hairStyleId:'HAIR_FEMALE_03',hairColorId:'CHESTNUT',topStyleId:'TOP_FEMALE_02',topColorId:'ROSE',bottomStyleId:'BOTTOM_FEMALE_01',bottomColorId:'CREAM',shoesId:'SHOES_FEMALE_01',accessoryIds:[]}},    {id:'NPC_SALON_HAIRDRESSER',name:'青丝美发师',nameLocked:false,enabled:true,sceneId:'INTERIOR_B_SALON',x:8,y:9,priority:75,hours:['00:00','00:00'] as [string,string],dialogue:['欢迎光临青丝美发室。','想换个发型或发色，随时可以来找我。','换个发型，有时候人看着都精神不少。','样子合不合适，照镜子看看最清楚。'],route:[],formalArtKey:'npc_hairdresser_walk',portraitKey:'portrait_hairdresser_normal',appearance:{gender:'FEMALE',baseAvatarId:'FEMALE_04',hairStyleId:'HAIR_FEMALE_03',hairColorId:'CHESTNUT',topStyleId:'TOP_FEMALE_02',topColorId:'ROSE',bottomStyleId:'BOTTOM_FEMALE_01',bottomColorId:'CREAM',shoesId:'SHOES_FEMALE_01',accessoryIds:[]}},
    {id:'NPC_CLOTH_SHOPKEEPER',name:'春衫掌柜',nameLocked:false,enabled:true,sceneId:'INTERIOR_B_CLOTH',x:16,y:9,priority:75,hours:['00:00','00:00'] as [string,string],facing:'down',questId:'Q_003',dialogue:['欢迎来到春衫衣坊。衣裳不只是遮风挡雨，也能穿出一个人的精神。','以后想添件新衣、换换装束，都可以来找我。','衣服不是越花越好，穿着舒服、衬人最要紧。','布料的手感和颜色，都得慢慢看。'],route:[],formalArtKey:'npc_cloth_shopkeeper_walk',portraitKey:'portrait_cloth_shopkeeper_normal',appearance:{gender:'MALE',baseAvatarId:'MALE_04',hairStyleId:'HAIR_MALE_03',hairColorId:'INK',topStyleId:'TOP_MALE_03',topColorId:'SAGE',bottomStyleId:'BOTTOM_MALE_02',bottomColorId:'CREAM',shoesId:'SHOES_MALE_02',accessoryIds:[]}},
    ...[
      ['阿青','FEMALE','FEMALE_02','HAIR_FEMALE_05','CHESTNUT','TOP_FEMALE_03','ROSE','BOTTOM_FEMALE_02','BLUE','SHOES_FEMALE_02'],
      ['周叔','MALE','MALE_03','HAIR_MALE_07','INK','TOP_MALE_05','SAGE','BOTTOM_MALE_03','CREAM','SHOES_MALE_03'],
      ['小禾','FEMALE','FEMALE_06','HAIR_FEMALE_08','SAGE','TOP_FEMALE_05','CREAM','BOTTOM_FEMALE_04','ROSE','SHOES_FEMALE_03']
    ].map(([name,gender,baseAvatarId,hairStyleId,hairColorId,topStyleId,topColorId,bottomStyleId,bottomColorId,shoesId],i)=>({id:`NPC_00${i+2}`,name,nameLocked:false,enabled:true,sceneId:street,x:16+i*7,y:22.5,priority:50-i,hours:['00:00','00:00'] as [string,string],dialogue:['白石街的店铺各有行价，货比三家总没错。'],route:[{x:16+i*7,y:22.5},{x:18+i*7,y:22.5}],appearance:{gender:gender as 'MALE'|'FEMALE',baseAvatarId,hairStyleId,hairColorId,topStyleId,topColorId,bottomStyleId,bottomColorId,shoesId,accessoryIds:[]}}))],
  items:[...groceryItems,{id:'ERRAND_PACKAGE_01',name:'掌柜的急件',icon:'件',giftable:false,stackMax:1,stackable:false,questOnly:true,questItem:true,category:'QUEST',usable:false,droppable:false},{id:'CLOTH_SAMPLE_01',name:'新布样',icon:'布',giftable:false,stackMax:1,stackable:false,questOnly:true,questItem:true,category:'QUEST',usable:false,droppable:false}],
  colors:{INK:'#343948',CHESTNUT:'#875742',CREAM:'#eee0bf',SAGE:'#86ac92',BLUE:'#789fc5',ROSE:'#cf8890'},
  quests:[
    {id:'Q_001',name:'第一桶金',steps:[
      {type:'BUY',target:'RICE_01',shopId:'B_GROCERY',count:1,title:'购买鸣山大米',objective:'前往街坊杂货铺购买 1 份鸣山大米。'},
      {type:'SELL',target:'RICE_01',shopId:'B_TRADE',npcId:'NPC_TRADE_CLERK',count:1,title:'出售鸣山大米',objective:'将鸣山大米带回白石商行出售。'}
    ],reward:20,enabled:true,dialogues:{
      accept:[{speakerId:'NPC_TRADE_CLERK',text:'想试试做点小买卖？街坊杂货铺有鸣山大米。你买一份来，我按收价给你算。'},{speakerId:'PLAYER',text:'行，我去跑一趟，先把这笔账弄明白。'}],
      steps:[[{speakerId:'NPC_GROCERY_CLERK',text:'买鸣山大米？今天这批刚到，品相还不错。'}],[{speakerId:'NPC_TRADE_CLERK',text:'鸣山大米？我看看。'}]],
      completion:[{speakerId:'NPC_TRADE_CLERK',text:'东西不错，这一单我收了。'},{speakerId:'NPC_TRADE_CLERK',text:'第一次跑买卖吧？先把账算明白，慢慢就熟了。'}],
      repeat:[{speakerId:'NPC_TRADE_CLERK',text:'最近货价还算稳，过阵子就不好说了。'}]
    }},
    {id:'Q_002',name:'掌柜的急差',steps:[
      {type:'ACQUIRE',target:'ERRAND_PACKAGE_01',npcId:'NPC_GROCERY_CLERK',count:1,title:'领取掌柜的急件',objective:'向街坊杂货铺店员领取掌柜的急件。'},
      {type:'DELIVER',target:'ERRAND_PACKAGE_01',npcId:'NPC_001',count:1,title:'交付掌柜的急件',objective:'返回横阳客栈，将急件交给陈掌柜。'}
    ],reward:12,enabled:true,dialogues:{
      accept:[{speakerId:'NPC_001',text:'正好有件事想请你帮个忙。杂货铺店员替我留了一件急件，你去帮我拿回来。'},{speakerId:'PLAYER',text:'行，您把地方告诉我，我这就去。'}],
      steps:[[{speakerId:'NPC_GROCERY_CLERK',text:'陈掌柜让你来取急件吧？我已经替他留好了。拿上，路上当心。'}],[{speakerId:'NPC_001',text:'拿回来了？辛苦你跑这一趟，我正等着呢。'}]],
      completion:[{speakerId:'NPC_001',text:'这事要是再晚一点，还真有点麻烦。多谢你。'}],
      repeat:[{speakerId:'NPC_001',text:'街上有什么不清楚的，回来问我。'}]
    }},
    {id:'Q_003',name:'雨前送样',steps:[
      {type:'ACQUIRE',target:'CLOTH_SAMPLE_01',npcId:'NPC_CLOTH_SHOPKEEPER',count:1,title:'领取新布样',objective:'与春衫掌柜交谈，领取需要确认配色的新布样。'},
      {type:'DELIVER',target:'CLOTH_SAMPLE_01',npcId:'NPC_SALON_HAIRDRESSER',count:1,title:'把布样交给青丝美发师',objective:'前往青丝美发室，把新布样交给青丝美发师。'},
      {type:'REPORT',target:'NPC_CLOTH_SHOPKEEPER',npcId:'NPC_CLOTH_SHOPKEEPER',count:1,title:'回春衫衣坊向掌柜汇报',objective:'返回春衫衣坊，把“青里再压一点”的意见告诉春衫掌柜。'}
    ],reward:15,enabled:true,dialogues:{
      accept:[{speakerId:'NPC_CLOTH_SHOPKEEPER',text:'我这儿有块新料子，颜色拿不太准。你要是顺路，帮我拿给青丝那边看看。'},{speakerId:'PLAYER',text:'行，我帮您问问。'}],
      steps:[[{speakerId:'NPC_CLOTH_SHOPKEEPER',text:'就是这块。带过去时让她看看灯下的颜色。'}],[{speakerId:'NPC_SALON_HAIRDRESSER',text:'这个颜色挺舒服，不过灯下会显得稍微重一点。'},{speakerId:'NPC_SALON_HAIRDRESSER',text:'要我说，再柔一点会更衬人。你替我把这句话带给春衫掌柜。'}],[{speakerId:'PLAYER',text:'青丝那边说颜色可以再柔一点，灯下会更好看。'},{speakerId:'NPC_CLOTH_SHOPKEEPER',text:'她也这么觉得？那我心里有数了。'}]],
      completion:[{speakerId:'NPC_CLOTH_SHOPKEEPER',text:'辛苦你两头跑，这块布做出来一定更衬人。'}],
      repeat:[{speakerId:'NPC_CLOTH_SHOPKEEPER',text:'衣服不是越花越好，穿着舒服、衬人最要紧。'}]
    }}],
  roads:[{id:'ROAD_BAISHI',name:'白石街',connects:['ROAD_RENMIN','ROAD_HUISHUI','ROAD_JIEFANG','ROAD_PINGRUI','AREA_DONGMEN']},
    {id:'ROAD_JIEFANG',name:'解放街',connects:['AREA_FENGHU','ROAD_RENMIN_NORTH','ROAD_YAHE','ROAD_BAISHI','ROAD_XIANQIAN','GATE_TONGFU','AREA_PONAN']},
    {id:'ROAD_YAHE',name:'雅河路',connects:['ROAD_RENMIN','ROAD_HUISHUI','ROAD_JIEFANG','ROAD_PINGRUI']},
    {id:'ROAD_XIANQIAN',name:'县前街',connects:['ROAD_RENMIN','ROAD_HUISHUI','ROAD_JIEFANG','ROAD_PINGRUI']},
    {id:'ROAD_RENMIN',name:'人民路',connects:['ROAD_YAHE','ROAD_BAISHI','ROAD_XIANQIAN','ROAD_RENMIN_NORTH']},
    {id:'ROAD_RENMIN_NORTH',name:'人民路北段',connects:['ROAD_RENMIN','ROAD_JIEFANG','ROAD_PINGRUI','ROAD_XINGLIANG']},
    {id:'ROAD_PINGRUI',name:'平瑞路',connects:['ROAD_RENMIN_NORTH','ROAD_YAHE','ROAD_BAISHI','ROAD_XIANQIAN']},
    {id:'ROAD_HUISHUI',name:'汇水河路',connects:['ROAD_YAHE','ROAD_BAISHI','ROAD_XIANQIAN']},
    {id:'ROAD_XINGLIANG',name:'兴良路',connects:['ROAD_RENMIN_NORTH','ROAD_PINGRUI','FUTURE_NORTHEAST']},
    {id:'ROAD_LIANDONG',name:'联东路',connects:[]}]
};
