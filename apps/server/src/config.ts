import { z } from 'zod';
import { ensure } from '../../../packages/game-rules/index.js';
import type { WorldConfig } from '../../../packages/shared-types/index.js';
const id=z.string().regex(/^[A-Z][A-Z0-9_]*$/).max(80),name=z.string().min(1).max(40);
const rect=z.object({x:z.number().min(0).max(160),y:z.number().min(0).max(120),width:z.number().positive().max(160),height:z.number().positive().max(120)});
const hours=z.tuple([z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)]);
const point=z.object({x:z.number().min(0).max(160),y:z.number().min(0).max(120)});
const entrance=z.object({id,position:point,direction:z.enum(['south','west','east','north']),interactionArea:rect,targetScene:id,targetSpawnPoint:point});
const interiorZone=rect.extend({id,kind:z.enum(['wall','counter','shelf','storage','stairs','room','waitingArea','servicePoint','displayArea','chair','mirror','exit','entry','future','bed','wardrobe','desk']),solid:z.boolean(),label:z.string().max(40).optional(),interactionPoint:point.optional()});
export const worldSchema=z.object({
  worldVersion:z.number().int().positive(),configVersion:z.number().int().positive(),assetVersion:z.number().int().positive(),
  colors:z.record(id,z.string().regex(/^#[0-9a-fA-F]{6}$/)),
  scenes:z.array(z.object({id,name,townId:id,width:z.number().int().min(10).max(160),height:z.number().int().min(10).max(120),tileSize:z.literal(32),mapAsset:z.string().regex(/^maps\/[a-z0-9_-]+\.tmx$/),roads:z.array(rect),collision:z.array(rect),spawnX:z.number(),spawnY:z.number(),buildingId:id.optional(),interior:z.object({zones:z.array(interiorZone)}).optional(),portals:z.array(z.object({id,x:z.number(),y:z.number(),toSceneId:id,spawnX:z.number(),spawnY:z.number(),returnEntranceId:id.optional()}))})).min(1).max(100),
  plots:z.array(rect.extend({id,townId:id,districtId:id,sceneId:id,plotType:id,facing:id,entranceX:z.number(),entranceY:z.number(),entrances:z.array(entrance).min(1).max(4).optional(),status:z.enum(['EMPTY','RESERVED','NPC_OCCUPIED','PLAYER_OWNED','MUNICIPAL','EVENT','CONSTRUCTION','LOCKED']),allowedBuildingTypes:z.array(id),buildingId:id.nullable(),version:z.number().int().positive()})).max(200),
  buildings:z.array(z.object({id,name,buildingType:id,assetKey:z.string().min(1).max(150),interiorSceneId:id,openingHours:hours,enabled:z.boolean(),buyable:z.boolean(),baseValue:z.number().int().min(0).max(1e9),stock:z.record(id,z.object({buy:z.number().int().min(1).max(1e6),sell:z.number().int().min(1).max(1e6),dailyLimit:z.number().int().min(1).max(1000)})),displayName:name.optional(),description:z.string().min(1).max(160).optional(),signMode:z.enum(['custom_image','dynamic_template']).optional(),signResourceId:id.optional(),signTemplateId:z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),signMeta:z.record(z.string().max(40),z.union([z.string().max(100),z.number(),z.boolean()])).optional()})).max(200),
  npcs:z.array(z.object({id,name,nameLocked:z.boolean(),enabled:z.boolean(),sceneId:id,x:z.number(),y:z.number(),priority:z.number().int().min(0).max(100),hours,dialogue:z.array(z.string().min(1).max(200)).min(1).max(10),route:z.array(point).max(20),questId:id.optional(),appearance:z.union([z.object({gender:z.enum(["MALE","FEMALE"]),baseAvatarId:id,skinColorId:id.optional(),hairStyleId:id,hairColorId:id,topStyleId:id,topColorId:id,bottomStyleId:id,bottomColorId:id,shoesId:id,accessoryIds:z.array(id)}),z.object({gender:z.enum(["MALE","FEMALE"]),skinToneId:id,hairId:id,outfitId:id,accessoryIds:z.array(id),baseAvatarId:id.optional()})]).optional()})).max(200),
  items:z.array(z.object({id,name,icon:z.string().min(1).max(8).optional(),basePrice:z.number().int().min(1).max(1e6),giftable:z.boolean(),stackMax:z.number().int().min(1).max(999),questOnly:z.boolean().optional()})).max(200),
  appearances:z.array(z.object({id,partType:z.enum(['BASE','HAIR','OUTFIT','TOP','BOTTOM','SHOES','ACCESSORY']),name,genderScope:z.enum(['MALE','FEMALE','ALL']),assetKey:z.string().min(1).max(150),price:z.number().int().min(0).max(1e6),colors:z.array(id),enabled:z.boolean(),starter:z.boolean()})).max(500),
  quests:z.array(z.object({id,name,steps:z.array(z.object({type:z.enum(['BUY','SELL','ACQUIRE','DELIVER','REPORT']),target:id,count:z.number().int().positive(),title:z.string().min(1).max(60).optional(),objective:z.string().min(1).max(160).optional(),npcId:id.optional(),completionDialogue:z.string().min(1).max(240).optional()})),reward:z.number().int().min(0).max(1e6),enabled:z.boolean()})).max(100),
  roads:z.array(z.object({id,name,connects:z.array(id)})).max(40)
}).strict();
export function validateWorld(input:unknown,previous?:WorldConfig){
  const w=worldSchema.parse(input);
  for(const list of [w.scenes,w.plots,w.buildings,w.npcs,w.items,w.appearances,w.quests,w.roads])ensure(new Set(list.map(x=>x.id)).size===list.length,'DUPLICATE_ID','配置含重复 ID');
  for(const s of w.scenes){ensure(s.spawnX>=1&&s.spawnX<s.width&&s.spawnY>=1&&s.spawnY<s.height,'BAD_SPAWN','出生点超出场景');for(const r of [...s.roads,...s.collision])ensure(r.x+r.width<=s.width&&r.y+r.height<=s.height,'OUT_OF_BOUNDS','地图区域超出场景');for(const p of s.portals){const to=w.scenes.find(s=>s.id===p.toSceneId);ensure(to,'BAD_REFERENCE','传送门目标不存在');ensure(p.x>=0&&p.y>=0&&p.x<=s.width&&p.y<=s.height&&p.spawnX>=1&&p.spawnY>=1&&p.spawnX<to.width&&p.spawnY<to.height,'BAD_PORTAL','传送门坐标不合法');}}
  for(const s of w.scenes)if(s.interior){
    ensure(!!s.buildingId,'BAD_INTERIOR','室内语义区必须属于建筑');
    const zones=s.interior.zones;
    ensure(new Set(zones.map(z=>z.id)).size===zones.length,'DUPLICATE_ID','室内语义区 ID 不能重复');
    for(const z of zones)ensure(z.x+z.width<=s.width&&z.y+z.height<=s.height,'OUT_OF_BOUNDS','室内语义区超出地图');
    const blocks=zones.filter(z=>z.solid).map(({x,y,width,height})=>({x,y,width,height}));
    ensure(JSON.stringify(blocks)===JSON.stringify(s.collision),'BAD_INTERIOR','室内实体语义区必须与碰撞数据一致');
  }
  for(const b of w.buildings){ensure(w.scenes.some(s=>s.id===b.interiorSceneId&&s.buildingId===b.id),'BAD_REFERENCE','建筑室内场景绑定不匹配');for(const item of Object.keys(b.stock))ensure(w.items.some(i=>i.id===item),'BAD_REFERENCE','商店引用未知商品');}
  const occupied=new Set<string>();
  for(const p of w.plots){const scene=w.scenes.find(s=>s.id===p.sceneId);ensure(scene,'BAD_REFERENCE','地块场景不存在');ensure(p.x+p.width<=scene.width&&p.y+p.height<=scene.height&&p.entranceX>=1&&p.entranceY>=1&&p.entranceX<scene.width&&p.entranceY<scene.height,'OUT_OF_BOUNDS','地块或入口超出场景');const entrances=p.entrances??[];ensure(new Set(entrances.map(e=>e.id)).size===entrances.length,'DUPLICATE_ID','同一地块入口 ID 不能重复');for(const e of entrances){const target=w.scenes.find(s=>s.id===e.targetScene);const a=e.interactionArea;ensure(target&&e.position.x>=1&&e.position.x<scene.width&&e.position.y>=1&&e.position.y<scene.height&&a.x>=0&&a.y>=0&&a.x+a.width<=scene.width&&a.y+a.height<=scene.height&&e.targetSpawnPoint.x>=1&&e.targetSpawnPoint.x<target.width&&e.targetSpawnPoint.y>=1&&e.targetSpawnPoint.y<target.height,'BAD_ENTRANCE','入口坐标、交互区域或目标场景不合法');}if(p.buildingId){const b=w.buildings.find(b=>b.id===p.buildingId);ensure(b&&p.allowedBuildingTypes.includes(b.buildingType),'BAD_REFERENCE','地块不兼容该建筑');ensure(entrances.every(e=>e.targetScene===b!.interiorSceneId),'BAD_REFERENCE','建筑入口目标必须指向该建筑室内');ensure(!occupied.has(b.id),'DUPLICATE_OCCUPANCY','第一阶段每栋建筑只能挂载一个地块');occupied.add(b.id);}}
  for(const n of w.npcs){const scene=w.scenes.find(s=>s.id===n.sceneId);ensure(scene,'BAD_REFERENCE','NPC场景不存在');const points=[{x:n.x,y:n.y},...n.route];const blocked=[...scene!.collision,...w.plots.filter(p=>p.sceneId===n.sceneId&&p.buildingId)];const blockedAt=(x:number,y:number)=>blocked.some(r=>x>r.x-.3&&x<r.x+r.width+.3&&y>r.y-.3&&y<r.y+r.height+.3);for(const point of points)ensure(point.x>=1&&point.y>=1&&point.x<scene!.width&&point.y<scene!.height&&!blockedAt(point.x,point.y),'BAD_NPC_POSITION','NPC位置或巡逻点不可行走');for(let i=1;i<points.length;i++)for(let step=1;step<=16;step++){const t=step/16,x=points[i-1].x+(points[i].x-points[i-1].x)*t,y=points[i-1].y+(points[i].y-points[i-1].y)*t;ensure(!blockedAt(x,y),'BAD_NPC_ROUTE','NPC巡逻路线穿过不可行走区域');}}
  for(const a of w.appearances)for(const c of a.colors)ensure(w.colors[c],'BAD_COLOR','外观配色不存在');
  for(const q of w.quests)for(const step of q.steps){if(['ACQUIRE','DELIVER'].includes(step.type)){ensure(step.npcId&&w.npcs.some(n=>n.id===step.npcId),'BAD_QUEST_STEP','取物/交付步骤必须绑定有效 NPC');const item=w.items.find(i=>i.id===step.target);ensure(item&&item.questOnly,'BAD_QUEST_STEP','取物/交付目标必须是任务物品');}if(step.type==='REPORT'){ensure(step.count===1&&step.npcId&&step.target===step.npcId&&w.npcs.some(n=>n.id===step.npcId),'BAD_QUEST_STEP','汇报步骤必须绑定同一有效 NPC');}}
  if(previous){for(const key of ['scenes','plots','buildings','npcs','items','appearances','quests'] as const)for(const old of previous[key])ensure(w[key].some(x=>x.id===old.id),'IMMUTABLE_ID','不能删除或更改已有 ID，请使用 enabled/status');
    for(const old of previous.npcs.filter(n=>n.nameLocked)){const n=w.npcs.find(n=>n.id===old.id)!;ensure(n.name===old.name&&n.nameLocked,'NAME_LOCKED','核心剧情 NPC 名称已锁定');}
    ensure(JSON.stringify(w.roads)===JSON.stringify(previous.roads),'ROAD_LOCKED','第一阶段锁定道路拓扑，请在后续地图版本中扩展');
    for(const old of previous.appearances){const a=w.appearances.find(a=>a.id===old.id)!;ensure(a.partType===old.partType&&a.genderScope===old.genderScope,'APPEARANCE_IDENTITY','已有部件的类型和性别不可改变');}}
  return w;
}
export interface Environment { mode:string;appEnv:string;port:number;jwtSecret:string;subjectSecret:string;adminToken:string;allowDevAuth:boolean;appId:string;appSecret:string;adminOrigin:string;assetBase:string }
export function environment():Environment {
  const e=process.env,mode=e.NODE_ENV??'development',appEnv=e.APP_ENV??'DEV',prod=mode==='production'||appEnv!=='DEV';
  const secret=(key:string)=>{const v=e[key]??'';ensure(v.length>=32&&!v.startsWith('replace-'),'ENV_CONFIG',`${key} 需要至少32位独立随机值`);return v;};
  const config={mode,appEnv,port:Number(e.PORT??8080),jwtSecret:secret('JWT_SECRET'),subjectSecret:secret('SUBJECT_HASH_SECRET'),adminToken:secret('ADMIN_TOKEN'),allowDevAuth:e.ALLOW_DEV_AUTH==='true',appId:e.WECHAT_APP_ID??'',appSecret:e.WECHAT_APP_SECRET??'',adminOrigin:e.ADMIN_ORIGIN??'http://localhost:5173',assetBase:e.ASSET_BASE_URL??'http://localhost:8080/assets'};
  ensure(new Set([config.jwtSecret,config.subjectSecret,config.adminToken]).size===3,'ENV_CONFIG','三个密钥必须相互独立');
  if(prod){ensure(!config.allowDevAuth,'ENV_CONFIG','非 DEV 环境禁止测试登录');ensure(/^wx[a-z0-9]{16}$/.test(config.appId)&&config.appSecret.length>0,'ENV_CONFIG','请配置微信 AppID 和服务端 AppSecret');ensure(config.assetBase.startsWith('https://')&&config.adminOrigin.startsWith('https://'),'ENV_CONFIG','线上资源与后台必须使用 HTTPS');}
  return config;
}
