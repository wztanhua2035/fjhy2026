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
import { ensure, GameError, sceneView, publicPlayer } from '../../../packages/game-rules/index.js';
declare module '@fastify/jwt' {interface FastifyJWT {payload:{sub:string};user:{sub:string}}}
const requestId=z.string().uuid(),id=z.string().min(1).max(80);
const schemas={
  create:z.object({requestId,gender:z.enum(['MALE','FEMALE']),baseAvatarId:id,hairColorId:id,topColorId:id,bottomColorId:id}).strict(),
  move:z.object({requestId,x:z.number().finite(),y:z.number().finite()}).strict(),
  enter:z.object({requestId,plotId:id}).strict(),portal:z.object({requestId,portalId:id}).strict(),
  buy:z.object({requestId,buildingId:id,itemId:id,quantity:z.number().int().min(1).max(99)}).strict(),
  sell:z.object({requestId,buildingId:id,itemId:id,quantity:z.number().int().min(1).max(99)}).strict(),
  talk:z.object({requestId,npcId:id}).strict(),
  purchaseAppearance:z.object({requestId,buildingId:id,appearanceId:id}).strict(),
  changeAppearance:z.object({requestId,buildingId:id,appearanceId:id,colorId:id}).strict()
};
export async function buildApp(repo:Repository,env:Environment,options:{logger?:boolean;now?:()=>Date;exchangeCode?:(code:string)=>Promise<string>}={}){
  const app=Fastify({logger:options.logger?{redact:['req.headers.authorization','req.headers.cookie','req.body.code','req.body.token']}:false,bodyLimit:2*1024*1024,trustProxy:false});
  await app.register(cors,{origin:env.adminOrigin,methods:['GET','POST'],allowedHeaders:['Content-Type','Authorization']});
  await app.register(jwt,{secret:env.jwtSecret,sign:{expiresIn:'7d'}});
  await app.register(rateLimit,{max:180,timeWindow:'1 minute'});
  await app.register(staticPlugin,{root:path.resolve('assets/public'),prefix:'/assets/'});
  const game=new GameService(repo,options.now);
  app.setErrorHandler((err,_req,reply)=>{
    if(err instanceof ZodError)return reply.code(400).send({code:'INVALID_INPUT',message:'输入格式不正确',issues:err.issues.map(i=>({path:i.path,message:i.message}))});
    if(err instanceof GameError)return reply.code(err.status).send({code:err.code,message:err.message});
    const status=(err as any).statusCode??500;
    if(status>=500)app.log.error({name:(err as Error).name},'Request failed');
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
  app.get('/v1/bootstrap',async req=>{const w=await repo.world(),p=await repo.player(req.user.sub);return {player:publicPlayer(p),serverTime:game.now().toISOString(),worldVersion:w.worldVersion,configVersion:w.configVersion,assetVersion:w.assetVersion,assetManifest:`${env.assetBase}/${w.assetVersion}/manifest.json`,colors:w.colors,appearances:w.appearances.filter(a=>a.enabled),features:{trade:true,appearance:true,ghostPreview:true,gifts:false,property:false,quests:false,rank:false}};});
  app.get('/v1/world/scenes/:id',async req=>{const p=await repo.player(req.user.sub);ensure(p.appearance,'CHARACTER_REQUIRED','请先创建角色',409);return sceneView(await repo.world(),(req.params as any).id,game.now());});
  app.get('/v1/scenes/:id/ghosts',async req=>{const p=await repo.player(req.user.sub);ensure(p.appearance&&p.sceneId===(req.params as any).id,'WRONG_SCENE','请进入对应场景');return {ghosts:await repo.ghosts(p.id)};});
  const routes:Record<keyof typeof schemas,string>={create:'/v1/player/appearance/create',move:'/v1/player/move',enter:'/v1/world/enter',portal:'/v1/world/portal',buy:'/v1/economy/buy',sell:'/v1/economy/sell',talk:'/v1/npc/talk',purchaseAppearance:'/v1/appearance/purchase',changeAppearance:'/v1/appearance/change'};
  for(const action of Object.keys(routes) as (keyof typeof schemas)[])app.post(routes[action],async req=>game.action(req.user.sub,action,schemas[action].parse(req.body)));
  app.get('/v1/player/appearance',async req=>{const p=await repo.player(req.user.sub);return {appearance:p.appearance,owned:p.cosmetics};});
  app.get('/v1/appearance/owned',async req=>({owned:(await repo.player(req.user.sub)).cosmetics}));
  app.get('/v1/appearance/catalog',async req=>{const {shop}=z.object({shop:id}).parse(req.query),w=await repo.world(),p=await repo.player(req.user.sub);const b=game.shop(w,p,shop);return {catalog:w.appearances.filter(a=>a.enabled&&(a.genderScope==='ALL'||a.genderScope===p.appearance?.gender)&&(b.buildingType==='SALON'?a.partType==='HAIR':b.buildingType==='CLOTH'?['TOP','BOTTOM','SHOES','ACCESSORY'].includes(a.partType):false))};});
  for(const route of ['/v1/social/gifts','/v1/mail/:id/claim','/v1/property/purchase'])app.post(route,async()=>{throw new GameError('FEATURE_NOT_ENABLED','该功能将在后续开发阶段开放',501);});
  app.get('/v1/quests',async()=>({enabled:false,quests:[]}));
  app.get('/v1/rank/wealth',async()=>({enabled:false,players:[]}));
  app.get('/admin/world',async()=>repo.world());
  app.get('/admin/releases',async()=>({releases:await repo.releases()}));
  app.post('/admin/releases',async req=>{const {config,basedOn}=z.object({config:z.unknown(),basedOn:z.number().int()}).strict().parse(req.body),previous=await repo.world();ensure(previous.configVersion===basedOn,'STALE_DRAFT','请刷新当前版本后重试',409);return repo.draft(validateWorld(config,previous),basedOn);});
  app.post('/admin/releases/:id/transition',async req=>{const {status}=z.object({status:z.enum(['TEST','PUBLISHED'])}).strict().parse(req.body);const releases=await repo.releases(),r=releases.find(r=>r.id===(req.params as any).id);ensure(r,'NOT_FOUND','版本不存在',404);validateWorld(r.config,await repo.world());return repo.transition(r.id,status);});
  app.addHook('onClose',()=>repo.close());return app;
}
