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
const app=await buildApp(repo,env,{logger:true});
await app.listen({port:env.port,host:'0.0.0.0'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
