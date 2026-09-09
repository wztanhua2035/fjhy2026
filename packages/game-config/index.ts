import type { WorldConfig, SceneConfig, BuildingConfig, AppearanceDefinition, EntranceDirection, PlotConfig } from '../shared-types/index.js';
const street = 'STREET_BAISHI_01';
const buildings: BuildingConfig[] = [
  ['B_INN', '横阳客栈', 'INN'], ['B_GROCERY', '街坊杂货铺', 'SHOP'], ['B_TRADE', '白石商行', 'SHOP'],
  ['B_SALON', '青丝美发室', 'SALON'], ['B_CLOTH', '春衫衣坊', 'CLOTH']
].map(([id,name,buildingType],i):BuildingConfig=>({id,name,buildingType,assetKey:`buildings/${id}`,interiorSceneId:`INTERIOR_${id}`,
  openingHours: i<3 ? ['00:00','00:00'] : ['08:00','20:30'], enabled:true,buyable:false,baseValue:0,
  stock: i===1 ? {RICE_01:{buy:12,sell:8,dailyLimit:30},SNACK_01:{buy:8,sell:5,dailyLimit:20}} : i===2 ? {RICE_01:{buy:18,sell:16,dailyLimit:30},SNACK_01:{buy:10,sell:7,dailyLimit:20}} : {}
}));
const scenes: SceneConfig[] = [{id:street,name:'白石街',townId:'TOWN_CENTER',width:48,height:48,tileSize:32,mapAsset:'maps/baishi.tmx',
  // Follows the approved composition: compact main street, centre lane, canal and bridge.
  roads:[{x:0,y:20,width:48,height:5},{x:21,y:20,width:5,height:19},{x:0,y:45,width:48,height:3}],
  collision:[{x:0,y:39,width:22,height:6},{x:26,y:39,width:22,height:6},{x:0,y:0,width:15,height:4},{x:16,y:0,width:18,height:5},{x:35,y:0,width:13,height:4},{x:2,y:27,width:11,height:12},{x:14,y:29,width:6,height:9},{x:28,y:27,width:12,height:11},{x:41,y:27,width:7,height:12}],portals:[],spawnX:23,spawnY:23},
 ...buildings.map((b,i)=>({id:b.interiorSceneId,name:b.name,townId:'TOWN_CENTER',width:24,height:20,tileSize:32,mapAsset:'maps/interior.tmx',roads:[],
  collision:[{x:2,y:3,width:20,height:2}],buildingId:b.id,spawnX:12,spawnY:15,
  portals:[{id:`EXIT_${b.id}`,x:12,y:18,toSceneId:street,spawnX:8.5+i*6,spawnY:21,returnEntranceId:['ENT_BAISHI_INN_S','ENT_BAISHI_GROCERY_S','ENT_BAISHI_TRADE_S','ENT_BAISHI_SALON_W','ENT_BAISHI_CLOTH_W'][i]}]}))];
