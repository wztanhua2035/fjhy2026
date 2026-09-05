import {createServer} from 'node:http';
import {PrismaClient} from '@prisma/client';
import {Queue,Worker} from 'bullmq';
import {Redis} from 'ioredis';
const db=new PrismaClient();
if(!process.env.REDIS_URL)throw new Error('REDIS_URL is required');
const connection=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:null});
const queue=new Queue('world-maintenance',{connection});
await queue.upsertJobScheduler('public-ghost-pool',{every:15*60*1000},{name:'refresh-ghosts',data:{},opts:{removeOnComplete:20,removeOnFail:50,attempts:3,backoff:{type:'exponential',delay:1000}}});
const worker=new Worker('world-maintenance',async job=>{
  if(job.name!=='refresh-ghosts')return;
  const rows=await db.ghostSnapshot.findMany({where:{player:{status:'ACTIVE',lastLoginAt:{gte:new Date(Date.now()-7*86400000)}}},take:1000,orderBy:{updatedAt:'desc'}});
  // Only public snapshots; no OpenID, account hash, cash or private inventory enters Redis.
  await connection.set('ghost:candidates:TOWN_CENTER',JSON.stringify(rows.map(r=>r.snapshot)),'EX',30*60);
  return {count:rows.length};
},{connection,concurrency:1});
worker.on('failed',job=>console.error('maintenance failed',job?.id));
const server=createServer(async(req,res)=>{if(req.url!=='/healthz'&&req.url!=='/readyz'){res.writeHead(404).end();return;}try{await connection.ping();await db.$queryRaw`SELECT 1`;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'ready',worker:await worker.isPaused()?'paused':'running'}));}catch{res.writeHead(503).end('not ready');}});
server.listen(Number(process.env.PORT??8081),'0.0.0.0');
for(const s of ['SIGTERM','SIGINT'])process.on(s,async()=>{server.close();await worker.close();await queue.close();await connection.quit();await db.$disconnect();process.exit(0);});
