import test from 'node:test';
import assert from 'node:assert/strict';
import {applyHairTexture,composeHairTextures} from '../packages/client-runtime/hair-phaser.js';
import {hairConfigs} from '../packages/game-config/hair-services.js';
import {actorVisualScale} from '../packages/client-runtime/display-scale.js';

test('组合顺序保持 body/outfit 在下、hair 在上，并按 64×64 注册帧',()=>{
  const order:string[]=[],keys=new Set(['player-male-body-v1','PLAYER_M_HAIR_01']);
  const textures={exists:(k:string)=>keys.has(k),get:(k:string)=>({getSourceImage:()=>k}),createCanvas:(key:string,w:number,h:number)=>{assert.equal(w,256);assert.equal(h,256);keys.add(key);return {context:{drawImage:(k:string)=>order.push(k)},refresh(){}};},addSpriteSheet:(_key:string,_source:unknown,config:unknown)=>assert.deepEqual(config,{frameWidth:64,frameHeight:64})};
  composeHairTextures({textures} as any,[hairConfigs[0]]);assert.deepEqual(order,['player-male-body-v1','PLAYER_M_HAIR_01']);
});
test('所有方向与室内外缩放保持原 sprite 帧、世界位置、原点、可见性和深度',()=>{
  for(const sceneId of ['STREET_BAISHI_01','INTERIOR_B_SALON'])for(let frame=0;frame<16;frame++){
    const sprite={frame:{name:frame},x:123,y:456,visible:true,depth:789,originX:.5,originY:59/64,displayWidth:64*actorVisualScale(sceneId),displayHeight:64*actorVisualScale(sceneId),key:'old',setTexture(key:string,value:number){this.key=key;this.frame.name=value;return this;},setOrigin(x:number,y:number){this.originX=x;this.originY=y;return this;},setDisplaySize(w:number,h:number){this.displayWidth=w;this.displayHeight=h;return this;}};
    const before={...sprite};applyHairTexture({textures:{exists:()=>true}} as any,sprite as any,'MALE','M_HAIR_02');
    for(const key of ['x','y','visible','depth','originX','originY','displayWidth','displayHeight'] as const)assert.equal(sprite[key],before[key]);assert.equal(sprite.frame.name,frame);assert.equal(sprite.key,'appearance:M_HAIR_02:PLAYER_M_HAIR_02');
  }
});
test('旧 ID 或异性 ID 安全回退；缺图保留整角色 fallback',()=>{
  const keys:string[]=[];const scene={textures:{exists:(key:string)=>{keys.push(key);return false;}}};
  const sprite={key:'complete-player'};applyHairTexture(scene as any,sprite as any,'FEMALE','LEGACY_HAIR');assert.equal(keys[0],'appearance:F_HAIR_01:PLAYER_F_HAIR_01');assert.equal(sprite.key,'complete-player');
  applyHairTexture(scene as any,sprite as any,'MALE','F_HAIR_02');assert.equal(keys[1],'appearance:M_HAIR_01:PLAYER_M_HAIR_01');
});
