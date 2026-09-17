import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { interiorResource, verifyInteriorBytes, fetchInteriorResource } from '../apps/web-game/src/interior-resources.js';
import { dialogueContext, notificationDestination, wrapDialogue } from '../apps/web-game/src/dialogue-presentation.js';
import { GameController, baishiInteriorArtRegistry } from '../packages/client-runtime/index.js';
import { initialWorld } from '../packages/game-config/index.js';
import { sceneView } from '../packages/game-rules/index.js';
import { worldOrigin } from '../apps/web-game/src/presentation-layout.js';

async function bytes(id='BAISHI_INTERIOR_CLOTH_FG') {
  const resource=interiorResource(id,'https://assets.example.test');
  const file=await readFile(`assets/remote/${resource.path}`);
  return file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength) as ArrayBuffer;
}
test('all twelve formal interior PNGs match release dimensions, size and SHA-256',async()=>{
  for(const room of baishiInteriorArtRegistry) for(const id of [room.resourceId,room.foreground.resourceId]){
    const resource=interiorResource(id,'https://assets.example.test');
    await verifyInteriorBytes(resource,await bytes(id));
    assert.ok(resource.key.includes(resource.sha256));
    assert.ok(resource.url.includes(`?v=${resource.version}&h=`));
    assert.match(resource.fallbackPath,/generic_interior_/);
  }
});
test('wrong CDN bytes are rejected before becoming a texture; reload can recover',async()=>{
  const valid=await bytes(),calls:RequestCache[]=[];
  const fetcher:typeof fetch=async(_url,options)=>{calls.push(options!.cache!);return new Response(calls.length===1?new Uint8Array(24):valid);};
  const result=await fetchInteriorResource('BAISHI_INTERIOR_CLOTH_FG','https://assets.example.test',false,fetcher);
  assert.equal(result.source,'cdn');assert.deepEqual(calls,['default','reload']);
});
test('DEV recovery reads only the same canonical version after bounded CDN failures',async()=>{
  const valid=await bytes(),urls:string[]=[];
  const fetcher:typeof fetch=async(url)=>{urls.push(String(url));return urls.length<3?new Response('',{status:503}):new Response(valid);};
  const result=await fetchInteriorResource('BAISHI_INTERIOR_CLOTH_FG','https://assets.example.test',true,fetcher);
  assert.equal(result.source,'local-canonical');assert.equal(urls.length,3);
  assert.match(urls[2],/^\/__fjhy_source__\/world\/baishi\/interiors\/cloth\/foreground_v2.png\?h=/);
});
test('production download failure terminates; no legacy PNG or dev endpoint is requested',async()=>{
  const urls:string[]=[];
  await assert.rejects(fetchInteriorResource('BAISHI_INTERIOR_CLOTH_FG','https://assets.example.test',false,async(url)=>{urls.push(String(url));throw new Error('offline');}),/offline/);
  assert.equal(urls.length,2);assert.ok(urls.every(url=>url.startsWith('https://assets.example.test/')));
});
test('equal-size pixel corruption is caught by hash, not accepted as a formal texture',async()=>{
  const altered=await bytes();new Uint8Array(altered)[40]^=1;
  await assert.rejects(verifyInteriorBytes(interiorResource('BAISHI_INTERIOR_CLOTH_FG',''),altered),/hash mismatch/);
});
test('legacy full-resolution fallbacks are absent from Web public output source',async()=>{
  const files=await readdir('apps/admin/public/scene-layers/baishi/interiors');
  assert.equal(files.filter(file=>/^interior_.*\.png$/.test(file)).length,0);
});
test('Web has one speech renderer and never injects controller messages directly into the toast',async()=>{
  const web=await readFile('apps/web-game/src/main.ts','utf8');
  assert.equal((web.match(/createWebDialogueUi\(hud/g)??[]).length,1);
  assert.doesNotMatch(web,/message\.onclick\s*=/);
  assert.doesNotMatch(web,/message\.textContent\s*=\s*controller\./);
  assert.match(web,/dialogueUi\.sync\(controller\.dialogueSpeaker\?\?'',controller\.dialogue\?\?''/);
  assert.match(web,/controller\.render\([^\n]+\{origin,zoneLabels:false\}\)/);
});
test('speech, relationship metadata and shop feedback have distinct destinations',()=>{
  assert.equal(dialogueContext('初次结识：陈掌柜。\n关系状态：已认识。\n起来了？'),'初次结识：陈掌柜 · 关系状态：已认识');
  assert.equal(notificationDestination(true,true),'dialogue');
  assert.equal(notificationDestination(false,true),'toast');
  assert.equal(notificationDestination(false,false),'toast');
});
test('Chinese dialogue uses measured phrase wrapping rather than a fixed character count',()=>{
  const measure=(text:string)=>Array.from(text).length*20;
  assert.deepEqual(wrapDialogue('起来了？昨晚睡得还习惯吧？',measure,400),['起来了？昨晚睡得还习惯吧？']);
  assert.deepEqual(wrapDialogue('你眼光看着挺利落，正好帮我看看一块新料子。',measure,400),['你眼光看着挺利落，\n正好帮我看看一块新料子。']);
  const text='街坊杂货铺有鸣山大米。你先去买一份，再拿到白石商行问问收价。';
  const pages=wrapDialogue(text,measure,260);
  assert.equal(pages.join('').replace(/\n/g,''),text);
  for(const page of pages){assert.ok(page.split('\n').length<=3);for(const line of page.split('\n')){assert.ok(measure(line)<=260);assert.doesNotMatch(line,/^[，。！？、；：）】》]/);}}
});
test('shared painter portals and NPCs use the same clamped origin as Web map textures',()=>{
  const controller=new GameController(async()=>({}));
  controller.boot={player:{appearance:{}},colors:initialWorld.colors} as any;
  for(const sceneId of ['INTERIOR_B_INN_GUEST_ROOM','INTERIOR_B_INN','STREET_BAISHI_01']){
    controller.view=sceneView(initialWorld,sceneId,new Date('2026-09-05T02:00:00Z'));
    for(const [x,y] of [[2,2],[12,18],[44,44]]){
      controller.x=x;controller.y=y;
      const scene=controller.view.scene,origin=worldOrigin(960,540,scene.width*32,scene.height*32,x*32,y*32,1.08);
      const labels:{text:string;x:number;y:number}[]=[];
      const painter={rect(){},circle(){},text(text:string,x:number,y:number){labels.push({text,x,y});}};
      controller.render(painter,960,540,false,false,true,[],true,false,false,{origin,zoneLabels:false});
      for(const portal of scene.portals)assert.ok(labels.some(label=>label.text==='出口 ↓'&&label.x===origin.x+portal.x*32&&label.y===origin.y+(portal.y-1)*32));
      for(const npc of controller.view.npcs)assert.ok(labels.some(label=>label.text===npc.name&&label.x===origin.x+npc.x*32&&label.y===origin.y+npc.y*32-46));
    }
  }
});
