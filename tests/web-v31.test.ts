import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GameController} from '../packages/client-runtime/index.js';
import {WebFeedbackQueue,transitionLoading,isTransientSceneMessage} from '../apps/web-game/src/scene-feedback.js';
const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise<any>(r=>resolve=r);return {resolve,promise};};
test('late scene A and ghosts cannot replace the current scene B',async()=>{
  const a=deferred(),b=deferred(),ghosts=deferred();
  const game=new GameController(async path=>path.endsWith('/A')?a.promise:path.endsWith('/B')?b.promise:ghosts.promise);
  game.boot={player:{sceneId:'A'}} as any;
  const first=game.loadScene(),firstId=game.transitionId;game.boot!.player.sceneId='B';const second=game.loadScene();assert.ok(game.transitionId>firstId);
  b.resolve({scene:{id:'B'}});await second;assert.equal(game.view?.scene.id,'B');assert.equal(game.transitionPending,false);
  a.resolve({scene:{id:'A'}});await first;assert.equal(game.view?.scene.id,'B');
  game.boot!.player.sceneId='C';ghosts.resolve({ghosts:[{id:'old-B'}]});await Promise.resolve();assert.deepEqual(game.ghosts,[]);
});
test('rapid transition has no loading flash; slow loading disappears immediately on completion',()=>{
  assert.equal(transitionLoading(true,1000,1299),false);assert.equal(transitionLoading(true,1000,1300),true);assert.equal(transitionLoading(false,1000,2000),false);
});
test('failed scene load always clears transition loading',async()=>{
  const game=new GameController(async()=>{throw new Error('offline');});game.boot={player:{sceneId:'A'}} as any;
  await assert.rejects(game.loadScene());assert.equal(game.transitionPending,false);
});
test('late notification A is discarded after transition B even when arriving back in same scene',()=>{
  const queue=new WebFeedbackQueue();queue.enqueue('toast','已到达白石街','low',{sceneId:'street',transitionId:1});assert.equal(queue.current('street',2),null);
});
test('wrong scene arrival toast is discarded',()=>{const queue=new WebFeedbackQueue();queue.enqueue('toast','旧提示','low',{sceneId:'street'});assert.equal(queue.current('cloth',1),null);});
test('immediate closed-shop feedback preempts queued background messages',()=>{
  const queue=new WebFeedbackQueue();queue.enqueue('toast','环境介绍','low');queue.enqueue('result','任务推进','sequential');const current=queue.enqueue('toast','店铺已打烊','immediate');
  assert.equal(queue.current()?.text,'店铺已打烊');queue.dismiss(current.id);assert.ok(queue.current());
});
test('technical transitions are never enqueued as ordinary notifications',()=>{
  for(const text of ['正在确认位置…','进入建筑…','已到达白石街','正在进入…'])assert.equal(isTransientSceneMessage(text),true);
  assert.equal(isTransientSceneMessage('铜钱不足'),false);
});
test('inventory surface is a sibling of its HUD toggle, never nested in the old wrapper',async()=>{
  const source=await readFile('apps/web-game/src/inventory-ui.ts','utf8');
  assert.match(source,/adoptRpgModal\(panel,'行囊'\)/);assert.match(source,/root\.replaceChildren\(toggle\)/);
  assert.match(source,/root\.parentElement!\.append\(panel\)/);assert.doesNotMatch(source,/root\.replaceChildren\(toggle,panel\)/);
});
test('Web life facilities share one shell and suppress the legacy canvas surfaces',async()=>{
  const source=await readFile('apps/web-game/src/life-ui.ts','utf8'),canvas=await readFile('packages/client-runtime/outfit-phaser.ts','utf8');
  assert.equal(source.match(/createRpgModal\(root/g)?.length,1);
  for(const kind of ['bed','storage','wardrobe','desk'])assert.ok(source.includes(kind));
  assert.match(canvas,/if\(!options.webLife\)installGuestFacilities/);assert.match(canvas,/game.outfitPanelOpen&&!options.webLife/);
});
test('small-screen personality CSS cannot silently restore the old thirteen-pixel font',async()=>{
  const css=await readFile('apps/web-game/src/life-ui.css','utf8');
  assert.match(css,/@media\(max-width:1420px\),\(max-height:800px\)[^}]*font-size:17px/);
  assert.match(css,/line-height:1.55/);assert.match(css,/white-space:nowrap/);
});
