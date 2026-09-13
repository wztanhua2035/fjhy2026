import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MemoryRepository} from '../apps/server/src/repository.js';
import {GameService} from '../apps/server/src/service.js';
import {buildApp} from '../apps/server/src/app.js';
import {formalName,personalityChoices,randomIdentity,validatePlayerIdentity,type PlayerProfile} from '../packages/game-config/player-profile.js';

const profile={surname:'林',givenName:'知远',nickname:'阿远',personalityTag:'审慎细致'} as const;
const create=(p:PlayerProfile=profile)=>({requestId:randomUUID(),gender:'MALE',faceId:'M_FACE_01',hairId:'M_HAIR_01',outfitId:'M_OUTFIT_01',headwearId:null,profile:p});
const env={mode:'development',appEnv:'DEV',port:0,jwtSecret:'test-jwt-secret-at-least-32-characters',subjectSecret:'test-subject-secret-at-least-32-characters',adminToken:'test-admin-token-at-least-32-characters',allowDevAuth:true,appId:'',appSecret:'',adminOrigin:'http://localhost',assetBase:'http://localhost/assets'};

test('姓名拆分、规范化、四字姓名及外号边界',()=>{
  for(const [surname,givenName,nickname] of [['林','安','阿远'],['林','知远','小石头'],['欧阳','宁','阿宁'],['诸葛','清扬','小石头']]){
    const result=validatePlayerIdentity({surname:` ${surname} `,givenName,nickname,personalityTag:profile.personalityTag});
    assert.equal(formalName(result),surname+givenName);
  }
  for(const field of ['surname','givenName','nickname'] as const)for(const value of ['', 'A', '1', '😀', '小!',field==='nickname'?'阿':'甲乙丙丁'])assert.throws(()=>validatePlayerIdentity({...profile,[field]:value}));
});

test('九句创建文案映射到九个四字性格，档案不保存句子',()=>{
  assert.equal(personalityChoices.length,9);
  assert.equal(new Set(personalityChoices.map(choice=>choice.tag)).size,9);
  for(const choice of personalityChoices){const result=validatePlayerIdentity({...profile,personalityTag:choice.tag});assert.equal(result.personalityTag,choice.tag);assert.equal(choice.tag.length,4);assert.ok(!JSON.stringify(result).includes(choice.quote));}
  assert.throws(()=>validatePlayerIdentity({...profile,personalityTag:''}),/请选择/);
  assert.throws(()=>validatePlayerIdentity({...profile,personalityTag:'未知'}),/请选择/);
});

test('随机姓名生成合法且性格必须玩家自己选择',()=>{
  for(const gender of ['MALE','FEMALE'] as const)for(let i=0;i<100;i++)assert.doesNotThrow(()=>validatePlayerIdentity({...randomIdentity(gender),personalityTag:profile.personalityTag}));
  assert.throws(()=>validatePlayerIdentity(randomIdentity('FEMALE')),/请选择/);
});

test('身份三字段组合唯一、并发只有一次成功、失败不创建角色',async()=>{
  const repo=new MemoryRepository(),service=new GameService(repo),a=await repo.login('identity-a'),b=await repo.login('identity-b'),c=await repo.login('identity-c');
  const results=await Promise.allSettled([service.action(a.id,'create',create()),service.action(b.id,'create',create())]);
  assert.deepEqual(results.map(result=>result.status).sort(),['fulfilled','rejected']);
  const loser=results[0].status==='rejected'?a:b;
  assert.equal((await repo.player(loser.id)).appearance,null);
  assert.equal((results.find(result=>result.status==='rejected') as PromiseRejectedResult).reason.code,'PLAYER_IDENTITY_TAKEN');
  await service.action(loser.id,'create',create({...profile,nickname:'小林'}));
  await service.action(c.id,'create',create({...profile,surname:'陈'}));
  assert.equal((await repo.player(a.id)).cash,120);
  assert.equal((await repo.player(b.id)).cash,120);
  const first=await repo.player(a.id);await repo.restartGame(a.id,randomUUID());
  assert.equal((await repo.player(a.id)).appearance,null);
  await service.action(a.id,'create',create(first.profile!));
  assert.equal((await repo.player(a.id)).profile?.nickname,first.profile?.nickname);
});

test('真实 HTTP 建角、档案与管理员接口均有鉴权',async()=>{
  const repo=new MemoryRepository(),app=await buildApp(repo,env);
  try{
    const auth=(await app.inject({method:'POST',url:'/v1/auth/dev',payload:{account:'profile-http'}})).json(),headers={authorization:`Bearer ${auth.token}`};
    const missing=await app.inject({method:'POST',url:'/v1/player/appearance/create',headers,payload:{...create(),profile:{...profile,personalityTag:''}}});
    assert.equal(missing.statusCode,400);assert.equal(missing.json().code,'INVALID_PERSONALITY');
    const created=await app.inject({method:'POST',url:'/v1/player/appearance/create',headers,payload:create()});assert.equal(created.statusCode,200,created.body);
    const fetched=await app.inject({url:'/v1/player/profile',headers});assert.equal(fetched.json().formalName,'林知远');assert.equal(fetched.json().profile.nickname,'阿远');
    const blocked=await app.inject({url:'/admin/players'});assert.equal(blocked.statusCode,401);
    const allowed=await app.inject({url:'/admin/players',headers:{authorization:`Bearer ${env.adminToken}`}});assert.equal(allowed.statusCode,200);assert.equal(allowed.json().players[0].profile.personalityTag,'审慎细致');
  }finally{await app.close();}
});
