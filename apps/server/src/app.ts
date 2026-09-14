import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import staticPlugin from '@fastify/static';
import { createHmac, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { z, ZodError } from 'zod';
import type { Repository } from './repository.js';
import type { Environment } from './config.js';
import { validateWorld } from './config.js';
import { GameService } from './service.js';
import { ensure, GameError, sceneView, publicPlayer, questStepProgress } from '../../../packages/game-rules/index.js';
import { starterLooks } from '../../../packages/game-config/appearance-v1.js';
import { GUEST_ROOM_SCENE_ID, INN_LOBBY_SCENE_ID } from '../../../packages/game-config/inn-opening.js';
import {firstDayQuestAvailable,firstDayStage} from '../../../packages/game-config/first-day.js';
import { initialWorld } from '../../../packages/game-config/index.js';
import {inventoryEntries} from '../../../packages/game-rules/inventory.js';
import {hairServiceConfig} from '../../../packages/game-config/hair-services.js';
import {faceConfigs} from '../../../packages/game-config/face-templates.js';
import {outfitShopConfig} from '../../../packages/game-config/outfits.js';
import {personalityChoices,formalName,validatePlayerIdentity,PlayerIdentityError} from '../../../packages/game-config/player-profile.js';
declare module '@fastify/jwt' {interface FastifyJWT {payload:{sub:string};user:{sub:string}}}
const requestId=z.string().uuid(),id=z.string().min(1).max(80);
const schemas={
  appearanceService:z.object({requestId,shopId:id,serviceType:z.literal('HAIR'),targetId:id}).strict(),
  create:z.object({requestId,gender:z.enum(['MALE','FEMALE']),faceId:id,hairId:id.optional(),outfitId:id.optional(),headwearId:z.null().optional(),profile:z.object({surname:z.string().optional(),givenName:z.string().optional(),nickname:z.string().optional(),personalityTag:z.string().optional()}).strict()}).strict(),
  move:z.object({requestId,x:z.number().finite(),y:z.number().finite(),path:z.array(z.object({x:z.number().finite(),y:z.number().finite()}).strict()).min(1).max(256).optional()}).strict(),
  enter:z.object({requestId,plotId:id,entranceId:id.optional()}).strict(),portal:z.object({requestId,portalId:id}).strict(),
  buy:z.object({requestId,buildingId:id,itemId:id,quantity:z.number()}).strict(),
  sell:z.object({requestId,buildingId:id,itemId:id,quantity:z.number()}).strict(),
  useItem:z.object({requestId,itemId:id,quantity:z.number()}).strict(),
  talk:z.object({requestId,npcId:id}).strict(),
  introComplete:z.object({requestId}).strict(),finalizeQuest:z.object({requestId,questId:id}).strict(),inspect:z.object({requestId,zoneId:id}).strict(),
  purchaseAppearance:z.object({requestId,buildingId:id,appearanceId:id}).strict(),
  changeAppearance:z.object({requestId,buildingId:id,appearanceId:id,colorId:id.optional()}).strict(),
  wardrobeEquip:z.object({requestId,zoneId:id,outfitId:id}).strict(),
  storageTransfer:z.object({requestId,zoneId:id,itemId:id,quantity:z.number(),direction:z.enum(['deposit','withdraw'])}).strict(),
  sleepStart:z.object({requestId,zoneId:id,hours:z.union([z.literal(1),z.literal(3),z.literal(6)])}).strict(),
  sleepWake:z.object({requestId,zoneId:id}).strict()
};
export async function buildApp(repo:Repository,env:Environment,options:{logger?:boolean;now?:()=>Date;exchangeCode?:(code:string)=>Promise<string>}={}){
  const app=Fastify({logger:options.logger?{redact:['req.headers.authorization','req.headers.cookie','req.body.code','req.body.token']}:false,bodyLimit:2*1024*1024,trustProxy:false});
  await app.register(cors,{origin:env.adminOrigin,methods:['GET','POST'],allowedHeaders:['Content-Type','Authorization','X-Debug-Open-All']});
  await app.register(jwt,{secret:env.jwtSecret,sign:{expiresIn:'7d'}});
  await app.register(rateLimit,{max:180,timeWindow:'1 minute'});
  await app.register(staticPlugin,{root:path.resolve('assets/public'),prefix:'/assets/'});
  const game=new GameService(repo,options.now);
  const requestGameContext=(req:{headers:Record<string,unknown>})=>({debugOpenAll:env.mode!=='production'&&env.appEnv==='DEV'&&req.headers['x-debug-open-all']==='1'});
  app.setErrorHandler((err,req,reply)=>{
    if(err instanceof ZodError)return reply.code(400).send({code:'INVALID_INPUT',message:'输入格式不正确',issues:err.issues.map(i=>({path:i.path,message:i.message}))});
    if(err instanceof GameError)return reply.code(err.status).send({code:err.code,message:err.message});
    const status=(err as any).statusCode??500;
    if(status===429)return reply.code(429).send({code:'RATE_LIMITED',message:'操作较频繁，请稍后重试',retryAfterMs:60000});


if(status>=500){
  app.log.error({
    name:(err as Error).name,
    message:(err as Error).message,
    code:(err as any).code,
    meta:(err as any).meta,
    endpoint:req.routeOptions.url,
    method:req.method,
    payload:req.routeOptions.url?.startsWith('/v1/auth/')?undefined:Object.fromEntries(Object.entries((req.body??{}) as Record<string,unknown>).filter(([key])=>['requestId','buildingId','itemId','quantity','npcId','questId'].includes(key)))
  },'Request failed');
}

    return reply.code(status).send({code:status===401?'UNAUTHORIZED':'REQUEST_FAILED',message:status===401?'登录已过期，请重新登录':'请求失败，请稍后重试'});
  });
  app.addHook('onRequest',async req=>{
    const route=req.routeOptions.url??'';
    if(route.startsWith('/v1/')&&!['/v1/auth/wechat','/v1/auth/dev'].includes(route)){
      await req.jwtVerify();const p=await repo.player(req.user.sub);ensure(p.status==='ACTIVE','BANNED','账号不可用',403);
    }
    if(route.startsWith('/admin/')){const supplied=req.headers.authorization?.replace(/^Bearer /,'')??'';const a=Buffer.from(supplied),b=Buffer.from(env.adminToken);ensure(a.length===b.length&&timingSafeEqual(a,b),'ADMIN_UNAUTHORIZED','后台凭据无效',401);}
  });
  app.get('/healthz',async()=>({status:'ok',environment:env.appEnv}));
  app.get('/readyz',async(_req,reply)=>{try{await repo.health();await repo.world();return {status:'ready'};}catch{return reply.code(503).send({status:'not-ready'});}});
  app.get('/diagnostics/scenes/:id',async req=>{
    ensure(['DEV','STAGING'].includes(env.appEnv),'NOT_FOUND','接口不存在',404);
    const requestedId=(req.params as {id:string}).id;
    ensure([GUEST_ROOM_SCENE_ID,INN_LOBBY_SCENE_ID,'STREET_BAISHI_01'].includes(requestedId),'NOT_FOUND','接口不存在',404);
    const world=await repo.world();
    const scene=sceneView(world,requestedId,game.now()).scene;
    return {movementProtocol:"bounded-path-v1",requestedId,sourcePresent:initialWorld.scenes.some(s=>s.id===requestedId),configVersion:world.configVersion,
      scene:{id:scene.id,width:scene.width,height:scene.height,spawnX:scene.spawnX,spawnY:scene.spawnY,collision:scene.collision,portals:scene.portals,interior:scene.interior},
      npcs:world.npcs.filter(n=>n.sceneId===requestedId).map(n=>({id:n.id,x:n.x,y:n.y}))};
  });
  const login=async(subject:string)=>{const hash=createHmac('sha256',env.subjectSecret).update(subject).digest('hex');const p=await repo.login(hash);ensure(p.status==='ACTIVE','BANNED','账号不可用',403);return {token:app.jwt.sign({sub:p.id}),player:publicPlayer(p)};};
  app.post('/v1/auth/wechat',{config:{rateLimit:{max:20,timeWindow:'1 minute'}}},async req=>{
    const {code}=z.object({code:z.string().min(1).max(256)}).strict().parse(req.body);
    if(options.exchangeCode)return login(await options.exchangeCode(code));
    ensure(env.appId&&env.appSecret,'WECHAT_NOT_CONFIGURED','服务端尚未配置微信登录',503);
    const url=new URL('https://api.weixin.qq.com/sns/jscode2session');url.search=new URLSearchParams({appid:env.appId,secret:env.appSecret,js_code:code,grant_type:'authorization_code'}).toString();
    let result:any;try{const response=await fetch(url,{signal:AbortSignal.timeout(8000)});ensure(response.ok,'WECHAT_UNAVAILABLE','微信登录暂不可用',502);result=await response.json();}catch{throw new GameError('WECHAT_UNAVAILABLE','微信登录暂不可用',502);}
    ensure(typeof result.openid==='string'&&!result.errcode,'WECHAT_AUTH_FAILED','微信登录失败，请重新登录',401);
    return login(result.openid);
  });
  app.post('/v1/auth/dev',async req=>{ensure(env.allowDevAuth&&env.appEnv==='DEV'&&env.mode!=='production','NOT_FOUND','接口不存在',404);const {account}=z.object({account:z.string().regex(/^[a-z0-9_-]{1,32}$/)}).strict().parse(req.body);return login(`dev:${account}`);});
  app.get('/v1/bootstrap',async req=>{const w=await repo.world();await game.settleDueSleep(req.user.sub);const p=await repo.repairPosition(req.user.sub,w);return {faces:w.faces??faceConfigs,hairs:hairServiceConfig(w).hairs,player:publicPlayer(p),serverTime:game.now().toISOString(),worldVersion:w.worldVersion,configVersion:w.configVersion,assetVersion:w.assetVersion,assetManifest:`${env.assetBase}/${w.assetVersion}/manifest.json`,colors:Object.fromEntries(Object.entries(w.colors).filter(([key])=>!key.startsWith('SKIN_'))),appearances:[...w.appearances.filter(a=>a.enabled&&!starterLooks.some(s=>s.id===a.id)),...starterLooks],features:{movementPath:true,trade:true,appearance:true,ghostPreview:true,gifts:false,property:false,quests:true,rank:false}};});
  app.post('/v1/player/restart',async req=>{const body=z.object({requestId,confirm:z.literal(true)}).strict().parse(req.body);return {player:publicPlayer(await repo.restartGame(req.user.sub,body.requestId))};});
  app.get('/v1/player/identity/check',async req=>{const query=z.object({surname:z.string(),givenName:z.string(),nickname:z.string()}).strict().parse(req.query);let profile;try{profile=validatePlayerIdentity({...query,personalityTag:personalityChoices[0].tag});}catch(error){if(error instanceof PlayerIdentityError)throw new GameError(error.code,error.message,400);throw error;}return {available:!await repo.identityTaken(profile,req.user.sub)};});
  app.get('/v1/player/profile',async req=>{const p=await repo.player(req.user.sub);return {profile:p.appearance?p.profile??null:null,formalName:p.appearance&&p.profile?formalName(p.profile):null,appearance:p.appearance};});
  app.get('/v1/world/scenes/:id',async req=>{const w=await repo.world(),p=await repo.repairPosition(req.user.sub,w);ensure(p.appearance,'CHARACTER_REQUIRED','请先创建角色',409);return {...sceneView(w,(req.params as any).id,game.now(),requestGameContext(req).debugOpenAll),playerPosition:{sceneId:p.sceneId,x:p.x,y:p.y}};});
  app.get('/v1/scenes/:id/ghosts',async req=>{const p=await repo.player(req.user.sub);ensure(p.appearance&&p.sceneId===(req.params as any).id,'WRONG_SCENE','请进入对应场景');return {ghosts:await repo.ghosts(p.id)};});
  app.get('/v1/economy/catalog/:buildingId',async req=>{
    const w=await repo.world(),p=await repo.player(req.user.sub);
    ensure(p.appearance,'CHARACTER_REQUIRED','请先创建角色',409);
    const building=game.shop(w,p,(req.params as {buildingId:string}).buildingId,requestGameContext(req));
    return {building,items:w.items.filter(i=>building.stock[i.id]&&!i.questOnly&&!i.questItem&&!i.keyItem)};
  });
  app.get('/v1/inventory',async req=>{const [world,player]=await Promise.all([repo.world(),repo.player(req.user.sub)]);return {inventory:player.inventory,items:inventoryEntries(player,world.items)};});
  app.get('/v1/services/appearance',async req=>{
    const {shopId}=z.object({shopId:id}).strict().parse(req.query),w=await repo.world(),p=await repo.player(req.user.sub);
    ensure(p.appearance,'CHARACTER_REQUIRED','请先创建角色',409);
    const shop=game.shop(w,p,shopId,requestGameContext(req));ensure(shop.buildingType==='SALON','INVALID_SERVICE','此店不提供美发服务');
    const {hairs,offers}=hairServiceConfig(w);
    return {shopId,hairs:hairs.filter(h=>h.enabled&&h.gender===p.appearance!.gender),offers:offers.filter(o=>o.shopId===shopId&&o.enabled)};
  });
  const routes:Record<keyof typeof schemas,string>={appearanceService:'/v1/services/appearance',create:'/v1/player/appearance/create',move:'/v1/player/move',enter:'/v1/world/enter',portal:'/v1/world/portal',buy:'/v1/economy/buy',sell:'/v1/economy/sell',useItem:'/v1/inventory/use',talk:'/v1/npc/talk',introComplete:'/v1/intro/complete',finalizeQuest:'/v1/quest/finalize',inspect:'/v1/world/inspect',purchaseAppearance:'/v1/appearance/purchase',changeAppearance:'/v1/appearance/change',wardrobeEquip:'/v1/facilities/wardrobe/equip',storageTransfer:'/v1/facilities/storage/transfer',sleepStart:'/v1/facilities/sleep/start',sleepWake:'/v1/facilities/sleep/wake'};
  for(const action of Object.keys(routes) as (keyof typeof schemas)[])app.post(routes[action],async req=>game.action(req.user.sub,action,schemas[action].parse(req.body),requestGameContext(req)));
  app.post('/v1/player/debug-safe-reset',async req=>{ensure(env.appEnv==='DEV'&&env.mode!=='production','NOT_FOUND','接口不存在',404);return game.action(req.user.sub,'safeReset',z.object({requestId}).strict().parse(req.body));});
  app.get('/v1/player/appearance',async req=>{const p=await repo.player(req.user.sub);return {appearance:p.appearance,owned:p.cosmetics};});
  app.get('/v1/appearance/owned',async req=>({owned:(await repo.player(req.user.sub)).cosmetics}));
  app.get('/v1/facilities/wardrobe',async req=>{
    const {zoneId}=z.object({zoneId:id}).strict().parse(req.query),w=await repo.world(),p=await repo.player(req.user.sub);game.facility(w,p,zoneId,'wardrobe');
    const outfits=outfitShopConfig(w).outfits.filter(o=>o.enabled&&o.gender===p.appearance?.gender&&p.cosmetics.includes(o.outfitId)).sort((a,b)=>a.sortOrder-b.sortOrder);
    return {zoneId,outfits,ownedOutfitIds:outfits.map(o=>o.outfitId),currentOutfitId:p.appearance?.outfitId};
  });
  app.get('/v1/facilities/storage',async req=>{
    const {zoneId}=z.object({zoneId:id}).strict().parse(req.query),w=await repo.world(),p=await repo.player(req.user.sub);game.facility(w,p,zoneId,'storage');
    return {zoneId,inventory:p.inventory,storage:p.storage,items:w.items.filter(item=>(p.inventory[item.id]??0)>0||(p.storage[item.id]??0)>0)};
  });
  app.get('/v1/outfits/catalog',async req=>{
    const {shopId}=z.object({shopId:id}).strict().parse(req.query),w=await repo.world(),p=await repo.player(req.user.sub);
    ensure(p.appearance,'CHARACTER_REQUIRED','请先创建角色',409);
    const shop=game.shop(w,p,shopId,requestGameContext(req));ensure(shop.buildingType==='CLOTH','WRONG_SHOP','请前往服装店');
    const {outfits,offers}=outfitShopConfig(w);
    const listed=offers.filter(o=>o.shopId===shopId&&o.enabled);
    return {shopId,outfits:outfits.filter(o=>o.enabled&&o.gender===p.appearance!.gender&&listed.some(l=>l.outfitId===o.outfitId)).sort((a,b)=>a.sortOrder-b.sortOrder),offers:listed,ownedOutfitIds:p.cosmetics.filter(id=>outfits.some(o=>o.outfitId===id)),currentOutfitId:p.appearance.outfitId};
  });
  app.get('/v1/appearance/catalog',async req=>{const {shop}=z.object({shop:id}).parse(req.query),w=await repo.world(),p=await repo.player(req.user.sub);const b=game.shop(w,p,shop,requestGameContext(req));const {outfits,offers}=outfitShopConfig(w);return {catalog:[...w.appearances,...starterLooks.filter(a=>!w.appearances.some(old=>old.id===a.id))].filter(a=>a.enabled&&(a.genderScope==='ALL'||a.genderScope===p.appearance?.gender)&&(b.buildingType==='SALON'?a.partType==='HAIR'&&a.colors.length===0:b.buildingType==='CLOTH'?['OUTFIT','ACCESSORY'].includes(a.partType):false)).filter(a=>a.partType!=='OUTFIT'||!!outfits.find(o=>o.outfitId===a.id&&o.enabled)&&!!offers.find(o=>o.shopId===shop&&o.outfitId===a.id&&o.enabled)).map(a=>a.partType==='OUTFIT'?{...a,price:offers.find(o=>o.shopId===shop&&o.outfitId===a.id&&o.enabled)?.price??0}:a)};});
  for(const route of ['/v1/social/gifts','/v1/mail/:id/claim','/v1/property/purchase'])app.post(route,async()=>{throw new GameError('FEATURE_NOT_ENABLED','该功能将在后续开发阶段开放',501);});
    app.get('/v1/quests',async req=>{const world=await repo.world(),p=await repo.player(req.user.sub);const quests=world.quests.filter(q=>q.enabled&&firstDayQuestAvailable(p,q.id)).map(quest=>{const accepted=p.ledger.some(l=>l.type==='QUEST_ACCEPTED'&&l.referenceId===quest.id),completed=p.ledger.some(l=>l.type==='QUEST_REWARD'&&l.referenceId===quest.id),stepProgress=questStepProgress(quest,p.ledger),progressed=stepProgress.some(Boolean),state=completed?'completed':accepted?(progressed?'in_progress':'accepted'):'available';return {...quest,state,progress:Object.fromEntries(quest.steps.map((step,index)=>[step.type,stepProgress[index]])),stepProgress,rewardClaimed:completed};});return {enabled:true,quests,firstDayStage:firstDayStage(p)};});
  app.get('/v1/rank/wealth',async()=>({enabled:false,players:[]}));
  app.get('/admin/world',async()=>repo.world());
  app.get('/admin/players',async req=>{const supplied=req.headers.authorization?.replace(/^Bearer /,'')??'';const a=Buffer.from(supplied),b=Buffer.from(env.adminToken);ensure(a.length===b.length&&timingSafeEqual(a,b),'ADMIN_UNAUTHORIZED','后台凭据无效',401);return {players:(await repo.listPlayers()).map(p=>({playerId:p.id,formalName:p.appearance&&p.profile?formalName(p.profile):null,profile:p.appearance?p.profile??null:null,appearance:p.appearance}))};});
  app.get('/admin/releases',async()=>({releases:await repo.releases()}));
  app.post('/admin/releases',async req=>{const {config,basedOn}=z.object({config:z.unknown(),basedOn:z.number().int()}).strict().parse(req.body),previous=await repo.world();ensure(previous.configVersion===basedOn,'STALE_DRAFT','请刷新当前版本后重试',409);return repo.draft(validateWorld(config,previous),basedOn);});
  app.post('/admin/releases/:id/transition',async req=>{const {status}=z.object({status:z.enum(['TEST','PUBLISHED'])}).strict().parse(req.body);const releases=await repo.releases(),r=releases.find(r=>r.id===(req.params as any).id);ensure(r,'NOT_FOUND','版本不存在',404);validateWorld(r.config,await repo.world());return repo.transition(r.id,status);});
  app.addHook('onClose',()=>repo.close());return app;
}
