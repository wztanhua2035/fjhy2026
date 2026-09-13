import {ensureGroceryShop} from './sync-grocery.js';
import {ensureTradeShop} from './sync-trade.js';
import {ensureHairServices} from './sync-hair-services.js';
import {ensureOutfits} from './sync-outfits.js';
import { PrismaClient } from '@prisma/client';
import { buildApp } from './app.js';
import { PostgresRepository } from './repository.js';
import { environment } from './config.js';
import { ensureBaishiAlley, ensureGuestRoomScene, syncBaishiContent } from './sync-baishi.js';
const env=environment();
const repo=new PostgresRepository(new PrismaClient());
if(process.env.SYNC_BAISHI_CONTENT==='true') {
  if(!['DEV','STAGING'].includes(env.appEnv)) throw new Error('SYNC_BAISHI_CONTENT is restricted to DEV/STAGING');
  console.log('Baishi content release',await syncBaishiContent(repo,true));
}
if(env.appEnv==='STAGING') console.log('Staging guest room scene',await ensureGuestRoomScene(repo));
if(env.appEnv==='STAGING') console.log('Staging Baishi alley',await ensureBaishiAlley(repo));
if(env.appEnv==='STAGING')console.log('Staging grocery shop',await ensureGroceryShop(repo));
if(env.appEnv==='STAGING')console.log('Staging trade shop',await ensureTradeShop(repo));
if(env.appEnv==='STAGING')console.log('Staging hair services',await ensureHairServices(repo));
if(env.appEnv==='STAGING')console.log('Staging outfits',await ensureOutfits(repo));
const app=await buildApp(repo,env,{logger:true});
await app.listen({port:env.port,host:'0.0.0.0'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
