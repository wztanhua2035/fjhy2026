import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialWorld} from '../packages/game-config/index.js';
import {canStand,positionBlockers,createStarterAppearance} from '../packages/game-rules/index.js';
import {MemoryRepository} from '../apps/server/src/repository.js';
import {GameService} from '../apps/server/src/service.js';
import {ensureBaishiAlley} from '../apps/server/src/sync-baishi.js';
import {GameController} from '../packages/client-runtime/index.js';
import {sceneView} from '../packages/game-rules/index.js';

const scene='STREET_BAISHI_01';
test('衣坊右侧巷道与正式画面相符：中段至少约两格宽，上端及南侧转口连通',()=>{
  const controller=new GameController(async()=>({}));
  controller.view=sceneView(initialWorld,scene,new Date());
  for(const y of [27.2,29,32,35.2])for(const x of [39.85,40.7,41.7])
    {assert.equal(canStand(initialWorld,scene,x,y),true,`${x},${y}: ${positionBlockers(initialWorld,scene,x,y)}`);assert.equal(controller.stand(x,y),true);}
  for(const [x,y] of [[40.7,25],[40.7,38.25],[39.5,38.25],[36,38.25]])
    assert.equal(canStand(initialWorld,scene,x,y),true,`${x},${y}`);
  assert.equal(canStand(initialWorld,scene,38,32),false,'不能穿过衣坊');
  assert.equal(canStand(initialWorld,scene,42.5,32),false,'不能穿过邻栋');
  assert.equal(canStand(initialWorld,scene,40.7,39.2),false,'不能走进运河');
});

test('真实服务端双向走通巷道与南侧步道，无同步碰撞拒绝',async()=>{
  const repo=new MemoryRepository(),player=await repo.login(randomUUID()),game=new GameService(repo);
  await repo.mutate(player.id,randomUUID(),'fixture',p=>{p.appearance=createStarterAppearance('MALE',{});p.sceneId=scene;p.x=40.7;p.y=25;return {};});
  const move=async(path:{x:number;y:number}[])=>{const end=path.at(-1)!;await game.action(player.id,'move',{requestId:randomUUID(),...end,path});};
  await move([{x:40.7,y:31}]);await move([{x:40.7,y:37.5}]);
  await move([{x:40.7,y:38.25},{x:39.5,y:38.25},{x:36,y:38.25}]);
  await move([{x:39.5,y:38.25},{x:40.7,y:38.25}]);
  await move([{x:40.7,y:32}]);await move([{x:40.7,y:25}]);
  assert.deepEqual([ (await repo.player(player.id)).x,(await repo.player(player.id)).y ],[40.7,25]);
});

test('staging 只定向发布巷道碰撞和衣坊地块，重启幂等且保留其他世界数据',async()=>{
  const repo=new MemoryRepository(),old=await repo.world();
  const street=repo.versions[0].config.scenes.find(s=>s.id===scene)!;
  street.collision.find(r=>r.x===28&&r.y===27&&r.height===10)!.width=12;
  Object.assign(street.collision.find(r=>r.x===42&&r.y===27&&r.height===12)!,{x:41,width:7});
  repo.versions[0].config.plots.find(p=>p.id==='P_BAISHI_005')!.width=12;
  const before=await repo.world(),result=await ensureBaishiAlley(repo);assert.equal(result.published,true);
  const after=await repo.world();assert.deepEqual(after.npcs,before.npcs);assert.deepEqual(after.quests,before.quests);
  assert.deepEqual(after.scenes.filter(s=>s.id!==scene),before.scenes.filter(s=>s.id!==scene));
  assert.equal(after.plots.find(p=>p.id==='P_BAISHI_005')?.width,11.5);
  assert.equal((await ensureBaishiAlley(repo)).published,false);
  assert.equal(old.scenes.find(s=>s.id===scene)?.collision.length,after.scenes.find(s=>s.id===scene)?.collision.length);
});
