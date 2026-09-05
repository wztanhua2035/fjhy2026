import test from 'node:test';
import assert from 'node:assert/strict';
import {GameController} from '../packages/client-runtime/index.js';
test('弱网重试保留完全相同请求，确认前阻止新经济操作',async()=>{const calls:any[]=[];let fail=true;const c=new GameController(async(path,body)=>{calls.push({path,body});if(fail)throw new Error('offline');return {ok:true};});await assert.rejects(()=>c.write('/v1/economy/buy',{itemId:'RICE_01'}));assert.ok(c.pending);await assert.rejects(()=>c.write('/v1/economy/buy',{itemId:'RICE_01'}),/尚未确认/);assert.equal(calls.length,1);fail=false;await c.retry();assert.deepEqual(calls[0],calls[1]);assert.equal(c.pending,null);assert.equal(c.offline,false);});
test('明确业务拒绝不无限重试',async()=>{const c=new GameController(async()=>{throw Object.assign(new Error('库存不足'),{status:400});});await assert.rejects(()=>c.write('/v1/economy/sell',{itemId:'RICE_01'}));assert.equal(c.pending,null);});
