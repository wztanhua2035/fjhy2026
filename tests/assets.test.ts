import test from 'node:test';
import assert from 'node:assert/strict';
import {drawBuildingAsset,drawSpriteSheet,drawSpriteSheetOrFallback,emptyPortraitState,portraitState,spriteFrame,ImageAssetStore,GROUND_DEPTH,PORTRAIT_DIM_DEPTH,PORTRAIT_DEPTH,UI_DEPTH_BASE,worldActorDepth,worldBuildingDepth,buildingImagePosition,foregroundImagePosition,baishiFormalArtRegistry,baishiInteriorArtRegistry,type ImageSource} from '../packages/client-runtime/assets.js';

const image:ImageSource={width:1254,height:1254};
test('建筑资源使用 origin 绘制并保留前景元数据',()=>{const calls:any[]=[];const target={drawImage:(...args:any[])=>calls.push(args)};drawBuildingAsset(target,image,{assetKey:'test',imagePath:'/test.png',worldX:32.5,worldY:20,renderWidth:320,renderHeight:384,originX:.5,originY:1,depth:30,foreground:{assetKey:'fg',imagePath:'/fg.png',offsetX:0,offsetY:-128,depth:50}});assert.deepEqual(calls[0].slice(5),[-127.5,-364,320,384]);});
test('spritesheet 按方向行、帧列和 foot anchor 切帧',()=>{const calls:any[]=[];const target={drawImage:(...args:any[])=>calls.push(args)};const asset={assetKey:'npc',imagePath:'/npc.png',frameWidth:313,frameHeight:313,columns:4,rows:4,directionRows:{down:0,left:1,right:2,up:3},framesPerDirection:4,footAnchorX:156,footAnchorY:300,renderScale:1};assert.deepEqual(spriteFrame(asset,'right',2),{sx:626,sy:626,sw:313,sh:313});drawSpriteSheet(target,image,asset,'right',2,100,200);assert.deepEqual(calls[0].slice(1,5),[626,626,313,313]);assert.deepEqual(calls[0].slice(5),[-56,-100,313,313]);});
test('portrait 默认降级且重要模式提供双槽和压暗',()=>{assert.deepEqual(emptyPortraitState(),{portraitMode:false,backgroundDim:false});const left={assetKey:'left',imagePath:'/left.png',preferredWidth:256,preferredHeight:360,slot:'left' as const,originX:.5,originY:1};assert.deepEqual(portraitState(left,undefined,'left'),{portraitMode:true,backgroundDim:true,left,right:undefined,speaking:'left'});});

test('正式图片缺失时调用 fallback，资源加载结果可缓存',async()=>{const asset={assetKey:'npc',imagePath:'/npc.png',frameWidth:64,frameHeight:64,columns:4,rows:4,directionRows:{down:0,left:1,right:2,up:3},framesPerDirection:4,footAnchorX:32,footAnchorY:60,renderScale:1};let fallback=0;drawSpriteSheetOrFallback({drawImage:()=>{}},undefined,asset,'down',0,0,0,()=>fallback++);assert.equal(fallback,1);const store=new ImageAssetStore(),loaded={width:64,height:64};assert.equal(await store.load('test',async()=>loaded),loaded);assert.equal(store.get('test'),loaded);});


test('world Y-depth places actors behind or ahead of a building front edge',()=>{
  const front=37;
  assert.ok(worldActorDepth(front-1)<worldBuildingDepth(front));
  assert.ok(worldActorDepth(front+.01)>worldBuildingDepth(front));
  assert.ok(worldActorDepth(front)>worldBuildingDepth(front));
  assert.ok(worldActorDepth(9)<worldActorDepth(10));
});

