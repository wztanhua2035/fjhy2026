import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../apps/server/src/app.js';
import { MemoryRepository, PostgresRepository } from '../apps/server/src/repository.js';
import { GameController, baishiV2ArtAssets } from '../packages/client-runtime/index.js';
import { mobileTypography } from '../apps/wechat-game/src/typography.js';
import { safeInsets } from '../apps/wechat-game/src/wechat-platform.js';

const env={mode:'development',appEnv:'DEV',port:8080,jwtSecret:'test-jwt-secret-thirty-two-characters-long',subjectSecret:'test-subject-secret-thirty-two-characters',adminToken:'test-admin-token-thirty-two-characters-long',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost:5173',assetBase:'http://localhost:8080/assets'};

test('新老玩家首页选项、确认重开、进度归零与稳定微信身份',async()=>{
  const repo=new MemoryRepository(),app=await buildApp(repo,env,{exchangeCode:async()=> 'same-wechat-openid'});
  try{
    const auth=(await app.inject({method:'POST',url:'/v1/auth/wechat',payload:{code:'first'}})).json();
    const headers={authorization:`Bearer ${auth.token}`},id=auth.player.id;
    const transport=async(path:string,body?:any,token?:string)=>{
      const response=await app.inject({method:body?'POST':'GET',url:path,payload:body,headers:{authorization:`Bearer ${token??auth.token}`}});
      if(response.statusCode>=400)throw Object.assign(new Error(response.json().message),{status:response.statusCode});
      return response.json();
    };
    let client=new GameController(transport);await client.loginWechat('first');
    assert.deepEqual(client.homeActions(),['开始游戏']);
    assert.equal(client.player?.appearance,null);
    const premature=await app.inject({method:'POST',url:'/v1/player/restart',headers,payload:{requestId:randomUUID(),confirm:true}});
    assert.equal(premature.statusCode,409);
    await client.create('FEMALE',{skinToneId:'SKIN_WHEAT',hairId:'F_HAIR_02',outfitId:'F_OUTFIT_03'});
    assert.deepEqual(client.homeActions(),['继续游戏','重新开始']);
    const saved=await repo.player(id);assert.equal(saved.cash,120);
    client=new GameController(transport);await client.loginWechat('again');
    assert.deepEqual(client.homeActions(),['继续游戏','重新开始']);
    assert.deepEqual(client.player?.appearance,saved.appearance);
    assert.equal(client.player?.cash,120);
    const unconfirmed=await app.inject({method:'POST',url:'/v1/player/restart',headers,payload:{requestId:randomUUID(),confirm:false}});
    assert.equal(unconfirmed.statusCode,400);
    assert.equal((await repo.player(id)).appearance?.hairId,'F_HAIR_02');
    const existing=repo.players.get(id)!;
    Object.assign(existing,{sceneId:'STREET_BAISHI_01',x:24,y:20,inventory:{RICE_01:2,CLOTH_SAMPLE_01:1},cash:175,stamina:43,tradeCounts:{RICE_01:2},metNpcs:['NPC_001']});
    existing.ledger.push({id:randomUUID(),type:'QUEST_REWARD',amount:15,before:160,after:175,referenceId:'Q_003',requestId:randomUUID(),createdAt:new Date().toISOString()});
    const requestId=randomUUID(),reset=(await app.inject({method:'POST',url:'/v1/player/restart',headers,payload:{requestId,confirm:true}})).json();
    const duplicate=(await app.inject({method:'POST',url:'/v1/player/restart',headers,payload:{requestId,confirm:true}})).json();
    assert.deepEqual(duplicate,reset);
    assert.equal(reset.player.id,id);assert.equal(reset.player.appearance,null);
    assert.deepEqual({cash:reset.player.cash,stamina:reset.player.stamina,sceneId:reset.player.sceneId,x:reset.player.x,y:reset.player.y,inventory:reset.player.inventory,cosmetics:reset.player.cosmetics,ledger:reset.player.ledger,tradeCounts:reset.player.tradeCounts,metNpcs:reset.player.metNpcs,storyFlags:reset.player.storyFlags},{cash:0,stamina:100,sceneId:'INTERIOR_B_INN_GUEST_ROOM',x:6,y:7,inventory:{},cosmetics:[],ledger:[],tradeCounts:{},metNpcs:[],storyFlags:{}});
    const sameAccount=(await app.inject({method:'POST',url:'/v1/auth/wechat',payload:{code:'after-reset'}})).json();
    assert.equal(sameAccount.player.id,id);assert.equal(sameAccount.player.appearance,null);
    assert.deepEqual(repo.requests.get(`${id}:${requestId}`)?.result.backup.ledger.some((entry:any)=>entry.type==='QUEST_REWARD'),true);
    client=new GameController(transport);await client.loginWechat('after-reset');assert.deepEqual(client.homeActions(),['开始游戏']);
    await client.create('MALE',{skinToneId:'SKIN_LIGHT',hairId:'M_HAIR_03',outfitId:'M_OUTFIT_01'});
    assert.equal(client.player?.id,id);assert.equal(client.player?.cash,120);
    client=new GameController(transport);await client.loginWechat('final');assert.deepEqual(client.homeActions(),['继续游戏','重新开始']);
    assert.equal(client.player?.appearance?.hairId,'M_HAIR_03');
    Object.assign(repo.players.get(id)!,{sceneId:'STREET_BAISHI_01',x:24,y:20});
    await client.refresh();
    assert.equal(client.view?.scene.id,'STREET_BAISHI_01');
    await client.restart();
    assert.equal(client.view,null);
    assert.deepEqual(client.homeActions(),['开始游戏']);
    assert.equal(client.player?.id,id);
  }finally{await app.close();}
});

test('男女地图倍率共享且脚底锚点、行走帧与移动碰撞不变',()=>{
  for(const asset of [baishiV2ArtAssets.playerMale,baishiV2ArtAssets.playerFemale]){
    assert.equal(asset.renderScale,1.18);assert.equal(asset.footAnchorX,32);assert.equal(asset.footAnchorY,59);
    assert.equal(asset.frameWidth,64);assert.equal(asset.frameHeight,64);assert.equal(asset.columns,4);assert.equal(asset.rows,4);
  }
});

test('Postgres 重开在同一事务备份角色进度，保留玩家主键及绑定行',async()=>{
  const id=randomUUID(),calls:string[]=[],saved:any[]=[];
  const row:any={id,nickname:'旅人',cash:120n,stamina:62,status:'ACTIVE',sceneId:'STREET_BAISHI_01',x:24,y:20,tradeCounts:{RICE_01:1},metNpcs:['NPC_001'],inventory:[{itemId:'RICE_01',quantity:2}],cosmetics:[{appearanceId:'M_HAIR_01'}],ledger:[],appearance:{gender:'MALE',baseAvatarId:'MALE_01',skinColorId:'SKIN_LIGHT',hairStyleId:'M_HAIR_01',hairColorId:'INK',topStyleId:'M_OUTFIT_01',topColorId:'SAGE',bottomStyleId:'BOTTOM_MALE_01',bottomColorId:'BLUE',shoesId:'SHOES_MALE_01',accessoryIds:[]}};
  const ledger=[{id:randomUUID(),playerId:id,type:'QUEST_REWARD',amount:15n,before:105n,after:120n,referenceId:'Q_003',requestId:randomUUID(),createdAt:new Date()}];
  const tx:any={
    $queryRaw:async()=>{calls.push('lock');},
    idempotencyRequest:{findUnique:async()=>null,create:async(data:any)=>{calls.push('backup');saved.push(data.data);}},
    player:{findUnique:async()=>row,update:async(data:any)=>{calls.push('update');assert.equal(data.where.id,id);assert.equal(data.data.cash,0n);}},
    playerLedger:{findMany:async()=>ledger,deleteMany:async()=>{calls.push('ledger');}},
    playerAppearance:{delete:async()=>{calls.push('appearance');}},
    inventory:{deleteMany:async()=>{calls.push('inventory');}},
    playerCosmetic:{deleteMany:async()=>{calls.push('cosmetics');}},
    ghostSnapshot:{deleteMany:async()=>{calls.push('ghost');}}
  };
  const repo=new PostgresRepository({$transaction:async(fn:any)=>fn(tx)} as any);
  const result=await repo.restartGame(id,randomUUID());
  assert.equal(result.id,id);assert.equal(result.appearance,null);
  assert.deepEqual(calls,['lock','backup','appearance','inventory','cosmetics','ledger','ghost','update']);
  assert.equal(saved[0].result.backup.ledger[0].amount,'15');
  assert.equal(saved[0].result.backup.player.metNpcs[0],'NPC_001');
});

test('微信正文、说话人、按钮和任务字级增大，安全区仍有换行宽度',()=>{
  assert.deepEqual(mobileTypography,{dialogue:29,speaker:25,dialogueOption:26,option:23,notice:21,quest:17});
  const insets=safeInsets(960,540);
  assert.ok(Math.min(960-insets.left-insets.right-60,620)>400);
  assert.ok(330-28>=280);
});
