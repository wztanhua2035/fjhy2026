import { PrismaClient } from '@prisma/client';
import { buildApp } from './app.js';
import { PostgresRepository } from './repository.js';
import { environment } from './config.js';
const env=environment();
const app=await buildApp(new PostgresRepository(new PrismaClient()),env,{logger:true});
await app.listen({port:env.port,host:'0.0.0.0'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