test('optional foreground uses the building anchor for placement and its own world-Y edge',()=>{
  const asset={assetKey:'base',imagePath:'/base.png',worldX:34,worldY:37,renderWidth:384,renderHeight:320,originX:.5,originY:1,depth:30,occlusionFrontY:37,foreground:{assetKey:'fg',imagePath:'/fg.png',offsetX:12,offsetY:24,depth:50},foregroundOcclusionFrontY:36.5};
  assert.deepEqual(foregroundImagePosition(asset),{x:-146,y:-259});
  assert.ok(worldActorDepth(36)<worldBuildingDepth(asset.foregroundOcclusionFrontY));
  assert.ok(worldActorDepth(37)>worldBuildingDepth(asset.foregroundOcclusionFrontY));
});

test('春衫衣坊 V2.1 独立启用同锚点 foreground',()=>{
  const cloth=baishiFormalArtRegistry.buildings.find(asset=>asset.buildingId==='B_CLOTH')!;
  assert.equal(cloth.imagePath,'/scene-layers/baishi/formal/building_cloth_shop_base.png?v=cloth-v2.1-final');
  assert.deepEqual(cloth.foreground,{assetKey:'building_cloth_shop_fg',imagePath:'/scene-layers/baishi/formal/building_cloth_shop_fg.png?v=cloth-v2.1-final',offsetX:0,offsetY:0,depth:50});
  assert.equal(cloth.foregroundOcclusionFrontY,36);
  assert.deepEqual(foregroundImagePosition(cloth),{x:-158,y:-283});
  assert.deepEqual(baishiFormalArtRegistry.buildings.filter(asset=>asset.foregroundOcclusionFrontY!==undefined).map(asset=>asset.buildingId),['B_CLOTH']);
});

test('五栋正式建筑使用共享挂载元数据还原 Web world-space 位置',()=>{
  const positions=Object.fromEntries(baishiFormalArtRegistry.buildings.map(asset=>[asset.buildingId,buildingImagePosition(asset,32)]));
  assert.deepEqual(positions,{
    B_TRADE:{x:875,y:256},
    B_INN:{x:107,y:256},
    B_GROCERY:{x:512,y:256},
    B_SALON:{x:1248,y:224},
    B_CLOTH:{x:896,y:864}
  });
});

test('world objects remain above ground and below portrait UI',()=>{
  const maxWorld=worldActorDepth(80);
  assert.ok(GROUND_DEPTH<worldBuildingDepth(19));
  assert.ok(worldBuildingDepth(37)<maxWorld);
  assert.ok(maxWorld<UI_DEPTH_BASE);
  assert.ok(PORTRAIT_DIM_DEPTH<PORTRAIT_DEPTH);
});


test('白石街建筑遮挡前沿以南立面与门前步道分界校准',()=>{const front=Object.fromEntries(baishiFormalArtRegistry.buildings.map(asset=>[asset.buildingId,asset.occlusionFrontY]));assert.deepEqual(front,{B_TRADE:19,B_INN:19,B_GROCERY:19,B_SALON:19,B_CLOTH:37});for(const buildingId of ['B_TRADE','B_INN','B_GROCERY'] as const){const edge=front[buildingId]!;assert.ok(worldActorDepth(20)>worldBuildingDepth(edge),buildingId+' 门前主街应显示玩家');assert.ok(worldActorDepth(18)<worldBuildingDepth(edge),buildingId+' 北侧应被建筑遮挡');}});

test('五座室内正式美术均复用锁定的 24×20 尺寸并拥有独立前景',()=>{
  assert.deepEqual(baishiInteriorArtRegistry.map(asset=>asset.sceneId),['INTERIOR_B_SALON','INTERIOR_B_GROCERY','INTERIOR_B_TRADE','INTERIOR_B_CLOTH','INTERIOR_B_INN']);
  for(const asset of baishiInteriorArtRegistry){assert.equal(asset.width,768);assert.equal(asset.height,640);assert.match(asset.imagePath,/\/interiors\//);assert.match(asset.foreground.imagePath,/\/interiors\//);assert.ok(worldActorDepth(asset.foreground.occlusionFrontY-.1)<worldBuildingDepth(asset.foreground.occlusionFrontY));}
});