const appearances: AppearanceDefinition[] = [];
for(const gender of ['MALE','FEMALE'] as const){
  for(let i=1;i<=6;i++) appearances.push({id:`${gender}_${String(i).padStart(2,'0')}`,partType:'BASE',name:`${gender==='MALE'?'少年':'少女'} ${i}`,genderScope:gender,assetKey:`avatars/${gender}_${i}`,price:0,colors:[],enabled:true,starter:true});
  for(const part of ['HAIR','TOP','BOTTOM','SHOES']) for(let i=1;i<=(part==='HAIR'?8:part==='TOP'?6:4);i++) appearances.push({id:`${part}_${gender}_${String(i).padStart(2,'0')}`,partType:part,name:`${{HAIR:'发型',TOP:'上衣',BOTTOM:'下装',SHOES:'鞋'}[part]} ${i}`,genderScope:gender,assetKey:`appearance/${part}_${gender}_${i}`,price:i===1?0:20+i*5,colors:['INK','CHESTNUT','CREAM','SAGE','BLUE','ROSE'],enabled:true,starter:i===1});
}
// Entry markers sit immediately outside a blocked building plot. Make the
// activation zone comfortably reachable from the public road, especially with
// a touch joystick, without opening the building collision area itself.
const entrance=(id:string,x:number,y:number,direction:EntranceDirection,targetScene:string,spawnX=12,spawnY=15)=>({id,position:{x,y},direction,interactionArea:{x:x-1.25,y:y-1.45,width:2.5,height:2.6},targetScene,targetSpawnPoint:{x:spawnX,y:spawnY}});
const baishiPlots: PlotConfig[] = [
  {id:'P_BAISHI_001',x:2,y:5,width:13,height:14,entranceX:8.5,entranceY:20,entrances:[entrance('ENT_BAISHI_INN_S',8.5,20,'south','INTERIOR_B_INN')],buildingId:'B_INN'},
  {id:'P_BAISHI_002',x:16,y:9,width:10,height:10,entranceX:21,entranceY:20,entrances:[entrance('ENT_BAISHI_GROCERY_S',21,20,'south','INTERIOR_B_GROCERY')],buildingId:'B_GROCERY'},
  {id:'P_BAISHI_003',x:27,y:7,width:10,height:12,entranceX:32.5,entranceY:20,entrances:[entrance('ENT_BAISHI_TRADE_S',32.5,20,'south','INTERIOR_B_TRADE')],buildingId:'B_TRADE'},
  {id:'P_BAISHI_004',x:39,y:5,width:9,height:14,entranceX:37.5,entranceY:14,entrances:[entrance('ENT_BAISHI_SALON_W',37.5,14,'west','INTERIOR_B_SALON')],buildingId:'B_SALON'},
  {id:'P_BAISHI_005',x:28,y:27,width:12,height:11,entranceX:26.5,entranceY:33,entrances:[entrance('ENT_BAISHI_CLOTH_W',26.5,33,'west','INTERIOR_B_CLOTH')],buildingId:'B_CLOTH'},
  ...[{id:'P_BAISHI_006',x:2,y:27,width:11,height:12},{id:'P_BAISHI_007',x:14,y:29,width:6,height:9},{id:'P_BAISHI_008',x:28,y:27,width:12,height:11},{id:'P_BAISHI_009',x:41,y:27,width:7,height:12},{id:'P_BAISHI_010',x:41,y:5,width:7,height:14}].map(p=>({...p,entranceX:p.x+1,entranceY:p.y+p.height+1,buildingId:null}))
].map(p=>({townId:'TOWN_CENTER',districtId:'DIST_BAISHI',sceneId:street,plotType:'M',facing:'SOUTH',status:p.buildingId?'NPC_OCCUPIED':'RESERVED',allowedBuildingTypes:['SHOP','INN','SALON','CLOTH'],version:1,...p}));
export const initialWorld: WorldConfig = {
  worldVersion:1, configVersion:1, assetVersion:2, scenes, buildings, appearances,
  plots:baishiPlots,
  npcs:[{id:'NPC_001',name:'陈掌柜',nameLocked:true,enabled:true,sceneId:'INTERIOR_B_INN',x:8,y:9,priority:100,hours:['00:00','00:00'],questId:'Q_002',dialogue:['欢迎来到横阳！出门沿白石街走，街坊杂货铺的大米每袋十二文。','去白石商行问问收购价，试试你的第一笔生意。'],route:[{x:8,y:9},{x:10,y:9}],appearance:{gender:'MALE',baseAvatarId:'MALE_05',hairStyleId:'HAIR_MALE_06',hairColorId:'CHESTNUT',topStyleId:'TOP_MALE_04',topColorId:'BLUE',bottomStyleId:'BOTTOM_MALE_02',bottomColorId:'CREAM',shoesId:'SHOES_MALE_02',accessoryIds:[]}},    {id:'NPC_TRADE_CLERK',name:'白石商行伙计',nameLocked:false,enabled:true,sceneId:'INTERIOR_B_TRADE',x:12,y:9,priority:80,hours:['00:00','00:00'] as [string,string],questId:'Q_001',dialogue:['掌柜让我照看商行。你若想做第一笔生意，就先买一袋鸣山大米，再拿到这里来卖。','货物已经备好，买入后再回来找我。'],route:[],appearance:{gender:'MALE',baseAvatarId:'MALE_02',hairStyleId:'HAIR_MALE_04',hairColorId:'INK',topStyleId:'TOP_MALE_02',topColorId:'SAGE',bottomStyleId:'BOTTOM_MALE_01',bottomColorId:'CREAM',shoesId:'SHOES_MALE_01',accessoryIds:[]}},
    {id:'NPC_GROCERY_CLERK',name:'街坊杂货铺店员',nameLocked:false,enabled:true,sceneId:'INTERIOR_B_GROCERY',x:12,y:9,priority:75,hours:['00:00','00:00'] as [string,string],dialogue:['鸣山大米十二文一袋，需要的话可以直接买。','货物新鲜，买好后可以拿去白石商行问问收购价。'],route:[],appearance:{gender:'FEMALE',baseAvatarId:'FEMALE_04',hairStyleId:'HAIR_FEMALE_03',hairColorId:'CHESTNUT',topStyleId:'TOP_FEMALE_02',topColorId:'ROSE',bottomStyleId:'BOTTOM_FEMALE_01',bottomColorId:'CREAM',shoesId:'SHOES_FEMALE_01',accessoryIds:[]}},
    ...[
      ['阿青','FEMALE','FEMALE_02','HAIR_FEMALE_05','CHESTNUT','TOP_FEMALE_03','ROSE','BOTTOM_FEMALE_02','BLUE','SHOES_FEMALE_02'],
      ['周叔','MALE','MALE_03','HAIR_MALE_07','INK','TOP_MALE_05','SAGE','BOTTOM_MALE_03','CREAM','SHOES_MALE_03'],
      ['小禾','FEMALE','FEMALE_06','HAIR_FEMALE_08','SAGE','TOP_FEMALE_05','CREAM','BOTTOM_FEMALE_04','ROSE','SHOES_FEMALE_03']
    ].map(([name,gender,baseAvatarId,hairStyleId,hairColorId,topStyleId,topColorId,bottomStyleId,bottomColorId,shoesId],i)=>({id:`NPC_00${i+2}`,name,nameLocked:false,enabled:true,sceneId:street,x:16+i*7,y:22.5,priority:50-i,hours:['00:00','00:00'] as [string,string],dialogue:['白石街的店铺各有行价，货比三家总没错。'],route:[{x:16+i*7,y:22.5},{x:18+i*7,y:22.5}],appearance:{gender:gender as 'MALE'|'FEMALE',baseAvatarId,hairStyleId,hairColorId,topStyleId,topColorId,bottomStyleId,bottomColorId,shoesId,accessoryIds:[]}}))],
  items:[{id:'RICE_01',name:'鸣山大米',icon:'米',basePrice:12,giftable:true,stackMax:99},{id:'SNACK_01',name:'横阳米糕',icon:'糕',basePrice:8,giftable:true,stackMax:99},{id:'ERRAND_PACKAGE_01',name:'掌柜的急件',icon:'件',basePrice:1,giftable:false,stackMax:1,questOnly:true}],
  colors:{INK:'#343948',CHESTNUT:'#875742',CREAM:'#eee0bf',SAGE:'#86ac92',BLUE:'#789fc5',ROSE:'#cf8890',SKIN_LIGHT:'#f5d8ba',SKIN_WHEAT:'#e9b78e',SKIN_HONEY:'#d6a180',SKIN_DEEP:'#a96f52'},
  quests:[{id:'Q_001',name:'第一桶金',steps:[
    {type:'BUY',target:'RICE_01',count:1,title:'购买鸣山大米',objective:'前往街坊杂货铺购买 1 份鸣山大米。'},
    {type:'SELL',target:'RICE_01',count:1,title:'出售鸣山大米',objective:'将鸣山大米带回白石商行出售。'}
  ],reward:20,enabled:true},{id:'Q_002',name:'掌柜的急差',steps:[{type:'ACQUIRE',target:'ERRAND_PACKAGE_01',npcId:'NPC_GROCERY_CLERK',count:1,title:'领取掌柜的急件',objective:'向街坊杂货铺店员领取掌柜的急件。'},{type:'DELIVER',target:'ERRAND_PACKAGE_01',npcId:'NPC_001',count:1,title:'交付掌柜的急件',objective:'返回横阳客栈，将急件交给陈掌柜。'}],reward:12,enabled:true}],
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
