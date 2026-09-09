import { randomBytes } from 'node:crypto';
import { buildApp } from './app.js';
import { MemoryRepository } from './repository.js';
const app=await buildApp(new MemoryRepository(),{mode:'development',appEnv:'DEV',port:8080,jwtSecret:randomBytes(32).toString('hex'),subjectSecret:'demo-subject-not-for-production-use',adminToken:'local-demo-admin-only-not-for-production',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost:5173',assetBase:'http://localhost:8080/assets'},{logger:true});
await app.listen({port:8080,host:'0.0.0.0'});
console.log('本地演示模式：数据保存在内存，重启会清空。后台演示凭据见 README。');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
