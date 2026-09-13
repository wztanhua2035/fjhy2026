import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {GameService} from '../apps/server/src/service.js';
import {buildApp} from '../apps/server/src/app.js';
import {MemoryRepository} from '../apps/server/src/repository.js';
const env={mode:'development',appEnv:'DEV',port:8080,jwtSecret:'test-jwt-secret-thirty-two-characters-long',subjectSecret:'test-subject-secret-thirty-two-characters',adminToken:'test-admin-token-thirty-two-characters-long',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost:5173',assetBase:'http://localhost:8080/assets'};
test('真实 HTTP 限流返回状态与错误正文',async()=>{
 const app=await buildApp(new MemoryRepository(),env);
 try{const login=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'rate-repro'}})).json();
 let result:any;for(let i=0;i<181;i++)result=await app.inject({method:'GET',url:'/v1/bootstrap',headers:{authorization:`Bearer ${login.token}`}});
 console.log('RATE_REPRO',result.statusCode,result.body);assert.equal(result.statusCode,429);assert.equal(result.json().code,"RATE_LIMITED");
 }finally{await app.close();}
});


test('真实 HTTP 接受批量路径、兼容旧坐标请求、拒绝路径穿墙且不部分写入',async()=>{
 const repo=new MemoryRepository(),app=await buildApp(repo,env);
 try{
  const login=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'batch-repro'}})).json();
  await new GameService(repo).action(login.player.id,'create',{requestId:randomUUID(),gender:'MALE',skinToneId:'SKIN_LIGHT',hairId:'M_HAIR_01',outfitId:'M_OUTFIT_01'});
  const headers={authorization:`Bearer ${login.token}`};
  const boot=(await app.inject({method:'GET',url:'/v1/bootstrap',headers})).json();assert.equal(boot.features.movementPath,true);
  const move=(body:object)=>app.inject({method:'POST',url:'/v1/player/move',headers,payload:{...body,requestId:randomUUID()}});
  assert.equal((await move({x:7,y:9,path:[{x:7,y:8.7},{x:7,y:9}]})).statusCode,200);
  assert.equal((await move({x:7,y:8.8})).statusCode,200);
  const blocked=await move({x:7,y:9,path:[{x:7,y:8.9},{x:0,y:0},{x:7,y:9}]});assert.equal(blocked.statusCode,400);
  assert.equal((await repo.player(login.player.id)).y,8.8);
  assert.equal((await move({x:7,y:9,path:[{x:7,y:8.9}]})).json().code,'INVALID_PATH');
 }finally{await app.close();}
});
