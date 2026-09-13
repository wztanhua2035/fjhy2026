import React from 'react';
import {Input,InputNumber,Select,Switch,Table} from 'antd';
import type {WorldConfig,ItemConfig} from '../../../packages/shared-types/index.js';

/** Edits the existing release draft; publication still uses TEST → PUBLISHED. */
export function ShopEditor({json,onChange}:{json:string;onChange:(json:string)=>void}){
  let world:WorldConfig;try{world=JSON.parse(json);}catch{return <p>请先修正配置草稿 JSON。</p>;}
  const save=()=>onChange(JSON.stringify(world,null,2));
  const set=(item:ItemConfig,key:keyof ItemConfig,value:unknown)=>{Object.assign(item,{[key]:value});save();};
  return <><p>价格为 V1 待验证数值。修改写入配置草稿，保存并发布后生效。已有 ID 不可修改。</p>
    <Table rowKey="id" dataSource={world.items.filter(i=>!i.questOnly)} pagination={false} scroll={{x:1100}} columns={[
      {title:'Item ID',dataIndex:'id'},
      {title:'名称',render:(_,i)=><Input aria-label={`${i.id} 名称`} value={i.name} onChange={e=>set(i,'name',e.target.value)}/>},
      {title:'描述',render:(_,i)=><Input value={i.description??''} onChange={e=>set(i,'description',e.target.value)}/>},
      {title:'分类',render:(_,i)=><Select value={i.category??'FOOD'} options={['FOOD','DRINK','HOUSEHOLD'].map(value=>({value}))} onChange={v=>set(i,'category',v)}/>},
      {title:'叠加上限',render:(_,i)=><InputNumber min={1} max={999} precision={0} value={i.stackMax} onChange={v=>v!==null&&set(i,'stackMax',v)}/>},
      {title:'启用',render:(_,i)=><Switch checked={i.enabled!==false} onChange={v=>set(i,'enabled',v)}/>},
      {title:'所属店铺',render:(_,i)=><Select mode="multiple" style={{minWidth:170}} value={world.buildings.filter(b=>b.stock[i.id]).map(b=>b.id)} options={world.buildings.filter(b=>Object.keys(b.stock).length).map(b=>({value:b.id,label:b.name}))} onChange={ids=>{for(const b of world.buildings){if(ids.includes(b.id)&&!b.stock[i.id])b.stock[i.id]={buy:i.basePrice,sell:Math.max(1,Math.floor(i.basePrice/2)),dailyLimit:999,stockMode:'infinite',enabled:true};else if(!ids.includes(b.id))delete b.stock[i.id];}save();}}/>}
    ]}/>
    {world.buildings.filter(b=>Object.keys(b.stock).length).map(b=><section key={b.id}><h3>{b.name} · {b.id}</h3><Table rowKey="id" pagination={false} dataSource={Object.entries(b.stock).map(([id,stock])=>({id,...stock}))} columns={[
      {title:'商品',render:(_,r)=>world.items.find(i=>i.id===r.id)?.name??r.id},
      {title:'购买单价',render:(_,r)=><InputNumber min={1} max={1000000} precision={0} value={r.buy} onChange={v=>{if(v!==null){b.stock[r.id].buy=v;save();}}}/>},
      {title:'回收单价',render:(_,r)=><InputNumber min={1} max={1000000} precision={0} value={r.sell} onChange={v=>{if(v!==null){b.stock[r.id].sell=v;save();}}}/>},
      {title:'上架',render:(_,r)=><Switch checked={r.enabled!==false} onChange={v=>{b.stock[r.id].enabled=v;save();}}/>}
    ]}/></section>)}
  </>;
}
