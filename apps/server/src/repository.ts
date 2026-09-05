import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { PlayerState, WorldConfig, GhostProfile } from '../../../packages/shared-types/index.js';
import { initialWorld } from '../../../packages/game-config/index.js';
import { ensure } from '../../../packages/game-rules/index.js';
export interface Release { id:string;version:number;status:string;config:WorldConfig;basedOn:number }
export interface Repository {
  login(subject:string):Promise<PlayerState>; player(id:string):Promise<PlayerState>;
  mutate(id:string,requestId:string,hash:string,fn:(p:PlayerState)=>unknown):Promise<any>;
  world():Promise<WorldConfig>; releases():Promise<Release[]>;
  draft(config:WorldConfig,basedOn:number):Promise<Release>; transition(id:string,status:string):Promise<Release>;
  ghosts(exclude:string):Promise<GhostProfile[]>; health():Promise<void>; close():Promise<void>;
}
const fresh=(id:string):PlayerState=>({id,nickname:`旅人${id.slice(0,4)}`,cash:0,stamina:100,status:'ACTIVE',sceneId:'INTERIOR_B_INN',x:12,y:15,appearance:null,inventory:{},cosmetics:[],ledger:[],tradeCounts:{},metNpcs:[]});
export class MemoryRepository implements Repository {
  players=new Map<string,PlayerState>(); subjects=new Map<string,string>(); requests=new Map<string,{hash:string;result:any}>();
  versions:Release[]=[{id:'initial',version:1,status:'PUBLISHED',config:structuredClone(initialWorld),basedOn:0}];
  async login(subject:string){let id=this.subjects.get(subject);if(!id){id=randomUUID();this.subjects.set(subject,id);this.players.set(id,fresh(id));}return this.player(id);}
  async player(id:string){const p=this.players.get(id);ensure(p,'UNAUTHORIZED','请重新登录',401);return structuredClone(p);}
  async mutate(id:string,requestId:string,hash:string,fn:(p:PlayerState)=>unknown){
    const key=`${id}:${requestId}`,old=this.requests.get(key);if(old){ensure(old.hash===hash,'REQUEST_CONFLICT','请求编号已被其他操作使用',409);return structuredClone(old.result);}
    const original=this.players.get(id);ensure(original,'UNAUTHORIZED','请重新登录',401);const p=structuredClone(original);
    const result=fn(p);this.players.set(id,p);this.requests.set(key,{hash,result:structuredClone(result)});return result;
  }
  async world(){return structuredClone(this.versions.find(r=>r.status==='PUBLISHED')!.config);}
  async releases(){return structuredClone(this.versions);}
  async draft(config:WorldConfig,basedOn:number){const r={id:randomUUID(),version:Math.max(...this.versions.map(r=>r.version))+1,status:'DRAFT',config:structuredClone(config),basedOn};r.config.configVersion=r.version;this.versions.push(r);return structuredClone(r);}
  async transition(id:string,status:string){const r=this.versions.find(r=>r.id===id);ensure(r,'NOT_FOUND','版本不存在',404);checkTransition(r,status);if(status==='PUBLISHED'){ensure(this.versions.find(v=>v.status==='PUBLISHED')!.version===r.basedOn,'STALE_DRAFT','线上版本已更新，请基于最新版重新建草稿',409);this.versions.filter(v=>v.status==='PUBLISHED').forEach(v=>v.status='ARCHIVED');}r.status=status;return structuredClone(r);}
  async ghosts(exclude:string){return [...this.players.values()].filter(p=>p.id!==exclude&&p.appearance&&p.status==='ACTIVE').slice(0,6).map(p=>({playerId:p.id,nickname:p.nickname,appearance:p.appearance!,title:'初到横阳',updatedAt:new Date().toISOString()}));}
  async health(){} async close(){}
}
function checkTransition(r:Release,status:string){ensure((r.status==='DRAFT'&&status==='TEST')||(r.status==='TEST'&&status==='PUBLISHED'),'INVALID_TRANSITION','必须先将草稿验证为 TEST，再发布',409);}
const include={appearance:true,inventory:true,cosmetics:true,ledger:{orderBy:{createdAt:'desc' as const},take:100}};
function decode(row:any):PlayerState{return {id:row.id,nickname:row.nickname,cash:Number(row.cash),stamina:row.stamina,status:row.status,sceneId:row.sceneId,x:row.x,y:row.y,
  appearance:row.appearance?{gender:row.appearance.gender,baseAvatarId:row.appearance.baseAvatarId,hairStyleId:row.appearance.hairStyleId,hairColorId:row.appearance.hairColorId,topStyleId:row.appearance.topStyleId,topColorId:row.appearance.topColorId,bottomStyleId:row.appearance.bottomStyleId,bottomColorId:row.appearance.bottomColorId,shoesId:row.appearance.shoesId,accessoryIds:row.appearance.accessoryIds}:null,
  inventory:Object.fromEntries(row.inventory.map((i:any)=>[i.itemId,i.quantity])),cosmetics:row.cosmetics.map((c:any)=>c.appearanceId),tradeCounts:row.tradeCounts,metNpcs:row.metNpcs,
  ledger:row.ledger.slice().reverse().map((l:any)=>({id:l.id,type:l.type,amount:Number(l.amount),before:Number(l.before),after:Number(l.after),referenceId:l.referenceId,requestId:l.requestId,createdAt:l.createdAt.toISOString()}))};}
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export class PostgresRepository implements Repository {
  constructor(public db:PrismaClient){}
  async login(subject:string){const row=await this.db.player.upsert({where:{subjectHash:subject},update:{lastLoginAt:new Date()},create:{subjectHash:subject,nickname:`旅人${randomUUID().slice(0,4)}`},include});return decode(row);}
  async player(id:string){const row=await this.db.player.findUnique({where:{id},include});ensure(row,'UNAUTHORIZED','请重新登录',401);return decode(row);}
  async mutate(id:string,requestId:string,hash:string,fn:(p:PlayerState)=>unknown){
    return this.db.$transaction(async tx=>{
      // One actor's transactions serialize across all API replicas. State and request record commit together.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))::text`;
      const old=await tx.idempotencyRequest.findUnique({where:{playerId_requestId:{playerId:id,requestId}}});
      if(old){ensure(old.hash===hash,'REQUEST_CONFLICT','请求编号已被其他操作使用',409);return old.result;}
      const row=await tx.player.findUnique({where:{id},include});ensure(row,'UNAUTHORIZED','请重新登录',401);
      const p=decode(row),ledgerIds=new Set(p.ledger.map(l=>l.id)),result=fn(p);
      await tx.player.update({where:{id},data:{cash:BigInt(p.cash),stamina:p.stamina,sceneId:p.sceneId,x:p.x,y:p.y,tradeCounts:json(p.tradeCounts),metNpcs:json(p.metNpcs)}});
      if(p.appearance){await tx.playerAppearance.upsert({where:{playerId:id},create:{playerId:id,...p.appearance},update:{...p.appearance}});
        await tx.ghostSnapshot.upsert({where:{playerId:id},create:{playerId:id,snapshot:json({playerId:id,nickname:p.nickname,appearance:p.appearance,title:'初到横阳'})},update:{snapshot:json({playerId:id,nickname:p.nickname,appearance:p.appearance,title:'初到横阳'})}});}
      await tx.inventory.deleteMany({where:{playerId:id}});
      if(Object.keys(p.inventory).length)await tx.inventory.createMany({data:Object.entries(p.inventory).map(([itemId,quantity])=>({playerId:id,itemId,quantity}))});
      for(const appearanceId of p.cosmetics)await tx.playerCosmetic.upsert({where:{playerId_appearanceId:{playerId:id,appearanceId}},create:{playerId:id,appearanceId},update:{}});
      for(const l of p.ledger.filter(l=>!ledgerIds.has(l.id)))await tx.playerLedger.create({data:{...l,playerId:id,amount:BigInt(l.amount),before:BigInt(l.before),after:BigInt(l.after)}});
      await tx.idempotencyRequest.create({data:{playerId:id,requestId,hash,result:json(result)}});return result;
    },{timeout:15000});
  }
  async world(){const r=await this.db.worldRelease.findFirst({where:{status:'PUBLISHED'},orderBy:{version:'desc'}});ensure(r,'NOT_SEEDED','请先初始化世界配置',503);return r.config as unknown as WorldConfig;}
  async releases(){return await this.db.worldRelease.findMany({orderBy:{version:'desc'}}) as unknown as Release[];}
  async draft(config:WorldConfig,basedOn:number){return this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(782233)::text`;const max=await tx.worldRelease.aggregate({_max:{version:true}}),version=(max._max.version??0)+1;
    const r=await tx.worldRelease.create({data:{version,basedOn,config:json({...config,configVersion:version})}});await tx.adminAudit.create({data:{actor:'admin',action:'DRAFT',releaseId:r.id,details:{basedOn}}});return r as unknown as Release;});}
  async transition(id:string,status:string){return this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(782233)::text`;const r=await tx.worldRelease.findUnique({where:{id}});ensure(r,'NOT_FOUND','版本不存在',404);checkTransition(r as unknown as Release,status);
    if(status==='PUBLISHED'){const live=await tx.worldRelease.findFirst({where:{status:'PUBLISHED'}});ensure(live?.version===r.basedOn,'STALE_DRAFT','线上版本已更新，请重新建草稿',409);await tx.worldRelease.updateMany({where:{status:'PUBLISHED'},data:{status:'ARCHIVED'}});}
    const updated=await tx.worldRelease.update({where:{id},data:{status}});await tx.adminAudit.create({data:{actor:'admin',action:status,releaseId:id,details:{version:r.version}}});return updated as unknown as Release;});}
  async ghosts(exclude:string){const rows=await this.db.ghostSnapshot.findMany({where:{playerId:{not:exclude},player:{status:'ACTIVE',lastLoginAt:{gt:new Date(Date.now()-7*86400000)}}},take:6,orderBy:{updatedAt:'desc'}});return rows.map(r=>({...r.snapshot as unknown as GhostProfile,updatedAt:r.updatedAt.toISOString()}));}
  async health(){await this.db.$queryRaw`SELECT 1`;} async close(){await this.db.$disconnect();}
}
