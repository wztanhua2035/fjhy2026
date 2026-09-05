import type { WorldConfig, SceneConfig, BuildingConfig, AppearanceDefinition } from '../shared-types/index.js';
const street = 'STREET_BAISHI_01';
const buildings: BuildingConfig[] = [
  ['B_INN', '横阳客栈', 'INN'], ['B_GROCERY', '街坊杂货铺', 'SHOP'], ['B_TRADE', '白石商行', 'SHOP'],
  ['B_SALON', '青丝美发室', 'SALON'], ['B_CLOTH', '春衫衣坊', 'CLOTH']
].map(([id,name,buildingType],i):BuildingConfig=>({id,name,buildingType,assetKey:`buildings/${id}`,interiorSceneId:`INTERIOR_${id}`,
  openingHours: i<3 ? ['00:00','00:00'] : ['08:00','20:30'], enabled:true,buyable:false,baseValue:0,
  stock: i===1 ? {RICE_01:{buy:12,sell:8,dailyLimit:30},SNACK_01:{buy:8,sell:5,dailyLimit:20}} : i===2 ? {RICE_01:{buy:18,sell:16,dailyLimit:30},SNACK_01:{buy:10,sell:7,dailyLimit:20}} : {}
}));
const scenes: SceneConfig[] = [{id:street,name:'白石街',townId:'TOWN_CENTER',width:80,height:80,tileSize:32,mapAsset:'maps/baishi.tmx',
  roads:[{x:0,y:38,width:80,height:6},{x:38,y:0,width:5,height:80}],collision:[],portals:[],spawnX:9,spawnY:41},
 ...buildings.map((b,i)=>({id:b.interiorSceneId,name:b.name,townId:'TOWN_CENTER',width:24,height:20,tileSize:32,mapAsset:'maps/interior.tmx',roads:[],
  collision:[{x:2,y:3,width:20,height:2}],buildingId:b.id,spawnX:12,spawnY:15,
  portals:[{id:`EXIT_${b.id}`,x:12,y:18,toSceneId:street,spawnX:9+i*14,spawnY:37}]}))];
const appearances: AppearanceDefinition[] = [];
for(const gender of ['MALE','FEMALE'] as const){
  for(let i=1;i<=6;i++) appearances.push({id:`${gender}_${String(i).padStart(2,'0')}`,partType:'BASE',name:`${gender==='MALE'?'少年':'少女'} ${i}`,genderScope:gender,assetKey:`avatars/${gender}_${i}`,price:0,colors:[],enabled:true,starter:true});
  for(const part of ['HAIR','TOP','BOTTOM','SHOES']) for(let i=1;i<=(part==='HAIR'?8:part==='TOP'?6:4);i++) appearances.push({id:`${part}_${gender}_${String(i).padStart(2,'0')}`,partType:part,name:`${{HAIR:'发型',TOP:'上衣',BOTTOM:'下装',SHOES:'鞋'}[part]} ${i}`,genderScope:gender,assetKey:`appearance/${part}_${gender}_${i}`,price:i===1?0:20+i*5,colors:['INK','CHESTNUT','CREAM','SAGE','BLUE','ROSE'],enabled:true,starter:i===1});
}
export const initialWorld: WorldConfig = {
  worldVersion:1, configVersion:1, assetVersion:1, scenes, buildings, appearances,
  plots:Array.from({length:10},(_,i)=>({id:`P_BAISHI_${String(i+1).padStart(3,'0')}`,townId:'TOWN_CENTER',districtId:'DIST_BAISHI',sceneId:street,
    plotType:'M',x:6+(i%5)*14,y:i<5?30:46,width:6,height:5,facing:i<5?'SOUTH':'NORTH',entranceX:9+(i%5)*14,entranceY:i<5?36:45,
    status:i<5?'NPC_OCCUPIED':'EMPTY',allowedBuildingTypes:['SHOP','INN','SALON','CLOTH'],buildingId:buildings[i]?.id??null,version:1})),
  npcs:[{id:'NPC_001',name:'陈掌柜',nameLocked:true,enabled:true,sceneId:'INTERIOR_B_INN',x:8,y:9,priority:100,hours:['00:00','00:00'],dialogue:['欢迎来到横阳！出门沿白石街走，街坊杂货铺的大米每袋十二文。','去白石商行问问收购价，试试你的第一笔生意。'],route:[{x:8,y:9},{x:10,y:9}]},
    ...['阿青','周叔','小禾'].map((name,i)=>({id:`NPC_00${i+2}`,name,nameLocked:false,enabled:true,sceneId:street,x:17+i*17,y:42,priority:50-i,hours:['00:00','00:00'] as [string,string],dialogue:['白石街的店铺各有行价，货比三家总没错。'],route:[{x:17+i*17,y:42},{x:21+i*17,y:42}]}))],
  items:[{id:'RICE_01',name:'鸣山大米',basePrice:12,giftable:true,stackMax:99},{id:'SNACK_01',name:'横阳米糕',basePrice:8,giftable:true,stackMax:99}],
  colors:{INK:'#343948',CHESTNUT:'#875742',CREAM:'#eee0bf',SAGE:'#86ac92',BLUE:'#789fc5',ROSE:'#cf8890'},
  quests:[{id:'Q_001',name:'第一桶金',steps:[{type:'BUY',target:'RICE_01',count:1},{type:'SELL',target:'RICE_01',count:1}],reward:0,enabled:true}],
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
